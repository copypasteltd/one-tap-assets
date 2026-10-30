import {mkdir,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import type {Db} from '../../api/db/pool.js';
import type {Config} from '../../api/config.js';
import {inside} from '../../api/config.js';
import {hash,id,sha256} from '../../api/lib/crypto.js';
import {notFound,requireThat} from '../../api/lib/errors.js';
import {lockMediaOwner} from '../../api/modules/media-access.js';
import type {ObjectStorage} from '../../api/storage/storage.js';
import {executionContext,type ExecutionContext} from '../compiler/order-context.js';
import {assertLease,type StageLease} from '../queue/leases.js';
import {decodeNativeAudio,withAudioDeadline,type NativeAudioEvidence} from '../media/native-audio.js';
import {inspectVideo} from '../media/native.js';
import {frozenSpeechContract,type SpeechContract} from '../providers/dashscope-asr.js';
import {frozenNativeAudio} from '../audio/contract.js';

export interface MonoDerivativeProof {
  version:'YPCC-ASR-MONO-DERIVATIVE-1';policy:'MEAN_STEREO_V1';source_pcm_sha256:string;mono_pcm_sha256:string;
  samples:number;coefficients:[0.5,0.5];energy_ratio:number;min_energy_ratio:0.1;
}
export interface SpeechSource {source_write_id:string;source_sha256:string;audio:NativeAudioEvidence;wav_sha256:string;mono_derivative?:MonoDerivativeProof}
export function verifySpeechDerivative(source:SpeechSource,contract:SpeechContract):void{
  const p=source.mono_derivative;
  requireThat(!contract.channel_policy?!p:!!p&&p.version==='YPCC-ASR-MONO-DERIVATIVE-1'&&p.policy===contract.channel_policy
    &&p.source_pcm_sha256===source.audio.pcm_sha256&&p.samples===source.audio.samples&&/^[a-f0-9]{64}$/.test(p.mono_pcm_sha256)
    &&p.coefficients.length===2&&p.coefficients[0]===0.5&&p.coefficients[1]===0.5&&p.min_energy_ratio===0.1
    &&Number.isFinite(p.energy_ratio)&&p.energy_ratio>=0.1,'ASR_BINDING_INVALID','转写声道副本与原冻结策略或PCM证据不一致',503);
}
/** Equal-weight, round-to-nearest derivative for ASR only. Delivery keeps the
 * original stereo PCM. Reject destructive phase cancellation before buying ASR. */
export function speechMonoDerivative(pcm:Buffer,policy?:SpeechContract['channel_policy']):{mono:Buffer;proof?:MonoDerivativeProof}{
  requireThat(pcm.length>0&&pcm.length%4===0,'ASR_PCM_INVALID','转写立体声PCM格式无效',422);
  const mono=Buffer.alloc(pcm.length/2);let sourceEnergy=0,monoEnergy=0;
  for(let p=0,q=0;p<pcm.length;p+=4,q+=2){
    const left=pcm.readInt16LE(p),right=pcm.readInt16LE(p+2);
    requireThat(policy==='MEAN_STEREO_V1'||left===right,'ASR_STEREO_REVIEW_REQUIRED','不同的左右声道须先完成多声道识别与合并准入',422);
    const sample=policy==='MEAN_STEREO_V1'?Math.round((left+right)/2):left;
    mono.writeInt16LE(sample,q);sourceEnergy+=(left*left+right*right)/2;monoEnergy+=sample*sample;
  }
  if(!policy)return {mono};
  const ratio=sourceEnergy===0?0:monoEnergy/sourceEnergy;
  requireThat(ratio>=0.1,'ASR_STEREO_CANCELLATION','双声道均值存在显著相消，须独立复核后才能转写',422);
  return {mono,proof:{version:'YPCC-ASR-MONO-DERIVATIVE-1',policy,source_pcm_sha256:sha256(pcm),mono_pcm_sha256:sha256(mono),
    samples:pcm.length/4,coefficients:[0.5,0.5],energy_ratio:Number(ratio.toFixed(6)),min_energy_ratio:0.1}};
}
export async function speechContext(db:Db,lease:StageLease):Promise<ExecutionContext>{
  requireThat(lease.scope_type==='ORDER'&&lease.stage_name==='POST','ASR_SCOPE_INVALID','转写只允许原订单后期阶段',403);
  const owner=(await db.query<{owner_id:string}>('SELECT owner_id FROM orders WHERE tenant_id=$1 AND id=$2',[lease.tenant_id,lease.scope_id])).rows[0]??notFound();
  await lockMediaOwner(db,lease.tenant_id,owner.owner_id);await assertLease(db,lease);
  requireThat((await db.query(`SELECT id FROM stage_runs WHERE tenant_id=$1 AND id=$2 AND scope_type='ORDER' AND scope_id=$3
    AND stage_name='POST' AND input_hash=$4 AND deadline_at=$5`,[lease.tenant_id,lease.id,lease.scope_id,lease.input_hash,lease.deadline_at])).rowCount===1,
    'ASR_SCOPE_INVALID','转写租约与原订单、输入或截止不一致',403);
  const context=await executionContext(db,lease.tenant_id,lease.scope_id,lease.input_hash,lease.id);
  if(context.repair)requireThat(frozenNativeAudio(context.contract)?.repair,'ASR_REPAIR_NOT_FROZEN','原订单未预留有声修复转写',409);
  requireThat(context.snapshot.deadline_at===lease.deadline_at.toISOString(),'ASR_SCOPE_INVALID','转写不能延长原订单截止',403);return context;
}
export function boundSpeechContract(context:Pick<ExecutionContext,'contract'>):SpeechContract {
  const c=frozenSpeechContract(context.contract.speech_contract);
  requireThat(context.contract.model_versions.some(m=>m.roles.includes('SPEECH')&&m.provider===c.provider&&m.actual_model===c.actual_model
    &&m.registry_version===c.registry_version&&m.rate_snapshot_id===c.rate_snapshot_id&&m.capability_hash===hash(c)),
    'ASR_MODEL_BINDING_INVALID','转写协议与原订单模型和费率快照不一致',503);return c;
}
export async function sourceBytes(db:Db,store:ObjectStorage,context:ExecutionContext,writeId:string):Promise<Buffer>{
  const row=(await db.query<{object_key:string;sha256:string}>(`SELECT object_key,sha256 FROM private_object_writes WHERE tenant_id=$1 AND id=$2 AND owner_id=$3
    AND order_id=$4 AND product_id=$5 AND kind='MEDIA' AND state='STORED' AND NOT delete_requested AND expires_at>now()`,
    [context.tenantId,writeId,context.ownerId,context.orderId,context.snapshot.product_id])).rows[0];
  requireThat(row,'ASR_SOURCE_REVOKED','转写原视频不属于本订单或已撤权',410);
  const bytes=await store.get(row.object_key,64_000_000);requireThat(sha256(bytes)===row.sha256,'ASR_SOURCE_HASH_MISMATCH','转写原视频字节变化',503);return bytes;
}
/** Explicit single-channel derivative; never silently discard a distinct stereo
 * channel. Native 48k stereo evidence stays bound to the original video. */
export async function prepareSpeechSource(db:Db,cfg:Config,store:ObjectStorage,context:ExecutionContext,writeId:string,signal:AbortSignal):Promise<{source:SpeechSource;wav:Buffer}>{
  return prepareSpeechBytes(cfg,context.contract,await sourceBytes(db,store,context,writeId),writeId,context.snapshot.deadline_at,signal);
}
/** Shared media preparation only. Each caller must authorize its own source and ledger. */
export async function prepareSpeechBytes(cfg:Config,contract:ExecutionContext['contract'],bytes:Buffer,writeId:string,deadlineAt:string,signal:AbortSignal):Promise<{source:SpeechSource;wav:Buffer}>{
  const c=boundSpeechContract({contract}),root=inside(cfg.runtimeRoot,`tmp/asr-${id('input')}`);await mkdir(root,{recursive:true});
  try{return await withAudioDeadline({directory:root,deadline_at:deadlineAt,signal},async execution=>{
    const path=join(root,'source.mp4');await writeFile(path,bytes);
    const inspected=await inspectVideo(cfg,path,execution.signal);
    requireThat(inspected.fps===30&&inspected.frames&&inspected.frames>0&&inspected.frames<=c.max_audio_seconds*30,
      'ASR_SOURCE_INVALID','转写源必须是原30fps且在冻结长度内的视频',422);
    const audio=frozenNativeAudio(contract);
    requireThat(!audio||inspected.frames===audio.target_frames,'ASR_TIMELINE_MISMATCH','转写必须使用原合同完整时间轴，不能把单镜头当作整轨',422);
    const native=await decodeNativeAudio(cfg,{...execution,path,source_sha256:sha256(bytes),target_frames:inspected.frames});
    const {mono,proof}=speechMonoDerivative(native.pcm,c.channel_policy);
    const header=Buffer.alloc(44);header.write('RIFF');header.writeUInt32LE(36+mono.length,4);header.write('WAVEfmt ',8);header.writeUInt32LE(16,16);
    header.writeUInt16LE(1,20);header.writeUInt16LE(1,22);header.writeUInt32LE(48000,24);header.writeUInt32LE(96000,28);header.writeUInt16LE(2,32);header.writeUInt16LE(16,34);
    header.write('data',36);header.writeUInt32LE(mono.length,40);const wav=Buffer.concat([header,mono]);
    return {source:{source_write_id:writeId,source_sha256:sha256(bytes),audio:native.evidence,wav_sha256:sha256(wav),...(proof?{mono_derivative:proof}:{})},wav};
  });}finally{await rm(root,{recursive:true,force:true});}
}
