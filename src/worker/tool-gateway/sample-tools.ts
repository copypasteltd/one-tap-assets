import type {GenerationGateway} from '../generation/gateway.js';
import {sampleGenerationContext} from '../samples/generation.js';
import {referenceTools} from './reference-tools.js';
import Ajv2020 from 'ajv/dist/2020.js';
import type pg from 'pg';
import { mkdir, rm } from 'node:fs/promises';
import { inside, type Config } from '../../api/config.js';
import { hash } from '../../api/lib/crypto.js';
import { requireThat } from '../../api/lib/errors.js';
import type { Db } from '../../api/db/pool.js';
import type { ObjectStorage } from '../../api/storage/storage.js';
import { validateCreativePlan, type CreativePlan } from '../compiler/plan.js';
import { sampleContext, type SampleContext } from '../samples/context.js';
import { renderSample, storedMedia, verifyMedia, verifySampleGeneratedReceipt, type SampleMediaReceipt } from '../samples/media.js';
import { samplePacket, packetAssetIds, validateSampleReview } from '../samples/review.js';
import type { ToolHandler } from './consumer.js';
import type { ToolScope } from './http.js';
import type {SampleSpeechGateway} from '../samples/speech.js';

export interface SampleMediaResult { phase: 'PRODUCTION' | 'POST'; snapshot_hash: string; operation_id: string; artifact_ids: string[]; tool_receipt_ids: string[] }
const list = { type: 'array', minItems: 1, maxItems: 100, uniqueItems: true, items: { type: 'string', maxLength: 128 } };
export const sampleMediaResultSchema = { type: 'object', additionalProperties: false, required: ['phase','snapshot_hash','operation_id','artifact_ids','tool_receipt_ids'], properties: {
  phase: { enum: ['PRODUCTION','POST'] }, snapshot_hash: { type: 'string', pattern: '^[a-f0-9]{64}$' }, operation_id: { type: 'string', maxLength: 128 }, artifact_ids: list, tool_receipt_ids: list,
} };
const valid = new Ajv2020({ strict: false }).compile<SampleMediaResult>(sampleMediaResultSchema);
const phaseFor = (scope: ToolScope): 'PRODUCTION' | 'POST' => {
  requireThat(scope.scope_type === 'SAMPLE' && ((scope.role === 'PRODUCTION' && scope.stage_name === 'SAMPLE_PRODUCTION')
    || (scope.role === 'POST' && scope.stage_name === 'SAMPLE_POST')), 'SAMPLE_TOOL_SCOPE_INVALID', '样例媒体工具阶段不匹配', 403); return scope.role;
};
async function context(db: Db, scope: ToolScope): Promise<SampleContext> {
  requireThat(scope.scope_type === 'SAMPLE' && scope.scope_id === scope.preview_session_id, 'SAMPLE_TOOL_SCOPE_INVALID', '工具不属于本次样例', 403);
  return sampleContext(db, scope.tenant_id, scope.scope_id, scope.snapshot_hash);
}
export async function validateSampleMediaResult(db: Db, c: SampleContext, runId: string, raw: unknown): Promise<SampleMediaResult> {
  requireThat(valid(raw), 'SAMPLE_MEDIA_RESULT_INVALID', '样例制作结果结构无效', 422); const result = raw; const media = storedMedia(c, result.phase);
  requireThat(result.snapshot_hash === c.inputHash && result.operation_id === media.operation_id && result.artifact_ids.length === media.artifacts.length
    && media.artifacts.every(a => result.artifact_ids.includes(a.artifact_id)), 'SAMPLE_MEDIA_RESULT_INVALID', '样例制作结果与实际文件不一致', 422);
  const proofs = (await db.query<{ id: string; tool_name: string; data: { result: { operation_id?: string; artifact_ids?: string[] } } }>(`SELECT id,tool_name,data FROM agent_tool_intents WHERE tenant_id=$1 AND run_id=$2
    AND state='SUCCEEDED' AND id=ANY($3)`, [c.input.tenant_id, runId, result.tool_receipt_ids])).rows;
  requireThat(proofs.length === result.tool_receipt_ids.length && [result.phase === 'PRODUCTION' ? c.input.source.engine==='PHOTO_LAYOUT'?'render_photo_pack':'render_generated_pack' : 'execute_post_plan','inspect_actual_media'].every(name =>
    proofs.some(p => p.tool_name === name && p.data.result.operation_id === media.operation_id && hash(p.data.result.artifact_ids) === hash(media.artifacts.map(a => a.artifact_id)))),
  'SAMPLE_MEDIA_INSPECTION_MISSING', '样例缺少本角色的实际制作与完整检测回执', 503); return result;
}
async function persist(db: Db, scope: ToolScope, result: unknown): Promise<void> {
  await context(db, scope);
  const saved = await db.query(`UPDATE agent_runs SET output_hash=$3,private=private||jsonb_build_object('stage_result',$4::jsonb),updated_at=now()
    WHERE tenant_id=$1 AND id=$2 AND state='RUNNING' AND (output_hash IS NULL OR output_hash=$3)`, [scope.tenant_id, scope.run_id, hash(result), JSON.stringify(result)]);
  requireThat(saved.rowCount === 1, 'TOOL_SCOPE_ENDED', '样例角色已结束或结果已冻结', 409);
}
export function sampleTools(pool: pg.Pool, cfg: Config, store: ObjectStorage,gateway?:GenerationGateway,speech?:SampleSpeechGateway): Record<string, ToolHandler> {
  requireThat((!gateway&&!speech)||cfg.env==='test','TEST_PORT_FORBIDDEN','样例供应商替身仅限测试',500);
  const references=referenceTools(pool,cfg,store,async(db,scope)=>sampleGenerationContext(await context(db,scope)));
  const media = (phase: 'PRODUCTION' | 'POST'): ToolHandler => async (scope, _args, intent, signal) => {
    requireThat(phaseFor(scope) === phase, 'SAMPLE_TOOL_SCOPE_INVALID', '样例制作工具与角色不匹配', 403);
    const receipt = await renderSample(pool, cfg, store, scope, phase, signal,gateway,speech);
    const result: SampleMediaResult = { phase, snapshot_hash: receipt.snapshot_hash, operation_id: receipt.operation_id, artifact_ids: receipt.artifacts.map(a => a.artifact_id), tool_receipt_ids: [intent.id] };
    return { result, commit: async db => {
      const c = await context(db, scope); const key = phase.toLowerCase();
      await verifySampleGeneratedReceipt(db,cfg,store,c,receipt);
      requireThat(!c.private[key] || hash(c.private[key]) === hash(receipt), 'SAMPLE_OPERATION_CHANGED', '样例原制作记录不可替换', 409);
      await db.query(`UPDATE public_samples SET private=private||jsonb_build_object($3::text,$4::jsonb,$5::text,$6::text),updated_at=now()
        WHERE tenant_id=$1 AND id=$2`, [scope.tenant_id, scope.scope_id, key, JSON.stringify(receipt), `${key}_hash`, hash(receipt)]);
    } };
  };
  return {
    analyze_photos: async scope => {
      const c = await context(pool, scope); requireThat(scope.role === 'CONTENT', 'SAMPLE_TOOL_SCOPE_INVALID', '商品分析工具只供内容角色读取', 403);
      return { result: { profile: c.input.profile, source: 'FROZEN_AUTHOR_VISION_EVIDENCE' } };
    },
    validate_content_plan: async (scope, args) => {
      const c = await context(pool, scope); requireThat(scope.role === 'CONTENT', 'SAMPLE_TOOL_SCOPE_INVALID', '计划校验工具只供内容角色使用', 403);
      validateCreativePlan(args.plan as CreativePlan, c.input.profile, c.input.source); return { result: { valid: true, plan_hash: hash(args.plan) } };
    },
    render_photo_pack:async(scope,args,intent,signal)=>{const c=await context(pool,scope);requireThat(c.input.source.engine==='PHOTO_LAYOUT','SAMPLE_ROUTE_UNAVAILABLE','该样例不能换成原图路线',403);return media('PRODUCTION')(scope,args,intent,signal);},
    render_generated_pack:async(scope,args,intent,signal)=>{const c=await context(pool,scope);requireThat(c.input.generation,'SAMPLE_GENERATION_NOT_FROZEN','该样例未冻结生成路线',403);return media('PRODUCTION')(scope,args,intent,signal);},execute_post_plan: media('POST'),
    inspect_actual_media: async (scope, args, intent, signal) => {
      const phase = phaseFor(scope); const c = await context(pool, scope); const receipt = storedMedia(c, phase); const ids = args.asset_ids as string[];
      requireThat(ids.length === receipt.artifacts.length && receipt.artifacts.every(a => ids.includes(a.artifact_id)), 'SAMPLE_PACK_INCOMPLETE', '必须检测本阶段全部实际素材', 422);
      const directory = inside(cfg.runtimeRoot, `sample-inspection/${intent.id}`); await mkdir(directory, { recursive: true });
      try { await verifyMedia(pool, cfg, store, c, receipt, directory, signal); }
      finally { await rm(inside(cfg.runtimeRoot, directory), { recursive: true, force: true }); }
      return { result: { operation_id: receipt.operation_id, artifact_ids: receipt.artifacts.map(a => a.artifact_id), tool_receipt_id: intent.id } };
    },
    extract_review_evidence: async (scope,args,intent,signal) => {
      if(scope.stage_name==='SAMPLE_PRODUCTION')return references.extract_review_evidence!(scope,args,intent,signal);
      const c = await context(pool, scope); const packet = samplePacket(c);
      requireThat(['REVIEW_FACTS','REVIEW_STYLE'].includes(scope.role) && scope.packet_hash === packet.packet_hash, 'SAMPLE_TOOL_SCOPE_INVALID', '复核材料与本角色不匹配', 403);
      return { result: { packet_hash: packet.packet_hash, output_set_hash: packet.output_set_hash, copy: packet.copy,
        ...(packet.native_audio?{native_audio:packet.native_audio,listening:packet.listening}:{}),
        images: packet.images.map(({ object_key: _key, ...data }) => data), artifacts: packet.artifacts.map(({ object_key: _key, ...data }) => data),
        report_requirements: { role: scope.role, packet_hash: packet.packet_hash, checked_asset_ids: packetAssetIds(packet),
          ...(packet.native_audio?{audio_evidence_hash:hash({native_audio:packet.native_audio,listening:packet.listening})}:{}) } } };
    },
    persist_stage_result: async (scope, args,intent,signal) => {
      if(scope.stage_name==='SAMPLE_PRODUCTION'&&scope.role==='REVIEW_FACTS')return references.persist_stage_result!(scope,args,intent,signal);
      const c = await context(pool, scope);
      if (scope.role === 'CONTENT') {
        validateCreativePlan(args.result as CreativePlan, c.input.profile, c.input.source);
        return { result: { persisted: true, result_hash: hash(args.result) }, commit: async db => { const current = await context(db, scope); validateCreativePlan(args.result as CreativePlan, current.input.profile, current.input.source); await persist(db, scope, args.result); } };
      }
      if (scope.role === 'PRODUCTION' || scope.role === 'POST') {
        const result = await validateSampleMediaResult(pool, c, scope.run_id, args.result);
        requireThat(result.phase === phaseFor(scope), 'SAMPLE_TOOL_SCOPE_INVALID', '样例结果阶段与角色不一致', 403);
        return { result: { persisted: true, result_hash: hash(result) }, commit: async db => { const current = await context(db, scope); await validateSampleMediaResult(db, current, scope.run_id, result); await persist(db, scope, result); } };
      }
      const report = await validateSampleReview(pool, cfg, c, scope.run_id, args.result);
      return { result: { persisted: true, result_hash: hash(report) }, commit: async db => {
        const current = await context(db, scope); await validateSampleReview(db, cfg, current, scope.run_id, report);
        const reports = (current.private.review_reports ?? {}) as Record<string, { run_id: string; hash: string }>;
        requireThat(!reports[scope.role] || (reports[scope.role]!.run_id === scope.run_id && reports[scope.role]!.hash === hash(report)), 'SAMPLE_REVIEW_NOT_PERSISTED', '原复核报告不可替换', 409);
        await db.query(`UPDATE public_samples SET private=jsonb_set(private,'{review_reports}',$3::jsonb),updated_at=now() WHERE tenant_id=$1 AND id=$2`,
          [scope.tenant_id, scope.scope_id, JSON.stringify({ ...reports, [scope.role]: { run_id: scope.run_id, hash: hash(report), report } })]);
        await persist(db, scope, report);
      } };
    },
  };
}
