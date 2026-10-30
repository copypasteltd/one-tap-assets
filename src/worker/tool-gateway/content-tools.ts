import type pg from 'pg';
import type { DTO } from '../../shared/contracts/types.js';
import { requireThat, notFound } from '../../api/lib/errors.js';
import { hash } from '../../api/lib/crypto.js';
import { validate } from '../../api/lib/validation.js';
import type { VariantSource } from '../../api/modules/catalog.js';
import { validateCreativePlan, creativePlanHash, type CreativePlan } from '../compiler/plan.js';
import type { ToolScope } from './http.js';
import type { ToolHandler } from './consumer.js';
import {validatePlanLayout} from '../media/plan-layout.js';
import {plusWorkBinding} from '../../shared/domain/plus-work.js';
import {verifyPlusRenderSource} from '../../api/modules/plus-render-source.js';
import {communityNativeBinding,validateCommunityNativePlan,verifyCommunityNativeRegistration,type CommunityNativeBinding} from '../../api/modules/community-native.js';

export interface PlanContext { profile: DTO<'Profile'>; source: VariantSource; presetId:string; planId: string; native:CommunityNativeBinding|null }
async function context(db: pg.Pool | pg.PoolClient, scope: ToolScope): Promise<PlanContext> {
  requireThat(scope.role === 'CONTENT' && scope.scope_type === 'PLAN' && scope.preview_session_id === scope.scope_id,
    'CONTENT_TOOL_SCOPE_INVALID', '内容工具只接受本次规划的商品上下文', 409);
  return planningContext(db, scope.tenant_id, scope.scope_id);
}
export async function planningContext(db: pg.Pool | pg.PoolClient, tenantId: string, planId: string): Promise<PlanContext> {
  const plan = (await db.query<{ id: string; profile_id: string; product_id: string; photo_version_id: string;variant_version_id:string; private: { source: VariantSource;request:DTO<'PlanRequest'>;native_commercial?:unknown } }>(
    "SELECT id,profile_id,product_id,photo_version_id,variant_version_id,private FROM plan_versions WHERE tenant_id=$1 AND id=$2 AND state='PLANNING'", [tenantId, planId])).rows[0] ?? notFound();
  const profile = (await db.query<{ data: DTO<'Profile'> }>('SELECT data FROM profile_versions WHERE tenant_id=$1 AND id=$2 AND product_id=$3 AND photo_version_id=$4',
    [tenantId, plan.profile_id, plan.product_id, plan.photo_version_id])).rows[0] ?? notFound();
  const product = await db.query(`SELECT id FROM product_drafts WHERE tenant_id=$1 AND id=$2 AND current_profile_id=$3
    AND deleted_at IS NULL AND expires_at>now()`, [tenantId, plan.product_id, plan.profile_id]);
  requireThat(product.rowCount === 1, 'INPUT_VERSION_CHANGED', '当前商品输入已更新或删除', 409);
  validate('Profile', profile.data, true);
  const plus=plusWorkBinding(plan.private.source);if(plus){
    const owner=(await db.query<{owner_id:string}>('SELECT owner_id FROM plan_versions WHERE tenant_id=$1 AND id=$2',[tenantId,planId])).rows[0]!;
    await verifyPlusRenderSource(db,tenantId,owner.owner_id,plus,true);}
  const { profile_hash, ...body } = profile.data; requireThat(hash(body) === profile_hash, 'PROFILE_HASH_MISMATCH', '商品证据摘要不一致', 503);
  requireThat(typeof plan.private.request?.preset_id === 'string' && plan.private.request.preset_id.length > 0,
    'PLAN_INPUT_CHANGED', '原方案选择信息不完整，请重新选择方案', 409);
  const native=communityNativeBinding(plan.private.source,plan.private.native_commercial);
  if(native){
    const current=(await db.query<{private:{source:VariantSource;commercial_binding?:{native_audio?:unknown}}}>('SELECT private FROM execution_variants WHERE id=$1',[plan.variant_version_id])).rows[0];
    requireThat(current&&hash(current.private.source)===hash(plan.private.source)
      &&hash(communityNativeBinding(current.private.source,current.private.commercial_binding?.native_audio))===hash(native),
      'COMMUNITY_NATIVE_CONFIGURATION_CHANGED','原社区人物声音规划配置已变化',503);
    await verifyCommunityNativeRegistration(db,plan.private.source,native);
  }
  return { profile: profile.data, source: plan.private.source, presetId:plan.private.request.preset_id, planId: plan.id,native };
}
async function checkedPlan(db: pg.Pool | pg.PoolClient, scope: ToolScope, raw: unknown): Promise<CreativePlan> {
  await context(db, scope); return validatePlanningResult(db, scope.tenant_id, scope.scope_id, raw);
}
export async function validatePlanningResult(db: pg.Pool | pg.PoolClient, tenantId: string, planId: string, raw: unknown): Promise<CreativePlan> {
  const value = raw as CreativePlan; const source = await planningContext(db, tenantId, planId); validateCreativePlan(value, source.profile, source.source);
  validateCommunityNativePlan(value,source.native);
  await validatePlanLayout(value,source.source,source.presetId);
  if (source.source.audio_policy.speech !== 'none') {
    const character = (await db.query<{ data: { admission_state?: string; native_voice_ids?: string[] } }>('SELECT data FROM character_versions WHERE id=$1', [value.character_version_id])).rows[0];
    requireThat(character?.data.admission_state === 'ADMITTED' && character.data.native_voice_ids?.includes(value.native_voice_id!),
      'CHARACTER_VOICE_NOT_ADMITTED', '人物和中文原声组合尚未获得准入', 422);
  }
  return value;
}
export function contentTools(pool: pg.Pool): Record<string, ToolHandler> {
  return {
    analyze_photos: async scope => {
      const { profile } = await context(pool, scope);
      return { result: { profile, source: 'PERSISTED_REAL_VISION_EVIDENCE', instructions: '只依据可见观察与其证据规划；OCR不认证属性，未知不补造。' } };
    },
    validate_content_plan: async (scope, args) => {
      const plan = await checkedPlan(pool, scope, args.plan);
      return { result: { valid: true, plan_hash: creativePlanHash(plan) } };
    },
    persist_stage_result: async (scope, args) => {
      const plan = await checkedPlan(pool, scope, args.result); const planHash = creativePlanHash(plan);
      return { result: { persisted: true, result_hash: planHash }, commit: async db => {
        await checkedPlan(db, scope, plan);
        const written = await db.query(`UPDATE agent_runs SET output_hash=$3,private=private||jsonb_build_object('stage_result',$4::jsonb),updated_at=now()
          WHERE tenant_id=$1 AND id=$2 AND state='RUNNING'`, [scope.tenant_id, scope.run_id, planHash, JSON.stringify(plan)]);
        requireThat(written.rowCount === 1, 'TOOL_SCOPE_ENDED', '内容运行已结束，不能覆盖阶段结果', 409);
      } };
    },
  };
}
