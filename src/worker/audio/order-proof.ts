import type {Db} from '../../api/db/pool.js';
import type {ObjectStorage} from '../../api/storage/storage.js';
import {hash,sha256} from '../../api/lib/crypto.js';
import {requireThat} from '../../api/lib/errors.js';
import type {ExecutionContext} from '../compiler/order-context.js';
import type {NativeAssemblyProof} from '../media/native-audio-assembly.js';
import type {NativeTranscript} from '../media/native-captions.js';
import {verifySpeechDerivative,type SpeechSource} from '../speech/input.js';
import type {renderNativeAudioPost} from '../media/native-audio-post.js';
import {frozenNativeAudio} from './contract.js';

export const NATIVE_ORDER_MEDIA_VERSION='YPCC-NATIVE-ORDER-MEDIA-1';
export type NativeKernelProof=Awaited<ReturnType<typeof renderNativeAudioPost>>['proof'];
export interface NativeOrderAudio {
  version:typeof NATIVE_ORDER_MEDIA_VERSION;audio_contract_hash:string;assembly:NativeAssemblyProof;
  post?:{source_artifact_id:string;source_write_id:string;asr_submission_id:string;transcript_file_sha256:string;transcript_hash:string;kernel:NativeKernelProof};
}
/** Read the original settled result only. Verification cannot create a task,
 * renew a URL, contact ASR or trust a transcript returned by a model/tool caller. */
export async function originalNativeTranscript(db:Db,store:ObjectStorage,context:ExecutionContext,submissionId:string,sourceWriteId:string){
  const audio=frozenNativeAudio(context.contract);requireThat(audio,'AUDIO_CONTRACT_REQUIRED','转写检查缺少原声音合同',503);
  const row=(await db.query<{stage_run_id:string;input_hash:string;private:{owner_id:string;product_id:string;audio_contract_hash:string;wire_contract:unknown;contract_hash:string;
    billing_valid?:boolean;provider_terminal?:boolean;prepared:{deadline_at:string;source:SpeechSource};
    output?:{object_key:string;sha256:string}}}>(`SELECT p.stage_run_id,p.input_hash,p.private FROM provider_submissions p
    JOIN budget_reservations b ON b.tenant_id=p.tenant_id AND b.id=p.reservation_id AND b.order_id=p.order_id AND b.state='SETTLED'
    JOIN stage_runs s ON s.tenant_id=p.tenant_id AND s.id=p.stage_run_id AND s.scope_type='ORDER' AND s.scope_id=p.order_id AND s.stage_name='POST' AND s.input_hash=$4
    WHERE p.tenant_id=$1 AND p.order_id=$2 AND p.id=$3 AND p.generation_kind='ASR' AND p.state='SUCCEEDED'`,
    [context.tenantId,context.orderId,submissionId,context.snapshotHash])).rows[0],p=row?.private;
  requireThat(row&&p?.output&&p.owner_id===context.ownerId&&p.product_id===context.snapshot.product_id&&p.billing_valid&&p.provider_terminal
    &&p.audio_contract_hash===hash(audio)&&p.contract_hash===hash(audio.asr.contract)&&hash(p.wire_contract)===p.contract_hash
    &&p.prepared.deadline_at===context.snapshot.deadline_at&&p.prepared.source.source_write_id===sourceWriteId
    &&row.input_hash===hash({contract:p.contract_hash,source:p.prepared.source,deadline_at:p.prepared.deadline_at}),
    'AUDIO_ASR_PROOF_INVALID','后期转写没有原订单、整轨、模型、原费用与成功回执',503);
  verifySpeechDerivative(p.prepared.source,audio.asr.contract);
  const write=(await db.query(`SELECT id FROM private_object_writes WHERE tenant_id=$1 AND owner_id=$2 AND order_id=$3 AND product_id=$4
    AND object_key=$5 AND sha256=$6 AND kind='MEDIA' AND state='STORED' AND NOT delete_requested AND expires_at>now()`,
    [context.tenantId,context.ownerId,context.orderId,context.snapshot.product_id,p.output.object_key,p.output.sha256])).rows[0];
  requireThat(write,'AUDIO_ASR_PROOF_REVOKED','原转写成品已撤权或缺少私有存储登记',410);
  const bytes=await store.get(p.output.object_key,4_000_000);requireThat(sha256(bytes)===p.output.sha256,'AUDIO_ASR_PROOF_INVALID','原转写成品字节已变化',503);
  const transcript=JSON.parse(bytes.toString('utf8')) as NativeTranscript;
  requireThat(transcript.source_sha256===p.prepared.source.source_sha256&&transcript.pcm_sha256===p.prepared.source.audio.pcm_sha256
    &&transcript.audio_evidence_hash===hash(p.prepared.source.audio),'AUDIO_ASR_PROOF_INVALID','转写不属于原整轨和实际PCM',503);
  return {transcript,file_sha256:p.output.sha256,source_sha256:p.prepared.source.source_sha256,audio:p.prepared.source.audio,stage_run_id:row.stage_run_id};
}
