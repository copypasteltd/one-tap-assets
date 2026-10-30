import sharp from 'sharp';
import type {VariantSource} from '../../api/modules/catalog.js';
import type {CreativePlan} from '../compiler/plan.js';
import type {AiDisclosureContract} from '../compiler/disclosure.js';
import type {ProductionFont} from './font.js';
import {rasterLayoutText,wrapLayoutText,type TextRaster} from './text-layout.js';
import {STYLES} from './layout.js';
import {plusVideoBinding,plusVideoNeedsListening} from '../../shared/domain/plus-video.js';
import {requireThat} from '../../api/lib/errors.js';

interface Input{source:VariantSource;plan:CreativePlan;presetId:string;font:ProductionFont;disclosure?:AiDisclosureContract}
export async function preparePlusVideoText(input:Input){
  const b=plusVideoBinding(input.source);requireThat(b,'PLUS_VIDEO_BINDING_INVALID','缺少已确认的视频编辑合同',503);
  const {width,height}=b!.settings.canvas,key=input.source.creative_components.platform_style_id;
  const style=STYLES[typeof key==='string'?key:input.presetId];requireThat(style,'PLUS_STYLE_UNAVAILABLE','该风格尚不支持视频编辑排版',422);
  const scale=width/1080,margin=Math.max(12,Math.round(36*scale)),gap=Math.max(8,Math.round(18*scale));
  const titleSize=Math.max(15,Math.round(44*scale)),captionSize=Math.max(13,Math.round(34*scale)),footerSize=Math.max(9,Math.round(20*scale));
  const title=await wrapLayoutText(input.plan.title,{font:input.font,size:titleSize,color:style!.ink,bold:true},width-2*margin,2);
  const footer=await rasterLayoutText(plusVideoNeedsListening(input.source)?'原片编辑 · 保留原声':'原片编辑 · 无声成片',{font:input.font,size:footerSize,color:style!.ink});
  requireThat(footer.width<=width-2*margin,'PLUS_VIDEO_TEXT_CAPACITY','当前画面过窄，无法完整显示来源信息',422);
  let top=margin;
  if(b!.inherits_ai){const geometry=input.disclosure?.geometry??{reference_width:1080,margin:32,height:72};top=Math.ceil((geometry.margin+geometry.height)*Math.max(.5,width/geometry.reference_width))+gap;}
  const placements:{raster:TextRaster;left:number;top:number}[]=[];
  for(const line of title){placements.push({raster:line,left:margin,top});top+=Math.ceil(titleSize*1.35);}
  const cueHeight=Math.ceil(captionSize*1.45)*2,captionTop=height-margin-footer.height-gap-cueHeight;
  const videoTop=Math.ceil((top+gap)/2)*2,videoWidth=Math.floor((width-margin*2)/2)*2,videoHeight=Math.floor((captionTop-gap-videoTop)/2)*2;
  requireThat(videoWidth>=64&&videoHeight>=64,'PLUS_VIDEO_TEXT_CAPACITY','标题与字幕区域挤占视频，请缩短标题或增大画面',422);
  placements.push({raster:footer,left:margin,top:height-margin-footer.height});
  const cues=[];
  for(const cue of b!.settings.captions){
    const lines=await wrapLayoutText(cue.text,{font:input.font,size:captionSize,color:style!.ink,bold:true},width-margin*2,2);
    let y=0;const composite=[];
    for(const line of lines){composite.push({input:line.png,left:0,top:y});y+=Math.ceil(captionSize*1.45);}
    const png=await sharp({create:{width:width-margin*2,height:cueHeight,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite(composite).png().toBuffer();
    cues.push({...cue,png});
  }
  const frame=await sharp({create:{width,height,channels:3,background:style!.bg}})
    .composite(placements.map(p=>({input:p.raster.png,left:p.left,top:p.top}))).png().toBuffer();
  return {width,height,margin,captionTop,videoTop,videoWidth,videoHeight,frame,cues};
}

