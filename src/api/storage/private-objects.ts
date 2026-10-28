import type pg from 'pg';
import { transaction, type Db } from '../db/pool.js';
import { id, sha256, addSeconds } from '../lib/crypto.js';
import { requireThat } from '../lib/errors.js';
import { AppError } from '../lib/errors.js';
import { authorizedSample } from '../modules/authorized-samples.js';
import { lockMediaOwner } from '../modules/media-access.js';
import type { ObjectStorage } from './storage.js';
import { previewContext } from '../modules/previews.js';
import { validObjectKey } from './storage.js';
import { revisionContext } from '../../worker/revisions/context.js';

export interface PrivateObjectScope {
  tenantId: string; ownerId: string; productId?: string | null; orderId?: string | null;
  assetId?: string | null; runId?: string | null; kind: 'INPUT' | 'MEDIA' | 'QC' | 'RECEIPT'; expiresAt?: string;
  authorizedSampleId?: string | null;
  previewId?: string | null;
  revisionId?: string | null;
}
interface ObjectRow { id: string; state: string; sha256: string; write_generation: string; delete_requested: boolean; erase_owner: string | null; alreadyStored?: boolean }
async function permitted(db: Db, scope: PrivateObjectScope): Promise<{ allowed: boolean; expiresAt: string }> {
  await lockMediaOwner(db, scope.tenantId, scope.ownerId);
  let allowed = true; let expiry = scope.expiresAt ?? addSeconds((scope.orderId ? 7 * 24 : 24) * 3600);
  if(scope.revisionId) {
    requireThat(scope.productId && scope.orderId && !scope.assetId && !scope.authorizedSampleId && !scope.previewId
      && ['MEDIA','QC','RECEIPT'].includes(scope.kind),'PRIVATE_OBJECT_SCOPE_INVALID','修改对象必须绑定原商品和原订单',403);
    const revision=(await db.query<{order_id:string;product_id:string;expires_at:string|null}>(`SELECT r.order_id,p.product_id,o.data->>'delivery_expires_at' AS expires_at
      FROM revision_requests r JOIN orders o ON o.tenant_id=r.tenant_id AND o.id=r.order_id
      JOIN quotes q ON q.tenant_id=o.tenant_id AND q.id=o.quote_id JOIN plan_versions p ON p.tenant_id=q.tenant_id AND p.id=q.plan_id
      WHERE r.tenant_id=$1 AND r.owner_id=$2 AND r.id=$3`,[scope.tenantId,scope.ownerId,scope.revisionId])).rows[0];
    requireThat(revision?.order_id===scope.orderId && revision.product_id===scope.productId,'PRIVATE_OBJECT_SCOPE_INVALID','修改对象归属不一致',403);
    expiry=new Date(Math.min(Date.parse(expiry),Date.parse(revision.expires_at??new Date().toISOString()))).toISOString();
    try {await revisionContext(db,scope.tenantId,scope.revisionId,undefined,true);}
    catch(error){if(!(error instanceof AppError))throw error;allowed=false;}
  }
  if(scope.previewId) {
    requireThat(scope.productId && !scope.orderId && !scope.assetId && !scope.runId && !scope.authorizedSampleId && scope.kind==='MEDIA',
      'PRIVATE_OBJECT_SCOPE_INVALID','本人预览必须使用本商品独立存储域',403);
    const preview=(await db.query<{product_id:string;expires_at:Date}>('SELECT product_id,expires_at FROM optional_previews WHERE tenant_id=$1 AND owner_id=$2 AND id=$3',
      [scope.tenantId,scope.ownerId,scope.previewId])).rows[0];
    requireThat(preview?.product_id===scope.productId,'PRIVATE_OBJECT_SCOPE_INVALID','本人预览归属不匹配',403); expiry=preview.expires_at.toISOString();
    try { const {row}=await previewContext(db,scope.tenantId,scope.previewId,scope.ownerId); allowed=['QUEUED','GENERATING'].includes(row.state); }
    catch(error) { if(!(error instanceof AppError)) throw error; allowed=false; }
  }
  if (scope.authorizedSampleId) {
    requireThat(!scope.productId && !scope.orderId && !scope.assetId && !scope.runId && scope.kind === 'MEDIA',
      'PRIVATE_OBJECT_SCOPE_INVALID', '公开样例副本必须使用独立存储域', 403);
    const row = (await db.query<{ expires_at: Date }>('SELECT expires_at FROM authorized_samples WHERE tenant_id=$1 AND owner_id=$2 AND id=$3',
      [scope.tenantId,scope.ownerId,scope.authorizedSampleId])).rows[0];
    requireThat(row, 'PRIVATE_OBJECT_SCOPE_INVALID', '公开样例不属于当前作者', 403); expiry = row.expires_at.toISOString();
    try { await authorizedSample(db,scope.authorizedSampleId,['PREPARING','READY','PUBLISHED']); }
    catch (error) { if (!(error instanceof AppError)) throw error; allowed = false; }
  }
  if (scope.orderId) {
    const order = (await db.query<{ private: Record<string, unknown> }>('SELECT private FROM orders WHERE tenant_id=$1 AND owner_id=$2 AND id=$3 FOR UPDATE',
      [scope.tenantId, scope.ownerId, scope.orderId])).rows[0];
    requireThat(order, 'PRIVATE_OBJECT_SCOPE_INVALID', '私有对象不属于当前订单', 403);
    allowed &&= !('media_revoked' in order.private);
  }
  if (scope.productId) {
    const product = (await db.query<{ deleted_at: Date | null; expires_at: Date }>('SELECT deleted_at,expires_at FROM product_drafts WHERE tenant_id=$1 AND owner_id=$2 AND id=$3 FOR SHARE',
      [scope.tenantId, scope.ownerId, scope.productId])).rows[0];
    requireThat(product, 'PRIVATE_OBJECT_SCOPE_INVALID', '私有对象不属于当前商品', 403);
    allowed &&= !product.deleted_at && product.expires_at.getTime() > Date.now();
    if (!scope.orderId) expiry = new Date(Math.min(Date.parse(expiry), product.expires_at.getTime())).toISOString();
  }
  if (scope.assetId) {
    const asset = (await db.query<{ state: string; expires_at: Date }>('SELECT state,expires_at FROM assets WHERE tenant_id=$1 AND owner_id=$2 AND id=$3 FOR UPDATE',
      [scope.tenantId, scope.ownerId, scope.assetId])).rows[0];
    requireThat(asset, 'PRIVATE_OBJECT_SCOPE_INVALID', '私有对象不属于当前上传', 403);
    allowed &&= ['VERIFYING','READY'].includes(asset.state) && asset.expires_at.getTime() > Date.now();
    expiry = new Date(Math.min(Date.parse(expiry), asset.expires_at.getTime())).toISOString();
  }
  return { allowed, expiresAt: expiry };
}
/** Register before I/O. A late billing receipt must still settle known costs;
 * it may be stored with deletion requested, while ordinary late writes fail. */
export async function writePrivateObject(pool: pg.Pool, store: ObjectStorage, scope: PrivateObjectScope,
  key: string, bytes: Buffer, mime: string): Promise<void> {
  validObjectKey(key); requireThat(key.startsWith(`${scope.tenantId}/`), 'PRIVATE_OBJECT_SCOPE_INVALID', '对象路径不属于当前租户', 403);
  const digest = sha256(bytes);
  const row = await transaction(pool, async db => {
    const access = await permitted(db, scope);
    requireThat(access.allowed || scope.kind === 'RECEIPT', 'PRIVATE_OBJECT_REVOKED', '素材权限已撤销，不能继续写入', 410);
    const previous = (await db.query<ObjectRow>('SELECT * FROM private_object_writes WHERE object_key=$1 FOR UPDATE', [key])).rows[0];
    if (previous) {
      const matched = await db.query(`SELECT id FROM private_object_writes WHERE id=$1 AND tenant_id=$2 AND owner_id=$3
        AND product_id IS NOT DISTINCT FROM $4::text AND order_id IS NOT DISTINCT FROM $5::text
        AND asset_id IS NOT DISTINCT FROM $6::text AND run_id IS NOT DISTINCT FROM $7::text AND kind=$8 AND sha256=$9
        AND authorized_sample_id IS NOT DISTINCT FROM $10::text AND preview_id IS NOT DISTINCT FROM $11::text AND revision_id IS NOT DISTINCT FROM $12::text`,
      [previous.id, scope.tenantId, scope.ownerId, scope.productId ?? null, scope.orderId ?? null, scope.assetId ?? null, scope.runId ?? null, scope.kind, digest, scope.authorizedSampleId ?? null,scope.previewId??null,scope.revisionId??null]);
      requireThat(matched.rowCount === 1, 'PRIVATE_OBJECT_CHANGED', '同一私有对象的归属或内容不可更换', 409);
      requireThat(!['WRITING','UNKNOWN'].includes(previous.state), 'PRIVATE_OBJECT_WRITE_PENDING', '原对象写入尚未确认，等待原检查点核对', 409);
      requireThat(previous.state !== 'DELETED', 'PRIVATE_OBJECT_REVOKED', '已删除的对象不能重新写入', 410);
      requireThat(!previous.erase_owner && !previous.delete_requested,
        'PRIVATE_OBJECT_REVOKED', '对象已经进入删除队列，不能重新写入', 410);
      // A matching durable key is immutable. Retrying a PUT could leave another
      // late write behind a successful erasure, even when its bytes are equal.
      return { ...previous, alreadyStored: true };
    }
    return (await db.query<ObjectRow>(`INSERT INTO private_object_writes(id,tenant_id,owner_id,product_id,order_id,asset_id,run_id,
      object_key,sha256,kind,state,expires_at,delete_requested,authorized_sample_id,preview_id,revision_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'WRITING',$11,$12,$13,$14,$15) RETURNING *`,
    [id('object'), scope.tenantId, scope.ownerId, scope.productId ?? null, scope.orderId ?? null, scope.assetId ?? null,
      scope.runId ?? null, key, digest, scope.kind, access.expiresAt, !access.allowed, scope.authorizedSampleId ?? null,scope.previewId??null,scope.revisionId??null])).rows[0]!;
  });
  if (row.alreadyStored) return;
  try {
    await store.put(key, bytes, mime);
    const allowed = await transaction(pool, async db => {
      const access = await permitted(db, scope);
      const changed = await db.query(`UPDATE private_object_writes SET state='STORED',delete_requested=delete_requested OR NOT $3,
        erase_available_at=LEAST(erase_available_at,now()),updated_at=now() WHERE id=$1 AND write_generation=$2 AND state='WRITING'`,
      [row.id, row.write_generation, access.allowed]);
      requireThat(changed.rowCount === 1, 'PRIVATE_OBJECT_WRITE_FENCED', '对象写入已经被其他代次接管', 409);
      return access.allowed;
    });
    requireThat(allowed || scope.kind === 'RECEIPT', 'PRIVATE_OBJECT_REVOKED', '写入期间素材权限已撤销，已进入删除队列', 410);
  } catch (error) {
    await pool.query(`UPDATE private_object_writes SET state='UNKNOWN',last_error='OBJECT_WRITE_UNCERTAIN',updated_at=now()
      WHERE id=$1 AND write_generation=$2 AND state='WRITING'`, [row.id, row.write_generation]);
    throw error;
  }
}
/** Observe only UNKNOWN writes whose original call has already returned. Never
 * convert a live WRITING row or treat a missing object as proof of completion.
 * Keys are written once, so matching the pre-I/O digest proves the original
 * atomic object publication without issuing another PUT. */
export async function reconcileUncertainObjectWrites(pool: pg.Pool, store: ObjectStorage, limit = 20): Promise<{ recovered: number; blocked: number }> {
  requireThat(Number.isSafeInteger(limit) && limit > 0 && limit <= 100, 'RECONCILIATION_LIMIT_INVALID', '对账批次无效', 500);
  const rows = (await pool.query<ObjectRow & { tenant_id: string; owner_id: string; object_key: string }>(`SELECT * FROM private_object_writes
    WHERE state='UNKNOWN' AND sha256 ~ '^[a-f0-9]{64}$' ORDER BY updated_at,id LIMIT $1`, [limit])).rows;
  let recovered = 0; let blocked = 0;
  for (const row of rows) {
    try {
      const bytes = await store.get(row.object_key, 125_000_000);
      requireThat(sha256(bytes) === row.sha256, 'PRIVATE_OBJECT_HASH_MISMATCH', '原写入文件与登记摘要不一致', 503);
      recovered += await transaction(pool, async db => {
        await lockMediaOwner(db, row.tenant_id, row.owner_id);
        const result = await db.query(`UPDATE private_object_writes SET state='STORED',last_error=NULL,updated_at=now()
          WHERE tenant_id=$1 AND id=$2 AND state='UNKNOWN' AND write_generation=$3 AND erase_owner IS NULL`, [row.tenant_id, row.id, row.write_generation]);
        return result.rowCount ?? 0;
      });
    } catch {
      blocked++;
      await pool.query(`UPDATE private_object_writes SET last_error='ORIGINAL_WRITE_NOT_VERIFIED',updated_at=now()
        WHERE tenant_id=$1 AND id=$2 AND state='UNKNOWN' AND write_generation=$3`, [row.tenant_id, row.id, row.write_generation]);
    }
  }
  return { recovered, blocked };
}
export async function inferenceObjectScope(db: Db, tenantId: string, runId: string): Promise<PrivateObjectScope> {
  const row = (await db.query<{ owner_id: string; product_id: string; order_id: string | null;revision_id:string|null }>(`SELECT COALESCE(p.owner_id,s.owner_id,rv.owner_id) AS owner_id,
    COALESCE(p.product_id,s.product_id,rp.product_id) AS product_id,COALESCE(i.order_id,rv.order_id) AS order_id,rv.id AS revision_id
    FROM agent_runs r JOIN agent_instances i ON i.tenant_id=r.tenant_id AND i.id=r.instance_id
    LEFT JOIN plan_versions p ON p.tenant_id=i.tenant_id AND (p.id=i.preview_session_id OR p.id=(
      SELECT q.plan_id FROM orders o JOIN quotes q ON q.tenant_id=o.tenant_id AND q.id=o.quote_id WHERE o.tenant_id=i.tenant_id AND o.id=i.order_id))
    LEFT JOIN public_samples s ON s.tenant_id=i.tenant_id AND s.id=i.preview_session_id
    LEFT JOIN revision_requests rv ON rv.tenant_id=i.tenant_id AND rv.id=i.preview_session_id
    LEFT JOIN orders ro ON ro.tenant_id=rv.tenant_id AND ro.id=rv.order_id LEFT JOIN quotes rq ON rq.tenant_id=ro.tenant_id AND rq.id=ro.quote_id
    LEFT JOIN plan_versions rp ON rp.tenant_id=rq.tenant_id AND rp.id=rq.plan_id
    WHERE r.tenant_id=$1 AND r.id=$2 AND COALESCE(p.owner_id,s.owner_id,rv.owner_id) IS NOT NULL`, [tenantId, runId])).rows[0];
  requireThat(row?.product_id, 'PRIVATE_OBJECT_SCOPE_INVALID', '推理回执缺少持久订单、预览或样例归属', 403);
  return { tenantId, ownerId: row.owner_id, productId: row.product_id, orderId: row.order_id,revisionId:row.revision_id, runId, kind: 'RECEIPT' };
}
