import {mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import sharp from 'sharp';
import {sha256,hash,id} from '../src/api/lib/crypto.js';
import {insert} from '../src/api/db/store.js';
import {FONT_BINDING} from '../src/worker/media/font.js';
import {nativeCommand,inspectVideo} from '../src/worker/media/native.js';
import {renderNativeAudioPost,type NativeMusic} from '../src/worker/media/native-audio-post.js';
import type {CaptionStyle} from '../src/worker/media/native-captions.js';
import {testDatabase} from '../tests/helpers/database.js';
import {syntheticAudioFixture} from '../tests/helpers/audio.js';

// Explicit development-only capture: no customer photos, provider calls or ASR.
const db=await testDatabase(),directory=join(db.cfg.runtimeRoot,'audio-capture',id('fixture'));
const target='docs/media/native-audio',files:{path:string;bytes:number;sha256:string}[]=[],summaries:Record<string,unknown>[]=[];
const styles:CaptionStyle[]=['standard','bold','minimal','karaoke'];
await mkdir(directory,{recursive:true});await mkdir('runtime/test-results/native-audio-capture',{recursive:true});
try{
  const fixture=await syntheticAudioFixture(db.cfg,join(directory,'source'));
  const music:NativeMusic={path:fixture.musicPath,binding:{resource_version_id:'synthetic-audio-bed-1',license_record_id:'synthetic-audio-bed-license-1',
    hash:sha256(await readFile(fixture.musicPath))},gain_db:-12,loop_to_timeline:false,ducking:true};
  await insert(db.pool,'resource_licenses',{id:music.binding.license_record_id,resource_id:music.binding.resource_version_id,version:'1',
    data:{resource_hash:music.binding.hash,resource_version_id:music.binding.resource_version_id,license:'SYNTHETIC_PROJECT_TONE_NOT_CATALOG_MUSIC'}});
  const deadline_at=new Date(Date.now()+180000).toISOString(),signal=new AbortController().signal,frames:Buffer[]=[];
  const save=async(name:string,bytes:Buffer)=>{await writeFile(join(directory,name),bytes);};
  await save('source.mp4',await readFile(fixture.path));await save('synthetic-bed.wav',await readFile(fixture.musicPath));
  for(const [index,style] of styles.entries()){
    const result=await renderNativeAudioPost(db.pool,db.cfg,{directory,deadline_at,signal,path:fixture.path,
      source_sha256:fixture.source_sha256,target_frames:120,resources:style==='karaoke'?[FONT_BINDING,music.binding]:[FONT_BINDING],
      transcript:fixture.transcript,caption_style:style,...(style==='karaoke'?{music}:{})});
    await save(`${style}.mp4`,result.bytes);
    const proofPath=`runtime/test-results/native-audio-capture/${style}-proof.json`;
    await writeFile(proofPath,JSON.stringify(result.proof,null,2)+'\n');
    const frame=join(directory,`${style}.png`);
    await nativeCommand(db.cfg,process.env.FFMPEG_PATH?.trim()||'ffmpeg',['-v','error','-nostdin','-n','-ss','1','-i',join(directory,`${style}.mp4`),'-frames:v','1',frame],
      {cwd:directory,timeoutMs:30000,signal});
    const label=await sharp({text:{text:`<span foreground="#F7F3E7">${index+1}. ${style}</span>`,fontfile:fixture.font.path,font:'Noto Sans SC 26',rgba:true}}).png().toBuffer();
    frames.push(await sharp(await readFile(frame)).resize(540,960).composite([{input:label,left:22,top:20}]).png().toBuffer());
    const {windows,...audio}=result.proof.native_audio;const {windows:encodedWindows,...encoded}=result.proof.encoded_audio;
    const bed=result.proof.music;const bedAnalysis=bed?{samples:bed.bed_analysis.samples,duration_ms:bed.bed_analysis.duration_ms,peak_dbfs:bed.bed_analysis.peak_dbfs}:null;
    summaries.push({style,inspection:result.inspection,source_sha256:fixture.source_sha256,output_sha256:sha256(result.bytes),native_audio:audio,
      audio_windows_hash:hash(windows),encoded_audio:encoded,encoded_windows_hash:hash(encodedWindows),
      caption_script_sha256:result.proof.caption_script_sha256,transcript_hash:result.proof.transcript_hash,
      encoded_mix_comparison:result.proof.encoded_mix_comparison,music:bed?{binding:bed.binding,gain_db:bed.gain_db,ducking:bed.ducking,ducking_policy:bed.ducking_policy,
        loop_to_timeline:bed.loop_to_timeline,bed_pcm_sha256:bed.bed_pcm_sha256,bed_analysis:bedAnalysis}:null,
      original_proof_log_path:proofPath,original_proof_sha256:sha256(await readFile(proofPath)),semantic_review:'NOT_PERFORMED',order_pipeline_connected:false});
  }
  await save('overview.png',await sharp({create:{width:1080,height:1920,channels:3,background:'#193C2C'}})
    .composite(frames.map((input,i)=>({input,left:i%2*540,top:Math.floor(i/2)*960}))).png().toBuffer());
  await nativeCommand(db.cfg,process.env.FFMPEG_PATH?.trim()||'ffmpeg',['-v','error','-nostdin','-n','-i',join(directory,'karaoke.mp4'),
    '-filter_complex','[0:v]fps=8,scale=430:-1:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer',
    '-an','-loop','0',join(directory,'preview.gif')],{cwd:directory,timeoutMs:30000,signal});
  const gif=await sharp(join(directory,'preview.gif'),{animated:true}).metadata();if((gif.pages??0)<2)throw new Error('Audio fixture GIF is not animated');
  // Only publish the allowlisted synthetic files after every render succeeds.
  await mkdir(target,{recursive:true});
  for(const name of ['source.mp4','synthetic-bed.wav',...styles.flatMap(style=>[`${style}.mp4`,`${style}.png`]),'overview.png','preview.gif']){
    const bytes=await readFile(join(directory,name)),path=`${target}/${name}`;await writeFile(path,bytes);files.push({path,bytes:bytes.length,sha256:sha256(bytes)});
  }
  const code=['src/worker/media/native-audio.ts','src/worker/media/native-captions.ts','src/worker/media/native-audio-post.ts','tests/helpers/audio.ts','scripts/record-native-audio.ts'];
  const source_files=await Promise.all(code.map(async path=>({path,sha256:sha256(await readFile(path))})));
  const video=await inspectVideo(db.cfg,join(directory,'karaoke.mp4'),signal);
  const manifest={schema_version:'1.0',type:'NATIVE_AUDIO_KERNEL_SYNTHETIC_FIXTURE',checked_at:new Date().toISOString(),
    data_source:'SYNTHETIC_SINE_TONES_AND_MANUAL_TIMESTAMPS',browser_used:false,real_speech_verified:false,real_asr_verified:false,
    order_pipeline_connected:false,production_admitted:false,full_product_verified:false,source_files,font_binding:FONT_BINDING,
    owned_temporary_directory_removed_on_exit:true,source_frames:120,video,gif_frames:gif.pages,
    styles:summaries,files,notes:'Actual PNG/MP4/AAC/PCM/GIF. Sine tones and manual text timings are explicit fixtures, not Chinese recognition, speaker/lip-sync quality or order delivery. Karaoke includes a licensed synthetic test bed in an isolated native PostgreSQL schema. No browser or external API is used.'};
  await writeFile(`${target}/capture-manifest.json`,JSON.stringify(manifest,null,2)+'\n');
  process.stdout.write(JSON.stringify({status:'PASS',files:files.length,gif_frames:gif.pages,frames:video.frames,source:'SYNTHETIC_TONES_MANUAL_TIMING',browser_used:false})+'\n');
}finally{await db.close();await rm(directory,{recursive:true,force:true});}
