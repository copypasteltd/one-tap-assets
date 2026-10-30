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
import {basePlan,creativePlanHash,type CreativePlan} from '../compiler/plan.js';
import {freezeAiDisclosure} from '../compiler/disclosure.js';
import {freezeGenerationContracts,GENERATED_QC_POLICY,NATIVE_AUDIO_QC_POLICY,validateGenerationExecution,type GenerationModelRow} from '../generation/contracts.js';
import {policy} from '../tool-gateway/policy.js';
import {freezeNativeAudio,frozenNativeAudio,type SpeechModelRow} from '../audio/contract.js';
import {frozenOrderListening,type ListeningModelRow} from '../audio/listening-contract.js';

export interface SampleGenerationBinding {
  product:DTO<'Product'>;codex_contract:DTO<'CodexContract'>;
  generation_contracts:NonNullable<FrozenContract['generation_contracts']>;
  model_versions:FrozenContract['model_versions'];resource_versions:FrozenContract['resource_versions'];
  max_image_calls:number;max_video_calls:number;ceiling_micro:number;total_ceiling_micro:number;
  base_plan?:CreativePlan;
  audio?:{version:'YPCC-SAMPLE-NATIVE-AUDIO-1';license_use:'SAMPLE';ceiling_micro:number;
    native_audio_contract:NonNullable<FrozenContract['native_audio_contract']>;
    speech_contract:NonNullable<FrozenContract['speech_contract']>;
    listening_contract:NonNullable<FrozenContract['listening_contract']>};
}
/** A new sample freezes actual admitted models and splits, rather than enlarges,
 * the existing single-sample allowance. Historical samples stay unchanged. */
export async function freezeSampleGeneration(db:Db,cfg:Config,source:VariantSource,profile:DTO<'Profile'>,
  productId:string,tenantId:string,ownerId:string,admission:CodexAdmission,bundleHash:string,bundleVersion:string,
  limits:InferenceLimits):Promise<SampleGenerationBinding>{
  const base=(await db.query<{private:{model_version_ids?:string[];codex_contract?:DTO<'CodexContract'>;resource_versions?:FrozenContract['resource_versions'];sample_native_voice?:{character_version_id:string;native_voice_id:string}}}>(
    'SELECT private FROM execution_variants WHERE id=$1 FOR SHARE',[(source.community_binding as {blueprint_version_id:string}).blueprint_version_id])).rows[0];
  requireThat(base,'SAMPLE_GENERATION_NOT_CONFIGURED','样例的生成执行来源尚未配置',503);
  const ids=base.private.model_version_ids??[],rows=(await db.query<GenerationModelRow&SpeechModelRow&ListeningModelRow>(
    'SELECT id,status,data,private FROM provider_model_versions WHERE id=ANY($1)',[ids])).rows;
  requireThat(rows.length===ids.length,'GENERATION_MODEL_NOT_ADMITTED','样例模型登记不完整',503);
  const contracts=freezeGenerationContracts(cfg,rows),plan=basePlan(profile,source);
  if(source.audio_policy.speech!=='none'){
    const selected=base.private.sample_native_voice;
    requireThat(selected&&typeof selected.character_version_id==='string'&&typeof selected.native_voice_id==='string',
      'SAMPLE_AUDIO_NOT_CONFIGURED','原蓝本尚未配置已准入的样例人物与声音组合',503);
    plan.character_version_id=selected.character_version_id;plan.native_voice_id=selected.native_voice_id;
    for(const shot of plan.shots){const observation=profile.observations.find(o=>o.status==='OBSERVED'&&o.source_asset_ids.includes(shot.asset_id));
      shot.spoken_text=observation?`${observation.feature}：${observation.value}。`:`${plan.title}，实拍展示。`;}
  }
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
    qc_policy_version:source.audio_policy.speech==='none'?GENERATED_QC_POLICY:NATIVE_AUDIO_QC_POLICY,max_turns_per_role:limits.max_requests_per_role!,max_input_tokens:limits.max_input_tokens,
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
  if(source.audio_policy.speech!=='none'){
    // Freeze sample-specific publication rights and provider costs inside the original sample allowance.
    // The temporary minimum agent allowance lets the shared compiler validate the binding before the final split.
    contract.codex_contract.agent_cost_ceiling_micro=1;
    contract.resource_versions=structuredClone(base.private.resource_versions??[{...FONT_BINDING}]);
    if(!contract.resource_versions.some(r=>r.resource_version_id===FONT_BINDING.resource_version_id))contract.resource_versions.push({...FONT_BINDING});
    await freezeNativeAudio(db,cfg,contract,rows,'SAMPLE');
    const audio=frozenNativeAudio(contract)!,listening=frozenOrderListening(contract);
    requireThat(audio&&listening,'SAMPLE_AUDIO_NOT_CONFIGURED','有声样例必须冻结原声、转写、公开样例许可及独立听音',503);
    const expected=[FONT_BINDING,...audio.rights.map(r=>r.binding)];
    requireThat(contract.resource_versions.length===expected.length&&contract.resource_versions.every(r=>expected.some(e=>hash(e)===hash(r))),
      'SAMPLE_RESOURCE_INVALID','样例只可使用原冻结字体、人物、声音和选定配乐，不能忽略额外资源',503);
    const audioCeiling=audio.cost.ceiling_micro+listening.per_request_ceiling_micro*listening.max_packets;
    requireThat(Number.isSafeInteger(audioCeiling)&&audioCeiling>0&&ceiling+audioCeiling<cfg.samples.costCeilingMicro,
      'SAMPLE_GENERATION_BUDGET_INVALID','样例原额度不足以同时覆盖生成、声音和独立角色',503);
    cc.agent_cost_ceiling_micro=cfg.samples.costCeilingMicro-ceiling-audioCeiling;
    result.resource_versions=structuredClone(contract.resource_versions);
    result.base_plan=structuredClone(plan);
    result.audio={version:'YPCC-SAMPLE-NATIVE-AUDIO-1',license_use:'SAMPLE',ceiling_micro:audioCeiling,
      native_audio_contract:structuredClone(audio),speech_contract:structuredClone(contract.speech_contract!),listening_contract:structuredClone(listening)};
    contract.runtime_binding!.limits.ceiling_micro=cc.agent_cost_ceiling_micro;
  }else requireThat(hash(result.resource_versions)===hash([FONT_BINDING]),'SAMPLE_RESOURCE_INVALID','无声样例只可使用冻结的平台字体',503);
  validateInternal('codex-contract',cc);freezeAiDisclosure(contract);validateGenerationExecution(contract,!!result.audio);
  return result;
}

/** Rebind only the validated CONTENT plan. Capabilities, rights, rates and limits
 * come from the original sample input; old silent samples cannot gain audio. */
export function projectSampleContract(i:import('./context.js').SampleInput,plan:CreativePlan):FrozenContract{
  const g=i.generation;
  requireThat(g&&i.source.engine!=='PHOTO_LAYOUT'&&i.limits.ceiling_micro===g.codex_contract.agent_cost_ceiling_micro,
    'SAMPLE_GENERATION_NOT_FROZEN','样例没有原冻结生成能力',503);
  const c:FrozenContract={product:g.product,profile:i.profile,photo_set_hash:i.photo_set_hash,identity_lock_hash:i.identity_lock_hash,
    request:{product_id:i.request.product_id,photo_version:i.profile.photo_version,profile_id:i.profile.profile_id,identity_lock_id:i.profile.identity_lock_id,
      preset_id:String(i.source.creative_components.platform_style_id),preset_version:i.source.skill_bundle.version,variant_id:i.source.variant_id,variant_version:i.source.version},
    source:i.source,creative:plan,plan_hash:creativePlanHash(plan),model_versions:g.model_versions,resource_versions:g.resource_versions,
    codex_contract:g.codex_contract,generation_contracts:g.generation_contracts,budget_micro:g.total_ceiling_micro,repair_ceiling_micro:0,
    runtime_binding:{admission:i.admission,limits:i.limits}};
  if(g.audio){
    const a=g.audio,original=g.base_plan;
    requireThat(a.version==='YPCC-SAMPLE-NATIVE-AUDIO-1'&&a.license_use==='SAMPLE'
      &&original&&a.native_audio_contract.plan_hash===creativePlanHash(original)&&a.native_audio_contract.target_frames===plan.target_frames
      &&plan.character_version_id===original.character_version_id&&plan.native_voice_id===original.native_voice_id
      &&g.ceiling_micro+a.ceiling_micro+i.limits.ceiling_micro===g.total_ceiling_micro,
      'SAMPLE_AUDIO_BINDING_INVALID','样例声音能力、完整时间轴或原额度不一致',503);
    c.native_audio_contract={...structuredClone(a.native_audio_contract),plan_hash:c.plan_hash};
    c.speech_contract=structuredClone(a.speech_contract);c.listening_contract=structuredClone(a.listening_contract);
    const audio=frozenNativeAudio(c)!,listening=frozenOrderListening(c)!;
    requireThat(audio.cost.ceiling_micro+listening.per_request_ceiling_micro*listening.max_packets===a.ceiling_micro,
      'SAMPLE_AUDIO_BINDING_INVALID','样例声音费用拆分不一致',503);
  }
  freezeAiDisclosure(c);validateGenerationExecution(c,!!g.audio);return c;
}
