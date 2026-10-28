import {mkdir,mkdtemp,readFile,realpath,rm,stat,writeFile} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import {inside,type Config} from '../../api/config.js';
import {hash,sha256} from '../../api/lib/crypto.js';
import {requireThat} from '../../api/lib/errors.js';
import {object} from '../../shared/domain/json.js';
import {nativeCommand} from './native.js';

export const NATIVE_AUDIO_POLICY='YPCC-NATIVE-AUDIO-KERNEL-1.0.0';
export const AUDIO_RATE=48000,AUDIO_CHANNELS=2,AUDIO_WINDOW_MS=20;
const BYTES_PER_SAMPLE=2*AUDIO_CHANNELS;
export interface AudioWindow {start_ms:number;end_ms:number;rms_dbfs:number|null;peak_dbfs:number|null}
export interface NativeAudioEvidence {
  policy:string;source_sha256:string;pcm_sha256:string;target_frames:number;
  codec:string;source_sample_rate:number;source_channels:number;source_start_ms:number;
  sample_rate:48000;channels:2;samples:number;duration_ms:number;
  peak_dbfs:number|null;rms_dbfs:number|null;clipped_ratio:number;active_ms:number;windows:AudioWindow[];
}
export interface AudioExecution {directory:string;deadline_at:string;signal:AbortSignal}
const rounded=(n:number)=>Math.round(n*1e6)/1e6;
const dbfs=(v:number):number|null=>v===0?null:rounded(20*Math.log10(v));
export function audioTimeout(execution:AudioExecution,maximum=120000):number{
  requireThat(!execution.signal.aborted,'NATIVE_ABORTED','原生声音处理已取消',409);
  const remaining=Date.parse(execution.deadline_at)-Date.now();
  requireThat(Number.isFinite(remaining)&&remaining>0,'ORDER_DEADLINE_EXCEEDED','原声音任务期限已结束',409);
  return Math.min(remaining,maximum);
}
export async function withAudioDeadline<Input extends AudioExecution,Output>(value:Input,work:(execution:Input)=>Promise<Output>):Promise<Output>{
  const remaining=audioTimeout(value,2147483647),deadline=new AbortController();
  const timer=setTimeout(()=>deadline.abort(),remaining);timer.unref();
  // Freeze scalar execution fields; the caller's cancellation remains live.
  const input={...value,signal:AbortSignal.any([value.signal,deadline.signal])};
  try{return await work(input);}finally{clearTimeout(timer);}
}
export function audioFrames(frames:number):number{
  requireThat(Number.isSafeInteger(frames)&&frames>=1&&frames<=3600,'AUDIO_TIMELINE_INVALID','声音内核只接受原时间轴1至3600帧',422);
  return frames*AUDIO_RATE/30;
}
export async function boundedAudioFile(cfg:Config,path:string,maximum=512_000_000):Promise<Buffer>{
  const file=inside(cfg.runtimeRoot,path);inside(cfg.runtimeRoot,await realpath(file));
  const info=await stat(file);requireThat(info.isFile()&&info.size>0&&info.size<=maximum,'AUDIO_INPUT_INVALID','声音输入缺失或超过容量',422);
  const bytes=await readFile(file);requireThat(bytes.length===info.size&&bytes.length<=maximum,'AUDIO_INPUT_INVALID','读取中的声音输入已变化',422);return bytes;
}
export async function audioStreams(cfg:Config,path:string,execution:AudioExecution){
  audioTimeout(execution);inside(cfg.runtimeRoot,await realpath(inside(cfg.runtimeRoot,path)));
  const raw=await nativeCommand(cfg,process.env.FFPROBE_PATH?.trim()||'ffprobe',['-v','error','-protocol_whitelist','file,pipe',
    '-show_streams','-show_format','-of','json',path],{cwd:dirname(path),timeoutMs:audioTimeout(execution,30000),signal:execution.signal});
  const parsed=object(JSON.parse(raw) as unknown),streams=Array.isArray(parsed.streams)?parsed.streams.map(object):[];
  const tracks=streams.filter(s=>s.codec_type==='audio');
  requireThat(tracks.length===1,'NATIVE_AUDIO_STREAM_INVALID','必须存在唯一实际原声音轨，不能补静音履约',422);
  const track=tracks[0]!,rate=Number(track.sample_rate),channels=Number(track.channels),start=Number(track.start_time??0);
  const duration=Number(track.duration??object(parsed.format).duration);
  requireThat(Number.isSafeInteger(rate)&&rate>=8000&&rate<=96000&&Number.isSafeInteger(channels)&&channels>=1&&channels<=2
    &&Number.isFinite(start)&&Math.abs(start)<=1/30&&Number.isFinite(duration)&&duration>0&&duration<=600,
    'NATIVE_AUDIO_FORMAT_INVALID','原声音轨的采样率、声道、起点或时长不支持',422);
  return {streams,codec:String(track.codec_name),rate,channels,start,duration};
}
export function pcmAnalysis(pcm:Buffer):{samples:number;duration_ms:number;peak_dbfs:number|null;rms_dbfs:number|null;clipped_ratio:number;active_ms:number;windows:AudioWindow[]}{
  requireThat(pcm.length>0&&pcm.length%BYTES_PER_SAMPLE===0&&pcm.length<=3600*AUDIO_RATE/30*BYTES_PER_SAMPLE,
    'NATIVE_AUDIO_PCM_INVALID','实际PCM长度或声道布局不合法',422);
  const samples=pcm.length/BYTES_PER_SAMPLE,windowSamples=AUDIO_RATE*AUDIO_WINDOW_MS/1000,windows:AudioWindow[]=[];
  let sum=0,peak=0,clipped=0,active=0;
  for(let start=0;start<samples;start+=windowSamples){
    const end=Math.min(start+windowSamples,samples);let windowSum=0,windowPeak=0;
    for(let sample=start;sample<end;sample++)for(let channel=0;channel<AUDIO_CHANNELS;channel++){
      const value=Math.abs(pcm.readInt16LE(sample*BYTES_PER_SAMPLE+channel*2))/32768;
      windowSum+=value*value;windowPeak=Math.max(windowPeak,value);if(value>=32760/32768)clipped++;
    }
    const rms=Math.sqrt(windowSum/((end-start)*AUDIO_CHANNELS));
    if(rms>=0.001)active+=end-start;sum+=windowSum;peak=Math.max(peak,windowPeak);
    windows.push({start_ms:rounded(start*1000/AUDIO_RATE),end_ms:rounded(end*1000/AUDIO_RATE),rms_dbfs:dbfs(rms),peak_dbfs:dbfs(windowPeak)});
  }
  return {samples,duration_ms:rounded(samples*1000/AUDIO_RATE),peak_dbfs:dbfs(peak),rms_dbfs:dbfs(Math.sqrt(sum/(samples*AUDIO_CHANNELS))),
    clipped_ratio:rounded(clipped/(samples*AUDIO_CHANNELS)),active_ms:rounded(active*1000/AUDIO_RATE),windows};
}
/** Signal presence is a physical measurement, never proof of Chinese speech,
 * speaker identity, intelligibility, lip sync or a correct transcript. */
export async function decodeNativeAudio(cfg:Config,input:AudioExecution&{path:string;source_sha256:string;target_frames:number}):Promise<{pcm:Buffer;evidence:NativeAudioEvidence}>{
  return withAudioDeadline(input,execution=>decodeNativeAudioInner(cfg,execution));
}
async function decodeNativeAudioInner(cfg:Config,input:AudioExecution&{path:string;source_sha256:string;target_frames:number}):Promise<{pcm:Buffer;evidence:NativeAudioEvidence}>{
  const target=audioFrames(input.target_frames);audioTimeout(input);
  const parent=inside(cfg.runtimeRoot,input.directory);await mkdir(parent,{recursive:true});inside(cfg.runtimeRoot,await realpath(parent));
  const directory=await mkdtemp(join(parent,'decode-'));
  try{
    const bytes=await boundedAudioFile(cfg,input.path);
    requireThat(sha256(bytes)===input.source_sha256,'AUDIO_SOURCE_HASH_MISMATCH','实际声音来源与冻结文件摘要不一致',503);
    const source=join(directory,'source.media');await writeFile(source,bytes,{flag:'wx'});
    const track=await audioStreams(cfg,source,input);
    requireThat(track.streams.filter(s=>s.codec_type==='video').length===1&&Math.abs(track.duration-input.target_frames/30)<=1/30,
      'NATIVE_AUDIO_TIMELINE_INVALID','原声缺少唯一画面或音轨未覆盖原视频时间轴',422);
    const path=join(directory,'native.s16le');
    await nativeCommand(cfg,process.env.FFMPEG_PATH?.trim()||'ffmpeg',['-v','error','-xerror','-err_detect','explode','-nostdin','-n',
      '-threads','2','-protocol_whitelist','file,pipe','-i',source,'-map','0:a:0','-vn','-sn','-dn','-t',String(input.target_frames/30+1/30),
      '-ac','2','-ar',String(AUDIO_RATE),'-c:a','pcm_s16le','-f','s16le','-fs',String((target+AUDIO_RATE/30)*BYTES_PER_SAMPLE),path],
      {cwd:directory,timeoutMs:audioTimeout(input),signal:input.signal});
    const raw=await boundedAudioFile(cfg,path,(target+AUDIO_RATE/30)*BYTES_PER_SAMPLE);
    requireThat(raw.length%BYTES_PER_SAMPLE===0&&raw.length/BYTES_PER_SAMPLE>=target-AUDIO_RATE/30
      &&raw.length/BYTES_PER_SAMPLE<=target+AUDIO_RATE/30,'NATIVE_AUDIO_TIMELINE_INVALID','实际解码原声不足或超出原时间轴',422);
    // Only discard codec tail padding. Never invent missing speech with apad/TTS.
    const pcm=Buffer.from(raw.subarray(0,target*BYTES_PER_SAMPLE)),analysis=pcmAnalysis(pcm);
    requireThat(analysis.active_ms>=Math.min(100,input.target_frames*1000/30)&&analysis.clipped_ratio<=0.001,
      'NATIVE_AUDIO_SIGNAL_INVALID','原声音轨为空、无可测信号或严重削波',422);
    audioTimeout(input);
    return {pcm,evidence:{policy:NATIVE_AUDIO_POLICY,source_sha256:input.source_sha256,pcm_sha256:sha256(pcm),target_frames:input.target_frames,
      codec:track.codec,source_sample_rate:track.rate,source_channels:track.channels,source_start_ms:rounded(track.start*1000),
      sample_rate:AUDIO_RATE,channels:AUDIO_CHANNELS,...analysis}};
  }finally{await rm(directory,{recursive:true,force:true});}
}
export const nativeAudioHash=(evidence:NativeAudioEvidence)=>hash(evidence);
