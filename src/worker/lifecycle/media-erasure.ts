import type pg from 'pg';
import { transaction, type Db } from '../../api/db/pool.js';
import { hash, id } from '../../api/lib/crypto.js';
import { requireThat } from '../../api/lib/errors.js';
import { lockMediaOwner } from '../../api/modules/media-access.js';
import { requestDeletion } from '../../api/modules/support.js';
import { validObjectKey, type ObjectStorage } from '../../api/storage/storage.js';
import type { DTO } from '../../shared/contracts/types.js';
import type { OutboxLease } from '../queue/outbox.js';
import { errorCode } from '../runtime.js';
import { redactPrivateContent } from './privacy-redaction.js';

interface ObjectRow {
  id: string; tenant_id: string; owner_id: string; product_id: string | null; order_id: string | null;
  asset_id: string | null; object_key: string; kind: string; state: string; write_generation: string;
  erase_generation: string; erase_owner: string | null; expires_at: Date; delete_requested: boolean;
}
interface DeletionRow { id: string; tenant_id: string; owner_id: string; created_at: Date; private: {
  request: DTO<'PrivacyDeletionRequest'>; product_ids?: string[]; order_ids?: string[]; asset_ids?: string[];
  origin?: 'USER'|'RETENTION'; authorized_sample_ids?: string[];
} }
/** Consistent with upload/payment/privacy: owner -> order -> product -> asset -> object.
 * Do not hold a database transaction across storage requests. */
async function lockScope(db: Db, row: ObjectRow): Promise<void> {
  await lockMediaOwner(db, row.tenant_id, row.owner_id);
  if (row.order_id) await db.query('SELECT id FROM orders WHERE tenant_id=$1 AND id=$2 FOR UPDATE', [row.tenant_id, row.order_id]);
  if (row.product_id) await db.query('SELECT id FROM product_drafts WHERE tenant_id=$1 AND id=$2 FOR UPDATE', [row.tenant_id, row.product_id]);
  if (row.asset_id) await db.query('SELECT id FROM assets WHERE tenant_id=$1 AND id=$2 FOR UPDATE', [row.tenant_id, row.asset_id]);
}
async function billingPending(db: Db, row: ObjectRow): Promise<boolean> {
  if (row.kind !== 'RECEIPT') return false;
  const pending = await db.query(`SELECT 1 FROM inference_requests WHERE tenant_id=$1 AND response_key=$2
    AND (state NOT IN ('SUCCEEDED','FAILED') OR actual_micro IS NULL)
    UNION ALL SELECT 1 FROM provider_submissions s
    LEFT JOIN platform_budget_reservations p ON p.tenant_id=s.tenant_id AND p.id=s.reservation_id
    LEFT JOIN budget_reservations b ON b.tenant_id=s.tenant_id AND b.id=s.reservation_id
    WHERE s.tenant_id=$1 AND (s.private->>'result_key'=$2 OR (s.generation_kind IS NOT NULL AND (
      s.private->>'request_key'=$2 OR EXISTS(SELECT 1 FROM jsonb_array_elements(
        CASE WHEN jsonb_typeof(s.private->'receipts')='array' THEN s.private->'receipts' ELSE '[]'::jsonb END) AS r(pointer)
        WHERE r.pointer->>'key'=$2)))) AND (s.state NOT IN ('SUCCEEDED','FAILED')
      OR p.state IN ('RESERVED','UNKNOWN') OR b.state IN ('RESERVED','UNKNOWN')) LIMIT 1`, [row.tenant_id, row.object_key]);
  return !!pending.rowCount;
}
export class MediaErasureService {
  constructor(private pool: pg.Pool, private store: ObjectStorage, private workerId: string, private journal?: import('../../api/privacy/journal.js').DeletionJournal) {
    requireThat(/^[A-Za-z0-9_-]{1,100}$/.test(workerId), 'INVALID_WORKER', '清理执行身份无效', 500);
  }
  async requestEvent(event: OutboxLease): Promise<void> { await this.refreshDeletion(event.tenant_id, event.aggregate_id); }

  /** Adopt only exact database locators. No tenant-wide bucket or filesystem sweep.
   * Unsettled billing locations are omitted: a late receipt still has to settle. */
  private async adopt(db: Db, request: DeletionRow): Promise<number> {
    const products = request.private.product_ids ?? []; const orders = request.private.order_ids ?? [];
    const assets = request.private.asset_ids ?? [];
    const candidates = (await db.query<ObjectRow & { sha256: string }>(`WITH root AS (
      SELECT o.id,o.tenant_id,o.owner_id,v.product_id FROM orders o
      JOIN quotes q ON q.tenant_id=o.tenant_id AND q.id=o.quote_id
      JOIN plan_versions v ON v.tenant_id=q.tenant_id AND v.id=q.plan_id
      WHERE o.tenant_id=$1 AND o.owner_id=$2 AND o.id=ANY($4::text[])
    ), locations AS (
      SELECT a.tenant_id,a.owner_id,a.product_id,NULL::text AS order_id,a.id AS asset_id,a.object_key,
        COALESCE(a.sha256,'') AS sha256,'INPUT' AS kind,a.expires_at
      FROM assets a WHERE a.tenant_id=$1 AND a.owner_id=$2 AND (a.product_id=ANY($3::text[]) OR a.id=ANY($5::text[]))
      UNION ALL SELECT a.tenant_id,r.owner_id,r.product_id,a.order_id,NULL,a.object_key,a.sha256,'MEDIA',a.expires_at
        FROM artifacts a JOIN root r ON r.tenant_id=a.tenant_id AND r.id=a.order_id
      UNION ALL SELECT e.tenant_id,r.owner_id,r.product_id,e.order_id,NULL,e.object_key,e.sha256,'QC',now()
        FROM review_evidence e JOIN root r ON r.tenant_id=e.tenant_id AND r.id=e.order_id
      UNION ALL SELECT m.tenant_id,r.owner_id,r.product_id,m.order_id,NULL,m.manifest_key,COALESCE(m.manifest_hash,''),'MEDIA',now()
        FROM media_operations m JOIN root r ON r.tenant_id=m.tenant_id AND r.id=m.order_id WHERE m.manifest_key IS NOT NULL
      UNION ALL SELECT p.tenant_id,p.owner_id,p.product_id,NULL,NULL,p.object_key,'','MEDIA',p.expires_at
        FROM optional_previews p WHERE p.tenant_id=$1 AND p.owner_id=$2 AND p.product_id=ANY($3::text[]) AND p.object_key IS NOT NULL
      UNION ALL SELECT i.tenant_id,p.owner_id,p.product_id,n.order_id,NULL,i.response_key,COALESCE(i.data->>'receipt_sha256',''),'RECEIPT',now()
        FROM inference_requests i JOIN agent_runs r ON r.tenant_id=i.tenant_id AND r.id=i.run_id
        JOIN agent_instances n ON n.tenant_id=r.tenant_id AND n.id=r.instance_id
        JOIN plan_versions p ON p.tenant_id=n.tenant_id AND (p.id=n.preview_session_id OR p.id=(
          SELECT q.plan_id FROM orders o JOIN quotes q ON q.tenant_id=o.tenant_id AND q.id=o.quote_id WHERE o.tenant_id=n.tenant_id AND o.id=n.order_id))
        WHERE i.tenant_id=$1 AND p.owner_id=$2 AND (p.product_id=ANY($3::text[]) OR n.order_id=ANY($4::text[])) AND i.response_key IS NOT NULL
          AND i.state IN ('SUCCEEDED','FAILED') AND i.actual_micro IS NOT NULL
      UNION ALL SELECT s.tenant_id,a.owner_id,a.product_id,NULL,NULL,s.private->>'result_key','','RECEIPT',now()
        FROM provider_submissions s JOIN stage_runs t ON t.tenant_id=s.tenant_id AND t.id=s.stage_run_id AND t.scope_type='ANALYSIS'
        JOIN analysis_jobs a ON a.tenant_id=t.tenant_id AND a.id=t.scope_id
        WHERE s.tenant_id=$1 AND a.owner_id=$2 AND a.product_id=ANY($3::text[]) AND s.private ? 'result_key' AND s.state IN ('SUCCEEDED','FAILED')
      UNION ALL SELECT s.tenant_id,r.owner_id,r.product_id,r.id,NULL,s.private->>'result_key','','RECEIPT',now()
        FROM provider_submissions s JOIN stage_runs t ON t.tenant_id=s.tenant_id AND t.id=s.stage_run_id AND t.scope_type='ORDER'
        JOIN root r ON r.tenant_id=t.tenant_id AND r.id=t.scope_id
        WHERE s.private ? 'result_key' AND s.state IN ('SUCCEEDED','FAILED')
    ) SELECT DISTINCT ON(l.object_key) l.* FROM locations l WHERE NOT EXISTS (
      SELECT 1 FROM private_object_writes w WHERE w.object_key=l.object_key AND w.tenant_id=l.tenant_id AND w.owner_id=l.owner_id
      AND w.product_id IS NOT DISTINCT FROM l.product_id) ORDER BY l.object_key LIMIT 1000`,
    [request.tenant_id, request.owner_id, products, orders, assets])).rows;
    for (const row of candidates) {
      validObjectKey(row.object_key);
      requireThat(row.object_key.startsWith(`${request.tenant_id}/`), 'OBJECT_SCOPE_MISMATCH', '私有文件定位超出删除范围', 503);
      const existing = (await db.query<ObjectRow>('SELECT * FROM private_object_writes WHERE object_key=$1 FOR UPDATE', [row.object_key])).rows[0];
      requireThat(!existing || existing.tenant_id === row.tenant_id && existing.owner_id === row.owner_id && existing.product_id === row.product_id,
        'OBJECT_SCOPE_MISMATCH', '私有文件登记归属不一致', 503);
      if (!existing) await db.query(`INSERT INTO private_object_writes(id,tenant_id,owner_id,product_id,order_id,asset_id,
        object_key,sha256,kind,state,expires_at,delete_requested,evidence) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'STORED',$10,true,'{"legacy_locator":true}')`,
      [id('object'), row.tenant_id, row.owner_id, row.product_id, row.order_id, row.asset_id, row.object_key, row.sha256, row.kind, row.expires_at]);
    }
    return candidates.length;
  }
  async refreshDeletion(tenantId: string, deletionId: string): Promise<void> {
    const hint = (await this.pool.query<DeletionRow>('SELECT * FROM privacy_deletions WHERE tenant_id=$1 AND id=$2', [tenantId, deletionId])).rows[0];
    requireThat(hint, 'DELETION_NOT_FOUND', '删除请求不存在', 404);
    await transaction(this.pool, async db => {
      await lockMediaOwner(db, hint.tenant_id, hint.owner_id);
      const row = (await db.query<DeletionRow>('SELECT * FROM privacy_deletions WHERE tenant_id=$1 AND id=$2 FOR UPDATE', [tenantId, deletionId])).rows[0]!;
      if (!row.private.product_ids || !row.private.order_ids || !row.private.asset_ids) {
        const productId = row.private.request.scope === 'PRODUCT' ? row.private.request.product_id : null;
        row.private.product_ids = (await db.query<{ id: string }>(`SELECT id FROM product_drafts WHERE tenant_id=$1 AND owner_id=$2
          AND created_at<=$3 AND ($4::text IS NULL OR id=$4)`, [tenantId, row.owner_id, row.created_at, productId])).rows.map(r => r.id);
        row.private.order_ids = (await db.query<{ id: string }>(`SELECT o.id FROM orders o JOIN quotes q ON q.tenant_id=o.tenant_id AND q.id=o.quote_id
          JOIN plan_versions p ON p.tenant_id=q.tenant_id AND p.id=q.plan_id WHERE o.tenant_id=$1 AND o.owner_id=$2 AND p.product_id=ANY($3::text[])`,
        [tenantId, row.owner_id, row.private.product_ids])).rows.map(r => r.id);
        row.private.asset_ids = (await db.query<{ id: string }>(`SELECT id FROM assets WHERE tenant_id=$1 AND owner_id=$2 AND created_at<=$3
          AND ($4::boolean OR product_id=ANY($5::text[]))`, [tenantId, row.owner_id, row.created_at, row.private.request.scope === 'ACCOUNT_MEDIA', row.private.product_ids])).rows.map(r => r.id);
        await db.query('UPDATE privacy_deletions SET private=$3 WHERE tenant_id=$1 AND id=$2', [tenantId, deletionId, JSON.stringify(row.private)]);
      }
      const products = row.private.product_ids ?? []; const orders = row.private.order_ids ?? []; const assets = row.private.asset_ids ?? [];
      const publicCopies = row.private.origin==='RETENTION' ? [] : row.private.authorized_sample_ids ?? (await db.query<{id:string}>(`SELECT id FROM authorized_samples
        WHERE tenant_id=$1 AND owner_id=$2 AND created_at<=$4 AND ($5::boolean OR source_product_id=ANY($3::text[]))`,[tenantId,row.owner_id,products,row.created_at,row.private.request.scope==='ACCOUNT_MEDIA'])).rows.map(r=>r.id);
      // Account requests freeze their input set. Future products belong to future requests.
      await this.adopt(db, row);
      await db.query(`UPDATE private_object_writes SET delete_requested=true,erase_available_at=LEAST(erase_available_at,now())
        WHERE tenant_id=$1 AND owner_id=$2 AND (product_id=ANY($3::text[]) OR order_id=ANY($4::text[]) OR asset_id=ANY($5::text[])
          OR ($6 AND created_at<=$7) OR authorized_sample_id=ANY($8::text[])) AND state<>'DELETED' AND NOT delete_requested`,
      [tenantId, row.owner_id, products, orders, assets, row.private.request.scope === 'ACCOUNT_MEDIA', row.created_at,publicCopies]);
      const counts = (await db.query<{ state: string; n: string }>(`SELECT state,count(*) AS n FROM private_object_writes
        WHERE tenant_id=$1 AND owner_id=$2 AND (product_id=ANY($3::text[]) OR order_id=ANY($4::text[]) OR asset_id=ANY($5::text[])
          OR ($6 AND created_at<=$7) OR authorized_sample_id=ANY($8::text[])) GROUP BY state`, [tenantId, row.owner_id, products, orders, assets, row.private.request.scope === 'ACCOUNT_MEDIA', row.created_at,publicCopies])).rows;
      const database = await redactPrivateContent(db, { tenantId, ownerId: row.owner_id, productIds: products, orderIds: orders, assetIds: assets },
        counts.some(c => c.state !== 'DELETED' && Number(c.n) > 0));
      // A controlled database/object pass cannot certify backups or provider copies.
      const evidence = { object_states: Object.fromEntries(counts.map(c => [c.state, Number(c.n)])), database,
        remaining_gates: [...(database.state === 'REDACTED' ? [] : ['PRIVATE_DB_REDACTION_PENDING']), 'BACKUP_REPLAY_PENDING','PROVIDER_COPY_BOUNDARY_PENDING'] };
      await db.query(`UPDATE privacy_deletions SET state='PARTIAL_BLOCKED',data=data||'{"state":"PARTIAL_BLOCKED"}'::jsonb,
        private=private||jsonb_build_object('controlled_media',$3::jsonb),updated_at=now() WHERE tenant_id=$1 AND id=$2`, [tenantId, deletionId, JSON.stringify(evidence)]);
    });
  }
  async refreshPending(): Promise<void> {
    const rows = (await this.pool.query<{ id: string; tenant_id: string }>(`SELECT id,tenant_id FROM privacy_deletions
      WHERE state<>'COMPLETED' ORDER BY updated_at,id LIMIT 20`)).rows;
    for (const row of rows) {
      try { await this.refreshDeletion(row.tenant_id, row.id); }
      catch (error) {
        // A malformed legacy locator must not starve every other deletion.
        await this.pool.query(`UPDATE privacy_deletions SET state='PARTIAL_BLOCKED',data=data||'{"state":"PARTIAL_BLOCKED"}'::jsonb,
          private=private||jsonb_build_object('maintenance_error',$3::text),updated_at=now() WHERE tenant_id=$1 AND id=$2`, [row.tenant_id, row.id, errorCode(error)]);
      }
    }
  }
  /** Runs separately from paid generation, including when all model flags are off. */
  async expire(): Promise<void> {
    const products = (await this.pool.query<{ id: string; tenant_id: string; owner_id: string }>(`SELECT id,tenant_id,owner_id
      FROM product_drafts WHERE deleted_at IS NULL AND expires_at<=clock_timestamp() ORDER BY expires_at LIMIT 20`)).rows;
    for (const product of products) await transaction(this.pool, async db => {
      await lockMediaOwner(db, product.tenant_id, product.owner_id);
      // Recheck under the same owner lock used by payment; paid extensions win safely.
      const current = await db.query('SELECT id FROM product_drafts WHERE tenant_id=$1 AND id=$2 AND deleted_at IS NULL AND expires_at<=clock_timestamp()', [product.tenant_id, product.id]);
      if (current.rowCount) {
        await requestDeletion(db, { tenantId: product.tenant_id, userId: product.owner_id },
          { scope: 'PRODUCT', product_id: product.id, acknowledge_inflight_contract: true }, { journal: this.journal,origin:'RETENTION' });
      }
    });
    const expiredAssets = (await this.pool.query<ObjectRow & { sha256: string }>(`SELECT a.id AS asset_id,a.tenant_id,a.owner_id,a.product_id,
      NULL::text AS order_id,a.object_key,COALESCE(a.sha256,'') AS sha256,a.expires_at FROM assets a
      WHERE a.expires_at<=clock_timestamp() AND a.state NOT IN ('DELETED','EXPIRED') ORDER BY a.expires_at LIMIT 100`)).rows;
    for (const row of expiredAssets) await transaction(this.pool, async db => {
      await lockScope(db, row);
      const current = await db.query("UPDATE assets SET state='EXPIRED',updated_at=now() WHERE tenant_id=$1 AND id=$2 AND expires_at<=clock_timestamp() AND state NOT IN ('DELETED','EXPIRED') RETURNING id", [row.tenant_id, row.asset_id]);
      if (!current.rowCount) return;
      validObjectKey(row.object_key); requireThat(row.object_key.startsWith(`${row.tenant_id}/`), 'OBJECT_SCOPE_MISMATCH', '到期对象不属于当前租户', 503);
      await db.query(`INSERT INTO private_object_writes(id,tenant_id,owner_id,product_id,asset_id,object_key,sha256,kind,state,expires_at,delete_requested,evidence)
        VALUES($1,$2,$3,$4,$5,$6,$7,'INPUT','STORED',$8,true,'{"legacy_locator":true}') ON CONFLICT(object_key) DO NOTHING`,
      [id('object'), row.tenant_id, row.owner_id, row.product_id, row.asset_id, row.object_key, row.sha256, row.expires_at]);
      await db.query(`UPDATE private_object_writes SET delete_requested=true,erase_available_at=now() WHERE tenant_id=$1 AND owner_id=$2 AND asset_id=$3 AND state<>'DELETED'`, [row.tenant_id, row.owner_id, row.asset_id]);
    });
    const expiredOrders = (await this.pool.query<{ id: string; tenant_id: string; owner_id: string }>(`SELECT id,tenant_id,owner_id FROM orders
      WHERE fulfillment_state='DELIVERED' AND delivery_expires_at<=clock_timestamp() ORDER BY delivery_expires_at LIMIT 20`)).rows;
    for (const order of expiredOrders) await transaction(this.pool, async db => {
      await lockMediaOwner(db, order.tenant_id, order.owner_id);
      const changed = await db.query(`UPDATE orders SET fulfillment_state='EXPIRED',private=private||'{"media_revoked":true}'::jsonb,
        data=data||'{"fulfillment_state":"EXPIRED"}'::jsonb,updated_at=now() WHERE tenant_id=$1 AND id=$2
        AND fulfillment_state='DELIVERED' AND delivery_expires_at<=clock_timestamp() RETURNING id`, [order.tenant_id, order.id]);
      if (!changed.rowCount) return;
      await this.adopt(db, { id: '', tenant_id: order.tenant_id, owner_id: order.owner_id, created_at: new Date(),
        private: { request: { scope: 'ACCOUNT_MEDIA', acknowledge_inflight_contract: true }, product_ids: [], order_ids: [order.id], asset_ids: [] } });
      await db.query(`UPDATE private_object_writes SET delete_requested=true,erase_available_at=now() WHERE tenant_id=$1 AND order_id=$2 AND state<>'DELETED'`, [order.tenant_id, order.id]);
    });
    const rows = (await this.pool.query<ObjectRow>(`SELECT * FROM private_object_writes WHERE state<>'DELETED'
      AND NOT delete_requested AND expires_at<=clock_timestamp() ORDER BY expires_at LIMIT 100`)).rows;
    for (const hint of rows) await transaction(this.pool, async db => {
      await lockScope(db, hint);
      const row = (await db.query<ObjectRow>('SELECT * FROM private_object_writes WHERE id=$1 FOR UPDATE', [hint.id])).rows[0]!;
      if (row.delete_requested || row.state === 'DELETED' || row.expires_at.getTime() > Date.now()) return;
      if (row.asset_id) {
        const asset = (await db.query<{ expires_at: Date }>('SELECT expires_at FROM assets WHERE tenant_id=$1 AND id=$2', [row.tenant_id, row.asset_id])).rows[0]!;
        if (asset.expires_at.getTime() > Date.now()) { await db.query('UPDATE private_object_writes SET expires_at=$2 WHERE id=$1', [row.id, asset.expires_at]); return; }
        await db.query("UPDATE assets SET state='EXPIRED',updated_at=now() WHERE tenant_id=$1 AND id=$2 AND state<>'DELETED'", [row.tenant_id, row.asset_id]);
      }
      if (row.order_id) {
        const order = (await db.query<{ fulfillment_state: string; delivery_expires_at: Date | null }>('SELECT fulfillment_state,delivery_expires_at FROM orders WHERE tenant_id=$1 AND id=$2', [row.tenant_id, row.order_id])).rows[0]!;
        if (order.delivery_expires_at && order.delivery_expires_at.getTime() > Date.now()) {
          await db.query('UPDATE private_object_writes SET expires_at=$2 WHERE id=$1', [row.id, order.delivery_expires_at]); return;
        }
        // A live contract must first be terminated through the normal deadline or privacy path.
        if (['QUEUED','IN_PROGRESS','NOT_STARTED'].includes(order.fulfillment_state)) return;
        await db.query(`UPDATE orders SET private=private||'{"media_revoked":true}'::jsonb,
          fulfillment_state=CASE WHEN fulfillment_state='DELIVERED' THEN 'EXPIRED' ELSE fulfillment_state END,
          data=data||CASE WHEN fulfillment_state='DELIVERED' THEN '{"fulfillment_state":"EXPIRED"}'::jsonb ELSE '{}'::jsonb END WHERE tenant_id=$1 AND id=$2`, [row.tenant_id, row.order_id]);
      }
      await db.query(`UPDATE private_object_writes SET delete_requested=true,erase_available_at=now(),updated_at=now() WHERE id=$1`, [row.id]);
    });
  }
  private async claim(): Promise<ObjectRow | null> {
    const candidates = (await this.pool.query<ObjectRow>(`SELECT * FROM private_object_writes WHERE state='STORED' AND delete_requested
      AND erase_available_at<=now() AND (erase_lease_expires_at IS NULL OR erase_lease_expires_at<=now()) ORDER BY erase_available_at,id LIMIT 20`)).rows;
    for (const hint of candidates) {
      const claimed = await transaction(this.pool, async db => {
        await lockScope(db, hint);
        const row = (await db.query<ObjectRow>(`SELECT * FROM private_object_writes WHERE id=$1 AND state='STORED' AND delete_requested
          AND erase_available_at<=now() AND (erase_lease_expires_at IS NULL OR erase_lease_expires_at<=now()) FOR UPDATE SKIP LOCKED`, [hint.id])).rows[0];
        if (!row) return null;
        if (await billingPending(db, row)) { await db.query("UPDATE private_object_writes SET erase_available_at=now()+interval '60 seconds',last_error='BILLING_RECEIPT_PENDING' WHERE id=$1", [row.id]); return null; }
        return (await db.query<ObjectRow>(`UPDATE private_object_writes SET erase_owner=$2,erase_lease_expires_at=now()+interval '60 seconds',
          erase_generation=erase_generation+1,erase_attempts=erase_attempts+1,updated_at=now() WHERE id=$1 RETURNING *`, [row.id, this.workerId])).rows[0]!;
      });
      if (claimed) return claimed;
    }
    return null;
  }
  async eraseOne(signal: AbortSignal): Promise<boolean> {
    if (signal.aborted) return false;
    const row = await this.claim(); if (!row) return false;
    const controller = new AbortController(); const abort = (): void => controller.abort();
    signal.addEventListener('abort', abort, { once: true }); if (signal.aborted) abort();
    let pulse: Promise<void> | null = null;
    const timer = setInterval(() => {
      if (pulse || controller.signal.aborted) return;
      pulse = this.pool.query(`UPDATE private_object_writes SET erase_lease_expires_at=now()+interval '60 seconds'
        WHERE id=$1 AND erase_owner=$2 AND erase_generation=$3 AND write_generation=$4 AND state='STORED'
          AND erase_lease_expires_at>now() RETURNING id`, [row.id, this.workerId, row.erase_generation, row.write_generation])
        .then(result => { if (result.rowCount !== 1) controller.abort(); }).catch(() => controller.abort()).finally(() => { pulse = null; });
    }, 10000); timer.unref();
    let evidence: Record<string, unknown>; let state = 'FAILED';
    try {
      requireThat(this.store.erase, 'OBJECT_ERASURE_UNSUPPORTED', '存储适配器没有永久删除核验能力', 503);
      const proof = await this.store.erase(row.object_key, controller.signal);
      requireThat(!controller.signal.aborted && proof.current_absent === true && proof.all_versions_absent === true
        && ['local','oss'].includes(proof.driver) && Number.isSafeInteger(proof.versions_removed) && proof.versions_removed >= 0
        && Array.isArray(proof.request_ids), 'OBJECT_ERASURE_UNVERIFIED', '永久删除证据不完整或执行已失效', 503);
      evidence = { proof }; state = 'DELETED';
    } catch (error) { evidence = { error_code: errorCode(error) }; }
    finally { clearInterval(timer); if (pulse) await pulse; signal.removeEventListener('abort', abort); }
    await transaction(this.pool, async db => {
      const current = await db.query(`SELECT id FROM private_object_writes WHERE id=$1 AND erase_owner=$2 AND erase_generation=$3
        AND write_generation=$4 AND state='STORED' AND erase_lease_expires_at>now() FOR UPDATE`, [row.id, this.workerId, row.erase_generation, row.write_generation]);
      // A late old completion cannot mark a new write or a new eraser complete.
      if (!current.rowCount) return;
      const data = { object_id: row.id, erase_generation: row.erase_generation, write_generation: row.write_generation, state, ...evidence };
      await db.query(`INSERT INTO object_erasure_receipts(id,tenant_id,object_id,erase_generation,write_generation,state,evidence_hash,data)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8)`, [id('erasure'), row.tenant_id, row.id, row.erase_generation, row.write_generation, state, hash(data), JSON.stringify(data)]);
      await db.query(`UPDATE private_object_writes SET state=CASE WHEN $2='DELETED' THEN 'DELETED' ELSE state END,
        deleted_at=CASE WHEN $2='DELETED' THEN now() ELSE deleted_at END,erase_owner=NULL,erase_lease_expires_at=NULL,
        erase_available_at=now()+interval '60 seconds',last_error=$3,evidence=evidence||$4::jsonb,updated_at=now() WHERE id=$1`,
      [row.id, state, evidence.error_code ?? null, JSON.stringify(evidence)]);
    });
    return true;
  }
}
