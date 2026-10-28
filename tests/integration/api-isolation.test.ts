import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import type { FastifyInstance } from 'fastify';
import sharp from 'sharp';
import { buildApp } from '../../src/api/app.js';
import { testDatabase, account, orderFixture, type TestDatabase } from '../helpers/database.js';
import { storage } from '../../src/api/storage/storage.js';
import type { DTO } from '../../src/shared/contracts/types.js';
import { sha256, id, addSeconds } from '../../src/api/lib/crypto.js';
import { insert } from '../../src/api/db/store.js';
import { enqueueStage } from '../../src/worker/queue/enqueue.js';
import { claimStage, completeStage } from '../../src/worker/queue/leases.js';
let db: TestDatabase; let app: FastifyInstance;
let lastError: unknown;
const bearer = (key: string, idem?: string): Record<string, string> => ({ authorization: `Bearer ${key}`, ...(idem ? { 'idempotency-key': idem } : {}) });
beforeAll(async () => { db = await testDatabase(); app = await buildApp({ cfg: db.cfg, pool: db.pool, tls: false, testErrorObserver: error => { lastError = error; } }); await app.ready(); });
afterAll(async () => { await app?.close(); await db?.close(); });
describe('API authentication, upload and server-side isolation', () => {
  it('boots the actual routes and serves exactly ten official presets with fourteen variants', async () => {
    expect((await app.inject({ method: 'GET', url: '/healthz' })).statusCode).toBe(200);
    const response = await app.inject({ method: 'GET', url: '/v1/p01/presets' }); expect(response.statusCode).toBe(200);
    const list = response.json<{ data: DTO<'PresetSummaryList'> }>().data; expect(list.items).toHaveLength(10); expect(list.items.every(p => !p.sale_enabled)).toBe(true);
    let variants = 0;
    for (const item of list.items) {
      const detail = await app.inject({ method: 'GET', url: `/v1/p01/presets/${item.preset_id}/versions/${item.version}` });
      expect(detail.statusCode).toBe(200); variants += detail.json<{ data: DTO<'PresetDetail'> }>().data.variants.length;
    }
    expect(variants).toBe(14);
  });
  it('requires sessions and denies other tenants without revealing existence', async () => {
    expect((await app.inject({ method: 'POST', url: '/v1/p01/products', payload: {}, headers: { 'idempotency-key': 'request-unauthenticated' } })).statusCode).toBe(401);
    const a = await account(db); const b = await account(db);
    const created = await app.inject({ method: 'POST', url: '/v1/p01/products', payload: {}, headers: bearer(a.accessToken, 'create-product-0001') }); expect(created.statusCode).toBe(201);
    const product = created.json<{ data: DTO<'Product'> }>().data;
    expect((await app.inject({ method: 'GET', url: `/v1/p01/products/${product.product_id}`, headers: bearer(a.accessToken) })).statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: `/v1/p01/products/${product.product_id}`, headers: bearer(b.accessToken) })).statusCode).toBe(404);
    const fakeSession = await app.inject({ method: 'POST', url: '/v1/p01/products', payload: {}, headers: bearer('not-a-session', 'request-invalid-token') }); expect(fakeSession.statusCode).toBe(401);
  });
  it('uploads actual images, strips EXIF, binds immutable versions and blocks fabricated recognition', async () => {
    const a = await account(db);
    const created = await app.inject({ method: 'POST', url: '/v1/p01/products', payload: {}, headers: bearer(a.accessToken, 'photo-product-0001') });
    const product = created.json<{ data: DTO<'Product'> }>().data; const assetIds: string[] = []; const keys: string[] = [];
    try {
      for (const [i, background] of ['#226699', '#4488AA', '#3377BB'].entries()) {
        const bytes = await sharp({ create: { width: 800, height: 640, channels: 3, background } }).withMetadata({ orientation: 6 }).jpeg().toBuffer();
        const rawHash = sha256(bytes);
        const grantResponse = await app.inject({ method: 'POST', url: '/v1/p01/assets', payload: { purpose: 'PRODUCT_PHOTO', product_id: product.product_id, file_name: `商品${i}.jpg`, mime_type: 'image/jpeg', size_bytes: bytes.length, sha256: rawHash }, headers: bearer(a.accessToken, `photo-grant-${i}-0001`) });
        expect(grantResponse.statusCode, String(lastError)).toBe(201); const grant = grantResponse.json<{ data: DTO<'UploadGrant'> }>().data;
        const rawUpload = await app.inject({ method: 'PUT', url: new URL(grant.upload_url).pathname, headers: { ...grant.headers, 'content-type': 'application/octet-stream' }, payload: bytes }); expect(rawUpload.statusCode).toBe(204);
        const complete = await app.inject({ method: 'POST', url: `/v1/p01/assets/${grant.asset_id}/complete`, payload: { sha256: rawHash }, headers: bearer(a.accessToken, `photo-complete-${i}-0001`) }); expect(complete.statusCode, String(lastError)).toBe(200);
        const asset = complete.json<{ data: DTO<'Asset'> }>().data; expect(asset).toMatchObject({ state: 'READY', width: 640, height: 800, mime_type: 'image/png' }); expect(asset.sha256).not.toBe(rawHash);
        const row = (await db.pool.query<{ object_key: string }>('SELECT object_key FROM assets WHERE id=$1', [asset.asset_id])).rows[0]!; keys.push(row.object_key);
        expect((await sharp(await storage(db.cfg).get(row.object_key)).metadata()).exif).toBeUndefined(); assetIds.push(asset.asset_id);
      }
      const bound = await app.inject({ method: 'PUT', url: `/v1/p01/products/${product.product_id}/photos`, payload: { asset_ids: assetIds, expected_revision: 0 }, headers: bearer(a.accessToken, 'bind-photos-0001') }); expect(bound.statusCode, String(lastError)).toBe(200);
      expect(bound.json<{ data: DTO<'Product'> }>().data).toMatchObject({ photo_version: 1, revision: 1, profile_id: null });
      const stale = await app.inject({ method: 'PUT', url: `/v1/p01/products/${product.product_id}/photos`, payload: { asset_ids: assetIds, expected_revision: 0 }, headers: bearer(a.accessToken, 'bind-photos-stale-0001') }); expect(stale.statusCode).toBe(409);
      const analysis = await app.inject({ method: 'POST', url: `/v1/p01/products/${product.product_id}/analyses`, payload: { photo_version: 1 }, headers: bearer(a.accessToken, 'analysis-disabled-0001') }); expect(analysis.statusCode).toBe(503); expect(analysis.json().code).toBe('VISION_NOT_CONFIGURED');
      expect((await db.pool.query('SELECT count(*) AS n FROM profile_versions WHERE product_id=$1', [product.product_id])).rows[0].n).toBe('0');
    } finally { for (const key of keys) await storage(db.cfg).delete(key); }
  });
  it('requires independent management authentication', async () => {
    const a = await account(db);
    const response = await app.inject({ method: 'GET', url: '/v1/internal/p01/agent-instances', headers: bearer(a.accessToken) }); expect([401, 403, 404]).toContain(response.statusCode);
    const tool = await app.inject({ method: 'GET', url: '/v1/internal/p01/agent-tools', headers: bearer(a.accessToken) }); expect(tool.statusCode).toBe(401);
  });
  it('binds tool calls to an active role and rejects their capability after stage takeover', async () => {
    const a = await orderFixture(db); const stageId = await enqueueStage(db.pool, { tenantId: a.principal.tenantId, scopeType: 'ORDER', scopeId: a.orderId, name: 'REVIEW_FACTS', inputHash: 'a'.repeat(64), deadlineAt: addSeconds(300) });
    const lease = (await claimStage(db.pool, 'tool-test-worker'))!; expect(lease.id).toBe(stageId);
    const instanceId = id('instance'); const runId = id('run'); const capability = id('capability'); const capId = id('cap');
    await insert(db.pool, 'agent_instances', { id: instanceId, tenant_id: a.principal.tenantId, order_id: a.orderId, state: 'ACTIVE', workspace_ref: 'synthetic-workspace', lease_expires_at: addSeconds(120), data: {} });
    await insert(db.pool, 'agent_runs', { id: runId, tenant_id: a.principal.tenantId, instance_id: instanceId, role: 'REVIEW_FACTS', state: 'RUNNING', role_workspace_ref: 'synthetic-read-only-workspace', input_hash: 'a'.repeat(64), data: {}, private: { max_tool_calls: 2 } });
    await insert(db.pool, 'agent_capabilities', { id: capId, token_hash: sha256(capability), tenant_id: a.principal.tenantId, instance_id: instanceId, run_id: runId, stage_run_id: stageId,
      stage_fencing_token: lease.fencing_token, instance_fencing_token: 1, snapshot_hash: 'a'.repeat(64), packet_hash: 'b'.repeat(64), expires_at: addSeconds(120) });
    const rejected = await app.inject({ method: 'POST', url: '/v1/internal/p01/agent-tools/calls', headers: bearer(capability), payload: { tool: 'submit_video', arguments: { shot_id: 'shot-1' }, idempotency_key: 'tool-denied-0001' } }); expect(rejected.statusCode).toBe(403);
    const request = { tool: 'extract_review_evidence', arguments: { packet_hash: 'b'.repeat(64) }, idempotency_key: 'tool-evidence-0001' };
    const first = await app.inject({ method: 'POST', url: '/v1/internal/p01/agent-tools/calls', headers: bearer(capability), payload: request }); expect(first.statusCode).toBe(202);
    const replay = await app.inject({ method: 'POST', url: '/v1/internal/p01/agent-tools/calls', headers: bearer(capability), payload: request }); expect(replay.json().intent_id).toBe(first.json().intent_id);
    await completeStage(db.pool, lease, async () => {});
    const stale = await app.inject({ method: 'GET', url: '/v1/internal/p01/agent-tools', headers: bearer(capability) }); expect(stale.statusCode).toBe(401);
  });
});
