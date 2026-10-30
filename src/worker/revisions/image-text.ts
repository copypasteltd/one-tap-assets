import sharp from 'sharp';
import type {Config} from '../../api/config.js';
import {hash,sha256} from '../../api/lib/crypto.js';
import {requireThat} from '../../api/lib/errors.js';
import type {AiDisclosureContract} from '../compiler/disclosure.js';
import type {ResourceBinding} from '../compiler/snapshot.js';
import {FONT_BINDING,loadProductionFont} from '../media/font.js';
import {wrapLayoutText} from '../media/text-layout.js';
import {disclosureRaster,markDisclosureImage} from '../media/disclosure.js';

export interface ImageTextPolicy {
  version:'YPCC-IMAGE-TEXT-1';max_chars:28;max_lines:2;panel_fraction:0.22;
  font:ResourceBinding;background:string;ink:string;accent:string;
}
export interface ImageTextProof {
  version:'YPCC-IMAGE-TEXT-1';policy_hash:string;source_id:string;source_sha256:string;
  text:string;lines:string[];width:number;height:number;picture_height:number;output_sha256:string;
}
export interface ImageTextOutput {
  artifact_id:string;object_key:string;sha256:string;size_bytes:number;slot_id:string;proof:ImageTextProof;
}
export function validateImageTextPolicy(p:ImageTextPolicy):void {
  requireThat(p?.version==='YPCC-IMAGE-TEXT-1'&&p.max_chars===28&&p.max_lines===2&&p.panel_fraction===0.22
    &&hash(p.font)===hash(FONT_BINDING)&&[p.background,p.ink,p.accent].every(c=>/^#[a-fA-F0-9]{6}$/.test(c)),
    'REVISION_IMAGE_POLICY_INVALID','原图片加字规格与固定字体不一致',503);
}
export function checkImageText(text:string,p:ImageTextPolicy):void {
  validateImageTextPolicy(p);
  requireThat(typeof text==='string'&&text===text.trim()&&text.length>0&&Array.from(text).length<=p.max_chars
    &&!/[\p{Cc}\p{Cf}\p{Cs}\p{Zl}\p{Zp}]/u.test(text)&&!/[<>]/.test(text),
    'REVISION_IMAGE_TEXT_INVALID','请输入不超过28字的单段标题，不含控制字符或标记',422);
}
/** Keeps the complete source inside a smaller picture region. No crop, remote
 * font, generated replacement or customer-provided HTML/SVG is accepted. */
export async function renderImageText(cfg:Config,input:{source_id:string;source:Buffer;text:string;policy:ImageTextPolicy;
  width:number;height:number;disclosure?:AiDisclosureContract}):Promise<{bytes:Buffer;proof:ImageTextProof}> {
  const {policy:p,width:w,height:h}=input;checkImageText(input.text,p);
  requireThat(Number.isSafeInteger(w)&&Number.isSafeInteger(h)&&w>=640&&h>=640&&w<=1920&&h<=1920,
    'REVISION_IMAGE_SPEC_INVALID','原图片规格不支持加字',422);
  const meta=await sharp(input.source,{limitInputPixels:4_000_000,failOn:'warning'}).metadata();
  requireThat(meta.format==='png'&&meta.width===w&&meta.height===h&&(!meta.pages||meta.pages===1),
    'REVISION_IMAGE_SOURCE_INVALID','加字必须读取原清单登记的完整PNG',422);
  const font=await loadProductionFont(cfg.projectRoot);requireThat(hash(font.binding)===hash(p.font),'FONT_RESOURCE_CHANGED','原加字字体不可替换',503);
  const pictureHeight=Math.floor(h*(1-p.panel_fraction)),margin=Math.round(w*0.055),size=Math.round(w*0.048);
  const lines=await wrapLayoutText(input.text,{font,size,color:p.ink,bold:true},w-margin*2,p.max_lines);
  const source=await sharp(input.source).resize(w,pictureHeight,{fit:'contain',background:p.background}).png().toBuffer();
  const lineHeight=Math.ceil(size*1.35),start=pictureHeight+Math.floor((h-pictureHeight-lines.length*lineHeight)/2);
  requireThat(lines.length>0&&lines.map(l=>l.text).join('')===input.text&&start>pictureHeight
    &&lines.every((l,i)=>start+i*lineHeight+l.height<h-margin/2),'REVISION_IMAGE_TEXT_OVERFLOW','完整标题超出原加字区域，不能截断',422);
  const accent=await sharp({create:{width:w,height:Math.max(2,Math.round(w*0.004)),channels:3,background:p.accent}}).png().toBuffer();
  let bytes:Buffer=await sharp({create:{width:w,height:h,channels:3,background:p.background}}).composite([
    {input:source,left:0,top:0},{input:accent,left:0,top:pictureHeight},
    ...lines.map((l,i)=>({input:l.png,left:margin,top:start+i*lineHeight})),
  ]).png().toBuffer();
  if(input.disclosure)bytes=await markDisclosureImage(bytes,await disclosureRaster(cfg,input.disclosure,w,h));
  return {bytes,proof:{version:p.version,policy_hash:hash(p),source_id:input.source_id,source_sha256:sha256(input.source),
    text:input.text,lines:lines.map(l=>l.text),width:w,height:h,picture_height:pictureHeight,output_sha256:sha256(bytes)}};
}
