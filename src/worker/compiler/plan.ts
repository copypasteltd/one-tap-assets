import type { DTO } from '../../shared/contracts/types.js';
import type { VariantSource } from '../../api/modules/catalog.js';
import { requireThat } from '../../api/lib/errors.js';
import { hash } from '../../api/lib/crypto.js';
import Ajv2020 from 'ajv/dist/2020.js';
import {communityDirection} from './community-direction.js';
import {plusRenderBinding,plusCreativeText,validatePlusCreative} from '../../shared/domain/plus-render.js';

export interface Shot {
  shot_id: string; start_frame: number; end_frame: number; overlap_frames: number;
  evidence_ids: string[]; spoken_text: string; asset_id: string; intent: string; camera: 'HOLD' | 'PUSH' | 'PAN';
}
export interface CreativePlan {
  version: '1.1'; identity_lock_id: string; profile_hash: string; variant_id: string; fps: 30; target_frames: number;
  title: string; copy: string; claim_evidence_ids: string[]; shots: Shot[];
  image_slots: { slot_id: string; asset_id: string; title: string; evidence_ids: string[] }[];
  native_voice_id: string | null; character_version_id: string | null; scene: string;
}
const reference = { type: 'string', pattern: '^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$' };
const evidenceList = { type: 'array', items: reference, maxItems: 100, uniqueItems: true };
const shortText = { type: 'string', maxLength: 1000 };
export const creativePlanSchema = {
  type: 'object', additionalProperties: false,
  required: ['version', 'identity_lock_id', 'profile_hash', 'variant_id', 'fps', 'target_frames', 'title', 'copy', 'claim_evidence_ids', 'shots', 'image_slots', 'native_voice_id', 'character_version_id', 'scene'],
  properties: {
    version: { const: '1.1' }, identity_lock_id: reference, profile_hash: { type: 'string', pattern: '^[a-f0-9]{64}$' }, variant_id: reference,
    fps: { const: 30 }, target_frames: { type: 'integer', minimum: 1, maximum: 108000 }, title: { type: 'string', minLength: 1, maxLength: 200 }, copy: { type: 'string', minLength: 1, maxLength: 10000 }, claim_evidence_ids: evidenceList,
    shots: { type: 'array', minItems: 1, maxItems: 100, items: { type: 'object', additionalProperties: false,
      required: ['shot_id', 'start_frame', 'end_frame', 'overlap_frames', 'evidence_ids', 'spoken_text', 'asset_id', 'intent', 'camera'],
      properties: { shot_id: reference, start_frame: { type: 'integer', minimum: 0 }, end_frame: { type: 'integer', minimum: 1 }, overlap_frames: { const: 0 },
        evidence_ids: evidenceList, spoken_text: { type: 'string', maxLength: 3000 }, asset_id: reference, intent: shortText, camera: { enum: ['HOLD', 'PUSH', 'PAN'] } } } },
    image_slots: { type: 'array', minItems: 1, maxItems: 100, items: { type: 'object', additionalProperties: false, required: ['slot_id', 'asset_id', 'title', 'evidence_ids'], properties: { slot_id: reference, asset_id: reference, title: shortText, evidence_ids: evidenceList } } },
    native_voice_id: { anyOf: [reference, { type: 'null' }] }, character_version_id: { anyOf: [reference, { type: 'null' }] }, scene: shortText,
  },
};
const schemaValid = new Ajv2020({ strict: false }).compile(creativePlanSchema);
export function basePlan(profile: DTO<'Profile'>, source: VariantSource): CreativePlan {
  const allEvidence = profile.evidence.map(e => e.evidence_id);
  const approved = profile.observations.filter(o => o.status === 'OBSERVED');
  const title = profile.name ?? profile.category ?? '商品实拍';
  const copy = approved.slice(0, 3).map(o => `${o.feature}：${o.value}`).join('；') || '从整体到细节，看看商品的真实样子。';
  const photos = profile.photo_roles;
  const direction=communityDirection(source);
  const target = source.timeline_policy.target_frames;
  const roles = source.timeline_policy.base_segments ?? ['商品整体', '可见细节', '整体收束'].map((role, i) => ({ role, start_seconds: Math.round(target * i / 3) / 30, end_seconds: Math.round(target * (i + 1) / 3) / 30 }));
  const shots: Shot[] = roles.map((r, index) => {
    const preferred=direction?.narrative?(r.role.includes('细节')?'DETAIL':r.role.includes('角度')?'SIDE':'WHOLE'):null;
    const photo = (preferred?photos.find(p=>p.role===preferred):undefined)??photos[index % photos.length]!;
    return { shot_id: `shot-${index + 1}`, start_frame: Math.round(r.start_seconds * 30), end_frame: index === roles.length - 1 ? target : Math.round(r.end_seconds * 30), overlap_frames: 0,
      evidence_ids: profile.evidence.filter(e => e.asset_id === photo.asset_id).map(e => e.evidence_id), spoken_text: '', asset_id: photo.asset_id, intent: r.role, camera: direction?.camera??(index % 2 ? 'PAN' : 'PUSH') };
  });
  const result:CreativePlan={ version: '1.1', identity_lock_id: profile.identity_lock_id, profile_hash: profile.profile_hash, variant_id: source.variant_id,
    fps: 30, target_frames: target, title, copy, claim_evidence_ids: [...new Set(approved.flatMap(o => o.evidence_ids))], shots,
    image_slots: source.output_slots.filter(s => s.kind === 'image').map((s, i) => ({ slot_id: s.slot_id, asset_id: photos[i % photos.length]!.asset_id, title: i === 0 ? title : s.role, evidence_ids: allEvidence })),
    native_voice_id: null, character_version_id: null, scene: '只使用商品原图中可见的视角和结构' };
  const plus=plusRenderBinding(source);if(plus){Object.assign(result,plusCreativeText(plus.settings,result));
    result.image_slots=[{slot_id:'plus-image',asset_id:plus.source_artifact_id,title:result.title,evidence_ids:allEvidence}];}
  return result;
}
export function validateCreativePlan(plan: CreativePlan, profile: DTO<'Profile'>, source: VariantSource,allowAftercareCopy=false): void {
  requireThat(schemaValid(plan), 'PLAN_SCHEMA_INVALID', '制作计划的结构不符合受控规范', 422);
  requireThat(plan.version === '1.1' && plan.identity_lock_id === profile.identity_lock_id && plan.profile_hash === profile.profile_hash && plan.variant_id === source.variant_id, 'PLAN_SCOPE_INVALID', '制作计划与商品版本不匹配', 422);
  requireThat(plan.fps === 30 && plan.target_frames === source.timeline_policy.target_frames, 'TIMELINE_INVALID', '制作时长与规格不匹配', 422);
  const evidence = new Set(profile.evidence.map(e => e.evidence_id)); const photos = new Set(profile.photo_roles.map(r => r.asset_id));
  requireThat(new Set(plan.shots.map(s => s.shot_id)).size === plan.shots.length, 'TIMELINE_INVALID', '分镜标识重复', 422);
  requireThat(plan.claim_evidence_ids.every(e => evidence.has(e)) && plan.shots.every(s => photos.has(s.asset_id) && s.evidence_ids.every(e => evidence.has(e))), 'EVIDENCE_SCOPE_INVALID', '计划引用了无权使用或不存在的证据', 422);
  requireThat(plan.shots.length > 0 && plan.shots.length <= 100, 'TIMELINE_INVALID', '分镜数量无效', 422);
  let position = 0;
  for (const shot of plan.shots) {
    requireThat(Number.isInteger(shot.start_frame) && Number.isInteger(shot.end_frame) && Number.isInteger(shot.overlap_frames) && shot.start_frame === position && shot.end_frame > shot.start_frame && shot.overlap_frames === 0, 'TIMELINE_INVALID', '时间轴存在空隙、重叠或非整数帧', 422);
    position = shot.end_frame;
  }
  requireThat(position === plan.target_frames, 'TIMELINE_INVALID', '时间轴未覆盖完整时长', 422);
  const direction=communityDirection(source);
  if(direction){const segments=source.timeline_policy.base_segments;
    requireThat(segments&&segments.length===plan.shots.length&&plan.shots.every((shot,i)=>shot.start_frame===Math.round(segments[i]!.start_seconds*30)
      &&shot.end_frame===Math.round(segments[i]!.end_seconds*30)&&(!direction.camera||shot.camera===direction.camera)
      &&(!direction.narrative||shot.intent===segments[i]!.role)),
    'COMMUNITY_DIRECTION_MISMATCH','内容计划必须保留原方案选择的叙事、节奏与运镜',422);}
  if(direction?.narrative)for(const shot of plan.shots){const role=shot.intent.includes('细节')?'DETAIL':shot.intent.includes('角度')?'SIDE':'WHOLE';
    const matching=profile.photo_roles.filter(p=>p.role===role);
    requireThat(!matching.length||matching.some(p=>p.asset_id===shot.asset_id),'COMMUNITY_PHOTO_ORDER_MISMATCH','镜头选图必须与照片档案中的整体、角度或细节证据对应',422);}
  const slots = source.output_slots.filter(s => s.kind === 'image'),plus=plusRenderBinding(source);
  const imageAssets=new Set(photos);if(plus)imageAssets.add(plus.source_artifact_id);
  requireThat(slots.length === plan.image_slots.length && new Set(plan.image_slots.map(s => s.slot_id)).size === slots.length && plan.image_slots.every(s => slots.some(x => x.slot_id === s.slot_id) && imageAssets.has(s.asset_id) && s.evidence_ids.every(e => evidence.has(e))), 'PLAN_OUTPUT_INVALID', '图片计划与交付清单不一致', 422);
  validatePlusCreative(plan,source,allowAftercareCopy);
  if (source.audio_policy.speech !== 'none') requireThat(plan.native_voice_id && plan.character_version_id && plan.shots.some(s => s.spoken_text.trim()), 'NATIVE_SPEECH_REQUIRED', '口播方案需要已准入的人物、声音和中文台词', 422);
  const knownText = profile.observations.filter(o => o.status === 'OBSERVED').map(o => o.value).join(' ');
  // Shot intent is also painted into PHOTO_LAYOUT frames. It is not a private
  // director note exempt from the same evidence gate as titles and speech.
  const claims = `${plan.title} ${plan.copy} ${plan.image_slots.map(s => s.title).join(' ')} ${plan.shots.map(s => `${s.intent} ${s.spoken_text}`).join(' ')}`;
  const highRisk = claims.match(/(?:\d+(?:\.\d+)?\s*(?:元|折|%|毫升|ml|克|kg|厘米|cm|小时)|治愈|治疗|根治|全网最低|第一名|保证有效)/gi) ?? [];
  requireThat(highRisk.every(c => knownText.includes(c)), 'UNSUPPORTED_CLAIM', '文案包含照片证据无法支持的价格、规格或效果表述', 422);
  requireThat(plan.title.length <= 200 && plan.copy.length <= 10000 && plan.shots.every(s => s.spoken_text.length <= 3000), 'PLAN_TEXT_TOO_LONG', '文案长度超过限制', 422);
}
export const creativePlanHash = (plan: CreativePlan): string => hash(plan);
