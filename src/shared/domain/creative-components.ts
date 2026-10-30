import type {DTO} from '../contracts/types.js';

export const CREATIVE_GROUPS=[
  {type:'NARRATIVE',name:'叙事顺序',hint:'决定先展示整体还是细节，商品事实始终来自照片。'},
  {type:'RHYTHM',name:'镜头节奏',hint:'调整现有镜头的时间分配，保持总时长与素材数量。'},
  {type:'CAMERA',name:'镜头运动',hint:'选择固定、轻推或横移；生成路线仍须独立核对商品。'},
  {type:'CAPTION',name:'文字样式',hint:'用于图片说明、短片画面说明和原生声音的对应字幕。'},
] as const;
export type CreativeGroup=typeof CREATIVE_GROUPS[number]['type'];
export type CaptionStyle='standard'|'bold'|'minimal';
const engines:DTO<'Engine'>[]=['PHOTO_LAYOUT','PER_SHOT_AI','REFERENCE_FILM'];
const definitions=[
  ['narrative.whole-first.1','NARRATIVE','先整体，再细节','从商品整体进入，观察细节后收束。','WHOLE_FIRST'],
  ['narrative.detail-first.1','NARRATIVE','细节开场','先看可见细节，再回到商品整体。','DETAIL_FIRST'],
  ['narrative.views.1','NARRATIVE','角度对照','按可用照片对照整体、角度与细节。','VIEWS'],
  ['rhythm.even.1','RHYTHM','均匀展开','现有镜头平均分配时长，平稳展示商品。','EVEN'],
  ['rhythm.quick-open.1','RHYTHM','轻快开场','开头稍快，中后段留出观察时间。','QUICK_OPEN'],
  ['rhythm.long-end.1','RHYTHM','从容收尾','前段紧凑，结尾多留一点停留时间。','LONG_END'],
  ['camera.hold.1','CAMERA','固定观察','固定视角，留意商品的形状与细节。','HOLD'],
  ['camera.push.1','CAMERA','缓慢推进','轻微推进，保持商品完整与稳定。','PUSH'],
  ['camera.pan.1','CAMERA','轻柔横移','轻微横移，不改变商品结构与数量。','PAN'],
  ['caption.standard.1','CAPTION','清晰标准','平衡字号与留白，完整保留画面说明。','standard'],
  ['caption.bold.1','CAPTION','醒目强调','使用较大加粗文字，保留完整内容与安全区域。','bold'],
  ['caption.minimal.1','CAPTION','轻简留白','使用较轻的文字层级，保留完整内容。','minimal'],
] as const;
export const CREATIVE_COMPONENTS=definitions.map(([id,type,name,description,value])=>({
  option:{component_version_id:id,type,name,description,supported_engines:[...engines]} satisfies DTO<'ComponentOption'>,
  value,version:'1.0.0' as const,
}));
/** Radio selection within a category, with a second tap restoring inheritance. */
export function selectCreativeComponent(selected:string[],id:string,options:DTO<'ComponentOption'>[]):string[]{
  const target=options.find(c=>c.component_version_id===id);
  if(!target)return selected;
  return selected.includes(id)?selected.filter(v=>v!==id):[...selected.filter(v=>!options.some(c=>c.component_version_id===v&&c.type===target.type)),id];
}
