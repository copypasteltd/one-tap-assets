import {beforeAll,afterAll,it,expect} from 'vitest';
import {mkdir,readFile,readdir,rm,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {existsSync} from 'node:fs';
import {loadEnvFile} from 'node:process';
import sharp from 'sharp';
import {variant} from '../helpers/fixtures.js';
import {hash,id,sha256,addSeconds} from '../../src/api/lib/crypto.js';
import {inside,config,type Config} from '../../src/api/config.js';
import type {FrozenContract} from '../../src/worker/compiler/snapshot.js';
import {freezeAiDisclosure} from '../../src/worker/compiler/disclosure.js';
import {FONT_BINDING} from '../../src/worker/media/font.js';
import {disclosureRaster,markDisclosureImage,inspectDisclosure} from '../../src/worker/media/disclosure.js';
import {nativeCommand,inspectVideo} from '../../src/worker/media/native.js';

// Actual pixels, pinned glyphs and complete 15s/450-frame 1080p video.
// Self-drawn fixtures; no external model, person, speech or platform certification.
let cfg:Config,root:string,c:FrozenContract;
beforeAll(async()=>{
  if(existsSync('.env.local'))loadEnvFile('.env.local');process.env.APP_ENV='test';
  cfg=config({env:'test',devMode:true,paymentsEnabled:false,generationEnabled:false,publishingEnabled:false});
  root=inside(cfg.runtimeRoot,`tests/disclosure/${id('fixture')}`);await mkdir(root,{recursive:true});
  c={source:structuredClone(variant('portrait-social.ai-presenter-multi')),plan_hash:'a'.repeat(64),resource_versions:[{...FONT_BINDING}],creative:{target_frames:450}} as FrozenContract;
  freezeAiDisclosure(c);
});
afterAll(async()=>{if(root)await rm(inside(cfg.runtimeRoot,root),{recursive:true,force:true});});
const options=(kind:'image'|'video',width=1080,height=1920)=>({kind,width,height,frames:450,directory:root,deadline_at:addSeconds(120),signal:new AbortController().signal});
it('checks real image glyph pixels and refuses an absent mark or an empty lookalike rectangle',async()=>{
  const input=await sharp({create:{width:1080,height:1440,channels:3,background:'#E89038'}}).png().toBuffer();
  const policy=c.ai_disclosure_contract!,raster=await disclosureRaster(cfg,policy,1080,1440),marked=await markDisclosureImage(input,raster);
  const proof=await inspectDisclosure(cfg,policy,marked,options('image',1080,1440));
  expect(proof).toMatchObject({contract_hash:hash(policy),output_sha256:sha256(marked),frames_checked:1,max_mean_abs_error:0,min_foreground_match:1});
  const empty=await sharp({create:{width:raster.width,height:raster.height,channels:3,background:policy.colors.background}}).png().toBuffer();
  const rgba=await sharp(marked).ensureAlpha().raw().toBuffer();
  for(let y=0;y<raster.height;y++)for(let x=0;x<raster.width;x++)rgba[((y+raster.top)*1080+x+raster.left)*4+3]=0;
  const invisible=await sharp(rgba,{raw:{width:1080,height:1440,channels:4}}).png().toBuffer();
  for(const bytes of [input,await markDisclosureImage(input,{...raster,png:empty}),invisible])await expect(inspectDisclosure(cfg,policy,bytes,options('image',1080,1440)))
    .rejects.toMatchObject({code:'AI_DISCLOSURE_PIXELS_MISSING'});
});
it('checks all 450 actual frames and rejects a single missing mark between one-second samples',async()=>{
  const policy=c.ai_disclosure_contract!,raster=await disclosureRaster(cfg,policy,1080,1920);
  const path=join(root,'mark.png');await writeFile(path,raster.png,{flag:'wx'});
  for(const missing of [false,true]){
    const output=join(root,missing?'one-frame-missing.mp4':'marked.mp4');
    await nativeCommand(cfg,process.env.FFMPEG_PATH?.trim()||'ffmpeg',['-v','error','-nostdin','-n','-threads','2','-filter_complex_threads','1',
      '-f','lavfi','-i','color=c=0x8AC5E2:s=1080x1920:r=30:d=15','-i',path,
      '-filter_complex',`[0:v][1:v]overlay=${raster.left}:${raster.top}:eof_action=repeat:format=auto${missing?":enable='not(eq(n,225))'":''}[out]`,
      '-map','[out]','-an','-frames:v','450','-c:v','libx264','-threads','2','-preset','veryfast','-crf','20','-pix_fmt','yuv420p',output],
    {cwd:root,timeoutMs:45000});
    expect(await inspectVideo(cfg,output)).toMatchObject({width:1080,height:1920,frames:450,fps:30});
    const scan=inspectDisclosure(cfg,policy,await readFile(output),options('video'));
    if(missing)await expect(scan).rejects.toMatchObject({code:'AI_DISCLOSURE_PIXELS_MISSING'});
    else expect(await scan).toMatchObject({frames_checked:450,contract_hash:hash(policy),version:'YPCC-VISIBLE-AI-PIXELS-1'});
  }
  expect((await readdir(root)).filter(p=>p.startsWith('disclosure-scan-'))).toEqual([]);
});
it('honors the original cancellation and deadline before creating a native process or scan directory',async()=>{
  const before=await readdir(root),controller=new AbortController();controller.abort();
  for(const extra of [{signal:controller.signal},{deadline_at:new Date(Date.now()-1).toISOString()}]){
    await expect(inspectDisclosure(cfg,c.ai_disclosure_contract!,Buffer.alloc(0),{...options('video'),...extra}))
      .rejects.toMatchObject({code:'AI_DISCLOSURE_INTERRUPTED'});
  }
  expect(await readdir(root)).toEqual(before);
});
