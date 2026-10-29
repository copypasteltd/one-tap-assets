import { readFileSync } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import type pg from 'pg';
import { inside, type Config } from '../../api/config.js';
import type { ObjectStorage } from '../../api/storage/storage.js';
import { hash, id } from '../../api/lib/crypto.js';
import { notFound, requireThat } from '../../api/lib/errors.js';
import { validateInternal } from '../../api/lib/validation.js';
import { executionContext, type ExecutionContext } from '../compiler/order-context.js';
import { artifactSetHash, checkpointHash, receiptFromArtifacts, type MediaOperation, type MediaPhase, type MediaReceipt } from '../media/artifacts.js';
import { PhotoMediaPipeline, checkReceiptSlots } from '../media/photo-pipeline.js';
import {GeneratedMediaPipeline} from '../media/generated-pipeline.js';
import {NativeOrderMediaPipeline} from '../media/native-order-pipeline.js';
import type {GenerationGateway} from '../generation/gateway.js';
import type {SpeechGateway} from '../speech/gateway.js';
import type { ToolHandler } from './consumer.js';
import type { ToolScope } from './http.js';

export interface MediaStageResult {
  tenant_id: string; order_id: string; preview_session_id: null; run_id: string; role: MediaPhase;
  input_hash: string; snapshot_hash: string; skill_bundle_hash: string; output_asset_ids: string[];
  tool_receipt_ids: string[]; checkpoint_hash: string; result: 'READY'; reason_codes: string[];
}
export const mediaStageResultSchema: unknown = JSON.parse(readFileSync('assets/development/v1.1/contracts/agent-stage-result.schema.json', 'utf8'));
async function stageResult(db: pg.Pool | pg.PoolClient, context: ExecutionContext, scope: ToolScope, receipt: MediaReceipt, toolId: string): Promise<MediaStageResult> {
  const run = (await db.query<{ data: { skill_bundle_hash: string } }>('SELECT data FROM agent_runs WHERE tenant_id=$1 AND id=$2', [scope.tenant_id, scope.run_id])).rows[0] ?? notFound();
  return { tenant_id: scope.tenant_id, order_id: context.orderId, preview_session_id: null, run_id: scope.run_id,
    role: receipt.phase, input_hash: scope.snapshot_hash, snapshot_hash: context.snapshotHash, skill_bundle_hash: run.data.skill_bundle_hash,
    output_asset_ids: receipt.artifacts.map(a => a.id), tool_receipt_ids: [toolId], checkpoint_hash: checkpointHash(receipt), result: 'READY', reason_codes: [] };
}
export async function validateMediaStageResult(db: pg.Pool | pg.PoolClient, context: ExecutionContext, stageId: string, runId: string, phase: MediaPhase, raw: unknown): Promise<{ result: MediaStageResult; receipt: MediaReceipt }> {
  validateInternal('agent-stage-result', raw); const result = raw as MediaStageResult;
  requireThat(result.tenant_id === context.tenantId && result.order_id === context.orderId && result.preview_session_id === null
    && result.run_id === runId && result.role === phase && result.input_hash === context.snapshotHash
    && result.snapshot_hash === context.snapshotHash && result.skill_bundle_hash === context.snapshot.codex_contract.skill_bundle_hash
    && result.result === 'READY' && result.reason_codes.length === 0, 'MEDIA_STAGE_RESULT_INVALID', '媒体阶段结果不属于当前运行或不是可验收结果', 422);
  const run = (await db.query<{ role: string; input_hash: string; private: { stage_run_id: string }; data: { skill_bundle_hash: string } }>(
    "SELECT role,input_hash,private,data FROM agent_runs WHERE tenant_id=$1 AND id=$2 AND state IN ('RUNNING','SUCCEEDED')", [context.tenantId, runId])).rows[0];
  requireThat(run?.role === phase && run.input_hash === context.snapshotHash && run.private.stage_run_id === stageId
    && run.data.skill_bundle_hash === result.skill_bundle_hash, 'MEDIA_STAGE_RESULT_INVALID', '媒体结果缺少对应的角色执行证据', 422);
  const operations = (await db.query<MediaOperation>(`SELECT * FROM media_operations WHERE tenant_id=$1 AND order_id=$2 AND stage_run_id=$3
    AND phase=$4 AND state='READY'`, [context.tenantId, context.orderId, stageId, phase])).rows;
  requireThat(operations.length === 1, 'MEDIA_OUTPUT_INCOMPLETE', '当前媒体阶段缺少唯一完整的持久产物', 422);
  const receipt = await receiptFromArtifacts(db, context, operations[0]!); checkReceiptSlots(context, receipt);
  requireThat(result.checkpoint_hash === checkpointHash(receipt) && new Set(result.output_asset_ids).size === receipt.artifacts.length
    && result.output_asset_ids.length === receipt.artifacts.length && receipt.artifacts.every(a => result.output_asset_ids.includes(a.id)),
    'MEDIA_OUTPUT_INCOMPLETE', '角色报告的产物与实际完整清单不一致', 422);
  const proofs = (await db.query<{ id: string; tool_name: string; data: { result?: { operation_id?: string; output_set_hash?: string; artifact_ids?: string[] } } }>(
    "SELECT id,tool_name,data FROM agent_tool_intents WHERE tenant_id=$1 AND run_id=$2 AND id=ANY($3) AND state='SUCCEEDED'",
    [context.tenantId, runId, result.tool_receipt_ids])).rows;
  const required = phase === 'PRODUCTION' ? context.snapshot.engine==='PHOTO_LAYOUT'?'render_photo_pack':'render_generated_pack' : 'execute_post_plan';
  const inspected = proofs.filter(p => p.tool_name === 'inspect_actual_media' && p.data.result?.output_set_hash === artifactSetHash(receipt.artifacts))
    .flatMap(p => p.data.result?.artifact_ids ?? []);
  requireThat(proofs.length === result.tool_receipt_ids.length && new Set(result.tool_receipt_ids).size === proofs.length
    && proofs.some(p => p.tool_name === required && p.data.result?.operation_id === receipt.operation_id
      && p.data.result.output_set_hash === artifactSetHash(receipt.artifacts))
    && proofs.every(p => p.tool_name === required || p.tool_name === 'inspect_actual_media')
    && receipt.artifacts.every(a => inspected.includes(a.id)) && inspected.every(a => result.output_asset_ids.includes(a)),
    'MEDIA_TOOL_PROOF_MISSING', '媒体阶段缺少本次运行的成功工具回执', 422);
  return { result, receipt };
}
export function productionTools(pool: pg.Pool, cfg: Config, store: ObjectStorage,gateway?:GenerationGateway,speech?:SpeechGateway): Record<string, ToolHandler> {
  requireThat(!(gateway||speech)||cfg.env==='test','TEST_PORT_FORBIDDEN','制作供应商端口仅限测试',500);
  const pipelineFor=(context:ExecutionContext)=>context.snapshot.engine==='PHOTO_LAYOUT'?new PhotoMediaPipeline(pool,cfg,store)
    :context.snapshot.audio_policy.speech_mode==='NATIVE_ZH'?new NativeOrderMediaPipeline(pool,cfg,store,gateway,speech):new GeneratedMediaPipeline(pool,cfg,store,gateway);
  const render = (phase: MediaPhase,generatedOnly?:boolean): ToolHandler => async (scope, args, intent, signal) => {
    requireThat(args.snapshot_hash===scope.snapshot_hash,'INPUT_HASH_MISMATCH','制作参数与原冻结输入不一致',422);
    const context=await executionContext(pool,scope.tenant_id,scope.order_id!,scope.snapshot_hash,scope.stage_run_id);
    if(phase==='PRODUCTION')requireThat((context.snapshot.engine!=='PHOTO_LAYOUT')===generatedOnly,
      'MEDIA_ROUTE_UNAVAILABLE','制作工具与原冻结路线不一致',503);
    const pipeline=pipelineFor(context);
    const output = await pipeline.execute(scope, intent, phase, signal);
    return { result: { ...(output.result as object), stage_result: await stageResult(pool, context, scope, output.receipt, intent.id) }, commit: output.commit };
  };
  return {
    render_photo_pack: render('PRODUCTION',false),render_generated_pack:render('PRODUCTION',true), execute_post_plan: render('POST'),
    transcribe_actual_audio:async(scope,args,_intent,signal)=>{
      const transcript=await new NativeOrderMediaPipeline(pool,cfg,store,gateway,speech).transcribe(scope,String(args.artifact_id),signal);
      return {result:{submission_id:transcript.submission_id,state:'SUCCEEDED',source_artifact_id:transcript.source_artifact_id,
        transcript_hash:hash(transcript.transcript),transcript:transcript.transcript}};
    },
    inspect_actual_media: async (scope, args, intent, signal) => {
      requireThat(scope.order_id && (scope.role === 'PRODUCTION' || scope.role === 'POST'), 'MEDIA_SCOPE_INVALID', '此检查入口只接受制作或后期角色', 409);
      const context = await executionContext(pool, scope.tenant_id, scope.order_id, scope.snapshot_hash,scope.stage_run_id); const ids = args.asset_ids as string[];
      const rows = (await pool.query<{ media_operation_id: string }>(`SELECT a.media_operation_id FROM artifacts a JOIN media_operations m ON m.id=a.media_operation_id AND m.tenant_id=a.tenant_id
        WHERE a.tenant_id=$1 AND a.order_id=$2 AND a.id=ANY($3) AND m.state='READY' AND m.phase=$4`, [scope.tenant_id, scope.order_id, ids, scope.role])).rows;
      requireThat(rows.length === ids.length && new Set(rows.map(r => r.media_operation_id)).size === 1, 'MEDIA_SELECTION_INVALID', '检查清单包含其他订单或阶段的产物', 422);
      const operation = (await pool.query<MediaOperation>('SELECT * FROM media_operations WHERE tenant_id=$1 AND id=$2', [scope.tenant_id, rows[0]!.media_operation_id])).rows[0]!;
      requireThat(operation.stage_run_id === scope.stage_run_id, 'MEDIA_SELECTION_INVALID', '检查产物不属于当前阶段', 422);
      const receipt = await receiptFromArtifacts(pool, context, operation); const directory = inside(cfg.runtimeRoot, `media-inspect/${id('inspect')}`);
      await mkdir(directory, { recursive: true });
      try { await pipelineFor(context).verify(context, receipt, directory, signal, new Set(ids)); }
      finally { await rm(directory, { recursive: true, force: true }); }
      return { result: { inspected: true, tool_receipt_id: intent.id, artifact_ids: ids, output_set_hash: artifactSetHash(receipt.artifacts),
        reports: receipt.artifacts.filter(a => ids.includes(a.id)).map(a => ({ artifact_id: a.id, sha256: a.sha256, actual: a.spec.inspection })) } };
    },
    persist_stage_result: async (scope, args) => {
      requireThat(scope.order_id && (scope.role === 'PRODUCTION' || scope.role === 'POST'), 'MEDIA_SCOPE_INVALID', '此结果入口只接受制作或后期角色', 409);
      const context = await executionContext(pool, scope.tenant_id, scope.order_id, scope.snapshot_hash,scope.stage_run_id);
      const { result } = await validateMediaStageResult(pool, context, scope.stage_run_id, scope.run_id, scope.role, args.result); const resultHash = hash(result);
      return { result: { persisted: true, result_hash: resultHash }, commit: async db => {
        const latest = await executionContext(db, scope.tenant_id, scope.order_id!, scope.snapshot_hash,scope.stage_run_id);
        await validateMediaStageResult(db, latest, scope.stage_run_id, scope.run_id, scope.role as MediaPhase, result);
        const written = await db.query(`UPDATE agent_runs SET output_hash=$3,private=private||jsonb_build_object('stage_result',$4::jsonb),updated_at=now()
          WHERE tenant_id=$1 AND id=$2 AND state='RUNNING'`, [scope.tenant_id, scope.run_id, resultHash, JSON.stringify(result)]);
        requireThat(written.rowCount === 1, 'TOOL_SCOPE_ENDED', '媒体角色已结束，不能覆盖阶段结果', 409);
      } };
    },
  };
}
