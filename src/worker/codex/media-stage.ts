import type pg from 'pg';
import type { Config } from '../../api/config.js';
import { hash } from '../../api/lib/crypto.js';
import { requireThat } from '../../api/lib/errors.js';
import {storage} from '../../api/storage/storage.js';
import type {ObjectStorage} from '../../api/storage/storage.js';
import { executionContext } from '../compiler/order-context.js';
import { operationArtifacts, type MediaPhase } from '../media/artifacts.js';
import { PendingExternal, type StageLease } from '../queue/leases.js';
import type { StageCommit } from '../runtime.js';
import { mediaStageResultSchema, validateMediaStageResult } from '../tool-gateway/production-tools.js';
import { checkAdmission } from './admission.js';
import { CodexRuntimeAdapter, type RoleResult } from './runtime.js';
import type { RoleExecutor } from './planning.js';
import {GenerationGateway} from '../generation/gateway.js';
import {prepareGeneratedReferences} from '../generation/prepare.js';
import {validateGenerationExecution} from '../generation/contracts.js';
import {NativeOrderMediaPipeline} from '../media/native-order-pipeline.js';
import {validatePlanLayout} from '../media/plan-layout.js';
import {loadProductionFont} from '../media/font.js';

export class MediaStageService {
  private executor: RoleExecutor;
  constructor(private pool: pg.Pool, private cfg: Config, executor?: RoleExecutor,
    private testPorts?:{gateway?:GenerationGateway;store?:ObjectStorage}) {
    requireThat(!executor || cfg.env === 'test', 'TEST_PORT_FORBIDDEN', '角色执行替身只能用于显式测试环境', 500);
    requireThat(!testPorts||cfg.env==='test','TEST_PORT_FORBIDDEN','制作端口注入仅限测试',500);
    this.executor = executor ?? new CodexRuntimeAdapter(pool, cfg);
  }
  async handle(lease: StageLease, signal: AbortSignal): Promise<StageCommit> {
    requireThat(lease.scope_type === 'ORDER' && (lease.stage_name === 'PRODUCTION' || lease.stage_name === 'POST'),
      'MEDIA_STAGE_INVALID', '媒体执行阶段无效', 500);
    const phase = lease.stage_name as MediaPhase;
    const context = await executionContext(this.pool, lease.tenant_id, lease.scope_id, lease.input_hash,lease.id);
    await validatePlanLayout(context.contract.creative,context.contract.source,context.snapshot.preset_id,await loadProductionFont(this.cfg.projectRoot),context.contract.ai_disclosure_contract);
    const native=context.snapshot.audio_policy.speech_mode==='NATIVE_ZH';
    if(context.snapshot.engine!=='PHOTO_LAYOUT')validateGenerationExecution(context.contract,native);
    const binding = context.contract.runtime_binding; const cc = context.snapshot.codex_contract;
    requireThat(binding && binding.limits.owner_id === context.ownerId && binding.limits.ceiling_micro === cc.agent_cost_ceiling_micro
      && binding.limits.max_input_tokens === cc.max_input_tokens && binding.limits.max_output_tokens === cc.max_output_tokens
      && binding.limits.max_requests_per_role === cc.max_turns_per_role && binding.limits.max_requests === cc.max_turns_per_role * 4,
      'CODEX_SOLD_BINDING_INVALID', '已售订单缺少冻结的角色和推理成本绑定', 503);
    const admission = checkAdmission(this.cfg, binding.admission);
    requireThat(admission.runtime_sha256 === cc.runtime_sha256 && admission.runtime_build_id === cc.runtime_build_id
      && admission.protocol_version === cc.protocol_version && admission.model_version_id === cc.model_version_id && admission.rate_version_id === cc.rate_version_id,
      'CODEX_SOLD_BINDING_INVALID', '当前运行能力与原订单不一致', 503);
    if(phase==='PRODUCTION'&&context.snapshot.engine!=='PHOTO_LAYOUT'){
      const store=this.testPorts?.store??storage(this.cfg);
      if(native)await new NativeOrderMediaPipeline(this.pool,this.cfg,store,this.testPorts?.gateway).preflight(context);
      await prepareGeneratedReferences(this.pool,this.cfg,store,lease,context,this.executor,
        this.testPorts?.gateway??new GenerationGateway(this.pool,this.cfg,store),signal);
    }
    const previous = phase === 'POST' ? await operationArtifacts(this.pool, context, 'PRODUCTION') : null;
    const prior = (await this.pool.query<{ id: string; instance_id: string; state: string; input_hash: string; output_hash: string; private: { stage_result: unknown } }>(
      `SELECT id,instance_id,state,input_hash,output_hash,private FROM agent_runs WHERE tenant_id=$1 AND private->>'stage_run_id'=$2
       AND role=$3 ORDER BY created_at DESC LIMIT 1`, [lease.tenant_id, lease.id, phase])).rows[0];
    let completed: RoleResult;
    if (prior) {
      requireThat(prior.input_hash === context.snapshotHash, 'CODEX_RESULT_NOT_PERSISTED', '原角色输入与订单不一致', 503);
      if (prior.state !== 'SUCCEEDED') throw new PendingExternal(5, 'CODEX_PREVIOUS_RUN_UNRESOLVED');
      requireThat(prior.output_hash && hash(prior.private.stage_result) === prior.output_hash, 'CODEX_RESULT_NOT_PERSISTED', '原角色结果摘要不一致', 503);
      completed = { runId: prior.id, instanceId: prior.instance_id, result: prior.private.stage_result, resultHash: prior.output_hash };
    } else {
      const primaryTool = phase === 'PRODUCTION' ? context.snapshot.engine==='PHOTO_LAYOUT'?'render_photo_pack':'render_generated_pack' : 'execute_post_plan';
      completed = await this.executor.execute({ lease, role: phase, variantId: context.snapshot.variant_id, bundleHash: cc.skill_bundle_hash,
        admission, limits: binding.limits, maxToolCalls: cc.max_tool_calls, maxScopeToolCalls: cc.max_tool_calls,
        allowedTools: [primaryTool, 'inspect_actual_media', 'persist_stage_result',...(native&&phase==='POST'?['transcribe_actual_audio']:[])], outputSchema: mediaStageResultSchema,
        input: { phase, snapshot_hash: context.snapshotHash, snapshot: context.snapshot, creative_plan: context.contract.creative,
          ...(native?{native_audio:{contract_hash:context.snapshot.native_audio_contract_hash,
            source_artifact_id:previous?.receipt.artifacts.filter(a=>a.spec.kind==='video').sort((a,b)=>a.slot_id.localeCompare(b.slot_id))[0]?.id??null}}:{}),
          production: previous ? { operation_id: previous.operation.id, outputs: previous.receipt.artifacts.map(a => ({ artifact_id: a.id, slot_id: a.slot_id, sha256: a.sha256 })) } : null,
          task: `按已售快照和风格 Skill 完成${phase === 'PRODUCTION' ? '对应路线的实际整包制作' : '显式后期处理'}。调用 ${primaryTool}，再 inspect_actual_media 检查全部真实产物；将检查工具返回的 tool_receipt_id 加入 stage_result.tool_receipt_ids，其余字段沿用制作工具结果。通过 persist_stage_result 保存最终完整结果并原样返回。不得改商品、清单、模型、路线、预算或截止。` } }, signal);
    }
    const checked = await validateMediaStageResult(this.pool, context, lease.id, completed.runId, phase, completed.result);
    requireThat(hash(checked.result) === completed.resultHash, 'CODEX_RESULT_NOT_PERSISTED', '媒体角色结果摘要不一致', 503);
    return async db => {
      const current = await executionContext(db, lease.tenant_id, lease.scope_id, lease.input_hash,lease.id);
      await validateMediaStageResult(db, current, lease.id, completed.runId, phase, checked.result);
      const run = (await db.query<{ state: string; output_hash: string }>('SELECT state,output_hash FROM agent_runs WHERE tenant_id=$1 AND id=$2', [lease.tenant_id, completed.runId])).rows[0];
      requireThat(run?.state === 'SUCCEEDED' && run.output_hash === completed.resultHash, 'CODEX_RESULT_NOT_PERSISTED', '媒体阶段缺少已完成角色的持久结果', 503);
      await db.query(`UPDATE stage_runs SET private=private||jsonb_build_object('media_operation_id',$3::text,'role_run_id',$4::text,'result_hash',$5::text)
        WHERE tenant_id=$1 AND id=$2`, [lease.tenant_id, lease.id, checked.receipt.operation_id, completed.runId, completed.resultHash]);
    };
  }
}
