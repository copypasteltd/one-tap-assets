import {writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import type {Db} from '../../api/db/pool.js';
import type {Config} from '../../api/config.js';
import type {ObjectStorage} from '../../api/storage/storage.js';
import {hash,sha256} from '../../api/lib/crypto.js';
import {requireThat} from '../../api/lib/errors.js';
import {PendingExternal,type StageLease} from '../queue/leases.js';
import {frozenNativeAudio} from '../audio/contract.js';
import {frozenAiDisclosure} from '../compiler/disclosure.js';
import {disclosureRaster} from '../media/disclosure.js';
import {assembleNativeAudio,verifyNativeAssembly,type NativeAssemblyProof,type NativeSegment} from '../media/native-audio-assembly.js';
import {renderNativeAudioPost} from '../media/native-audio-post.js';
import {sampleGenerationContext} from './generation.js';
import {verifySampleNativeLive,samplePlan,sampleSuggestedPlan,type SampleContext} from './context.js';
import {projectSampleContract} from './generation-contract.js';
import {SampleSpeechGateway,SampleSpeechReader} from './speech.js';
import {artifactBytes,storedMedia,sampleGeneratedMaterial,type SampleArtifact} from './media.js';

export type SampleNativeProof={version:'YPCC-SAMPLE-NATIVE-MEDIA-1';contract_hash:string} &
 ({phase:'PRODUCTION';assembly:NativeAssemblyProof}|{phase:'POST';source_artifact_id:string;source_write_id:string;source_sha256:string;
   asr_submission_id:string;transcript_hash:string;transcript_file_sha256:string;proof:Awaited<ReturnType<typeof renderNativeAudioPost>>['proof']});

export async function preflightSampleNative(db:Db,cfg:Config,store:ObjectStorage,c:SampleContext){
  if(!c.input.generation?.audio)return;
  await verifySampleNativeLive(db,cfg,c);
  requireThat(store.signedReadUrl,'ASR_PRIVATE_URL_UNAVAILABLE','有声样例需要支持受限HTTPS读取的私有存储',503);
  const a=frozenNativeAudio(projectSampleContract(c.input,c.private.creative?samplePlan(c):sampleSuggestedPlan(c)))!;
  if(a.music){const right=a.rights.find(r=>r.kind==='MUSIC');requireThat(right?.media,'AUDIO_MUSIC_MEDIA_UNAVAILABLE','样例配乐没有独立许可媒体',503);
    const bytes=await store.get(right.media.object_key,right.media.size_bytes);
    requireThat(bytes.length===right.media.size_bytes&&sha256(bytes)===right.media.sha256&&sha256(bytes)===right.binding.hash,
      'AUDIO_MUSIC_MEDIA_CHANGED','样例配乐原字节不一致',503);}
}

function segments(c:SampleContext,material:Awaited<ReturnType<typeof sampleGeneratedMaterial>>):NativeSegment[]{
  const g=sampleGenerationContext(c);
  return material.videoKeys.map((key,index)=>{const source=material.outputs.get(key)!,shot=g.contract.creative.shots[index];
    return {node_key:key,start_frame:g.snapshot.engine==='REFERENCE_FILM'?0:shot!.start_frame,
      end_frame:g.snapshot.engine==='REFERENCE_FILM'?g.snapshot.timeline.target_frames:shot!.end_frame,source_sha256:source.source.sha256,bytes:source.bytes};});
}
export async function produceSampleNative(db:Db,cfg:Config,store:ObjectStorage,c:SampleContext,directory:string,signal:AbortSignal){
  await verifySampleNativeLive(db,cfg,c);const g=sampleGenerationContext(c),a=frozenNativeAudio(g.contract)!;
  const made=await assembleNativeAudio(cfg,{directory,deadline_at:c.input.deadline_at,signal,target_frames:a.target_frames,
    segments:segments(c,await sampleGeneratedMaterial(db,cfg,store,c)),disclosure:await disclosureRaster(cfg,frozenAiDisclosure(g.contract)!,1080,1920)});
  return {...made,native_audio:{version:'YPCC-SAMPLE-NATIVE-MEDIA-1',phase:'PRODUCTION',contract_hash:hash(a),assembly:made.proof} satisfies SampleNativeProof};
}
export async function sampleNativeSource(db:Db,store:ObjectStorage,c:SampleContext){
  const videos=storedMedia(c,'PRODUCTION').artifacts.filter(a=>a.kind==='video').sort((a,b)=>a.slot_id.localeCompare(b.slot_id)),a=videos[0];
  requireThat(a?.native_audio?.phase==='PRODUCTION'&&videos.every(v=>v.sha256===a.sha256&&hash(v.native_audio)===hash(a.native_audio)),
    'SAMPLE_AUDIO_SOURCE_INVALID','样例只可使用原制作清单的唯一完整原声音轨',503);
  const w=(await db.query<{id:string}>(`SELECT id FROM private_object_writes WHERE tenant_id=$1 AND owner_id=$2 AND product_id=$3
    AND order_id IS NULL AND object_key=$4 AND sha256=$5 AND kind='MEDIA' AND state='STORED' AND NOT delete_requested AND expires_at>now()`,
    [c.input.tenant_id,c.input.owner_id,c.input.request.product_id,a.object_key,a.sha256])).rows[0];
  requireThat(w,'SAMPLE_AUDIO_SOURCE_INVALID','样例整轨已撤销或过期',410);
  return {artifact:a,writeId:w.id,bytes:await artifactBytes(db,store,c,a)};
}
async function postInput(db:Db,cfg:Config,store:ObjectStorage,c:SampleContext,directory:string,signal:AbortSignal,
  source:Awaited<ReturnType<typeof sampleNativeSource>>,transcript:import('../media/native-captions.js').NativeTranscript){
  const a=frozenNativeAudio(sampleGenerationContext(c).contract)!,path=join(directory,'native-source.mp4');await writeFile(path,source.bytes);
  let music:import('../media/native-audio-post.js').NativeMusic|undefined;
  if(a.music){const right=a.rights.find(r=>r.kind==='MUSIC');requireThat(right?.media,'AUDIO_MUSIC_MEDIA_UNAVAILABLE','样例配乐缺少实际许可媒体',503);
    const bytes=await store.get(right.media.object_key,right.media.size_bytes);
    requireThat(bytes.length===right.media.size_bytes&&sha256(bytes)===right.media.sha256&&sha256(bytes)===right.binding.hash,'AUDIO_MUSIC_MEDIA_CHANGED','样例配乐与原许可字节不一致',503);
    const musicPath=join(directory,'licensed-music');await writeFile(musicPath,bytes);
    music={path:musicPath,binding:a.music.binding,gain_db:a.music.gain_db,loop_to_timeline:a.music.loop_to_timeline,ducking:a.music.ducking};}
  return renderNativeAudioPost(db,cfg,{directory,deadline_at:c.input.deadline_at,signal,path,source_sha256:source.artifact.sha256,
    target_frames:a.target_frames,resources:sampleGenerationContext(c).contract.resource_versions,transcript,caption_style:a.caption_style,...(music?{music}:{})});
}
export async function postSampleNative(db:Db,cfg:Config,store:ObjectStorage,c:SampleContext,lease:StageLease,gateway:SampleSpeechGateway,directory:string,signal:AbortSignal){
  await verifySampleNativeLive(db,cfg,c);const source=await sampleNativeSource(db,store,c),result=await gateway.submit(lease,source.writeId,signal);
  requireThat(result.state!=='FAILED','SAMPLE_ASR_FAILED','原样例转写失败，不能重购或伪造字幕',422);
  if(result.state!=='SUCCEEDED')throw new PendingExternal(3,'SAMPLE_ASR_PENDING');
  const evidence=await new SampleSpeechReader(db,cfg,store).evidence(c,result.submission_id,source.writeId);
  const made=await postInput(db,cfg,store,c,directory,signal,source,evidence.transcript);
  return {...made,native_audio:{version:'YPCC-SAMPLE-NATIVE-MEDIA-1',phase:'POST',contract_hash:hash(frozenNativeAudio(sampleGenerationContext(c).contract)),
    source_artifact_id:source.artifact.artifact_id,source_write_id:source.writeId,source_sha256:source.artifact.sha256,asr_submission_id:result.submission_id,
    transcript_hash:hash(evidence.transcript),transcript_file_sha256:evidence.file_sha256,proof:made.proof} satisfies SampleNativeProof};
}
export async function verifySampleNativeArtifact(db:Db,cfg:Config,store:ObjectStorage,c:SampleContext,artifact:SampleArtifact,phase:'PRODUCTION'|'POST',directory:string,signal:AbortSignal){
  const p=artifact.native_audio,g=sampleGenerationContext(c),a=frozenNativeAudio(g.contract)!;
  await verifySampleNativeLive(db,cfg,c);
  requireThat(p?.version==='YPCC-SAMPLE-NATIVE-MEDIA-1'&&p.phase===phase&&p.contract_hash===hash(a),'SAMPLE_AUDIO_PROOF_INVALID','原声音媒体证明与样例合同不一致',503);
  const bytes=await artifactBytes(db,store,c,artifact);
  if(p.phase==='PRODUCTION')await verifyNativeAssembly(cfg,{directory,deadline_at:c.input.deadline_at,signal,target_frames:a.target_frames,
    segments:segments(c,await sampleGeneratedMaterial(db,cfg,store,c)),bytes,proof:p.assembly});
  else {
    const source=await sampleNativeSource(db,store,c),e=await new SampleSpeechReader(db,cfg,store).evidence(c,p.asr_submission_id,p.source_write_id);
    requireThat(source.writeId===p.source_write_id&&source.artifact.artifact_id===p.source_artifact_id&&source.artifact.sha256===p.source_sha256
      &&hash(e.transcript)===p.transcript_hash&&e.file_sha256===p.transcript_file_sha256,'SAMPLE_AUDIO_PROOF_INVALID','原声音、实际转写或字幕来源不一致',503);
    const made=await postInput(db,cfg,store,c,directory,signal,source,e.transcript);
    requireThat(sha256(made.bytes)===artifact.sha256&&hash(made.proof)===hash(p.proof),'SAMPLE_AUDIO_PROOF_INVALID','实际后期文件与原声保留、字幕和许可混音不一致',503);
  }
}

/** Cheap receipt recheck for commits/publication. Pixel/PCM checks run in verifyMedia. */
export async function verifySampleNativeBindings(db:Db,cfg:Config,store:ObjectStorage,c:SampleContext,receipt:import('./media.js').SampleMediaReceipt){
  if(!c.input.generation?.audio)return;
  await verifySampleNativeLive(db,cfg,c);const a=frozenNativeAudio(sampleGenerationContext(c).contract)!;
  for(const artifact of receipt.artifacts.filter(a=>a.kind==='video')){
    const p=artifact.native_audio;
    requireThat(p?.phase===receipt.phase&&p.contract_hash===hash(a),'SAMPLE_AUDIO_PROOF_INVALID','样例声音证明与原阶段不一致',503);
    if(p.phase==='PRODUCTION')requireThat(p.assembly.output_sha256===artifact.sha256&&p.assembly.target_frames===a.target_frames&&p.assembly.original_gain_db===0,
      'SAMPLE_AUDIO_PROOF_INVALID','原声拼接与原整轨不一致',503);
    else {
      const source=await sampleNativeSource(db,store,c),e=await new SampleSpeechReader(db,cfg,store).evidence(c,p.asr_submission_id,p.source_write_id);
      requireThat(p.source_write_id===source.writeId&&p.source_artifact_id===source.artifact.artifact_id&&p.source_sha256===source.artifact.sha256
        &&p.transcript_hash===hash(e.transcript)&&p.transcript_file_sha256===e.file_sha256&&p.proof.output_sha256===artifact.sha256
        &&p.proof.source_sha256===source.artifact.sha256&&p.proof.transcript_hash===hash(e.transcript),
        'SAMPLE_AUDIO_PROOF_INVALID','样例原声、实际转写与后期来源不一致',503);
      for(const right of a.rights){if(right.allocation_micro===0)continue;
        const b=(await db.query<{state:string;amount_micro:string;settled_micro:string;rate_snapshot:unknown}>(
          'SELECT state,amount_micro,settled_micro,rate_snapshot FROM platform_budget_reservations WHERE tenant_id=$1 AND intent_key=$2',
          [c.input.tenant_id,`sample-license:${c.input.tenant_id}:${c.input.sample_id}:${right.kind}:${right.binding.license_record_id}`])).rows[0];
        requireThat(b?.state==='SETTLED'&&Number(b.amount_micro)===right.allocation_micro&&Number(b.settled_micro)===right.allocation_micro
          &&hash(b.rate_snapshot)===hash({component:'SAMPLE_NATIVE_AUDIO',sample_id:c.input.sample_id,input_hash:c.inputHash,kind:'LICENSE',right}),
          'SAMPLE_AUDIO_LICENSE_BILLING_INVALID','样例声音许可未按原平台分摊结算',503);
      }
    }
  }
}
