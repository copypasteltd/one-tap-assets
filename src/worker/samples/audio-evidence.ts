import {writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {canonicalize} from '../../shared/domain/json.js';
import type pg from 'pg';
import type {Db} from '../../api/db/pool.js';
import type {Config} from '../../api/config.js';
import type {ObjectStorage} from '../../api/storage/storage.js';
import {writePrivateObject} from '../../api/storage/private-objects.js';
import {hash,sha256} from '../../api/lib/crypto.js';
import {requireThat} from '../../api/lib/errors.js';
import {decodeNativeAudio} from '../media/native-audio.js';
import type {NativeTranscript} from '../media/native-captions.js';
import {frozenNativeAudio} from '../audio/contract.js';
import {verifyListeningLive} from '../audio/listening-contract.js';
import {prepareListening,type ListeningAudio} from '../providers/omni-listening.js';
import {checkReviewImages,type ReviewImage} from '../codex/review-images.js';
import {sampleAdmission,verifySampleNativeLive,type SampleContext} from './context.js';
import {sampleGenerationContext} from './generation.js';
import {sampleNativeSource} from './native-media.js';
import {artifactBytes,storedMedia} from './media.js';
import {SampleSpeechReader} from './speech.js';
import type {SamplePacket} from './review.js';

export interface SampleAudioPacket {
  version:'YPCC-SAMPLE-AUDIO-EVIDENCE-1';contract_hash:string;source_sha256:string;final_sha256:string;
  asr_submission_id:string;source_write_id:string;transcript_hash:string;transcript_file_sha256:string;transcript:NativeTranscript;
  audios:{asset_id:string;kind:'NATIVE_AUDIO'|'FINAL_AUDIO';object_key:string;sha256:string;size_bytes:number}[];
}
function stereoWav(pcm:Buffer){
  const h=Buffer.alloc(44);h.write('RIFF');h.writeUInt32LE(36+pcm.length,4);h.write('WAVEfmt ',8);h.writeUInt32LE(16,16);
  h.writeUInt16LE(1,20);h.writeUInt16LE(2,22);h.writeUInt32LE(48000,24);h.writeUInt32LE(192000,28);h.writeUInt16LE(4,32);h.writeUInt16LE(16,34);
  h.write('data',36);h.writeUInt32LE(pcm.length,40);return Buffer.concat([h,pcm]);
}
export async function buildSampleAudioPacket(pool:pg.Pool,cfg:Config,store:ObjectStorage,c:SampleContext,directory:string,signal:AbortSignal):Promise<SampleAudioPacket>{
  await verifySampleNativeLive(pool,cfg,c);const source=await sampleNativeSource(pool,store,c),a=frozenNativeAudio(sampleGenerationContext(c).contract)!;
  const videos=storedMedia(c,'POST').artifacts.filter(a=>a.kind==='video'),final=videos[0],p=final?.native_audio;
  requireThat(final&&p?.phase==='POST'&&videos.every(v=>v.sha256===final.sha256&&hash(v.native_audio)===hash(p)),
    'SAMPLE_AUDIO_PROOF_INVALID','样例最终声音必须来自同一完整原声后期',503);
  const e=await new SampleSpeechReader(pool,cfg,store).evidence(c,p.asr_submission_id,source.writeId),audios:SampleAudioPacket['audios']=[];
  for(const [kind,bytes] of [['NATIVE_AUDIO',source.bytes],['FINAL_AUDIO',await artifactBytes(pool,store,c,final)]] as const){
    const path=join(directory,`${kind}.mp4`);await writeFile(path,bytes);
    const decoded=await decodeNativeAudio(cfg,{directory,deadline_at:c.input.deadline_at,signal,path,source_sha256:sha256(bytes),target_frames:a.target_frames});
    const wav=stereoWav(decoded.pcm),digest=sha256(wav),assetId=`sampleaudio_${sha256(`${c.input.sample_id}:${kind}:${digest}`).slice(0,32)}`;
    const key=`${c.input.tenant_id}/samples/${c.input.sample_id}/qc/audio/${assetId}.wav`;
    await writePrivateObject(pool,store,{tenantId:c.input.tenant_id,ownerId:c.input.owner_id,productId:c.input.request.product_id,kind:'QC'},key,wav,'audio/wav');
    audios.push({asset_id:assetId,kind,object_key:key,sha256:digest,size_bytes:wav.length});
  }
  return {version:'YPCC-SAMPLE-AUDIO-EVIDENCE-1',contract_hash:hash(a),source_sha256:source.artifact.sha256,final_sha256:final.sha256,
    asr_submission_id:p.asr_submission_id,source_write_id:source.writeId,transcript_hash:hash(e.transcript),transcript_file_sha256:e.file_sha256,transcript:e.transcript,audios};
}
/** Exact original complete input, also used by the read-only publication check. */
export async function prepareSampleListening(db:Db,cfg:Config,store:ObjectStorage,c:SampleContext,packet:SamplePacket){
  await verifySampleNativeLive(db,cfg,c);const g=sampleGenerationContext(c),a=packet.native_audio;
  const {packet_hash:_,listening:__,...body}=packet,baseHash=hash(body);
  requireThat(packet.sample_id===c.input.sample_id&&packet.input_hash===c.inputHash&&packet.output_set_hash===hash(storedMedia(c,'POST').artifacts)
    &&a?.version==='YPCC-SAMPLE-AUDIO-EVIDENCE-1'&&a.contract_hash===hash(frozenNativeAudio(g.contract)),
    'SAMPLE_LISTENING_INPUT_CHANGED','样例整轨封存输入已变化',503);
  const source=await sampleNativeSource(db,store,c),e=await new SampleSpeechReader(db,cfg,store).evidence(c,a.asr_submission_id,a.source_write_id);
  const final=storedMedia(c,'POST').artifacts.find(v=>v.kind==='video')!;
  await artifactBytes(db,store,c,final);
  requireThat(a.source_sha256===source.artifact.sha256&&a.final_sha256===final.sha256&&a.source_write_id===source.writeId
    &&a.transcript_hash===hash(e.transcript)&&hash(a.transcript)===hash(e.transcript)&&a.transcript_file_sha256===e.file_sha256,
    'SAMPLE_LISTENING_INPUT_CHANGED','样例原声、后期或转写输入不一致',503);
  const audios:ListeningAudio[]=[],images:ReviewImage[]=[];
  for(const item of [...a.audios,...packet.images]){
    const w=(await db.query<{sha256:string}>(`SELECT sha256 FROM private_object_writes WHERE tenant_id=$1 AND owner_id=$2 AND product_id=$3
      AND order_id IS NULL AND object_key=$4 AND sha256=$5 AND kind IN ('QC','MEDIA') AND state='STORED' AND NOT delete_requested AND expires_at>now()`,
      [c.input.tenant_id,c.input.owner_id,c.input.request.product_id,item.object_key,item.sha256])).rows[0];
    requireThat(w&&item.object_key.startsWith(`${c.input.tenant_id}/samples/${c.input.sample_id}/`),'SAMPLE_AUDIO_EVIDENCE_REVOKED','样例听音文件或实际画面已撤销',410);
    const bytes=await store.get(item.object_key,32_000_000);requireThat(sha256(bytes)===item.sha256,'SAMPLE_AUDIO_EVIDENCE_CHANGED','实际听音文件字节变化',503);
    if('kind' in item){
      const production=source.artifact.native_audio,post=final.native_audio;
      const expected=item.kind==='NATIVE_AUDIO'&&production?.phase==='PRODUCTION'?production.assembly.assembled_pcm_sha256:
        item.kind==='FINAL_AUDIO'&&post?.phase==='POST'?post.proof.encoded_audio.pcm_sha256:null;
      requireThat(expected&&bytes.length===44+g.snapshot.timeline.target_frames*1600*4&&sha256(bytes.subarray(44))===expected,
        'SAMPLE_AUDIO_EVIDENCE_CHANGED','完整WAV必须与原整轨实际PCM证据逐样本一致',503);
      audios.push({asset_id:item.asset_id,sha256:item.sha256,kind:item.kind,bytes});}
    else images.push({asset_id:item.asset_id,sha256:item.sha256,width:item.width,height:item.height,bytes});
  }
  await checkReviewImages(images,sampleAdmission(cfg,c));const contract=await verifyListeningLive(db,cfg,g.contract);
  // PostgreSQL JSONB changes object key order. Rebuild the exact original wire
  // bytes from canonical facts so a saved packet never looks like a new purchase.
  const facts=JSON.parse(canonicalize({profile:c.input.profile,transcript:e.transcript,
    caption_style:g.contract.native_audio_contract!.caption_style,music:g.contract.native_audio_contract!.music,
    frames:packet.images.map(i=>({asset_id:i.asset_id,frame_index:i.frame_index,time_ms:i.time_ms}))})!);
  return {c:contract,prepared:prepareListening(contract,{packet_hash:baseHash,snapshot_hash:c.inputHash,output_set_hash:packet.output_set_hash,
    target_frames:g.snapshot.timeline.target_frames,audios,images,facts})};
}
