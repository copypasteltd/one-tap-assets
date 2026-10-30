import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import type {Config} from '../../api/config.js';
import type {Db} from '../../api/db/pool.js';
import {hash,sha256} from '../../api/lib/crypto.js';
import {requireThat} from '../../api/lib/errors.js';
import type {ObjectStorage} from '../../api/storage/storage.js';
import type {DTO} from '../../shared/contracts/types.js';
import {frozenNativeAudio,verifyNativeAudioLive,type NativeAudioContract} from '../audio/contract.js';
import {frozenOrderListening,orderNeedsListening} from '../audio/listening-contract.js';
import {plusVideoBinding} from '../../shared/domain/plus-video.js';
import {verifyResourceLicenses} from '../media/font.js';
import {originalNativeTranscript} from '../audio/order-proof.js';
import type {ExecutionContext} from '../compiler/order-context.js';
import type {ArtifactSpec,MediaReceipt} from '../media/artifacts.js';
import type {ResourceBinding} from '../compiler/snapshot.js';
import {loadProductionFont} from '../media/font.js';
import {AUDIO_RATE,audioTimeout,audioStreams,boundedAudioFile,decodeNativeAudio,withAudioDeadline} from '../media/native-audio.js';
import {compareEncodedMix,mixNativeBed} from '../media/native-audio-post.js';
import {compileNativeCaptions,type NativeTranscript} from '../media/native-captions.js';
import {nativeCommand} from '../media/native.js';
import {sourceBytes} from '../speech/input.js';
import type {ReviewEvidence} from './qc.js';

export const NATIVE_QC_EVIDENCE_VERSION='YPCC-NATIVE-AUDIO-QC-EVIDENCE-1';
export const NATIVE_QC_KINDS=['NATIVE_AUDIO','FINAL_AUDIO','TRANSCRIPT','CAPTION_SCRIPT','AUDIO_QC'] as const;
type AudioKind=typeof NATIVE_QC_KINDS[number];
export interface AudioEvidenceFile {kind:AudioKind;bytes:Buffer;mime_type:string;artifact_id:string}
export interface NativeQcBundle {files:AudioEvidenceFile[];caption_frames:number[];asr_submission_id:string;
  transcript_object_key:string;transcript_sha256:string;source_write_id:string;audio_contract_hash:string}
interface NativeQcReport {
  version:typeof NATIVE_QC_EVIDENCE_VERSION;snapshot_hash:string;audio_contract_hash:string;target_frames:number;
  video_artifact_id:string;covered_video_artifact_ids:string[];source_artifact_id:string;source_write_id:string;
  source_video_sha256:string;encoded_video_sha256:string;asr_submission_id:string;transcript_sha256:string;transcript_hash:string;
  source_pcm_sha256:string;encoded_pcm_sha256:string;expected_mix_pcm_sha256:string;source_audio_evidence_hash:string;encoded_audio_evidence_hash:string;
  sample_rate:48000;channels:2;samples:number;unit_native_gain:true;music:NativeAudioContract['music']|null;
  encoded_mix_comparison:ReturnType<typeof compareEncodedMix>;caption_frames:number[];caption_style:NativeAudioContract['caption_style'];
  font_binding:ResourceBinding;caption_script_sha256:string;
  files:{kind:AudioKind;sha256:string;size_bytes:number;mime_type:string}[];semantic_review:'PENDING';independent_listening:'REQUIRED';
}
interface NativeContractEvidence {snapshot:ExecutionContext['snapshot'];outputs:{artifact_id:string;slot_id:string;sha256:string;spec:ArtifactSpec}[]}

/** Complete, unnormalized stereo audio, exclusively for the sealed review pack. */
export function nativeReviewWav(pcm:Buffer):Buffer{
  requireThat(pcm.length>0&&pcm.length%4===0&&pcm.length<=AUDIO_RATE*120*4,'REVIEW_AUDIO_PCM_INVALID','审查音轨长度或PCM格式无效',422);
  const header=Buffer.alloc(44);header.write('RIFF');header.writeUInt32LE(36+pcm.length,4);header.write('WAVEfmt ',8);header.writeUInt32LE(16,16);
  header.writeUInt16LE(1,20);header.writeUInt16LE(2,22);header.writeUInt32LE(AUDIO_RATE,24);header.writeUInt32LE(AUDIO_RATE*4,28);
  header.writeUInt16LE(4,32);header.writeUInt16LE(16,34);header.write('data',36);header.writeUInt32LE(pcm.length,40);
  return Buffer.concat([header,pcm]);
}
/** Nearest actual 30fps frames at phrase/word boundaries and midpoints. These
 * expose rendered captions; they are not OCR or a claim that a word was spoken. */
export function nativeCaptionFrames(transcript:NativeTranscript,targetFrames:number):number[]{
  requireThat(Number.isSafeInteger(targetFrames)&&targetFrames>0&&targetFrames<=3600,'REVIEW_AUDIO_TIMELINE_INVALID','审查时间轴无效',422);
  const frames=new Set<number>();
  for(const segment of transcript.segments)for(const item of [segment,...(segment.words??[])]){
    requireThat(Number.isFinite(item.start_ms)&&Number.isFinite(item.end_ms)&&item.start_ms>=0&&item.end_ms>item.start_ms
      &&item.end_ms<=targetFrames*1000/30,'REVIEW_AUDIO_TIMELINE_INVALID','实际字幕时间超出原整轨',422);
    for(const ms of [item.start_ms,(item.start_ms+item.end_ms)/2,Math.max(item.start_ms,item.end_ms-1)])
      frames.add(Math.min(targetFrames-1,Math.floor(ms*30/1000)));
  }
  return [...frames].sort((a,b)=>a-b);
}
/** Contract prerequisite only. Stage, inference, report and publication
 * callers additionally revalidate the paid original listening evidence. */
export function requireAudioReviewAdmission(context:ExecutionContext):void{
  requireThat(!orderNeedsListening(context.contract)||Boolean(frozenOrderListening(context.contract)),'INDEPENDENT_AUDIO_REVIEW_REQUIRED',
    '原生声音缺少冻结的独立听音合同，不能执行最终复核或交付',503);
}
export async function nativeQcResources(db:Db,store:ObjectStorage,context:ExecutionContext):Promise<void>{
  if(plusVideoBinding(context.contract.source)){await verifyResourceLicenses(db,context.snapshot.resource_versions);return;}
  await verifyNativeAudioLive(db,context.contract,true);const audio=frozenNativeAudio(context.contract)!;
  if(audio.music){
    const right=audio.rights.find(r=>r.kind==='MUSIC');requireThat(right?.media,'AUDIO_MUSIC_MEDIA_UNAVAILABLE','声音封存缺少实际许可配乐',503);
    const bytes=await store.get(right.media.object_key,right.media.size_bytes);
    requireThat(bytes.length===right.media.size_bytes&&sha256(bytes)===audio.music.binding.hash,
      'AUDIO_MUSIC_MEDIA_CHANGED','声音封存前实际配乐已变化',503);
  }
}

export async function nativeAudioQc(db:Db,cfg:Config,store:ObjectStorage,context:ExecutionContext,
  production:MediaReceipt,post:MediaReceipt,directory:string,signal:AbortSignal):Promise<NativeQcBundle>{
  const audio=frozenNativeAudio(context.contract);requireThat(audio,'AUDIO_CONTRACT_REQUIRED','声音文件验收缺少原冻结合同',503);
  const videos=post.artifacts.filter(a=>a.spec.kind==='video').sort((a,b)=>a.slot_id.localeCompare(b.slot_id)),video=videos[0];
  requireThat(video?.spec.native_audio?.post&&videos.every(a=>a.sha256===video.sha256&&a.spec.native_audio
    &&hash(a.spec.native_audio)===hash(video.spec.native_audio)),'REVIEW_AUDIO_SOURCE_INVALID','声音验收必须覆盖同一原完整成片及全部视频槽位',503);
  const proof=video.spec.native_audio.post,source=production.artifacts.find(a=>a.id===proof.source_artifact_id);
  requireThat(source?.spec.kind==='video'&&source.sha256===proof.kernel.source_sha256,'REVIEW_AUDIO_SOURCE_INVALID','原声音制作文件缺失或已替换',503);
  const original=await originalNativeTranscript(db,store,context,proof.asr_submission_id,proof.source_write_id);
  requireThat(original.file_sha256===proof.transcript_file_sha256&&hash(original.transcript)===proof.transcript_hash
    &&original.source_sha256===source.sha256,'REVIEW_AUDIO_SOURCE_INVALID','声音验收转写不属于原完整制作整轨',503);
  await mkdir(directory,{recursive:true});
  return withAudioDeadline({directory,deadline_at:context.snapshot.deadline_at,signal},async execution=>{
    const raw=await sourceBytes(db,store,context,proof.source_write_id),encoded=await store.get(video.object_key,512_000_000);
    requireThat(sha256(raw)===source.sha256&&sha256(encoded)===video.sha256,'REVIEW_AUDIO_SOURCE_INVALID','声音验收原文件或成片字节不一致',503);
    const rawPath=join(directory,'native.mp4'),finalPath=join(directory,'final.mp4');
    await writeFile(rawPath,raw,{flag:'wx'});await writeFile(finalPath,encoded,{flag:'wx'});
    const native=await decodeNativeAudio(cfg,{...execution,path:rawPath,source_sha256:source.sha256,target_frames:audio.target_frames});
    const final=await decodeNativeAudio(cfg,{...execution,path:finalPath,source_sha256:video.sha256,target_frames:audio.target_frames});
    requireThat(hash(native.evidence)===hash(original.audio)&&hash(final.evidence)===hash(proof.kernel.encoded_audio)
      &&final.evidence.codec==='aac','REVIEW_AUDIO_SOURCE_INVALID','实际完整音轨与原转写或编码证据不一致',503);
    let expected=native.pcm;
    if(audio.music){
      const right=audio.rights.find(r=>r.kind==='MUSIC');requireThat(right?.media,'AUDIO_MUSIC_MEDIA_UNAVAILABLE','许可配乐实际字节未冻结',503);
      const music=await store.get(right.media.object_key,right.media.size_bytes);
      requireThat(music.length===right.media.size_bytes&&sha256(music)===audio.music.binding.hash,'AUDIO_MUSIC_MEDIA_CHANGED','审查配乐与原许可版本不一致',503);
      const path=join(directory,'licensed-music.media');await writeFile(path,music,{flag:'wx'});
      const stream=await audioStreams(cfg,path,execution);
      requireThat(stream.streams.every(s=>s.codec_type==='audio')&&(audio.music.loop_to_timeline||stream.duration>=audio.target_frames/30),
        'MUSIC_TIMELINE_INVALID','审查配乐含画面或缺少短音乐循环授权',422);
      const pcmPath=join(directory,'music.s16le');
      await nativeCommand(cfg,process.env.FFMPEG_PATH?.trim()||'ffmpeg',['-v','error','-xerror','-nostdin','-n',
        ...(audio.music.loop_to_timeline?['-stream_loop','-1']:[]),'-protocol_whitelist','file,pipe','-i',path,'-map','0:a:0',
        '-af',`aresample=48000:async=0,atrim=end_sample=${native.evidence.samples},asetpts=PTS-STARTPTS`,'-t',String(audio.target_frames/30),
        '-ar','48000','-ac','2','-c:a','pcm_s16le','-f','s16le',pcmPath],{cwd:directory,timeoutMs:audioTimeout(execution),signal:execution.signal});
      const musicPcm=await boundedAudioFile(cfg,pcmPath,native.pcm.length);
      expected=mixNativeBed(native.pcm,musicPcm,audio.music.gain_db,audio.music.ducking).mix;
    }
    requireThat(sha256(expected)===proof.kernel.mix_pcm_sha256,'REVIEW_AUDIO_MIX_INVALID','独立重建的原声/许可配乐不符原后期混音',422);
    const comparison=compareEncodedMix(expected,final.pcm),font=await loadProductionFont(cfg.projectRoot);
    const captions=compileNativeCaptions(original.transcript,native.evidence,font,audio.caption_style),captionFrames=nativeCaptionFrames(original.transcript,audio.target_frames);
    requireThat(sha256(captions.script)===proof.kernel.caption_script_sha256,'REVIEW_AUDIO_CAPTIONS_INVALID','原转写、字体或字幕样式与成片凭据不一致',503);
    const files:AudioEvidenceFile[]=[
      {kind:'NATIVE_AUDIO',bytes:nativeReviewWav(native.pcm),mime_type:'audio/wav',artifact_id:video.id},
      {kind:'FINAL_AUDIO',bytes:nativeReviewWav(final.pcm),mime_type:'audio/wav',artifact_id:video.id},
      {kind:'TRANSCRIPT',bytes:original.transcript_bytes,mime_type:'application/json',artifact_id:video.id},
      {kind:'CAPTION_SCRIPT',bytes:Buffer.from(captions.script),mime_type:'text/x-ass; charset=utf-8',artifact_id:video.id}
    ];
    const report:NativeQcReport={version:NATIVE_QC_EVIDENCE_VERSION,snapshot_hash:context.snapshotHash,audio_contract_hash:hash(audio),target_frames:audio.target_frames,
      video_artifact_id:video.id,covered_video_artifact_ids:videos.map(a=>a.id).sort(),source_artifact_id:source.id,source_write_id:proof.source_write_id,
      source_video_sha256:source.sha256,encoded_video_sha256:video.sha256,asr_submission_id:proof.asr_submission_id,
      transcript_sha256:original.file_sha256,transcript_hash:hash(original.transcript),source_pcm_sha256:sha256(native.pcm),encoded_pcm_sha256:sha256(final.pcm),
      expected_mix_pcm_sha256:sha256(expected),source_audio_evidence_hash:hash(native.evidence),encoded_audio_evidence_hash:hash(final.evidence),
      sample_rate:48000,channels:2,samples:native.evidence.samples,unit_native_gain:true,music:audio.music??null,encoded_mix_comparison:comparison,
      caption_frames:captionFrames,caption_style:audio.caption_style,font_binding:font.binding,caption_script_sha256:sha256(captions.script),
      files:files.map(f=>({kind:f.kind,sha256:sha256(f.bytes),size_bytes:f.bytes.length,mime_type:f.mime_type})),
      semantic_review:'PENDING',independent_listening:'REQUIRED'};
    files.push({kind:'AUDIO_QC',bytes:Buffer.from(JSON.stringify(report)),mime_type:'application/json',artifact_id:video.id});
    return {files,caption_frames:captionFrames,asr_submission_id:proof.asr_submission_id,transcript_object_key:original.object_key,
      transcript_sha256:original.file_sha256,source_write_id:proof.source_write_id,audio_contract_hash:hash(audio)};
  });
}

/** Recheck live registered originals and new evidence inside the QC commit. */
export async function nativeQcWrites(db:Db,context:ExecutionContext,objects:{object_key:string;sha256:string}[]):Promise<void>{
  const expected=new Map(objects.map(o=>[o.object_key,o.sha256]));
  requireThat(expected.size>0&&objects.every(o=>expected.get(o.object_key)===o.sha256),'REVIEW_AUDIO_SOURCE_INVALID','声音文件登记存在重复冲突',503);
  const rows=(await db.query<{object_key:string;sha256:string}>(`SELECT object_key,sha256 FROM private_object_writes
    WHERE tenant_id=$1 AND owner_id=$2 AND product_id=$3 AND order_id=$4 AND object_key=ANY($5::text[])
    AND kind IN ('MEDIA','QC') AND state='STORED' AND NOT delete_requested AND expires_at>clock_timestamp() FOR SHARE`,
    [context.tenantId,context.ownerId,context.snapshot.product_id,context.orderId,[...expected.keys()]])).rows;
  requireThat(rows.length===expected.size&&rows.every(r=>expected.get(r.object_key)===r.sha256),
    'REVIEW_AUDIO_SOURCE_REVOKED','声音原件、转写或审查副本已撤权/过期/换源，不能封存',410);
}

/** The packet hashes every file. Verify mandatory audio kinds, canonical WAV
 * bodies, original transcript, caption frames and the frozen source contract. */
export function verifyNativeAudioEvidence(packet:DTO<'ReviewPacket'>,rows:ReviewEvidence[],bytes:Map<string,Buffer>):void{
  const audio=rows.filter(r=>(NATIVE_QC_KINDS as readonly string[]).includes(r.kind));
  requireThat(audio.length===NATIVE_QC_KINDS.length&&NATIVE_QC_KINDS.every(k=>audio.filter(r=>r.kind===k).length===1),
    'REVIEW_AUDIO_EVIDENCE_INCOMPLETE','封存包缺少唯一原声、成片声音、原转写、字幕或技术检测',503);
  const byKind=new Map(audio.map(r=>[r.kind,r])),get=(kind:AudioKind)=>bytes.get(byKind.get(kind)!.id)!;
  let report:NativeQcReport;try{report=JSON.parse(get('AUDIO_QC').toString('utf8')) as NativeQcReport;}
  catch{requireThat(false,'REVIEW_AUDIO_EVIDENCE_CHANGED','声音检测文件不是有效JSON',503);}
  requireThat(report&&report.version===NATIVE_QC_EVIDENCE_VERSION&&Array.isArray(report.files)&&Array.isArray(report.caption_frames)
    &&Array.isArray(report.covered_video_artifact_ids),'REVIEW_AUDIO_EVIDENCE_CHANGED','声音检测文件结构无效',503);
  const contracts=rows.filter(r=>r.kind==='CONTRACT');requireThat(contracts.length===1,'REVIEW_AUDIO_EVIDENCE_INCOMPLETE','声音审查需要唯一原合同',503);
  const contract=JSON.parse(bytes.get(contracts[0]!.id)!.toString('utf8')) as NativeContractEvidence;
  requireThat(contract&&Array.isArray(contract.outputs)&&contract.snapshot,'REVIEW_AUDIO_EVIDENCE_CHANGED','声音原合同结构无效',503);
  const outputs=contract.outputs;
  const video=outputs.find(o=>o.artifact_id===report.video_artifact_id),videos=outputs.filter(o=>o.spec.kind==='video').sort((a,b)=>a.slot_id.localeCompare(b.slot_id));
  requireThat(report.version===NATIVE_QC_EVIDENCE_VERSION&&report.snapshot_hash===packet.snapshot_hash&&hash(contract.snapshot)===packet.snapshot_hash
    &&report.audio_contract_hash===contract.snapshot.native_audio_contract_hash&&video?.spec.native_audio?.post
    &&video===videos[0]&&hash(report.covered_video_artifact_ids)===hash(videos.map(v=>v.artifact_id).sort())
    &&videos.every(v=>v.sha256===report.encoded_video_sha256&&packet.outputs.some(o=>o.asset_id===v.artifact_id&&o.sha256===v.sha256))
    &&audio.every(r=>r.artifact_id===video.artifact_id)&&report.semantic_review==='PENDING'&&report.independent_listening==='REQUIRED',
    'REVIEW_AUDIO_EVIDENCE_CHANGED','声音审查包未绑定原合同、完整视频集合或检测边界',503);
  const proof=video.spec.native_audio.post;
  requireThat(report.source_artifact_id===proof.source_artifact_id&&report.source_write_id===proof.source_write_id
    &&report.source_video_sha256===proof.kernel.source_sha256&&report.encoded_video_sha256===proof.kernel.output_sha256
    &&report.asr_submission_id===proof.asr_submission_id&&report.transcript_sha256===proof.transcript_file_sha256
    &&report.transcript_hash===proof.transcript_hash&&report.expected_mix_pcm_sha256===proof.kernel.mix_pcm_sha256
    &&report.source_audio_evidence_hash===hash(proof.kernel.native_audio)&&report.encoded_audio_evidence_hash===hash(proof.kernel.encoded_audio)
    &&report.caption_script_sha256===proof.kernel.caption_script_sha256&&report.sample_rate===48000&&report.channels===2
    &&report.samples===proof.kernel.native_audio.samples&&report.unit_native_gain===true&&report.target_frames===contract.snapshot.timeline.target_frames,
    'REVIEW_AUDIO_EVIDENCE_CHANGED','声音证据与原制作、ASR、后期或完整时间轴不一致',503);
  requireThat(Array.isArray(report.files)&&report.files.length===4&&NATIVE_QC_KINDS.filter(k=>k!=='AUDIO_QC').every(k=>{
    const f=report.files.find(f=>f.kind===k),body=get(k),row=byKind.get(k)!;
    return f&&f.sha256===row.sha256&&f.sha256===sha256(body)&&f.size_bytes===body.length&&f.mime_type===row.mime_type;
  }),'REVIEW_AUDIO_EVIDENCE_CHANGED','声音文件与封存检测摘要不一致',503);
  for(const [kind,digest] of [['NATIVE_AUDIO',report.source_pcm_sha256],['FINAL_AUDIO',report.encoded_pcm_sha256]] as const){
    const wav=get(kind),pcm=wav.subarray(44);
    requireThat(wav.equals(nativeReviewWav(pcm))&&pcm.length===report.samples*4&&sha256(pcm)===digest
      &&digest===(kind==='NATIVE_AUDIO'?proof.kernel.native_audio.pcm_sha256:proof.kernel.encoded_audio.pcm_sha256),
      'REVIEW_AUDIO_EVIDENCE_CHANGED','封存完整双声道PCM与原音轨证据不一致',503);
  }
  const transcript=JSON.parse(get('TRANSCRIPT').toString('utf8')) as NativeTranscript;
  requireThat(sha256(get('TRANSCRIPT'))===report.transcript_sha256&&hash(transcript)===report.transcript_hash
    &&transcript.pcm_sha256===report.source_pcm_sha256&&sha256(get('CAPTION_SCRIPT'))===report.caption_script_sha256
    &&hash(report.caption_frames)===hash(nativeCaptionFrames(transcript,report.target_frames))
    &&report.caption_frames.every((f:number)=>rows.some(r=>r.kind==='VIDEO_FRAME'&&r.artifact_id===video.artifact_id&&r.frame_index===f)),
    'REVIEW_AUDIO_EVIDENCE_INCOMPLETE','原转写、字幕或实际字幕时间点视频帧不完整',503);
}
