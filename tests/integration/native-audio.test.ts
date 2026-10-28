import {beforeAll,afterAll,it,expect} from 'vitest';
import {mkdir,readFile,readdir,rm,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import sharp from 'sharp';
import {inside} from '../../src/api/config.js';
import {id,sha256} from '../../src/api/lib/crypto.js';
import {insert} from '../../src/api/db/store.js';
import {FONT_BINDING} from '../../src/worker/media/font.js';
import {nativeCommand} from '../../src/worker/media/native.js';
import {decodeNativeAudio} from '../../src/worker/media/native-audio.js';
import {compileNativeCaptions,validateNativeTranscript,type CaptionStyle} from '../../src/worker/media/native-captions.js';
import {renderNativeAudioPost,compareEncodedMix,mixNativeBed,type NativeMusic} from '../../src/worker/media/native-audio-post.js';
import {syntheticAudioFixture} from '../helpers/audio.js';
import {testDatabase,type TestDatabase} from '../helpers/database.js';

let db:TestDatabase,root:string,fixture:Awaited<ReturnType<typeof syntheticAudioFixture>>,music:NativeMusic;
const command=process.env.FFMPEG_PATH?.trim()||'ffmpeg';
const execution=()=>({directory:root,deadline_at:new Date(Date.now()+110000).toISOString(),signal:new AbortController().signal});
beforeAll(async()=>{
  db=await testDatabase();root=inside(db.cfg.runtimeRoot,`tests/audio/${id('native')}`);await mkdir(root,{recursive:true});
  fixture=await syntheticAudioFixture(db.cfg,join(root,'fixture'));
  music={path:fixture.musicPath,binding:{resource_version_id:id('synthetic_music'),license_record_id:id('synthetic_license'),
    hash:sha256(await readFile(fixture.musicPath))},gain_db:-12,loop_to_timeline:false,ducking:true};
  await insert(db.pool,'resource_licenses',{id:music.binding.license_record_id,resource_id:music.binding.resource_version_id,version:'synthetic-1',
    data:{resource_hash:music.binding.hash,resource_version_id:music.binding.resource_version_id,license:'SYNTHETIC_TEST_TONE_NOT_CATALOG_MUSIC'}});
});
afterAll(async()=>{await db?.close();if(root)await rm(root,{recursive:true,force:true});});
const options=()=>({...execution(),path:fixture.path,source_sha256:fixture.source_sha256,target_frames:120,
  resources:[{...FONT_BINDING}],transcript:structuredClone(fixture.transcript),caption_style:'standard' as CaptionStyle});

it('decodes actual native PCM and measures signal windows without claiming speech or recognition',async()=>{
  const {pcm,evidence}=await decodeNativeAudio(db.cfg,{...options()});
  expect(evidence).toMatchObject({source_sha256:fixture.source_sha256,pcm_sha256:sha256(pcm),sample_rate:48000,channels:2,samples:192000,duration_ms:4000});
  expect(evidence.windows).toHaveLength(200);expect(evidence.active_ms).toBeGreaterThan(1900);expect(evidence.active_ms).toBeLessThan(2200);
  expect(evidence.windows.filter(w=>w.start_ms>=700&&w.end_ms<=1300).every(w=>w.rms_dbfs!==null&&w.rms_dbfs>-25)).toBe(true);
  expect(evidence.windows.filter(w=>w.start_ms>=1700&&w.end_ms<=2300).every(w=>w.rms_dbfs===null||w.rms_dbfs<-60)).toBe(true);
  expect(evidence.pcm_sha256).toBe(fixture.decoded.evidence.pcm_sha256);
  await expect(decodeNativeAudio(db.cfg,{...options(),source_sha256:'a'.repeat(64)})).rejects.toMatchObject({code:'AUDIO_SOURCE_HASH_MISMATCH'});
});

it.each(['missing','silent','short','multiple'] as const)('rejects %s native audio before any substitute or paid call',async(mode)=>{
  const path=join(root,`${mode}.mp4`),args=['-v','error','-nostdin','-n','-i',fixture.path];
  if(mode==='silent'||mode==='short')args.push('-f','lavfi','-i',mode==='silent'?'anullsrc=r=48000:cl=stereo':'sine=frequency=660:sample_rate=48000:duration=1');
  args.push('-map','0:v:0');if(mode==='multiple')args.push('-map','0:a:0','-map','0:a:0');
  else if(mode!=='missing')args.push('-map','1:a:0');
  args.push('-c:v','copy',...(mode==='missing'?['-an']:mode==='multiple'?['-c:a','copy']:['-c:a','aac']),'-t','4',path);
  await nativeCommand(db.cfg,command,args,{cwd:root,timeoutMs:30000});
  await expect(decodeNativeAudio(db.cfg,{...options(),path,source_sha256:sha256(await readFile(path))})).rejects.toMatchObject({code:
    mode==='missing'||mode==='multiple'?'NATIVE_AUDIO_STREAM_INVALID':mode==='silent'?'NATIVE_AUDIO_SIGNAL_INVALID':'NATIVE_AUDIO_TIMELINE_INVALID'});
});

it('binds captions to actual PCM and rejects silent-region, overlapping, invented-word and injected ASS timing',()=>{
  const audio=fixture.decoded.evidence,font=fixture.font;
  const reject=(change:(t:ReturnType<typeof options>['transcript'])=>void,code:string,style:CaptionStyle='standard')=>{
    const t=structuredClone(fixture.transcript);change(t);expect(()=>validateNativeTranscript(t,audio,font,style)).toThrow(expect.objectContaining({code}));
  };
  reject(t=>{t.pcm_sha256='b'.repeat(64);},'AUDIO_TRANSCRIPT_BINDING_INVALID');
  reject(t=>{t.segments[0]!.start_ms=1700;t.segments[0]!.end_ms=2100;delete t.segments[0]!.words;},'AUDIO_TRANSCRIPT_NO_SIGNAL');
  reject(t=>{t.segments[1]!.start_ms=1400;},'AUDIO_TRANSCRIPT_TIMELINE_INVALID');
  reject(t=>{t.segments[0]!.text='{\\p1}黑屏';},'CAPTION_TEXT_INVALID');
  reject(t=>{delete t.segments[0]!.words;},'CAPTION_WORD_TIMES_REQUIRED','karaoke');
  reject(t=>{t.segments[0]!.words![0]!.text='错误';},'CAPTION_WORD_TEXT_INVALID');
  const ass=compileNativeCaptions(fixture.transcript,audio,font,'karaoke');expect(ass.script).toContain('{\\k40}原声{\\k50}音轨');
});

it.each(['standard','bold','minimal','karaoke'] as CaptionStyle[])('burns %s Chinese captions at actual fixture times and retains the measured native track',async style=>{
  const result=await renderNativeAudioPost(db.pool,db.cfg,{...options(),caption_style:style});
  expect(result.inspection).toMatchObject({width:1080,height:1920,fps:30,frames:120,hasAudio:true,audioCodec:'aac'});
  expect(result.proof).toMatchObject({semantic_review:'NOT_PERFORMED',order_pipeline_connected:false,caption_style:style,
    native_audio:{pcm_sha256:fixture.decoded.evidence.pcm_sha256},music:null});
  expect(result.proof.encoded_mix_comparison.correlation).toBeGreaterThan(.98);
  const path=join(root,`caption-${style}.mp4`);await writeFile(path,result.bytes,{flag:'wx'});
  const crops:Buffer[]=[];
  for(const [name,seconds] of [['off',.2],['on',1],['pause',2]] as const){
    const frame=join(root,`${style}-${name}.png`);
    await nativeCommand(db.cfg,command,['-v','error','-nostdin','-n','-ss',String(seconds),'-i',path,'-frames:v','1',frame],{cwd:root,timeoutMs:30000});
    crops.push(await sharp(frame).extract({left:100,top:1580,width:880,height:230}).removeAlpha().raw().toBuffer());
  }
  const changed=(a:Buffer,b:Buffer)=>{let count=0;for(let i=0;i<a.length;i+=3)
    if(Math.abs(a[i]!-b[i]!)+Math.abs(a[i+1]!-b[i+1]!)+Math.abs(a[i+2]!-b[i+2]!)>100)count++;return count;};
  expect(changed(crops[1]!,crops[0]!)).toBeGreaterThan(200);expect(changed(crops[2]!,crops[0]!)).toBeLessThan(10);
});

it('mixes licensed synthetic music and actually ducks only the bed while preserving the original voice stem',async()=>{
  const base={...options(),resources:[{...FONT_BINDING},music.binding]};
  const duck=await renderNativeAudioPost(db.pool,db.cfg,{...base,music}),plain=await renderNativeAudioPost(db.pool,db.cfg,{...base,music:{...music,ducking:false}});
  const bed=(r:typeof duck,start:number,end:number)=>r.proof.music!.bed_analysis.windows.filter(w=>w.start_ms>=start&&w.end_ms<=end)
    .reduce((sum,w,_,all)=>sum+w.rms_dbfs!/all.length,0);
  expect(bed(duck,800,1300)).toBeLessThan(bed(plain,800,1300)-8);
  expect(Math.abs(bed(duck,2100,2300)-bed(plain,2100,2300))).toBeLessThan(1);
  expect(duck.proof.native_audio.pcm_sha256).toBe(plain.proof.native_audio.pcm_sha256);
  expect(duck.proof.encoded_mix_comparison.correlation).toBeGreaterThan(.98);
  expect(duck.proof.mix_pcm_sha256).not.toBe(plain.proof.mix_pcm_sha256);
  const amplitude=(pcm:Buffer,frequency:number)=>{
    let a=0,b=0;const start=48000*.8,end=48000*1.3;
    for(let sample=start;sample<end;sample++){
      const value=pcm.readInt16LE(sample*4)/32768,phase=2*Math.PI*frequency*sample/48000;a+=value*Math.cos(phase);b+=value*Math.sin(phase);
    }
    return 2*Math.hypot(a,b)/(end-start);
  };
  const outputPcm:Buffer[]=[];
  for(const [index,result] of [duck,plain].entries()){
    const path=join(root,`mixed-${index}.mp4`);await writeFile(path,result.bytes,{flag:'wx'});
    outputPcm.push((await decodeNativeAudio(db.cfg,{...options(),path,source_sha256:sha256(result.bytes)})).pcm);
  }
  const voiceRatio=amplitude(outputPcm[0]!,660)/amplitude(fixture.decoded.pcm,660);
  expect(voiceRatio).toBeGreaterThan(.96);expect(voiceRatio).toBeLessThan(1.04);
  expect(amplitude(outputPcm[0]!,220)).toBeLessThan(amplitude(outputPcm[1]!,220)*.4);
  expect(()=>compareEncodedMix(fixture.decoded.pcm,Buffer.alloc(fixture.decoded.pcm.length))).toThrow(expect.objectContaining({code:'AUDIO_POST_MIX_MISMATCH'}));
  const hot=Buffer.alloc(4);hot.writeInt16LE(32000,0);hot.writeInt16LE(32000,2);
  expect(()=>mixNativeBed(hot,hot,-6,false)).toThrow(expect.objectContaining({code:'AUDIO_POST_CLIPPING'}));
});

it('loops short licensed music only when that exact frozen policy permits it',async()=>{
  const path=join(root,'short-music.wav');
  await nativeCommand(db.cfg,command,['-v','error','-nostdin','-n','-i',fixture.musicPath,'-t','1','-c:a','pcm_s16le',path],{cwd:root,timeoutMs:30000});
  const binding={resource_version_id:id('short_music'),license_record_id:id('short_license'),hash:sha256(await readFile(path))};
  await insert(db.pool,'resource_licenses',{id:binding.license_record_id,resource_id:binding.resource_version_id,version:'synthetic-1',
    data:{resource_hash:binding.hash,resource_version_id:binding.resource_version_id}});
  const base={...options(),resources:[FONT_BINDING,binding],music:{...music,path,binding}};
  await expect(renderNativeAudioPost(db.pool,db.cfg,base)).rejects.toMatchObject({code:'MUSIC_TIMELINE_INVALID'});
  const loop=await renderNativeAudioPost(db.pool,db.cfg,{...base,music:{...base.music,loop_to_timeline:true}});
  expect(loop.proof.music).toMatchObject({loop_to_timeline:true,bed_analysis:{samples:192000}});
});

it('enforces frozen music rights, real file hashes and volume and rechecks revocation after processing',async()=>{
  await expect(renderNativeAudioPost(db.pool,db.cfg,{...options(),music})).rejects.toMatchObject({code:'MUSIC_CONTRACT_INVALID'});
  await expect(renderNativeAudioPost(db.pool,db.cfg,{...options(),resources:[FONT_BINDING,music.binding],music:{...music,gain_db:0}})).rejects.toMatchObject({code:'MUSIC_CONTRACT_INVALID'});
  const path=join(root,'changed-music.wav');await writeFile(path,Buffer.from('changed actual music'));
  await expect(renderNativeAudioPost(db.pool,db.cfg,{...options(),resources:[FONT_BINDING,music.binding],music:{...music,path}})).rejects.toMatchObject({code:'MUSIC_SOURCE_HASH_MISMATCH'});
  let reads=0;
  const query={query:async(...args:Parameters<typeof db.pool.query>)=>{
    const result=await db.pool.query(...args);
    if(typeof args[0]==='string'&&args[0].includes('SELECT data FROM resource_licenses')&&++reads===2)
      await db.pool.query('UPDATE resource_licenses SET revoked_at=now() WHERE id=$1',[music.binding.license_record_id]);
    return result;
  }} as unknown as typeof db.pool;
  try{await expect(renderNativeAudioPost(query,db.cfg,{...options(),resources:[FONT_BINDING,music.binding],music})).rejects.toMatchObject({code:'RESOURCE_LICENSE_UNAVAILABLE'});}
  finally{await db.pool.query('UPDATE resource_licenses SET revoked_at=NULL WHERE id=$1',[music.binding.license_record_id]);}
});

it('keeps the original deadline, handles cancellation and removes owned temporary jobs on failures',async()=>{
  const aborted=new AbortController();aborted.abort();
  await expect(renderNativeAudioPost(db.pool,db.cfg,{...options(),signal:aborted.signal})).rejects.toMatchObject({code:'NATIVE_ABORTED'});
  await expect(decodeNativeAudio(db.cfg,{...options(),deadline_at:new Date(Date.now()-1).toISOString()})).rejects.toMatchObject({code:'ORDER_DEADLINE_EXCEEDED'});
  const t=structuredClone(fixture.transcript);t.audio_evidence_hash='c'.repeat(64);
  await expect(renderNativeAudioPost(db.pool,db.cfg,{...options(),transcript:t})).rejects.toMatchObject({code:'AUDIO_TRANSCRIPT_BINDING_INVALID'});
  expect((await readdir(root)).some(name=>name.startsWith('decode-')||name.startsWith('audio-post-'))).toBe(false);
});

it('cancels an in-flight native job and deletes only its owned working directories',async()=>{
  const controller=new AbortController(),cancel=setTimeout(()=>controller.abort(),200);
  try{await expect(renderNativeAudioPost(db.pool,db.cfg,{...options(),signal:controller.signal})).rejects.toMatchObject({code:'NATIVE_ABORTED'});}
  finally{clearTimeout(cancel);}
  expect((await readdir(root)).some(name=>name.startsWith('audio-post-'))).toBe(false);
  expect((await readFile(fixture.path)).length).toBeGreaterThan(0);
});
