import type {Db} from '../../api/db/pool.js';
import type {Config} from '../../api/config.js';
import type {DTO} from '../../shared/contracts/types.js';
import type {VariantSource} from '../../api/modules/catalog.js';
import type {CodexAdmission} from '../codex/admission.js';
import type {InferenceLimits} from '../codex/inference.js';
import {hash} from '../../api/lib/crypto.js';
import {requireThat} from '../../api/lib/errors.js';
import {validateInternal} from '../../api/lib/validation.js';
import type {FrozenContract} from '../compiler/snapshot.js';
import {FONT_BINDING} from '../media/font.js';
import {basePlan,creativePlanHash} from '../compiler/plan.js';
import {freezeAiDisclosure} from '../compiler/disclosure.js';
import {freezeGenerationContracts,GENERATED_QC_POLICY,validateGenerationExecution,type GenerationModelRow} from '../generation/contracts.js';
import {policy} from '../tool-gateway/policy.js';

export interface SampleGenerationBinding {
  product:DTO<'Product'>;codex_contract:DTO<'CodexContract'>;
  generation_contracts:NonNullable<FrozenContract['generation_contracts']>;
  model_versions:FrozenContract['model_versions'];resource_versions:FrozenContract['resource_versions'];
  max_image_calls:number;max_video_calls:number;ceiling_micro:number;total_ceiling_micro:number;
}
/** A new sample freezes actual admitted models and splits, rather than enlarges,
 * the existing single-sample allowance. Historical samples stay unchanged. */
export async function freezeSampleGeneration(db:Db,cfg:Config,source:VariantSource,profile:DTO<'Profile'>,
  productId:string,tenantId:string,ownerId:string,admission:CodexAdmission,bundleHash:string,bundleVersion:string,
  limits:InferenceLimits):Promise<SampleGenerationBinding>{
  const base=(await db.query<{private:{model_version_ids?:string[];codex_contract?:DTO<'CodexContract'>}}>(
    'SELECT private FROM execution_variants WHERE id=$1 FOR SHARE',[(source.community_binding as {blueprint_version_id:string}).blueprint_version_id])).rows[0];
  requireThat(base,'SAMPLE_GENERATION_NOT_CONFIGURED','样例的生成执行来源尚未配置',503);
  const ids=base.private.model_version_ids??[],rows=(await db.query<GenerationModelRow>(
    'SELECT id,status,data,private FROM provider_model_versions WHERE id=ANY($1)',[ids])).rows;
  requireThat(rows.length===ids.length,'GENERATION_MODEL_NOT_ADMITTED','样例模型登记不完整',503);
  const contracts=freezeGenerationContracts(cfg,rows),plan=basePlan(profile,source);
  const maxVideo=source.engine==='PER_SHOT_AI'?plan.shots.length:1;
  const maxImage=source.output_slots.filter(s=>s.kind==='image').length+maxVideo;
  const image=contracts.find(c=>c.wire==='ARK_IMAGE')!,video=contracts.find(c=>c.wire==='ARK_VIDEO')!;
  const ceiling=maxImage*image.rate.ceiling_micro+maxVideo*video.rate.ceiling_micro;
  requireThat(Number.isSafeInteger(ceiling)&&ceiling>0&&ceiling<cfg.samples.costCeilingMicro,
    'SAMPLE_GENERATION_BUDGET_INVALID','平台样例额度不足以同时覆盖生成和独立核验',503);
  const cc:DTO<'CodexContract'>={runtime_kind:'CODEX_APP_SERVER',
    runtime_build_id:admission.runtime_build_id,runtime_sha256:admission.runtime_sha256,protocol_version:admission.protocol_version,
    model_version_id:admission.model_version_id,rate_version_id:admission.rate_version_id,
    skill_bundle_id:source.skill_bundle.id,skill_bundle_hash:bundleHash,skill_bundle_version:bundleVersion,
    role_prompt_version:'YPCC-SAMPLE-PROMPTS-1.0.0',tool_policy_version:policy.version,
    required_roles:['CONTENT','PRODUCTION','POST','REVIEW_FACTS','REVIEW_STYLE'],max_tool_calls:32,
    inference_spend_control:'PRE_REQUEST_RESERVATION_AND_HARD_LIMIT',independent_reviewers:2,
    review_context_policy:'FRESH_THREADS_NO_CREATOR_HISTORY',isolation:'NATIVE_RESTRICTED_IDENTITY',
    release_after_terminal:true,release_grace_seconds:30,release_target_seconds:300,repair_extends_deadline:false,
    qc_policy_version:GENERATED_QC_POLICY,max_turns_per_role:limits.max_requests_per_role!,max_input_tokens:limits.max_input_tokens,
    max_output_tokens:limits.max_output_tokens,agent_cost_ceiling_micro:cfg.samples.costCeilingMicro-ceiling};
  validateInternal('codex-contract',cc);
  const product=(await db.query<{data:DTO<'Product'>}>('SELECT data FROM product_drafts WHERE tenant_id=$1 AND id=$2 AND owner_id=$3',[tenantId,productId,ownerId])).rows[0];
  requireThat(product,'SAMPLE_INPUT_UNAVAILABLE','样例商品不可用',409);
  const result:SampleGenerationBinding={product:structuredClone(product.data),codex_contract:cc,generation_contracts:contracts,
    model_versions:rows.map(r=>structuredClone(r.data)),resource_versions:[{...FONT_BINDING}],max_image_calls:maxImage,max_video_calls:maxVideo,
    ceiling_micro:ceiling,total_ceiling_micro:cfg.samples.costCeilingMicro};
  const contract:FrozenContract={...result,product:result.product,profile,photo_set_hash:'0'.repeat(64),identity_lock_hash:'0'.repeat(64),
    request:{product_id:productId,photo_version:profile.photo_version,profile_id:profile.profile_id,identity_lock_id:profile.identity_lock_id,
      preset_id:String(source.creative_components.platform_style_id),preset_version:source.skill_bundle.version,variant_id:source.variant_id,variant_version:source.version},
    source,creative:plan,plan_hash:creativePlanHash(plan),budget_micro:result.total_ceiling_micro,repair_ceiling_micro:0,
    runtime_binding:{admission,limits:{...limits,ceiling_micro:cc.agent_cost_ceiling_micro}}};
  freezeAiDisclosure(contract);validateGenerationExecution(contract);
  requireThat(hash(result.resource_versions)===hash([FONT_BINDING]),'SAMPLE_RESOURCE_INVALID','样例只可使用冻结的平台字体',503);
  return result;
}
