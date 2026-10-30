import {it,expect} from 'vitest';
import sharp from 'sharp';
import {variant,rawProfile} from '../helpers/fixtures';
import {hash,addSeconds,id} from '../../src/api/lib/crypto';
import {config} from '../../src/api/config';
import {derivePlusSource,type PlusRenderBinding,PLUS_RENDER_PIXELS} from '../../src/shared/domain/plus-render';
import {basePlan} from '../../src/worker/compiler/plan';
import {freezeAiDisclosure,frozenAiDisclosure} from '../../src/worker/compiler/disclosure';
import type {FrozenContract} from '../../src/worker/compiler/snapshot';
import {FONT_BINDING,loadProductionFont} from '../../src/worker/media/font';
import {renderPlusImage,preparePlusLayoutText} from '../../src/worker/media/plus-image';
import {disclosureRaster,markDisclosureImage,inspectDisclosure} from '../../src/worker/media/disclosure';

function input(width:number,height:number,ai=false){
  const base=variant(),settings={crop:{x:.5,y:0,width:.5,height:1},canvas:{width,height},title:'蓝色杯',brand:'',facts:[]};
  const b:PlusRenderBinding={version:'YPCC-PLUS-IMAGE-1',draft_id:'synthetic_draft',draft_revision:1,settings,settings_hash:hash(settings),
    source_order_id:'synthetic_parent',source_product_id:'synthetic_product',source_manifest_id:'synthetic_manifest',source_manifest_revision:1,
    source_manifest_hash:'a'.repeat(64),source_artifact_id:'synthetic_image',source_sha256:'b'.repeat(64),source_bytes:100,source_width:800,source_height:1000,
    source_object_key:'synthetic/image.png',source_contract_hash:'c'.repeat(64),source_expires_at:addSeconds(3600),inherits_ai:ai,
    base_source_hash:hash(base),pricing:{amount_fen:200,version:'SYNTHETIC-1'}};
  const source=derivePlusSource(base,b),plan=basePlan(rawProfile(),source);
  return {source,plan,presetId:'minimal-clean'};
}
it('applies the selected crop and delivers a real small PNG within the exact requested canvas',async()=>{
  const i=input(256,384),font=await loadProductionFont(process.cwd());
  const source=await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000"><path fill="red" d="M0 0h400v1000H0z"/><path fill="blue" d="M400 0h400v1000H400z"/></svg>')).png().toBuffer();
  const result=await renderPlusImage(source,{...i,font}),layout=await preparePlusLayoutText({...i,font});
  expect(await sharp(result).metadata()).toMatchObject({format:'png',width:256,height:384,hasAlpha:false});
  const pixel=await sharp(result).extract({left:128,top:layout.imageTop+Math.floor(layout.imageHeight/2),width:1,height:1}).raw().toBuffer();
  expect([...pixel]).toEqual([0,0,255]);
});
it('preserves a verifiable visible AI mark on a 2160 by 3840 edited image',async()=>{
  const i=input(2160,3840,true),font=await loadProductionFont(process.cwd()),cfg=config();
  const c={source:i.source,creative:i.plan,plan_hash:hash(i.plan),resource_versions:[FONT_BINDING]} as FrozenContract;
  freezeAiDisclosure(c);const policy=frozenAiDisclosure(c)!;expect(policy.rendering_profile).toBe('PLUS_IMAGE_V1');
  const source=await sharp({create:{width:800,height:1000,channels:3,background:'blue'}}).png().toBuffer();
  const image=await renderPlusImage(source,{...i,font,disclosure:policy}),raster=await disclosureRaster(cfg,policy,2160,3840);
  const marked=await markDisclosureImage(image,raster,PLUS_RENDER_PIXELS);
  const proof=await inspectDisclosure(cfg,policy,marked,{kind:'image',width:2160,height:3840,frames:1,directory:`runtime/tmp/${id('plus_disclosure')}`,deadline_at:addSeconds(30),signal:new AbortController().signal});
  expect(proof.frames_checked).toBe(1);expect(proof.contract_hash).toBe(hash(policy));
});
it('rejects overflowing edited text before payment rather than trimming the request',async()=>{
  const i=input(256,256),font=await loadProductionFont(process.cwd());i.plan.copy='蓝色商品'.repeat(40);
  await expect(preparePlusLayoutText({...i,font})).rejects.toMatchObject({code:'LAYOUT_TEXT_OVERFLOW'});
});
