import {orderNeedsListening} from '../audio/listening-contract.js';
import {plusVideoBinding} from '../../shared/domain/plus-video.js';
import type {Db} from '../../api/db/pool.js';
import type {Config} from '../../api/config.js';
import type {ObjectStorage} from '../../api/storage/storage.js';
import type {DTO} from '../../shared/contracts/types.js';
import {hash,sha256} from '../../api/lib/crypto.js';
import {requireThat} from '../../api/lib/errors.js';
import type {ExecutionContext} from '../compiler/order-context.js';
import {readDeliveredNativeListening,type DeliveredListeningAuthority} from '../audio/delivered-listening.js';
import type {ListeningEvidence} from '../audio/listening-gateway.js';
import {nativeQcResources,nativeQcWrites} from '../review/native-audio.js';
import {verifySealedEvidence} from '../review/qc.js';
import type {RevisionContext} from './context.js';

export interface RetainedNativeAudio {
  version:'YPCC-REVISION-RETAINED-NATIVE-AUDIO-1';source_packet_id:string;source_packet_hash:string;
  original_snapshot_hash:string;audio_contract_hash:string;source_output_set_hash:string;
  video_bindings:{deliverable_id:string;slot_id:string;sha256:string}[];
  native_listening:ListeningEvidence;
  text_evidence:{asset_id:string;kind:string;sha256:string;content:string}[];
  audio_evidence:{asset_id:string;kind:string;sha256:string;artifact_id:string|null}[];
}
export function audioAuthority(c:RevisionContext):DeliveredListeningAuthority{return {revision_id:c.row.id,input_hash:c.inputHash};}
/** All words/observations come from original immutable bytes. The new facts
 * and style roles receive the complete evidence and assess the new copy. */
export async function retainedNativeAudio(db:Db,cfg:Config,store:ObjectStorage,c:RevisionContext,
  context:ExecutionContext,packet:DTO<'ReviewPacket'>):Promise<RetainedNativeAudio|null>{
  if(!orderNeedsListening(c.contract))return null;
  const video=plusVideoBinding(c.contract.source);
  await nativeQcResources(db,store,context);
  const rows=await verifySealedEvidence(db,store,packet);await nativeQcWrites(db,context,rows);
  const native_listening=await readDeliveredNativeListening(db,cfg,store,context,audioAuthority(c));
  const text_evidence:RetainedNativeAudio['text_evidence']=[];
  for(const kind of (video?['CAPTION_SCRIPT','AUDIO_QC']:['TRANSCRIPT','CAPTION_SCRIPT','AUDIO_QC'])){
    const row=rows.filter(r=>r.kind===kind);requireThat(row.length===1,'REVISION_AUDIO_EVIDENCE_INCOMPLETE','有声售后缺少唯一原转写、字幕或声音检测',503);
    const r=row[0]!,bytes=await store.get(r.object_key,1_000_000);
    requireThat(sha256(bytes)===r.sha256,'REVISION_AUDIO_EVIDENCE_CHANGED','有声售后原转写、字幕或声音检测已变化',503);
    text_evidence.push({asset_id:r.id,kind:r.kind,sha256:r.sha256,content:new TextDecoder('utf-8',{fatal:true}).decode(bytes)});
  }
  const video_bindings=c.parent.items.filter(i=>i.kind==='video').map(i=>({deliverable_id:i.deliverable_id,slot_id:i.slot_id,sha256:i.sha256}));
  requireThat(video_bindings.length>0&&video_bindings.every(i=>packet.outputs.some(o=>o.asset_id===i.deliverable_id&&o.sha256===i.sha256&&o.slot_id===i.slot_id)),
    'REVISION_AUDIO_MEDIA_CHANGED','有声售后必须保留完整原音视频与字幕文件',503);
  requireThat(video?context.snapshot.listening_contract_hash===hash(c.contract.listening_contract):context.snapshot.native_audio_contract_hash===hash(c.contract.native_audio_contract),
    'REVISION_AUDIO_CONTRACT_CHANGED','有声售后合同与原快照不一致',503);
  return {version:'YPCC-REVISION-RETAINED-NATIVE-AUDIO-1',source_packet_id:packet.packet_id,source_packet_hash:packet.packet_hash,
    original_snapshot_hash:context.snapshotHash,audio_contract_hash:video?hash(video):context.snapshot.native_audio_contract_hash!,source_output_set_hash:packet.output_set_hash,
    video_bindings,native_listening,text_evidence,audio_evidence:rows.filter(r=>r.kind==='NATIVE_AUDIO'||r.kind==='FINAL_AUDIO')
      .map(r=>({asset_id:r.id,kind:r.kind,sha256:r.sha256,artifact_id:r.artifact_id}))};
}
