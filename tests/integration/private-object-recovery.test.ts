import { beforeAll, afterAll, it, expect } from 'vitest';
import { mkdir, rm } from 'node:fs/promises';
import { testDatabase, account, type TestDatabase } from '../helpers/database.js';
import { createProduct } from '../../src/api/modules/products.js';
import { requestDeletion } from '../../src/api/modules/support.js';
import { transaction } from '../../src/api/db/pool.js';
import { inside } from '../../src/api/config.js';
import { id } from '../../src/api/lib/crypto.js';
import { LocalStorage, type ObjectStorage } from '../../src/api/storage/storage.js';
import { writePrivateObject, reconcileUncertainObjectWrites } from '../../src/api/storage/private-objects.js';
import { MediaErasureService } from '../../src/worker/lifecycle/media-erasure.js';

let db: TestDatabase; let store: LocalStorage; let root: string;
beforeAll(async () => {
  db = await testDatabase(); root = inside(db.cfg.runtimeRoot, `tests/write-recovery/${id('case')}`);
  await mkdir(root, { recursive: true }); store = new LocalStorage({ ...db.cfg, runtimeRoot: root });
});
afterAll(async () => { await db?.close(); if (root) await rm(inside(db.cfg.runtimeRoot, root), { recursive: true, force: true }); });
async function fixture() {
  const { principal: p } = await account(db); const product = await createProduct(db.pool, p);
  return { p, product, key: `${p.tenantId}/input/${id('photo')}.png`, scope: { tenantId: p.tenantId, ownerId: p.userId, productId: product.product_id, kind: 'INPUT' as const } };
}
const port = (put: ObjectStorage['put']): ObjectStorage => ({ put, get: store.get.bind(store), exists: store.exists.bind(store), delete: store.delete.bind(store) });
it('treats a durable identical write as idempotent and never issues a second potentially late PUT', async () => {
  const f = await fixture(); let puts = 0;
  const adapter = port(async (...args) => { puts++; await store.put(...args); });
  await writePrivateObject(db.pool, adapter, f.scope, f.key, Buffer.from('synthetic'), 'image/png');
  await writePrivateObject(db.pool, adapter, f.scope, f.key, Buffer.from('synthetic'), 'image/png');
  expect(puts).toBe(1);
  await expect(writePrivateObject(db.pool, adapter, f.scope, f.key, Buffer.from('changed'), 'image/png')).rejects.toMatchObject({ code: 'PRIVATE_OBJECT_CHANGED' });
});
it('recovers a verified original UNKNOWN publication after revocation, then permanently erases it without another PUT', async () => {
  const f = await fixture(); let puts = 0;
  const adapter = port(async (...args) => { puts++; await store.put(...args); throw new Error('synthetic crash after original publication'); });
  await expect(writePrivateObject(db.pool, adapter, f.scope, f.key, Buffer.from('original'), 'image/png')).rejects.toThrow('original publication');
  await transaction(db.pool, c => requestDeletion(c, f.p, { scope: 'PRODUCT', product_id: f.product.product_id, acknowledge_inflight_contract: true }));
  expect(await reconcileUncertainObjectWrites(db.pool, store)).toEqual({ recovered: 1, blocked: 0 });
  const service = new MediaErasureService(db.pool, store, id('eraser'));
  expect(await service.eraseOne(new AbortController().signal)).toBe(true); expect(await store.exists(f.key)).toBe(false);
  expect(puts).toBe(1);
  expect((await db.pool.query('SELECT state,delete_requested FROM private_object_writes WHERE object_key=$1', [f.key])).rows[0]).toEqual({ state: 'DELETED', delete_requested: true });
});
it('retains unknown missing or mismatched writes and never races a live WRITING call', async () => {
  const missing = await fixture(); const corrupt = await fixture(); const live = await fixture();
  for (const f of [missing, corrupt]) await expect(writePrivateObject(db.pool, port(async () => { throw new Error('synthetic uncertain write'); }), f.scope, f.key, Buffer.from('original'), 'image/png')).rejects.toThrow();
  await store.put(corrupt.key, Buffer.from('corrupt'), 'image/png');
  let entered!: () => void; let release!: () => void; const began = new Promise<void>(r => { entered = r; }); const gate = new Promise<void>(r => { release = r; });
  const writing = writePrivateObject(db.pool, port(async (...args) => { entered(); await gate; await store.put(...args); }), live.scope, live.key, Buffer.from('original'), 'image/png');
  await began;
  try {
    expect(await reconcileUncertainObjectWrites(db.pool, store)).toEqual({ recovered: 0, blocked: 2 });
    expect((await db.pool.query('SELECT state FROM private_object_writes WHERE object_key=$1', [live.key])).rows[0].state).toBe('WRITING');
    for (const f of [missing, corrupt]) expect((await db.pool.query('SELECT state FROM private_object_writes WHERE object_key=$1', [f.key])).rows[0].state).toBe('UNKNOWN');
  } finally { release(); await writing; }
});
