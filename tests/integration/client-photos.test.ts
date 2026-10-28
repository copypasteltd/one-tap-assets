import { beforeAll, afterAll, it, expect } from 'vitest';
import { rm } from 'node:fs/promises';
import sharp from 'sharp';
import { testDatabase, account, type TestDatabase } from '../helpers/database';
import { buildApp } from '../../src/api/app';
import { config, inside } from '../../src/api/config';
import { LocalStorage } from '../../src/api/storage/storage';
import { sha256, id } from '../../src/api/lib/crypto';
import { ClientSession } from '../../src/shared/client/session';
import { analyzePhotos } from '../../src/shared/client/photos';
import type { HostPort, LocalPhoto } from '../../src/shared/platform/ports';
let db: TestDatabase; let folder: string;
beforeAll(async () => { db = await testDatabase(); });
afterAll(async () => { await db?.close(); if (folder) await rm(folder, { recursive: true, force: true }); });
it('replays a real API photo batch after analysis is unavailable without duplicate drafts, uploads or versions', async () => {
  const user = await account(db); folder = inside(db.cfg.runtimeRoot, `tests/client-photos/${id('case')}`);
  const cfg = config({ ...db.cfg, runtimeRoot: folder }); const app = await buildApp({ cfg, pool: db.pool, storage: new LocalStorage(cfg), tls: false });
  let puts = 0; const records = new Map<string, unknown>();
  const host: HostPort = { platform: 'alipay', storage: { get: <T,>(key: string) => records.get(key) as T ?? null, set: (key, value) => { records.set(key, value); }, remove: key => { records.delete(key); } },
    transport: async request => { const result = await app.inject({ method: request.method as 'POST' | 'GET' | 'PUT', url: new URL(request.url).pathname, headers: request.headers, ...(typeof request.body === 'string' ? { payload: request.body } : {}) }); return { status: result.statusCode, data: result.json(), headers: {} }; },
    upload: async (grant, photo) => {
      puts++; expect(grant.method).toBe('POST'); const boundary = 'ypcc-client-photo-fixture';
      const payload = Buffer.concat([Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="fixture.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`), Buffer.from(photo.bytes), Buffer.from(`\r\n--${boundary}--\r\n`)]);
      const result = await app.inject({ method: 'POST', url: new URL(grant.upload_url).pathname, headers: { ...grant.headers, 'content-type': `multipart/form-data; boundary=${boundary}` }, payload }); expect(result.statusCode).toBe(204);
    },
    login: async () => { throw new Error('No real host login in this test'); }, choosePhotos: async () => [], pay: async () => 'UNKNOWN', download: async () => '', save: async () => 'UNKNOWN', copy: async () => {},
  };
  const session = new ClientSession(host, cfg.publicBaseUrl); session.attach({ access_token: user.accessToken, user_id: user.principal.userId, token_type: 'Bearer', expires_at: '2099-01-01T00:00:00Z' });
  const photos: LocalPhoto[] = [];
  for (let i = 0; i < 3; i++) { const bytes = await sharp({ create: { width: 640, height: 800, channels: 3, background: { r: i * 20, g: 70, b: 140 } } }).jpeg().toBuffer(); photos.push({ path: `fixture-${i}`, width: 640, height: 800, mime: 'image/jpeg', bytes: Uint8Array.from(bytes).buffer, sha256: sha256(bytes) }); }
  try {
    for (let i = 0; i < 2; i++) await expect(analyzePhotos(session, photos, 'original-photo-batch')).rejects.toMatchObject({ code: 'VISION_NOT_CONFIGURED' });
    expect(puts).toBe(3); expect(session.recover().productId).toBeTruthy(); expect(session.recover().analysisId).toBeUndefined();
    for (const [table, count] of [['product_drafts', 1], ['assets', 3], ['product_photo_versions', 1]] as const) expect((await db.pool.query(`SELECT count(*)::int AS count FROM ${table} WHERE tenant_id=$1`, [user.principal.tenantId])).rows[0].count).toBe(count);
  } finally { await app.close(); }
});
