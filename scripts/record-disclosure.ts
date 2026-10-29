import {mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {existsSync} from 'node:fs';
import {loadEnvFile} from 'node:process';
import sharp from 'sharp';
import {hash,id,sha256,addSeconds} from '../src/api/lib/crypto.js';
import {config} from '../src/api/config.js';
import {variant} from '../tests/helpers/fixtures.js';
import type {FrozenContract} from '../src/worker/compiler/snapshot.js';
import {freezeAiDisclosure} from '../src/worker/compiler/disclosure.js';
import {FONT_BINDING,loadProductionFont} from '../src/worker/media/font.js';
import {renderLayout} from '../src/worker/media/layout.js';
import {disclosureRaster,markDisclosureImage,inspectDisclosure} from '../src/worker/media/disclosure.js';
import {nativeCommand,inspectVideo} from '../src/worker/media/native.js';

// Development-only self-drawn pixel demonstration. No browser, customer data,
// provider, payment, speech or generative-video claim; never change the C board.
if(existsSync('.env.local'))loadEnvFile('.env.local');process.env.APP_ENV='test';
const cfg=config({env:'test',devMode:true,paymentsEnabled:false,generationEnabled:false,publishingEnabled:false}),directory=join(cfg.runtimeRoot,'disclosure-capture',id('fixture'));
const target='docs/media/ai-disclosure',files:{path:string;bytes:number;sha256:string}[]=[];
await mkdir(directory,{recursive:true});
try{
  const contract={source:structuredClone(variant('portrait-social.ai-presenter-multi')),plan_hash:hash('SYNTHETIC_DISCLOSURE_CAPTURE'),
    resource_versions:[{...FONT_BINDING}],creative:{target_frames:450}} as FrozenContract;
  freezeAiDisclosure(contract);const policy=contract.ai_disclosure_contract!,font=await loadProductionFont(cfg.projectRoot);
  const photo=await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1440"><rect width="1080" height="1440" fill="#F6E5CE"/><ellipse cx="540" cy="1130" rx="240" ry="44" fill="#DECBB4"/><rect x="365" y="440" width="350" height="660" rx="66" fill="#E58A37"/><rect x="350" y="400" width="380" height="115" rx="40" fill="#263B32"/><path d="M715 580 Q960 560 900 840 Q860 940 715 870" fill="none" stroke="#C86F2E" stroke-width="64"/><rect x="420" y="630" width="240" height="240" rx="20" fill="#FFFAEE"/></svg>')).png().toBuffer();
  const image=await markDisclosureImage(await renderLayout(photo,{presetId:'portrait-social',width:1080,height:1440,title:'合成示例商品',
    subtitle:'自绘素材 · 可见标识像素检查',sequence:1,total:1,aiLabel:true,font}),await disclosureRaster(cfg,policy,1080,1440));
  const imageProof=await inspectDisclosure(cfg,policy,image,{kind:'image',width:1080,height:1440,frames:1,directory,deadline_at:addSeconds(120),signal:new AbortController().signal});
  const canvas=await sharp(photo).resize(1080,1920,{fit:'contain',background:'#FFFAEE'}).png().toBuffer();
  const mark=await disclosureRaster(cfg,policy,1080,1920);await writeFile(join(directory,'source.png'),canvas,{flag:'wx'});await writeFile(join(directory,'mark.png'),mark.png,{flag:'wx'});
  const video=join(directory,'video.mp4');
  await nativeCommand(cfg,process.env.FFMPEG_PATH?.trim()||'ffmpeg',['-v','error','-nostdin','-n','-threads','2','-filter_complex_threads','1',
    '-loop','1','-framerate','30','-i',join(directory,'source.png'),'-i',join(directory,'mark.png'),
    '-filter_complex',`[0:v][1:v]overlay=${mark.left}:${mark.top}:eof_action=repeat:format=auto[out]`,'-map','[out]','-an','-frames:v','450',
    '-c:v','libx264','-threads','2','-preset','veryfast','-crf','20','-pix_fmt','yuv420p','-movflags','+faststart',video],{cwd:directory,timeoutMs:60000});
  const videoBytes=await readFile(video),inspection=await inspectVideo(cfg,video),videoProof=await inspectDisclosure(cfg,policy,videoBytes,
    {kind:'video',width:1080,height:1920,frames:450,directory,deadline_at:addSeconds(120),signal:new AbortController().signal});
  await nativeCommand(cfg,process.env.FFMPEG_PATH?.trim()||'ffmpeg',['-v','error','-nostdin','-n','-i',video,'-vf','select=eq(n\\,225)',
    '-frames:v','1',join(directory,'frame.png')],{cwd:directory,timeoutMs:30000});
  await nativeCommand(cfg,process.env.FFMPEG_PATH?.trim()||'ffmpeg',['-v','error','-nostdin','-n','-filter_complex_threads','1','-i',video,
    '-filter_complex','[0:v]fps=4,scale=360:-1:flags=lanczos,split[a][b];[a]palettegen[p];[b][p]paletteuse',
    '-loop','0',join(directory,'preview.gif')],{cwd:directory,timeoutMs:30000});
  await mkdir(target,{recursive:true});
  for(const [name,bytes] of [['image.png',image],['video.mp4',videoBytes],['frame.png',await readFile(join(directory,'frame.png'))],['preview.gif',await readFile(join(directory,'preview.gif'))]] as const){
    const path=`${target}/${name}`;await writeFile(path,bytes);files.push({path,bytes:bytes.length,sha256:sha256(bytes)});
  }
  const sourceFiles=['scripts/record-disclosure.ts','src/worker/compiler/disclosure.ts','src/worker/media/disclosure.ts','src/worker/media/layout.ts'];
  const manifest={type:'SYNTHETIC_DISCLOSURE_PIXEL_FIXTURE',created_at:new Date().toISOString(),data_source:'PROJECT_SELF_DRAWN_SVG_AND_STATIC_NATIVE_VIDEO',
    browser_used:false,external_model_used:false,real_generation_verified:false,real_speech_verified:false,host_or_legal_marking_admitted:false,
    full_product_verified:false,production_admitted:false,frames:450,contract:policy,image_proof:imageProof,video_proof:videoProof,inspection,
    source_files:await Promise.all(sourceFiles.map(async path=>({path,sha256:sha256(await readFile(path))}))),files};
  await writeFile(`${target}/capture-manifest.json`,JSON.stringify(manifest,null,2)+'\n');
  process.stdout.write(JSON.stringify({files:files.length,frames:videoProof.frames_checked,image_checked:imageProof.frames_checked,browser_used:false,production_admitted:false})+'\n');
}finally{await rm(directory,{recursive:true,force:true});}
