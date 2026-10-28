import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { testDatabase, account, type TestDatabase } from '../helpers/database.js';
import { rawProfile } from '../helpers/fixtures.js';
import { config, inside } from '../../src/api/config.js';
import { id, sha256, addSeconds } from '../../src/api/lib/crypto.js';
import { AppError } from '../../src/api/lib/errors.js';
import { validate } from '../../src/api/lib/validation.js';
import type { Principal } from '../../src/shared/contracts/types.js';
import { createProduct, bindPhotos, createAnalysis } from '../../src/api/modules/products.js';
import { createUploadGrant, uploadAsset, completeAsset } from '../../src/api/modules/assets.js';
import { LocalStorage } from '../../src/api/storage/storage.js';
import { WorkerRuntime } from '../../src/worker/runtime.js';
import { VisionAnalysisService } from '../../src/worker/analysis/service.js';
import { VisionClient, type VisionTransport, type VisionWireContract } from '../../src/worker/providers/vision.js';
import { transaction } from '../../src/api/db/pool.js';
import { reservePlatform, settlePlatform } from '../../src/worker/budget/platform.js';

let db: TestDatabase; const roots: string[] = [];
beforeAll(async () => { db = await testDatabase(); });
afterAll(async () => { await db?.close(); for (const root of roots) await rm(inside(db.cfg.runtimeRoot, root), { recursive: true, force: true }); });
async function fixture() {
  const root = inside(db.cfg.runtimeRoot, `tests/vision/${id('case')}`); roots.push(root); await mkdir(root, { recursive: true });
  const path = join(root, 'synthetic-vision-contract.json');
  const contract: VisionWireContract = { schema_version: '1.0.0', state: 'ADMITTED', wire: 'OPENAI_CHAT_COMPLETIONS', provider: 'synthetic-test-transport', actual_model: 'synthetic-model-fixed',
    base_url: 'https://vision.example.test/v1', registry_version: 'synthetic-registry-1', rate_version: 'synthetic-rate-1', official_documentation: 'https://developers.openai.com/api/docs/guides/images-vision',
    capability_evidence_sha256: 'a'.repeat(64), valid_until: addSeconds(3600), max_images: 5, max_image_edge: 1536,
    max_total_pixels: 11796480, max_request_bytes: 16000000, max_output_tokens: 6000, certified_max_input_tokens: 16000,
    input_micro_per_million: 1000, output_micro_per_million: 2000, per_request_ceiling_micro: 100, no_charge_http_statuses: [] };
  await writeFile(path, JSON.stringify(contract));
  const cfg = config({ ...db.cfg, generationEnabled: true, runtimeRoot: root, provider: { ...db.cfg.provider, apiKey: 'synthetic-not-a-real-key',
    baseUrl: contract.base_url, allowedHosts: ['vision.example.test'], visionModel: contract.actual_model, rateVersion: contract.registry_version,
    visionContractPath: path, visionDailyBudgetMicro: 400 } });
  const store = new LocalStorage(cfg); const { principal: p } = await account(db); const product = await createProduct(db.pool, p); const assetIds: string[] = [];
  for (let i = 0; i < 3; i++) {
    const bytes = await sharp({ create: { width: 640, height: 800, channels: 3, background: { r: 20 + i, g: 80, b: 180 } } }).jpeg().toBuffer();
    const grant = await createUploadGrant(db.pool, cfg, p, { purpose: 'PRODUCT_PHOTO', product_id: product.product_id, file_name: `synthetic-${i}.jpg`, mime_type: 'image/jpeg', size_bytes: bytes.length, sha256: sha256(bytes) });
    await uploadAsset(db.pool, store, grant.asset_id, grant.headers['x-upload-token']!, bytes);
    await completeAsset(db.pool, p, grant.asset_id, { sha256: sha256(bytes) }); assetIds.push(grant.asset_id);
  }
  await transaction(db.pool, c => bindPhotos(c, p, product.product_id, { asset_ids: assetIds, expected_revision: 0 }));
  const analysis = await transaction(db.pool, c => createAnalysis(c, cfg, p, product.product_id, { photo_version: 1 }));
  return { cfg, store, contract, p, product, assetIds, analysis };
}
function response(assetIds: string[], model: string, change?: (body: Record<string, unknown>) => void) {
  const profile = rawProfile(); const remap = new Map([['asset-a', assetIds[0]!], ['asset-b', assetIds[1]!], ['asset-c', assetIds[2]!]]);
  profile.photo_roles.forEach(r => { r.asset_id = remap.get(r.asset_id)!; }); profile.evidence.forEach(e => { e.asset_id = remap.get(e.asset_id)!; });
  [...profile.observations, ...profile.label_texts].forEach(o => { o.source_asset_ids = o.source_asset_ids.map(a => remap.get(a)!); });
  const serverFields = new Set(['schema_version', 'profile_id', 'product_id', 'photo_version', 'identity_lock_id', 'profile_hash', 'revision']);
  const wire = Object.fromEntries(Object.entries(profile).filter(([key]) => !serverFields.has(key)));
  const body: Record<string, unknown> = { model, choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(wire), refusal: null } }], usage: { prompt_tokens: 100, completion_tokens: 100 } };
  change?.(body); const bytes = Buffer.from(JSON.stringify(body)); return { status: 200, bytes, headers: {}, json: () => body };
}
async function process(f: Awaited<ReturnType<typeof fixture>>, transport: VisionTransport) {
  const service = new VisionAnalysisService(db.pool, f.cfg, f.store, new VisionClient(f.cfg, transport));
  const runtime = new WorkerRuntime({ pool: db.pool, workerId: id('worker'), stages: { ANALYZE: (lease, signal) => service.handle(lease, signal) }, events: {} });
  await runtime.processStage(new AbortController().signal); return runtime;
}
async function stopFixture(analysisId: string): Promise<void> {
  await db.pool.query("UPDATE stage_runs SET state='CANCELLED' WHERE scope_id=$1 AND state NOT IN ('SUCCEEDED','FAILED')", [analysisId]);
}
describe('actual photo preparation and durable vision with explicit synthetic external transport', () => {
  it('settles the original stored receipt after cancellation with generation disabled, without publishing a profile', async () => {
    const f = await fixture(); let calls = 0;
    await db.pool.query(`CREATE FUNCTION fixture_reject_vision_settlement() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'synthetic vision settlement crash'; END $$;
      CREATE TRIGGER fixture_reject_vision_settlement BEFORE UPDATE ON provider_submissions
      FOR EACH ROW WHEN (NEW.state='SUCCEEDED') EXECUTE FUNCTION fixture_reject_vision_settlement()`);
    try { await process(f, async () => { calls++; return response(f.assetIds, f.contract.actual_model); }); }
    finally { await db.pool.query('DROP TRIGGER fixture_reject_vision_settlement ON provider_submissions; DROP FUNCTION fixture_reject_vision_settlement()'); }
    await stopFixture(f.analysis.analysis_id);
    await db.pool.query('UPDATE product_drafts SET deleted_at=now() WHERE id=$1', [f.product.product_id]);
    const cfg = { ...f.cfg, generationEnabled: false, provider: { ...f.cfg.provider, apiKey: '', visionModel: 'changed-current-model' } };
    const maintenance = new VisionAnalysisService(db.pool, cfg, f.store, new VisionClient(cfg, async () => { throw new Error('Maintenance must not purchase vision'); }));
    expect(await maintenance.reconcileReceipts()).toEqual({ settled: 1, blocked: 0 });
    expect(await maintenance.reconcileReceipts()).toEqual({ settled: 0, blocked: 0 });
    expect(calls).toBe(1);
    expect((await db.pool.query('SELECT state,private FROM provider_submissions WHERE tenant_id=$1', [f.p.tenantId])).rows[0]).toMatchObject({ state: 'SUCCEEDED', private: { billing_valid: true } });
    expect((await db.pool.query('SELECT reserved_micro,spent_micro FROM platform_cost_accounts WHERE tenant_id=$1', [f.p.tenantId])).rows[0]).toEqual({ reserved_micro: '0', spent_micro: '1' });
    expect((await db.pool.query('SELECT id FROM profile_versions WHERE product_id=$1', [f.product.product_id])).rowCount).toBe(0);
  });
  it('sends real image bytes after reservation and persists a scope-bound evidence profile and identity lock', async () => {
    const f = await fixture(); let calls = 0;
    await process(f, async (_url, _hosts, options) => {
      calls++; const request = JSON.parse(String(options?.body));
      const content = request.messages[1].content as { type: string; image_url?: { url: string } }[];
      const images = content.filter(c => c.type === 'image_url'); expect(images).toHaveLength(3);
      expect(images.every(i => i.image_url?.url.startsWith('data:image/jpeg;base64,'))).toBe(true);
      expect(request.model).toBe(f.contract.actual_model); expect(request.store).toBe(false);
      const requestId = options?.headers?.['X-Client-Request-Id'];
      expect((await db.pool.query('SELECT state,reservation_id FROM provider_submissions WHERE id=$1', [requestId])).rows[0]).toMatchObject({ state: 'SUBMITTING' });
      expect((await db.pool.query('SELECT reserved_micro FROM platform_cost_accounts WHERE tenant_id=$1', [f.p.tenantId])).rows[0].reserved_micro).toBe('100');
      return response(f.assetIds, f.contract.actual_model);
    });
    expect(calls).toBe(1);
    const analysis = (await db.pool.query('SELECT state,data FROM analysis_jobs WHERE id=$1', [f.analysis.analysis_id])).rows[0]; expect(analysis.state).toBe('SUCCEEDED');
    expect(validate('Analysis', analysis.data, true).state).toBe('READY');
    const profile = (await db.pool.query('SELECT owner_id,data FROM profile_versions WHERE id=$1', [analysis.data.profile_id])).rows[0];
    expect(profile.owner_id).toBe(f.p.userId); expect(profile.data.product_id).toBe(f.product.product_id); expect(profile.data.unknowns).toContain('容量');
    expect(new Set(profile.data.photo_roles.map((r: { asset_id: string }) => r.asset_id))).toEqual(new Set(f.assetIds));
    expect((await db.pool.query('SELECT id FROM identity_locks WHERE profile_id=$1', [profile.data.profile_id])).rowCount).toBe(1);
    expect((await db.pool.query('SELECT reserved_micro,spent_micro FROM platform_cost_accounts WHERE tenant_id=$1', [f.p.tenantId])).rows[0]).toEqual({ reserved_micro: '0', spent_micro: '1' });
  });
  it('projects a known need for more photos into the public BLOCKED state without inventing a profile', async () => {
    const f = await fixture();
    await process(f, async () => response(f.assetIds, f.contract.actual_model, body => {
      const choices = body.choices as { message: { content: string } }[];
      const content = JSON.parse(choices[0]!.message.content) as { photo_roles: { role: string }[] };
      for (const role of content.photo_roles) if (role.role === 'WHOLE') role.role = 'OTHER';
      choices[0]!.message.content = JSON.stringify(content);
    }));
    const row = (await db.pool.query('SELECT state,data FROM analysis_jobs WHERE id=$1', [f.analysis.analysis_id])).rows[0];
    expect(row.state).toBe('NEEDS_PHOTOS'); expect(validate('Analysis', row.data, true).state).toBe('BLOCKED'); expect(row.data.profile_id).toBeNull();
    expect((await db.pool.query('SELECT id FROM profile_versions WHERE product_id=$1', [f.product.product_id])).rows).toHaveLength(0);
  });
  it('never resubmits an unknown non-queryable request after a worker restart', async () => {
    const f = await fixture(); let calls = 0;
    const transport: VisionTransport = async () => { calls++; throw new AppError('REMOTE_UNKNOWN', 'synthetic disconnect', 503, true); };
    try {
      await process(f, transport);
      await db.pool.query('UPDATE stage_runs SET available_at=now() WHERE scope_id=$1', [f.analysis.analysis_id]);
      await process(f, transport); expect(calls).toBe(1);
      expect((await db.pool.query('SELECT state FROM platform_budget_reservations WHERE tenant_id=$1', [f.p.tenantId])).rows[0].state).toBe('UNKNOWN');
      expect((await db.pool.query('SELECT id FROM profile_versions WHERE product_id=$1', [f.product.product_id])).rows).toHaveLength(0);
    } finally { await stopFixture(f.analysis.analysis_id); }
  });
  it('permits only one paid retry for a completed response whose content fails validation', async () => {
    const f = await fixture(); let calls = 0;
    await process(f, async () => { calls++; return response(f.assetIds, f.contract.actual_model, calls === 1 ? body => { body.choices = [{ finish_reason: 'stop', message: { content: '{"invented":true}' } }]; } : undefined); });
    expect(calls).toBe(2);
    expect((await db.pool.query('SELECT state FROM analysis_jobs WHERE id=$1', [f.analysis.analysis_id])).rows[0].state).toBe('SUCCEEDED');
    expect((await db.pool.query('SELECT id FROM provider_submissions WHERE tenant_id=$1', [f.p.tenantId])).rows).toHaveLength(2);
    expect((await db.pool.query('SELECT reserved_micro,spent_micro FROM platform_cost_accounts WHERE tenant_id=$1', [f.p.tenantId])).rows[0]).toEqual({ reserved_micro: '0', spent_micro: '2' });
  });
  it('keeps a paid receipt but rejects profile commit if the user changed photos during inference', async () => {
    const f = await fixture();
    await process(f, async () => {
      await db.pool.query('UPDATE product_drafts SET current_photo_version=2 WHERE id=$1', [f.product.product_id]);
      return response(f.assetIds, f.contract.actual_model);
    });
    expect((await db.pool.query('SELECT state FROM analysis_jobs WHERE id=$1', [f.analysis.analysis_id])).rows[0].state).toBe('FAILED');
    expect((await db.pool.query('SELECT id FROM profile_versions WHERE product_id=$1', [f.product.product_id])).rows).toHaveLength(0);
    expect((await db.pool.query('SELECT state FROM platform_budget_reservations WHERE tenant_id=$1', [f.p.tenantId])).rows[0].state).toBe('SETTLED');
  });
  it('holds unknown cost and flags the contract when usage exceeds its certified bound', async () => {
    const f = await fixture(); let calls = 0;
    await process(f, async () => { calls++; return response(f.assetIds, f.contract.actual_model, body => { body.usage = { prompt_tokens: 16001, completion_tokens: 100 }; }); });
    expect(calls).toBe(1);
    expect((await db.pool.query('SELECT state FROM analysis_jobs WHERE id=$1', [f.analysis.analysis_id])).rows[0].state).toBe('FAILED');
    expect((await db.pool.query('SELECT state FROM platform_budget_reservations WHERE tenant_id=$1', [f.p.tenantId])).rows[0].state).toBe('UNKNOWN');
    expect((await db.pool.query('SELECT private FROM provider_submissions WHERE tenant_id=$1', [f.p.tenantId])).rows[0].private.contract_violation).toBe(true);
  });
});

describe('platform cost isolation', () => {
  it('bounds concurrent pre-quote spend independently of any paid order', async () => {
    const { principal: p } = await account(db);
    const scope = { tenantId: p.tenantId, ownerId: p.userId, category: 'VISION', dailyCeilingMicro: 50 };
    const attempts = await Promise.allSettled(Array.from({ length: 9 }, (_, i) => transaction(db.pool, c => reservePlatform(c, scope, `synthetic-platform:${p.tenantId}:${i}`, 10, { synthetic: true }))));
    const wins = attempts.filter((r): r is PromiseFulfilledResult<string> => r.status === 'fulfilled'); expect(wins).toHaveLength(5);
    await transaction(db.pool, c => settlePlatform(c, p.tenantId, wins[0]!.value, null));
    expect((await db.pool.query('SELECT reserved_micro FROM platform_cost_accounts WHERE tenant_id=$1', [p.tenantId])).rows[0].reserved_micro).toBe('50');
    await transaction(db.pool, c => settlePlatform(c, p.tenantId, wins[0]!.value, 3));
    expect((await db.pool.query('SELECT spent_micro,reserved_micro FROM platform_cost_accounts WHERE tenant_id=$1', [p.tenantId])).rows[0]).toEqual({ spent_micro: '3', reserved_micro: '40' });
  });
});
