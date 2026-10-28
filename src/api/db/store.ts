import type { Db } from './pool.js';
import type { Principal } from '../../shared/contracts/types.js';
import { notFound, AppError } from '../lib/errors.js';
import { hash, id, addSeconds } from '../lib/crypto.js';
import type { Config } from '../config.js';
import { lockMediaOwner } from '../modules/media-access.js';

export const TABLES = [
  'product_drafts', 'assets', 'analysis_jobs', 'profile_versions', 'plan_versions', 'quotes', 'orders', 'payments', 'refunds',
  'render_jobs', 'stage_runs', 'execution_snapshots', 'optional_previews', 'delivery_manifests', 'save_sessions', 'save_receipts',
  'revision_requests', 'support_tickets', 'privacy_deletions', 'rights_records', 'preset_drafts', 'publications', 'public_samples',
  'moderation_reports', 'moderation_appeals', 'favorites', 'forks', 'provider_submissions', 'artifacts', 'identity_locks', 'authorized_samples',
  'agent_instances', 'agent_runs', 'review_packets', 'cleanup_receipts', 'management_actions', 'skill_bundles',
] as const;
export type Table = typeof TABLES[number];
export interface RecordRow<T = unknown> { id: string; tenant_id: string; owner_id?: string; data: T; private?: Record<string, unknown>; revision?: number; created_at: Date; updated_at?: Date; [key: string]: unknown }
const JSON_COLUMNS = new Set(['data', 'private', 'payload', 'response', 'spec_json', 'rate_snapshot']);
// pg serializes JavaScript arrays as PostgreSQL arrays. JSON columns need an
// explicit JSON string while text[] dependencies must retain native array binding.
const sqlValue = (key: string, value: unknown): unknown => JSON_COLUMNS.has(key) ? JSON.stringify(value) : value;

export async function owned<T>(db: Db, table: Table, resourceId: string, p: Pick<Principal, 'tenantId' | 'userId'>, lock = false): Promise<RecordRow<T>> {
  const r = await db.query<RecordRow<T>>(`SELECT * FROM ${table} WHERE id=$1 AND tenant_id=$2 AND owner_id=$3${lock ? ' FOR UPDATE' : ''}`, [resourceId, p.tenantId, p.userId]);
  const row = r.rows[0] ?? notFound();
  if (table === 'product_drafts' && (row.deleted_at || new Date(String(row.expires_at)).getTime() <= Date.now())) throw new AppError('MEDIA_REVOKED', '商品素材已删除或过期', 410);
  if (table === 'assets' && ['DELETED','EXPIRED'].includes(String(row.state))) throw new AppError('MEDIA_REVOKED', '素材已删除或过期', 410);
  if (['analysis_jobs','profile_versions','plan_versions','optional_previews'].includes(table)) {
    const live = await db.query('SELECT id FROM product_drafts WHERE tenant_id=$1 AND owner_id=$2 AND id=$3 AND deleted_at IS NULL AND expires_at>now()', [p.tenantId, p.userId, row.product_id]);
    if (!live.rowCount) throw new AppError('MEDIA_REVOKED', '商品素材已删除或过期', 410);
  }
  if (table === 'quotes') {
    const live = await db.query(`SELECT p.id FROM plan_versions v JOIN product_drafts p ON p.tenant_id=v.tenant_id AND p.id=v.product_id
      WHERE v.tenant_id=$1 AND v.owner_id=$2 AND v.id=$3 AND p.owner_id=$2 AND p.deleted_at IS NULL AND p.expires_at>now()`, [p.tenantId, p.userId, row.plan_id]);
    if (!live.rowCount) throw new AppError('MEDIA_REVOKED', '报价对应的商品素材已删除或过期', 410);
  }
  if (table === 'revision_requests') {
    const live = await db.query("SELECT id FROM orders WHERE tenant_id=$1 AND owner_id=$2 AND id=$3 AND private->>'media_revoked' IS DISTINCT FROM 'true'", [p.tenantId, p.userId, row.order_id]);
    if (!live.rowCount) throw new AppError('MEDIA_REVOKED', '修改对应的订单素材已撤销', 410);
  }
  return row;
}
export async function scoped<T>(db: Db, table: Table, resourceId: string, tenantId: string, lock = false): Promise<RecordRow<T>> {
  const r = await db.query<RecordRow<T>>(`SELECT * FROM ${table} WHERE id=$1 AND tenant_id=$2${lock ? ' FOR UPDATE' : ''}`, [resourceId, tenantId]);
  return r.rows[0] ?? notFound();
}
export async function insert(db: Db, table: string, values: Record<string, unknown>): Promise<void> {
  // Only internal constant identifiers are permitted; all values are parameters.
  if (!/^[a-z_][a-z0-9_]*$/.test(table) || Object.keys(values).some(k => !/^[a-z_][a-z0-9_]*$/.test(k))) throw new Error('Unsafe SQL identifier');
  const keys = Object.keys(values);
  await db.query(`INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(',')})`, keys.map(k => sqlValue(k, values[k])));
}
export async function update(db: Db, table: string, resourceId: string, values: Record<string, unknown>, tenantId?: string): Promise<void> {
  if (!/^[a-z_][a-z0-9_]*$/.test(table) || Object.keys(values).some(k => !/^[a-z_][a-z0-9_]*$/.test(k))) throw new Error('Unsafe SQL identifier');
  const keys = Object.keys(values); const params = keys.map(k => sqlValue(k, values[k])); params.push(resourceId);
  let clause = `id=$${params.length}`;
  if (tenantId) { params.push(tenantId); clause += ` AND tenant_id=$${params.length}`; }
  const result = await db.query(`UPDATE ${table} SET ${keys.map((k, i) => `${k}=$${i + 1}`).join(',')} WHERE ${clause}`, params);
  if (result.rowCount !== 1) notFound();
}
export async function audit(db: Db, tenantId: string | null, actor: string, action: string, target: string, payload: unknown, traceId: string): Promise<void> {
  await insert(db, 'audit_events', { id: id('audit'), tenant_id: tenantId, actor, action, target, trace_id: traceId, payload_hash: hash(payload) });
}
export async function outbox(db: Db, tenantId: string, type: string, resourceId: string, key: string, payload: unknown): Promise<void> {
  await db.query('INSERT INTO outbox_events(id,tenant_id,aggregate_type,aggregate_id,event_key,payload) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(event_key) DO NOTHING', [id('evt'), tenantId, type, resourceId, key, payload]);
}
export async function idempotent<T>(db: Db, p: Principal, operation: string, target: string, key: string | undefined, body: unknown, fn: () => Promise<T>): Promise<T> {
  if (!key || !/^[A-Za-z0-9._:-]{8,128}$/.test(key)) throw new AppError('IDEMPOTENCY_REQUIRED', '请使用有效的幂等请求标识', 400);
  const requestHash = hash(body); const scope = `${p.tenantId}:${p.userId}:${operation}:${target}:${key}`;
  await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [scope]);
  await lockMediaOwner(db, p.tenantId, p.userId);
  const old = await db.query<{ request_hash: string; response: T; revoked_at: Date | null }>('SELECT request_hash,response,revoked_at FROM idempotency_records WHERE tenant_id=$1 AND subject_id=$2 AND operation=$3 AND target_id=$4 AND key=$5', [p.tenantId, p.userId, operation, target, key]);
  if (old.rows[0]) {
    if (old.rows[0].revoked_at) throw new AppError('MEDIA_REVOKED', '原请求素材已删除，不能重放私有内容', 410);
    if (old.rows[0].request_hash !== requestHash) throw new AppError('IDEMPOTENCY_CONFLICT', '同一请求标识不能用于不同内容', 409);
    if (operation === 'checkVariantInput') return fn(); // Pure eligibility must observe current input revocation.
    return old.rows[0].response;
  }
  const result = await fn();
  await insert(db, 'idempotency_records', { id: id('idem'), tenant_id: p.tenantId, subject_id: p.userId, operation, target_id: target, key, request_hash: requestHash, response: result, expires_at: addSeconds(30 * 86400) });
  return result;
}
export interface PageQuery { cursor?: string; limit?: string; q?: string; source?: string; tag?: string; favorites?: string }
export async function listOwned<T>(db: Db, cfg: Config, table: Table, p: Principal, query: PageQuery = {}): Promise<{ items: T[]; next_cursor: string | null }> {
  const { cursor, limit } = await import('../lib/pagination.js');
  const size = limit(query.limit); const point = cursor.decode(cfg, query.cursor, `${table}:${p.tenantId}:${p.userId}`);
  const params: unknown[] = [p.tenantId, p.userId, size + 1];
  let condition = table === 'product_drafts' ? ' AND deleted_at IS NULL AND expires_at>now()' : '';
  if (point) { params.push(point.createdAt, point.id); condition += ' AND (created_at,id)<($4::timestamptz,$5)'; }
  const rows = await db.query<RecordRow<T>>(`SELECT id,data,created_at FROM ${table} WHERE tenant_id=$1 AND owner_id=$2${condition} ORDER BY created_at DESC,id DESC LIMIT $3`, params);
  const extra = rows.rows.length > size; const slice = rows.rows.slice(0, size); const last = slice.at(-1);
  return { items: slice.map(row => row.data), next_cursor: extra && last ? cursor.encode(cfg, { createdAt: last.created_at.toISOString(), id: last.id }, `${table}:${p.tenantId}:${p.userId}`) : null };
}
