import type {Db} from '../db/pool.js';
import type {Config} from '../config.js';
import type {DTO} from '../../shared/contracts/types.js';
import type {VariantSource} from './catalog.js';
import type {CreativePlan} from '../../worker/compiler/plan.js';
import type {FrozenContract,ResourceBinding} from '../../worker/compiler/snapshot.js';
import {hash} from '../lib/crypto.js';
import {requireThat} from '../lib/errors.js';
import {readNativeVoiceCharacter,readRight,type AudioRight,type CharacterVoiceAdmission} from '../../worker/audio/contract.js';
import {bindProductionFont,FONT_BINDING,verifyResourceLicenses} from '../../worker/media/font.js';
import {freezeGenerationContracts,NATIVE_AUDIO_QC_POLICY,type GenerationModelRow} from '../../worker/generation/contracts.js';
import {admitSpeechContract} from '../../worker/providers/dashscope-asr.js';
import {admitListeningContract} from '../../worker/providers/omni-listening.js';

export interface CommunityNativeVoice {character_version_id:string;native_voice_id:string}
export interface CommunityNativeBinding {
  version:'YPCC-COMMUNITY-NATIVE-1';source_hash:string;character:CharacterVoiceAdmission;rights:AudioRight[];
  resource_versions:ResourceBinding[];model_configuration_hash:string;generation_contracts_hash:string;
  model_version_ids:string[];budget_micro:number;repair_ceiling_micro:number;price_fen:number;
  minimum_cost_micro:number;valid_until:string;
}
const ordered=<T>(values:T[],key:(value:T)=>string)=>[...values].sort((a,b)=>key(a).localeCompare(key(b),'en'));
const resourcesHash=(values:ResourceBinding[])=>hash(ordered(values,r=>r.resource_version_id));
const rightsHash=(values:AudioRight[])=>hash(ordered(values,r=>r.kind));
function modelHash(rows:GenerationModelRow[]):string {
  return hash(ordered(rows,r=>r.id).map(r=>({id:r.id,status:r.status,data:r.data,ark_contract:r.private?.ark_contract??null,
    speech_contract:r.private?.speech_contract??null,listening_contract:r.private?.listening_contract??null})));
}
const generationHash=(values:NonNullable<FrozenContract['generation_contracts']>)=>hash(ordered(values,c=>c.model_version_id));

/** A platform configuration preflight only: no customer input, inference,
 * model purchase, order, reservation, admission evidence or sale switch. */
export async function freezeCommunityNative(db:Db,cfg:Config,source:VariantSource,rows:GenerationModelRow[],resources:ResourceBinding[],
  codex:DTO<'CodexContract'>,budget:number,repair:number,price:number,selection:CommunityNativeVoice|undefined):Promise<CommunityNativeBinding> {
  requireThat(selection&&Object.keys(selection).length===2&&[selection.character_version_id,selection.native_voice_id]
    .every(x=>typeof x==='string'&&/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(x)),
    'COMMUNITY_NATIVE_VOICE_REQUIRED','有声社区规格必须由平台明确选择已准入的默认人物与原生声音',422);
  const p=source.audio_policy as typeof source.audio_policy&{second_tts_over_native_speech_allowed?:boolean;action_sound_required?:boolean};
  requireThat(source.engine!=='PHOTO_LAYOUT'&&p.speech==='native_speech'&&p.language==='zh-CN'&&p.preserve_native_speech===true
    &&p.music==='approved_licensed_or_contract_silent'&&p.caption_alignment==='actual_audio'&&p.second_tts_over_native_speech_allowed===false&&!p.action_sound_required
    &&source.timeline_policy.target_frames<=3600&&codex.qc_policy_version===NATIVE_AUDIO_QC_POLICY,
    'COMMUNITY_NATIVE_POLICY_INVALID','社区原生声音须保留原声、实际字幕及完整听音复核政策',422);
  requireThat(rows.length===4&&new Set(rows.map(r=>r.id)).size===4&&rows.every(r=>r.status==='ADMITTED'),
    'COMMUNITY_NATIVE_MODELS_INVALID','有声规格必须冻结独立的图片、视频、转写与听音模型',422);
  const generation=freezeGenerationContracts(cfg,rows),video=generation.find(c=>c.wire==='ARK_VIDEO')!;
  requireThat(video.video?.native_audio,'NATIVE_AUDIO_MODEL_INVALID','原视频模型没有已准入的原生声音能力',503);
  const speechRows=rows.filter(r=>r.data.roles.includes('SPEECH')),listeningRows=rows.filter(r=>r.data.roles.includes('QC'));
  requireThat(speechRows.length===1&&listeningRows.length===1,'COMMUNITY_NATIVE_MODELS_INVALID','转写和听音模型须分别唯一',422);
  const speech=admitSpeechContract(cfg,speechRows[0]!.private?.speech_contract),listening=admitListeningContract(cfg,listeningRows[0]!.private?.listening_contract);
  for(const [row,c,role] of [[speechRows[0]!,speech,'SPEECH'],[listeningRows[0]!,listening,'QC']] as const){
    requireThat(row.id===c.model_version_id&&row.data.provider===c.provider&&row.data.actual_model===c.actual_model
      &&row.data.registry_version===c.registry_version&&row.data.rate_snapshot_id===c.rate_snapshot_id&&row.data.capability_hash===hash(c)
      &&row.data.roles.includes(role),'COMMUNITY_NATIVE_MODELS_INVALID','原声音模型、能力摘要或费率登记不一致',422);
  }
  requireThat(source.timeline_policy.target_frames<=listening.max_target_frames,'COMMUNITY_NATIVE_POLICY_INVALID','整片超过原完整听音能力',422);
  const character=await readNativeVoiceCharacter(db,selection,video.model_version_id,true);
  const rights=[await readRight(db,character.character_binding,'NATIVE_CHARACTER',true,'ORDER'),await readRight(db,character.voice_binding,'NATIVE_VOICE',true,'ORDER')];
  const c=source.creative_components;
  if(c.music_asset_version){
    const binding=resources.find(r=>r.resource_version_id===c.music_asset_version);
    requireThat(binding&&typeof c.bgm_volume==='number'&&c.bgm_volume>0&&c.bgm_volume<=1&&typeof c.bgm_duck==='boolean',
      'AUDIO_MUSIC_INVALID','原商业配置须包含明确许可的配乐及混音策略',422);
    rights.push(await readRight(db,binding,'MUSIC',true,'ORDER'));
  }
  requireThat(c.font_asset_version==null||c.font_asset_version===FONT_BINDING.resource_version_id,'AUDIO_FONT_UNAVAILABLE','字幕字体未准入',503);
  const exact=bindProductionFont(rights.map(r=>r.binding));
  requireThat(new Set(resources.map(r=>r.resource_version_id)).size===resources.length
    &&resourcesHash(bindProductionFont(resources))===resourcesHash(exact),
    'COMMUNITY_NATIVE_RESOURCES_INVALID','原蓝本商业资源须与实际人物、声音、配乐及平台字体完全一致',422);
  const selected=(source.community_binding as {resource_version_ids?:string[]}|undefined)?.resource_version_ids??[];
  requireThat(selected.every(id=>exact.some(r=>r.resource_version_id===id)),'COMMUNITY_NATIVE_RESOURCES_INVALID','社区声明包含实际制作未使用的资源',422);
  await verifyResourceLicenses(db,exact,true);
  // This is an unavoidable lower bound, not a full-pack cost certificate.
  // The actual shot/reference counts are priced again before a buyer can pay.
  const image=generation.find(c=>c.wire==='ARK_IMAGE')!,images=source.output_slots.filter(s=>s.kind==='image').length+1;
  const minimum=BigInt(codex.agent_cost_ceiling_micro)*2n+BigInt(repair)+BigInt(images)*BigInt(image.rate.ceiling_micro)
    +BigInt(video.rate.ceiling_micro)+BigInt(speech.rate.ceiling_micro)+rights.reduce((s,r)=>s+BigInt(r.allocation_micro),0n)
    +BigInt(listening.per_request_ceiling_micro)*BigInt(listening.max_packets);
  requireThat(minimum<=BigInt(budget)&&minimum<=BigInt(Number.MAX_SAFE_INTEGER),'COMMUNITY_NATIVE_BUDGET_INVALID','原总预算不能覆盖最少素材、人物声音许可、转写、听音、Agent和售后',422);
  const expires=(await db.query<{expires_at:Date|null}>('SELECT min(expires_at) AS expires_at FROM resource_licenses WHERE id=ANY($1)',[rights.map(r=>r.binding.license_record_id)])).rows[0]?.expires_at;
  const valid=Math.min(...[...generation,speech,listening,character].map(c=>Date.parse(c.valid_until)),expires?.getTime()??Infinity);
  requireThat(Number.isFinite(valid)&&valid>Date.now(),'COMMUNITY_NATIVE_EXPIRED','原人物声音或模型能力已到期',422);
  return {version:'YPCC-COMMUNITY-NATIVE-1',source_hash:hash(source),character,rights,resource_versions:exact,
    model_configuration_hash:modelHash(rows),generation_contracts_hash:generationHash(generation),model_version_ids:ordered(rows,r=>r.id).map(r=>r.id),
    budget_micro:budget,repair_ceiling_micro:repair,price_fen:price,minimum_cost_micro:Number(minimum),valid_until:new Date(valid).toISOString()};
}

export function communityNativeBinding(source:VariantSource,raw:unknown):CommunityNativeBinding|null {
  if(!source.community_binding||source.audio_policy.speech==='none'){
    requireThat(raw==null,'COMMUNITY_NATIVE_BINDING_INVALID','无声规格不能携带原生声音商业配置',503);return null;
  }
  const b=raw as CommunityNativeBinding|undefined;
  requireThat(b?.version==='YPCC-COMMUNITY-NATIVE-1'&&b.source_hash===hash(source)&&b.character&&Array.isArray(b.rights)
    &&b.rights.length>=2&&b.rights.length<=3&&Array.isArray(b.resource_versions)&&Array.isArray(b.model_version_ids)&&b.model_version_ids.length===4
    &&Number.isSafeInteger(b.budget_micro)&&Number.isSafeInteger(b.repair_ceiling_micro)&&Number.isSafeInteger(b.minimum_cost_micro)
    &&b.minimum_cost_micro<=b.budget_micro&&Number.isSafeInteger(b.price_fen)&&b.price_fen>0,
    'COMMUNITY_NATIVE_NOT_CONFIGURED','有声社区规格尚未冻结完整平台人物、声音、模型及费用配置',503);
  requireThat(Date.parse(b.valid_until)>Date.now(),'COMMUNITY_NATIVE_EXPIRED','原社区声音配置已到期',503);return b;
}
export async function verifyCommunityNativeRegistration(db:Db,source:VariantSource,b:CommunityNativeBinding,lock=false):Promise<void> {
  communityNativeBinding(source,b);
  const rows=(await db.query<GenerationModelRow>(`SELECT id,status,data,private FROM provider_model_versions WHERE id=ANY($1)${lock?' FOR SHARE':''}`,[b.model_version_ids])).rows;
  requireThat(rows.length===4&&modelHash(rows)===b.model_configuration_hash,'COMMUNITY_NATIVE_CONFIGURATION_CHANGED','原社区声音模型、能力或费率已变化或停用',503);
  const character=await readNativeVoiceCharacter(db,b.character,b.character.video_model_version_id,lock);
  requireThat(hash(character)===hash(b.character),'COMMUNITY_NATIVE_CONFIGURATION_CHANGED','原社区人物声音组合已变化',503);
  for(const right of b.rights)requireThat(hash(await readRight(db,right.binding,right.kind,lock,'ORDER'))===hash(right),
    'COMMUNITY_NATIVE_CONFIGURATION_CHANGED','原社区商业声音许可或固定费用已变化',503);
  await verifyResourceLicenses(db,b.resource_versions,lock);
}
export function applyCommunityNativeVoice(plan:CreativePlan,b:CommunityNativeBinding):void {
  plan.character_version_id=b.character.character_version_id;plan.native_voice_id=b.character.native_voice_id;
  for(const shot of plan.shots)shot.spoken_text='商品实拍。';
}
export function validateCommunityNativePlan(plan:CreativePlan,b:CommunityNativeBinding|null):void {
  if(b)requireThat(plan.character_version_id===b.character.character_version_id&&plan.native_voice_id===b.character.native_voice_id,
    'COMMUNITY_NATIVE_VOICE_CHANGED','内容计划必须保留原社区规格冻结的人物与声音',422);
}
export function verifyCommunityNativeQuote(contract:FrozenContract,b:CommunityNativeBinding|null,rows:GenerationModelRow[]):void {
  if(!b)return;
  validateCommunityNativePlan(contract.creative,b);const audio=contract.native_audio_contract;
  requireThat(b.source_hash===hash(contract.source)&&modelHash(rows)===b.model_configuration_hash
    &&generationHash(contract.generation_contracts??[])===b.generation_contracts_hash&&audio
    &&hash(audio.character)===hash(b.character)&&rightsHash(audio.rights)===rightsHash(b.rights)
    &&resourcesHash(contract.resource_versions)===resourcesHash(b.resource_versions)
    &&contract.budget_micro===b.budget_micro&&contract.repair_ceiling_micro===b.repair_ceiling_micro,
    'COMMUNITY_NATIVE_CONFIGURATION_CHANGED','原社区声音、模型、许可、费用或资源配置已变化，请发布新版本',503);
}
