import type pg from 'pg';
import type { Config } from '../../api/config.js';
import { transaction } from '../../api/db/pool.js';
import { requireThat } from '../../api/lib/errors.js';
import { hash } from '../../api/lib/crypto.js';
import { requestDeletion } from '../../api/modules/support.js';
import { DeletionJournal, type DeletionIntent, type JournalSnapshot } from '../../api/privacy/journal.js';

/** Explicit operator cutover while public API/production processes are stopped.
 * Legacy tombstones are exported before the initialized flag can admit traffic. */
export async function bootstrapDeletionJournal(pool: pg.Pool, cfg: Config): Promise<{ head_sha256: string; sequence: number }> {
  const journal = new DeletionJournal(cfg);
  let snapshot: JournalSnapshot;
  try { snapshot = await journal.snapshot(); }
  catch (error) {
    requireThat((error as NodeJS.ErrnoException).code === 'ENOENT', 'PRIVACY_JOURNAL_BOOTSTRAP_BLOCKED', '删除日志缺损，不能重新初始化覆盖', 503);
    await transaction(pool, db => journal.initialize(db)); snapshot = await journal.snapshot();
  }
  const state = (await pool.query<{ initialized: boolean; head_sha256: string; sequence: string }>('SELECT * FROM privacy_journal_state WHERE source_id=$1', [journal.sourceId])).rows[0];
  requireThat(state && state.head_sha256 === snapshot.sha256 && Number(state.sequence) === snapshot.head.sequence, 'PRIVACY_RESTORE_PENDING', '已有日志与数据库不一致，应走恢复重放', 503);
  // Completed cutover is idempotent: replay requests must not become fresh
  // journal intents, and an existing financial recovery hold must survive.
  if (state.initialized) return { head_sha256: snapshot.sha256, sequence: snapshot.head.sequence };
  await pool.query('UPDATE privacy_journal_state SET initialized=false,updated_at=now() WHERE source_id=$1', [journal.sourceId]);
  const exported = new Set(snapshot.entries.map(e => e.intent.request_id));
  const rows = (await pool.query<{ id: string; tenant_id: string; owner_id: string; created_at: Date; private: { request: { scope: 'PRODUCT' | 'ACCOUNT_MEDIA'; product_id?: string }; product_ids?: string[]; order_ids?: string[]; asset_ids?: string[]; origin?:'USER'|'RETENTION';authorized_sample_ids?:string[] } }>(
    'SELECT id,tenant_id,owner_id,created_at,private FROM privacy_deletions ORDER BY created_at,id')).rows;
  for (const row of rows) {
    if (exported.has(row.id)) continue;
    const markers = (await pool.query<{ target_type: string; target_id: string }>('SELECT target_type,target_id FROM deletion_markers WHERE request_id=$1 AND tenant_id=$2 AND owner_id=$3', [row.id, row.tenant_id, row.owner_id])).rows;
    const values = (type: string): string[] => markers.filter(m => m.target_type === type).map(m => m.target_id);
    const intent: DeletionIntent = { schema_version: '1.0.0', source_id: journal.sourceId, request_id: row.id, tenant_id: row.tenant_id, owner_id: row.owner_id,
      created_at: row.created_at.toISOString(), scope: row.private.request.scope, origin:row.private.origin??'USER',
      ...(row.private.authorized_sample_ids ? {authorized_sample_ids:row.private.authorized_sample_ids}:{}),
      product_ids: row.private.product_ids ?? values('PRODUCT'), order_ids: row.private.order_ids ?? values('ORDER'), asset_ids: row.private.asset_ids ?? values('ASSET') };
    await transaction(pool, db => journal.append(db, intent, true));
  }
  const head = await journal.snapshot();
  await transaction(pool, async db => {
    await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`privacy-journal:${journal.sourceId}`]);
    const changed = await db.query('UPDATE privacy_journal_state SET initialized=true,updated_at=now() WHERE source_id=$1 AND head_sha256=$2 AND sequence=$3', [journal.sourceId, head.sha256, head.head.sequence]);
    requireThat(changed.rowCount === 1 && (await journal.readHead()).sha256 === head.sha256, 'PRIVACY_JOURNAL_CHANGED', '初始化期间日志已变更', 503);
  });
  return { head_sha256: head.sha256, sequence: head.head.sequence };
}

/** Reapply signed frozen sets; never broaden an old account deletion to products
 * or orphan media created after its original cutoff. Missing post-backup owners
 * and products are recorded as no-ops, without inventing their database rows. */
export async function replayDeletionJournal(pool: pg.Pool, cfg: Config, expectedHeadSha256: string): Promise<{ applied: number; skipped: number }> {
  const journal = new DeletionJournal(cfg); await journal.blockRestore(expectedHeadSha256);
  const snapshot = await journal.snapshot(expectedHeadSha256); let applied = 0; let skipped = 0;
  await pool.query('UPDATE privacy_journal_state SET initialized=false,financial_recovery_required=true,updated_at=now() WHERE source_id=$1', [journal.sourceId]);
  for (const entry of snapshot.entries) {
    await transaction(pool, async db => {
      const prior = (await db.query<{ entry_sha256: string }>('SELECT entry_sha256 FROM privacy_replay_receipts WHERE source_id=$1 AND sequence=$2', [journal.sourceId, entry.sequence])).rows[0];
      if (prior) { requireThat(prior.entry_sha256 === hash(entry), 'PRIVACY_REPLAY_CHANGED', '恢复回执与原删除范围不一致', 503); skipped++; return; }
      const intent = entry.intent;
      const owner = await db.query('SELECT id FROM users WHERE tenant_id=$1 AND id=$2', [intent.tenant_id, intent.owner_id]);
      const productExists = intent.scope !== 'PRODUCT' || !!(await db.query('SELECT id FROM product_drafts WHERE tenant_id=$1 AND owner_id=$2 AND id=$3', [intent.tenant_id, intent.owner_id, intent.product_ids[0]])).rowCount;
      let deletionId: string | null = null;
      if (owner.rowCount && productExists) {
        const request = intent.scope === 'PRODUCT' ? { scope: 'PRODUCT' as const, product_id: intent.product_ids[0]!, acknowledge_inflight_contract: true }
          : { scope: 'ACCOUNT_MEDIA' as const, acknowledge_inflight_contract: true };
        const deletion = await requestDeletion(db, { tenantId: intent.tenant_id, userId: intent.owner_id }, request, { replay: intent });
        deletionId = deletion.deletion_id;
      }
      await db.query(`INSERT INTO privacy_replay_receipts(source_id,sequence,entry_sha256,original_request_id,replay_request_id)
        VALUES($1,$2,$3,$4,$5)`, [journal.sourceId, entry.sequence, hash(entry), intent.request_id, deletionId]); applied++;
    });
  }
  return { applied, skipped };
}

/** Complete the controlled privacy replay after media/content cleanup. The
 * independent financial recovery hold remains; only an all-paid-flags-off,
 * non-production preview can be admitted until financial recovery is proven. */
export async function finishPrivacyRestore(pool: pg.Pool, cfg: Config, expectedHeadSha256: string): Promise<void> {
  const journal = new DeletionJournal(cfg); const snapshot = await journal.snapshot(expectedHeadSha256);
  await transaction(pool, async db => {
    await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`privacy-journal:${journal.sourceId}`]);
    for (const entry of snapshot.entries) {
      const receipt = (await db.query<{ entry_sha256: string; replay_request_id: string | null }>('SELECT * FROM privacy_replay_receipts WHERE source_id=$1 AND sequence=$2', [journal.sourceId, entry.sequence])).rows[0];
      requireThat(receipt?.entry_sha256 === hash(entry), 'PRIVACY_REPLAY_INCOMPLETE', '删除日志尚未全部重放', 503);
      if (receipt.replay_request_id) {
        const row = (await db.query<{ private: { controlled_media?: { database?: { state: string; remaining_rows: number }; object_states?: Record<string, number> } } }>('SELECT private FROM privacy_deletions WHERE id=$1', [receipt.replay_request_id])).rows[0];
        const media = row?.private.controlled_media;
        requireThat(media?.database?.state === 'REDACTED' && media.database.remaining_rows === 0 && media.object_states
          && Object.entries(media.object_states).every(([state, count]) => state === 'DELETED' || count === 0), 'PRIVACY_RESTORE_CLEANUP_PENDING', '恢复后的受控媒体、费用或主库清理尚未通过', 503);
      }
    }
    await db.query(`INSERT INTO privacy_journal_state(source_id,head_sha256,sequence,initialized,financial_recovery_required) VALUES($1,$2,$3,true,true)
      ON CONFLICT(source_id) DO UPDATE SET head_sha256=excluded.head_sha256,sequence=excluded.sequence,initialized=true,financial_recovery_required=true,updated_at=now()`, [journal.sourceId, snapshot.sha256, snapshot.head.sequence]);
  });
  await journal.unblockRestore(expectedHeadSha256);
}
