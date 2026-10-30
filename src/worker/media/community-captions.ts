import sharp from 'sharp';
import type {VariantSource} from '../../api/modules/catalog.js';
import {communityCaptionStyle} from '../compiler/community-direction.js';
import {requireThat} from '../../api/lib/errors.js';
import {loadProductionFont,type ProductionFont} from './font.js';
import {wrapLayoutText} from './text-layout.js';

/** A platform-rendered silent shot label, never invented speech or a substitute
 * for the original ASR-aligned captions required by native-audio contracts. */
export async function communityCaptionRaster(root:string,source:VariantSource,text:string,font?:ProductionFont):Promise<Buffer>{
  const style=communityCaptionStyle(source);requireThat(style,'COMMUNITY_CAPTION_REQUIRED','当前方案未选择画面文字样式',503);
  const pinned=font??await loadProductionFont(root),size=style==='bold'?54:style==='minimal'?34:42;
  const lines=await wrapLayoutText(text,{font:pinned,size,color:'#FFFFFF',bold:style==='bold'},900,2);
  requireThat(lines.length>0,'COMMUNITY_CAPTION_REQUIRED','画面说明不能为空',422);
  const step=Math.ceil(size*1.5),height=step*lines.length+56,top=1920-64-height;
  const overlays=lines.map((line,i)=>({input:line.png,left:90,top:top+28+i*step}));
  const band=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920"><rect x="60" y="${top}" width="960" height="${height}" rx="18" fill="#213A2D" fill-opacity=".94"/></svg>`);
  return sharp(band).composite(overlays).png().toBuffer();
}
