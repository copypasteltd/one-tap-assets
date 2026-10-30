import type pg from 'pg';
import type {Config} from '../../api/config.js';
import {transaction,type Db} from '../../api/db/pool.js';
import {insert} from '../../api/db/store.js';
import {hash,id,iso,sha256} from '../../api/lib/crypto.js';
import {AppError,requireThat} from '../../api/lib/errors.js';
import {lockMediaOwner} from '../../api/modules/media-access.js';
import {writePrivateObject} from '../../api/storage/private-objects.js';
import type {ObjectStorage} from '../../api/storage/storage.js';
import {settlePlatform} from '../budget/platform.js';
import {PendingExternal,type StageLease} from '../queue/leases.js';
import {frozenNativeAudio} from '../audio/contract.js';
import {sampleGenerationContext} from './generation.js';
import type {SampleContext} from './context.js';
import type {SamplePacket} from './review.js';
import {prepareSampleListening} from './audio-evidence.js';
import {sampleAudioContext,reserveSampleAudio} from './audio-context.js';
import {frozenListeningContract,ListeningClient,parseListeningSse,listeningUsage,validateListeningResult,
  type ListeningContract,type ListeningResult,type PreparedListening} from '../providers/omni-listening.js';
interface ListeningRow {id:string;tenant_id:string;sample_id:string;stage_run_id:string;input_hash:string;state:string;reservation_id:string;
  model_version_id:string;private:{wire_contract:ListeningContract;contract_hash:string;owner_id:string;product_id:string;
    request_key:string;request_sha256:string;prepared:PreparedListening['summary'];receipts:{ordinal:number;kind:'RESPONSE';key:string}[];
    sending_started_at?:string;billing_valid?:boolean;contract_violation?:boolean;sample_audio_contract_hash:string;privacy_deleted?:boolean;
    output?:SampleListeningEvidence;billing_error?:string;result_error?:string}}
export interface SampleListeningEvidence {submission_id:string;packet_hash:string;contract_hash:string;request_sha256:string;response_sha256:string;
  provider_request_id:string;result_hash:string;result:ListeningResult}
interface Receipt {version:'YPCC-LISTENING-RECEIPT-1';submission_id:string;request_sha256:string;status:number;
  content_type:string;response_sha256:string;body_base64:string}

export class SampleListeningReader {
  constructor(protected database:Db,protected cfg:Config,protected store:ObjectStorage){}
  protected async row(tenant:string,id:string,db:Db=this.database,lock=false):Promise<ListeningRow>{
    const r=(await db.query<ListeningRow>(`SELECT * FROM provider_submissions WHERE tenant_id=$1 AND id=$2
      AND generation_kind='LISTENING' AND sample_id IS NOT NULL AND order_id IS NULL${lock?' FOR UPDATE':''}`,[tenant,id])).rows[0];
    requireThat(r,'SAMPLE_LISTENING_MISSING','原样例听音请求缺失',503);return r;
  }
  protected async object(r:ListeningRow,key:string,max:number,db:Db=this.database,live=false):Promise<Buffer|null>{
    requireThat(key.startsWith(`${r.tenant_id}/samples/${r.sample_id}/`),'SAMPLE_LISTENING_SCOPE_INVALID','听音回执不属于本样例',503);
    const w=(await db.query<{sha256:string;state:string}>(`SELECT sha256,state FROM private_object_writes WHERE tenant_id=$1
      AND owner_id=$2 AND product_id=$3 AND order_id IS NULL AND object_key=$4 AND kind='RECEIPT'
      ${live?'AND NOT delete_requested AND expires_at>clock_timestamp() FOR SHARE':''}`,
      [r.tenant_id,r.private.owner_id,r.private.product_id,key])).rows[0];
    if(!w)return null;if(['WRITING','UNKNOWN'].includes(w.state))throw new PendingExternal(5,'SAMPLE_LISTENING_RECEIPT_PENDING');
    requireThat(w.state==='STORED','SAMPLE_LISTENING_RECEIPT_MISSING','原听音回执已删除或待核对',503);
    const bytes=await this.store.get(key,max);requireThat(sha256(bytes)===w.sha256,'SAMPLE_LISTENING_RECEIPT_CHANGED','原听音回执字节变化',503);return bytes;
  }
  protected async decoded(r:ListeningRow,db:Db=this.database,live=false):Promise<{
    cost:number|null;noCharge:boolean;billingError:string|undefined;resultError:string|undefined;output:SampleListeningEvidence|undefined
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
    const noCharge=c.no_charge_http_statuses.includes(receipt.status);let cost:number|null=null,billingError:string|undefined,resultError:string|undefined,output:SampleListeningEvidence|undefined;
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
  /** Reparse the original response against the complete current sample; never purchase here. */
  async evidence(context:SampleContext,packet:SamplePacket,db:Db=this.database,pass=true):Promise<SampleListeningEvidence>{
    const {c,prepared}=await prepareSampleListening(db,this.cfg,this.store,context,packet),operation=`listening:${prepared.summary.packet_hash}`;
    const r=(await db.query<ListeningRow>(`SELECT p.* FROM provider_submissions p JOIN stage_runs s ON s.tenant_id=p.tenant_id AND s.id=p.stage_run_id
      WHERE p.tenant_id=$1 AND p.sample_id=$2 AND p.order_id IS NULL AND p.generation_kind='LISTENING' AND p.operation_key=$3
      AND s.scope_type='SAMPLE' AND s.scope_id=$2 AND s.stage_name='SAMPLE_QC' AND s.attempt=1 AND s.input_hash=$4 FOR SHARE OF p,s`,
      [context.input.tenant_id,context.input.sample_id,operation,context.inputHash])).rows[0];
    if(!r||['SUBMITTING','UNKNOWN','RUNNING'].includes(r.state))throw new PendingExternal(5,'SAMPLE_LISTENING_UNRESOLVED');
    requireThat(r.state==='SUCCEEDED'&&r.private.sending_started_at&&r.private.billing_valid&&!r.private.privacy_deleted&&r.private.output
      &&r.private.owner_id===context.input.owner_id&&r.private.product_id===context.input.request.product_id
      &&r.model_version_id===c.model_version_id&&r.private.contract_hash===hash(c)&&r.input_hash===prepared.requestHash
      &&hash(r.private.prepared)===hash(prepared.summary)&&hash(r.private.wire_contract)===hash(c)
      &&r.private.sample_audio_contract_hash===hash(frozenNativeAudio(sampleGenerationContext(context).contract)),
      'SAMPLE_LISTENING_CHANGED','原样例听音、完整输入、模型或费用绑定不一致',503);
    const decoded=await this.decoded(r,db,true);
    requireThat(decoded?.output&&!decoded.billingError&&!decoded.resultError&&decoded.cost!==null&&!decoded.noCharge
      &&hash(decoded.output)===hash(r.private.output),'SAMPLE_LISTENING_RESULT_CHANGED','原听音完整响应与已保存结论不一致',503);
    const budget=(await db.query<{state:string;amount_micro:string;settled_micro:string;rate_snapshot:unknown;intent_key:string}>(
      'SELECT state,amount_micro,settled_micro,rate_snapshot,intent_key FROM platform_budget_reservations WHERE tenant_id=$1 AND id=$2 FOR SHARE',
      [r.tenant_id,r.reservation_id])).rows[0];
    requireThat(budget?.state==='SETTLED'&&Number(budget.amount_micro)===c.per_request_ceiling_micro&&Number(budget.settled_micro)===decoded.cost
      &&budget.intent_key===`sample-listening:${context.input.tenant_id}:${context.input.sample_id}:${operation}`
      &&hash(budget.rate_snapshot)===hash({component:'SAMPLE_NATIVE_AUDIO',sample_id:context.input.sample_id,input_hash:context.inputHash,
        kind:'LISTENING',contract:c,packet_hash:prepared.summary.packet_hash}),
      'SAMPLE_LISTENING_BILLING_INVALID','听音缺少原样例额度和实际费用结算',503);
    requireThat(!pass||decoded.output.result.verdict==='PASS','INDEPENDENT_AUDIO_NOT_PASSED','样例听音存在问题或证据不足，不能交付',422);
    if(packet.listening)requireThat(hash(packet.listening)===hash(decoded.output),'SAMPLE_LISTENING_CHANGED','封存听音与原供应商结果不一致',503);
    return decoded.output;
  }
}

export class SampleListeningGateway extends SampleListeningReader {
  constructor(private pool:pg.Pool,cfg:Config,store:ObjectStorage,private client=new ListeningClient(cfg)){super(pool,cfg,store);}
  private scope(r:ListeningRow){return {tenantId:r.tenant_id,ownerId:r.private.owner_id,productId:r.private.product_id,kind:'RECEIPT' as const};}
  private async authorize(db:Db,lease:StageLease,context:SampleContext,packet:SamplePacket,expected:PreparedListening){
    const live=await sampleAudioContext(db,this.cfg,lease,'SAMPLE_QC');
    const actual=await prepareSampleListening(db,this.cfg,this.store,live.sample,packet);
    requireThat(live.sample.inputHash===context.inputHash&&actual.prepared.requestHash===expected.requestHash
      &&hash(actual.prepared.summary)===hash(expected.summary),'SAMPLE_LISTENING_CHANGED','原样例听音输入或租约变化',409);
  }
  private async finish(r:ListeningRow):Promise<ListeningRow>{
    const decoded=await this.decoded(r);if(!decoded)return r;
    return transaction(this.pool,async db=>{
      await lockMediaOwner(db,r.tenant_id,r.private.owner_id);await db.query('SELECT id FROM public_samples WHERE tenant_id=$1 AND id=$2 FOR UPDATE',[r.tenant_id,r.sample_id]);
      const current=await this.row(r.tenant_id,r.id,db,true);
      if(['SUCCEEDED','FAILED'].includes(current.state)){
        requireThat(!current.private.output||hash(current.private.output)===hash(decoded.output),'SAMPLE_LISTENING_CHANGED','原听音结果不可更换',503);return current;
      }
      const {cost,noCharge,billingError,resultError,output}=decoded;
      await settlePlatform(db,r.tenant_id,r.reservation_id,cost,noCharge);
      const erased=current.private.privacy_deleted===true,state=output&&!billingError&&!erased?'SUCCEEDED':'FAILED';
      const metadata=erased?{billing_valid:cost!==null||noCharge}:{billing_valid:cost!==null||noCharge,
        ...(billingError?{billing_error:billingError}:{}),...(resultError?{result_error:resultError}:{}),...(output?{output}:{}),
        contract_violation:['LISTENING_MODEL_MISMATCH','LISTENING_COST_BOUND_VIOLATED'].includes(billingError??''),terminal_receipt_ordinal:0,provider_terminal:true};
      return (await db.query<ListeningRow>(`UPDATE provider_submissions SET state=$3,private=private||$4::jsonb,
        data=data||jsonb_build_object('state',$3::text),updated_at=now() WHERE tenant_id=$1 AND id=$2 RETURNING *`,[r.tenant_id,r.id,state,JSON.stringify(metadata)])).rows[0]!;
    });
  }
  async review(lease:StageLease,context:SampleContext,packet:SamplePacket,signal:AbortSignal):Promise<SampleListeningEvidence>{
    const {c,prepared}=await prepareSampleListening(this.pool,this.cfg,this.store,context,packet),operation=`listening:${prepared.summary.packet_hash}`;
    let r=await transaction(this.pool,async db=>{
      await this.authorize(db,lease,context,packet,prepared);
      await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`sample-listening:${lease.tenant_id}:${lease.scope_id}`]);
      const old=(await db.query<ListeningRow>(`SELECT * FROM provider_submissions WHERE tenant_id=$1 AND sample_id=$2 AND generation_kind='LISTENING' AND operation_key=$3 FOR UPDATE`,[lease.tenant_id,lease.scope_id,operation])).rows[0];
      if(old){requireThat(old.stage_run_id===lease.id&&old.input_hash===prepared.requestHash&&hash(old.private.prepared)===hash(prepared.summary),'SAMPLE_LISTENING_CHANGED','原听音不可换包或重购',409);return old;}
      const n=(await db.query<{n:string}>(`SELECT count(*)::text AS n FROM provider_submissions WHERE tenant_id=$1 AND sample_id=$2 AND generation_kind='LISTENING'`,[lease.tenant_id,lease.scope_id])).rows[0]!;
      requireThat(Number(n.n)<c.max_packets,'LISTENING_CALL_LIMIT','原样例听音次数用完',422);
      const intent=`sample-listening:${lease.tenant_id}:${lease.scope_id}:${operation}`;
      const reservation=await reserveSampleAudio(db,context,intent,c.per_request_ceiling_micro,{kind:'LISTENING',contract:c,packet_hash:prepared.summary.packet_hash});
      const submission=id('sample-listening'),prefix=`${lease.tenant_id}/samples/${lease.scope_id}/listening/${submission}`;
      await insert(db,'provider_submissions',{id:submission,tenant_id:lease.tenant_id,sample_id:lease.scope_id,stage_run_id:lease.id,generation_kind:'LISTENING',
        model_version_id:c.model_version_id,operation_key:operation,intent_key:intent,input_hash:prepared.requestHash,state:'SUBMITTING',reservation_id:reservation,
        data:{submission_id:submission,state:'SUBMITTING',kind:'LISTENING'},private:{wire_contract:c,contract_hash:hash(c),prepared:prepared.summary,
          sample_audio_contract_hash:hash(frozenNativeAudio(sampleGenerationContext(context).contract)),owner_id:context.input.owner_id,product_id:context.input.request.product_id,
          request_key:`${prefix}/request.json`,request_sha256:prepared.requestHash,receipts:[{ordinal:0,kind:'RESPONSE',key:`${prefix}/response.json`}]}});
      return this.row(lease.tenant_id,submission,db);
    });
    r=await this.finish(r);
    if(!r.private.sending_started_at&&!['SUCCEEDED','FAILED'].includes(r.state)){
      let original=await this.object(r,r.private.request_key,32_000_000);
      if(!original){await writePrivateObject(this.pool,this.store,this.scope(r),r.private.request_key,Buffer.from(prepared.body),'application/json');original=await this.object(r,r.private.request_key,32_000_000);}
      requireThat(original&&sha256(original)===r.private.request_sha256,'SAMPLE_LISTENING_CHANGED','原听音请求字节不可更换',503);
      const sends=await transaction(this.pool,async db=>{
        await this.authorize(db,lease,context,packet,prepared);
        const write=(await db.query(`SELECT id FROM private_object_writes WHERE tenant_id=$1 AND owner_id=$2 AND product_id=$3 AND order_id IS NULL
          AND object_key=$4 AND sha256=$5 AND kind='RECEIPT' AND state='STORED' AND NOT delete_requested AND expires_at>now() FOR SHARE`,
          [r.tenant_id,r.private.owner_id,r.private.product_id,r.private.request_key,r.private.request_sha256])).rowCount;
        requireThat(write===1,'SAMPLE_LISTENING_REVOKED','原听音请求已撤销',410);
        return (await db.query(`UPDATE provider_submissions SET private=private||jsonb_build_object('sending_started_at',$3::text),updated_at=now()
          WHERE tenant_id=$1 AND id=$2 AND state='SUBMITTING' AND NOT (private ? 'sending_started_at')`,[r.tenant_id,r.id,iso()])).rowCount===1;
      });
      if(sends)try{
        const response=await this.client.submit(c,{...prepared,body:original.toString('utf8')},r.id,lease.deadline_at,signal);
        const receipt:Receipt={version:'YPCC-LISTENING-RECEIPT-1',submission_id:r.id,request_sha256:r.private.request_sha256,status:response.status,
          content_type:String(response.headers['content-type']??''),response_sha256:sha256(response.bytes),body_base64:response.bytes.toString('base64')};
        await writePrivateObject(this.pool,this.store,this.scope(r),r.private.receipts[0]!.key,Buffer.from(JSON.stringify(receipt)),'application/json');
        r=await this.finish(await this.row(r.tenant_id,r.id));
      }catch(error){
        await transaction(this.pool,async db=>{const current=await this.row(r.tenant_id,r.id,db,true);if(!['SUCCEEDED','FAILED'].includes(current.state)){
          await settlePlatform(db,r.tenant_id,r.reservation_id,null);await db.query(`UPDATE provider_submissions SET state='UNKNOWN',data=data||'{"state":"UNKNOWN"}'::jsonb WHERE tenant_id=$1 AND id=$2 AND state='SUBMITTING'`,[r.tenant_id,r.id]);}});
        throw new PendingExternal(5,error instanceof AppError?error.code:'SAMPLE_LISTENING_UNKNOWN');
      }
    }
    await transaction(this.pool,db=>this.authorize(db,lease,context,packet,prepared));
    return this.evidence(context,packet);
  }
  /** Existing receipts only, including revoked/expired samples. No replacement POST. */
  async reconcileReceipts(limit=20){
    requireThat(Number.isSafeInteger(limit)&&limit>0&&limit<=100,'RECONCILIATION_LIMIT_INVALID','对账批次无效',500);
    const rows=(await this.pool.query<ListeningRow>(`SELECT * FROM provider_submissions WHERE sample_id IS NOT NULL AND order_id IS NULL
      AND generation_kind='LISTENING' AND state IN ('SUBMITTING','UNKNOWN','RUNNING') ORDER BY updated_at,id LIMIT $1`,[limit])).rows;
    let settled=0,blocked=0;for(const row of rows)try{const r=await this.finish(row);if(r.private.billing_valid)settled++;else blocked++;}catch{blocked++;}
    return {settled,blocked};
  }
}
