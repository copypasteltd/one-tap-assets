import {it,expect} from 'vitest';
import sharp from 'sharp';
import {renderImageText,checkImageText,type ImageTextPolicy} from '../../src/worker/revisions/image-text.js';
import {FONT_BINDING} from '../../src/worker/media/font.js';
import {hash,sha256} from '../../src/api/lib/crypto.js';
import {validate} from '../../src/api/lib/validation.js';
import {checkedRevisionChange} from '../../src/worker/revisions/context.js';
import type {Config} from '../../src/api/config.js';
import type {FrozenContract} from '../../src/worker/compiler/snapshot.js';
const policy:ImageTextPolicy={version:'YPCC-IMAGE-TEXT-1',max_chars:28,max_lines:2,panel_fraction:0.22,
  font:{...FONT_BINDING},background:'#FAFBF8',ink:'#263B32',accent:'#9BB6A5'};

it('renders a real title below the complete four-corner source without cropping or changing dimensions',async()=>{
  const tiles=await Promise.all(['#ff0000','#00ff00','#0000ff','#ffff00'].map(background=>sharp({create:{width:540,height:540,channels:3,background}}).png().toBuffer()));
  const source=await sharp({create:{width:1080,height:1080,channels:3,background:'white'}}).composite(tiles.map((input,i)=>({input,left:i%2*540,top:Math.floor(i/2)*540}))).png().toBuffer();
  const result=await renderImageText({projectRoot:process.cwd()} as Config,{source_id:'original',source,text:'看得见的真实细节',policy,width:1080,height:1080});
  const raw=await sharp(result.bytes).removeAlpha().raw().toBuffer({resolveWithObject:true});
  expect([raw.info.width,raw.info.height]).toEqual([1080,1080]);
  const pixel=(x:number,y:number)=>[...raw.data.subarray((y*1080+x)*3,(y*1080+x)*3+3)];
  expect(pixel(130,10)).toEqual([255,0,0]);expect(pixel(950,10)).toEqual([0,255,0]);
  expect(pixel(130,830)).toEqual([0,0,255]);expect(pixel(950,830)).toEqual([255,255,0]);
  let ink=0;for(let y=860;y<1060;y++)for(let x=55;x<1020;x++){const c=pixel(x,y);if(c[0]!<100&&c[1]!<120&&c[2]!<120)ink++;}
  expect(ink).toBeGreaterThan(500);expect(result.proof.lines.join('')).toBe('看得见的真实细节');
  expect(result.proof.source_sha256).toBe(sha256(source));expect(result.proof.output_sha256).toBe(sha256(result.bytes));
  expect(result.proof.policy_hash).toBe(hash(policy));expect(result.bytes.equals(source)).toBe(false);
});
it('rejects hidden controls markup overflow and a substituted font before rendering',()=>{
  for(const text of ['','\u202e改写','第一行\n第二行','<script>','字'.repeat(29),'标题\u0000'])expect(()=>checkImageText(text,policy)).toThrow();
  expect(()=>checkImageText('完整商品标题', {...policy,font:{...policy.font,hash:'f'.repeat(64)}})).toThrow();
});
it('keeps IMAGE_TEXT mutually exclusive with copy cover and display order in the public schema',()=>{
  const good={kind:'IMAGE_TEXT',manifest_revision:1,image_text:{deliverable_id:'image_original',text:'真实细节'}};
  expect(()=>validate('RevisionRequest',good)).not.toThrow();
  for(const extra of [{display_text:'extra'},{cover_deliverable_id:'image_other'},{ordered_deliverable_ids:['image_original']}])
    expect(()=>validate('RevisionRequest',{...good,...extra})).toThrow();
  expect(()=>validate('RevisionRequest',{kind:'DISPLAY_TEXT',manifest_revision:1,display_text:'copy',image_text:good.image_text})).toThrow();
});
it('rejects image requests for historical orders without the optional frozen entitlement',()=>{
  const pack={order_id:'order',manifest_id:'manifest',manifest_revision:1,expires_at:'2030-01-01T00:00:00.000Z',items:[]};
  expect(()=>checkedRevisionChange(pack,{kind:'IMAGE_TEXT',manifest_revision:1,image_text:{deliverable_id:'image',text:'真实细节'}},{} as FrozenContract))
    .toThrowError(expect.objectContaining({code:'REVISION_IMAGE_TEXT_NOT_FROZEN'}));
});
