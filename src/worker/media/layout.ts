import sharp, { type OverlayOptions } from 'sharp';
import { requireThat } from '../../api/lib/errors.js';
import { loadProductionFont, type ProductionFont } from './font.js';
import {rasterLayoutText,wrapLayoutText,type TextRaster} from './text-layout.js';
import type {AiDisclosureContract} from '../compiler/disclosure.js';
import type {CaptionStyle} from '../../shared/domain/creative-components.js';
export {escapeLayoutText as xml} from './text-layout.js';

export interface LayoutStyle { id: string; bg: string; ink: string; accent: string; layout: 'AIR' | 'PAPER' | 'LUXE' | 'FRESH' | 'FLASH' | 'CALM' | 'CARDS' | 'POP' | 'STORY' | 'SOCIAL'; label: string }
export const STYLES: Record<string, LayoutStyle> = Object.fromEntries([
  { id: 'minimal-clean', bg: '#FAFBF8', ink: '#263B32', accent: '#9BB6A5', layout: 'AIR', label: '真实细节，自有分量' },
  { id: 'warm-handmade', bg: '#F6EBDD', ink: '#624933', accent: '#C7784E', layout: 'PAPER', label: '慢慢看，细细发现' },
  { id: 'quiet-luxury', bg: '#222B28', ink: '#F6EBD8', accent: '#C9AA72', layout: 'LUXE', label: '留白之间，看见质感' },
  { id: 'fresh-daily', bg: '#EDF7E9', ink: '#2C4C36', accent: '#C0DE78', layout: 'FRESH', label: '日常新鲜一面' },
  { id: 'appetite-flash', bg: '#FFE1B5', ink: '#5A271B', accent: '#ED693D', layout: 'FLASH', label: '把这一刻放大' },
  { id: 'home-calm', bg: '#E8EBE0', ink: '#34453C', accent: '#9CAC91', layout: 'CALM', label: '给日常一点从容' },
  { id: 'feature-cards', bg: '#F6F3EB', ink: '#263B32', accent: '#F0BD4F', layout: 'CARDS', label: '整体与细节，都看得见' },
  { id: 'color-pop', bg: '#F1DDFF', ink: '#322044', accent: '#FC7950', layout: 'POP', label: '这一面，刚好出彩' },
  { id: 'launch-story', bg: '#F7EDE3', ink: '#45392F', accent: '#CF7650', layout: 'STORY', label: '从第一眼到每一面' },
  { id: 'portrait-social', bg: '#FFEDE3', ink: '#503A37', accent: '#DF8D82', layout: 'SOCIAL', label: '分享眼前的真实好物' },
].map(s => [s.id, s as LayoutStyle]));
export interface LayoutOptions {presetId:string;width:number;height:number;title:string;subtitle:string;sequence:number;total:number;
  aiLabel?:boolean;font?:ProductionFont;disclosure?:AiDisclosureContract;captionStyle?:CaptionStyle}
export interface TextPlacement extends TextRaster {left:number;top:number;kind:'TITLE'|'SUBTITLE'|'CHAPTER'|'FOOTER'}
export async function prepareLayoutText(options:LayoutOptions){
  const { width: w, height: h } = options; const style = STYLES[options.presetId];
  const font = options.font ?? await loadProductionFont(process.cwd());
  requireThat(style && Number.isSafeInteger(w) && Number.isSafeInteger(h) && w >= 640 && h >= 640 && w <= 1920 && h <= 1920, 'LAYOUT_SPEC_INVALID', '排版规格不受支持', 422);
  const unit = w / 1080; const margin = Math.round((style.layout === 'AIR' ? 100 : style.layout === 'LUXE' ? 76 : 58) * unit);
  const portrait = h / w > 1.3; const titleSize = Math.round((style.layout === 'FLASH' || style.layout === 'POP' ? 70 : 56) * unit);
  let top = Math.round((portrait ? (style.layout === 'STORY' ? 330 : 260) : 180) * unit);
  let bottom = Math.round((portrait ? 250 : 170) * unit);
  const imgW = w - margin * 2;
  const title = await wrapLayoutText(options.title,{font,size:titleSize,color:style.ink,bold:true},imgW,2);
  const subtitleSize=Math.round((options.captionStyle==='bold'?40:options.captionStyle==='minimal'?26:options.captionStyle==='standard'?32:30)*unit),footerSize=Math.round(22*unit),subtitleInset=style.layout==='CARDS'?Math.round(24*unit):0;
  const subtitleStep=options.captionStyle?Math.ceil(subtitleSize*1.4):42*unit;
  const subtitle = await wrapLayoutText(options.subtitle,{font,size:subtitleSize,color:style.ink,...(options.captionStyle==='bold'?{bold:true}:{})},imgW-subtitleInset,portrait?3:2);
  const policy=options.disclosure?.geometry;
  const markScale=policy?w/policy.reference_width:unit;
  const mark={left:Math.round((policy?.margin??32)*markScale),top:Math.round((policy?.margin??32)*markScale),
    width:Math.round((policy?.width??224)*markScale),height:Math.round((policy?.height??72)*markScale)};
  const chapterBaseline=options.aiLabel?mark.top+mark.height+54*unit:90*unit;
  const titleFloor=Math.max(options.aiLabel?mark.top+mark.height+24*unit:0,style.layout==='STORY'?chapterBaseline+24*unit:0);
  // Expand safe areas for actual line count; do not shrink fonts or erase text.
  top=Math.max(top,Math.ceil(titleFloor+titleSize+Math.max(0,title.length-1)*titleSize*1.2+50*unit));
  const footerTop=Math.round(h-48*unit-footerSize);
  bottom=Math.max(bottom,Math.ceil(72*unit+Math.max(0,subtitle.length-1)*subtitleStep+h-footerTop+24*unit));
  const imgH=h-top-bottom;
  requireThat(imgH>0,'LAYOUT_TEXT_OVERFLOW','完整文字没有为商品图片留下安全区域',422);
  const text:TextPlacement[]=[];
  const put=(line:TextRaster,x:number,baseline:number,size:number,kind:TextPlacement['kind'],right=false):void=>{
    const left=Math.round(right?x-line.width:x),y=Math.round(baseline-size);
    requireThat(line.width<=imgW&&left>=margin&&y>=0&&left+line.width<=w-margin&&y+line.height<=h,
      'LAYOUT_TEXT_OVERFLOW','完整文字超出预设安全区域',422);
    const rect={...line,left,top:y,kind};
    const overlaps=(b:{left:number;top:number;width:number;height:number})=>left<b.left+b.width&&left+line.width>b.left&&y<b.top+b.height&&y+line.height>b.top;
    requireThat(!text.some(overlaps)&&(!options.aiLabel||!overlaps(mark)),
      'LAYOUT_TEXT_OVERLAP','展示文字与其他文字或AI标识重叠',422);
    text.push(rect);
  };
  for(const [i,line] of title.entries())put(line,margin,top-(title.length-i-1)*titleSize*1.2-50*unit,titleSize,'TITLE');
  for(const [i,line] of subtitle.entries())put(line,margin+subtitleInset,h-bottom+72*unit+i*subtitleStep,subtitleSize,'SUBTITLE');
  put(await rasterLayoutText(`${options.sequence} / ${options.total} · ${options.aiLabel?'AI 生成素材':'商品实拍'}`,
    {font,size:footerSize,color:style.ink}),w-margin,h-48*unit,footerSize,'FOOTER',true);
  if(style.layout==='STORY')put(await rasterLayoutText(`CHAPTER ${String(options.sequence).padStart(2,'0')}`,
    {font,size:Math.round(30*unit),color:style.accent}),margin,chapterBaseline,Math.round(30*unit),'CHAPTER');
  return {w,h,style,unit,margin,top,bottom,imgW,imgH,text};
}
export async function renderLayout(input:Buffer,options:LayoutOptions):Promise<Buffer>{
  const {w,h,style,unit,margin,top,bottom,imgW,imgH,text}=await prepareLayoutText(options);
  const photo=await sharp(input,{limitInputPixels:30_000_000}).autoOrient().resize(imgW,imgH,{fit:'contain',background:style.bg,withoutEnlargement:false}).png().toBuffer();
  const round = style.layout === 'LUXE' || style.layout === 'AIR' ? 0 : 22 * unit;
  const decorations: Record<LayoutStyle['layout'], string> = {
    AIR: `<line x1="${margin}" y1="${h - bottom + 50 * unit}" x2="${margin + 110 * unit}" y2="${h - bottom + 50 * unit}" stroke="${style.accent}" stroke-width="3"/>`,
    PAPER: `<path d="M 15 50 L ${w - 18} 42 M 24 ${h - 20} L ${w - 25} ${h - 30}" stroke="${style.accent}" stroke-width="3" opacity=".4"/><rect x="${w * .36}" y="${top - 15 * unit}" width="${w * .28}" height="${32 * unit}" fill="${style.accent}" opacity=".3" transform="rotate(-3 ${w / 2} ${top})"/>`,
    LUXE: `<rect x="${25 * unit}" y="${25 * unit}" width="${w - 50 * unit}" height="${h - 50 * unit}" fill="none" stroke="${style.accent}" stroke-width="1"/><line x1="${margin}" y1="${top - 35 * unit}" x2="${w - margin}" y2="${top - 35 * unit}" stroke="${style.accent}"/>`,
    FRESH: `<circle cx="${w - 50 * unit}" cy="${80 * unit}" r="${110 * unit}" fill="${style.accent}" opacity=".5"/><rect x="${margin}" y="${h - 68 * unit}" width="${170 * unit}" height="${7 * unit}" rx="3" fill="${style.accent}"/>`,
    FLASH: `<path d="M${w - 170 * unit} 0 H${w} V${220 * unit} Z" fill="${style.accent}"/><path d="M0 ${h - 120 * unit} L${140 * unit} ${h} H0 Z" fill="${style.accent}"/>`,
    CALM: `<rect x="${margin - 18 * unit}" y="${top + 30 * unit}" width="${imgW + 36 * unit}" height="${imgH + 30 * unit}" rx="${round}" fill="${style.accent}" opacity=".3"/>`,
    CARDS: `<rect x="${margin}" y="${h - bottom + 25 * unit}" width="${imgW}" height="${bottom - 55 * unit}" rx="${18 * unit}" fill="${style.accent}" opacity=".3"/>`,
    POP: `<circle cx="${w - margin}" cy="${top / 2}" r="${95 * unit}" fill="${style.accent}"/><rect x="0" y="${h - 40 * unit}" width="${w}" height="${40 * unit}" fill="${style.ink}"/>`,
    STORY: `<line x1="${margin - 22 * unit}" y1="${top}" x2="${margin - 22 * unit}" y2="${h - bottom}" stroke="${style.accent}" stroke-width="4"/>`,
    SOCIAL: `<rect x="${margin - 16 * unit}" y="${top - 16 * unit}" width="${imgW + 32 * unit}" height="${imgH + 72 * unit}" rx="${round}" fill="#FFFAF5"/><circle cx="${margin + 12 * unit}" cy="${h - 75 * unit}" r="${12 * unit}" fill="${style.accent}"/>`,
  };
  const head = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="${style.bg}"/>${decorations[style.layout]}</svg>`;
  const overlays:OverlayOptions[]=[{input:photo,left:margin,top},...text.map(t=>({input:t.png,left:t.left,top:t.top}))];
  return sharp(Buffer.from(head)).composite(overlays).png().toBuffer();
}
