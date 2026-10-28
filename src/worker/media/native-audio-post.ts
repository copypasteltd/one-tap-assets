import {mkdir,mkdtemp,realpath,rm,writeFile,copyFile} from 'node:fs/promises';
import {join} from 'node:path';
import {inside,type Config} from '../../api/config.js';
import type {Db} from '../../api/db/pool.js';
import {hash,sha256} from '../../api/lib/crypto.js';
import {requireThat} from '../../api/lib/errors.js';
import type {ResourceBinding} from '../compiler/snapshot.js';
import {loadProductionFont,verifyResourceLicenses} from './font.js';
import {inspectVideo,nativeCommand} from './native.js';
import {AUDIO_RATE,NATIVE_AUDIO_POLICY,audioFrames,audioStreams,audioTimeout,boundedAudioFile,decodeNativeAudio,pcmAnalysis,withAudioDeadline,
  type AudioExecution} from './native-audio.js';
import {compileNativeCaptions,type CaptionStyle,type NativeTranscript} from './native-captions.js';

export interface NativeMusic {
  path:string;binding:ResourceBinding;gain_db:number;loop_to_timeline:boolean;ducking:boolean;
}
export interface NativeAudioPostInput extends AudioExecution {
  path:string;source_sha256:string;target_frames:number;resources:ResourceBinding[];
  transcript:NativeTranscript;caption_style:CaptionStyle;music?:NativeMusic;
}
const round=(n:number)=>Math.round(n*1e6)/1e6;
/** Compare the actual AAC decode with the exact PCM mix that was encoded.
 * This detects dropped/replaced audio, not intelligibility or speaker identity. */
export function compareEncodedMix(expected:Buffer,actual:Buffer){
  const samples=Math.min(expected.length,actual.length)/2;
  requireThat(samples>0&&expected.length%4===0&&actual.length%4===0&&Math.abs(expected.length-actual.length)<=AUDIO_RATE/30*4,
    'AUDIO_POST_TIMELINE_INVALID','编码后声音未覆盖原混音',422);
  let energy=0,actualEnergy=0,error=0,cross=0;
  for(let i=0;i<samples;i++){
    const a=expected.readInt16LE(i*2)/32768,b=actual.readInt16LE(i*2)/32768;
    energy+=a*a;actualEnergy+=b*b;error+=(a-b)*(a-b);cross+=a*b;
  }
  const correlation=energy&&actualEnergy?cross/Math.sqrt(energy*actualEnergy):0;
  const snr=energy?10*Math.log10(energy/Math.max(error,Number.EPSILON)):0;
  requireThat(correlation>=0.98&&snr>=18,'AUDIO_POST_MIX_MISMATCH','交付音轨与实际原声混音不符',422);
  return {samples_per_channel:samples/2,correlation:round(correlation),snr_db:round(snr)};
}
export const DUCKING_POLICY=Object.freeze({version:'YPCC-PCM-BED-DUCK-1.0.0',detector:'STEREO_RMS_20MS',
  threshold_linear:0.02,reduction_db:-18,attack_ms:10,release_ms:200});
/** Mix PCM with no automatic normalization. The original voice samples always
 * have unit gain. Only the bed follows the measured original-audio envelope. */
export function mixNativeBed(voice:Buffer,music:Buffer,gainDb:number,ducking:boolean){
  requireThat(voice.length===music.length&&voice.length%4===0&&Number.isFinite(gainDb)&&gainDb>=-36&&gainDb<=-6,
    'AUDIO_POST_TIMELINE_INVALID','配乐样本数或冻结音量无效',422);
  const analysis=pcmAnalysis(voice),bed=Buffer.alloc(voice.length),mix=Buffer.alloc(voice.length),gain=10**(gainDb/20);
  const attack=Math.exp(-1/(DUCKING_POLICY.attack_ms*AUDIO_RATE/1000)),release=Math.exp(-1/(DUCKING_POLICY.release_ms*AUDIO_RATE/1000));
  const reduced=10**(DUCKING_POLICY.reduction_db/20);let envelope=1;
  for(let sample=0;sample<voice.length/4;sample++){
    const window=analysis.windows[Math.floor(sample/(AUDIO_RATE*.02))]!;
    const target=ducking&&window.rms_dbfs!==null&&window.rms_dbfs>=20*Math.log10(DUCKING_POLICY.threshold_linear)?reduced:1;
    const coefficient=target<envelope?attack:release;envelope=target+(envelope-target)*coefficient;
    for(let channel=0;channel<2;channel++){
      const at=sample*4+channel*2,value=Math.round(music.readInt16LE(at)*gain*envelope),combined=voice.readInt16LE(at)+value;
      requireThat(Math.abs(combined)<32760,'AUDIO_POST_CLIPPING','原声与许可配乐叠加出现削波，不能归一化压低原声',422);
      bed.writeInt16LE(value,at);mix.writeInt16LE(combined,at);
    }
  }
  return {bed,mix};
}
/** Internal native media kernel. Deliberately not registered as an order/MCP
 * tool until durable ASR billing, audio review, rights and order admission exist.
 * It performs no TTS and accepts no arbitrary FFmpeg/filter arguments. */
export async function renderNativeAudioPost(db:Db,cfg:Config,input:NativeAudioPostInput){
  const frozen={...input,resources:structuredClone(input.resources),transcript:structuredClone(input.transcript),
    ...(input.music?{music:structuredClone(input.music)}:{})};
  return withAudioDeadline(frozen,execution=>renderNativeAudioPostInner(db,cfg,execution));
}
async function renderNativeAudioPostInner(db:Db,cfg:Config,input:NativeAudioPostInput){
  const target=audioFrames(input.target_frames);audioTimeout(input);
  const resources=structuredClone(input.resources),music=input.music?structuredClone(input.music):undefined;
  const transcript=structuredClone(input.transcript),style=input.caption_style;
  await verifyResourceLicenses(db,resources);const font=await loadProductionFont(cfg.projectRoot);
  if(music){
    requireThat(Number.isFinite(music.gain_db)&&music.gain_db>=-36&&music.gain_db<=-6&&typeof music.loop_to_timeline==='boolean'
      &&typeof music.ducking==='boolean'&&resources.some(r=>hash(r)===hash(music.binding)),
      'MUSIC_CONTRACT_INVALID','配乐摘要、许可、音量或循环压低策略未冻结',422);
  }
  const parent=inside(cfg.runtimeRoot,input.directory);await mkdir(parent,{recursive:true});inside(cfg.runtimeRoot,await realpath(parent));
  const directory=await mkdtemp(join(parent,'audio-post-'));
  try{
    const sourceBytes=await boundedAudioFile(cfg,input.path);
    requireThat(sha256(sourceBytes)===input.source_sha256,'AUDIO_SOURCE_HASH_MISMATCH','后期输入与冻结原声视频不一致',503);
    const source=join(directory,'source.mp4');await writeFile(source,sourceBytes,{flag:'wx'});
    const native=await decodeNativeAudio(cfg,{...input,path:source,directory});
    const captions=compileNativeCaptions(transcript,native.evidence,font,style);
    await writeFile(join(directory,'captions.ass'),captions.script,{flag:'wx'});
    const fonts=join(directory,'fonts');await mkdir(fonts);await copyFile(font.path,join(fonts,'production.ttf'));
    let mix=native.pcm,bed:Buffer|undefined;
    if(music){
      const musicBytes=await boundedAudioFile(cfg,music.path,64_000_000);
      requireThat(sha256(musicBytes)===music.binding.hash,'MUSIC_SOURCE_HASH_MISMATCH','实际配乐字节与冻结许可版本不一致',503);
      const musicPath=join(directory,'music.media');await writeFile(musicPath,musicBytes,{flag:'wx'});
      const stream=await audioStreams(cfg,musicPath,input);
      requireThat(stream.streams.every(s=>s.codec_type==='audio')&&(music.loop_to_timeline||stream.duration>=input.target_frames/30),
        'MUSIC_TIMELINE_INVALID','配乐不能包含画面，短音乐未获循环授权',422);
      const duration=native.pcm.length/4/AUDIO_RATE;
      await nativeCommand(cfg,process.env.FFMPEG_PATH?.trim()||'ffmpeg',['-v','error','-xerror','-nostdin','-n',
        ...(music.loop_to_timeline?['-stream_loop','-1']:[]),'-protocol_whitelist','file,pipe','-i',musicPath,
        '-map','0:a:0','-af',`aresample=48000:async=0,atrim=end_sample=${native.evidence.samples},asetpts=PTS-STARTPTS`,
        '-t',String(duration),'-ar','48000','-ac','2','-c:a','pcm_s16le','-f','s16le',join(directory,'music.s16le')],
        {cwd:directory,timeoutMs:audioTimeout(input),signal:input.signal});
      const musicPcm=await boundedAudioFile(cfg,join(directory,'music.s16le'),target*4);
      ({mix,bed}=mixNativeBed(native.pcm,musicPcm,music.gain_db,music.ducking));
    }
    const mixed=pcmAnalysis(mix);
    requireThat(mixed.clipped_ratio<=0.001&&mixed.peak_dbfs!==null&&mixed.peak_dbfs<-.05,
      'AUDIO_POST_CLIPPING','实际原声混音出现削波或没有编码余量',422);
    const mixPath=join(directory,'final-mix.s16le');await writeFile(mixPath,mix,{flag:'wx'});
    const path=join(directory,'post.mp4');
    await nativeCommand(cfg,process.env.FFMPEG_PATH?.trim()||'ffmpeg',['-v','error','-xerror','-nostdin','-n','-threads','2','-filter_threads','1',
      '-protocol_whitelist','file,pipe','-i',source,'-f','s16le','-ar','48000','-ac','2','-i',mixPath,
      '-map','0:v:0','-map','1:a:0','-vf','fps=30,scale=1080:1920:flags=lanczos,setsar=1,ass=filename=captions.ass:fontsdir=fonts',
      '-frames:v',String(input.target_frames),'-t',String(input.target_frames/30),'-map_metadata','-1','-map_chapters','-1',
      '-c:v','libx264','-threads','2','-preset','veryfast','-crf','20','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k',
      '-ar','48000','-ac','2','-movflags','+faststart',path],{cwd:directory,timeoutMs:audioTimeout(input,180000),signal:input.signal});
    const inspection=await inspectVideo(cfg,path,input.signal);
    requireThat(inspection.codec==='h264'&&inspection.pixelFormat==='yuv420p'&&inspection.width===1080&&inspection.height===1920
      &&inspection.fps===30&&inspection.frames===input.target_frames&&inspection.hasAudio&&inspection.audioCodec==='aac',
      'AUDIO_POST_VIDEO_INVALID','实际有声后期文件不符合原交付时间轴与编码',422);
    const bytes=await boundedAudioFile(cfg,path),decoded=await decodeNativeAudio(cfg,{...input,directory,path,source_sha256:sha256(bytes)});
    const comparison=compareEncodedMix(mix,decoded.pcm);audioTimeout(input);await verifyResourceLicenses(db,resources);audioTimeout(input);
    return {bytes,inspection,caption_script:captions.script,proof:{policy:NATIVE_AUDIO_POLICY,source_sha256:input.source_sha256,output_sha256:sha256(bytes),
      native_audio:native.evidence,transcript_hash:captions.transcript_hash,recognizer:transcript.recognizer,caption_style:style,
      caption_script_sha256:sha256(captions.script),font_binding:font.binding,mix_pcm_sha256:sha256(mix),mix_analysis:mixed,
      encoded_audio:decoded.evidence,encoded_mix_comparison:comparison,
      music:music&&bed?{binding:music.binding,gain_db:music.gain_db,loop_to_timeline:music.loop_to_timeline,ducking:music.ducking,
        ducking_policy:DUCKING_POLICY,bed_pcm_sha256:sha256(bed),bed_analysis:pcmAnalysis(bed)}:null,
      semantic_review:'NOT_PERFORMED' as const,order_pipeline_connected:false as const}};
  }finally{await rm(directory,{recursive:true,force:true});}
}
