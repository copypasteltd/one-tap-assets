import type { Db } from '../db/pool.js';
import type { Config } from '../config.js';
import type { DTO, Principal } from '../../shared/contracts/types.js';
import { owned, scoped, insert, update,type PageQuery } from '../db/store.js';
import { id, iso, addSeconds, hmac, equalSecret } from '../lib/crypto.js';
import { requireThat, AppError, notFound } from '../lib/errors.js';
import { createRevision } from '../../worker/revisions/context.js';
import { lockMediaOwner } from './media-access.js';
import {cursor,limit} from '../lib/pagination.js';
export async function listRevisions(db:Db,cfg:Config,p:Principal,orderId:string,query:PageQuery):Promise<DTO<'RevisionList'>>{
  await owned(db,'orders',orderId,p);const scope=`revisions:${p.tenantId}:${p.userId}:${orderId}`;const size=limit(query.limit);const point=cursor.decode(cfg,query.cursor,scope);
  const rows=(await db.query<{id:string;created_at:Date;data:DTO<'Revision'>}>(`SELECT id,created_at,data FROM revision_requests
    WHERE tenant_id=$1 AND owner_id=$2 AND order_id=$3 AND NOT(private ? 'privacy_deleted') AND ($4::timestamptz IS NULL OR (created_at,id)<($4,$5))
    ORDER BY created_at DESC,id DESC LIMIT $6`,[p.tenantId,p.userId,orderId,point?.createdAt??null,point?.id??null,size+1])).rows;
  const slice=rows.slice(0,size);const last=slice.at(-1);return {items:slice.map(r=>r.data),next_cursor:rows.length>size && last?cursor.encode(cfg,{createdAt:last.created_at.toISOString(),id:last.id},scope):null};
}
import { POLICIES } from '../../shared/domain/policies.js';
import { previewMedia } from './previews.js';
export async function getDeliverables(db: Db, p: Principal, orderId: string): Promise<DTO<'Deliverables'>> {
  const order = await owned<DTO<'Order'>>(db, 'orders', orderId, p);
  requireThat(order.data.fulfillment_state === 'DELIVERED', 'PACK_NOT_READY', '整包素材仍在制作或验收中', 409);
  requireThat(order.data.delivery_expires_at && Date.parse(order.data.delivery_expires_at) > Date.now() && !order.private?.media_revoked, 'DELIVERY_EXPIRED', '素材领取期已结束或已被删除', 410);
  const manifest = (await db.query<{ data: DTO<'Deliverables'> }>('SELECT data FROM delivery_manifests WHERE tenant_id=$1 AND order_id=$2 AND owner_id=$3 ORDER BY revision DESC LIMIT 1', [p.tenantId, orderId, p.userId])).rows[0] ?? notFound();
  return manifest.data;
}
export interface DownloadCapability { purpose: 'DELIVERY' | 'PREVIEW' | 'SAMPLE' | 'PUBLIC_SAMPLE'; tenantId: string; ownerId: string; resourceId: string; itemId: string; exp: number }
export function signDownload(cfg: Config, grant: Omit<DownloadCapability, 'exp'>): { url: string; expires_at: string } {
  const expiry = Date.now() + POLICIES.linkTtlSeconds * 1000;
  const data = Buffer.from(JSON.stringify({ ...grant, exp: expiry })).toString('base64url');
  return { url: `${cfg.publicBaseUrl}/storage/downloads/${data}?signature=${hmac(cfg.signingKey, data)}`, expires_at: iso(expiry) };
}
export function verifyDownload(cfg: Config, encoded: string, signature: string): DownloadCapability {
  requireThat(encoded.length <= 2048 && equalSecret(hmac(cfg.signingKey, encoded), signature), 'DOWNLOAD_NOT_AUTHORIZED', '下载授权无效，请重新获取', 401);
  const grant = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as DownloadCapability;
  requireThat(['DELIVERY', 'PREVIEW', 'SAMPLE', 'PUBLIC_SAMPLE'].includes(grant.purpose) && typeof grant.tenantId === 'string' && typeof grant.ownerId === 'string' && typeof grant.resourceId === 'string' && typeof grant.itemId === 'string' && Number.isSafeInteger(grant.exp), 'DOWNLOAD_NOT_AUTHORIZED', '下载授权无效', 401);
  requireThat(grant.exp > Date.now() && grant.exp <= Date.now() + 301000, 'DOWNLOAD_EXPIRED', '下载链接已过期，请重新获取', 410);
  return grant;
}
export async function createDownloadLink(db: Db, cfg: Config, p: Principal, deliverableId: string): Promise<DTO<'DownloadLink'>> {
  const artifact = await scoped(db, 'artifacts', deliverableId, p.tenantId);
  const manifest = await getDeliverables(db, p, String(artifact.order_id));
  const item = manifest.items.find(a => a.deliverable_id === deliverableId && a.sha256 === artifact.sha256);
  requireThat(item, 'DELIVERABLE_NOT_CURRENT', '该素材已更新，请刷新素材列表', 410);
  requireThat(item.kind !== 'copy', 'COPY_AS_TEXT', '文案请使用复制功能', 422);
  return { deliverable_id: deliverableId, ...signDownload(cfg, { purpose: 'DELIVERY', tenantId: p.tenantId, ownerId: p.userId, resourceId: manifest.order_id, itemId: deliverableId }), ttl_seconds: 300 };
}
export async function previewLink(db: Db, cfg: Config, p: Principal, previewId: string): Promise<DTO<'PreviewLink'>> {
  await previewMedia(db,p.tenantId,previewId,p.userId);
  return { preview_id: previewId, ...signDownload(cfg, { purpose: 'PREVIEW', tenantId: p.tenantId, ownerId: p.userId, resourceId: previewId, itemId: previewId }), ttl_seconds: 300 };
}
export async function createSaveSession(db: Db, p: Principal, request: DTO<'SaveSessionRequest'>): Promise<DTO<'SaveSession'>> {
  const manifest = await getDeliverables(db, p, request.order_id);
  requireThat(request.deliverable_ids.every(itemId => manifest.items.some(i => i.deliverable_id === itemId && i.kind !== 'copy')), 'SAVE_SELECTION_INVALID', '保存列表包含不可保存的素材', 422);
  const data: DTO<'SaveSession'> = { save_session_id: id('save'), order_id: request.order_id, installation_id: request.installation_id, deliverable_ids: request.deliverable_ids, created_at: iso() };
  await insert(db, 'save_sessions', { id: data.save_session_id, tenant_id: p.tenantId, owner_id: p.userId, order_id: request.order_id, installation_id: request.installation_id, data }); return data;
}
export async function recordSaveReceipt(db: Db, p: Principal, request: DTO<'SaveReceiptRequest'>): Promise<DTO<'Receipt'>> {
  const session = await owned<DTO<'SaveSession'>>(db, 'save_sessions', request.save_session_id, p, true);
  requireThat(session.data.deliverable_ids.includes(request.deliverable_id), 'SAVE_SCOPE_INVALID', '素材不属于该保存会话', 422);
  const existing = (await db.query<{ id: string; data: DTO<'SaveReceiptRequest'> }>('SELECT id,data FROM save_receipts WHERE save_session_id=$1 AND deliverable_id=$2 AND attempt=$3', [session.id, request.deliverable_id, request.attempt])).rows[0];
  if (existing) {
    // A native save may advance PENDING -> SAVED for the same attempt. Terminal
    // success is monotonic; delayed failure cannot erase an acknowledged save.
    if (existing.data.state === 'SAVED') return { receipt_id: existing.id, accepted: true };
    const rank = { PENDING: 0, DOWNLOADING: 1, SAVING: 2, UNKNOWN: 3, FAILED: 3, SAVED: 4 };
    requireThat(rank[request.state] >= rank[existing.data.state], 'SAVE_RECEIPT_STALE', '该保存状态已被更新');
    await update(db, 'save_receipts', existing.id, { state: request.state, data: request, occurred_at: request.occurred_at }, p.tenantId); return { receipt_id: existing.id, accepted: true };
  }
  const receiptId = id('receipt');
  await insert(db, 'save_receipts', { id: receiptId, tenant_id: p.tenantId, save_session_id: session.id, deliverable_id: request.deliverable_id, attempt: request.attempt, state: request.state, occurred_at: request.occurred_at, data: request });
  return { receipt_id: receiptId, accepted: true };
}
export async function requestRevision(db: Db, p: Principal, orderId: string, request: DTO<'RevisionRequest'>): Promise<DTO<'Revision'>> {
  await lockMediaOwner(db,p.tenantId,p.userId);
  const pack=await getDeliverables(db,p,orderId);return createRevision(db,p,orderId,pack,request);
}
