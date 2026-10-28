import type pg from 'pg';
import {mkdir,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import sharp from 'sharp';
import {inside,type Config} from '../../api/config.js';
import {transaction,type Db} from '../../api/db/pool.js';
import {insert} from '../../api/db/store.js';
import {hash,id,sha256} from '../../api/lib/crypto.js';
import {AppError,notFound,requireThat} from '../../api/lib/errors.js';
import {lockMediaOwner} from '../../api/modules/media-access.js';
import {writePrivateObject} from '../../api/storage/private-objects.js';
import type {ObjectStorage} from '../../api/storage/storage.js';
import type {HttpResponse} from '../../api/lib/http.js';
import {object} from '../../shared/domain/json.js';
import {reserve,settle} from '../budget/reservations.js';
import type {ExecutionContext} from '../compiler/order-context.js';
import {inspectVideo,nativeCommand,type MediaInspection} from '../media/native.js';
import {PendingExternal,type StageLease} from '../queue/leases.js';
import {ArkClient,admitArkContract,arkUsage,frozenArkContract,prepareArkImage,prepareArkVideo,type ArkContract,type PreparedArk,type ArkImage} from '../providers/ark.js';
import {generationContract} from './contracts.js';
import {generationContext} from './context.js';
import {readReferenceApproval,type ReferenceApproval} from './reference-approval.js';

export interface GenerationRequest {
  kind:'IMAGE'|'VIDEO';operation_key:string;prompt:string;reference_asset_ids:string[];
  video?:{duration:number;resolution:string;ratio:string;audio:boolean;mode:'FIRST_FRAME'|'REFERENCE_IMAGES'};
}
interface ReceiptPointer {ordinal:number;kind:'SUBMIT'|'QUERY';key:string}
interface RawReceipt {version:1;submission_id:string;ordinal:number;kind:'SUBMIT'|'QUERY';request_hash:string;contract_hash:string;
  status:number;response_sha256:string;response_base64:string}
export interface GenerationOutput {object_key:string;sha256:string;inspection:MediaInspection}
interface Submission {
  id:string;tenant_id:string;order_id:string;stage_run_id:string;generation_kind:'IMAGE'|'VIDEO';model_version_id:string;
  operation_key:string;input_hash:string;state:string;provider_task_id:string|null;reservation_id:string;
  lease_generation:string;lease_owner:string|null;next_query_at:Date|null;
  private:{owner_id:string;product_id:string;wire_contract:ArkContract;contract_hash:string;request_key:string;request_sha256:string;
    prepared:Omit<PreparedArk,'body'>&{reference_approval?:ReferenceApproval};receipts:ReceiptPointer[];sending_started_at?:string;provider_terminal?:boolean;
    terminal_receipt_ordinal?:number;billing_valid?:boolean;billing_error?:string;output?:GenerationOutput};
}
export interface GenerationResult {submission_id:string;state:string;output?:GenerationOutput}
const code=(error:unknown):string=>error instanceof AppError?error.code:'GENERATION_RECEIPT_INVALID';
const receiptLimit=(c:ArkContract):number=>Math.ceil(c.max_response_bytes*4/3)+8192;

/** Durable provider operations, not a public API or an Agent permission grant.
 * A caller must hold the original production stage lease. Final delivery still
 * requires the separate actual-file QC and independent review pipeline. */
export class GenerationGateway {
  constructor(private pool:pg.Pool,private cfg:Config,private store:ObjectStorage,private client=new ArkClient(cfg)){}
  private scope(row:Submission,kind:'RECEIPT'|'MEDIA'){
    return {tenantId:row.tenant_id,ownerId:row.private.owner_id,productId:row.private.product_id,orderId:row.order_id,kind};
  }
  private async row(tenantId:string,submissionId:string,db:Db=this.pool,lock=false):Promise<Submission>{
    return (await db.query<Submission>(`SELECT * FROM provider_submissions WHERE tenant_id=$1 AND id=$2 AND generation_kind IS NOT NULL${lock?' FOR UPDATE':''}`,
      [tenantId,submissionId])).rows[0]??notFound();
  }
  private contract(row:Submission):ArkContract{
    const c=frozenArkContract(row.private.wire_contract);
    requireThat(hash(c)===row.private.contract_hash&&row.private.prepared.contract_hash===hash(c)
      &&c.model_version_id===row.model_version_id&&row.private.prepared.kind===row.generation_kind
      &&row.private.request_sha256===row.input_hash&&row.private.prepared.request_hash===row.input_hash,
      'GENERATION_CONTRACT_CHANGED','原生成协议或模型绑定不一致',503);return c;
  }
  private async live(lease:StageLease,db:Db=this.pool):Promise<ExecutionContext>{
    return generationContext(db,lease);
  }
  private async videoInputs(context:ExecutionContext,stageId:string,operation:string,assetIds:string[],db:Db=this.pool){
    const checked=await readReferenceApproval(db,this.cfg,this.store,context,stageId);
    const key=context.snapshot.engine==='REFERENCE_FILM'?'reference:film':`reference:${operation.slice('video:'.length)}`;
    const frame=checked.approval.frames.find(f=>f.operation_key===key);
    requireThat(frame&&assetIds.length===1&&assetIds[0]===frame.asset_id,'GENERATION_REFERENCE_INVALID',
      '视频必须引用该镜头已核验的生成参考帧，不能换回原图或其他镜头',422);
    const image=checked.material.images.find(i=>i.asset_id===frame.asset_id)!;
    return {approval:checked.approval,images:[{id:image.asset_id,sha256:image.sha256,bytes:image.bytes}]};
  }
  private async videoAuthorization(row:Submission,context:ExecutionContext,db:Db=this.pool):Promise<void>{
    if(row.generation_kind!=='VIDEO')return;
    requireThat(row.private.prepared.reference_approval,'GENERATION_REFERENCE_REVIEW_REQUIRED','原视频缺少冻结的参考核验凭证，只允许独立财务对账',409);
    const checked=await this.videoInputs(context,row.stage_run_id,row.operation_key,row.private.prepared.references.map(i=>i.id),db);
    requireThat(hash(checked.approval)===hash(row.private.prepared.reference_approval)
      &&checked.images.every(i=>row.private.prepared.references.some(r=>r.id===i.id&&r.sha256===i.sha256)),
    'GENERATION_REFERENCE_APPROVAL_CHANGED','原视频的核验报告或实际参考帧绑定已变化',409);
  }
  private async images(context:ExecutionContext,assetIds:string[]):Promise<ArkImage[]>{
    requireThat(assetIds.length>0&&assetIds.length<=5&&new Set(assetIds).size===assetIds.length,'GENERATION_REFERENCE_INVALID','生成参考必须引用冻结商品照片',422);
    const all=(await this.pool.query<{id:string;object_key:string;sha256:string}>(`SELECT a.id,a.object_key,a.sha256 FROM product_photo_items p
      JOIN assets a ON a.tenant_id=p.tenant_id AND a.id=p.asset_id WHERE p.tenant_id=$1 AND p.photo_version_id=$2
      AND a.owner_id=$3 AND a.product_id=$4 AND a.state='READY' AND a.expires_at>now() ORDER BY p.position`,
    [context.tenantId,context.photoVersionId,context.ownerId,context.snapshot.product_id])).rows;
    requireThat(all.length>=3&&all.length<=5&&hash({photos:all.map(a=>({asset_id:a.id,sha256:a.sha256})),revision:context.snapshot.photo_version,
      normalization:'sharp-auto-orient-strip-png-v1'})===context.snapshot.photo_set_hash,'INPUT_HASH_MISMATCH','原订单完整照片集摘要不一致',503);
    const assets=all.filter(asset=>assetIds.includes(asset.id));
    requireThat(assets.length===assetIds.length,'GENERATION_REFERENCE_INVALID','生成参考不属于该订单的冻结照片',403);
    return Promise.all(assetIds.map(async assetId=>{const a=assets.find(row=>row.id===assetId)!;return {id:a.id,sha256:a.sha256,bytes:await this.store.get(a.object_key,125000000)};}));
  }
  private async registered(row:Submission,key:string,maximum:number,kind:'MEDIA'|'RECEIPT'='RECEIPT'):Promise<Buffer|null>{
    const record=(await this.pool.query<{state:string;sha256:string;delete_requested:boolean;expires_at:Date}>(`SELECT state,sha256,delete_requested,expires_at FROM private_object_writes
      WHERE tenant_id=$1 AND owner_id=$2 AND order_id=$3 AND product_id=$4 AND object_key=$5 AND kind=$6`,
    [row.tenant_id,row.private.owner_id,row.order_id,row.private.product_id,key,kind])).rows[0];
    if(!record)return null;
    requireThat(kind!=='MEDIA'||!record.delete_requested&&record.expires_at.getTime()>Date.now(),'GENERATION_MEDIA_REVOKED','原生成媒体已撤权或过期',410);
    if(record.state!=='STORED')throw new PendingExternal(5,'GENERATION_ORIGINAL_WRITE_PENDING');
    const bytes=await this.store.get(key,maximum);requireThat(sha256(bytes)===record.sha256,'GENERATION_OBJECT_HASH_MISMATCH','原生成文件与登记摘要不一致',503);return bytes;
  }
  private async persistReceipt(row:Submission,pointer:ReceiptPointer,response:HttpResponse):Promise<void>{
    const receipt:RawReceipt={version:1,submission_id:row.id,ordinal:pointer.ordinal,kind:pointer.kind,request_hash:row.input_hash,
      contract_hash:row.private.contract_hash,status:response.status,response_sha256:sha256(response.bytes),response_base64:response.bytes.toString('base64')};
    await writePrivateObject(this.pool,this.store,this.scope(row,'RECEIPT'),pointer.key,Buffer.from(JSON.stringify(receipt)),'application/json');
  }
  private async readReceipt(row:Submission,pointer:ReceiptPointer):Promise<{status:number;body:Record<string,unknown>}|null>{
    const c=this.contract(row),bytes=await this.registered(row,pointer.key,receiptLimit(c));if(!bytes)return null;
    const raw=object(JSON.parse(bytes.toString('utf8')) as unknown) as unknown as RawReceipt;
    requireThat(raw.version===1&&raw.submission_id===row.id&&raw.ordinal===pointer.ordinal&&raw.kind===pointer.kind
      &&raw.request_hash===row.input_hash&&raw.contract_hash===hash(c)&&Number.isInteger(raw.status)&&raw.status>=100&&raw.status<=599
      &&typeof raw.response_base64==='string'&&raw.response_base64.length<=Math.ceil(c.max_response_bytes*4/3)+4,
      'GENERATION_RECEIPT_INVALID','原生成回执绑定或长度不一致',503);
    const response=Buffer.from(raw.response_base64,'base64');requireThat(response.toString('base64')===raw.response_base64&&sha256(response)===raw.response_sha256,
      'GENERATION_RECEIPT_INVALID','原供应商响应字节摘要不一致',503);
    let body:Record<string,unknown>={};try{body=object(JSON.parse(response.toString('utf8')) as unknown);}catch{/* Raw bytes remain authoritative; do not invent usage. */}
    return {status:raw.status,body};
  }
  private async applyReceipt(row:Submission,pointer:ReceiptPointer):Promise<void>{
    const receipt=await this.readReceipt(row,pointer);if(!receipt)return;
    const c=this.contract(row),successful=receipt.status>=200&&receipt.status<300;
    if(successful&&pointer.kind==='SUBMIT'&&row.generation_kind==='VIDEO'){
      const taskId=receipt.body.id;requireThat(typeof taskId==='string'&&/^[A-Za-z0-9_-]{1,200}$/.test(taskId),
        'GENERATION_ACK_INVALID','原视频提交回执缺少任务标识',503);
      await this.pool.query(`UPDATE provider_submissions SET provider_task_id=$3,state='RUNNING',updated_at=now(),
        next_query_at=COALESCE(next_query_at,now()+$4::int*interval '1 second'),data=data||'{"state":"RUNNING"}'::jsonb
        WHERE tenant_id=$1 AND id=$2 AND state IN ('SUBMITTING','UNKNOWN','RUNNING') AND (provider_task_id IS NULL OR provider_task_id=$3)`,
      [row.tenant_id,row.id,taskId,c.video!.poll_seconds]);return;
    }
    if(successful&&pointer.kind==='QUERY'){
      requireThat(receipt.body.id===row.provider_task_id&&receipt.body.model===c.actual_model,'GENERATION_TASK_MISMATCH','查询回执与原视频任务或模型不一致',503);
      requireThat(['queued','running','succeeded','failed','cancelled','expired'].includes(String(receipt.body.status)),
        'GENERATION_TASK_STATUS_INVALID','原视频任务状态无效',503);
      if(['queued','running'].includes(String(receipt.body.status)))return;
    }
    // Query failures do not prove that an already accepted paid task failed.
    if(pointer.kind==='QUERY'&&!successful)return;
    let actual:number|null=null,billingError:string|undefined;
    const noCharge=pointer.kind==='SUBMIT'&&!successful&&c.no_charge_http_statuses.includes(receipt.status);
    if(successful){try{actual=arkUsage(c,receipt.body);}catch(error){billingError=code(error);}}
    const produced=successful&&(row.generation_kind==='IMAGE'||receipt.body.status==='succeeded');
    await transaction(this.pool,async db=>{
      await lockMediaOwner(db,row.tenant_id,row.private.owner_id);
      await db.query('SELECT id FROM orders WHERE tenant_id=$1 AND id=$2 FOR UPDATE',[row.tenant_id,row.order_id]);
      const current=await this.row(row.tenant_id,row.id,db,true);if(current.private.provider_terminal)return;
      await settle(db,row.tenant_id,row.reservation_id,actual,noCharge);
      const state=produced&&actual!==null?'RUNNING':'FAILED';
      await db.query(`UPDATE provider_submissions SET state=$3,private=private||$4::jsonb,updated_at=now(),
        data=data||jsonb_build_object('state',$3::text) WHERE tenant_id=$1 AND id=$2`,[row.tenant_id,row.id,state,
      JSON.stringify({provider_terminal:true,terminal_receipt_ordinal:pointer.ordinal,billing_valid:actual!==null||noCharge,
        ...(billingError?{billing_error:billingError}:{})})]);
    });
  }
  private async recover(row:Submission):Promise<Submission>{
    for(const pointer of row.private.receipts){
      const current=await this.row(row.tenant_id,row.id);if(current.private.provider_terminal)break;
      // Missing files are never treated as proof that a POST did not happen.
      await this.applyReceipt(current,pointer);
    }
    return this.row(row.tenant_id,row.id);
  }
  private async claim(row:Submission):Promise<Submission|null>{
    return (await this.pool.query<Submission>(`UPDATE provider_submissions SET lease_owner=$3,lease_generation=lease_generation+1,
      lease_expires_at=now()+interval '180 seconds',updated_at=now() WHERE tenant_id=$1 AND id=$2
      AND (lease_owner IS NULL OR lease_expires_at<clock_timestamp()) AND state IN ('SUBMITTING','UNKNOWN','RUNNING') RETURNING *`,
    [row.tenant_id,row.id,id('generation_worker')])).rows[0]??null;
  }
  private async release(row:Submission):Promise<void>{
    await this.pool.query(`UPDATE provider_submissions SET lease_owner=NULL,lease_expires_at=NULL WHERE tenant_id=$1 AND id=$2 AND lease_owner=$3 AND lease_generation=$4`,
      [row.tenant_id,row.id,row.lease_owner,row.lease_generation]);
  }
  private async fence(db:Db,row:Submission):Promise<void>{
    requireThat((await db.query(`SELECT id FROM provider_submissions WHERE tenant_id=$1 AND id=$2 AND lease_owner=$3 AND lease_generation=$4
      AND lease_expires_at>clock_timestamp() FOR UPDATE`,[row.tenant_id,row.id,row.lease_owner,row.lease_generation])).rowCount===1,
    'GENERATION_LEASE_LOST','原生成处理代次已失效',409);
  }
  private async query(row:Submission,signal:AbortSignal):Promise<void>{
    const c=this.contract(row);if(!row.provider_task_id||row.private.provider_terminal||!c.video)return;
    const pointer=await transaction(this.pool,async db=>{
      await this.fence(db,row);const current=await this.row(row.tenant_id,row.id,db);
      if(current.next_query_at&&current.next_query_at.getTime()>Date.now())return null;
      const count=current.private.receipts.filter(p=>p.kind==='QUERY').length;
      requireThat(count<c.video!.max_status_queries,'GENERATION_QUERY_LIMIT','原视频查询次数已达到冻结上限',503);
      const ordinal=current.private.receipts.length;
      const pointer:ReceiptPointer={ordinal,kind:'QUERY',key:`${row.tenant_id}/generation/${row.order_id}/${row.id}/query-${ordinal}.json`};
      await db.query(`UPDATE provider_submissions SET private=jsonb_set(private,'{receipts}',(private->'receipts')||$3::jsonb),
        next_query_at=now()+$4::int*interval '1 second',updated_at=now() WHERE tenant_id=$1 AND id=$2`,
      [row.tenant_id,row.id,JSON.stringify([pointer]),c.video!.poll_seconds]);return pointer;
    });
    if(pointer){const response=await this.client.query(c,row.provider_task_id,signal);await this.persistReceipt(row,pointer,response);await this.applyReceipt(row,pointer);}
  }
  private async inspect(row:Submission,bytes:Buffer,signal:AbortSignal):Promise<{bytes:Buffer;inspection:MediaInspection}>{
    const c=this.contract(row),expected=row.private.prepared.output;
    if(row.generation_kind==='IMAGE'){
      const image=sharp(bytes,{limitInputPixels:c.max_image_pixels,failOn:'warning'}),meta=await image.metadata();
      requireThat((meta.format==='png'||meta.format==='jpeg')&&meta.width===expected.width&&meta.height===expected.height
        &&(!meta.pages||meta.pages===1)&&(!meta.orientation||meta.orientation===1),'GENERATION_IMAGE_INVALID','实际生成图片与冻结规格不一致',422);
      const normalized=await image.png().toBuffer();
      return {bytes:normalized,inspection:{kind:'image',width:meta.width,height:meta.height,codec:'png',pixelFormat:null,fps:null,
        frames:null,durationSeconds:null,hasAudio:false,audioCodec:null,bytes:normalized.length}};
    }
    const root=inside(this.cfg.runtimeRoot,`generation/${row.id}/${id('inspect')}`),path=join(root,'source.mp4');await mkdir(root,{recursive:true});
    try{
      await writeFile(path,bytes,{flag:'wx'});const inspection=await inspectVideo(this.cfg,path,signal);
      const ratio=String(expected.ratio).split(':').map(Number),aspect=ratio[0]!/ratio[1]!;
      requireThat(inspection.width===expected.width&&inspection.height===expected.height&&inspection.width*inspection.height<=c.max_image_pixels&&Math.abs(inspection.width/inspection.height-aspect)<0.03
        &&inspection.durationSeconds!==null&&Math.abs(inspection.durationSeconds-expected.duration!)<=Math.max(0.05,1/(inspection.fps??30))
        &&inspection.hasAudio===expected.audio,'GENERATION_VIDEO_INVALID','实际视频画面、时长或原声不符合冻结请求',422);
      await nativeCommand(this.cfg,process.env.FFMPEG_PATH?.trim()||'ffmpeg',['-v','error','-xerror','-protocol_whitelist','file,pipe','-i',path,'-f','null','-'],
        {cwd:root,timeoutMs:30000,maxOutputBytes:8192,signal});return {bytes,inspection};
    }finally{await rm(inside(this.cfg.runtimeRoot,root),{recursive:true,force:true});}
  }
  private async materialize(row:Submission,lease:StageLease,signal:AbortSignal):Promise<Submission>{
    if(row.state==='FAILED'||!row.private.provider_terminal||!row.private.billing_valid)return row;
    await transaction(this.pool,async db=>{const context=await this.live(lease,db);await this.videoAuthorization(row,context,db);});
    if(row.private.output){
      const bytes=await this.registered(row,row.private.output.object_key,this.contract(row).max_download_bytes,'MEDIA');
      requireThat(bytes&&sha256(bytes)===row.private.output.sha256,'GENERATION_OUTPUT_MISSING','原生成媒体缺失或摘要变化',503);return row;
    }
    const pointer=row.private.receipts.find(p=>p.ordinal===row.private.terminal_receipt_ordinal)!;
    const receipt=await this.readReceipt(row,pointer);requireThat(receipt,'GENERATION_RECEIPT_INVALID','原终态回执尚未确认',503);
    const c=this.contract(row),key=`${row.tenant_id}/generation/${row.order_id}/${row.id}/output.${row.generation_kind==='IMAGE'?'png':'mp4'}`;
    let bytes=await this.registered(row,key,c.max_download_bytes,'MEDIA');
    if(!bytes){
      if(row.generation_kind==='IMAGE'){
        const data=receipt.body.data;requireThat(Array.isArray(data)&&data.length===1,'GENERATION_IMAGE_INVALID','原回执未返回唯一图片',422);
        const encoded=object(data[0]).b64_json;requireThat(typeof encoded==='string'&&encoded.length>0&&encoded.length<=Math.ceil(c.max_download_bytes*4/3)+4,
          'GENERATION_IMAGE_INVALID','原图片编码或大小无效',422);
        bytes=Buffer.from(encoded,'base64');requireThat(bytes.toString('base64')===encoded,'GENERATION_IMAGE_INVALID','原图片Base64编码损坏',422);
      }else{
        const url=object(receipt.body.content).video_url;requireThat(typeof url==='string','GENERATION_MEDIA_URL_INVALID','原视频回执缺少媒体地址',503);
        bytes=await this.client.download(c,url,signal);
      }
    }
    const inspected=await this.inspect(row,bytes,signal);
    requireThat(inspected.bytes.length<=c.max_download_bytes,'GENERATION_MEDIA_INVALID','实际生成媒体超过原存储上限',422);
    // Recheck immediately before publication to private storage, then fence the
    // database result. A concurrent deletion queues any late object for erasure.
    await transaction(this.pool,async db=>{const context=await this.live(lease,db);await this.videoAuthorization(row,context,db);await this.fence(db,row);});
    await writePrivateObject(this.pool,this.store,this.scope(row,'MEDIA'),key,inspected.bytes,row.generation_kind==='IMAGE'?'image/png':'video/mp4');
    const output:GenerationOutput={object_key:key,sha256:sha256(inspected.bytes),inspection:inspected.inspection};
    await transaction(this.pool,async db=>{const context=await this.live(lease,db);await this.videoAuthorization(row,context,db);await this.fence(db,row);
      await db.query(`UPDATE provider_submissions SET state='SUCCEEDED',private=private||$3::jsonb,data=data||'{"state":"SUCCEEDED"}'::jsonb,
        updated_at=now() WHERE tenant_id=$1 AND id=$2`,[row.tenant_id,row.id,JSON.stringify({output})]);});
    return this.row(row.tenant_id,row.id);
  }
  private result(row:Submission):GenerationResult{return {submission_id:row.id,state:row.state,...(row.private.output?{output:row.private.output}:{})};}
  private validateNode(context:ExecutionContext,request:GenerationRequest):void{
    if(request.kind==='IMAGE'){
      const slot=context.snapshot.outputs.some(slot=>slot.kind==='image'&&request.operation_key===`image:${slot.slot_id}`);
      const reference=context.snapshot.engine==='REFERENCE_FILM'?request.operation_key==='reference:film'
        :context.contract.creative.shots.some(shot=>request.operation_key===`reference:${shot.shot_id}`);
      requireThat(slot||reference,'GENERATION_NODE_INVALID','图片生成必须对应冻结输出或参考镜头',422);return;
    }
    const shot=context.snapshot.engine==='PER_SHOT_AI'?context.contract.creative.shots.find(s=>request.operation_key===`video:${s.shot_id}`):null;
    requireThat(shot||context.snapshot.engine==='REFERENCE_FILM'&&request.operation_key==='film:original',
      'GENERATION_NODE_INVALID','视频必须对应原计划镜头或整片',422);
    const duration=shot?(shot.end_frame-shot.start_frame)/context.snapshot.timeline.fps:context.snapshot.timeline.target_frames/context.snapshot.timeline.fps;
    requireThat(request.video?.duration===duration
      &&request.video.audio===(context.snapshot.audio_policy.speech_mode!=='NONE'),'GENERATION_NODE_INVALID','视频时长或原声改变了冻结计划',422);
  }
  private async mediaFailure(row:Submission,error:unknown):Promise<void>{
    if(!['GENERATION_IMAGE_INVALID','GENERATION_VIDEO_INVALID','GENERATION_MEDIA_INVALID'].includes(code(error)))return;
    await this.pool.query(`UPDATE provider_submissions SET state='FAILED',data=data||'{"state":"FAILED"}'::jsonb,
      private=private||jsonb_build_object('last_error',$5::text),updated_at=now() WHERE tenant_id=$1 AND id=$2
      AND lease_owner=$3 AND lease_generation=$4 AND state='RUNNING' AND private->>'provider_terminal'='true'`,
    [row.tenant_id,row.id,row.lease_owner,row.lease_generation,code(error)]);
  }
  async submit(lease:StageLease,request:GenerationRequest,signal:AbortSignal):Promise<GenerationResult>{
    requireThat(!signal.aborted&&/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,159}$/.test(request.operation_key),'GENERATION_REQUEST_INVALID','生成操作标识无效或执行已取消',422);
    requireThat((request.kind==='IMAGE'&&!request.video)||(request.kind==='VIDEO'&&request.video),'GENERATION_REQUEST_INVALID','生成请求类型与视频参数不匹配',422);
    const context=await transaction(this.pool,db=>this.live(lease,db));this.validateNode(context,request);
    const c=generationContract(context.contract,request.kind);
    const checked=request.kind==='VIDEO'?await this.videoInputs(context,lease.id,request.operation_key,request.reference_asset_ids):null;
    const images=checked?.images??await this.images(context,request.reference_asset_ids);
    const prepared=request.kind==='IMAGE'?await prepareArkImage(c,request.prompt,images):await prepareArkVideo(c,request.prompt,images,request.video!);
    const {body,...wireSummary}=prepared;
    const summary={...wireSummary,...(checked?{reference_approval:checked.approval}:{})};
    const claimed=await transaction(this.pool,async db=>{
      const latest=await this.live(lease,db);
      if(checked){const current=await this.videoInputs(latest,lease.id,request.operation_key,request.reference_asset_ids,db);
        requireThat(hash(current.approval)===hash(checked.approval),'GENERATION_REFERENCE_APPROVAL_CHANGED','购买前参考核验绑定发生变化',409);}
      const intent=`generation:${lease.tenant_id}:${lease.scope_id}:${lease.id}:${request.operation_key}`;
      await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[intent]);
      const prior=(await db.query<Submission>('SELECT * FROM provider_submissions WHERE intent_key=$1',[intent])).rows[0];
      if(prior){requireThat(prior.input_hash===prepared.request_hash&&prior.private.contract_hash===hash(c)&&prior.generation_kind===request.kind,
        'GENERATION_REQUEST_CHANGED','原生成操作的输入、模型或费率不能更换',409);
        if(checked)requireThat(prior.private.prepared.reference_approval&&hash(prior.private.prepared.reference_approval)===hash(checked.approval),
          'GENERATION_REFERENCE_APPROVAL_CHANGED','原视频的核验授权不能替换',409);
        return {row:prior,created:false};}
      admitArkContract(this.cfg,c);
      requireThat((await db.query(`SELECT id FROM provider_model_versions WHERE id=$1 AND status='ADMITTED'
        AND data->>'capability_hash'=$2 AND private->'ark_contract'=$3::jsonb FOR SHARE`,[c.model_version_id,hash(c),JSON.stringify(c)])).rowCount===1,
        'GENERATION_MODEL_NOT_ADMITTED','原生成模型已撤销准入，不能发起新购买',503);
      const reservation=await reserve(db,{tenantId:lease.tenant_id,orderId:lease.scope_id},intent,c.rate.ceiling_micro,{contract_hash:hash(c),rate_snapshot_id:c.rate_snapshot_id,rate:c.rate});
      const submissionId=id('submission'),prefix=`${lease.tenant_id}/generation/${lease.scope_id}/${submissionId}`;
      const pointer:ReceiptPointer={ordinal:0,kind:'SUBMIT',key:`${prefix}/submit.json`};
      await insert(db,'provider_submissions',{id:submissionId,tenant_id:lease.tenant_id,order_id:lease.scope_id,stage_run_id:lease.id,
        generation_kind:request.kind,model_version_id:c.model_version_id,operation_key:request.operation_key,intent_key:intent,
        input_hash:prepared.request_hash,state:'SUBMITTING',reservation_id:reservation,lease_generation:1,lease_owner:id('generation_worker'),
        lease_expires_at:new Date(Date.now()+180000),data:{submission_id:submissionId,state:'SUBMITTING',kind:request.kind},
        private:{owner_id:context.ownerId,product_id:context.snapshot.product_id,wire_contract:c,contract_hash:hash(c),
          request_key:`${prefix}/request.json`,request_sha256:sha256(body),prepared:summary,receipts:[pointer]}});
      await db.query('UPDATE budget_reservations SET submission_id=$2 WHERE id=$1',[reservation,submissionId]);
      return {row:await this.row(lease.tenant_id,submissionId,db),created:true};
    });
    if(!claimed.created)return this.resume(lease,claimed.row.id,signal);
    const row=claimed.row;
    try{
      await writePrivateObject(this.pool,this.store,this.scope(row,'RECEIPT'),row.private.request_key,Buffer.from(body),'application/json');
      await transaction(this.pool,async db=>{const latest=await this.live(lease,db);await this.videoAuthorization(row,latest,db);await this.fence(db,row);
        await db.query(`UPDATE provider_submissions SET private=private||jsonb_build_object('sending_started_at',clock_timestamp()::text) WHERE tenant_id=$1 AND id=$2`,[row.tenant_id,row.id]);});
      const response=await this.client.submit(c,prepared,new Date(context.snapshot.deadline_at),signal);await this.persistReceipt(row,row.private.receipts[0]!,response);
      await this.applyReceipt(row,row.private.receipts[0]!);return this.result(await this.materialize(await this.row(row.tenant_id,row.id),lease,signal));
    }catch(error){
      await this.mediaFailure(row,error);
      await transaction(this.pool,async db=>{await lockMediaOwner(db,row.tenant_id,row.private.owner_id);
        await db.query('SELECT id FROM orders WHERE tenant_id=$1 AND id=$2 FOR UPDATE',[row.tenant_id,row.order_id]);await settle(db,row.tenant_id,row.reservation_id,null);
        await db.query(`UPDATE provider_submissions SET state=CASE WHEN state='SUBMITTING' THEN 'UNKNOWN' ELSE state END,
          private=private||jsonb_build_object('last_error',$3::text),updated_at=now() WHERE tenant_id=$1 AND id=$2`,[row.tenant_id,row.id,code(error)]);});
      throw error;
    }finally{await this.release(row);}
  }
  async resume(lease:StageLease,submissionId:string,signal:AbortSignal):Promise<GenerationResult>{
    const context=await transaction(this.pool,db=>this.live(lease,db));let row=await this.row(lease.tenant_id,submissionId);
    requireThat(row.order_id===lease.scope_id&&row.stage_run_id===lease.id,'GENERATION_SCOPE_INVALID','原生成任务不属于当前阶段',403);
    requireThat(hash(generationContract(context.contract,row.generation_kind))===hash(this.contract(row)),
      'GENERATION_CONTRACT_CHANGED','原生成协议不属于已售订单',503);
    await this.videoAuthorization(row,context);
    if(row.state==='SUCCEEDED'){await this.materialize(row,lease,signal);return this.result(row);}
    if(row.state==='FAILED')return this.result(row);
    const claimed=await this.claim(row);if(!claimed)throw new PendingExternal(2,'GENERATION_BUSY');row=claimed;
    try{await this.recover(row);row=await this.row(row.tenant_id,row.id);await this.query(row,signal);
      row=await this.row(row.tenant_id,row.id);return this.result(await this.materialize(row,lease,signal));
    }catch(error){
      await this.mediaFailure(row,error);
      await this.pool.query(`UPDATE provider_submissions SET private=private||jsonb_build_object('last_error',$3::text),updated_at=now()
        WHERE tenant_id=$1 AND id=$2 AND lease_generation=$4 AND lease_owner=$5`,
        [row.tenant_id,row.id,code(error),claimed.lease_generation,claimed.lease_owner]);
      throw error;
    }finally{await this.release(claimed);}
  }
  /** Read-only completed input for an already-authorized POST role. Unresolved
   * supplier tasks stay in PRODUCTION and cannot be polled through this path. */
  async describe(context:ExecutionContext,submissionId:string,signal:AbortSignal):Promise<GenerationResult>{
    requireThat(!signal.aborted,'TOOL_EXECUTION_INTERRUPTED','原生成结果读取已停止',409);
    const row=await this.row(context.tenantId,submissionId);
    requireThat(row.order_id===context.orderId&&(await this.pool.query(`SELECT id FROM stage_runs
      WHERE tenant_id=$1 AND id=$2 AND scope_type='ORDER' AND scope_id=$3 AND stage_name='PRODUCTION'
      AND input_hash=$4 AND state='SUCCEEDED'`,[context.tenantId,row.stage_run_id,context.orderId,context.snapshotHash])).rowCount===1,
    'GENERATION_SCOPE_INVALID','后期只能读取原订单已完成制作阶段的生成结果',403);
    requireThat(row.state==='SUCCEEDED'&&row.private.output,'GENERATION_OUTPUT_MISSING','后期输入尚未完成，不能另购任务',409);
    requireThat(hash(generationContract(context.contract,row.generation_kind))===hash(this.contract(row)),
      'GENERATION_CONTRACT_CHANGED','原生成模型与订单不同',503);
    await this.videoAuthorization(row,context);
    const bytes=await this.registered(row,row.private.output.object_key,this.contract(row).max_download_bytes,'MEDIA');
    requireThat(bytes&&sha256(bytes)===row.private.output.sha256,'GENERATION_OUTPUT_MISSING','原生成输出缺失或摘要变化',503);
    return this.result(row);
  }
  /** Historical receipt settlement deliberately works with purchases disabled,
   * retired runtime sessions and expired model admission. It never submits. */
  async reconcileReceipts(limit=20,signal:AbortSignal=new AbortController().signal):Promise<{settled:number;blocked:number}>{
    requireThat(Number.isSafeInteger(limit)&&limit>0&&limit<=100,'RECONCILIATION_LIMIT_INVALID','对账批次无效',500);
    const rows=(await this.pool.query<Submission>(`SELECT * FROM provider_submissions WHERE generation_kind IS NOT NULL
      AND state IN ('SUBMITTING','UNKNOWN','RUNNING') ORDER BY updated_at,id LIMIT $1`,[limit])).rows;
    let settled=0,blocked=0;
    for(const candidate of rows){const claimed=await this.claim(candidate);if(!claimed){blocked++;continue;}
      try{let row=await this.recover(claimed);
        if(!row.private.provider_terminal&&row.provider_task_id&&this.cfg.generationEnabled){await this.query(row,signal);row=await this.row(row.tenant_id,row.id);}
        if(row.private.provider_terminal&&row.private.billing_valid){
          settled++;
          // Stopped orders retain financial facts but cannot publish new media.
          const live=(await this.pool.query(`SELECT id FROM orders WHERE tenant_id=$1 AND id=$2 AND payment_state='CONFIRMED'
            AND fulfillment_state IN ('QUEUED','IN_PROGRESS') AND deadline_at>now() AND NOT (private ? 'media_revoked')`,[row.tenant_id,row.order_id])).rowCount;
          if(!live)await this.pool.query(`UPDATE provider_submissions SET state='FAILED',data=data||'{"state":"FAILED"}'::jsonb,
            private=private||'{"last_error":"GENERATION_SCOPE_ENDED"}'::jsonb WHERE tenant_id=$1 AND id=$2 AND state='RUNNING'`,[row.tenant_id,row.id]);
        }else blocked++;
      }catch(error){blocked++;await this.pool.query(`UPDATE provider_submissions SET private=private||jsonb_build_object('reconciliation_error',$3::text),updated_at=now()
        WHERE tenant_id=$1 AND id=$2`,[candidate.tenant_id,candidate.id,code(error)]);
      }finally{await this.release(claimed);}
    }return {settled,blocked};
  }
}
