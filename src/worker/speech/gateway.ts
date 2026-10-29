import type pg from 'pg';
import {transaction,type Db} from '../../api/db/pool.js';
import {insert} from '../../api/db/store.js';
import {hash,id,sha256} from '../../api/lib/crypto.js';
import {AppError,notFound,requireThat} from '../../api/lib/errors.js';
import type {Config} from '../../api/config.js';
import type {HttpResponse} from '../../api/lib/http.js';
import type {ObjectStorage} from '../../api/storage/storage.js';
import {writePrivateObject} from '../../api/storage/private-objects.js';
import {lockMediaOwner} from '../../api/modules/media-access.js';
import {reserveStageCost,settle} from '../budget/reservations.js';
import {PendingExternal,type StageLease} from '../queue/leases.js';
import type {NativeTranscript} from '../media/native-captions.js';
import {SpeechClient,actualSpeechTranscript,admitSpeechContract,frozenSpeechContract,speechCost,speechRequest,speechTask,type SpeechContract} from '../providers/dashscope-asr.js';
import {boundSpeechContract,prepareSpeechSource,sourceBytes,speechContext,verifySpeechDerivative,type SpeechSource} from './input.js';
import {allocateNativeAudioRights,frozenNativeAudio} from '../audio/contract.js';

type Pointer={ordinal:number;kind:'SUBMIT'|'QUERY'|'RESULT';key:string};
interface Submission {
  id:string;tenant_id:string;order_id:string;stage_run_id:string;generation_kind:'ASR';model_version_id:string;operation_key:string;
  input_hash:string;state:string;provider_task_id:string|null;reservation_id:string;lease_owner:string|null;lease_generation:string;next_query_at:Date|null;
  private:{owner_id:string;product_id:string;wire_contract:SpeechContract;contract_hash:string;audio_contract_hash?:string;request_key:string;request_sha256:string;
    prepared:{source:SpeechSource;url:string;wav_key:string;deadline_at:string};receipts:Pointer[];sending_started_at?:string;
    provider_terminal?:boolean;terminal_receipt_ordinal?:number;billing_valid?:boolean;output?:{object_key:string;sha256:string};};
}
export interface SpeechResult {submission_id:string;state:string;transcript?:NativeTranscript}
const code=(e:unknown)=>e instanceof AppError?e.code:'ASR_OPERATION_FAILED';
/** Internal POST service. No public route, Agent permission or native-order
 * admission is created by constructing this gateway. */
export class SpeechGateway {
  constructor(private pool:pg.Pool,private cfg:Config,private store:ObjectStorage,private client=new SpeechClient(cfg)){}
  private scope(r:Submission,kind:'MEDIA'|'RECEIPT'){
    return {tenantId:r.tenant_id,ownerId:r.private.owner_id,productId:r.private.product_id,orderId:r.order_id,kind};
  }
  private async row(tenant:string,submission:string,db:Db=this.pool,lock=false):Promise<Submission>{
    const r=(await db.query<Submission>(`SELECT * FROM provider_submissions WHERE tenant_id=$1 AND id=$2 AND generation_kind='ASR'${lock?' FOR UPDATE':''}`,[tenant,submission])).rows[0]??notFound();
    const c=frozenSpeechContract(r.private.wire_contract);requireThat(hash(c)===r.private.contract_hash&&c.model_version_id===r.model_version_id
      &&r.input_hash===hash({contract:hash(c),source:r.private.prepared.source,deadline_at:r.private.prepared.deadline_at})
      &&r.private.prepared.source.source_sha256===r.private.prepared.source.audio.source_sha256,'ASR_BINDING_INVALID','原转写绑定已变化',503);
    verifySpeechDerivative(r.private.prepared.source,c);return r;
  }
  private async object(r:Submission,key:string,kind:'MEDIA'|'RECEIPT',maximum:number):Promise<Buffer|null>{
    const record=(await this.pool.query<{sha256:string;state:string;delete_requested:boolean;expires_at:Date}>(`SELECT sha256,state,delete_requested,expires_at FROM private_object_writes
      WHERE tenant_id=$1 AND owner_id=$2 AND product_id=$3 AND order_id=$4 AND object_key=$5 AND kind=$6`,
      [r.tenant_id,r.private.owner_id,r.private.product_id,r.order_id,key,kind])).rows[0];
    if(!record)return null;requireThat(record.state==='STORED','ASR_ORIGINAL_WRITE_PENDING','原转写文件尚未核对完成',503);
    requireThat(kind==='RECEIPT'||!record.delete_requested&&record.expires_at.getTime()>Date.now(),'ASR_MEDIA_REVOKED','原音频文件已撤权或过期',410);
    const bytes=await this.store.get(key,maximum);requireThat(sha256(bytes)===record.sha256,'ASR_OBJECT_HASH_MISMATCH','原转写文件摘要不一致',503);return bytes;
  }
  private async persist(r:Submission,p:Pointer,response:HttpResponse):Promise<void>{
    const envelope={version:1,submission_id:r.id,ordinal:p.ordinal,kind:p.kind,input_hash:r.input_hash,contract_hash:r.private.contract_hash,
      status:response.status,response_sha256:sha256(response.bytes),response_base64:response.bytes.toString('base64')};
    await writePrivateObject(this.pool,this.store,this.scope(r,'RECEIPT'),p.key,Buffer.from(JSON.stringify(envelope)),'application/json');
  }
  private async receipt(r:Submission,p:Pointer):Promise<{status:number;bytes:Buffer;sha256:string}|null>{
    const bytes=await this.object(r,p.key,'RECEIPT',Math.ceil(r.private.wire_contract.max_response_bytes*4/3)+8192);if(!bytes)return null;
    const raw=JSON.parse(bytes.toString('utf8')) as Record<string,unknown>;
    requireThat(raw.version===1&&raw.submission_id===r.id&&raw.ordinal===p.ordinal&&raw.kind===p.kind&&raw.input_hash===r.input_hash
      &&raw.contract_hash===r.private.contract_hash&&Number.isInteger(raw.status)&&Number(raw.status)>=100&&Number(raw.status)<=599
      &&typeof raw.response_base64==='string'&&raw.response_base64.length<=Math.ceil(r.private.wire_contract.max_response_bytes*4/3)+4,
      'ASR_RECEIPT_INVALID','原转写回执绑定或长度变化',503);
    const response=Buffer.from(raw.response_base64,'base64');requireThat(response.toString('base64')===raw.response_base64&&sha256(response)===raw.response_sha256,
      'ASR_RECEIPT_INVALID','原供应商响应字节变化',503);return {status:Number(raw.status),bytes:response,sha256:sha256(bytes)};
  }
  private async apply(r:Submission,p:Pointer):Promise<void>{
    if(p.kind==='RESULT')return;const response=await this.receipt(r,p);if(!response||response.status<200||response.status>=300)return;
    const task=speechTask(JSON.parse(response.bytes.toString('utf8')) as unknown,p.kind==='QUERY'?r.provider_task_id??undefined:undefined);
    if(p.kind==='SUBMIT'){
      requireThat(!r.provider_task_id||r.provider_task_id===task.id,'ASR_TASK_MISMATCH','原转写任务不能更换',503);
      await this.pool.query(`UPDATE provider_submissions SET provider_task_id=$3,state='RUNNING',data=data||'{"state":"RUNNING"}'::jsonb,
        next_query_at=COALESCE(next_query_at,now()+$4::int*interval '1 second'),updated_at=now() WHERE tenant_id=$1 AND id=$2
        AND state IN ('SUBMITTING','UNKNOWN','RUNNING') AND (provider_task_id IS NULL OR provider_task_id=$3)`,[r.tenant_id,r.id,task.id,r.private.wire_contract.poll_seconds]);return;
    }
    if(!['SUCCEEDED','FAILED'].includes(task.status)||r.private.provider_terminal)return;
    // FAILED/UNKNOWN/HTTP errors never imply a zero bill. Missing actual usage
    // retains the original reservation and can only be reconciled, not rebought.
    requireThat(task.seconds!==undefined&&task.seconds===Math.ceil(r.private.prepared.source.audio.duration_ms/1000),
      'ASR_USAGE_INVALID','原转写缺少与实际文件一致的单声道计费秒数',503);
    const actual=speechCost(r.private.wire_contract,task.seconds);
    await transaction(this.pool,async db=>{
      await lockMediaOwner(db,r.tenant_id,r.private.owner_id);await db.query('SELECT id FROM orders WHERE tenant_id=$1 AND id=$2 FOR UPDATE',[r.tenant_id,r.order_id]);
      const current=await this.row(r.tenant_id,r.id,db,true);if(current.private.provider_terminal)return;
      await settle(db,r.tenant_id,r.reservation_id,actual);
      await db.query(`UPDATE provider_submissions SET state=$3,data=data||jsonb_build_object('state',$3::text),private=private||$4::jsonb,updated_at=now()
        WHERE tenant_id=$1 AND id=$2`,[r.tenant_id,r.id,task.status==='FAILED'?'FAILED':'RUNNING',JSON.stringify({provider_terminal:true,terminal_receipt_ordinal:p.ordinal,billing_valid:true})]);
    });
  }
  private async recover(r:Submission):Promise<Submission>{
    for(const p of r.private.receipts){const current=await this.row(r.tenant_id,r.id);if(current.private.provider_terminal)break;await this.apply(current,p);}return this.row(r.tenant_id,r.id);
  }
  private async claim(r:Submission):Promise<Submission|null>{
    return (await this.pool.query<Submission>(`UPDATE provider_submissions SET lease_owner=$3,lease_generation=lease_generation+1,lease_expires_at=now()+interval '180 seconds'
      WHERE tenant_id=$1 AND id=$2 AND state IN ('SUBMITTING','UNKNOWN','RUNNING') AND (lease_owner IS NULL OR lease_expires_at<clock_timestamp()) RETURNING *`,
      [r.tenant_id,r.id,id('asr_worker')])).rows[0]??null;
  }
  private async fence(db:Db,r:Submission):Promise<void>{
    requireThat((await db.query(`SELECT id FROM provider_submissions WHERE tenant_id=$1 AND id=$2 AND lease_owner=$3 AND lease_generation=$4
      AND lease_expires_at>clock_timestamp() FOR UPDATE`,[r.tenant_id,r.id,r.lease_owner,r.lease_generation])).rowCount===1,'ASR_LEASE_LOST','转写原处理代次已失效',409);
  }
  private async release(r:Submission):Promise<void>{
    await this.pool.query(`UPDATE provider_submissions SET lease_owner=NULL,lease_expires_at=NULL WHERE tenant_id=$1 AND id=$2 AND lease_owner=$3 AND lease_generation=$4`,
      [r.tenant_id,r.id,r.lease_owner,r.lease_generation]);
  }
  private async pointer(r:Submission,kind:'QUERY'|'RESULT'):Promise<Pointer|null>{
    return transaction(this.pool,async db=>{await this.fence(db,r);const current=await this.row(r.tenant_id,r.id,db);
      if(kind==='RESULT'){const existing=current.private.receipts.find(p=>p.kind==='RESULT');if(existing)return existing;}
      else {if(current.next_query_at&&current.next_query_at.getTime()>Date.now())return null;
        requireThat(current.private.receipts.filter(p=>p.kind==='QUERY').length<current.private.wire_contract.max_queries,'ASR_QUERY_LIMIT','原转写查询次数已达冻结上限',503);}
      const ordinal=current.private.receipts.length,p:Pointer={ordinal,kind,key:`${r.tenant_id}/speech/${r.order_id}/${r.id}/${kind.toLowerCase()}-${ordinal}.json`};
      await db.query(`UPDATE provider_submissions SET private=jsonb_set(private,'{receipts}',(private->'receipts')||$3::jsonb),
        next_query_at=now()+$4::int*interval '1 second',updated_at=now() WHERE tenant_id=$1 AND id=$2`,[r.tenant_id,r.id,JSON.stringify([p]),current.private.wire_contract.poll_seconds]);return p;
    });
  }
  private async authorize(lease:StageLease,r:Submission):Promise<void>{
    const context=await transaction(this.pool,db=>speechContext(db,lease));
    const audio=frozenNativeAudio(context.contract);
    requireThat(r.order_id===lease.scope_id&&r.stage_run_id===lease.id&&hash(boundSpeechContract(context))===r.private.contract_hash
      &&r.private.audio_contract_hash===(audio?hash(audio):undefined)
      &&context.snapshot.deadline_at===r.private.prepared.deadline_at,'ASR_SCOPE_INVALID','转写与原订单阶段或合同不一致',403);
    requireThat(sha256(await sourceBytes(this.pool,this.store,context,r.private.prepared.source.source_write_id))===r.private.prepared.source.source_sha256,
      'ASR_SOURCE_HASH_MISMATCH','原转写视频绑定变化',503);
  }
  private async run(lease:StageLease,r:Submission,signal:AbortSignal):Promise<SpeechResult>{
    await this.authorize(lease,r);if(r.state==='SUCCEEDED')return this.result(r);if(r.state==='FAILED')return {submission_id:r.id,state:r.state};
    const claimed=await this.claim(r);if(!claimed)throw new PendingExternal(2,'ASR_BUSY');r=claimed;
    try{
      r=await this.recover(r);
      if(!r.private.sending_started_at){
        admitSpeechContract(this.cfg,r.private.wire_contract);
        // A crash before the immutable send marker may finish the same original
        // writes. An uncertain WRITING record still blocks until maintenance.
        let body=await this.object(r,r.private.request_key,'RECEIPT',10000);
        if(!body){body=Buffer.from(speechRequest(r.private.wire_contract,r.private.prepared.url));
          requireThat(sha256(body)===r.private.request_sha256,'ASR_ORIGINAL_REQUEST_MISSING','原请求不能重建为不同内容',503);
          await writePrivateObject(this.pool,this.store,this.scope(r,'RECEIPT'),r.private.request_key,body,'application/json');}
        requireThat(sha256(body)===r.private.request_sha256,'ASR_ORIGINAL_REQUEST_MISSING','原转写请求摘要变化',503);
        let wav=await this.object(r,r.private.prepared.wav_key,'MEDIA',12_000_000);
        if(!wav){const context=await transaction(this.pool,db=>speechContext(db,lease));
          const prepared=await prepareSpeechSource(this.pool,this.cfg,this.store,context,r.private.prepared.source.source_write_id,signal);
          requireThat(hash(prepared.source)===hash(r.private.prepared.source),'ASR_INPUT_CHANGED','原转写音频重建不一致',503);wav=prepared.wav;
          await writePrivateObject(this.pool,this.store,this.scope(r,'MEDIA'),r.private.prepared.wav_key,wav,'audio/wav');}
        requireThat(sha256(wav)===r.private.prepared.source.wav_sha256,'ASR_INPUT_CHANGED','原转写音频已变化',503);
        await transaction(this.pool,async db=>{await speechContext(db,lease);await this.fence(db,r);
          await this.sourceLive(db,r);
          requireThat((await db.query(`SELECT id FROM provider_model_versions WHERE id=$1 AND status='ADMITTED' AND data->>'capability_hash'=$2
            AND private->'speech_contract'=$3::jsonb FOR SHARE`,[r.model_version_id,r.private.contract_hash,JSON.stringify(r.private.wire_contract)])).rowCount===1,'ASR_NOT_ADMITTED','原转写模型已撤销准入',503);
          await db.query(`UPDATE provider_submissions SET private=private||jsonb_build_object('sending_started_at',clock_timestamp()::text) WHERE tenant_id=$1 AND id=$2`,[r.tenant_id,r.id]);});
        const response=await this.client.submit(r.private.wire_contract,body.toString('utf8'),lease.deadline_at,signal);await this.persist(r,r.private.receipts[0]!,response);
        r=await this.recover(await this.row(r.tenant_id,r.id));
      }
      if(!r.provider_task_id)throw new PendingExternal(5,'ASR_ORIGINAL_ACK_UNKNOWN');
      if(!r.private.provider_terminal){const p=await this.pointer(r,'QUERY');if(p){
        const response=await this.client.query(r.private.wire_contract,r.provider_task_id,lease.deadline_at,signal);await this.persist(r,p,response);await this.apply(r,p);r=await this.row(r.tenant_id,r.id);}}
      if(r.state==='FAILED')return {submission_id:r.id,state:r.state};
      if(!r.private.provider_terminal)throw new PendingExternal(r.private.wire_contract.poll_seconds,'ASR_ORIGINAL_TASK_PENDING');
      const terminal=await this.receipt(r,r.private.receipts.find(p=>p.ordinal===r.private.terminal_receipt_ordinal)!);
      requireThat(terminal,'ASR_ORIGINAL_RECEIPT_MISSING','原转写终态回执缺失',503);
      const task=speechTask(JSON.parse(terminal.bytes.toString('utf8')) as unknown,r.provider_task_id??undefined);
      const p=(await this.pointer(r,'RESULT'))!;let result=await this.receipt(r,p);
      if(!result){requireThat(task.result_url,'ASR_RESULT_URL_MISSING','原转写结果地址缺失',503);
        const response=await this.client.download(r.private.wire_contract,task.result_url,lease.deadline_at,signal);
        requireThat(response.status===200,'ASR_RESULT_DOWNLOAD_PENDING','原转写结果不能下载或发生跳转',503);await this.persist(r,p,response);result=await this.receipt(r,p);}
      requireThat(result&&result.status===200,'ASR_RESULT_INVALID','原转写文件无效',503);
      const transcript=actualSpeechTranscript(r.private.wire_contract,result.bytes,{url:r.private.prepared.url,audio:r.private.prepared.source.audio,receipt_sha256:result.sha256});
      const bytes=Buffer.from(JSON.stringify(transcript)),key=`${r.tenant_id}/speech/${r.order_id}/${r.id}/transcript.json`;
      await this.authorize(lease,r);await writePrivateObject(this.pool,this.store,this.scope(r,'MEDIA'),key,bytes,'application/json');
      await transaction(this.pool,async db=>{await speechContext(db,lease);await this.fence(db,r);await this.sourceLive(db,r);
        await db.query(`UPDATE provider_submissions SET state='SUCCEEDED',data=data||'{"state":"SUCCEEDED"}'::jsonb,
          private=private||$3::jsonb,updated_at=now() WHERE tenant_id=$1 AND id=$2`,[r.tenant_id,r.id,JSON.stringify({output:{object_key:key,sha256:sha256(bytes)}})]);});
      return this.result(await this.row(r.tenant_id,r.id));
    }catch(error){await transaction(this.pool,async db=>{
      await lockMediaOwner(db,r.tenant_id,r.private.owner_id);await db.query('SELECT id FROM orders WHERE tenant_id=$1 AND id=$2 FOR UPDATE',[r.tenant_id,r.order_id]);
      await this.fence(db,r);await settle(db,r.tenant_id,r.reservation_id,null);
      await db.query(`UPDATE provider_submissions SET state=CASE WHEN state='SUBMITTING' THEN 'UNKNOWN' ELSE state END,
        private=private||jsonb_build_object('last_error',$3::text),updated_at=now() WHERE tenant_id=$1 AND id=$2`,[r.tenant_id,r.id,code(error)]);
    });throw error;}finally{await this.release(claimed);}
  }
  private async result(r:Submission):Promise<SpeechResult>{
    const o=r.private.output;if(!o)return {submission_id:r.id,state:r.state};const bytes=await this.object(r,o.object_key,'MEDIA',4_000_000);
    requireThat(bytes&&sha256(bytes)===o.sha256,'ASR_OUTPUT_CHANGED','原转写输出缺失或摘要变化',503);
    return {submission_id:r.id,state:r.state,transcript:JSON.parse(bytes.toString('utf8')) as NativeTranscript};
  }
  private async sourceLive(db:Db,r:Submission):Promise<void>{
    requireThat((await db.query(`SELECT id FROM private_object_writes WHERE tenant_id=$1 AND id=$2 AND owner_id=$3 AND order_id=$4
      AND product_id=$5 AND kind='MEDIA' AND state='STORED' AND sha256=$6 AND NOT delete_requested AND expires_at>now() FOR SHARE`,
      [r.tenant_id,r.private.prepared.source.source_write_id,r.private.owner_id,r.order_id,r.private.product_id,r.private.prepared.source.source_sha256])).rowCount===1,
      'ASR_SOURCE_REVOKED','原转写视频在发送或完成前已撤权',410);
  }
  async submit(lease:StageLease,sourceWriteId:string,signal:AbortSignal):Promise<SpeechResult>{
    const context=await transaction(this.pool,db=>speechContext(db,lease)),c=boundSpeechContract(context);
    const operation=`asr:${sourceWriteId}`,intent=`speech:${lease.tenant_id}:${lease.scope_id}:${lease.id}:${operation}`;
    const prior=(await this.pool.query<{id:string}>('SELECT id FROM provider_submissions WHERE intent_key=$1',[intent])).rows[0];
    if(prior)return this.resume(lease,prior.id,signal);
    admitSpeechContract(this.cfg,c);requireThat(this.store.signedReadUrl,'ASR_PRIVATE_URL_UNAVAILABLE','当前私有存储未提供受限HTTPS读取能力',503);
    const prepared=await prepareSpeechSource(this.pool,this.cfg,this.store,context,sourceWriteId,signal);
    const submission=await transaction(this.pool,async db=>{
      const current=await speechContext(db,lease),audio=frozenNativeAudio(current.contract);
      await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`speech-order:${lease.tenant_id}:${lease.scope_id}`]);
      const prior=(await db.query<{id:string}>('SELECT id FROM provider_submissions WHERE intent_key=$1',[intent])).rows[0];if(prior)return {id:prior.id,created:false};
      if(audio){
        requireThat(((await db.query(`SELECT id FROM provider_submissions WHERE tenant_id=$1 AND order_id=$2 AND generation_kind='ASR'`,
          [lease.tenant_id,lease.scope_id])).rowCount??0)<audio.asr.max_calls,'ASR_ORIGINAL_CALL_LIMIT','原订单已创建整轨转写，只能恢复原任务',409);
        await allocateNativeAudioRights(db,lease.tenant_id,lease.scope_id,current.contract);
      }
      requireThat((await db.query(`SELECT id FROM provider_model_versions WHERE id=$1 AND status='ADMITTED' AND data->>'capability_hash'=$2
        AND private->'speech_contract'=$3::jsonb FOR SHARE`,[c.model_version_id,hash(c),JSON.stringify(c)])).rowCount===1,'ASR_NOT_ADMITTED','原转写模型已撤销准入',503);
      const reservation=await reserveStageCost(db,lease,intent,c.rate.ceiling_micro,{contract_hash:hash(c),rate_snapshot_id:c.rate_snapshot_id,rate:c.rate},{kind:'ASR'});
      const submissionId=id('speech'),prefix=`${lease.tenant_id}/speech/${lease.scope_id}/${submissionId}`,wavKey=`${prefix}/source.wav`;
      const url=this.store.signedReadUrl!(wavKey,new Date(Math.min(lease.deadline_at.getTime(),Date.now()+7200000))),body=speechRequest(c,url);
      await insert(db,'provider_submissions',{id:submissionId,tenant_id:lease.tenant_id,order_id:lease.scope_id,stage_run_id:lease.id,generation_kind:'ASR',model_version_id:c.model_version_id,
        operation_key:operation,intent_key:intent,input_hash:hash({contract:hash(c),source:prepared.source,deadline_at:context.snapshot.deadline_at}),state:'SUBMITTING',reservation_id:reservation,
        data:{submission_id:submissionId,state:'SUBMITTING',kind:'ASR'},private:{owner_id:context.ownerId,product_id:context.snapshot.product_id,wire_contract:c,contract_hash:hash(c),...(audio?{audio_contract_hash:hash(audio)}:{}),
          request_key:`${prefix}/request.json`,request_sha256:sha256(body),prepared:{source:prepared.source,url,wav_key:wavKey,deadline_at:context.snapshot.deadline_at},
          receipts:[{ordinal:0,kind:'SUBMIT',key:`${prefix}/submit.json`}]}});
      await db.query('UPDATE budget_reservations SET submission_id=$2 WHERE id=$1',[reservation,submissionId]);return {id:submissionId,created:true};
    });
    if(submission.created){const r=await this.row(lease.tenant_id,submission.id);
      await writePrivateObject(this.pool,this.store,this.scope(r,'MEDIA'),r.private.prepared.wav_key,prepared.wav,'audio/wav');
      await writePrivateObject(this.pool,this.store,this.scope(r,'RECEIPT'),r.private.request_key,Buffer.from(speechRequest(c,r.private.prepared.url)),'application/json');}
    return this.resume(lease,submission.id,signal);
  }
  resume(lease:StageLease,submissionId:string,signal:AbortSignal):Promise<SpeechResult>{return this.row(lease.tenant_id,submissionId).then(r=>this.run(lease,r,signal));}
  /** Stored receipts only: works after disable/retirement/deadline/deletion and
   * never submits, renews a signed URL, downloads media or publishes content. */
  async reconcileReceipts(limit=20):Promise<{settled:number;blocked:number}>{
    requireThat(Number.isSafeInteger(limit)&&limit>0&&limit<=100,'RECONCILIATION_LIMIT_INVALID','转写对账批次无效',500);
    const rows=(await this.pool.query<Submission>(`SELECT * FROM provider_submissions WHERE generation_kind='ASR' AND state IN ('SUBMITTING','UNKNOWN','RUNNING') ORDER BY updated_at,id LIMIT $1`,[limit])).rows;
    let settled=0,blocked=0;for(const row of rows){const claimed=await this.claim(row);if(!claimed){blocked++;continue;}
      try{const r=await this.recover(claimed);if(r.private.provider_terminal&&r.private.billing_valid){
        settled++;const live=(await this.pool.query(`SELECT id FROM orders WHERE tenant_id=$1 AND id=$2 AND payment_state='CONFIRMED'
          AND fulfillment_state IN ('QUEUED','IN_PROGRESS') AND deadline_at>now() AND NOT (private ? 'media_revoked')`,[r.tenant_id,r.order_id])).rowCount;
        if(!live)await this.pool.query(`UPDATE provider_submissions SET state='FAILED',data=data||'{"state":"FAILED"}'::jsonb WHERE tenant_id=$1 AND id=$2 AND state='RUNNING'`,[r.tenant_id,r.id]);
      }else blocked++;}catch{blocked++;}finally{await this.release(claimed);}}
    return {settled,blocked};
  }
}
