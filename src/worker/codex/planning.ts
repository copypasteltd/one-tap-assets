import { bundleForSource } from './skills.js';
import type pg from 'pg';
import type { Config } from '../../api/config.js';
import type { DTO } from '../../shared/contracts/types.js';
import { hash } from '../../api/lib/crypto.js';
import { requireThat, notFound } from '../../api/lib/errors.js';
import { validate } from '../../api/lib/validation.js';
import { creativePlanSchema, creativePlanHash, type CreativePlan } from '../compiler/plan.js';
import { planningContext, validatePlanningResult } from '../tool-gateway/content-tools.js';
import { PendingExternal, type StageLease } from '../queue/leases.js';
import type { StageCommit } from '../runtime.js';
import { CodexRuntimeAdapter, type RoleResult, type RoleRequest } from './runtime.js';
import { checkAdmission, type CodexAdmission } from './admission.js';
import type { InferenceLimits } from './inference.js';

interface PlanRow { product_id: string; data: DTO<'Plan'>; private: {
  creative: CreativePlan; request: DTO<'PlanRequest'>; runtime_admission: CodexAdmission;
  inference_limits: InferenceLimits; bundle_hash: string; plan_input_hash: string;
} }
export interface RoleExecutor { execute(request: RoleRequest, signal: AbortSignal): Promise<RoleResult> }
export class ContentPlanningService {
  private executor: RoleExecutor;
  constructor(private pool: pg.Pool, private cfg: Config, executor?: RoleExecutor) {
    requireThat(!executor || cfg.env === 'test', 'TEST_PORT_FORBIDDEN', '角色执行替身只能用于显式测试环境', 500);
    this.executor = executor ?? new CodexRuntimeAdapter(pool, cfg);
  }
  async handle(lease: StageLease, signal: AbortSignal): Promise<StageCommit> {
    requireThat(lease.scope_type === 'PLAN' && lease.stage_name === 'PLAN', 'PLAN_SCOPE_INVALID', '规划任务作用域无效', 500);
    const row = (await this.pool.query<PlanRow>("SELECT product_id,data,private FROM plan_versions WHERE id=$1 AND tenant_id=$2 AND state='PLANNING'", [lease.scope_id, lease.tenant_id])).rows[0] ?? notFound();
    const context = await planningContext(this.pool, lease.tenant_id, lease.scope_id);
    const admission = checkAdmission(this.cfg, row.private.runtime_admission);
    const expected = hash({ request: row.private.request, suggested_plan: row.private.creative, profile_hash: context.profile.profile_hash, source: context.source,
      bundle_hash: row.private.bundle_hash, runtime_admission: admission, inference_limits: row.private.inference_limits });
    requireThat(expected === lease.input_hash && row.private.plan_input_hash === expected, 'PLAN_INPUT_HASH_MISMATCH', '规划输入快照摘要不一致', 503);
    const prior = (await this.pool.query<{ id: string; instance_id: string; input_hash: string; output_hash: string; private: { stage_result: unknown }; state: string }>(
      `SELECT id,instance_id,input_hash,output_hash,private,state FROM agent_runs WHERE tenant_id=$1
       AND private->>'stage_run_id'=$2 ORDER BY created_at DESC LIMIT 1`, [lease.tenant_id, lease.id])).rows[0];
    let completed: RoleResult;
    if (prior) {
      // A crash after persisting the role output must not buy another turn.
      requireThat(prior.input_hash === expected, 'PLAN_INPUT_HASH_MISMATCH', '原角色输入摘要不一致', 503);
      if (prior.state !== 'SUCCEEDED') throw new PendingExternal(5, 'CODEX_PREVIOUS_RUN_UNRESOLVED');
      requireThat(prior.output_hash && hash(prior.private.stage_result) === prior.output_hash,
        'CODEX_RESULT_NOT_PERSISTED', '原角色检查点摘要不一致', 503);
      completed = { runId: prior.id, instanceId: prior.instance_id, result: prior.private.stage_result, resultHash: prior.output_hash };
    } else {
      const voices = (await this.pool.query<{ id: string; data: { native_voice_ids: string[] } }>(
        "SELECT id,data FROM character_versions WHERE data->>'admission_state'='ADMITTED' ORDER BY id LIMIT 100")).rows
        .map(v => ({ character_version_id: v.id, native_voice_ids: v.data.native_voice_ids }));
      if (context.source.audio_policy.speech !== 'none') requireThat(voices.some(v => Array.isArray(v.native_voice_ids) && v.native_voice_ids.length > 0),
        'CHARACTER_VOICE_NOT_ADMITTED', '该口播规格尚未配置可用的人物与中文原声', 503);
      const skill = await bundleForSource(this.cfg, context.source, row.private.bundle_hash);
      completed = await this.executor.execute({ lease, role: 'CONTENT', variantId: skill.payload.variant_id,
        bundleHash: row.private.bundle_hash, admission, limits: row.private.inference_limits,
        allowedTools: ['analyze_photos', 'validate_content_plan', 'persist_stage_result'], outputSchema: creativePlanSchema,
        input: { task: '基于已核验商品证据和风格 Skill，编排完整素材包。先用 analyze_photos 读取真实视觉档案，再验证并持久化计划。不得添加未知的材质、容量、价格和功效。若 source.creative_components.community_direction 存在，必须保留 suggested_plan 的镜头起止帧、所选运镜和叙事标签；只在真实照片证据范围内选图与完善配套内容。',
          profile: context.profile, source: context.source, suggested_plan: row.private.creative, admitted_native_voices: voices } }, signal);
    }
    const creative = await validatePlanningResult(this.pool, lease.tenant_id, lease.scope_id, completed.result);
    requireThat(creativePlanHash(creative) === completed.resultHash, 'CODEX_RESULT_NOT_PERSISTED', '规划结果摘要不一致', 503);
    return async db => {
      await db.query('SELECT id FROM product_drafts WHERE id=$1 AND tenant_id=$2 FOR UPDATE', [row.product_id, lease.tenant_id]);
      await validatePlanningResult(db, lease.tenant_id, lease.scope_id, creative);
      const run = (await db.query<{ input_hash: string; output_hash: string; state: string }>('SELECT input_hash,output_hash,state FROM agent_runs WHERE id=$1 AND tenant_id=$2', [completed.runId, lease.tenant_id])).rows[0];
      requireThat(run?.state === 'SUCCEEDED' && run.input_hash === lease.input_hash && run.output_hash === completed.resultHash,
        'CODEX_RESULT_NOT_PERSISTED', '规划运行缺少已完成的持久证据', 503);
      const data: DTO<'Plan'> = { ...row.data, state: 'READY', plan_hash: completed.resultHash,
        summary: `${creative.title}。${creative.copy}`.slice(0, 2000), reason_codes: [] };
      validate('Plan', data, true);
      await db.query(`UPDATE plan_versions SET state='READY',plan_hash=$3,data=$4,updated_at=now(),
        private=private||jsonb_build_object('creative',$5::jsonb,'content_run_id',$6::text)
        WHERE id=$1 AND tenant_id=$2 AND state='PLANNING'`, [lease.scope_id, lease.tenant_id, completed.resultHash, JSON.stringify(data), JSON.stringify(creative), completed.runId]);
    };
  }
}
