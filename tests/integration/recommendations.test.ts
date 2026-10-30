import { beforeAll, afterAll, it, expect } from 'vitest';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { testDatabase, account, type TestDatabase } from '../helpers/database.js';
import { rawProfile } from '../helpers/fixtures.js';
import { syntheticAdmission, syntheticConfig } from '../helpers/codex.js';
import { createProduct } from '../../src/api/modules/products.js';
import { insert } from '../../src/api/db/store.js';
import { hash, id, addSeconds } from '../../src/api/lib/crypto.js';
import { normalizeVision } from '../../src/worker/analysis/profile.js';
import { recommendPresets } from '../../src/api/modules/recommendations.js';
import type { Principal, DTO } from '../../src/shared/contracts/types.js';
import type { Config } from '../../src/api/config.js';

let db: TestDatabase, cfg: Config, p: Principal, product: DTO<'Product'>;
const assetIds = ['asset-a', 'asset-b', 'asset-c'];
beforeAll(async () => {
  db = await testDatabase(); p = (await account(db)).principal; product = await createProduct(db.pool, p);
  const { profile, identityLock } = normalizeVision(rawProfile(), { tenantId: p.tenantId, productId: product.product_id, photoVersion: 1, revision: 1, assetIds });
  const photos = assetIds.map((asset_id, n) => ({ asset_id, sha256: String(n + 1).repeat(64) })), photoId = id('photos');
  for (const a of photos) await insert(db.pool, 'assets', { id: a.asset_id, tenant_id: p.tenantId, owner_id: p.userId, product_id: product.product_id, purpose: 'PRODUCT', state: 'READY', object_key: `synthetic/${a.asset_id}`, upload_token_hash: '0'.repeat(64), expected_bytes: 100, declared_mime: 'image/png', sha256: a.sha256, expires_at: addSeconds(3600), grant_expires_at: addSeconds(3600), data: {} });
  await insert(db.pool, 'product_photo_versions', { id: photoId, tenant_id: p.tenantId, product_id: product.product_id, revision: 1,
    photo_set_hash: hash({ photos, revision: 1, normalization: 'sharp-auto-orient-strip-png-v1' }), data: photos });
  for (const [position, assetId] of assetIds.entries()) await insert(db.pool, 'product_photo_items', { id: id('photo'), tenant_id: p.tenantId, photo_version_id: photoId, asset_id: assetId, position });
  await insert(db.pool, 'profile_versions', { id: profile.profile_id, tenant_id: p.tenantId, owner_id: p.userId, product_id: product.product_id, photo_version_id: photoId, revision: 1, profile_hash: profile.profile_hash, data: profile });
  await insert(db.pool, 'identity_locks', { id: identityLock.identity_lock_id, tenant_id: p.tenantId, profile_id: profile.profile_id, hash: identityLock.content_hash, data: identityLock });
  await db.pool.query(`UPDATE product_drafts SET current_profile_id=$1,current_photo_version=1,data=data||jsonb_build_object('profile_id',$1::text,'photo_version',1) WHERE id=$2`, [profile.profile_id, product.product_id]);
  const admission = syntheticAdmission(); cfg = { ...syntheticConfig(db.cfg, admission), paymentsEnabled: true, generationEnabled: false };
  const folder = resolve('runtime/test-results/recommendations', id('fixture')); await mkdir(folder, { recursive: true }); cfg.codex.admissionPath = resolve(folder, 'admission.json'); await writeFile(cfg.codex.admissionPath, JSON.stringify(admission));
  await insert(db.pool, 'provider_model_versions', { id: 'recommend-synthetic', provider: 'SYNTHETIC', actual_model: 'SYNTHETIC_NOT_PRODUCTION', status: 'ADMITTED', version: '1', data: {}, private: {} });
  await db.pool.query("UPDATE skill_bundles SET state='ADMITTED'");
  await db.pool.query(`UPDATE execution_variants SET sale_enabled=true,admission_state='ADMITTED',price_fen=100,
    data=data||'{"sale_enabled":true,"admission_state":"ADMITTED","price_fen":100}'::jsonb,
    private=private||'{"model_version_ids":["recommend-synthetic"]}'::jsonb WHERE engine='PHOTO_LAYOUT'`);
});
afterAll(async () => { await db?.close(); });

it('filters admitted photo-compatible variants and ranks category, observed structure and color', async () => {
  const page = await recommendPresets(db.pool, cfg, p, product.product_id, { limit: '4' });
  expect(page.items.map(v => v.preset.preset_id)).toEqual(['fresh-daily', 'feature-cards', 'color-pop', 'minimal-clean']);
  expect(page.items.every(v => v.variant_ids.length > 0 && v.variant_ids.every(id => id.endsWith('.photo-layout')) && !v.missing_inputs.length)).toBe(true);
});
it('uses scoped keyset pages without duplicates and rejects another buyer', async () => {
  const first = await recommendPresets(db.pool, cfg, p, product.product_id, { limit: '1' }); expect(first.next_cursor).toBeTruthy();
  const second = await recommendPresets(db.pool, cfg, p, product.product_id, { limit: '1', cursor: first.next_cursor! });
  expect(second.items[0]!.preset.preset_id).not.toBe(first.items[0]!.preset.preset_id);
  const other = (await account(db)).principal;
  await expect(recommendPresets(db.pool, cfg, other, product.product_id, {})).rejects.toMatchObject({ status: 404 });
  await expect(recommendPresets(db.pool, cfg, p, product.product_id, { cursor: first.next_cursor!.slice(0, -2) + 'xx' })).rejects.toMatchObject({ code: 'INVALID_CURSOR' });
});
it('withdraws model or sale capability immediately and remains read-only', async () => {
  await db.pool.query("UPDATE provider_model_versions SET status='REVOKED' WHERE id='recommend-synthetic'");
  expect((await recommendPresets(db.pool, cfg, p, product.product_id, {})).items).toEqual([]);
  await db.pool.query("UPDATE provider_model_versions SET status='ADMITTED' WHERE id='recommend-synthetic'");
  await db.pool.query("UPDATE execution_variants SET sale_enabled=false WHERE variant_id='fresh-daily.photo-layout'");
  expect((await recommendPresets(db.pool, cfg, p, product.product_id, {})).items.some(v => v.preset.preset_id === 'fresh-daily')).toBe(false);
  const count = await db.pool.query<{ count: string }>('SELECT count(*) FROM plan_versions UNION ALL SELECT count(*) FROM quotes UNION ALL SELECT count(*) FROM orders');
  expect(count.rows.every(v => v.count === '0')).toBe(true);
});
it('rejects invalidated original photo bindings before returning a suggestion', async () => {
  await db.pool.query("UPDATE assets SET state='DELETED' WHERE id='asset-c'");
  await expect(recommendPresets(db.pool, cfg, p, product.product_id, {})).rejects.toMatchObject({ code: 'PHOTO_SET_CHANGED' });
});
