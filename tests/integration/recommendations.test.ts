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
import { buildApp } from '../../src/api/app.js';
import { productInsights } from '../../src/api/modules/product-insights.js';
import { hmac } from '../../src/api/lib/crypto.js';
import type { Principal, DTO } from '../../src/shared/contracts/types.js';
import type { Config } from '../../src/api/config.js';

let db: TestDatabase, cfg: Config, p: Principal, product: DTO<'Product'>, app: Awaited<ReturnType<typeof buildApp>>, accessToken: string;
const assetIds = ['asset-a', 'asset-b', 'asset-c'];
beforeAll(async () => {
  db = await testDatabase(); const buyer = await account(db); p = buyer.principal; accessToken = buyer.accessToken; product = await createProduct(db.pool, p);
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
afterAll(async () => { await app?.close(); await db?.close(); });

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
it('records signed actual events through HTTP, deduplicates retries, and preserves collection windows', async () => {
  app = await buildApp({cfg, pool:db.pool, tls:false});
  const headers = { authorization: `Bearer ${accessToken}` };
  const path = `/v1/p01/products/${product.product_id}/recommendation-events`;
  const get = await app.inject({ url: `/v1/p01/products/${product.product_id}/preset-recommendations?limit=1`, headers });
  expect(get.statusCode,get.body).toBe(200);
  const item = get.json().data.items[0]; expect(item.measurement.token).toBeTruthy();
  expect((await db.pool.query('SELECT count(*) FROM recommendation_events')).rows[0].count).toBe('0');
  const send = (token:string,kind='IMPRESSION',h=headers) => app.inject({ method:'POST',url:path,headers:h,payload:{ measurement_token:token,kind } });
  const pair = await Promise.all([send(item.measurement.token),send(item.measurement.token)]);
  expect(pair.map(r=>r.statusCode)).toEqual([200,200]); expect(pair.map(r=>r.json().data.duplicate).sort()).toEqual([false,true]);
  expect(pair[0]!.headers['cache-control']).toContain('no-store');
  const again = await recommendPresets(db.pool,cfg,p,product.product_id,{limit:'1'});
  expect((await send(again.items[0]!.measurement!.token)).json().data.duplicate).toBe(true);
  expect((await send(item.measurement.token,'CLICK')).statusCode).toBe(200);
  const other = await account(db); expect((await send(item.measurement.token,'CLICK',{authorization:`Bearer ${other.accessToken}`})).statusCode).toBe(404);
  expect((await send(item.measurement.token+'broken')).statusCode).toBe(400);
  const range={window_start:new Date(Date.now()-3600000).toISOString(),window_end:new Date(Date.now()+3600000).toISOString()};
  const stats = await productInsights(db.pool,range); expect(stats.funnel).toMatchObject({recommendation_impressions:1,recommendation_clicks:1});
  expect(stats.recommendation_measurement).toMatchObject({window_coverage:'PARTIAL',evidence:'CLIENT_REPORTED'});
  expect((await productInsights(db.pool,{...range,traffic_group:'EXTERNAL'})).funnel.recommendation_clicks).toBe(0);
  const historical=await productInsights(db.pool,{window_start:'2026-01-01T00:00:00.000Z',window_end:'2026-01-02T00:00:00.000Z'});
  expect(historical.funnel.recommendation_impressions).toBeNull();expect(historical.recommendation_measurement.window_coverage).toBe('UNCOLLECTED');
  const afterStart=await productInsights(db.pool,{window_start:stats.recommendation_measurement.started_at,window_end:range.window_end});
  expect(afterStart.recommendation_measurement.window_coverage).toBe('SINCE_START');
  const claims=JSON.parse(Buffer.from(item.measurement.token.split('.')[0],'base64url').toString());claims.issued=Date.now()-1000000;claims.expires=claims.issued+900000;
  const encoded=Buffer.from(JSON.stringify(claims)).toString('base64url');const expired=encoded+'.'+hmac(cfg.signingKey,'ypcc:recommendation-measurement:v1:'+encoded);
  expect((await send(expired)).statusCode).toBe(410);
});
it('rejects changed input/version before dedup and physically erases deleted-product events', async () => {
  const item=(await recommendPresets(db.pool,cfg,p,product.product_id,{limit:'1'})).items[0]!;
  const send=()=>app.inject({method:'POST',url:`/v1/p01/products/${product.product_id}/recommendation-events`,headers:{authorization:`Bearer ${accessToken}`},payload:{measurement_token:item.measurement!.token,kind:'CLICK'}});
  const old=(await db.pool.query('SELECT data FROM product_drafts WHERE id=$1',[product.product_id])).rows[0].data;
  try {
    await db.pool.query("UPDATE product_drafts SET data=data||'{\"photo_version\":2}' WHERE id=$1",[product.product_id]);
    expect((await send()).statusCode).toBe(409);
  } finally {await db.pool.query('UPDATE product_drafts SET data=$1 WHERE id=$2',[old,product.product_id]);}
  try {
    await db.pool.query("UPDATE presets SET current_version='unpublished-synthetic' WHERE id=$1",[item.preset.preset_id]);
    expect((await send()).statusCode).toBe(409);
  } finally {await db.pool.query('UPDATE presets SET current_version=$1 WHERE id=$2',[item.preset.version,item.preset.preset_id]);}
  try {
    await db.pool.query('UPDATE product_drafts SET deleted_at=now() WHERE id=$1',[product.product_id]);
    expect((await db.pool.query('SELECT count(*) FROM recommendation_events')).rows[0].count).toBe('0');
    expect((await send()).statusCode).toBe(410);
  } finally {await db.pool.query('UPDATE product_drafts SET deleted_at=NULL WHERE id=$1',[product.product_id]);}
});

it('rejects invalidated original photo bindings before returning a suggestion', async () => {
  await db.pool.query("UPDATE assets SET state='DELETED' WHERE id='asset-c'");
  await expect(recommendPresets(db.pool, cfg, p, product.product_id, {})).rejects.toMatchObject({ code: 'PHOTO_SET_CHANGED' });
});
