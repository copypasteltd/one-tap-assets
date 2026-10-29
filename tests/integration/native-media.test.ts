import { it, expect } from 'vitest';
import sharp from 'sharp';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { resolve, join } from 'node:path';
import type { Config } from '../../src/api/config.js';
import { prepareLayoutText,renderLayout, STYLES } from '../../src/worker/media/layout.js';
import {loadProductionFont} from '../../src/worker/media/font.js';
import {normalizeLayoutText,wrapLayoutText} from '../../src/worker/media/text-layout.js';
import {validatePlanLayout} from '../../src/worker/media/plan-layout.js';
import { renderPhotoVideo } from '../../src/worker/media/photo-video.js';
import { sha256 } from '../../src/api/lib/crypto.js';
import { basePlan } from '../../src/worker/compiler/plan.js';
import { profile, variant } from '../helpers/fixtures.js';
it('refuses both formerly clipped suffixes and unsupported glyphs beyond the old cut-off',async()=>{
  const photo=await sharp({create:{width:320,height:320,channels:3,background:'#8BB8C2'}}).png().toBuffer();
  const options={presetId:'minimal-clean',width:1080,height:1080,title:'蓝色带盖杯',subtitle:'商品实拍',sequence:1,total:4};
  for(const field of ['title','subtitle'] as const)for(const suffix of ['甲','乙']){
    await expect(renderLayout(photo,{...options,[field]:'蓝色带盖杯'.repeat(30)+suffix})).rejects.toMatchObject({code:'LAYOUT_TEXT_OVERFLOW'});
  }
  await expect(renderLayout(photo,{...options,subtitle:'蓝色带盖杯'.repeat(30)+String.fromCodePoint(0x10ffff)}))
    .rejects.toMatchObject({code:'FONT_GLYPH_UNAVAILABLE'});
});
it('preserves complete mixed-language copy with measured glyph wrapping and escaped markup',async()=>{
  const font=await loadProductionFont(process.cwd()),copy='WWWWiiii 杯盖<&> 蓝色 ABCD 真实商品细节 最后一句甲';
  const lines=await wrapLayoutText(copy,{font,size:30,color:'#263B32'},360,3);
  expect(lines.length).toBeGreaterThan(1);expect(lines.map(l=>l.text).join('')).toBe(copy);
  expect(lines.at(-1)!.text.endsWith('甲')).toBe(true);
  for(const line of lines){const m=await sharp(line.png).metadata();expect(m.width).toBe(line.width);expect(line.width).toBeLessThanOrEqual(360);}
  const p=profile(),source=variant(),plan=basePlan(p,source);plan.shots[0]!.intent='蓝色带盖杯'.repeat(30);
  await expect(validatePlanLayout(plan,source,'minimal-clean',font)).rejects.toMatchObject({code:'LAYOUT_TEXT_OVERFLOW'});
  source.creative_components={...source.creative_components,platform_style_id:'launch-story'};
  await expect(validatePlanLayout(basePlan(p,source),source,'community-preset-with-no-built-in-style',font)).resolves.toBeUndefined();
});
it('renders every complete line clear of chapter, footer and AI mark in all ten square and portrait styles',async()=>{
  const font=await loadProductionFont(process.cwd()),title='蓝色带盖杯的真实商品细节和完整外观末字甲';
  const subtitle='这一件商品可以看见蓝色杯身和完整杯盖请观察照片中的整体外观与细节末字乙';
  const photo=await sharp({create:{width:320,height:320,channels:3,background:'#2675A4'}}).png().toBuffer();
  for(const presetId of Object.keys(STYLES))for(const height of [1080,1920]){
    const options={presetId,width:1080,height,title,subtitle,sequence:1,total:4,font,aiLabel:true};
    const layout=await prepareLayoutText(options),bytes=await renderLayout(photo,options);
    const full=await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    for(const kind of ['TITLE','SUBTITLE'] as const){
      const lines=layout.text.filter(t=>t.kind===kind);
      expect(lines.map(t=>t.text).join('')).toBe(normalizeLayoutText(kind==='TITLE'?title:subtitle));
      expect(lines.at(-1)!.text.endsWith(kind==='TITLE'?'甲':'乙')).toBe(true);
    }
    for(const line of layout.text){
      const raster=await sharp(line.png).ensureAlpha().raw().toBuffer();let opaque=0;
      for(let y=0;y<line.height;y++)for(let x=0;x<line.width;x++){
        const n=(y*line.width+x)*4;if(raster[n+3]!==255)continue;opaque++;
        const at=((y+line.top)*full.info.width+x+line.left)*4;
        expect(full.data.subarray(at,at+4)).toEqual(raster.subarray(n,n+4));
      }
      expect(opaque).toBeGreaterThan(20);
      // The actual glyph bounding rectangles must clear the painted AI label.
      expect(line.top>=128||line.left>=256||line.top+line.height<=32).toBe(true);
    }
    const centre=await sharp(bytes).extract({left:540,top:Math.floor(layout.top+layout.imgH/2),width:1,height:1}).removeAlpha().raw().toBuffer();
    expect([...centre]).toEqual([38,117,164]);
  }
});
it('renders ten different original-photo layouts and decodes a native 30fps portrait video', async () => {
  const path = resolve('runtime/test-media', randomUUID()); await mkdir(path, { recursive: true });
  const cfg = { runtimeRoot: resolve('runtime') } as Config;
  const photo = await sharp({ create: { width: 800, height: 1000, channels: 3, background: '#2675A4' } }).png().toBuffer();
  const rendered: string[] = [];
  try {
    for (const presetId of Object.keys(STYLES)) {
      const bytes = await renderLayout(photo, { presetId, width: 1080, height: 1080, title: '蓝色带盖杯', subtitle: '可见蓝色 · 带杯盖', sequence: 1, total: 4 });
      const meta = await sharp(bytes).metadata(); expect(meta.width).toBe(1080); expect(meta.height).toBe(1080); expect(meta.format).toBe('png'); expect(meta.exif).toBeUndefined();
      // The original photograph remains visible without generative replacement.
      const pixel = await sharp(bytes).extract({ left: 540, top: 540, width: 1, height: 1 }).removeAlpha().raw().toBuffer(); expect([...pixel]).toEqual([38, 117, 164]);
      rendered.push(sha256(bytes)); await writeFile(join(path, `${presetId}.png`), bytes);
    }
    expect(new Set(rendered).size).toBe(10);
    const p = profile(); const plan = basePlan(p, variant()); plan.target_frames = 30;
    plan.shots = [{ ...plan.shots[0]!, start_frame: 0, end_frame: 30 }];
    const output = await renderPhotoVideo(cfg, { directory: path, plan, presetId: 'minimal-clean', photos: new Map(p.photo_roles.map(r => [r.asset_id, photo])), deadlineAt: new Date(Date.now() + 90000).toISOString() });
    expect(output.inspection).toMatchObject({ codec: 'h264', pixelFormat: 'yuv420p', fps: 30, frames: 30, width: 1080, height: 1920, hasAudio: false });
    // This is a synthetic smoke result, not a 14-variant customer-quality run.
  } finally { await rm(path, { recursive: true, force: true }); }
});
