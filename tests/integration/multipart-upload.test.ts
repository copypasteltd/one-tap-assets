import { beforeAll, afterAll, it, expect } from 'vitest';
import { rm } from 'node:fs/promises';
import sharp from 'sharp';
import { testDatabase, account, type TestDatabase } from '../helpers/database';
import { buildApp } from '../../src/api/app';
import { config, inside } from '../../src/api/config';
import { LocalStorage } from '../../src/api/storage/storage';
import { createProduct } from '../../src/api/modules/products';
import { createUploadGrant } from '../../src/api/modules/assets';
import { id, sha256 } from '../../src/api/lib/crypto';
let db: TestDatabase; const folders: string[] = [];
beforeAll(async () => { db = await testDatabase(); });
afterAll(async () => { await db?.close(); for (const folder of folders) await rm(folder, { recursive: true, force: true }); });
async function fixture() {
  const { principal } = await account(db); const folder = inside(db.cfg.runtimeRoot, `tests/multipart/${id('case')}`); folders.push(folder);
  const cfg = config({ ...db.cfg, runtimeRoot: folder }); const store = new LocalStorage(cfg); const app = await buildApp({ cfg, pool: db.pool, storage: store, tls: false });
  const product = await createProduct(db.pool, principal); const bytes = await sharp({ create: { width: 640, height: 800, channels: 3, background: '#587ba0' } }).jpeg().toBuffer();
  const grant = await createUploadGrant(db.pool, cfg, principal, { product_id: product.product_id, purpose: 'PRODUCT_PHOTO', file_name: 'original.jpg', mime_type: 'image/jpeg', size_bytes: bytes.length, sha256: sha256(bytes) });
  const boundary = 'ypcc-multipart-fixture';
  const file = (data: Buffer, name = 'file') => Buffer.concat([Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"; filename="../../ignored-name.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`), data, Buffer.from('\r\n')]);
  const send = (parts: Buffer[], token = grant.headers['x-upload-token']) => app.inject({ method: 'POST', url: new URL(grant.upload_url).pathname,
    headers: { 'x-upload-token': token!, 'content-type': `multipart/form-data; boundary=${boundary}` }, payload: Buffer.concat([...parts, Buffer.from(`--${boundary}--\r\n`)]) });
  return { app, store, grant, bytes, boundary, file, send };
}
it('accepts one native multipart photo, ignores its filename and normalizes the actual bytes into private storage', async () => {
  const f = await fixture();
  try {
    expect(f.grant.method).toBe('POST'); expect((await f.send([f.file(f.bytes)])).statusCode).toBe(204);
    const row = (await db.pool.query('SELECT state,object_key,raw_sha256 FROM assets WHERE id=$1', [f.grant.asset_id])).rows[0];
    expect(row.state).toBe('VERIFYING'); expect(row.raw_sha256).toBe(sha256(f.bytes)); expect(row.object_key).not.toContain('ignored-name');
    expect((await sharp(await f.store.get(row.object_key, 10000000)).metadata()).format).toBe('png');
  } finally { await f.app.close(); }
});
it('rejects extra fields and multiple files before committing any object or changing asset state', async () => {
  const f = await fixture();
  try {
    const field = Buffer.from(`--${f.boundary}\r\nContent-Disposition: form-data; name="extra"\r\n\r\nnot-allowed\r\n`);
    expect((await f.send([field, f.file(f.bytes)])).statusCode).toBe(413);
    expect((await f.send([f.file(f.bytes), f.file(f.bytes)])).statusCode).toBe(413);
    expect((await db.pool.query('SELECT state FROM assets WHERE id=$1', [f.grant.asset_id])).rows[0].state).toBe('UPLOADING');
  } finally { await f.app.close(); }
});
it('enforces file/aggregate bounds and authorizes before consuming an upload', async () => {
  const f = await fixture();
  try {
    expect((await f.send([f.file(Buffer.alloc(10000001))])).statusCode).toBe(413);
    expect((await f.send([f.file(f.bytes)], 'invalid-upload-token')).statusCode).toBe(401);
    expect((await db.pool.query('SELECT state FROM assets WHERE id=$1', [f.grant.asset_id])).rows[0].state).toBe('UPLOADING');
  } finally { await f.app.close(); }
});
