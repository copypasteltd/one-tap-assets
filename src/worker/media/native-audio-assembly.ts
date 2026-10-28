import {mkdir,mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {inside,type Config} from '../../api/config.js';
import {hash,sha256} from '../../api/lib/crypto.js';
import {requireThat} from '../../api/lib/errors.js';
import {inspectVideo,nativeCommand,type MediaInspection} from './native.js';
import {AUDIO_RATE,audioFrames,audioTimeout,decodeNativeAudio,withAudioDeadline,type AudioExecution,type NativeAudioEvidence} from './native-audio.js';

export const NATIVE_ASSEMBLY_VERSION='YPCC-NATIVE-ASSEMBLY-1';
export interface NativeSegment {node_key:string;start_frame:number;end_frame:number;source_sha256:string;bytes:Buffer}
export interface NativeAssemblyProof {
  version:typeof NATIVE_ASSEMBLY_VERSION;target_frames:number;original_gain_db:0;intermediate_codec:'alac';
  segments:{node_key:string;start_frame:number;end_frame:number;source_sha256:string;pcm_sha256:string}[];
  assembled_pcm_sha256:string;output_sha256:string;native_audio:NativeAudioEvidence;
}
export interface NativeAssemblyInput extends AudioExecution {target_frames:number;segments:NativeSegment[]}
function segmentsValid(input:NativeAssemblyInput):void{
  audioFrames(input.target_frames);let position=0;
  requireThat(input.segments.length>0&&input.segments.length<=30&&new Set(input.segments.map(s=>s.node_key)).size===input.segments.length,
    'AUDIO_ASSEMBLY_INVALID','整轨必须使用唯一、完整的原镜头列表',422);
  for(const s of input.segments){
    requireThat(typeof s.node_key==='string'&&/^[A-Za-z0-9:._-]{1,128}$/.test(s.node_key)&&s.start_frame===position
      &&Number.isSafeInteger(s.end_frame)&&s.end_frame>s.start_frame&&s.end_frame<=input.target_frames
      &&sha256(s.bytes)===s.source_sha256,'AUDIO_ASSEMBLY_INVALID','原镜头顺序、边界或实际来源摘要不一致',422);position=s.end_frame;
  }
  requireThat(position===input.target_frames,'AUDIO_ASSEMBLY_INVALID','原镜头没有覆盖完整声音时间轴',422);
}
async function decodeSegments(cfg:Config,input:NativeAssemblyInput,directory:string){
  const pcm:Buffer[]=[],proof:NativeAssemblyProof['segments']=[];
  for(const [index,s] of input.segments.entries()){
    const path=join(directory,`input-${index}.mp4`);await writeFile(path,s.bytes,{flag:'wx'});
    const frames=s.end_frame-s.start_frame,actual=await inspectVideo(cfg,path,input.signal);
    requireThat(actual.fps===30&&actual.frames===frames&&actual.hasAudio,'AUDIO_ASSEMBLY_SOURCE_INVALID','生成镜头缺少原生音轨或完整30fps画面',422);
    const decoded=await decodeNativeAudio(cfg,{...input,directory,path,source_sha256:s.source_sha256,target_frames:frames});
    pcm.push(decoded.pcm);proof.push({node_key:s.node_key,start_frame:s.start_frame,end_frame:s.end_frame,source_sha256:s.source_sha256,pcm_sha256:sha256(decoded.pcm)});
  }
  return {pcm:Buffer.concat(pcm),proof};
}
/** Lossless production intermediate: decoded original samples are concatenated
 * at unit gain. AAC is encoded only by the separate caption/music POST step. */
export async function assembleNativeAudio(cfg:Config,raw:NativeAssemblyInput):Promise<{bytes:Buffer;inspection:MediaInspection;proof:NativeAssemblyProof}>{
  const input={...raw,segments:raw.segments.map(s=>({...s,bytes:Buffer.from(s.bytes)}))};segmentsValid(input);
  return withAudioDeadline(input,async execution=>{
    const parent=inside(cfg.runtimeRoot,execution.directory);await mkdir(parent,{recursive:true});const directory=await mkdtemp(join(parent,'native-assembly-'));
    try{
      const decoded=await decodeSegments(cfg,execution,directory);
      for(const [index,s] of execution.segments.entries()){
        await nativeCommand(cfg,process.env.FFMPEG_PATH?.trim()||'ffmpeg',['-v','error','-xerror','-nostdin','-n','-threads','2','-filter_threads','1',
          '-protocol_whitelist','file,pipe','-i',join(directory,`input-${index}.mp4`),'-map','0:v:0','-an',
          '-vf','fps=30,scale=1080:1920:flags=lanczos,setsar=1','-frames:v',String(s.end_frame-s.start_frame),
          '-map_metadata','-1','-map_chapters','-1','-c:v','libx264','-threads','2','-preset','veryfast','-crf','20','-pix_fmt','yuv420p',join(directory,`video-${index}.mp4`)],
        {cwd:directory,timeoutMs:audioTimeout(execution,180000),signal:execution.signal});
      }
      await writeFile(join(directory,'concat.txt'),execution.segments.map((_,i)=>`file 'video-${i}.mp4'`).join('\n')+'\n',{flag:'wx'});
      await writeFile(join(directory,'native.s16le'),decoded.pcm,{flag:'wx'});const path=join(directory,'assembled.mp4');
      await nativeCommand(cfg,process.env.FFMPEG_PATH?.trim()||'ffmpeg',['-v','error','-xerror','-nostdin','-n','-threads','2',
        '-protocol_whitelist','file,pipe','-f','concat','-safe','1','-i',join(directory,'concat.txt'),'-f','s16le','-ar',String(AUDIO_RATE),'-ac','2','-i',join(directory,'native.s16le'),
        '-map','0:v:0','-map','1:a:0','-frames:v',String(execution.target_frames),'-t',String(execution.target_frames/30),
        '-map_metadata','-1','-map_chapters','-1','-c:v','copy','-c:a','alac','-sample_fmt','s16p','-movflags','+faststart',path],
      {cwd:directory,timeoutMs:audioTimeout(execution),signal:execution.signal});
      const bytes=await readFile(path),inspection=await inspectVideo(cfg,path,execution.signal);
      requireThat(inspection.codec==='h264'&&inspection.pixelFormat==='yuv420p'&&inspection.width===1080&&inspection.height===1920
        &&inspection.fps===30&&inspection.frames===execution.target_frames&&inspection.audioCodec==='alac','AUDIO_ASSEMBLY_OUTPUT_INVALID','无损整轨与原时间轴不符',422);
      const actual=await decodeNativeAudio(cfg,{...execution,directory,path,source_sha256:sha256(bytes)});
      requireThat(actual.pcm.equals(decoded.pcm),'AUDIO_ASSEMBLY_PCM_MISMATCH','无损中间音轨改变或丢失原声音样本',422);
      return {bytes,inspection,proof:{version:NATIVE_ASSEMBLY_VERSION,target_frames:execution.target_frames,original_gain_db:0,intermediate_codec:'alac',
        segments:decoded.proof,assembled_pcm_sha256:sha256(decoded.pcm),output_sha256:sha256(bytes),native_audio:actual.evidence}};
    }finally{await rm(directory,{recursive:true,force:true});}
  });
}
/** Recovery rechecks actual source and intermediate samples; a declared digest
 * or plausible waveform report cannot replace the registered original bytes. */
export async function verifyNativeAssembly(cfg:Config,input:NativeAssemblyInput&{bytes:Buffer;proof:NativeAssemblyProof}):Promise<void>{
  segmentsValid(input);
  await withAudioDeadline(input,async execution=>{
    const parent=inside(cfg.runtimeRoot,execution.directory);await mkdir(parent,{recursive:true});const directory=await mkdtemp(join(parent,'verify-assembly-'));
    try{
      const decoded=await decodeSegments(cfg,execution,directory),p=execution.proof,path=join(directory,'assembled.mp4');await writeFile(path,execution.bytes,{flag:'wx'});
      const actual=await decodeNativeAudio(cfg,{...execution,directory,path,source_sha256:sha256(execution.bytes)});
      requireThat(p.version===NATIVE_ASSEMBLY_VERSION&&p.target_frames===execution.target_frames&&p.original_gain_db===0&&p.intermediate_codec==='alac'
        &&p.output_sha256===sha256(execution.bytes)&&hash(p.segments)===hash(decoded.proof)&&p.assembled_pcm_sha256===sha256(decoded.pcm)
        &&actual.evidence.codec==='alac'&&hash(actual.evidence)===hash(p.native_audio)&&actual.pcm.equals(decoded.pcm),
        'AUDIO_ASSEMBLY_PROOF_MISMATCH','原生成音轨、整轨样本与封存组装证据不一致',503);
    }finally{await rm(directory,{recursive:true,force:true});}
  });
}
