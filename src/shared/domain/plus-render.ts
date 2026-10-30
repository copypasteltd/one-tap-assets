import type {DTO} from '../contracts/types.js';
import type {VariantSource} from '../../api/modules/catalog.js';
import type {CreativePlan} from '../../worker/compiler/plan.js';
import {hash} from '../../api/lib/crypto.js';
import {requireThat} from '../../api/lib/errors.js';

export const PLUS_RENDER_VERSION='YPCC-PLUS-IMAGE-1';
export const PLUS_RENDER_PIXELS=8294400;
export interface PlusRenderBinding {
  version:typeof PLUS_RENDER_VERSION;draft_id:string;draft_revision:number;settings:DTO<'PlusEditSettings'>;settings_hash:string;
  source_order_id:string;source_product_id:string;source_manifest_id:string;source_manifest_revision:number;source_manifest_hash:string;
  source_artifact_id:string;source_sha256:string;source_bytes:number;source_width:number;source_height:number;source_object_key:string;
  source_contract_hash:string;source_expires_at:string;inherits_ai:boolean;base_source_hash:string;
  pricing:{amount_fen:number;version:string};
}
export function validatePlusSettings(s:DTO<'PlusEditSettings'>):void {
  const c=s.crop;
  requireThat([c.x,c.y,c.width,c.height].every(Number.isFinite)&&c.x>=0&&c.y>=0&&c.width>=.01&&c.height>=.01
    &&c.x+c.width<=1+1e-9&&c.y+c.height<=1+1e-9,'PLUS_CROP_INVALID','裁切区域需完整位于图片内',422);
  requireThat(Number.isInteger(s.canvas.width)&&Number.isInteger(s.canvas.height)&&s.canvas.width>=256&&s.canvas.height>=256
    &&s.canvas.width<=3840&&s.canvas.height<=3840&&s.canvas.width*s.canvas.height<=PLUS_RENDER_PIXELS,'PLUS_CANVAS_INVALID','规格需在256至3840像素内，且总像素不超过4K画面',422);
  requireThat(s.title.length<=80&&s.brand.length<=60&&s.facts.length<=8&&s.facts.every(x=>x.length>0&&x.length<=200),
    'PLUS_TEXT_INVALID','编辑文字超出保存或制作范围',422);
}
export function plusRenderBinding(source:VariantSource):PlusRenderBinding|null {
  const b=source.creative_components.plus_render as PlusRenderBinding|undefined;if(!b)return null;
  requireThat(b.version===PLUS_RENDER_VERSION&&b.settings_hash===hash(b.settings)&&Number.isSafeInteger(b.draft_revision)&&b.draft_revision>0
    &&Number.isSafeInteger(b.pricing.amount_fen)&&b.pricing.amount_fen>0&&!!b.pricing.version,
    'PLUS_RENDER_BINDING_INVALID','进阶制作缺少完整冻结的编辑与计价信息',503);
  validatePlusSettings(b.settings);
  requireThat(source.engine==='PHOTO_LAYOUT'&&source.output_slots.length===1&&source.output_slots[0]?.slot_id==='plus-image'
    &&source.output_slots[0].kind==='image'&&source.output_slots[0].width===b.settings.canvas.width&&source.output_slots[0].height===b.settings.canvas.height,
    'PLUS_RENDER_BINDING_INVALID','进阶图片规格与原编辑版本不一致',503);
  return b;
}
export function derivePlusSource(base:VariantSource,b:PlusRenderBinding):VariantSource {
  requireThat(base.engine==='PHOTO_LAYOUT'&&!base.creative_components.plus_render&&hash(base)===b.base_source_hash,
    'PLUS_BASE_VARIANT_CHANGED','进阶制作的原风格配置已变化，请重新整理清单',409);
  const source:VariantSource={...structuredClone(base),name:`${base.name} · Plus图片`,
    output_slots:[{slot_id:'plus-image',kind:'image',width:b.settings.canvas.width,height:b.settings.canvas.height,role:'进阶编辑图片'}],
    required_auxiliary_outputs:['copy'],ai_disclosure_required:b.inherits_ai,
    creative_components:{...structuredClone(base.creative_components),plus_render:structuredClone(b)}};
  plusRenderBinding(source);return source;
}
export function plusCreativeText(settings:DTO<'PlusEditSettings'>,fallback:{title:string;copy:string}) {
  return {title:settings.title.trim()||fallback.title,
    copy:[settings.brand.trim()?`品牌：${settings.brand}`:'',...settings.facts].filter(Boolean).join('；')||fallback.copy};
}
export function validatePlusCreative(plan:CreativePlan,source:VariantSource,allowAftercareCopy=false):void {
  const b=plusRenderBinding(source);if(!b)return;
  const explicit=plusCreativeText(b.settings,{title:plan.title,copy:plan.copy});
  requireThat(plan.title===explicit.title&&(allowAftercareCopy||plan.copy===explicit.copy)&&plan.image_slots.length===1
    &&plan.image_slots[0]?.slot_id==='plus-image'&&plan.image_slots[0].title===plan.title&&plan.image_slots[0].asset_id===b.source_artifact_id,
    'PLUS_EDIT_CONTENT_CHANGED','规划须保留所选图片与已确认编辑文字；不允许静默改写',422);
}
