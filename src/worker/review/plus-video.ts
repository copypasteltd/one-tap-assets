import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import type {Config} from '../../api/config.js';
import {hash,sha256} from '../../api/lib/crypto.js';
import {requireThat} from '../../api/lib/errors.js';
import type {ObjectStorage} from '../../api/storage/storage.js';
import type {DTO} from '../../shared/contracts/types.js';
import {plusVideoBinding,plusVideoNeedsListening,type PlusVideoBinding} from '../../shared/domain/plus-video.js';
import type {ExecutionContext} from '../compiler/order-context.js';
import type {MediaReceipt} from '../media/artifacts.js';
import {nativeCommand} from '../media/native.js';
import {compareEncodedMix} from '../media/native-audio-post.js';
import {extractEvidenceFrames,type EvidenceFrame} from './evidence.js';
import {nativeReviewWav} from './native-audio.js';
import type {ReviewEvidence} from './qc.js';

const VERSION='YPCC-PLUS-VIDEO-EVIDENCE-1';
type Kind='NATIVE_AUDIO'|'FINAL_AUDIO'|'CAPTION_SCRIPT'|'AUDIO_QC';
export interface PlusVideoQcBundle{files:{kind:Kind;bytes:Buffer;artifact_id:string|null;mime_type:string}[];source_frames:EvidenceFrame[];caption_frames:number[]}
export function plusVideoCaptionFrames(b:PlusVideoBinding):number[]{
  return [...new Set(b.settings.captions.flatMap(c=>[c.start_frame,Math.floor((c.start_frame+c.end_frame-1)/2),c.end_frame-1]))].sort((a,b)=>a-b);
}
async function pcm(cfg:Config,path:string,directory:string,name:string,start:number,frames:number,deadline:string,signal:AbortSignal):Promise<Buffer>{
  const out=join(directory,name+'.pcm'),samples=frames*1600;
  await nativeCommand(cfg,process.env.FFMPEG_PATH?.trim()||'ffmpeg',['-hide_banner','-loglevel','error','-xerror','-nostdin','-threads','2',
    '-protocol_whitelist','file,pipe','-i',path,'-map','0:a:0','-vn','-af',
    `aresample=48000,aformat=channel_layouts=stereo,atrim=start_sample=${start*1600}:end_sample=${(start+frames)*1600},asetpts=PTS-STARTPTS,apad=whole_len=${samples},atrim=end_sample=${samples}`,
    '-c:a','pcm_s16le','-f','s16le',out],{cwd:directory,timeoutMs:Math.max(1,Math.min(120000,Date.parse(deadline)-Date.now())),signal});
  const bytes=await readFile(out);requireThat(bytes.length===samples*4,'PLUS_VIDEO_AUDIO_TIMELINE_INVALID','原声选段的完整PCM长度与已确认帧数不一致',422);return bytes;
}
export async function plusVideoQc(cfg:Config,store:ObjectStorage,c:ExecutionContext,post:MediaReceipt,directory:string,signal:AbortSignal):Promise<PlusVideoQcBundle>{
  const b=plusVideoBinding(c.contract.source)!;await mkdir(directory,{recursive:true});
  const source=await store.get(b.source_object_key,512000000);requireThat(source.length===b.source_bytes&&sha256(source)===b.source_sha256,
    'PLUS_SOURCE_BYTES_CHANGED','原片审查来源已变化',503);
  const sourcePath=join(directory,'source.mp4');await writeFile(sourcePath,source,{flag:'wx'});
  const source_frames=await extractEvidenceFrames(cfg,sourcePath,join(directory,'source-frames'),b.source_frames,
    [b.settings.trim.start_frame,b.settings.trim.end_frame-1],c.snapshot.deadline_at,signal);
  const caption_frames=plusVideoCaptionFrames(b),script=Buffer.from(JSON.stringify({version:VERSION,binding_hash:hash(b),
    target_frames:c.snapshot.timeline.target_frames,captions:b.settings.captions,user_input_status:'USER_PROVIDED_UNVERIFIED',
    instruction:'SUBTITLE须与实际声音逐句核对；ON_SCREEN_COPY是画面文案，仍须核对商品证据。没有自动转写或已验证台词的承诺。'}));
  const files:PlusVideoQcBundle['files']=[{kind:'CAPTION_SCRIPT',bytes:script,artifact_id:null,mime_type:'application/json'}];
  const video=post.artifacts.find(a=>a.spec.kind==='video')!;
  let comparison:unknown=null;
  if(plusVideoNeedsListening(c.contract.source)){
    const encoded=await store.get(video.object_key,512000000);requireThat(sha256(encoded)===video.sha256,'PLUS_VIDEO_AUDIO_CHANGED','成片音轨来源已变化',503);
    const finalPath=join(directory,'final.mp4');await writeFile(finalPath,encoded,{flag:'wx'});
    const original=await pcm(cfg,sourcePath,directory,'selected-original',b.settings.trim.start_frame,c.snapshot.timeline.target_frames,c.snapshot.deadline_at,signal);
    const final=await pcm(cfg,finalPath,directory,'encoded-final',0,c.snapshot.timeline.target_frames,c.snapshot.deadline_at,signal);
    const silent=original.every(byte=>byte===0);
    if(silent){requireThat(final.every(byte=>byte===0),'PLUS_VIDEO_AUDIO_CHANGED','原片静音段在交付中出现新声音',422);comparison={silent:true,samples_per_channel:original.length/4};}
    else comparison=compareEncodedMix(original,final);
    files.push({kind:'NATIVE_AUDIO',bytes:nativeReviewWav(original),artifact_id:video.id,mime_type:'audio/wav'},
      {kind:'FINAL_AUDIO',bytes:nativeReviewWav(final),artifact_id:video.id,mime_type:'audio/wav'});
  }
  files.push({kind:'AUDIO_QC',artifact_id:video.id,mime_type:'application/json',bytes:Buffer.from(JSON.stringify({version:VERSION,binding_hash:hash(b),
    snapshot_hash:c.snapshotHash,source_sha256:b.source_sha256,encoded_video_sha256:video.sha256,target_frames:c.snapshot.timeline.target_frames,
    audio_mode:b.settings.audio_mode,source_has_audio:b.source_has_audio,comparison,caption_script_sha256:sha256(script),
    files:files.map(f=>({kind:f.kind,sha256:sha256(f.bytes),size_bytes:f.bytes.length})),semantic_review:'PENDING',
    independent_listening:plusVideoNeedsListening(c.contract.source)?'REQUIRED':'NOT_APPLICABLE'}))});
  return {files,source_frames,caption_frames};
}
export function verifyPlusVideoEvidence(packet:DTO<'ReviewPacket'>,rows:ReviewEvidence[],bytes:Map<string,Buffer>):void{
  const unique=(kind:string)=>{const list=rows.filter(r=>r.kind===kind);requireThat(list.length===1&&bytes.has(list[0]!.id),
    'PLUS_VIDEO_EVIDENCE_INCOMPLETE','视频编辑的封存证据缺失或重复',503);return list[0]!;};
  const contract=JSON.parse(bytes.get(unique('CONTRACT').id)!.toString('utf8')) as {plus_video:{binding:PlusVideoBinding};snapshot:ExecutionContext['snapshot']};
  const b=contract.plus_video?.binding;requireThat(b?.version==='YPCC-PLUS-VIDEO-1'&&hash(contract.snapshot)===packet.snapshot_hash,
    'PLUS_VIDEO_EVIDENCE_CHANGED','视频编辑的封存合同与快照不一致',503);
  const script=unique('CAPTION_SCRIPT'),report=JSON.parse(bytes.get(unique('AUDIO_QC').id)!.toString('utf8')) as Record<string,unknown>;
  const parsed=JSON.parse(bytes.get(script.id)!.toString('utf8')) as {binding_hash:string;captions:unknown};
  const sound=b.source_has_audio&&b.settings.audio_mode==='PRESERVE';
  requireThat(parsed.binding_hash===hash(b)&&hash(parsed.captions)===hash(b.settings.captions)&&report.version===VERSION&&report.binding_hash===hash(b)
    &&report.snapshot_hash===packet.snapshot_hash&&report.caption_script_sha256===script.sha256&&report.source_sha256===b.source_sha256
    &&report.target_frames===b.settings.trim.end_frame-b.settings.trim.start_frame&&report.audio_mode===b.settings.audio_mode
    &&report.independent_listening===(sound?'REQUIRED':'NOT_APPLICABLE')&&packet.outputs.some(o=>o.sha256===report.encoded_video_sha256),
    'PLUS_VIDEO_EVIDENCE_CHANGED','视频编辑的声音、字幕或实际成片摘要不匹配',503);
  for(const kind of ['NATIVE_AUDIO','FINAL_AUDIO']){
    const found=rows.filter(r=>r.kind===kind);requireThat(found.length===(sound?1:0),'PLUS_VIDEO_AUDIO_EVIDENCE_INVALID','原声选择与完整听音文件数量不一致',503);
  }
  for(const f of report.files as {kind:string;sha256:string;size_bytes:number}[]){const row=unique(f.kind),raw=bytes.get(row.id)!;
    requireThat(row.sha256===f.sha256&&raw.length===f.size_bytes&&sha256(raw)===f.sha256,'PLUS_VIDEO_EVIDENCE_CHANGED','视频编辑审查文件字节已变化',503);}
  requireThat(rows.some(r=>r.kind==='CANDIDATE_IMAGE'&&r.data.purpose==='PLUS_VIDEO_SOURCE_REFERENCE'&&r.data.source_sha256===b.source_sha256),
    'PLUS_VIDEO_SOURCE_EVIDENCE_MISSING','视频编辑缺少实际原片参考帧',503);
}
