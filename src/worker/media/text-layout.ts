import sharp from 'sharp';
import {requireThat} from '../../api/lib/errors.js';
import type {ProductionFont} from './font.js';

export const escapeLayoutText=(text:string):string=>text.replaceAll('&','&amp;').replaceAll('<','&lt;')
  .replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&apos;');
export interface TextRaster {text:string;png:Buffer;width:number;height:number}
export interface TextStyle {font:ProductionFont;size:number;color:string;bold?:boolean}
/** Only visual whitespace is normalized. The original copy file is unchanged. */
export function normalizeLayoutText(text:string):string{return text.replaceAll(/[\r\n\t]/g,' ').replaceAll(/ +/g,' ').trim();}
export async function rasterLayoutText(text:string,style:TextStyle):Promise<TextRaster>{
  requireThat(text.length>0&&Number.isInteger(style.size)&&style.size>0&&style.size<=192,
    'LAYOUT_TEXT_INVALID','排版文字或字号无效',422);
  requireThat(Array.from(text).every(c=>style.font.supports(c.codePointAt(0)!)),
    'FONT_GLYPH_UNAVAILABLE','当前字体不支持部分文字，请按原计划重新生成受支持的展示文案',422);
  const result=await sharp({text:{text:`<span foreground="${style.color}" fallback="false">${escapeLayoutText(text)}</span>`,
    font:`Noto Sans SC ${style.bold?'Bold ':''}${style.size}`,fontfile:style.font.path,rgba:true,dpi:72}}).png().toBuffer({resolveWithObject:true});
  return {text,png:result.data,width:result.info.width,height:result.info.height};
}
/** Measure pinned-font pixels, never approximate Latin as half a CJK glyph.
 * A bounded binary search wraps whole graphemes without dropping a suffix. */
export async function wrapLayoutText(raw:string,style:TextStyle,width:number,maxLines:number):Promise<TextRaster[]>{
  const text=normalizeLayoutText(raw);
  const chars=Array.from(new Intl.Segmenter('zh-CN',{granularity:'grapheme'}).segment(text),s=>s.segment);
  requireThat(chars.length<=1000&&width>0&&Number.isInteger(width)&&maxLines>0&&maxLines<=3,
    'LAYOUT_TEXT_OVERFLOW','完整展示文字超过当前版式容量，请在报价前缩短文案',422);
  requireThat(Array.from(text).every(c=>style.font.supports(c.codePointAt(0)!)),
    'FONT_GLYPH_UNAVAILABLE','当前字体不支持部分文字，请按原计划重新生成受支持的展示文案',422);
  // Short copy usually fits in full. Reuse that actual raster instead of
  // measuring several prefixes; overflow still uses the complete-line search.
  if(chars.length>0&&chars.length<=64){
    const full=await rasterLayoutText(text,style);if(full.width<=width)return [full];
  }
  const lines:TextRaster[]=[];let at=0;
  while(at<chars.length){
    requireThat(lines.length<maxLines,'LAYOUT_TEXT_OVERFLOW','完整展示文字超过当前版式行数，不能截断交付',422);
    let low=1,high=chars.length-at,best:TextRaster|undefined,taken=0;
    while(low<=high){
      const count=Math.floor((low+high)/2),line=await rasterLayoutText(chars.slice(at,at+count).join(''),style);
      if(line.width<=width){best=line;taken=count;low=count+1;}else high=count-1;
    }
    requireThat(best&&taken>0,'LAYOUT_TEXT_OVERFLOW','展示文字无法完整放入当前安全区域',422);
    lines.push(best);at+=taken;
  }
  requireThat(lines.map(l=>l.text).join('')===text,'LAYOUT_TEXT_INCOMPLETE','展示文字没有完整保留',500);
  return lines;
}
