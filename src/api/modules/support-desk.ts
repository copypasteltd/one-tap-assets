import type {Db} from '../db/pool.js';
import type {Config} from '../config.js';
import type {DTO,ManagementPrincipal,Principal} from '../../shared/contracts/types.js';
import {audit,update,type RecordRow,type PageQuery} from '../db/store.js';
import {cursor,limit} from '../lib/pagination.js';
import {iso,sha256} from '../lib/crypto.js';
import {notFound,requireThat} from '../lib/errors.js';
import {lockMediaOwner} from './media-access.js';
import type {ObjectStorage} from '../storage/storage.js';

interface TicketRow extends RecordRow<DTO<'Ticket'>> {order_id:string;state:DTO<'Ticket'>['state'];content_available:boolean}
const select=`SELECT t.*, NOT(COALESCE(o.private->>'media_revoked'='true',false) OR EXISTS
  (SELECT 1 FROM privacy_redactions r WHERE r.tenant_id=t.tenant_id AND r.target_table='support_tickets' AND r.target_id=t.id)) AS content_available
  FROM support_tickets t JOIN orders o ON o.tenant_id=t.tenant_id AND o.owner_id=t.owner_id AND o.id=t.order_id`;
function summary(row:TicketRow):DTO<'ManagedSupportTicket'>{
  return {ticket_id:row.id,order_id:row.order_id,state:row.state,category:row.data.category,updated_at:row.data.updated_at,
    revision:row.data.revision??0,assigned_actor:typeof row.private?.assigned_actor==='string'?row.private.assigned_actor:null,
    has_response:row.content_available&&!!row.private?.response,content_available:row.content_available};
}
function buyerTicket(row:TicketRow):DTO<'Ticket'>{
  // Only this explicit projection can add private correspondence to an owned response.
  const result:DTO<'Ticket'>={ticket_id:row.id,order_id:row.order_id,state:row.state,category:row.data.category,updated_at:row.data.updated_at};
  if(row.data.revision!==undefined)result.revision=row.data.revision;
  if(row.content_available&&row.private?.response)result.response=row.private.response as DTO<'SupportReply'>;
  return result;
}
async function staffTicket(db:Db,ticketId:string,lock=false):Promise<TicketRow>{
  const observed=(await db.query<TicketRow>(`${select} WHERE t.id=$1`,[ticketId])).rows[0]??notFound();
  // Privacy enumeration takes this lock before individual rows as well.
  await lockMediaOwner(db,observed.tenant_id,observed.owner_id!);
  return (await db.query<TicketRow>(`${select} WHERE t.id=$1${lock?' FOR UPDATE OF t':''}`,[ticketId])).rows[0]??notFound();
}
export async function listBuyerTickets(db:Db,cfg:Config,p:Principal,query:PageQuery){
  await lockMediaOwner(db,p.tenantId,p.userId);
  const scope=`support_tickets:${p.tenantId}:${p.userId}`,size=limit(query.limit),point=cursor.decode(cfg,query.cursor,scope);
  const rows=(await db.query<TicketRow>(`${select} WHERE t.tenant_id=$1 AND t.owner_id=$2
    AND ($3::timestamptz IS NULL OR (t.created_at,t.id)<($3,$4)) ORDER BY t.created_at DESC,t.id DESC LIMIT $5`,
    [p.tenantId,p.userId,point?.createdAt??null,point?.id??null,size+1])).rows;
  const items=rows.slice(0,size),last=items.at(-1);
  return {items:items.map(buyerTicket),next_cursor:last&&rows.length>size?cursor.encode(cfg,{createdAt:last.created_at.toISOString(),id:last.id},scope):null};
}
export async function getBuyerTicket(db:Db,p:Principal,ticketId:string):Promise<DTO<'Ticket'>>{
  await lockMediaOwner(db,p.tenantId,p.userId);
  const row=(await db.query<TicketRow>(`${select} WHERE t.id=$1 AND t.tenant_id=$2 AND t.owner_id=$3`,[ticketId,p.tenantId,p.userId])).rows[0]??notFound();
  return buyerTicket(row);
}
export async function listManagedTickets(db:Db,cfg:Config,admin:ManagementPrincipal,query:PageQuery&{state?:string}):Promise<DTO<'ManagedSupportTicketList'>>{
  requireThat(query.state===undefined||['OPEN','PROCESSING','RESOLVED','CLOSED'].includes(query.state),'SUPPORT_FILTER_INVALID','工单状态筛选无效',400);
  const size=limit(query.limit),scope=`support-desk:${admin.actor}:${query.state??'ALL'}`,point=cursor.decode(cfg,query.cursor,scope);
  const rows=(await db.query<TicketRow>(`${select} WHERE ($1::text IS NULL OR t.state=$1)
    AND ($2::timestamptz IS NULL OR (t.created_at,t.id)<($2,$3)) ORDER BY t.created_at DESC,t.id DESC LIMIT $4`,[query.state??null,point?.createdAt??null,point?.id??null,size+1])).rows;
  const items=rows.slice(0,size),last=items.at(-1);
  return {items:items.map(summary),next_cursor:last&&rows.length>size?cursor.encode(cfg,{createdAt:last.created_at.toISOString(),id:last.id},scope):null};
}
export async function managedTicket(db:Db,admin:ManagementPrincipal,ticketId:string,traceId:string):Promise<DTO<'ManagedSupportDetail'>>{
  const row=await staffTicket(db,ticketId);
  await audit(db,row.tenant_id,admin.actor,'SUPPORT_DETAIL_READ',row.id,{revision:row.data.revision??0},traceId);
  return {summary:summary(row),message:row.content_available?String(row.private?.message??'')||null:null,
    attachment_asset_ids:row.content_available?(row.private?.attachment_asset_ids as string[]??[]):[],
    response:row.content_available?(row.private?.response as DTO<'SupportReply'>??null):null};
}
export async function processTicket(db:Db,admin:ManagementPrincipal,ticketId:string,request:DTO<'SupportProcessRequest'>):Promise<DTO<'ManagedSupportTicket'>>{
  const row=await staffTicket(db,ticketId,true),current=summary(row);
  requireThat(row.content_available,'SUPPORT_CONTENT_REVOKED','该订单私有内容已撤销，不能追加或恢复正文',410);
  requireThat(current.revision===request.expected_revision,'SUPPORT_REVISION_CHANGED','工单已更新，请刷新后处理',409);
  const message=request.message?.trim();let state=row.state;
  if(request.action==='CLAIM'){
    requireThat(row.state==='OPEN'&&current.assigned_actor===null&&!request.message,'SUPPORT_TRANSITION_INVALID','仅待接手工单可以接单，接单不附带回复',422);
    state='PROCESSING';
  }else{
    requireThat(current.assigned_actor===admin.actor,'SUPPORT_ASSIGNEE_REQUIRED','仅接手该工单的客服可以继续处理',403);
    if(request.action==='CLOSE')requireThat(row.state==='RESOLVED'&&current.has_response&&!request.message,'SUPPORT_TRANSITION_INVALID','请先回复并解决，再关闭工单',422);
    else requireThat(row.state==='PROCESSING'&&!!message,'SUPPORT_REPLY_REQUIRED','请在处理中填写给用户的回复',422);
    state=request.action==='RESOLVE'?'RESOLVED':request.action==='CLOSE'?'CLOSED':'PROCESSING';
  }
  const now=iso(),data:DTO<'Ticket'>={...row.data,state,revision:current.revision+1,updated_at:now};
  const privateData={...row.private,assigned_actor:admin.actor,...(message?{response:{message,updated_at:now}}:{})};
  await update(db,'support_tickets',row.id,{state,data,private:privateData,updated_at:now},row.tenant_id);
  // No message or attachment bytes enter management idempotency or audit storage.
  return summary({...row,state,data,private:privateData});
}
export async function supportEvidence(db:Db,store:ObjectStorage,admin:ManagementPrincipal,ticketId:string,assetId:string,traceId:string):Promise<DTO<'SupportEvidence'>>{
  const ticket=await staffTicket(db,ticketId);
  requireThat(ticket.content_available,'SUPPORT_CONTENT_REVOKED','该工单证明已撤销',410);
  requireThat((ticket.private?.attachment_asset_ids as string[]??[]).includes(assetId),'NOT_FOUND','证明不存在或不属于此工单',404);
  const asset=(await db.query<{sha256:string;object_key:string}>(`SELECT a.sha256,a.object_key FROM assets a JOIN private_object_writes w
    ON w.tenant_id=a.tenant_id AND w.owner_id=a.owner_id AND w.asset_id=a.id AND w.object_key=a.object_key AND w.sha256=a.sha256
    WHERE a.id=$1 AND a.tenant_id=$2 AND a.owner_id=$3 AND a.purpose='SUPPORT_EVIDENCE' AND a.state='READY' AND a.expires_at>now()
    AND w.state='STORED' AND NOT w.delete_requested AND w.expires_at>now()`,[assetId,ticket.tenant_id,ticket.owner_id])).rows[0];
  requireThat(asset,'SUPPORT_EVIDENCE_UNAVAILABLE','证明图片已失效或正在撤销',410);
  const bytes=await store.get(asset.object_key,40_000_000);
  requireThat(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))&&sha256(bytes)===asset.sha256,'SUPPORT_EVIDENCE_CHANGED','证明文件与原记录不一致',503);
  await audit(db,ticket.tenant_id,admin.actor,'SUPPORT_EVIDENCE_READ',ticket.id,{asset_id:assetId,sha256:asset.sha256},traceId);
  return {asset_id:assetId,mime_type:'image/png',sha256:asset.sha256,bytes_base64:bytes.toString('base64')};
}
