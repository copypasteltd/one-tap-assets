import type pg from 'pg';
import type {Config} from '../../api/config.js';
import {transaction,type Db} from '../../api/db/pool.js';
import {insert} from '../../api/db/store.js';
import {hash,id,iso,sha256} from '../../api/lib/crypto.js';
import {AppError,requireThat} from '../../api/lib/errors.js';
import {lockMediaOwner} from '../../api/modules/media-access.js';
import {writePrivateObject,type PrivateObjectScope} from '../../api/storage/private-objects.js';
import type {ObjectStorage} from '../../api/storage/storage.js';
import {reserve,settle} from '../budget/reservations.js';
import {executionContext,type ExecutionContext} from '../compiler/order-context.js';
import {assertLease,PendingExternal,type StageLease} from '../queue/leases.js';
import {currentReviewPacket,packetImages} from '../review/context.js';
import {verifySealedEvidence} from '../review/qc.js';
import {nativeQcResources,nativeQcWrites} from '../review/native-audio.js';
import {frozenListeningContract,ListeningClient,parseListeningSse,prepareListening,listeningUsage,validateListeningResult,
  type ListeningAudio,type ListeningContract,type ListeningResult,type PreparedListening} from '../providers/omni-listening.js';
import {verifyListeningLive} from './listening-contract.js';
import {operationArtifacts} from '../media/artifacts.js';
import {originalNativeTranscript} from './order-proof.js';

interface ListeningRow {id:string;tenant_id:string;order_id:string;stage_run_id:string;input_hash:string;state:string;reservation_id:string;
  model_version_id:string;private:{wire_contract:ListeningContract;contract_hash:string;owner_id:string;product_id:string;
    request_key:string;request_sha256:string;prepared:PreparedListening['summary'];receipts:{ordinal:number;kind:'RESPONSE';key:string}[];
    sending_started_at?:string;billing_valid?:boolean;contract_violation?:boolean;privacy_deleted?:boolean;
    output?:ListeningEvidence;billing_error?:string;result_error?:string}}
export interface ListeningEvidence {submission_id:string;packet_hash:string;contract_hash:string;request_sha256:string;response_sha256:string;
  provider_request_id:string;result_hash:string;result:ListeningResult}
interface Receipt {version:'YPCC-LISTENING-RECEIPT-1';submission_id:string;request_sha256:string;status:number;
  content_type:string;response_sha256:string;body_base64:string}

/** Reads original, settled evidence without purchase or settlement methods. */
class NativeListeningReader {
  constructor(protected database:Db,protected cfg:Config,protected store:ObjectStorage){}
  protected async row(tenantId:string,submissionId:string,db:Db=this.database,lock=false):Promise<ListeningRow>{
    const r=(await db.query<ListeningRow>(`SELECT * FROM provider_submissions WHERE tenant_id=$1 AND id=$2 AND generation_kind='LISTENING'${lock?' FOR UPDATE':''}`,[tenantId,submissionId])).rows[0];
    requireThat(r,'LISTENING_ORIGINAL_MISSING','独立听音原请求不存在',409);return r;
  }
  protected async sources(db:Db,context:ExecutionContext):Promise<void>{
    const production=await operationArtifacts(db,context,'PRODUCTION'),post=await operationArtifacts(db,context,'POST');
    const artifacts=[...production.receipt.artifacts,...post.receipt.artifacts];
    const proof=post.receipt.artifacts.find(a=>a.spec.kind==='video')?.spec.native_audio?.post;
    requireThat(proof,'LISTENING_SOURCE_INVALID','听音缺少原订单后期和原成功转写绑定',503);
    const original=await originalNativeTranscript(db,this.store,context,proof.asr_submission_id,proof.source_write_id);
    requireThat(original.file_sha256===proof.transcript_file_sha256&&hash(original.transcript)===proof.transcript_hash,
      'LISTENING_SOURCE_INVALID','原听音转写费用或技术来源已变化',503);
    await nativeQcWrites(db,context,[...artifacts,{object_key:original.object_key,sha256:original.file_sha256}]);
    for(const artifact of artifacts){const bytes=await this.store.get(artifact.object_key,artifact.spec.kind==='video'?512000000:30000000);
      requireThat(sha256(bytes)===artifact.sha256,'LISTENING_MEDIA_CHANGED','原制作或实际成片字节已变化，不能使用旧听音包',503);}
  }
  protected async object(r:ListeningRow,key:string,max:number,db:Db=this.database,live=false):Promise<Buffer|null>{
    const w=(await db.query<{sha256:string;state:string}>(`SELECT sha256,state FROM private_object_writes WHERE tenant_id=$1
      AND owner_id=$2 AND product_id=$3 AND order_id=$4 AND object_key=$5 AND kind='RECEIPT'
      ${live?'AND NOT delete_requested AND expires_at>clock_timestamp() FOR SHARE':''}`,
    [r.tenant_id,r.private.owner_id,r.private.product_id,r.order_id,key])).rows[0];
    if(!w)return null;
    if(w.state==='WRITING'||w.state==='UNKNOWN')throw new PendingExternal(5,'LISTENING_RECEIPT_PENDING');
    requireThat(w.state==='STORED','LISTENING_RECEIPT_PENDING','原听音对象仍待写入核对或已删除',503);
    const bytes=await this.store.get(key,max);requireThat(sha256(bytes)===w.sha256,'LISTENING_RECEIPT_CHANGED','原听音回执实际字节已改变',503);return bytes;
  }
  protected async compiled(db:Db,context:ExecutionContext):Promise<{c:ListeningContract;prepared:PreparedListening}>{
    const c=await verifyListeningLive(db,this.cfg,context.contract,true),packet=await currentReviewPacket(db,context);
    requireThat(['SEALED','REVIEWING','PASSED'].includes(packet.state)&&packet.publication_decision==='PENDING',
      'LISTENING_PACKET_INVALID','听音需要当前封存且未阻断的完整审查包',409);
    const rows=await verifySealedEvidence(db,this.store,packet);
    await this.sources(db,context);
    await nativeQcResources(db,this.store,context);await nativeQcWrites(db,context,rows);
    const audios:ListeningAudio[]=[];
    for(const row of rows)if(row.kind==='NATIVE_AUDIO'||row.kind==='FINAL_AUDIO'){
      const bytes=await this.store.get(row.object_key,10000000);audios.push({asset_id:row.id,sha256:row.sha256,kind:row.kind,bytes});
    }
    const images=await packetImages(db,this.store,context,packet);
    const facts={profile:context.contract.profile,identity_lock_hash:context.snapshot.identity_lock_hash,
      caption_style:context.contract.native_audio_contract!.caption_style,music:context.contract.native_audio_contract!.music,
      frames:rows.filter(r=>r.kind==='VIDEO_FRAME').map(r=>({asset_id:r.id,artifact_id:r.artifact_id,frame_index:r.frame_index,time_ms:r.time_ms}))};
    return {c,prepared:prepareListening(c,{packet_hash:packet.packet_hash,snapshot_hash:context.snapshotHash,output_set_hash:packet.output_set_hash,
      target_frames:context.snapshot.timeline.target_frames,audios,images,facts})};
  }
  protected async decoded(r:ListeningRow,db:Db=this.database,live=false):Promise<{
    cost:number|null;noCharge:boolean;billingError:string|undefined;resultError:string|undefined;output:ListeningEvidence|undefined
  }|null>{
    const c=frozenListeningContract(r.private.wire_contract);
    requireThat(hash(c)===r.private.contract_hash&&r.private.prepared.contract_hash===r.private.contract_hash,
      'LISTENING_CONTRACT_CHANGED','原听音费用合同摘要变化',503);
    const bytes=await this.object(r,r.private.receipts[0]!.key,4000000,db,live);if(!bytes)return null;
    const original=await this.object(r,r.private.request_key,32000000,db,live);
    requireThat(original&&sha256(original)===r.private.request_sha256&&r.input_hash===r.private.request_sha256,
      'LISTENING_ORIGINAL_CHANGED','听音原请求文件、原输入摘要或私有登记已变化',503);
    const receipt=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)) as Receipt;
    requireThat(receipt.version==='YPCC-LISTENING-RECEIPT-1'&&receipt.submission_id===r.id&&receipt.request_sha256===r.private.request_sha256
      &&Number.isInteger(receipt.status)&&receipt.status>=100&&receipt.status<=599&&typeof receipt.body_base64==='string',
    'LISTENING_RECEIPT_INVALID','听音原响应不属于本次原请求',503);
    const response=Buffer.from(receipt.body_base64,'base64');
    requireThat(response.toString('base64')===receipt.body_base64&&sha256(response)===receipt.response_sha256,
      'LISTENING_RECEIPT_CHANGED','原听音HTTP响应摘要不一致',503);
    const noCharge=c.no_charge_http_statuses.includes(receipt.status);let cost:number|null=null,billingError:string|undefined,resultError:string|undefined,output:ListeningEvidence|undefined;
    if(receipt.status>=200&&receipt.status<300){
      try{
        requireThat(receipt.content_type.split(';')[0]!.trim().toLowerCase()==='text/event-stream','LISTENING_STREAM_INVALID','听音服务未返回原流式协议',503);
        const parsed=parseListeningSse(response,c);cost=listeningUsage(parsed,c);
        try{
          requireThat(parsed.finish_reason==='stop','LISTENING_RESULT_INCOMPLETE','听音结果被截断或未正常结束',422);
          const result=validateListeningResult(JSON.parse(parsed.content) as unknown,r.private.prepared);
          output={submission_id:r.id,packet_hash:r.private.prepared.packet_hash,contract_hash:hash(c),request_sha256:r.private.request_sha256,
            response_sha256:receipt.response_sha256,provider_request_id:parsed.provider_request_id,result_hash:hash(result),result};
        }catch(error){resultError=error instanceof AppError?error.code:'LISTENING_RESULT_INVALID';}
      }catch(error){billingError=error instanceof AppError?error.code:'LISTENING_STREAM_INVALID';cost=null;}
    }else {resultError='LISTENING_PROVIDER_REJECTED';if(!noCharge)billingError='LISTENING_BILLING_UNKNOWN';}
    return {cost,noCharge,billingError,resultError,output};
  }
  protected async sealed(context:ExecutionContext,db:Db,requirePass:boolean):Promise<ListeningEvidence>{
    await lockMediaOwner(db,context.tenantId,context.ownerId);
    const {c,prepared}=await this.compiled(db,context),operation=`listening:${prepared.summary.packet_hash}`;
    const r=(await db.query<ListeningRow>(`SELECT p.* FROM provider_submissions p JOIN stage_runs s
      ON s.tenant_id=p.tenant_id AND s.id=p.stage_run_id WHERE p.tenant_id=$1 AND p.order_id=$2
      AND p.generation_kind='LISTENING' AND p.operation_key=$3 AND s.scope_type='ORDER' AND s.scope_id=$2
      AND s.stage_name='REVIEW_FACTS' AND s.input_hash=$4 FOR SHARE OF p,s`,
    [context.tenantId,context.orderId,operation,context.snapshotHash])).rows[0];
    if(!r||['SUBMITTING','UNKNOWN'].includes(r.state))throw new PendingExternal(5,'LISTENING_ORIGINAL_UNRESOLVED');
    requireThat(r.state==='SUCCEEDED'&&r.private.sending_started_at&&r.private.billing_valid&&!r.private.privacy_deleted&&r.private.output
      &&r.private.owner_id===context.ownerId&&r.private.product_id===context.snapshot.product_id
      &&r.model_version_id===c.model_version_id&&r.private.contract_hash===hash(c)&&r.input_hash===prepared.requestHash
      &&hash(r.private.prepared)===hash(prepared.summary)&&hash(r.private.wire_contract)===hash(c),
    'LISTENING_ORIGINAL_CHANGED','原听音、完整材料、模型或原合同绑定无效',503);
    const decoded=await this.decoded(r,db,true);
    requireThat(decoded?.output&&!decoded.billingError&&!decoded.resultError&&decoded.cost!==null&&!decoded.noCharge
      &&hash(decoded.output)===hash(r.private.output),'LISTENING_RESULT_CHANGED','听音原始响应与已结算的持久结果不一致',503);
    const budget=(await db.query<{state:string;amount_micro:string;settled_micro:string;rate_snapshot:unknown;intent_key:string}>(
      `SELECT state,amount_micro,settled_micro,rate_snapshot,intent_key FROM budget_reservations
       WHERE id=$1 AND tenant_id=$2 AND order_id=$3 FOR SHARE`,[r.reservation_id,context.tenantId,context.orderId])).rows[0];
    requireThat(budget?.state==='SETTLED'&&Number(budget.amount_micro)===c.per_request_ceiling_micro&&Number(budget.settled_micro)===decoded.cost
      &&budget.intent_key===`${context.tenantId}:${context.orderId}:${operation}`
      &&hash(budget.rate_snapshot)===hash({type:'INDEPENDENT_LISTENING',contract:c,packet_hash:prepared.summary.packet_hash}),
    'LISTENING_BILLING_UNVERIFIED','听音缺少原订单、原费率与实际用量对应的已结算费用',503);
    requireThat(!requirePass||decoded.output.result.verdict==='PASS','INDEPENDENT_AUDIO_NOT_PASSED','独立听音仍有问题或证据不足，不能执行最终复核与交付',422);
    await verifyListeningLive(db,this.cfg,context.contract,true);
    requireThat(Date.parse(context.snapshot.deadline_at)>Date.now(),'LISTENING_INTERRUPTED','听音证据已超过原订单截止',409);
    return decoded.output;
  }
  /** Read only: recompile the complete current input and reparse exact original
   * request/response bytes and cost. Never submit, repair or settle here. */
  async evidence(context:ExecutionContext,db:Db=this.database):Promise<ListeningEvidence>{return this.sealed(context,db,true);}
}
export function readNativeListening(db:Db,cfg:Config,store:ObjectStorage,context:ExecutionContext):Promise<ListeningEvidence>{
  return new NativeListeningReader(db,cfg,store).evidence(context);
}

/** Platform preparation. Codex roles receive only read-only evidence tools. */
export class NativeListeningGateway extends NativeListeningReader {
  constructor(private pool:pg.Pool,cfg:Config,store:ObjectStorage,private client=new ListeningClient(cfg)){super(pool,cfg,store);}
  private scope(r:ListeningRow):PrivateObjectScope{return {tenantId:r.tenant_id,ownerId:r.private.owner_id,productId:r.private.product_id,orderId:r.order_id,kind:'RECEIPT'};}
  private async prepared(lease:StageLease):Promise<{context:ExecutionContext;c:ListeningContract;prepared:PreparedListening}>{
    requireThat(lease.scope_type==='ORDER'&&lease.stage_name==='REVIEW_FACTS','LISTENING_SCOPE_INVALID','听音仅能为原订单最终事实复核准备',403);
    const context=await executionContext(this.pool,lease.tenant_id,lease.scope_id,lease.input_hash);
    return {context,...await this.compiled(this.pool,context)};
  }
  private async authorize(db:Db,lease:StageLease,expected:PreparedListening['summary']):Promise<ExecutionContext>{
    const context=await executionContext(db,lease.tenant_id,lease.scope_id,lease.input_hash);
    await lockMediaOwner(db,context.tenantId,context.ownerId);await assertLease(db,lease);
    const c=await verifyListeningLive(db,this.cfg,context.contract,true),packet=await currentReviewPacket(db,context);
    requireThat(hash(c)===expected.contract_hash&&packet.packet_hash===expected.packet_hash&&packet.output_set_hash===expected.output_set_hash
      &&context.snapshotHash===expected.snapshot_hash,'LISTENING_INPUT_CHANGED','原订单、听音协议或封存包已变化',409);
    const rows=await verifySealedEvidence(db,this.store,packet);await nativeQcResources(db,this.store,context);await nativeQcWrites(db,context,rows);
    await this.sources(db,context);
    const images=await packetImages(db,this.store,context,packet);
    requireThat(hash(images.map(({bytes:_,...image})=>image))===hash(expected.images),
      'LISTENING_INPUT_CHANGED','听音原照片或完整实际画面绑定已变化',503);
    await assertLease(db,lease,false);
    return context;
  }
  private async finish(r:ListeningRow):Promise<ListeningRow>{
    const decoded=await this.decoded(r);if(!decoded)return r;
    const {cost,noCharge,billingError,resultError,output}=decoded;
    return transaction(this.pool,async db=>{
      await lockMediaOwner(db,r.tenant_id,r.private.owner_id);
      await db.query('SELECT id FROM orders WHERE tenant_id=$1 AND id=$2 FOR UPDATE',[r.tenant_id,r.order_id]);
      const current=await this.row(r.tenant_id,r.id,db,true);
      if(['SUCCEEDED','FAILED'].includes(current.state)){
        requireThat(!current.private.output||hash(current.private.output)===hash(output),'LISTENING_RESULT_CHANGED','原听音结果或回执不能更换',503);return current;
      }
      await settle(db,r.tenant_id,r.reservation_id,cost,noCharge);
      const erased=current.private.privacy_deleted===true;
      const state=output&&!billingError&&!erased?'SUCCEEDED':'FAILED';
      const metadata=erased?{billing_valid:cost!==null||noCharge}:{billing_valid:cost!==null||noCharge,
        ...(billingError?{billing_error:billingError}:{}),...(resultError?{result_error:resultError}:{}),
        ...(output?{output}:{}),contract_violation:['LISTENING_MODEL_MISMATCH','LISTENING_COST_BOUND_VIOLATED'].includes(billingError??''),
        terminal_receipt_ordinal:0,provider_terminal:true};
      return (await db.query<ListeningRow>(`UPDATE provider_submissions SET state=$3,private=private||$4::jsonb,
        data=data||jsonb_build_object('state',$3::text),updated_at=now() WHERE tenant_id=$1 AND id=$2 RETURNING *`,
      [r.tenant_id,r.id,state,JSON.stringify(metadata)])).rows[0]!;
    });
  }
  async review(lease:StageLease,signal:AbortSignal):Promise<ListeningEvidence>{
    const {context,c,prepared}=await this.prepared(lease),operation=`listening:${prepared.summary.packet_hash}`;
    const deadline=new Date(Math.min(lease.deadline_at.getTime(),Date.parse(context.snapshot.deadline_at)));
    let r=await transaction(this.pool,async db=>{
      await this.authorize(db,lease,prepared.summary);
      await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`listening:${context.tenantId}:${context.orderId}`]);
      const prior=(await db.query<ListeningRow>(`SELECT * FROM provider_submissions WHERE tenant_id=$1 AND order_id=$2 AND operation_key=$3
        AND generation_kind='LISTENING' FOR UPDATE`,[context.tenantId,context.orderId,operation])).rows[0];
      if(prior){requireThat(prior.input_hash===prepared.requestHash&&prior.stage_run_id===lease.id&&hash(prior.private.prepared)===hash(prepared.summary)
        &&prior.private.contract_hash===hash(c),'LISTENING_ORIGINAL_CHANGED','同一封存包不能换输入、阶段或重新购买听音',409);return prior;}
      const count=(await db.query<{n:string}>(`SELECT count(*)::text AS n FROM provider_submissions WHERE tenant_id=$1 AND order_id=$2 AND generation_kind='LISTENING'`,[context.tenantId,context.orderId])).rows[0]!;
      requireThat(Number(count.n)<c.max_packets,'LISTENING_CALL_LIMIT','原订单听音次数已达冻结上限，不能新增购买',422);
      const intent=`${context.tenantId}:${context.orderId}:${operation}`,reservation=await reserve(db,{tenantId:context.tenantId,orderId:context.orderId},intent,
        c.per_request_ceiling_micro,{type:'INDEPENDENT_LISTENING',contract:c,packet_hash:prepared.summary.packet_hash});
      const submissionId=id('listening'),prefix=`${context.tenantId}/listening/${context.orderId}/${submissionId}`;
      await insert(db,'provider_submissions',{id:submissionId,tenant_id:context.tenantId,order_id:context.orderId,stage_run_id:lease.id,intent_key:intent,
        input_hash:prepared.requestHash,state:'SUBMITTING',reservation_id:reservation,generation_kind:'LISTENING',model_version_id:c.model_version_id,operation_key:operation,
        data:{submission_id:submissionId,state:'SUBMITTING',kind:'LISTENING'},private:{wire_contract:c,contract_hash:hash(c),prepared:prepared.summary,
          product_id:context.snapshot.product_id,owner_id:context.ownerId,request_key:`${prefix}/request.json`,request_sha256:prepared.requestHash,
          receipts:[{ordinal:0,kind:'RESPONSE',key:`${prefix}/response.json`}]}});
      return this.row(context.tenantId,submissionId,db);
    });
    r=await this.finish(r);
    if(!r.private.sending_started_at&&!['SUCCEEDED','FAILED'].includes(r.state)){
      let original=await this.object(r,r.private.request_key,32000000);
      if(!original){await writePrivateObject(this.pool,this.store,this.scope(r),r.private.request_key,Buffer.from(prepared.body),'application/json');original=await this.object(r,r.private.request_key,32000000);}
      requireThat(original&&sha256(original)===r.private.request_sha256,'LISTENING_ORIGINAL_CHANGED','原听音请求字节不能重建为不同内容',503);
      const sends=await transaction(this.pool,async db=>{
        await this.authorize(db,lease,prepared.summary);
        requireThat((await db.query(`SELECT id FROM private_object_writes WHERE tenant_id=$1 AND owner_id=$2 AND order_id=$3
          AND product_id=$4 AND object_key=$5 AND sha256=$6 AND kind='RECEIPT' AND state='STORED'
          AND NOT delete_requested AND expires_at>clock_timestamp() FOR SHARE`,[r.tenant_id,r.private.owner_id,r.order_id,
          r.private.product_id,r.private.request_key,r.private.request_sha256])).rowCount===1,
        'LISTENING_ORIGINAL_REVOKED','原听音请求已进入删除或过期，不能发送',410);
        const changed=await db.query(`UPDATE provider_submissions SET private=private||jsonb_build_object('sending_started_at',$3::text),updated_at=now()
          WHERE tenant_id=$1 AND id=$2 AND state='SUBMITTING' AND NOT (private ? 'sending_started_at')`,[r.tenant_id,r.id,iso()]);return changed.rowCount===1;
      });
      if(sends){
        try{
          const response=await this.client.submit(c,{...prepared,body:original.toString('utf8')},r.id,deadline,signal);
          const receipt:Receipt={version:'YPCC-LISTENING-RECEIPT-1',submission_id:r.id,request_sha256:r.private.request_sha256,status:response.status,
            content_type:String(response.headers['content-type']??''),response_sha256:sha256(response.bytes),body_base64:response.bytes.toString('base64')};
          await writePrivateObject(this.pool,this.store,this.scope(r),r.private.receipts[0]!.key,Buffer.from(JSON.stringify(receipt)),'application/json');
          r=await this.finish(await this.row(r.tenant_id,r.id));
        }catch(error){
          await transaction(this.pool,async db=>{const current=await this.row(r.tenant_id,r.id,db,true);
            if(!['SUCCEEDED','FAILED'].includes(current.state)){
              await settle(db,r.tenant_id,r.reservation_id,null);
              await db.query(`UPDATE provider_submissions SET state='UNKNOWN',data=data||'{"state":"UNKNOWN"}'::jsonb,updated_at=now()
                WHERE tenant_id=$1 AND id=$2 AND state='SUBMITTING'`,[r.tenant_id,r.id]);}});
          throw new PendingExternal(5,error instanceof AppError?error.code:'LISTENING_REQUEST_UNKNOWN');
        }
      }else r=await this.finish(await this.row(r.tenant_id,r.id));
    }
    requireThat(!signal.aborted&&deadline.getTime()>Date.now(),'LISTENING_INTERRUPTED','听音已停止或超过原交付截止',409);
    await transaction(this.pool,db=>this.authorize(db,lease,prepared.summary));
    if(!['SUCCEEDED','FAILED'].includes(r.state))throw new PendingExternal(5,'LISTENING_ORIGINAL_UNRESOLVED');
    requireThat(r.state==='SUCCEEDED'&&r.private.billing_valid&&r.private.output,'LISTENING_NOT_PASSED','听音缺少有效原结果或费用回执',503);
    return transaction(this.pool,db=>this.sealed(context,db,false));
  }
  /** Reconcile only a saved original HTTP response. This synchronous provider
   * has no certified query API; UNKNOWN never creates a replacement POST. */
  async reconcileReceipts(limit=20):Promise<{settled:number;blocked:number}>{
    requireThat(Number.isSafeInteger(limit)&&limit>0&&limit<=100,'RECONCILIATION_LIMIT_INVALID','听音对账批次无效',500);
    const rows=(await this.pool.query<ListeningRow>(`SELECT * FROM provider_submissions WHERE generation_kind='LISTENING'
      AND state IN ('SUBMITTING','UNKNOWN') AND NOT (private @> '{"privacy_deleted":true}'::jsonb) ORDER BY updated_at,id LIMIT $1`,[limit])).rows;
    let settled=0,blocked=0;
    for(const row of rows){try{const r=await this.finish(row);if(r.private.billing_valid)settled++;else blocked++;}catch{blocked++;}}
    return {settled,blocked};
  }
}
