import { beforeAll, afterAll, it, expect } from 'vitest';
import { testDatabase, account, orderFixture, type TestDatabase } from '../helpers/database.js';
import { insert, owned } from '../../src/api/db/store.js';
import { transaction } from '../../src/api/db/pool.js';
import { id, addSeconds } from '../../src/api/lib/crypto.js';
import { requestDeletion } from '../../src/api/modules/support.js';
import { createProduct } from '../../src/api/modules/products.js';
import { lockMediaOwner } from '../../src/api/modules/media-access.js';
import { confirmPayment } from '../../src/api/modules/commerce.js';
import { redactPrivateContent } from '../../src/worker/lifecycle/privacy-redaction.js';

let db: TestDatabase;
beforeAll(async () => { db = await testDatabase(); });
afterAll(async () => { await db?.close(); });
const secret = 'SYNTHETIC-BUYER-CONTENT-NOT-REAL'; const payload = { note: secret }; const digest = 'a'.repeat(64);
async function fixture() {
  const { principal: p, orderId } = await orderFixture(db);
  const plan = (await db.pool.query(`SELECT v.* FROM orders o JOIN quotes q ON q.tenant_id=o.tenant_id AND q.id=o.quote_id
    JOIN plan_versions v ON v.tenant_id=q.tenant_id AND v.id=q.plan_id WHERE o.id=$1`, [orderId])).rows[0];
  const scope = { tenantId: p.tenantId, ownerId: p.userId, productIds: [plan.product_id], orderIds: [orderId], assetIds: [] as string[] };
  const add = async (table: string, fields: Record<string, unknown>): Promise<string> => {
    const key = id('fixture'); await insert(db.pool, table, { id: key, tenant_id: p.tenantId, data: payload, ...fields }); return key;
  };
  await db.pool.query('UPDATE product_drafts SET data=$2 WHERE id=$1', [plan.product_id, JSON.stringify(payload)]);
  await db.pool.query('UPDATE plan_versions SET data=$2,private=$2 WHERE id=$1', [plan.id, JSON.stringify(payload)]);
  const profileId = await add('profile_versions', { owner_id: p.userId, product_id: plan.product_id, photo_version_id: plan.photo_version_id, revision: 2, profile_hash: digest, private: payload });
  await add('identity_locks', { profile_id: profileId, hash: digest });
  await add('correction_versions', { product_id: plan.product_id, parent_profile_id: plan.profile_id, new_profile_id: profileId });
  const analysis = await add('analysis_jobs', { owner_id: p.userId, product_id: plan.product_id, photo_version_id: plan.photo_version_id, input_hash: digest, state: 'SUCCEEDED', model_version: 'synthetic', deadline_at: addSeconds(60), private: payload });
  await add('analysis_attempts', { analysis_id: analysis, attempt: 1, request_hash: digest });
  await add('scene_locks', { plan_id: plan.id, hash: digest });
  await add('shot_plans', { plan_id: plan.id, shot_id: 's1', start_frame: 0, end_frame: 30 });
  await add('reference_frame_sets', { plan_id: plan.id, shot_id: 's1', quality_decision: 'PASS' });
  await add('optional_previews', { owner_id: p.userId, product_id: plan.product_id, plan_id: plan.id, plan_hash: digest, state: 'SUCCEEDED', expires_at: addSeconds(60) });
  const asset = await add('assets', { owner_id: p.userId, product_id: plan.product_id, purpose: 'PRODUCT_PHOTO', state: 'READY', object_key: `${p.tenantId}/synthetic/${id('input')}`,
    upload_token_hash: digest, expected_bytes: 1, declared_mime: 'image/png', expected_sha256: digest, sha256: digest, expires_at: addSeconds(60), grant_expires_at: addSeconds(60) });
  scope.assetIds.push(asset);
  const snapshot = await add('execution_snapshots', { order_id: orderId, hash: digest });
  const job = await add('render_jobs', { owner_id: p.userId, order_id: orderId, execution_snapshot_id: snapshot, state: 'FAILED', deadline_at: addSeconds(60), data: { state: 'FAILED' }, private: payload });
  const stage = await add('stage_runs', { job_id: job, scope_type: 'ORDER', scope_id: orderId, stage_name: 'PRODUCTION', input_hash: digest, state: 'FAILED', deadline_at: addSeconds(60), data: { state: 'FAILED' }, private: payload });
  await add('provider_submissions', { stage_run_id: stage, intent_key: id('intent'), input_hash: digest, state: 'SUCCEEDED', data: { state: 'SUCCEEDED' }, private: payload });
  const instance = await add('agent_instances', { order_id: orderId, state: 'RELEASED', workspace_ref: 'SYNTHETIC-NO-PROCESS', lease_expires_at: addSeconds(-1), data: { state: 'RELEASED' }, private: { ...payload, cleanup_binding: { synthetic: true } } });
  const run = await add('agent_runs', { instance_id: instance, role: 'PRODUCTION', state: 'SUCCEEDED', role_workspace_ref: 'SYNTHETIC-NO-PROCESS', input_hash: digest, data: { state: 'SUCCEEDED' }, private: payload });
  const tool = await add('agent_tool_intents', { order_id: orderId, subject_ref: p.userId, run_id: run, idempotency_key: id('tool'), request_hash: digest, state: 'SUCCEEDED', private: payload });
  await add('inference_requests', { run_id: run, intent_key: id('inference'), request_hash: digest, state: 'SUCCEEDED', reserved_micro: 3, actual_micro: 3, scope_type: 'ORDER', scope_id: orderId, data: { state: 'SUCCEEDED' }, private: payload });
  await add('media_operations', { order_id: orderId, stage_run_id: stage, phase: 'PRODUCTION', input_hash: digest, state: 'READY' });
  const artifact = await add('artifacts', { order_id: orderId, stage_run_id: stage, slot_id: 's1', object_key: `${p.tenantId}/synthetic/${id('output')}`, sha256: digest, spec_json: payload, expires_at: addSeconds(60) });
  await add('qc_decisions', { order_id: orderId, artifact_id: artifact, ruleset_version: 'synthetic', decision: 'PASS' });
  const packet = await add('review_packets', { order_id: orderId, snapshot_hash: digest, output_set_hash: digest, packet_hash: digest, state: 'SEALED', private: payload });
  await add('review_reports', { packet_id: packet, run_id: run, thread_id: id('thread'), role: 'REVIEW_FACTS', verdict: 'PASS', evidence_hash: digest });
  await add('review_evidence', { packet_id: packet, order_id: orderId, kind: 'COPY', object_key: `${p.tenantId}/synthetic/${id('evidence')}`, sha256: digest, mime_type: 'application/json' });
  await add('delivery_manifests', { owner_id: p.userId, order_id: orderId, revision: 1, hash: digest, private: payload, expires_at: addSeconds(60) });
  const revision = await add('revision_requests', { owner_id: p.userId, order_id: orderId, parent_manifest_revision: 1, kind: 'SYSTEM_REPAIR', state: 'FAILED', consumes_user_allowance: false, private: payload });
  await add('support_tickets', { owner_id: p.userId, order_id: orderId, category: 'OTHER', state: 'OPEN', data: { state: 'OPEN' }, private: payload });
  const payment = await add('payments', { order_id: orderId, provider: 'alipay', merchant_id: 'synthetic-merchant', state: 'CONFIRMED', amount_fen: 100, intent_key: id('payment'), data: { state: 'CONFIRMED' } });
  await insert(db.pool, 'ledger_entries', { id: id('ledger'), tenant_id: p.tenantId, order_id: orderId, event_key: id('paid'), entry_type: 'PAYMENT', amount_fen: 100, currency: 'CNY' });
  return { p, orderId, plan, scope, profileId, snapshot, instance, tool, payment, revision };
}
async function remove(f: Awaited<ReturnType<typeof fixture>>) {
  return transaction(db.pool, c => requestDeletion(c, f.p, { scope: 'PRODUCT', product_id: f.plan.product_id, acknowledge_inflight_contract: true }));
}
async function redact(f: Awaited<ReturnType<typeof fixture>>, objectsPending = false) {
  return transaction(db.pool, async c => { await lockMediaOwner(c, f.p.tenantId, f.p.userId); return redactPrivateContent(c, f.scope, objectsPending); });
}
it('redacts all 32 scoped content tables while retaining original hashes, funds and immutable audit receipts', async () => {
  const f = await fixture(); await remove(f); const result = await redact(f);
  expect(result).toMatchObject({ state: 'REDACTED', remaining_rows: 0, blockers: [] });
  const rows = (await db.pool.query('SELECT target_table,target_id,field_names FROM privacy_redactions WHERE tenant_id=$1 AND owner_id=$2', [f.p.tenantId, f.p.userId])).rows;
  expect(new Set(rows.map(r => r.target_table)).size).toBe(32);
  for (const row of rows) {
    const document = (await db.pool.query(`SELECT to_jsonb(t) AS document FROM ${row.target_table} t WHERE id=$1`, [row.target_id])).rows[0].document;
    for (const field of row.field_names) expect(document[field]).toEqual(row.target_table === 'orders' ? { privacy_deleted: true, media_revoked: true } : { privacy_deleted: true });
  }
  expect((await db.pool.query('SELECT profile_hash FROM profile_versions WHERE id=$1', [f.profileId])).rows[0].profile_hash).toBe(digest);
  expect((await db.pool.query('SELECT hash FROM execution_snapshots WHERE id=$1', [f.snapshot])).rows[0].hash).toBe(digest);
  expect((await db.pool.query('SELECT amount_fen FROM ledger_entries WHERE order_id=$1', [f.orderId])).rows).toEqual([{ amount_fen: 100 }]);
  expect((await db.pool.query('SELECT amount_fen,state FROM payments WHERE id=$1', [f.payment])).rows[0]).toEqual({ amount_fen: 100, state: 'CONFIRMED' });
  expect((await db.pool.query('SELECT count(*) FROM refunds WHERE order_id=$1', [f.orderId])).rows[0].count).toBe('1');
  expect((await redact(f)).redacted_rows).toBe(result.redacted_rows); await remove(f);
  await expect(db.pool.query('DELETE FROM privacy_redactions WHERE tenant_id=$1', [f.p.tenantId])).rejects.toThrow('immutable');
});
it('does not erase recovery payloads before binaries, retired instances, tools and billing are settled', async () => {
  const f = await fixture(); await remove(f);
  const pending = await redact(f, true); expect(pending.blockers).toContain('CONTROLLED_OBJECTS_PENDING'); expect(pending.remaining_rows).toBeGreaterThan(0);
  await db.pool.query("UPDATE agent_instances SET state='CLEANUP_FAILED' WHERE id=$1", [f.instance]);
  await db.pool.query("UPDATE agent_tool_intents SET state='UNKNOWN' WHERE id=$1", [f.tool]);
  await db.pool.query("UPDATE inference_requests SET state='UNKNOWN',actual_micro=NULL WHERE run_id IN (SELECT id FROM agent_runs WHERE instance_id=$1)", [f.instance]);
  expect((await redact(f)).blockers).toEqual(expect.arrayContaining(['INSTANCE_RELEASE_PENDING','TOOL_OUTCOME_PENDING','INFERENCE_BILLING_PENDING']));
  expect((await db.pool.query('SELECT private FROM agent_tool_intents WHERE id=$1', [f.tool])).rows[0].private).toEqual(payload);
  expect((await db.pool.query('SELECT count(*) FROM privacy_redactions WHERE owner_id=$1', [f.p.userId])).rows[0].count).toBe('0');
});
it('keeps ordinary immutable guards and rejects another owner marker or a receipt without the same-transaction erasure', async () => {
  const f = await fixture();
  await expect(db.pool.query('UPDATE profile_versions SET data=$2 WHERE id=$1', [f.profileId, JSON.stringify({ changed: true })])).rejects.toThrow('immutable');
  const other = await account(db); const product = await createProduct(db.pool, other.principal);
  const deletion = await transaction(db.pool, c => requestDeletion(c, other.principal, { scope: 'PRODUCT', product_id: product.product_id, acknowledge_inflight_contract: true }));
  const foreign = (await db.pool.query('SELECT id FROM deletion_markers WHERE request_id=$1 LIMIT 1', [deletion.deletion_id])).rows[0].id;
  const receipt = async (marker: string) => db.pool.query(`INSERT INTO privacy_redactions(id,tenant_id,owner_id,target_table,target_id,marker_id,before_sha256,after_sha256,field_names)
    SELECT $1,$2,$3,'profile_versions',p.id,$5,ypcc_privacy_digest(to_jsonb(p)),ypcc_privacy_digest(ypcc_privacy_projection('profile_versions',to_jsonb(p))),ARRAY['data','private'] FROM profile_versions p WHERE p.id=$4`, [id('redaction'), f.p.tenantId, f.p.userId, f.profileId, marker]);
  await expect(receipt(foreign)).rejects.toThrow('does not authorize');
  const own = await remove(f); const marker = (await db.pool.query('SELECT id FROM deletion_markers WHERE request_id=$1 AND target_type=\'PRODUCT\'', [own.deletion_id])).rows[0].id;
  await expect(receipt(marker)).rejects.toThrow('same transaction');
  expect((await db.pool.query('SELECT data FROM profile_versions WHERE id=$1', [f.profileId])).rows[0].data).toEqual(payload);
  expect((await db.pool.query('SELECT count(*) FROM privacy_redactions WHERE owner_id=$1', [f.p.userId])).rows[0].count).toBe('0');
});
it('blocks restored payloads and late derived inserts and returns 410 for redacted quote/revision reads', async () => {
  const f = await fixture(); await remove(f); await redact(f);
  await expect(db.pool.query('UPDATE plan_versions SET private=$2 WHERE id=$1', [f.plan.id, JSON.stringify(payload)])).rejects.toThrow('cannot be restored');
  await expect(insert(db.pool, 'shot_plans', { id: id('late'), tenant_id: f.p.tenantId, plan_id: f.plan.id, shot_id: 'late', start_frame: 30, end_frame: 60, data: payload })).rejects.toThrow('cannot accept new content');
  const quote = (await db.pool.query('SELECT quote_id FROM orders WHERE id=$1', [f.orderId])).rows[0].quote_id;
  await expect(owned(db.pool, 'quotes', quote, f.p)).rejects.toMatchObject({ code: 'MEDIA_REVOKED', status: 410 });
  await expect(owned(db.pool, 'revision_requests', f.revision, f.p)).rejects.toMatchObject({ code: 'MEDIA_REVOKED', status: 410 });
});
it('accepts a late payment after redaction, refunds once and never recreates the deleted execution contract', async () => {
  const f = await fixture();
  await db.pool.query("UPDATE orders SET payment_state='CREATED',data=jsonb_set(data,'{payment_state}','\"CREATED\"') WHERE id=$1", [f.orderId]);
  await db.pool.query("UPDATE payments SET state='CREATED',data='{\"state\":\"CREATED\"}' WHERE id=$1", [f.payment]);
  await db.pool.query('DELETE FROM ledger_entries WHERE order_id=$1', [f.orderId]);
  await remove(f); await redact(f);
  const event = { channel: 'alipay' as const, appId: 'dev-alipay', merchantId: 'synthetic-merchant', subjectId: f.p.subjectId, orderId: f.orderId,
    providerOrderId: id('provider'), eventKey: id('event'), amountFen: 100, rawHash: digest };
  expect((await transaction(db.pool, c => confirmPayment(c, event))).fulfillment_state).toBe('CANCELLED');
  await transaction(db.pool, c => confirmPayment(c, event));
  expect((await db.pool.query('SELECT private FROM orders WHERE id=$1', [f.orderId])).rows[0].private).toEqual({ privacy_deleted: true, media_revoked: true });
  expect((await db.pool.query('SELECT count(*) FROM refunds WHERE order_id=$1', [f.orderId])).rows[0].count).toBe('1');
  expect((await db.pool.query('SELECT count(*) FROM ledger_entries WHERE order_id=$1', [f.orderId])).rows[0].count).toBe('1');
});
