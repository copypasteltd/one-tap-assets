import type {DTO} from '../contracts/types.js';
import type {VariantSource} from '../../api/modules/catalog.js';
import type {PlusRenderBinding} from './plus-render.js';
import type {CreativePlan} from '../../worker/compiler/plan.js';
import {validatePlusSettings,plusCreativeText} from './plus-render.js';
import {hash} from '../../api/lib/crypto.js';
import {requireThat} from '../../api/lib/errors.js';

export const PLUS_VIDEO_VERSION='YPCC-PLUS-VIDEO-1';
export const PLUS_VIDEO_QC='YPCC-QC-PLUS-VIDEO-1';
export const PLUS_VIDEO_PIXELS=2073600;
export interface PlusVideoBinding extends Omit<PlusRenderBinding,'version'|'settings'|'pricing'> {
  version:typeof PLUS_VIDEO_VERSION;settings:DTO<'PlusVideoSettings'>;
  source_frames:number;source_fps:30;source_has_audio:boolean;source_inspection_hash:string;
  pricing:{amount_fen:number;version:string;budget_micro:number;listening_model_version_id:string|null};
}
export function validatePlusVideoSettings(s:DTO<'PlusVideoSettings'>,sourceFrames:number):void{
  validatePlusSettings(s);
  requireThat(s.canvas.width<=1920&&s.canvas.height<=1920&&s.canvas.width%2===0&&s.canvas.height%2===0&&s.canvas.width*s.canvas.height<=PLUS_VIDEO_PIXELS,
    'PLUS_VIDEO_CANVAS_INVALID','视频尺寸需为256至1920的偶数，总像素不超过1080p画面',422);
  const {start_frame:start,end_frame:end}=s.trim;
  requireThat(Number.isSafeInteger(sourceFrames)&&sourceFrames>=30&&sourceFrames<=3600&&Number.isInteger(start)&&Number.isInteger(end)
    &&start>=0&&end<=sourceFrames&&end-start>=30&&end-start<=1800,'PLUS_VIDEO_TRIM_INVALID','请选择原视频内1至60秒的完整选段',422);
  requireThat(['PRESERVE','MUTE'].includes(s.audio_mode)&&s.captions.length<=40,'PLUS_VIDEO_SETTINGS_INVALID','声音选择或字幕数量不符合范围',422);
  let position=0;
  for(const cue of s.captions){
    requireThat(Number.isInteger(cue.start_frame)&&Number.isInteger(cue.end_frame)&&cue.start_frame>=position&&cue.end_frame>cue.start_frame
      &&cue.end_frame<=end-start&&['SUBTITLE','ON_SCREEN_COPY'].includes(cue.kind)&&cue.text.trim().length>0&&cue.text.length<=200&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(cue.text),
      'PLUS_VIDEO_CAPTION_INVALID','字幕按成片时间排序，不可重叠或超过选段；每条最多200字',422);
    position=cue.end_frame;
  }
}
export function plusVideoBinding(source:VariantSource):PlusVideoBinding|null{
  const b=source.creative_components.plus_video as PlusVideoBinding|undefined;if(!b)return null;
  requireThat(!source.creative_components.plus_render&&b.version===PLUS_VIDEO_VERSION&&b.source_fps===30&&typeof b.source_has_audio==='boolean'
    &&/^[a-f0-9]{64}$/.test(b.source_inspection_hash)&&b.settings_hash===hash(b.settings)&&Number.isSafeInteger(b.draft_revision)&&b.draft_revision>0
    &&Number.isSafeInteger(b.pricing.amount_fen)&&b.pricing.amount_fen>0&&!!b.pricing.version&&Number.isSafeInteger(b.pricing.budget_micro)&&b.pricing.budget_micro>0
    &&(!b.source_has_audio||b.settings.audio_mode!=='PRESERVE'||!!b.pricing.listening_model_version_id),
    'PLUS_VIDEO_BINDING_INVALID','视频编辑缺少完整冻结的来源、修订与计价信息',503);
  validatePlusVideoSettings(b.settings,b.source_frames);
  requireThat(source.engine==='PHOTO_LAYOUT'&&source.output_slots.length===2&&source.timeline_policy.target_frames===b.settings.trim.end_frame-b.settings.trim.start_frame
    &&source.output_slots.every(slot=>slot.width===b.settings.canvas.width&&slot.height===b.settings.canvas.height)
    &&source.output_slots.some(s=>s.slot_id==='plus-video'&&s.kind==='video')&&source.output_slots.some(s=>s.slot_id==='plus-video-cover'&&s.kind==='image'),
    'PLUS_VIDEO_BINDING_INVALID','视频和封面规格与已确认的编辑修订不一致',503);
  return b;
}
export function plusVideoNeedsListening(source:VariantSource):boolean{
  const b=plusVideoBinding(source);return !!b&&b.source_has_audio&&b.settings.audio_mode==='PRESERVE';
}
export function derivePlusVideoSource(base:VariantSource,b:PlusVideoBinding):VariantSource{
  requireThat(base.engine==='PHOTO_LAYOUT'&&!base.creative_components.plus_render&&!base.creative_components.plus_video&&hash(base)===b.base_source_hash,
    'PLUS_BASE_VARIANT_CHANGED','视频编辑原风格配置已变化，请重新整理清单',409);
  const target=b.settings.trim.end_frame-b.settings.trim.start_frame;
  const source:VariantSource={...structuredClone(base),name:`${base.name} · Plus视频编辑`,
    timeline_policy:{...structuredClone(base.timeline_policy),target_frames:target,base_segments:[{role:'原视频选段与定时字幕',start_seconds:0,end_seconds:target/30}]},
    output_slots:[{slot_id:'plus-video',kind:'video',width:b.settings.canvas.width,height:b.settings.canvas.height,fps:30,duration_seconds:target/30,role:'原视频独立编辑成片'},
      {slot_id:'plus-video-cover',kind:'image',width:b.settings.canvas.width,height:b.settings.canvas.height,role:'成片实际首帧封面'}],
    required_auxiliary_outputs:['copy'],ai_disclosure_required:b.inherits_ai,
    creative_components:{...structuredClone(base.creative_components),plus_video:structuredClone(b)}};
  plusVideoBinding(source);return source;
}
export function validatePlusVideoCreative(plan:CreativePlan,profile:DTO<'Profile'>,source:VariantSource,allowAftercareCopy=false):void{
  const b=plusVideoBinding(source);if(!b)return;
  const text=plusCreativeText(b.settings,plan);
  requireThat(plan.title===text.title&&(allowAftercareCopy||plan.copy===text.copy)&&plan.image_slots.length===1
    &&plan.image_slots[0]?.slot_id==='plus-video-cover'&&plan.image_slots[0].asset_id===b.source_artifact_id&&plan.image_slots[0].title===plan.title
    &&plan.shots.length===1&&plan.shots[0]?.asset_id===b.source_artifact_id&&plan.shots[0].spoken_text==='',
    'PLUS_VIDEO_CONTENT_CHANGED','视频清单须保留所选原视频、选段与已确认文字，不可改成重新生图或配音',422);
  const known=profile.observations.filter(o=>o.status==='OBSERVED').map(o=>o.value).join(' ');
  const claims=b.settings.captions.map(c=>c.text).join(' ').match(/(?:\d+(?:\.\d+)?\s*(?:元|折|%|毫升|ml|克|kg|厘米|cm|小时)|治愈|治疗|根治|全网最低|第一名|保证有效)/gi)??[];
  requireThat(claims.every(c=>known.includes(c)),'UNSUPPORTED_CLAIM','字幕含商品证据未支持的价格、规格或效果，请修改后保存',422);
}
