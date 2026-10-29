import Ajv2020 from 'ajv/dist/2020.js';
import type {Db} from '../../api/db/pool.js';
import type {Config} from '../../api/config.js';
import {hash,sha256} from '../../api/lib/crypto.js';
import {requireThat} from '../../api/lib/errors.js';
import type {FrozenContract,ModelBinding,ResourceBinding} from '../compiler/snapshot.js';
import {freezeOrderListening} from './listening-contract.js';
import {FONT_BINDING,verifyResourceLicenses} from '../media/font.js';
import {NATIVE_AUDIO_POLICY} from '../media/native-audio.js';
import {DUCKING_POLICY} from '../media/native-audio-post.js';
import {admitSpeechContract,frozenSpeechContract,type SpeechContract} from '../providers/dashscope-asr.js';
import {frozenArkContract} from '../providers/ark.js';
import {reserve,settle} from '../budget/reservations.js';

export const AUDIO_CONTRACT_VERSION='YPCC-NATIVE-AUDIO-CONTRACT-1';
export type AudioRightKind='NATIVE_CHARACTER'|'NATIVE_VOICE'|'MUSIC';
export interface CharacterVoiceAdmission {
  version:'YPCC-CHARACTER-VOICE-1';character_version_id:string;native_voice_id:string;video_model_version_id:string;
  evidence_sha256:string;valid_until:string;language:'zh-CN';secondary_tts:false;
  character_binding:ResourceBinding;voice_binding:ResourceBinding;
}
export interface AudioRight {
  kind:AudioRightKind;binding:ResourceBinding;license_version:string;license_sha256:string;allocation_micro:number;
  media?:{object_key:string;sha256:string;size_bytes:number;mime_type:string};
}
export interface NativeAudioContract {
  version:typeof AUDIO_CONTRACT_VERSION;source_policy_hash:string;plan_hash:string;target_frames:number;
  language:'zh-CN';preserve_native_audio:true;secondary_tts:false;original_gain_db:0;sample_rate:48000;channels:2;
  caption_style:'standard'|'bold'|'minimal'|'karaoke';font:ResourceBinding;
  character:CharacterVoiceAdmission;character_admission_hash:string;rights:AudioRight[];
  music:null|{binding:ResourceBinding;gain_db:number;linear_gain:number;ducking:boolean;loop_to_timeline:boolean};
  asr:{contract:SpeechContract;contract_hash:string;input_strategy:'ASSEMBLED_NATIVE_TRACK';max_calls:1;seconds:number};
  processing_policy:string;ducking_policy_hash:string;
  cost:{asr_ceiling_micro:number;license_allocation_micro:number;ceiling_micro:number};
}
export interface SpeechModelRow {id:string;status:string;data:ModelBinding;private?:{speech_contract?:unknown;listening_contract?:unknown}}
const text={type:'string',minLength:1,maxLength:200},digest={type:'string',pattern:'^[a-f0-9]{64}$'};
const integer=(minimum:number,maximum:number)=>({type:'integer',minimum,maximum});
const exact=(properties:Record<string,unknown>)=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
const resource=exact({resource_version_id:text,license_record_id:text,hash:digest});
const characterSchema=exact({version:{const:'YPCC-CHARACTER-VOICE-1'},character_version_id:text,native_voice_id:text,video_model_version_id:text,
  evidence_sha256:digest,valid_until:text,language:{const:'zh-CN'},secondary_tts:{const:false},character_binding:resource,voice_binding:resource});
const rightSchema=exact({kind:{enum:['NATIVE_CHARACTER','NATIVE_VOICE','MUSIC']},binding:resource,license_version:text,license_sha256:digest,allocation_micro:integer(0,1_000_000_000)});
Object.assign(rightSchema.properties,{media:exact({object_key:{type:'string',pattern:'^licensed-resources/[A-Za-z0-9._-]+/[A-Za-z0-9._-]+$'},
  sha256:digest,size_bytes:integer(1,64_000_000),mime_type:{enum:['audio/wav','audio/mpeg','audio/mp4','audio/flac','audio/ogg']}})});
const ajv=new Ajv2020({strict:false}),validCharacter=ajv.compile<CharacterVoiceAdmission>(characterSchema);
const validAudio=ajv.compile<NativeAudioContract>(exact({version:{const:AUDIO_CONTRACT_VERSION},source_policy_hash:digest,plan_hash:digest,target_frames:integer(1,3600),
  language:{const:'zh-CN'},preserve_native_audio:{const:true},secondary_tts:{const:false},original_gain_db:{const:0},sample_rate:{const:48000},channels:{const:2},
  caption_style:{enum:['standard','bold','minimal','karaoke']},font:resource,character:characterSchema,character_admission_hash:digest,
  rights:{type:'array',minItems:2,maxItems:3,items:rightSchema},music:{anyOf:[{type:'null'},exact({binding:resource,gain_db:{type:'number',minimum:-36,maximum:-6},
    linear_gain:{type:'number',exclusiveMinimum:0,maximum:1},ducking:{type:'boolean'},loop_to_timeline:{type:'boolean'}})]},
  asr:exact({contract:{type:'object'},contract_hash:digest,input_strategy:{const:'ASSEMBLED_NATIVE_TRACK'},max_calls:{const:1},seconds:integer(1,120)}),
  processing_policy:{const:NATIVE_AUDIO_POLICY},ducking_policy_hash:digest,
  cost:exact({asr_ceiling_micro:integer(1,1_000_000_000),license_allocation_micro:integer(0,3_000_000_000),ceiling_micro:integer(1,4_000_000_000)})}));

function sourcePolicy(contract:FrozenContract){
  const s=contract.source,c=s.creative_components;
  return {engine:s.engine,variant_id:s.variant_id,audio_policy:s.audio_policy,caption_preset:c.caption_preset,
    music_asset_version:c.music_asset_version??null,font_asset_version:c.font_asset_version??null,
    bgm_volume:c.bgm_volume??null,bgm_duck:c.bgm_duck??null,music_loop_to_timeline:c.music_loop_to_timeline??false};
}
function videoContract(contract:FrozenContract){
  const rows=(contract.generation_contracts??[]).filter(c=>c.wire==='ARK_VIDEO');
  requireThat(rows.length===1,'NATIVE_AUDIO_MODEL_INVALID','原生声音必须绑定唯一视频模型',503);
  const c=frozenArkContract(rows[0]);requireThat(c.video?.native_audio&&contract.model_versions.some(m=>m.provider===c.provider
    &&m.actual_model===c.actual_model&&m.registry_version===c.registry_version&&m.rate_snapshot_id===c.rate_snapshot_id
    &&m.capability_hash===hash(c)&&m.roles.includes('VIDEO')),'NATIVE_AUDIO_MODEL_INVALID','原视频模型未绑定原生音轨能力、版本与费率',503);return c;
}
function matchesSpeech(c:SpeechContract,row:SpeechModelRow){return row.id===c.model_version_id&&row.data.provider===c.provider&&row.data.actual_model===c.actual_model
  &&row.data.registry_version===c.registry_version&&row.data.rate_snapshot_id===c.rate_snapshot_id&&row.data.capability_hash===hash(c)&&row.data.roles.includes('SPEECH');}
function resourceBindings(audio:NativeAudioContract):ResourceBinding[]{return [audio.font,...audio.rights.map(r=>r.binding)];}
function checkedSource(contract:FrozenContract):void {
  const s=contract.source,policy=s.audio_policy as typeof s.audio_policy&{second_tts_over_native_speech_allowed?:boolean;action_sound_required?:boolean};
  requireThat(s.engine!=='PHOTO_LAYOUT'&&policy.speech==='native_speech'&&policy.language==='zh-CN'&&policy.preserve_native_speech===true
    &&policy.music==='approved_licensed_or_contract_silent'&&policy.caption_alignment==='actual_audio'&&policy.second_tts_over_native_speech_allowed===false&&!policy.action_sound_required,
    'AUDIO_POLICY_UNSUPPORTED','原生中文声音合同不允许静音替代、第二次配音或未准入的动作声',503);
  requireThat(contract.creative.native_voice_id&&contract.creative.character_version_id&&contract.creative.shots.some(s=>s.spoken_text.trim())
    &&contract.creative.target_frames<=3600&&s.timeline_policy.target_frames===contract.creative.target_frames,
    'NATIVE_SPEECH_REQUIRED','原生声音缺少冻结人物、声音、台词或完整时间轴',503);
}
/** Structural and semantic validation of a frozen contract; no current registry
 * or replacement price can mutate an existing purchase. */
export function frozenNativeAudio(contract:FrozenContract):NativeAudioContract|undefined {
  const policy=contract.source.audio_policy as typeof contract.source.audio_policy&{action_sound_required?:boolean};
  const audio=contract.native_audio_contract;
  if(policy.speech==='none'){
    requireThat(!audio&&!policy.action_sound_required&&!contract.source.creative_components.music_asset_version,
      'AUDIO_POLICY_UNSUPPORTED','动作声或配乐路线必须单独接入合同与后期，不能作为无声整包出售',503);return undefined;
  }
  checkedSource(contract);requireThat(validAudio(audio),'AUDIO_CONTRACT_REQUIRED','原生声音必须冻结完整合同',503);
  const asr=frozenSpeechContract(audio.asr.contract),video=videoContract(contract),character=audio.character;
  requireThat(audio.source_policy_hash===hash(sourcePolicy(contract))&&audio.plan_hash===contract.plan_hash&&audio.target_frames===contract.creative.target_frames
    &&audio.caption_style===contract.source.creative_components.caption_preset&&hash(audio.font)===hash(FONT_BINDING)
    &&audio.processing_policy===NATIVE_AUDIO_POLICY&&audio.ducking_policy_hash===hash(DUCKING_POLICY)
    &&character.character_version_id===contract.creative.character_version_id&&character.native_voice_id===contract.creative.native_voice_id
    &&character.video_model_version_id===video.model_version_id&&hash(character)===audio.character_admission_hash&&Number.isFinite(Date.parse(character.valid_until))
    &&audio.asr.seconds===Math.ceil(audio.target_frames/30)&&audio.asr.seconds<=asr.max_audio_seconds&&hash(asr)===audio.asr.contract_hash
    &&contract.speech_contract&&hash(contract.speech_contract)===hash(asr)&&contract.model_versions.some(data=>matchesSpeech(asr,{id:asr.model_version_id,status:'ADMITTED',data})),
    'AUDIO_CONTRACT_CHANGED','声音合同与原方案、人物、声音、后期或模型费率不一致',503);
  requireThat(audio.rights.length===(audio.music?3:2)&&new Set(audio.rights.map(r=>r.kind)).size===audio.rights.length
    &&audio.rights.some(r=>r.kind==='NATIVE_CHARACTER'&&hash(r.binding)===hash(character.character_binding))
    &&audio.rights.some(r=>r.kind==='NATIVE_VOICE'&&hash(r.binding)===hash(character.voice_binding))
    &&(!audio.music||audio.rights.some(r=>r.kind==='MUSIC'&&hash(r.binding)===hash(audio.music!.binding)))
    &&new Set(resourceBindings(audio).map(r=>r.resource_version_id)).size===resourceBindings(audio).length
    &&resourceBindings(audio).every(r=>contract.resource_versions.some(existing=>hash(existing)===hash(r))),
    'AUDIO_RIGHTS_INVALID','人物、声音、配乐与字体许可绑定不完整或重复',503);
  const components=contract.source.creative_components;
  if(audio.music){const m=audio.music,expected=Math.round(20*Math.log10(m.linear_gain)*1e6)/1e6;
    requireThat(components.music_asset_version===m.binding.resource_version_id&&components.bgm_volume===m.linear_gain&&expected===m.gain_db
      &&components.bgm_duck===m.ducking&&(components.music_loop_to_timeline??false)===m.loop_to_timeline,'AUDIO_MUSIC_CHANGED','配乐、音量、压低或循环不得临时替换',503);
  }else requireThat(!components.music_asset_version,'AUDIO_MUSIC_CHANGED','选定的配乐不能降为无声',503);
  const allocations=audio.rights.reduce((sum,r)=>sum+BigInt(r.allocation_micro),0n),total=allocations+BigInt(asr.rate.ceiling_micro);
  requireThat(BigInt(audio.cost.license_allocation_micro)===allocations&&audio.cost.asr_ceiling_micro===asr.rate.ceiling_micro
    &&BigInt(audio.cost.ceiling_micro)===total&&total<=BigInt(contract.budget_micro),'AUDIO_BUDGET_INVALID','声音与许可费用未纳入原总预算',503);return audio;
}
async function readCharacter(db:Db,contract:FrozenContract,lock=false):Promise<CharacterVoiceAdmission>{
  const row=(await db.query<{data:{admission_state?:string;native_voice_ids?:string[];native_audio_admissions?:unknown[]}}>(
    `SELECT data FROM character_versions WHERE id=$1${lock?' FOR SHARE':''}`,[contract.creative.character_version_id])).rows[0];
  const entries=row?.data.native_audio_admissions?.filter(raw=>validCharacter(raw)&&raw.native_voice_id===contract.creative.native_voice_id)??[];
  requireThat(row?.data.admission_state==='ADMITTED'&&row.data.native_voice_ids?.includes(contract.creative.native_voice_id!)&&entries.length===1
    &&validCharacter(entries[0])&&entries[0].character_version_id===contract.creative.character_version_id
    &&entries[0].video_model_version_id===videoContract(contract).model_version_id&&Date.parse(entries[0].valid_until)>Date.now(),
    'CHARACTER_VOICE_NOT_ADMITTED','人物、声音、视频模型组合或许可证据未准入或已过期',503);return structuredClone(entries[0]);
}
async function readRight(db:Db,binding:ResourceBinding,kind:AudioRightKind,lock=false):Promise<AudioRight>{
  const row=(await db.query<{version:string;data:{resource_version_id?:string;resource_hash?:string;license_text?:string;license_sha256?:string;admission_state?:string;
    audio_media?:AudioRight['media'];audio_rights?:{kind?:string;allowed_use?:string;allocation_mode?:string;allocation_micro?:number}}}>(
    `SELECT version,data FROM resource_licenses WHERE id=$1 AND resource_id=$2 AND revoked_at IS NULL
      AND (expires_at IS NULL OR expires_at>clock_timestamp())${lock?' FOR SHARE':''}`,[binding.license_record_id,binding.resource_version_id])).rows[0];
  const d=row?.data,rights=d?.audio_rights;
  requireThat(row&&d?.admission_state==='ADMITTED'&&d.resource_version_id===binding.resource_version_id&&d.resource_hash===binding.hash
    &&typeof d.license_text==='string'&&d.license_text.length>0&&d.license_text.length<=50000&&sha256(d.license_text)===d.license_sha256
    &&rights?.kind===kind&&rights.allowed_use==='GENERATED_COMMERCIAL_AD'&&rights.allocation_mode==='PREPAID_ORDER_ALLOCATION'
    &&Number.isSafeInteger(rights.allocation_micro)&&rights.allocation_micro! >= 0&&rights.allocation_micro! <= 1_000_000_000,
    'AUDIO_LICENSE_UNAVAILABLE','声音资源许可缺失、撤销、内容摘要或固定成本不一致',503);
  const result:AudioRight={kind,binding:structuredClone(binding),license_version:row.version,license_sha256:d.license_sha256!,allocation_micro:rights.allocation_micro!,
    ...(d.audio_media?{media:structuredClone(d.audio_media)}:{})};
  requireThat(!result.media||(kind==='MUSIC'&&ajv.validate(rightSchema,result)&&result.media.sha256===binding.hash
    &&result.media.object_key.startsWith(`licensed-resources/${binding.resource_version_id}/`)),
    'AUDIO_LICENSE_UNAVAILABLE','配乐媒体必须使用绑定原字节的独立许可资源命名空间',503);return result;
}
/** Quote compiler. Admission of the full audio order pipeline is a separate
 * gate: compiling this private contract does not open sales. */
export async function freezeNativeAudio(db:Db,cfg:Config,contract:FrozenContract,models:SpeechModelRow[]):Promise<void>{
  if(contract.source.audio_policy.speech==='none'){frozenNativeAudio(contract);return;}
  checkedSource(contract);const rows=models.filter(m=>m.data.roles.includes('SPEECH'));
  requireThat(rows.length===1,'ASR_NOT_ADMITTED','声音方案必须选择唯一转写模型',503);
  const asr=admitSpeechContract(cfg,rows[0]!.private?.speech_contract);
  requireThat(rows[0]!.status==='ADMITTED'&&matchesSpeech(asr,rows[0]!),'ASR_MODEL_BINDING_INVALID','转写能力、版本和费率登记不一致',503);
  const character=await readCharacter(db,contract,true),c=contract.source.creative_components;
  const rights=[await readRight(db,character.character_binding,'NATIVE_CHARACTER',true),await readRight(db,character.voice_binding,'NATIVE_VOICE',true)];
  let music:NativeAudioContract['music']=null;
  if(c.music_asset_version){const binding=contract.resource_versions.find(r=>r.resource_version_id===c.music_asset_version);
    requireThat(binding&&typeof c.bgm_volume==='number'&&c.bgm_volume>0&&c.bgm_volume<=1&&typeof c.bgm_duck==='boolean'
      &&(c.music_loop_to_timeline===undefined||typeof c.music_loop_to_timeline==='boolean'),'AUDIO_MUSIC_INVALID','配乐必须绑定明确许可、音量、压低和循环策略',503);
    rights.push(await readRight(db,binding,'MUSIC',true));music={binding:structuredClone(binding),linear_gain:c.bgm_volume,
      gain_db:Math.round(20*Math.log10(c.bgm_volume)*1e6)/1e6,ducking:c.bgm_duck,loop_to_timeline:c.music_loop_to_timeline===true};
  }
  requireThat(c.font_asset_version==null||c.font_asset_version===FONT_BINDING.resource_version_id,'AUDIO_FONT_UNAVAILABLE','字幕字体未准入',503);
  for(const r of rights){const prior=contract.resource_versions.find(v=>v.resource_version_id===r.binding.resource_version_id);
    requireThat(!prior||hash(prior)===hash(r.binding),'AUDIO_RIGHTS_INVALID','原资源与人物声音许可冲突',503);if(!prior)contract.resource_versions.push(structuredClone(r.binding));}
  const allocation=rights.reduce((sum,r)=>sum+r.allocation_micro,0);contract.speech_contract=structuredClone(asr);
  contract.native_audio_contract={version:AUDIO_CONTRACT_VERSION,source_policy_hash:hash(sourcePolicy(contract)),plan_hash:contract.plan_hash,target_frames:contract.creative.target_frames,
    language:'zh-CN',preserve_native_audio:true,secondary_tts:false,original_gain_db:0,sample_rate:48000,channels:2,
    caption_style:c.caption_preset as NativeAudioContract['caption_style'],font:{...FONT_BINDING},character,character_admission_hash:hash(character),rights,music,
    asr:{contract:structuredClone(asr),contract_hash:hash(asr),input_strategy:'ASSEMBLED_NATIVE_TRACK',max_calls:1,seconds:Math.ceil(contract.creative.target_frames/30)},
    processing_policy:NATIVE_AUDIO_POLICY,ducking_policy_hash:hash(DUCKING_POLICY),cost:{asr_ceiling_micro:asr.rate.ceiling_micro,license_allocation_micro:allocation,ceiling_micro:allocation+asr.rate.ceiling_micro}};
  frozenNativeAudio(contract);freezeOrderListening(cfg,contract,models);await verifyResourceLicenses(db,contract.resource_versions,true);
}
export async function verifyNativeAudioLive(db:Db,contract:FrozenContract,lock=false):Promise<void>{
  const audio=frozenNativeAudio(contract);if(!audio)return;
  requireThat(hash(await readCharacter(db,contract,lock))===audio.character_admission_hash,'AUDIO_CHARACTER_CHANGED','原人物声音准入证据已变化',503);
  for(const right of audio.rights)requireThat(hash(await readRight(db,right.binding,right.kind,lock))===hash(right),'AUDIO_LICENSE_CHANGED','原资源许可或固定分摊成本已变化',503);
  await verifyResourceLicenses(db,contract.resource_versions,lock);
}
/** Fixed prepaid-license accounting, not an external provider purchase. Once
 * per original order/resource; later tools and checkpoints share the same fact. */
export async function allocateNativeAudioRights(db:Db,tenantId:string,orderId:string,contract:FrozenContract):Promise<void>{
  const audio=frozenNativeAudio(contract);if(!audio)return;await verifyNativeAudioLive(db,contract,true);
  for(const r of audio.rights){const intent=`audio-license:${tenantId}:${orderId}:${r.binding.resource_version_id}`;
    const reservation=await reserve(db,{tenantId,orderId},intent,r.allocation_micro,{type:'PREPAID_ORDER_ALLOCATION',audio_contract_hash:hash(audio),right:r});
    await settle(db,tenantId,reservation,r.allocation_micro);}
}
