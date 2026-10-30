import type {Db} from '../db/pool.js';
import type {Config} from '../config.js';
import type {DTO,ManagementPrincipal} from '../../shared/contracts/types.js';
import type {ObjectStorage} from '../storage/storage.js';
import {AppError,notFound,requireThat} from '../lib/errors.js';
import {hash,iso,sha256} from '../lib/crypto.js';
import {audit} from '../db/store.js';
import {validate} from '../lib/validation.js';
import {staffTicket,managedTicket} from './support-desk.js';
import {deliveredSource} from '../../worker/revisions/context.js';
import {limitedRevisionRoute} from '../../worker/revisions/contract.js';
import {inspectImage} from '../../worker/media/photo-pipeline.js';

export async function supportRepairContext(db:Db,cfg:Config,admin:ManagementPrincipal,ticketId:string,traceId:string):Promise<DTO<'SupportRepairContext'>>{
  requireThat(admin.permissions.has('support:repair')||admin.permissions.has('*'),'MANAGEMENT_FORBIDDEN','当前客服无素材纠错权限',403);
  const ticket=await staffTicket(db,ticketId);
  requireThat(ticket.content_available,'SUPPORT_CONTENT_REVOKED','原订单私有内容已撤销，请停止核对素材',410);
  requireThat(ticket.private?.assigned_actor===admin.actor,'SUPPORT_ASSIGNEE_REQUIRED','请先接手原工单，再核对原素材',403);
  const detail=await managedTicket(db,admin,ticketId,traceId),linked=ticket.private?.platform_repair as {revision_id:string}|undefined;
  const repair=linked?(await db.query<{data:DTO<'Revision'>}>(`SELECT data FROM revision_requests WHERE tenant_id=$1 AND owner_id=$2 AND order_id=$3 AND id=$4
    AND NOT(private ? 'privacy_deleted')`,[ticket.tenant_id,ticket.owner_id,ticket.order_id,linked.revision_id])).rows[0]?.data??null:null;
  requireThat(!linked||repair,'PLATFORM_REPAIR_LINK_UNAVAILABLE','原纠错记录不可用，请核对原订单记录',503);
  const result:DTO<'SupportRepairContext'>={ticket:detail.summary,manifest:null,product_profile:null,repair,
    allowed_changes:[],can_submit:false,reason_codes:[],window_expires_at:null};
  let source:Awaited<ReturnType<typeof deliveredSource>>;
  try{source=await deliveredSource(db,ticket.tenant_id,ticket.order_id,ticket.owner_id!);}
  catch(error){if(error instanceof AppError){result.reason_codes=[error.code];return result;}throw error;}
  const manifest=(await db.query<{data:DTO<'Deliverables'>;hash:string}>(`SELECT data,hash FROM delivery_manifests WHERE tenant_id=$1 AND owner_id=$2 AND order_id=$3
    ORDER BY revision DESC LIMIT 1`,[ticket.tenant_id,ticket.owner_id,ticket.order_id])).rows[0]??notFound();
  requireThat(hash(manifest.data)===manifest.hash&&manifest.data.order_id===ticket.order_id
    &&Number.isFinite(Date.parse(manifest.data.expires_at))&&Date.parse(manifest.data.expires_at)===Date.parse(source.expiry),
    'MANIFEST_CHANGED','原素材清单或领取期不一致，请核对订单',503);
  result.manifest=validate('Deliverables',manifest.data,true);result.product_profile=validate('Profile',source.contract.profile,true);
  const first=(await db.query<{delivered_at:Date}>('SELECT delivered_at FROM delivery_manifests WHERE tenant_id=$1 AND order_id=$2 ORDER BY revision LIMIT 1',[ticket.tenant_id,ticket.order_id])).rows[0]??notFound();
  const expiry=Math.min(first.delivered_at.getTime()+source.policy.window_hours*3600000,Date.parse(source.expiry));result.window_expires_at=iso(expiry);
  if(repair)result.reason_codes.push('PLATFORM_REPAIR_ALREADY_LINKED');
  if(ticket.state!=='PROCESSING'||!['PRODUCT_ERROR','GENERATION','OTHER'].includes(ticket.data.category))result.reason_codes.push('PLATFORM_REPAIR_TICKET_INVALID');
  if(!limitedRevisionRoute(source.snapshot))result.reason_codes.push('REVISION_POLICY_UNAVAILABLE');
  if(expiry<=Date.now())result.reason_codes.push('REVISION_WINDOW_EXPIRED');
  if(!cfg.codex.enabled||!cfg.codex.apiKey)result.reason_codes.push('CODEX_NOT_CONFIGURED');
  const active=await db.query("SELECT id FROM revision_requests WHERE tenant_id=$1 AND order_id=$2 AND state IN ('REQUESTED','PROCESSING')",[ticket.tenant_id,ticket.order_id]);
  if(active.rowCount&&!repair)result.reason_codes.push('REVISION_IN_PROGRESS');
  const budget=(await db.query<{policy_hash:string;ceiling_micro:string;spent_micro:string;reserved_micro:string}>(
    'SELECT * FROM revision_budgets WHERE tenant_id=$1 AND order_id=$2',[ticket.tenant_id,ticket.order_id])).rows[0];
  if(budget){
    requireThat(budget.policy_hash===hash(source.policy)&&Number(budget.ceiling_micro)===source.policy.budget_micro,'REVISION_BUDGET_CHANGED','原售后费用快照不一致',503);
    if(Number(budget.spent_micro)+Number(budget.reserved_micro)>=Number(budget.ceiling_micro))result.reason_codes.push('REVISION_BUDGET_OR_DEADLINE_EXCEEDED');
  }
  const pending=await db.query(`SELECT c.id FROM revision_cost_reservations c JOIN revision_budgets b ON b.tenant_id=c.tenant_id AND b.id=c.budget_id
    WHERE b.tenant_id=$1 AND b.order_id=$2 AND c.state IN ('RESERVED','UNKNOWN')`,[ticket.tenant_id,ticket.order_id]);
  if(pending.rowCount)result.reason_codes.push('REVISION_COST_UNRESOLVED');
  const calls=(await db.query<{role:string;n:string}>(`SELECT a.role,count(*) AS n FROM inference_requests q
    JOIN revision_requests r ON r.tenant_id=q.tenant_id AND r.id=q.scope_id JOIN agent_runs a ON a.tenant_id=q.tenant_id AND a.id=q.run_id
    WHERE r.tenant_id=$1 AND r.order_id=$2 AND q.scope_type='REVISION' GROUP BY a.role`,[ticket.tenant_id,ticket.order_id])).rows;
  if(calls.reduce((n,c)=>n+Number(c.n),0)+3>source.policy.limits.max_requests
    ||['POST','REVIEW_FACTS','REVIEW_STYLE'].some(role=>Number(calls.find(c=>c.role===role)?.n??0)>=source.policy.limits.max_requests_per_role!))result.reason_codes.push('CODEX_ROLE_INFERENCE_LIMIT');
  result.can_submit=result.reason_codes.length===0;
  if(result.can_submit)result.allowed_changes=['COVER','ALLOWED_ORDER','DISPLAY_TEXT',...(source.policy.image_text?['IMAGE_TEXT' as const]:[])];
  await audit(db,ticket.tenant_id,admin.actor,'SUPPORT_REPAIR_CONTEXT_READ',ticket.id,{manifest_revision:manifest.data.manifest_revision,linked_revision:repair?.revision_id??null},traceId);
  return result;
}

export async function supportRepairImage(db:Db,cfg:Config,store:ObjectStorage,admin:ManagementPrincipal,ticketId:string,rawRevision:string,deliverableId:string,traceId:string):Promise<DTO<'SupportRepairImage'>>{
  requireThat(/^[1-9][0-9]{0,9}$/.test(rawRevision)&&Number(rawRevision)<=2147483647,'MANIFEST_REVISION_INVALID','素材版本无效',400);
  const context=await supportRepairContext(db,cfg,admin,ticketId,traceId),pack=context.manifest;
  requireThat(pack,'REPAIR_MEDIA_UNAVAILABLE','当前订单素材不可继续读取',410);
  requireThat(pack.manifest_revision===Number(rawRevision),'MANIFEST_CHANGED','素材已经更新，请重新核对原清单',409);
  const item=pack.items.find(i=>i.deliverable_id===deliverableId&&i.kind==='image');requireThat(item,'NOT_FOUND','图片不属于当前原订单素材清单',404);
  const ticket=await staffTicket(db,ticketId);
  const artifact=(await db.query<{object_key:string}>(`SELECT a.object_key FROM artifacts a JOIN private_object_writes w
    ON w.tenant_id=a.tenant_id AND w.order_id=a.order_id AND w.object_key=a.object_key AND w.sha256=a.sha256
    WHERE a.tenant_id=$1 AND a.order_id=$2 AND a.id=$3 AND a.sha256=$4 AND a.expires_at>now()
    AND w.owner_id=$5 AND w.product_id=$6 AND w.kind='MEDIA' AND w.state='STORED' AND NOT w.delete_requested AND w.expires_at>now() LIMIT 1`,
    [ticket.tenant_id,ticket.order_id,deliverableId,item.sha256,ticket.owner_id,context.product_profile!.product_id])).rows[0];
  requireThat(artifact&&item.mime_type==='image/png','REPAIR_MEDIA_UNAVAILABLE','原图片已失效或缺少有效的私有登记',410);
  const bytes=await store.get(artifact.object_key,30_000_000),image=await inspectImage(bytes);
  requireThat(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))&&sha256(bytes)===item.sha256&&image.width===item.width&&image.height===item.height,
    'ARTIFACT_HASH_MISMATCH','原图片实际文件与清单不一致',503);
  await audit(db,ticket.tenant_id,admin.actor,'SUPPORT_REPAIR_IMAGE_READ',ticket.id,{manifest_revision:pack.manifest_revision,deliverable_id:deliverableId,sha256:item.sha256},traceId);
  return {manifest_revision:pack.manifest_revision,deliverable_id:deliverableId,mime_type:'image/png',sha256:item.sha256,bytes_base64:bytes.toString('base64')};
}
