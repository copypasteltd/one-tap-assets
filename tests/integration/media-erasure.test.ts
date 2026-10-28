import { beforeAll, afterAll, it, expect } from 'vitest';
import { mkdir, writeFile, readFile, rm, symlink, rmdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { testDatabase, account, orderFixture, type TestDatabase } from '../helpers/database.js';
import { createProduct } from '../../src/api/modules/products.js';
import { requestDeletion } from '../../src/api/modules/support.js';
import { insert, owned, idempotent, listOwned } from '../../src/api/db/store.js';
import { transaction } from '../../src/api/db/pool.js';
import { LocalStorage, type ObjectStorage } from '../../src/api/storage/storage.js';
import { writePrivateObject, type PrivateObjectScope } from '../../src/api/storage/private-objects.js';
import { MediaErasureService } from '../../src/worker/lifecycle/media-erasure.js';
import { id, addSeconds, sha256 } from '../../src/api/lib/crypto.js';
import { inside } from '../../src/api/config.js';
import { enqueueStage } from '../../src/worker/queue/enqueue.js';
import { reservePlatform, settlePlatform } from '../../src/worker/budget/platform.js';
import { claimStage, completeStage } from '../../src/worker/queue/leases.js';
let db: TestDatabase; let store: LocalStorage; let root: string;
const signal = new AbortController().signal;
beforeAll(async () => { db = await testDatabase(); root = inside(db.cfg.runtimeRoot, `tests/erasure/${id('case')}`); await mkdir(root, { recursive: true }); store = new LocalStorage({ ...db.cfg, runtimeRoot: root }); });
afterAll(async () => { await db?.close(); if (root) await rm(inside(db.cfg.runtimeRoot, root), { recursive: true, force: true }); });
async function fixture() {
  const { principal: p } = await account(db); const product = await createProduct(db.pool, p); const key = `${p.tenantId}/input/${id('photo')}.png`;
  const scope: PrivateObjectScope = { tenantId: p.tenantId, ownerId: p.userId, productId: product.product_id, kind: 'INPUT' };
  return { p, product, key, scope };
}
async function eraseAll(service = new MediaErasureService(db.pool, store, id('eraser'))) { for (let n = 0; n < 40 && await service.eraseOne(signal); n++) { /* bounded isolated schema */ } }
async function deleteProduct(f: Awaited<ReturnType<typeof fixture>>) { return transaction(db.pool, c => requestDeletion(c, f.p, { scope: 'PRODUCT', product_id: f.product.product_id, acknowledge_inflight_contract: true })); }
it('continues processing other requests after a malformed legacy locator blocks one deletion', async () => {
  const bad = await fixture(); const good = await fixture();
  await insert(db.pool, 'assets', { id: id('asset'), tenant_id: bad.p.tenantId, owner_id: bad.p.userId, product_id: bad.product.product_id,
    purpose: 'PRODUCT_PHOTO', state: 'READY', object_key: `${bad.p.tenantId}/../synthetic-unsafe`, upload_token_hash: 'a'.repeat(64),
    expected_bytes: 1, declared_mime: 'image/png', expected_sha256: 'a'.repeat(64), sha256: 'a'.repeat(64), expires_at: addSeconds(60), grant_expires_at: addSeconds(60), data: {} });
  const first = await deleteProduct(bad); const second = await deleteProduct(good);
  await db.pool.query("UPDATE privacy_deletions SET updated_at='2000-01-01T00:00:00Z' WHERE id=ANY($1::text[])", [[first.deletion_id, second.deletion_id]]);
  await new MediaErasureService(db.pool, store, id('eraser')).refreshPending();
  const failed = (await db.pool.query('SELECT state,private FROM privacy_deletions WHERE id=$1', [first.deletion_id])).rows[0];
  expect(failed.state).toBe('PARTIAL_BLOCKED'); expect(failed.private.maintenance_error).toMatch(/^[A-Z_]+$/);
  expect((await db.pool.query('SELECT private FROM privacy_deletions WHERE id=$1', [second.deletion_id])).rows[0].private.controlled_media.database.state).toBe('REDACTED');
});
it('registers an in-flight write before bytes exist, revokes immediately and queues a late upload without reviving it', async () => {
  const f = await fixture(); let release!: () => void; let entered!: () => void;
  const blocked = new Promise<void>(r => { release = r; }); const started = new Promise<void>(r => { entered = r; });
  const delayed: ObjectStorage = { get: store.get.bind(store), delete: store.delete.bind(store), exists: store.exists.bind(store),
    put: async (key, bytes, mime) => { entered(); await blocked; await store.put(key, bytes, mime); } };
  const writing = writePrivateObject(db.pool, delayed, f.scope, f.key, Buffer.from('synthetic-photo'), 'image/png');
  const observed = writing.catch(e => e); await started;
  expect((await db.pool.query('SELECT state FROM private_object_writes WHERE object_key=$1', [f.key])).rows[0].state).toBe('WRITING');
  const deletion = await deleteProduct(f); const eraser = new MediaErasureService(db.pool, store, id('eraser'));
  expect(await eraser.eraseOne(signal)).toBe(false); release(); expect(await observed).toMatchObject({ code: 'PRIVATE_OBJECT_REVOKED' });
  expect(await store.exists(f.key)).toBe(true); await eraseAll(eraser); expect(await store.exists(f.key)).toBe(false);
  await eraser.refreshDeletion(f.p.tenantId, deletion.deletion_id);
  const result = (await db.pool.query('SELECT state,private FROM privacy_deletions WHERE id=$1', [deletion.deletion_id])).rows[0];
  expect(result.state).toBe('PARTIAL_BLOCKED'); expect(result.private.controlled_media.object_states).toEqual({ DELETED: 1 });
  expect(result.private.controlled_media.database.state).toBe('REDACTED');
  expect(result.private.controlled_media.remaining_gates).toEqual(['BACKUP_REPLAY_PENDING','PROVIDER_COPY_BOUNDARY_PENDING']);
  await expect(writePrivateObject(db.pool, store, f.scope, f.key, Buffer.from('synthetic-photo'), 'image/png')).rejects.toMatchObject({ code: 'PRIVATE_OBJECT_REVOKED' });
});
it('removes exact bytes and interrupted upload temp files while preserving another user and neighbouring names', async () => {
  const a = await fixture(); const b = await fixture();
  await writePrivateObject(db.pool, store, a.scope, a.key, Buffer.from('a'), 'image/png');
  await writePrivateObject(db.pool, store, b.scope, b.key, Buffer.from('b'), 'image/png');
  const path = inside(join(root, 'objects'), a.key); await writeFile(`${path}.upload_interrupted.tmp`, 'partial'); await writeFile(`${path}.neighbour`, 'keep');
  await deleteProduct(a); await eraseAll(); expect(await store.exists(a.key)).toBe(false); expect(await store.exists(b.key)).toBe(true);
  expect(await readFile(`${path}.neighbour`, 'utf8')).toBe('keep'); await expect(readFile(`${path}.upload_interrupted.tmp`)).rejects.toMatchObject({ code: 'ENOENT' });
  const row = (await db.pool.query('SELECT state,evidence FROM private_object_writes WHERE object_key=$1', [a.key])).rows[0];
  expect(row).toMatchObject({ state: 'DELETED', evidence: { proof: { versions_removed: 2, all_versions_absent: true } } });
  await expect(db.pool.query("UPDATE private_object_writes SET object_key=object_key||'.changed' WHERE object_key=$1", [a.key])).rejects.toThrow('immutable');
});
it('records failed erasure immutably and retries without certifying an adapter that lacks version proof', async () => {
  const f = await fixture(); await writePrivateObject(db.pool, store, f.scope, f.key, Buffer.from('retry'), 'image/png'); await deleteProduct(f);
  const unsupported: ObjectStorage = { put: store.put.bind(store), get: store.get.bind(store), exists: store.exists.bind(store), delete: store.delete.bind(store) };
  const first = new MediaErasureService(db.pool, unsupported, id('eraser')); expect(await first.eraseOne(signal)).toBe(true); expect(await store.exists(f.key)).toBe(true);
  const object = (await db.pool.query('SELECT id,state,last_error FROM private_object_writes WHERE object_key=$1', [f.key])).rows[0];
  expect(object).toMatchObject({ state: 'STORED', last_error: 'OBJECT_ERASURE_UNSUPPORTED' });
  await expect(db.pool.query("UPDATE object_erasure_receipts SET state='DELETED' WHERE object_id=$1", [object.id])).rejects.toThrow('immutable');
  await db.pool.query('UPDATE private_object_writes SET erase_available_at=now() WHERE id=$1', [object.id]); await eraseAll();
  expect((await db.pool.query('SELECT state FROM object_erasure_receipts WHERE object_id=$1 ORDER BY erase_generation', [object.id])).rows).toEqual([{ state: 'FAILED' }, { state: 'DELETED' }]);
});
it('allows one concurrent eraser and ignores a late completion after its lease is stolen', async () => {
  const f = await fixture(); await writePrivateObject(db.pool, store, f.scope, f.key, Buffer.from('lease'), 'image/png'); await deleteProduct(f);
  let entered!: () => void; let release!: () => void; const started = new Promise<void>(r => { entered = r; }); const blocked = new Promise<void>(r => { release = r; });
  const delayed: ObjectStorage = { put: store.put.bind(store), get: store.get.bind(store), delete: store.delete.bind(store), exists: store.exists.bind(store),
    erase: async (key, s) => { entered(); await blocked; return store.erase(key, s); } };
  const old = new MediaErasureService(db.pool, delayed, id('old')); const next = new MediaErasureService(db.pool, store, id('next'));
  const pending = old.eraseOne(signal); await started; expect(await next.eraseOne(signal)).toBe(false);
  await db.pool.query("UPDATE private_object_writes SET erase_lease_expires_at=now()-interval '1 second' WHERE object_key=$1", [f.key]);
  expect(await next.eraseOne(signal)).toBe(true); release(); await pending;
  const row = (await db.pool.query('SELECT id,state,erase_generation FROM private_object_writes WHERE object_key=$1', [f.key])).rows[0];
  expect(row.state).toBe('DELETED'); expect(row.erase_generation).toBe('2');
  expect((await db.pool.query('SELECT erase_generation FROM object_erasure_receipts WHERE object_id=$1', [row.id])).rows).toEqual([{ erase_generation: '2' }]);
});
it('keeps uncertain writes blocked and does not release money or claim absence as proof', async () => {
  const f = await fixture(); const uncertain: ObjectStorage = { put: async () => { throw new Error('synthetic-network-unknown'); }, get: store.get.bind(store), delete: store.delete.bind(store), exists: store.exists.bind(store) };
  await expect(writePrivateObject(db.pool, uncertain, f.scope, f.key, Buffer.from('unknown'), 'image/png')).rejects.toThrow('synthetic-network');
  await expect(writePrivateObject(db.pool, store, f.scope, f.key, Buffer.from('unknown'), 'image/png')).rejects.toMatchObject({ code: 'PRIVATE_OBJECT_WRITE_PENDING' });
  const request = await deleteProduct(f); const eraser = new MediaErasureService(db.pool, store, id('eraser')); await eraseAll(eraser); await eraser.refreshDeletion(f.p.tenantId, request.deletion_id);
  expect((await db.pool.query('SELECT state FROM private_object_writes WHERE object_key=$1', [f.key])).rows[0].state).toBe('UNKNOWN');
  await expect(writePrivateObject(db.pool, store, { ...f.scope, kind: 'RECEIPT' }, f.key, Buffer.from('unknown'), 'image/png')).rejects.toMatchObject({ code: 'PRIVATE_OBJECT_CHANGED' });
  expect((await db.pool.query('SELECT private FROM privacy_deletions WHERE id=$1', [request.deletion_id])).rows[0].private.controlled_media.object_states).toEqual({ UNKNOWN: 1 });
});
it('retains a late receipt through UNKNOWN billing and deletes it only after the original cost is settled', async () => {
  const f = await fixture(); const stage = await enqueueStage(db.pool, { tenantId: f.p.tenantId, scopeType: 'ANALYSIS', scopeId: id('analysis'), name: 'ANALYZE', inputHash: 'a'.repeat(64), deadlineAt: addSeconds(100) });
  const reservation = await transaction(db.pool, c => reservePlatform(c, { tenantId: f.p.tenantId, ownerId: f.p.userId, category: 'VISION', dailyCeilingMicro: 100 }, id('billing'), 50, {}));
  const submission = id('submission'); const key = `${f.p.tenantId}/vision/${submission}.json`;
  await insert(db.pool, 'provider_submissions', { id: submission, tenant_id: f.p.tenantId, stage_run_id: stage, intent_key: id('provider'), input_hash: 'a'.repeat(64), state: 'SUBMITTING', reservation_id: reservation, data: {}, private: { result_key: key } });
  await deleteProduct(f);
  await writePrivateObject(db.pool, store, { ...f.scope, kind: 'RECEIPT' }, key, Buffer.from('{"usage":"synthetic"}'), 'application/json');
  const eraser = new MediaErasureService(db.pool, store, id('eraser')); await eraseAll(eraser); expect(await store.exists(key)).toBe(true);
  await transaction(db.pool, async c => { await settlePlatform(c, f.p.tenantId, reservation, null); await c.query("UPDATE provider_submissions SET state='UNKNOWN' WHERE id=$1", [submission]); });
  await db.pool.query('UPDATE private_object_writes SET erase_available_at=now() WHERE object_key=$1', [key]); await eraseAll(eraser); expect(await store.exists(key)).toBe(true);
  expect((await db.pool.query('SELECT state FROM platform_budget_reservations WHERE id=$1', [reservation])).rows[0].state).toBe('UNKNOWN');
  await transaction(db.pool, async c => { await settlePlatform(c, f.p.tenantId, reservation, 7); await c.query("UPDATE provider_submissions SET state='SUCCEEDED' WHERE id=$1", [submission]); });
  await db.pool.query('UPDATE private_object_writes SET erase_available_at=now() WHERE object_key=$1', [key]); await eraseAll(eraser); expect(await store.exists(key)).toBe(false);
  expect((await db.pool.query('SELECT state,settled_micro FROM platform_budget_reservations WHERE id=$1', [reservation])).rows[0]).toEqual({ state: 'SETTLED', settled_micro: '7' });
});
it('preserves a paid frozen extension and expires a delivered package without changing its financial facts', async () => {
  const f = await fixture(); const assetId = id('asset');
  await insert(db.pool, 'assets', { id: assetId, tenant_id: f.p.tenantId, owner_id: f.p.userId, product_id: f.product.product_id, purpose: 'PRODUCT_PHOTO', state: 'READY', object_key: f.key,
    upload_token_hash: sha256('synthetic-token'), expected_bytes: 1, declared_mime: 'image/png', sha256: sha256('a'), expires_at: addSeconds(3600), grant_expires_at: addSeconds(900) });
  await writePrivateObject(db.pool, store, { ...f.scope, assetId }, f.key, Buffer.from('a'), 'image/png');
  await db.pool.query("UPDATE private_object_writes SET expires_at=now()-interval '1 second' WHERE object_key=$1", [f.key]);
  const eraser = new MediaErasureService(db.pool, store, id('eraser')); await eraser.expire(); await eraseAll(eraser); expect(await store.exists(f.key)).toBe(true);
  expect((await db.pool.query('SELECT delete_requested FROM private_object_writes WHERE object_key=$1', [f.key])).rows[0].delete_requested).toBe(false);
  const order = await orderFixture(db); const product = (await db.pool.query('SELECT v.product_id FROM orders o JOIN quotes q ON q.id=o.quote_id JOIN plan_versions v ON v.id=q.plan_id WHERE o.id=$1', [order.orderId])).rows[0].product_id;
  const key = `${order.principal.tenantId}/media/${order.orderId}/photo.png`;
  await writePrivateObject(db.pool, store, { tenantId: order.principal.tenantId, ownerId: order.principal.userId, productId: product, orderId: order.orderId, kind: 'MEDIA' }, key, Buffer.from('output'), 'image/png');
  await db.pool.query("UPDATE orders SET fulfillment_state='DELIVERED',delivery_expires_at=now()-interval '1 second' WHERE id=$1", [order.orderId]);
  await eraser.expire(); await eraseAll(eraser); expect(await store.exists(key)).toBe(false);
  expect((await db.pool.query('SELECT fulfillment_state,payment_state,amount_fen FROM orders WHERE id=$1', [order.orderId])).rows[0]).toEqual({ fulfillment_state: 'EXPIRED', payment_state: 'CONFIRMED', amount_fen: 100 });
});
it('does not let a previous account deletion capture new products or their future media', async () => {
  const f = await fixture(); await writePrivateObject(db.pool, store, f.scope, f.key, Buffer.from('old'), 'image/png');
  const deletion = await transaction(db.pool, c => requestDeletion(c, f.p, { scope: 'ACCOUNT_MEDIA', acknowledge_inflight_contract: true }));
  const product = await createProduct(db.pool, f.p); const key = `${f.p.tenantId}/input/${id('new')}.png`;
  await writePrivateObject(db.pool, store, { ...f.scope, productId: product.product_id }, key, Buffer.from('new'), 'image/png');
  const eraser = new MediaErasureService(db.pool, store, id('eraser')); await eraser.refreshDeletion(f.p.tenantId, deletion.deletion_id); await eraseAll(eraser);
  expect(await store.exists(f.key)).toBe(false); expect(await store.exists(key)).toBe(true);
  expect((await owned(db.pool, 'product_drafts', product.product_id, f.p)).id).toBe(product.product_id);
});
it('rejects deletion without inflight acknowledgement, then cancels and requests exactly one refund while fencing roles', async () => {
  const f = await orderFixture(db); const p = f.principal;
  const productId = (await db.pool.query('SELECT v.product_id FROM orders o JOIN quotes q ON q.id=o.quote_id JOIN plan_versions v ON v.id=q.plan_id WHERE o.id=$1', [f.orderId])).rows[0].product_id;
  const stageId = await enqueueStage(db.pool, { tenantId: p.tenantId, scopeType: 'ORDER', scopeId: f.orderId, name: 'PRODUCTION', inputHash: 'b'.repeat(64), deadlineAt: addSeconds(300) });
  const lease = (await claimStage(db.pool, id('worker'), ['PRODUCTION']))!; expect(lease.id).toBe(stageId);
  const instance = id('instance'); const run = id('run'); const cap = id('cap');
  await insert(db.pool, 'agent_instances', { id: instance, tenant_id: p.tenantId, order_id: f.orderId, state: 'ACTIVE', workspace_ref: 'synthetic-fixture-only', lease_expires_at: addSeconds(120), data: {} });
  await insert(db.pool, 'agent_runs', { id: run, tenant_id: p.tenantId, instance_id: instance, role: 'PRODUCTION', state: 'RUNNING', role_workspace_ref: 'synthetic-fixture-only', input_hash: 'b'.repeat(64), data: {} });
  await insert(db.pool, 'agent_capabilities', { id: cap, token_hash: sha256(id('synthetic-cap')), tenant_id: p.tenantId, instance_id: instance, run_id: run, stage_run_id: stageId,
    stage_fencing_token: lease.fencing_token, instance_fencing_token: 1, snapshot_hash: 'b'.repeat(64), expires_at: addSeconds(120) });
  await insert(db.pool, 'payments', { id: id('payment'), tenant_id: p.tenantId, order_id: f.orderId, provider: 'ALIPAY', merchant_id: 'synthetic-merchant', state: 'CONFIRMED', amount_fen: 100, intent_key: id('payment_intent'), data: {} });
  await expect(transaction(db.pool, c => requestDeletion(c, p, { scope: 'PRODUCT', product_id: productId, acknowledge_inflight_contract: false }))).rejects.toMatchObject({ code: 'PRIVACY_INFLIGHT_ACK_REQUIRED' });
  expect((await db.pool.query('SELECT deleted_at FROM product_drafts WHERE id=$1', [productId])).rows[0].deleted_at).toBeNull();
  for (let n = 0; n < 2; n++) await transaction(db.pool, c => requestDeletion(c, p, { scope: 'PRODUCT', product_id: productId, acknowledge_inflight_contract: true }));
  expect((await db.pool.query('SELECT fulfillment_state,private FROM orders WHERE id=$1', [f.orderId])).rows[0]).toMatchObject({ fulfillment_state: 'CANCELLED', private: { media_revoked: true } });
  expect((await db.pool.query('SELECT count(*) AS n FROM refunds WHERE order_id=$1', [f.orderId])).rows[0].n).toBe('1');
  expect((await db.pool.query("SELECT count(*) AS n FROM outbox_events WHERE aggregate_type='RefundRequested' AND aggregate_id=$1", [f.orderId])).rows[0].n).toBe('1');
  expect((await db.pool.query('SELECT revoked_at FROM agent_capabilities WHERE id=$1', [cap])).rows[0].revoked_at).not.toBeNull();
  expect((await db.pool.query('SELECT state FROM agent_instances WHERE id=$1', [instance])).rows[0].state).toBe('DRAINING');
  const stopped = (await db.pool.query('SELECT state,fencing_token FROM stage_runs WHERE id=$1', [stageId])).rows[0];
  expect(stopped.state).toBe('CANCELLED'); expect(Number(stopped.fencing_token)).toBeGreaterThan(Number(lease.fencing_token));
  await expect(completeStage(db.pool, lease, async () => {})).rejects.toMatchObject({ code: 'ORDER_NO_LONGER_EXECUTABLE' });
});
it('revokes cached private responses and product reads while financial history remains readable', async () => {
  const f = await fixture(); const key = id('idempotency');
  await transaction(db.pool, c => idempotent(c, f.p, 'createProduct', '', key, {}, async () => f.product));
  await deleteProduct(f);
  await expect(transaction(db.pool, c => idempotent(c, f.p, 'createProduct', '', key, {}, async () => f.product))).rejects.toMatchObject({ code: 'MEDIA_REVOKED' });
  await expect(owned(db.pool, 'product_drafts', f.product.product_id, f.p)).rejects.toMatchObject({ code: 'MEDIA_REVOKED' });
  expect((await listOwned(db.pool, db.cfg, 'product_drafts', f.p)).items).toHaveLength(0);
});
it('adopts legacy input locations and expires actual bytes without needing generation or payment switches', async () => {
  const f = await fixture(); const assetId = id('asset');
  await store.put(f.key, Buffer.from('legacy-input'), 'image/png');
  await insert(db.pool, 'assets', { id: assetId, tenant_id: f.p.tenantId, owner_id: f.p.userId, product_id: f.product.product_id, purpose: 'PRODUCT_PHOTO', state: 'READY',
    object_key: f.key, upload_token_hash: sha256('synthetic-upload-token'), expected_bytes: 12, declared_mime: 'image/png', sha256: sha256('legacy-input'), expires_at: addSeconds(-1), grant_expires_at: addSeconds(-1) });
  const eraser = new MediaErasureService(db.pool, store, id('eraser')); await eraser.expire(); await eraseAll(eraser);
  expect(await store.exists(f.key)).toBe(false); expect((await db.pool.query('SELECT state FROM assets WHERE id=$1', [assetId])).rows[0].state).toBe('EXPIRED');
  const a = await fixture(); await writePrivateObject(db.pool, store, a.scope, a.key, Buffer.from('product-expiry'), 'image/png');
  await db.pool.query("UPDATE product_drafts SET expires_at=now()-interval '1 second' WHERE id=$1", [a.product.product_id]);
  await eraser.expire(); await eraser.refreshPending(); await eraseAll(eraser); expect(await store.exists(a.key)).toBe(false);
});
it('adopts legacy input, output, QC and interrupted manifest locators before deleting a delivered product', async () => {
  const f = await orderFixture(db); const p = f.principal;
  const productId = (await db.pool.query('SELECT v.product_id FROM orders o JOIN quotes q ON q.id=o.quote_id JOIN plan_versions v ON v.id=q.plan_id WHERE o.id=$1', [f.orderId])).rows[0].product_id;
  await db.pool.query("UPDATE orders SET fulfillment_state='DELIVERED',data=data||'{\"fulfillment_state\":\"DELIVERED\"}'::jsonb WHERE id=$1", [f.orderId]);
  const stage = await enqueueStage(db.pool, { tenantId: p.tenantId, scopeType: 'ORDER', scopeId: f.orderId, name: 'QC', inputHash: 'a'.repeat(64), deadlineAt: addSeconds(300) });
  const keys = ['input.png','output.png','review.png','manifest.json'].map(name => `${p.tenantId}/legacy/${id('group')}/${name}`);
  for (const key of keys) await store.put(key, Buffer.from(`legacy:${key}`), 'application/octet-stream');
  const asset = id('asset'); const artifact = id('artifact'); const packet = id('packet');
  await insert(db.pool, 'assets', { id: asset, tenant_id: p.tenantId, owner_id: p.userId, product_id: productId, purpose: 'PRODUCT_PHOTO', state: 'READY', object_key: keys[0],
    upload_token_hash: sha256('synthetic-legacy-token'), expected_bytes: 100, declared_mime: 'image/png', sha256: sha256(`legacy:${keys[0]}`), expires_at: addSeconds(3600), grant_expires_at: addSeconds(900) });
  await insert(db.pool, 'artifacts', { id: artifact, tenant_id: p.tenantId, order_id: f.orderId, stage_run_id: stage, slot_id: 'image', object_key: keys[1], sha256: sha256(`legacy:${keys[1]}`), spec_json: {}, data: {}, expires_at: addSeconds(3600) });
  await insert(db.pool, 'review_packets', { id: packet, tenant_id: p.tenantId, order_id: f.orderId, snapshot_hash: 'a'.repeat(64), output_set_hash: 'b'.repeat(64), packet_hash: 'c'.repeat(64), state: 'SEALED', data: {} });
  await insert(db.pool, 'review_evidence', { id: id('evidence'), tenant_id: p.tenantId, packet_id: packet, order_id: f.orderId, kind: 'CANDIDATE_IMAGE', artifact_id: artifact,
    object_key: keys[2], sha256: sha256(`legacy:${keys[2]}`), mime_type: 'image/png', data: {} });
  await insert(db.pool, 'media_operations', { id: id('media'), tenant_id: p.tenantId, order_id: f.orderId, stage_run_id: stage, phase: 'POST', input_hash: 'd'.repeat(64), state: 'PREPARING', manifest_key: keys[3] });
  const cacheKey = id('idempotency'); await transaction(db.pool, c => idempotent(c, p, 'completeAssetUpload', asset, cacheKey, {}, async () => ({ asset_id: asset, product_id: productId })));
  const deletion = await transaction(db.pool, c => requestDeletion(c, p, { scope: 'PRODUCT', product_id: productId, acknowledge_inflight_contract: true }));
  await expect(transaction(db.pool, c => idempotent(c, p, 'completeAssetUpload', asset, cacheKey, {}, async () => ({})))).rejects.toMatchObject({ code: 'MEDIA_REVOKED' });
  const eraser = new MediaErasureService(db.pool, store, id('eraser')); await eraser.refreshDeletion(p.tenantId, deletion.deletion_id); await eraseAll(eraser);
  expect(await Promise.all(keys.map(key => store.exists(key)))).toEqual([false,false,false,false]);
  expect((await db.pool.query('SELECT state FROM private_object_writes WHERE object_key=ANY($1::text[])', [keys])).rows).toHaveLength(4);
  expect((await db.pool.query('SELECT payment_state,fulfillment_state FROM orders WHERE id=$1', [f.orderId])).rows[0]).toEqual({ payment_state: 'CONFIRMED', fulfillment_state: 'DELIVERED' });
  expect((await db.pool.query('SELECT count(*) AS n FROM refunds WHERE order_id=$1', [f.orderId])).rows[0].n).toBe('0');
});
it('refuses a junction in the object path and leaves its target intact', async () => {
  const outside = join(root, id('unrelated')); await mkdir(outside); await writeFile(join(outside, 'photo.png'), 'keep');
  const tenant = id('tenant'); const link = join(root, 'objects', tenant); await mkdir(dirname(link), { recursive: true }); await symlink(outside, link, 'junction');
  try { await expect(store.erase(`${tenant}/photo.png`)).rejects.toMatchObject({ code: 'STORAGE_PATH_REPARSE' }); expect(await readFile(join(outside, 'photo.png'), 'utf8')).toBe('keep'); }
  finally { await rmdir(link); }
});
