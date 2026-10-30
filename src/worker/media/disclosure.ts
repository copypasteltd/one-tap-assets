import {mkdir,mkdtemp,readFile,rm,writeFile,stat} from 'node:fs/promises';
import {join} from 'node:path';
import sharp from 'sharp';
import {inside,type Config} from '../../api/config.js';
import {hash,sha256} from '../../api/lib/crypto.js';
import {requireThat} from '../../api/lib/errors.js';
import type {AiDisclosureContract} from '../compiler/disclosure.js';
import {loadProductionFont} from './font.js';
import {nativeCommand} from './native.js';
import {PLUS_RENDER_PIXELS} from '../../shared/domain/plus-render.js';

export interface DisclosureRaster {png:Buffer;left:number;top:number;width:number;height:number}
export interface AiDisclosureProof {
  version:'YPCC-VISIBLE-AI-PIXELS-1';contract_hash:string;output_sha256:string;raster_sha256:string;
  region:{left:number;top:number;width:number;height:number};frames_checked:number;
  pixels_sha256:string;max_mean_abs_error:number;min_foreground_match:number;
}
export async function disclosureRaster(cfg:Config,policy:AiDisclosureContract,width:number,height:number):Promise<DisclosureRaster>{
  const plus=policy.rendering_profile==='PLUS_IMAGE_V1';
  requireThat(Number.isSafeInteger(width)&&Number.isSafeInteger(height)&&(plus?width>=256&&width<=3840&&height>=256&&height<=3840&&width*height<=PLUS_RENDER_PIXELS:
    width>=640&&width<=1920&&height>=640&&height<=1920),
    'AI_DISCLOSURE_SPEC_INVALID','AI标识图片尺寸无效',422);
  const font=await loadProductionFont(cfg.projectRoot);
  requireThat(hash(font.binding)===hash(policy.font)&&Array.from(policy.text).every(c=>font.supports(c.codePointAt(0)!)),
    'AI_DISCLOSURE_FONT_CHANGED','AI标识字体不属于原冻结许可',503);
  const scale=plus?Math.max(.5,width/policy.geometry.reference_width):width/policy.geometry.reference_width,w=Math.round(policy.geometry.width*scale),h=Math.round(policy.geometry.height*scale),margin=Math.round(policy.geometry.margin*scale);
  const glyph=await sharp({text:{text:`<span foreground="${policy.colors.foreground}" fallback="false">${policy.text}</span>`,
    font:`Noto Sans SC Bold ${Math.round(policy.geometry.font_size*scale)}`,fontfile:font.path,rgba:true,dpi:72}}).png().toBuffer({resolveWithObject:true});
  requireThat(glyph.info.width<w-16&&glyph.info.height<h-12,'AI_DISCLOSURE_SPEC_INVALID','AI标识文字溢出',422);
  const png=await sharp({create:{width:w,height:h,channels:3,background:policy.colors.background}}).composite([{input:glyph.data,
    left:Math.floor((w-glyph.info.width)/2),top:Math.floor((h-glyph.info.height)/2)}]).png().toBuffer();
  return {png,left:margin,top:margin,width:w,height:h};
}
export async function markDisclosureImage(bytes:Buffer,raster:DisclosureRaster,maxPixels=4_000_000):Promise<Buffer>{
  return sharp(bytes,{limitInputPixels:maxPixels,failOn:'warning'}).composite([{input:raster.png,left:raster.left,top:raster.top}]).png().toBuffer();
}
/** Full-frame-count crop decode, not sampled frames, metadata or OCR claims.
 * The opaque fixed raster permits a bounded comparison after H264 encoding. */
export async function inspectDisclosure(cfg:Config,policy:AiDisclosureContract,bytes:Buffer,options:{kind:'image'|'video';width:number;height:number;
  frames:number;directory:string;deadline_at:string;signal:AbortSignal}):Promise<AiDisclosureProof>{
  const alive=()=>requireThat(!options.signal.aborted&&Date.parse(options.deadline_at)>Date.now(),
    'AI_DISCLOSURE_INTERRUPTED','AI标识检查已取消或超过原截止',409);
  alive();const raster=await disclosureRaster(cfg,policy,options.width,options.height),{left,top,width,height}=raster;
  let actual:Buffer,expected:Buffer,frames=options.kind==='image'?1:options.frames;
  requireThat(Number.isSafeInteger(frames)&&frames>0&&frames<=3600,'AI_DISCLOSURE_CAPACITY_UNAVAILABLE','必须检查全部实际帧',422);
  if(options.kind==='image'){
    // Compare RGBA, including opaque alpha: invisible RGB must never certify a visible mark.
    const region=await sharp(bytes,{limitInputPixels:policy.rendering_profile==='PLUS_IMAGE_V1'?PLUS_RENDER_PIXELS:4_000_000,failOn:'warning'}).extract({left,top,width,height}).ensureAlpha().raw().toBuffer();
    const original=await sharp(raster.png).ensureAlpha().raw().toBuffer();
    requireThat(region.equals(original),'AI_DISCLOSURE_PIXELS_MISSING','实际交付图片缺少完整AI标识',422);
    actual=region;expected=original;
  }else{
    const parent=inside(cfg.runtimeRoot,options.directory);await mkdir(parent,{recursive:true});const directory=await mkdtemp(join(parent,'disclosure-scan-'));
    try{
      await writeFile(join(directory,'input.mp4'),bytes,{flag:'wx'});
      const output=join(directory,'crop.gray'),size=width*height*frames;
      requireThat(size<=96_000_000,'AI_DISCLOSURE_CAPACITY_UNAVAILABLE','完整标识像素超出处理容量',422);
      await nativeCommand(cfg,process.env.FFMPEG_PATH?.trim()||'ffmpeg',['-v','error','-xerror','-nostdin','-n','-threads','2','-filter_threads','1',
        '-protocol_whitelist','file,pipe','-i',join(directory,'input.mp4'),'-map','0:v:0','-an','-vf',`crop=${width}:${height}:${left}:${top},format=gray`,
        '-fps_mode','passthrough','-frames:v',String(frames+1),'-pix_fmt','gray','-f','rawvideo',output],
      {cwd:directory,timeoutMs:Math.max(1,Math.min(120000,Date.parse(options.deadline_at)-Date.now())),signal:options.signal});
      requireThat((await stat(output)).size===size,'AI_DISCLOSURE_FRAME_COUNT_INVALID','标识检查没有覆盖恰好全部实际帧',422);
      actual=await readFile(output);expected=await sharp(raster.png).greyscale().raw().toBuffer();
    }finally{await rm(directory,{recursive:true,force:true});}
  }
  const stride=expected.length;let maxError=0,minMatch=1;
  for(let f=0;f<frames;f++){
    alive();let error=0,foreground=0,matched=0;
    for(let i=0;i<stride;i++){const e=expected[i]!,a=actual[f*stride+i]!;error+=Math.abs(a-e);if(e>=180){foreground++;if(a>=150)matched++;}}
    requireThat(foreground>100,'AI_DISCLOSURE_RASTER_INVALID','AI标识缺少实际可见字形',503);
    const mean=error/stride,match=matched/foreground;maxError=Math.max(maxError,mean);minMatch=Math.min(minMatch,match);
    requireThat(mean<=12&&match>=.94,'AI_DISCLOSURE_PIXELS_MISSING','实际视频至少一帧缺少完整可见AI标识',422);
  }
  return {version:'YPCC-VISIBLE-AI-PIXELS-1',contract_hash:hash(policy),output_sha256:sha256(bytes),raster_sha256:sha256(raster.png),
    region:{left,top,width,height},frames_checked:frames,pixels_sha256:sha256(actual),
    max_mean_abs_error:Math.round(maxError*1e6)/1e6,min_foreground_match:Math.round(minMatch*1e6)/1e6};
}
