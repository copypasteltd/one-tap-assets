import type {Db} from '../db/pool.js';
import type {Config} from '../config.js';
import type {PageQuery} from '../db/store.js';
import type {DTO,Principal} from '../../shared/contracts/types.js';
import {id,hash,sha256} from '../lib/crypto.js';
import {AppError,requireThat,notFound} from '../lib/errors.js';
import {cursor,limit} from '../lib/pagination.js';
import {lockMediaOwner} from './media-access.js';
import {assertPlusRenderGrant} from './plus-access.js';
import {createPlusRenderPlan,getPlusRenderPlan,plusRenderPricing} from './plus-render.js';

interface BatchRow {id:string;created_at:Date;item_count:number;input_hash:string}
interface ItemRow {position:number;request_id:string|null;input:DTO<'PlusBatchItemRequest'>;failure:DTO<'PlusBatchFailure'>|null;visible:boolean}
interface SummaryRow extends BatchRow {prepared_count:number;preparation_failed_count:number}
function summary(row:SummaryRow):DTO<'PlusBatchSummary'>{
  return {batch_id:row.id,created_at:row.created_at.toISOString(),item_count:row.item_count,prepared_count:row.prepared_count,
    preparation_failed_count:row.preparation_failed_count,removed_count:row.item_count-row.prepared_count-row.preparation_failed_count};
}
function itemFailure(error:unknown):DTO<'PlusBatchFailure'>{
  return {code:error instanceof AppError&&/^[A-Z][A-Z0-9_]{0,79}$/.test(error.code)?error.code:'PLUS_BATCH_ITEM_FAILED',
    message:error instanceof AppError&&error.status<500?error.message:'当前商品暂时无法整理。请保留批次记录，稍后重新选择这件商品再试。'};
}
export async function getPlusRenderBatch(db:Db,p:Principal,batchId:string):Promise<DTO<'PlusBatch'>>{
  const row=(await db.query<BatchRow>('SELECT id,created_at,item_count,input_hash FROM plus_render_batches WHERE tenant_id=$1 AND owner_id=$2 AND id=$3',
    [p.tenantId,p.userId,batchId])).rows[0]??notFound();
  const rows=(await db.query<ItemRow>(`SELECT i.position,i.request_id,i.input,i.failure,
    (i.product_id IS NULL OR (p.deleted_at IS NULL AND p.expires_at>now())) AS visible
    FROM plus_render_batch_items i LEFT JOIN product_drafts p ON p.tenant_id=i.tenant_id AND p.id=i.product_id
    WHERE i.tenant_id=$1 AND i.batch_id=$2 ORDER BY i.position`,[p.tenantId,batchId])).rows;
  const byPosition=new Map(rows.map(i=>[i.position,i])),items:DTO<'PlusBatchItem'>[]=[];
  for(let position=1;position<=row.item_count;position++){
    const item=byPosition.get(position);
    if(!item||!item.visible){items.push({position,state:'SOURCE_REMOVED',input:null,render:null,failure:null});continue;}
    if(!item.request_id){items.push({position,state:'PREPARATION_FAILED',input:item.input,render:null,failure:item.failure});continue;}
    try{items.push({position,state:'PREPARED',input:item.input,render:await getPlusRenderPlan(db,p,item.request_id),failure:null});}
    catch(error){if(!(error instanceof AppError&&error.status===404))throw error;items.push({position,state:'SOURCE_REMOVED',input:null,render:null,failure:null});}
  }
  return {...summary({...row,prepared_count:items.filter(i=>i.state==='PREPARED').length,preparation_failed_count:items.filter(i=>i.state==='PREPARATION_FAILED').length}),items};
}
export async function listPlusRenderBatches(db:Db,cfg:Config,p:Principal,query:PageQuery):Promise<DTO<'PlusBatchList'>>{
  const scope=`plus-batches:${p.tenantId}:${p.userId}`,size=limit(query.limit),point=cursor.decode(cfg,query.cursor,scope);
  const rows=(await db.query<SummaryRow>(`SELECT b.*,counts.prepared_count,counts.preparation_failed_count FROM plus_render_batches b
    LEFT JOIN LATERAL (SELECT
      (COUNT(i.id) FILTER(WHERE i.request_id IS NOT NULL AND (i.product_id IS NULL OR (p.deleted_at IS NULL AND p.expires_at>now()))))::integer AS prepared_count,
      (COUNT(i.id) FILTER(WHERE i.request_id IS NULL AND (i.product_id IS NULL OR (p.deleted_at IS NULL AND p.expires_at>now()))))::integer AS preparation_failed_count
      FROM plus_render_batch_items i LEFT JOIN product_drafts p ON p.tenant_id=i.tenant_id AND p.id=i.product_id
      WHERE i.tenant_id=b.tenant_id AND i.batch_id=b.id) counts ON true
    WHERE b.tenant_id=$1 AND b.owner_id=$2 AND ($3::timestamptz IS NULL OR (b.created_at,b.id)<($3,$4))
    ORDER BY b.created_at DESC,b.id DESC LIMIT $5`,[p.tenantId,p.userId,point?.createdAt??null,point?.id??null,size+1])).rows;
  const selected=rows.slice(0,size),last=selected.at(-1);
  return {items:selected.map(summary),next_cursor:rows.length>size&&last?cursor.encode(cfg,{createdAt:last.created_at.toISOString(),id:last.id},scope):null};
}
/** The business transaction encloses the complete group. Savepoints isolate
 * preparation failures; each successful PLAN remains an independent job.
 * A hashed request key stores no cached private response, so replay always
 * checks live permission and redacts removed products. */
export async function createPlusRenderBatch(db:Db,cfg:Config,p:Principal,request:DTO<'PlusBatchCreateRequest'>):Promise<DTO<'PlusBatch'>>{
  await lockMediaOwner(db,p.tenantId,p.userId);await assertPlusRenderGrant(db,p);
  const keyHash=sha256(request.request_key),inputHash=hash(request.items);
  const prior=(await db.query<BatchRow>('SELECT id,input_hash FROM plus_render_batches WHERE tenant_id=$1 AND owner_id=$2 AND request_key_hash=$3',
    [p.tenantId,p.userId,keyHash])).rows[0];
  if(prior){requireThat(prior.input_hash===inputHash,'PLUS_BATCH_INTENT_CHANGED','这次批量操作的商品或版本已变化，请重新确认后提交',409);return getPlusRenderBatch(db,p,prior.id);}
  requireThat(request.items.length>=2&&request.items.length<=10&&new Set(request.items.map(i=>i.draft_id)).size===request.items.length,
    'PLUS_BATCH_ITEMS_INVALID','请选择2至10份不同的已保存图片草稿',422);
  plusRenderPricing(cfg);requireThat(cfg.paymentsEnabled&&cfg.codex.enabled,'SERVICE_NOT_ADMITTED','正式制作与交易服务尚未开放',503);
  const batchId=id('plusbatch');await db.query(`INSERT INTO plus_render_batches(id,tenant_id,owner_id,request_key_hash,input_hash,item_count) VALUES($1,$2,$3,$4,$5,$6)`,
    [batchId,p.tenantId,p.userId,keyHash,inputHash,request.items.length]);
  for(const [index,item] of request.items.entries()){
    const product=(await db.query<{product_id:string}>('SELECT product_id FROM plus_edit_drafts WHERE tenant_id=$1 AND owner_id=$2 AND id=$3',[p.tenantId,p.userId,item.draft_id])).rows[0];
    let render:DTO<'PlusRenderPlan'>|undefined,failure:DTO<'PlusBatchFailure'>|null=null;
    await db.query('SAVEPOINT plus_batch_item');
    try{render=await createPlusRenderPlan(db,cfg,p,item.draft_id,{expected_revision:item.expected_revision,variant_id:item.variant_id,variant_version:item.variant_version});await db.query('RELEASE SAVEPOINT plus_batch_item');}
    catch(error){await db.query('ROLLBACK TO SAVEPOINT plus_batch_item');await db.query('RELEASE SAVEPOINT plus_batch_item');
      if(error instanceof AppError&&(error.status===401||['PLUS_SCOPE_FORBIDDEN','PLUS_RENDER_APPROVAL_REQUIRED','PLUS_SESSION_REQUIRED'].includes(error.code)))throw error;
      failure=itemFailure(error);}
    await db.query(`INSERT INTO plus_render_batch_items(id,tenant_id,batch_id,position,product_id,request_id,input,failure) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
      [id('plusbatchitem'),p.tenantId,batchId,index+1,product?.product_id??null,render?.request_id??null,JSON.stringify(item),failure?JSON.stringify(failure):null]);
  }
  return getPlusRenderBatch(db,p,batchId);
}
