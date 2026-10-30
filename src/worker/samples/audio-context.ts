import type {Db} from '../../api/db/pool.js';
import type {Config} from '../../api/config.js';
import type {ObjectStorage} from '../../api/storage/storage.js';
import {hash,sha256} from '../../api/lib/crypto.js';
import {requireThat} from '../../api/lib/errors.js';
import {lockMediaOwner} from '../../api/modules/media-access.js';
import {assertLease,type StageLease} from '../queue/leases.js';
import {reservePlatform,settlePlatform} from '../budget/platform.js';
import {frozenNativeAudio} from '../audio/contract.js';
import {sampleContext,verifySampleNativeLive,type SampleContext} from './context.js';
import {sampleGenerationContext} from './generation.js';
import {prepareSpeechBytes} from '../speech/input.js';

export async function sampleAudioContext(db:Db,cfg:Config,lease:StageLease,stage:'SAMPLE_POST'|'SAMPLE_QC'){
  requireThat(lease.scope_type==='SAMPLE'&&lease.stage_name===stage,'SAMPLE_AUDIO_SCOPE_INVALID','声音调用只属于原样例阶段',403);
  const owner=(await db.query<{owner_id:string}>('SELECT owner_id FROM public_samples WHERE tenant_id=$1 AND id=$2',[lease.tenant_id,lease.scope_id])).rows[0];
  requireThat(owner,'SAMPLE_INPUT_UNAVAILABLE','原样例不可用',409);
  await lockMediaOwner(db,lease.tenant_id,owner.owner_id);await assertLease(db,lease);
  const c=await sampleContext(db,lease.tenant_id,lease.scope_id,lease.input_hash,true);
  requireThat(c.input.generation?.audio&&c.input.deadline_at===lease.deadline_at.toISOString(),
    'SAMPLE_AUDIO_SCOPE_INVALID','样例缺少原冻结声音能力或原截止不一致',503);
  await verifySampleNativeLive(db,cfg,c,true);
  return {...sampleGenerationContext(c),sample:c};
}
export type SampleAudioContext=Awaited<ReturnType<typeof sampleAudioContext>>;

/** One ledger for this sample's originally frozen audio split. Never touches buyer reservations. */
export async function reserveSampleAudio(db:Db,c:SampleContext,intent:string,amount:number,detail:Record<string,unknown>):Promise<string>{
  const audio=c.input.generation?.audio;requireThat(audio,'SAMPLE_AUDIO_NOT_FROZEN','原样例没有声音额度',503);
  await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`sample-audio:${c.input.tenant_id}:${c.input.sample_id}`]);
  const snapshot={component:'SAMPLE_NATIVE_AUDIO',sample_id:c.input.sample_id,input_hash:c.inputHash,...detail};
  const old=(await db.query<{id:string;amount_micro:string;rate_snapshot:unknown}>(
    'SELECT id,amount_micro,rate_snapshot FROM platform_budget_reservations WHERE tenant_id=$1 AND intent_key=$2 FOR UPDATE',[c.input.tenant_id,intent])).rows[0];
  if(old){requireThat(Number(old.amount_micro)===amount&&hash(old.rate_snapshot)===hash(snapshot),'SAMPLE_AUDIO_COST_CHANGED','原样例费用意图不可替换',409);return old.id;}
  const used=(await db.query<{amount:string}>(`SELECT COALESCE(sum(amount_micro),0)::text AS amount FROM platform_budget_reservations
    WHERE tenant_id=$1 AND rate_snapshot->>'component'='SAMPLE_NATIVE_AUDIO' AND rate_snapshot->>'sample_id'=$2`,[c.input.tenant_id,c.input.sample_id])).rows[0]!;
  requireThat(Number(used.amount)+amount<=audio.ceiling_micro,'SAMPLE_AUDIO_BUDGET_EXCEEDED','原样例声音额度不足，不能追加采购',429);
  return reservePlatform(db,{tenantId:c.input.tenant_id,ownerId:c.input.owner_id,category:'CODEX_SAMPLE',dailyCeilingMicro:c.input.limits.daily_ceiling_micro},intent,amount,snapshot);
}
export async function allocateSampleAudioRights(db:Db,c:SampleAudioContext):Promise<void>{
  const audio=frozenNativeAudio(c.contract)!;
  for(const right of audio.rights){
    if(right.allocation_micro===0)continue;
    const intent=`sample-license:${c.tenantId}:${c.sampleId}:${right.kind}:${right.binding.license_record_id}`;
    const reservation=await reserveSampleAudio(db,c.sample,intent,right.allocation_micro,{kind:'LICENSE',right});
    await settlePlatform(db,c.tenantId,reservation,right.allocation_micro);
  }
}
export async function sampleSpeechBytes(db:Db,store:ObjectStorage,c:SampleAudioContext,writeId:string):Promise<Buffer>{
  const p=c.sample.private.production as {artifacts:{kind:string;object_key:string;sha256:string}[]}|undefined;
  requireThat(p&&c.sample.private.production_hash===hash(p),'SAMPLE_AUDIO_SOURCE_INVALID','声音来源缺少原制作检查点',503);
  const row=(await db.query<{object_key:string;sha256:string}>(`SELECT object_key,sha256 FROM private_object_writes
    WHERE tenant_id=$1 AND id=$2 AND owner_id=$3 AND product_id=$4 AND order_id IS NULL AND kind='MEDIA'
    AND state='STORED' AND NOT delete_requested AND expires_at>clock_timestamp() FOR SHARE`,
    [c.tenantId,writeId,c.ownerId,c.snapshot.product_id])).rows[0];
  requireThat(row&&row.object_key.startsWith(`${c.tenantId}/samples/${c.sampleId}/`)
    &&p.artifacts.some(a=>a.kind==='video'&&a.object_key===row.object_key&&a.sha256===row.sha256),
    'SAMPLE_AUDIO_SOURCE_INVALID','转写只可读取本样例的原完整制作视频',410);
  const bytes=await store.get(row.object_key,125_000_000);
  requireThat(sha256(bytes)===row.sha256,'SAMPLE_AUDIO_SOURCE_CHANGED','样例原声视频字节变化',503);return bytes;
}
export async function prepareSampleSpeech(db:Db,cfg:Config,store:ObjectStorage,c:SampleAudioContext,writeId:string,signal:AbortSignal){
  return prepareSpeechBytes(cfg,c.contract,await sampleSpeechBytes(db,store,c,writeId),writeId,c.snapshot.deadline_at,signal);
}
