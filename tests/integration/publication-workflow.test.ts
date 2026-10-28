import { beforeAll, beforeEach, afterAll, it, expect, vi } from 'vitest';
import { rm } from 'node:fs/promises';
import sharp from 'sharp';
import type { FastifyInstance, HTTPMethods } from 'fastify';
import { testDatabase, account, type TestDatabase } from '../helpers/database';
import { rawProfile } from '../helpers/fixtures';
import { normalizeVision } from '../../src/worker/analysis/profile';
import { buildApp } from '../../src/api/app';
import { config, inside } from '../../src/api/config';
import { LocalStorage } from '../../src/api/storage/storage';
import { writePrivateObject, reconcileUncertainObjectWrites } from '../../src/api/storage/private-objects';
import { createProduct } from '../../src/api/modules/products';
import { compilePresetConfig } from '../../src/api/modules/community';
import { insert } from '../../src/api/db/store';
import { id, hash, sha256 } from '../../src/api/lib/crypto';
import type { DTO } from '../../src/shared/contracts/types';
import { PublicSamplePreparationService } from '../../src/worker/samples/publication';
import { claimStage,completeStage } from '../../src/worker/queue/leases';
import { expireAuthorizedSamples, type AuthorizedRow } from '../../src/api/modules/authorized-samples';
import { MediaErasureService } from '../../src/worker/lifecycle/media-erasure';
import { transaction } from '../../src/api/db/pool';
import { requestDeletion } from '../../src/api/modules/support';
import { DeletionJournal } from '../../src/api/privacy/journal';
import { bootstrapDeletionJournal, replayDeletionJournal } from '../../src/worker/lifecycle/privacy-restore';
import { PendingExternal } from '../../src/worker/queue/leases';
import { expireWork } from '../../src/worker/lifecycle/deadlines';
import { AppError } from '../../src/api/lib/errors';

type Actor = Awaited<ReturnType<typeof account>>;
let db: TestDatabase; let app: FastifyInstance; let cfg: ReturnType<typeof config>; let store: LocalStorage; let folder: string;
let a: Actor; let b: Actor; let proof: string; let otherProof: string; let png: Buffer;
const adminToken = 'synthetic-license-admin-only'; const readToken = 'synthetic-license-reader-only';
let peerIndex=0;let testPeer='198.18.0.1';
// Each independent scenario has its own synthetic client address. The server's
// real 180/minute limit remains enabled and is tested explicitly below.
beforeEach(()=>{testPeer=`198.18.0.${++peerIndex}`;});
beforeAll(async () => {
  db = await testDatabase(); folder = inside(db.cfg.runtimeRoot, `tests/publication/${id('case')}`);
  cfg = config({ ...db.cfg, runtimeRoot: folder, publishingEnabled: true, generationEnabled: false, codex: { ...db.cfg.codex, enabled: false },
    managementTokens: JSON.stringify([{ actor: 'fixture-license-reviewer', token_hash: sha256(adminToken), permissions: ['*'] }, { actor: 'fixture-registry-reader', token_hash: sha256(readToken), permissions: ['registry:read'] }]) });
  store = new LocalStorage(cfg); app = await buildApp({ cfg, pool: db.pool, storage: store, tls: false,
    testErrorObserver:error=>{if (!(error instanceof AppError) && (error as {statusCode?:number}).statusCode!==429) process.stderr.write(`publication fixture internal error: ${(error as Error).message}\n`);} });
  [a, b] = await Promise.all([account(db), account(db)]);
  png = await sharp({ create: { width: 640, height: 800, channels: 3, background: '#336699' } }).png().toBuffer();
  proof = await upload(a); otherProof = await upload(b);
});
afterAll(async () => { await app?.close(); await db?.close(); if (folder) await rm(inside(db.cfg.runtimeRoot, folder), { recursive: true, force: true }); });
function api(method: HTTPMethods, path: string, actor?: Actor, body?: unknown, key = id('request')) {
  return app.inject({ method, remoteAddress:testPeer,url: `/v1/p01${path}`, headers: { ...(actor ? { authorization: `Bearer ${actor.accessToken}` } : {}), ...(method !== 'GET' ? { 'idempotency-key': key } : {}), ...(body !== undefined ? { 'content-type': 'application/json' } : {}) }, ...(body !== undefined ? { payload: JSON.stringify(body) } : {}) });
}
function managed(path: string, body: unknown, token = adminToken, key = id('admin')) {
  return app.inject({ method: 'POST',remoteAddress:testPeer, url: `/v1/internal/p01${path}`, headers: { authorization: `Bearer ${token}`, 'idempotency-key': key, 'content-type': 'application/json' }, payload: JSON.stringify(body) });
}
async function upload(actor: Actor, productId?: string): Promise<string> {
  const grant = await api('POST', '/assets', actor, { purpose: productId ? 'PRODUCT_PHOTO' : 'RIGHTS_EVIDENCE', ...(productId ? { product_id: productId } : {}), file_name: 'fixture.png', mime_type: 'image/png', size_bytes: png.length, sha256: sha256(png) });
  expect(grant.statusCode, grant.body).toBe(201); const g = grant.json<{ data: DTO<'UploadGrant'> }>().data;
  const uploaded = await app.inject({ method: 'PUT', url: new URL(g.upload_url).pathname, headers: { ...g.headers, 'content-type': 'application/octet-stream' }, payload: png }); expect(uploaded.statusCode, uploaded.body).toBe(204);
  const done = await api('POST', `/assets/${g.asset_id}/complete`, actor, { sha256: sha256(png) }); expect(done.statusCode, done.body).toBe(200); return g.asset_id;
}
async function product(actor = a) {
  const p = actor.principal; const item = await createProduct(db.pool, p); const photoId = id('photo-set');
  const { profile, identityLock } = normalizeVision(rawProfile(), { tenantId: p.tenantId, productId: item.product_id, photoVersion: 1, revision: 1, assetIds: ['asset-a', 'asset-b', 'asset-c'] });
  await insert(db.pool, 'product_photo_versions', { id: photoId, tenant_id: p.tenantId, product_id: item.product_id, revision: 1, photo_set_hash: 'a'.repeat(64), data: [] });
  await insert(db.pool, 'profile_versions', { id: profile.profile_id, tenant_id: p.tenantId, owner_id: p.userId, product_id: item.product_id, photo_version_id: photoId, revision: 1, profile_hash: profile.profile_hash, data: profile });
  await insert(db.pool, 'identity_locks', { id: identityLock.identity_lock_id, tenant_id: p.tenantId, profile_id: profile.profile_id, hash: identityLock.content_hash, data: identityLock });
  await db.pool.query(`UPDATE product_drafts SET current_profile_id=$2,current_photo_version=1,data=data||jsonb_build_object('profile_id',$2::text,'photo_version',1) WHERE id=$1`, [item.product_id, profile.profile_id]);
  return { ...item, photo_version: 1, profile_id: profile.profile_id, profile };
}
async function terms(active = true, fork = true) {
  const registration: DTO<'PresetLicenseRegistration'> = { license_id: id('license'), version: '1.0.0', name: '仅供原生集成测试的许可', full_text: '这是显式合成测试许可，只用于验证全文展示、版本摘要、派生规则和审核流程，不构成真实用户授权。', fork_allowed: fork, attribution_required: true };
  const registered = await managed('/preset-licenses', registration); expect(registered.statusCode, registered.body).toBe(200); const d = registered.json<{ data: DTO<'PresetLicense'> }>().data;
  if (!active) return d;
  const approved = await managed(`/preset-licenses/${d.license_id}/decision`, { expected_state: 'DRAFT', expected_content_hash: d.content_hash, decision: 'APPROVE', review_reference: 'fixture-review-only', reason: '合成测试，不代表生产法律或内容准入' });
  expect(approved.statusCode, approved.body).toBe(200); return approved.json<{ data: DTO<'PresetLicense'> }>().data;
}
async function rights(actor: Actor, productId: string) {
  const ids = [];
  for (const scope of ['OWNED_PRODUCT', 'SAMPLE_PUBLICATION'] as const) {
    const result = await api('POST', '/rights-records', actor, { scope, product_id: productId, statement: '合成测试自有商品与样例公开声明', evidence_asset_ids: [actor === a ? proof : otherProof] });
    expect(result.statusCode, result.body).toBe(201); const r = result.json<{ data: DTO<'RightsRecord'> }>().data;
    expect(r).toMatchObject({ product_id: productId, photo_version: 1, scope }); ids.push(r.rights_record_id);
  }
  return ids;
}
async function fixture(options: { actor?: Actor; blueprints?: string[]; license?: DTO<'PresetLicense'> } = {}) {
  const actor = options.actor ?? a; const input = await product(actor); const recordIds = await rights(actor, input.product_id);
  const config: DTO<'PresetConfig'> = { name: '测试：深色风格与通用图文规格', description: '原创合成配置，仅供作者发布协议测试', style_tags: ['静谧'], parent_preset_version: null, component_versions: ['style.quiet-luxury.1'],
    variant_blueprint_ids: options.blueprints ?? ['blueprint.minimal-clean.photo-layout'], resource_version_ids: [], fork_allowed: true };
  const result = await api('POST', '/preset-drafts', actor, { config }); expect(result.statusCode, result.body).toBe(201);
  return { actor, input, rights: recordIds, draft: result.json<{ data: DTO<'PresetDraft'> }>().data, license: options.license ?? await terms() };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
/** Explicit READY/QC fixture, not a claim that a SAMPLE worker generated it.
 * The displayed sample object itself is a real registered private PNG. */
async function ready(f: Fixture, blueprint = f.draft.config.variant_blueprint_ids[0]!) {
  const compiled = (await compilePresetConfig(db.pool, f.draft.config)).find(x => x.blueprint_id === blueprint)!; const sampleId = id('sample');
  const key = `${f.actor.principal.tenantId}/samples/${sampleId}/hero.png`;
  await writePrivateObject(db.pool, store, { tenantId: f.actor.principal.tenantId, ownerId: f.actor.principal.userId, productId:f.input.product_id,kind: 'MEDIA' }, key, png, 'image/png');
  const request: DTO<'SampleRequest'> = { draft_revision: f.draft.revision, product_id: f.input.product_id, profile_id: f.input.profile_id,
    variant_blueprint_id: blueprint, rights_record_ids: f.rights };
  const data: DTO<'Sample'> = { sample_id: sampleId, draft_id: f.draft.draft_id, state: 'READY', visibility: 'PRIVATE', rights_verified: false,
    draft_revision: f.draft.revision, product_id: f.input.product_id, variant_blueprint_id: blueprint };
  await insert(db.pool, 'public_samples', { id: sampleId, tenant_id: f.actor.principal.tenantId, owner_id: f.actor.principal.userId, product_id:f.input.product_id,draft_id: f.draft.draft_id,
    state: 'READY', visibility: 'PRIVATE', data, private: { request, config: f.draft.config, config_hash: hash(f.draft.config), compiled_source_hash: compiled.source_hash,
      input_ref: { product_id: f.input.product_id, photo_version: 1 }, qc_passed: true, test_fixture: true,
      media: [{ item_id: 'hero', kind: 'image', object_key: key, sha256: sha256(png), size_bytes: png.length }] } });
  return { ...data, key };
}
function publicationBody(f: Fixture, samples: string[]): DTO<'PublicationRequest'> { return { expected_revision: f.draft.revision, sample_ids: samples, rights_record_ids: f.rights,
  license_version: f.license.license_id, license_content_hash: f.license.content_hash, accept_license: true,accept_sample_publication:true,public_sample_retention_days:30 }; }
async function submit(f: Fixture, sampleIds: string[]) { const r = await api('POST', `/preset-drafts/${f.draft.draft_id}/submit`, f.actor, publicationBody(f, sampleIds)); expect(r.statusCode, r.body).toBe(202); return r.json<{ data: DTO<'Publication'> }>().data; }
async function prepare(p: DTO<'Publication'>, service = new PublicSamplePreparationService(db.pool,cfg,store)) {
  const lease = await claimStage(db.pool,id('copy_worker'),['PUBLIC_SAMPLE_PREPARE']); expect(lease?.scope_id).toBe(p.publication_id);
  const commit = await service.handle(lease!,new AbortController().signal); await completeStage(db.pool,lease!,commit);
  return (await api('GET',`/preset-publications/${p.publication_id}`,a)).json<{data:DTO<'Publication'>}>().data;
}
async function approve(f: Fixture, p: DTO<'Publication'>, copy = true) {
  const r = await managed(`/publications/${p.publication_id}/review-decisions`, { expected_revision: p.revision, decision: 'APPROVE', reason: '测试资料已逐项核对；该结论不授予制作商业准入。', evidence_record_ids: f.rights });
  expect(r.statusCode, r.body).toBe(200); const approved = r.json<{ data: DTO<'Publication'> }>().data;
  return copy ? prepare(approved) : approved;
}

it('separates license registration/review permissions and exposes immutable versioned text without operator records', async () => {
  const l = await terms(false); const publicList = await api('GET', '/preset-licenses?limit=1'); expect(publicList.statusCode).toBe(200);
  const response = (await api('GET', `/preset-licenses/${l.license_id}`)).json().data; expect(response.full_text).toBe(l.full_text); expect(response.content_hash).toBe(sha256(l.full_text)); expect(response.review_reference).toBeUndefined();
  const denied = await managed(`/preset-licenses/${l.license_id}/decision`, { expected_state: 'DRAFT', expected_content_hash: l.content_hash, decision: 'APPROVE', review_reference: 'fixture', reason: 'fixture reason' }, readToken); expect(denied.statusCode).toBe(403);
  const changed = await managed(`/preset-licenses/${l.license_id}/decision`, { expected_state: 'DRAFT', expected_content_hash: 'f'.repeat(64), decision: 'APPROVE', review_reference: 'fixture', reason: 'fixture reason' }); expect(changed.statusCode).toBe(409);
  await expect(db.pool.query(`UPDATE community_licenses SET data=jsonb_set(data,'{full_text}','"changed"') WHERE id=$1`, [l.license_id])).rejects.toThrow(/immutable/);
  await expect(db.pool.query('DELETE FROM community_licenses WHERE id=$1', [l.license_id])).rejects.toThrow(/immutable/);
});
it('binds author proof to an owned photo version and rejects foreign products or ordinary product images as rights proof', async () => {
  const item = await product(); const wrong = await api('POST', '/rights-records', b, { scope: 'OWNED_PRODUCT', product_id: item.product_id, statement: '合成声明', evidence_asset_ids: [otherProof] }); expect(wrong.statusCode).toBe(404);
  const photo = await upload(a, item.product_id); const rejected = await api('POST', '/rights-records', a, { scope: 'OWNED_PRODUCT', product_id: item.product_id, statement: '合成声明', evidence_asset_ids: [photo] }); expect(rejected.statusCode).toBe(422); expect(rejected.json().code).toBe('EVIDENCE_SCOPE_INVALID');
});
it('does not queue or charge sample work without an available execution service and refuses another photo set rights', async () => {
  const f = await fixture(); const body: DTO<'SampleRequest'> = { draft_revision: f.draft.revision, product_id: f.input.product_id, profile_id: f.input.profile_id,
    variant_blueprint_id: f.draft.config.variant_blueprint_ids[0]!, rights_record_ids: f.rights };
  const unavailable = await api('POST', `/preset-drafts/${f.draft.draft_id}/samples`, a, body); expect(unavailable.statusCode, unavailable.body).toBe(503); expect(unavailable.json().code).toBe('SAMPLE_SERVICE_UNAVAILABLE');
  expect((await db.pool.query('SELECT id FROM stage_runs WHERE scope_type=$1', ['SAMPLE'])).rowCount).toBe(0);
  const other = await product(); const wrong = await api('POST', `/preset-drafts/${f.draft.draft_id}/samples`, a, { ...body, product_id: other.product_id, profile_id: other.profile_id }); expect(wrong.statusCode).toBe(422); expect(wrong.json().code).toBe('SAMPLE_RIGHTS_INCOMPLETE');
  expect((await db.pool.query('SELECT id FROM inference_requests')).rowCount).toBe(0);
});
it('rejects inactive/changed license acceptance, incompatible fork terms and duplicate evidence before publication', async () => {
  const f = await fixture({ license: await terms(false) }); const s = await ready(f); const path = `/preset-drafts/${f.draft.draft_id}/submit`; const body = publicationBody(f, [s.sample_id]);
  const inactive = await api('POST', path, a, body); expect(inactive.statusCode).toBe(422); expect(inactive.json().code).toBe('LICENSE_NOT_AVAILABLE');
  f.license = await terms(); const hashChanged = await api('POST', path, a, { ...publicationBody(f, [s.sample_id]), license_content_hash: 'f'.repeat(64) }); expect(hashChanged.statusCode).toBe(422);
  expect((await api('POST', path, a, { ...publicationBody(f, [s.sample_id]), accept_license: false })).statusCode).toBe(400);
  expect((await api('POST', path, a, publicationBody(f, [s.sample_id, s.sample_id]))).json().code).toBe('DUPLICATE_EVIDENCE');
  f.license = await terms(true, false); const mismatch = await api('POST', path, a, publicationBody(f, [s.sample_id])); expect(mismatch.json().code).toBe('LICENSE_FORK_MISMATCH');
});
it('requires a current sample for every selected execution blueprint and retains its actual style mapping', async () => {
  const f = await fixture({ blueprints: ['blueprint.minimal-clean.photo-layout', 'blueprint.fresh-daily.photo-layout'] }); const first = await ready(f);
  const incomplete = await api('POST', `/preset-drafts/${f.draft.draft_id}/submit`, a, publicationBody(f, [first.sample_id])); expect(incomplete.statusCode, incomplete.body).toBe(422); expect(incomplete.json().code).toBe('SAMPLE_COVERAGE_INCOMPLETE');
  const second = await ready(f, f.draft.config.variant_blueprint_ids[1]!); const p = await submit(f, [first.sample_id, second.sample_id]);
  const stored = (await db.pool.query<{ private: { compiled_variants: { source: { engine: string; creative_components: { platform_style_id: string } } }[] } }>('SELECT private FROM publications WHERE id=$1', [p.publication_id])).rows[0]!;
  expect(stored.private.compiled_variants).toHaveLength(2); expect(stored.private.compiled_variants.every(x => x.source.engine === 'PHOTO_LAYOUT' && x.source.creative_components.platform_style_id === 'quiet-luxury')).toBe(true);
});
it('rejects foreign or altered sample bindings and an unavailable actual object without creating a publication', async () => {
  const f = await fixture(); const s = await ready(f); const other = await fixture({ actor: b }); const foreign = await ready(other);
  const path = `/preset-drafts/${f.draft.draft_id}/submit`;
  expect((await api('POST', path, a, publicationBody(f, [foreign.sample_id]))).statusCode).toBe(404);
  await db.pool.query(`UPDATE public_samples SET private=jsonb_set(private,'{config_hash}',$2::jsonb) WHERE id=$1`, [s.sample_id, JSON.stringify('f'.repeat(64))]);
  expect((await api('POST', path, a, publicationBody(f, [s.sample_id]))).json().code).toBe('SAMPLE_NOT_READY');
  await db.pool.query(`UPDATE public_samples SET private=jsonb_set(private,'{config_hash}',$2::jsonb) WHERE id=$1`, [s.sample_id, JSON.stringify(hash(f.draft.config))]);
  await store.delete(s.key); const missing = await api('POST', path, a, publicationBody(f, [s.sample_id])); expect(missing.statusCode, missing.body).toBe(422);
  expect((await db.pool.query('SELECT id FROM publications WHERE draft_id=$1', [f.draft.draft_id])).rowCount).toBe(0);
});
it('freezes acceptance and compiled sources, replays one submission and rejects a changed submission for the same draft version', async () => {
  const f = await fixture(); const s = await ready(f); const p = await submit(f, [s.sample_id]); const replay = await submit(f, [s.sample_id]); expect(replay.publication_id).toBe(p.publication_id); expect(p.sale_enabled).toBe(false);
  const another = await terms(); const changed = await api('POST', `/preset-drafts/${f.draft.draft_id}/submit`, a, { ...publicationBody(f, [s.sample_id]), license_version: another.license_id, license_content_hash: another.content_hash }); expect(changed.statusCode).toBe(409);
  const stored = (await db.pool.query<{ private: { license_acceptance: { content_hash: string; subject_id: string } } }>('SELECT private FROM publications WHERE id=$1', [p.publication_id])).rows[0]!;
  expect(stored.private.license_acceptance).toMatchObject({ content_hash: f.license.content_hash, subject_id: a.principal.userId }); expect((await api('GET', `/preset-publications/${p.publication_id}`, b)).statusCode).toBe(404);
});
it('requires review of all original author grants and returns actionable reviewer feedback only to the owner', async () => {
  const f = await fixture(); const s = await ready(f); const p = await submit(f, [s.sample_id]);
  const missing = await managed(`/publications/${p.publication_id}/review-decisions`, { expected_revision: 0, decision: 'APPROVE', reason: 'fixture review', evidence_record_ids: [f.rights[0]] }); expect(missing.statusCode).toBe(422);
  const reviewed = await approve(f, p); expect(reviewed.state).toBe('APPROVED'); const detail = (await api('GET', `/preset-publications/${p.publication_id}`, a)).json().data;
  expect(detail.review_message).toContain('逐项核对'); expect(detail.private).toBeUndefined();
});
it('rechecks binary media and rights before publishing and never treats publication as sales admission', async () => {
  const f = await fixture(); const s = await ready(f); const p = await approve(f, await submit(f, [s.sample_id]));
  await db.pool.query(`UPDATE rights_records SET state='REVOKED',data=jsonb_set(data,'{state}','"REVOKED"') WHERE id=$1`, [f.rights[0]]);
  const denied = await managed(`/publications/${p.publication_id}/publish`, { reason: 'fixture publish', evidence_record_ids: f.rights }); expect(denied.statusCode, denied.body).toBe(410);
  await db.pool.query(`UPDATE rights_records SET state='VERIFIED',data=jsonb_set(data,'{state}','"VERIFIED"') WHERE id=$1`, [f.rights[0]]);
  const published = await managed(`/publications/${p.publication_id}/publish`, { reason: 'fixture publish', evidence_record_ids: f.rights }); expect(published.statusCode, published.body).toBe(200); const data = published.json<{ data: DTO<'Publication'> }>().data;
  expect(data).toMatchObject({ state: 'PUBLISHED', sale_enabled: false, admission_state: 'NOT_EVALUATED' });
  const detail = (await api('GET', `/presets/${data.preset_id}/versions/${data.published_version}`)).json().data; expect(detail.preset.sale_enabled).toBe(false);
  const variant = (await db.pool.query<{ private: { source: { creative_components: { platform_style_id: string } } }; sale_enabled: boolean }>('SELECT private,sale_enabled FROM execution_variants WHERE preset_version_id=$1', [`${data.preset_id}.${data.published_version}`])).rows[0]!;
  expect(variant.private.source.creative_components.platform_style_id).toBe('quiet-luxury'); expect(variant.sale_enabled).toBe(false);
});
it('retires a license permanently, blocks new review/publication and stops all affected new sales', async () => {
  const f = await fixture(); const s = await ready(f); const p = await approve(f, await submit(f, [s.sample_id]));
  const live = await fixture({ license: f.license }); const liveSample = await ready(live); const reviewed = await approve(live, await submit(live, [liveSample.sample_id]));
  const published = await managed(`/publications/${reviewed.publication_id}/publish`, { reason: 'fixture publication for retirement', evidence_record_ids: live.rights }); expect(published.statusCode, published.body).toBe(200);
  const publishedData = published.json<{ data: DTO<'Publication'> }>().data;
  // Synthetic admission fixture only: this does not prove production admission.
  const variant = (await db.pool.query<{ id: string; revision: number }>(`UPDATE execution_variants SET admission_state='ADMITTED',price_fen=100,sale_enabled=true,
    data=data||'{"admission_state":"ADMITTED","price_fen":100,"sale_enabled":true}'::jsonb WHERE preset_version_id=$1 RETURNING id,revision`, [`${publishedData.preset_id}.${publishedData.published_version}`])).rows[0]!;
  const retired = await managed(`/preset-licenses/${f.license.license_id}/decision`, { expected_state: 'ACTIVE', expected_content_hash: f.license.content_hash, decision: 'RETIRE', review_reference: 'fixture-retirement', reason: '测试退役' }); expect(retired.statusCode, retired.body).toBe(200);
  const retiredVariant = (await db.pool.query<{ sale_enabled: boolean; revision: number; data: DTO<'Variant'> }>('SELECT sale_enabled,revision,data FROM execution_variants WHERE id=$1', [variant.id])).rows[0]!;
  expect(retiredVariant.sale_enabled).toBe(false); expect(retiredVariant.data.sale_enabled).toBe(false); expect(retiredVariant.revision).toBe(variant.revision + 1);
  expect((await api('GET', `/presets/${publishedData.preset_id}/versions/${publishedData.published_version}`)).json().data.preset.sale_enabled).toBe(false);
  const rejected = await managed(`/publications/${p.publication_id}/publish`, { reason: 'fixture publish', evidence_record_ids: f.rights }); expect(rejected.statusCode, rejected.body).toBe(422); expect(rejected.json().code).toBe('LICENSE_NOT_AVAILABLE');
  const stored = (await api('GET', `/preset-publications/${p.publication_id}`, a)).json().data; expect(stored).toMatchObject({ sale_enabled: false, admission_state: 'SUSPENDED' });
  const retry = await managed(`/preset-licenses/${f.license.license_id}/decision`, { expected_state: 'ACTIVE', expected_content_hash: f.license.content_hash, decision: 'APPROVE', review_reference: 'fixture', reason: 'fixture' }); expect(retry.statusCode).toBe(409);
  expect((await api('GET', `/preset-licenses/${f.license.license_id}`)).json().data.full_text).toBe(f.license.full_text);
});
it('requires separately bound third-party rights and detects changed registered resource content', async () => {
  const f = await fixture(); const resourceId = id('resource');
  const resource: DTO<'ResourceOption'> = { resource_version_id: resourceId, kind: 'LAYOUT', name: '合成版式资源', license_summary: '合成测试资源，不授予真实商业使用许可', usable: true };
  await db.pool.query('INSERT INTO resource_licenses(id,resource_id,version,data) VALUES($1,$1,$2,$3)', [resourceId, 'fixture-1', resource]);
  const edited = await api('PATCH', `/preset-drafts/${f.draft.draft_id}`, a, { expected_revision: f.draft.revision, config: { ...f.draft.config, resource_version_ids: [resourceId] } }); expect(edited.statusCode, edited.body).toBe(200); f.draft = edited.json<{ data: DTO<'PresetDraft'> }>().data;
  const sample = await ready(f);
  const missing = await api('POST', `/preset-drafts/${f.draft.draft_id}/submit`, a, publicationBody(f, [sample.sample_id])); expect(missing.statusCode, missing.body).toBe(422); expect(missing.json().code).toBe('RESOURCE_RIGHTS_INCOMPLETE');
  const grant = await api('POST', '/rights-records', a, { scope: 'THIRD_PARTY_RESOURCE', statement: '合成资源使用许可证明', resource_version_ids: [resourceId], evidence_asset_ids: [proof] }); expect(grant.statusCode, grant.body).toBe(201); f.rights.push(grant.json().data.rights_record_id);
  await db.pool.query(`UPDATE resource_licenses SET data=jsonb_set(data,'{license_summary}','"changed fixture content"') WHERE id=$1`, [resourceId]);
  const changed = await api('POST', `/preset-drafts/${f.draft.draft_id}/submit`, a, publicationBody(f, [sample.sample_id])); expect(changed.statusCode, changed.body).toBe(422); expect(changed.json().code).toBe('SAMPLE_NOT_READY');
  await db.pool.query('UPDATE resource_licenses SET data=$2 WHERE id=$1', [resourceId, resource]);
  expect((await submit(f, [sample.sample_id])).state).toBe('UNDER_REVIEW');
});
it('preserves a community parent license and refuses new forks after its retirement', async () => {
  const f = await fixture(); const sample = await ready(f); const reviewed = await approve(f, await submit(f, [sample.sample_id]));
  const published = await managed(`/publications/${reviewed.publication_id}/publish`, { reason: 'fixture parent', evidence_record_ids: f.rights }); expect(published.statusCode, published.body).toBe(200); const parent = published.json<{ data: DTO<'Publication'> }>().data;
  const child = await fixture(); const forked = await api('POST', `/presets/${parent.preset_id}/forks`, a, { parent_version: parent.published_version, name: '合成派生版本' }); expect(forked.statusCode, forked.body).toBe(201); child.draft = forked.json<{ data: DTO<'PresetDraft'> }>().data;
  const childSample = await ready(child); const changed = await api('POST', `/preset-drafts/${child.draft.draft_id}/submit`, a, publicationBody(child, [childSample.sample_id]));
  expect(changed.statusCode, changed.body).toBe(422); expect(changed.json().code).toBe('LICENSE_INHERITANCE_REQUIRED'); child.license = f.license;
  expect((await submit(child, [childSample.sample_id])).state).toBe('UNDER_REVIEW');
  const retired = await managed(`/preset-licenses/${f.license.license_id}/decision`, { expected_state: 'ACTIVE', expected_content_hash: f.license.content_hash, decision: 'RETIRE', review_reference: 'fixture', reason: '测试父许可退役' }); expect(retired.statusCode, retired.body).toBe(200);
  const rejected = await api('POST', `/presets/${parent.preset_id}/forks`, a, { parent_version: parent.published_version, name: '退役后新派生' }); expect(rejected.statusCode, rejected.body).toBe(422); expect(rejected.json().code).toBe('FORK_NOT_ALLOWED');
});

async function publish(f: Fixture,p: DTO<'Publication'>) {
  const r = await managed(`/publications/${p.publication_id}/publish`,{reason:'合成许可与真实文件的发布协议验证',evidence_record_ids:f.rights});
  expect(r.statusCode,r.body).toBe(200); return r.json<{data:DTO<'Publication'>}>().data;
}
async function publicCopy(p: DTO<'Publication'>) { return (await db.pool.query<AuthorizedRow>('SELECT * FROM authorized_samples WHERE publication_id=$1 ORDER BY id',[p.publication_id])).rows[0]!; }
async function drainMedia() {
  const media = new MediaErasureService(db.pool,store,id('public_eraser')); await media.refreshPending();
  for (let n=0;n<200 && await media.eraseOne(new AbortController().signal);n++) { /* real files, bounded test schema */ }
  await media.refreshPending(); return media;
}
const localUrl = (url: string) => {const u=new URL(url);return `${u.pathname}${u.search}`;};

it('requires explicit separate 30-day consent and prepares independent files before any public visibility',async()=>{
  const f=await fixture();const s=await ready(f);const body=publicationBody(f,[s.sample_id]);
  expect((await api('POST',`/preset-drafts/${f.draft.draft_id}/submit`,a,{...body,accept_sample_publication:false})).statusCode).toBe(400);
  expect((await api('POST',`/preset-drafts/${f.draft.draft_id}/submit`,a,{...body,public_sample_retention_days:365})).statusCode).toBe(400);
  const approved=await approve(f,await submit(f,[s.sample_id]),false);expect(approved.public_sample_state).toBe('PREPARING');
  const before=await publicCopy(approved);expect(before.id).not.toBe(s.sample_id);expect(before.private.media).toBeUndefined();
  expect(Math.abs(before.expires_at.getTime()-Date.now()-30*86400000)).toBeLessThan(5000);
  expect((await api('GET',`/public-samples/${before.id}`)).statusCode).toBe(410);
  expect((await managed(`/publications/${approved.publication_id}/publish`,{reason:'尚未复制的发布应当阻断',evidence_record_ids:f.rights})).json().code).toBe('PUBLIC_SAMPLE_PREPARING');
  const preparedPublication=await prepare(approved);expect(preparedPublication.public_sample_state).toBe('READY');const published=await publish(f,preparedPublication);
  const copy=await publicCopy(published);expect(copy.state).toBe('PUBLISHED');expect(copy.private.media?.[0]?.object_key).not.toBe(s.key);
  const source=(await db.pool.query('SELECT visibility,data FROM public_samples WHERE id=$1',[s.sample_id])).rows[0];expect(source.visibility).toBe('PRIVATE');expect(source.data.visibility).toBe('PRIVATE');
  const registration=(await db.pool.query('SELECT product_id,order_id,run_id,expires_at FROM private_object_writes WHERE authorized_sample_id=$1',[copy.id])).rows[0];
  expect(registration).toMatchObject({product_id:null,order_id:null,run_id:null});expect(registration.expires_at.toISOString()).toBe(copy.private.input.expires_at);
  const links=await api('GET',`/public-samples/${copy.id}`);expect(links.statusCode,links.body).toBe(200);expect(links.json().data.label).toBe('AUTHORIZED_SAMPLE_NOT_YOUR_RESULT');
  expect(links.body).not.toContain(s.key);expect(links.body).not.toContain(f.input.profile_id);
  const file=await app.inject({method:'GET',url:localUrl(links.json().data.items[0].url)});expect(file.statusCode).toBe(200);expect(sha256(file.rawPayload)).toBe(sha256(png));expect(file.headers['cache-control']).toBe('private, no-store');
  expect((await api('GET',`/public-samples/${s.sample_id}`)).statusCode).toBe(404);
  expect((await api('POST',`/preset-samples/${s.sample_id}/media-links`,b,{})).statusCode).toBe(404);
  await expect(db.pool.query("UPDATE authorized_samples SET expires_at=expires_at+interval '1 day' WHERE id=$1",[copy.id])).rejects.toThrow(/immutable/);
});

it('preserves separately approved public bytes after natural input expiry and actual private-source redaction',async()=>{
  const f=await fixture();const source=await ready(f);const approved=await approve(f,await submit(f,[source.sample_id]));const copy=await publicCopy(approved);
  await db.pool.query("UPDATE product_drafts SET expires_at=now()-interval '1 second' WHERE id=$1",[f.input.product_id]);
  const media=new MediaErasureService(db.pool,store,id('natural_eraser'));await media.expire();await drainMedia();
  expect(await store.exists(source.key)).toBe(false);expect(await store.exists(copy.private.media![0]!.object_key)).toBe(true);
  const original=(await db.pool.query('SELECT private,state FROM public_samples WHERE id=$1',[source.sample_id])).rows[0];expect(original.state).toBe('FAILED');expect(original.private.request).toBeUndefined();
  const evidence=(await db.pool.query(`SELECT private FROM privacy_deletions WHERE private->'product_ids' ? $1 ORDER BY created_at DESC LIMIT 1`,[f.input.product_id])).rows[0].private;
  expect(evidence.origin).toBe('RETENTION');expect(evidence.controlled_media.database.state).toBe('REDACTED');expect(evidence.authorized_sample_ids).toEqual([]);
  const published=await publish(f,approved);expect(published.public_sample_state).toBe('PUBLISHED');
  const links=await api('GET',`/public-samples/${copy.id}`);expect(links.statusCode,links.body).toBe(200);
  expect((await app.inject({method:'GET',url:localUrl(links.json().data.items[0].url)})).rawPayload).toEqual(png);
});

it('lets only the owner withdraw, invalidates already issued links immediately and erases only the public copies',async()=>{
  const f=await fixture();const source=await ready(f);const p=await publish(f,await approve(f,await submit(f,[source.sample_id])));const copy=await publicCopy(p);
  const links=(await api('GET',`/public-samples/${copy.id}`)).json().data;const path=`/preset-publications/${p.publication_id}/sample-withdrawals`;
  expect((await api('POST',path,b,{expected_revision:p.revision,reason:'其他作者不可撤回'})).statusCode).toBe(404);
  expect((await api('POST',path,a,{expected_revision:0,reason:'旧状态不可覆盖'})).statusCode).toBe(409);
  const key=id('withdrawal');const body={expected_revision:p.revision,reason:'作者撤回合成测试样例'};const result=await api('POST',path,a,body,key);
  expect(result.statusCode,result.body).toBe(200);expect(result.json().data).toMatchObject({state:'SUSPENDED',public_sample_state:'WITHDRAWN',sale_enabled:false});
  expect((await api('POST',path,a,body,key)).json().data).toEqual(result.json().data);
  expect((await app.inject({method:'GET',url:localUrl(links.items[0].url)})).statusCode).toBe(410);
  expect((await api('GET',`/presets/${p.preset_id}/versions/${p.published_version}`)).statusCode).toBe(404);
  await drainMedia();expect(await store.exists(copy.private.media![0]!.object_key)).toBe(false);expect(await store.exists(source.key)).toBe(true);
  await expect(db.pool.query("UPDATE authorized_samples SET state='PUBLISHED' WHERE id=$1",[copy.id])).rejects.toThrow(/cannot be revived/);
});

it('recovers an uncertain original copy and a stale preparation lease without a second PUT or inference purchase',async()=>{
  const f=await fixture();const source=await ready(f);const p=await approve(f,await submit(f,[source.sample_id]),false);let puts=0;
  class AmbiguousStore extends LocalStorage {override async put(key:string,bytes:Buffer,mime:string) {if(key.includes('/authorized-samples/')) puts++;await super.put(key,bytes,mime);throw new AppError('SYNTHETIC_WRITE_AMBIGUOUS','合成写入响应丢失',503);}}
  const service=new PublicSamplePreparationService(db.pool,cfg,new AmbiguousStore(cfg));const first=await claimStage(db.pool,id('first_copy'),['PUBLIC_SAMPLE_PREPARE']);
  await expect(service.handle(first!,new AbortController().signal)).rejects.toMatchObject({code:'SYNTHETIC_WRITE_AMBIGUOUS'});expect(puts).toBe(1);
  const copy=await publicCopy(p);expect((await db.pool.query('SELECT state FROM private_object_writes WHERE authorized_sample_id=$1',[copy.id])).rows[0].state).toBe('UNKNOWN');
  await db.pool.query("UPDATE stage_runs SET lease_expires_at=now()-interval '1 second' WHERE id=$1",[first!.id]);const second=await claimStage(db.pool,id('second_copy'),['PUBLIC_SAMPLE_PREPARE']);
  await expect(service.handle(second!,new AbortController().signal)).rejects.toBeInstanceOf(PendingExternal);expect(puts).toBe(1);
  expect((await reconcileUncertainObjectWrites(db.pool,store)).recovered).toBe(1);
  const stale=await service.handle(second!,new AbortController().signal);
  await db.pool.query("UPDATE stage_runs SET lease_expires_at=now()-interval '1 second' WHERE id=$1",[second!.id]);const third=await claimStage(db.pool,id('third_copy'),['PUBLIC_SAMPLE_PREPARE']);
  await expect(completeStage(db.pool,second!,stale)).rejects.toMatchObject({code:'LEASE_LOST'});
  await completeStage(db.pool,third!,await service.handle(third!,new AbortController().signal));expect(puts).toBe(1);
  const current=(await api('GET',`/preset-publications/${p.publication_id}`,a)).json().data;expect(current.public_sample_state).toBe('READY');await publish(f,current);
  expect((await db.pool.query('SELECT id FROM inference_requests')).rowCount).toBe(0);
});

it('revokes an inflight public copy, fences its stage and collects a late successful object write',async()=>{
  const f=await fixture();const source=await ready(f);const p=await approve(f,await submit(f,[source.sample_id]),false);
  let announce!:()=>void;let resume!:()=>void;const entered=new Promise<void>(r=>announce=r);const released=new Promise<void>(r=>resume=r);
  class PausedStore extends LocalStorage {override async put(key:string,bytes:Buffer,mime:string){announce();await released;await super.put(key,bytes,mime);}}
  const service=new PublicSamplePreparationService(db.pool,cfg,new PausedStore(cfg));const lease=await claimStage(db.pool,id('paused_copy'),['PUBLIC_SAMPLE_PREPARE']);
  const pending=service.handle(lease!,new AbortController().signal).then(()=>null,error=>error);await entered;
  try {const withdrawn=await api('POST',`/preset-publications/${p.publication_id}/sample-withdrawals`,a,{expected_revision:p.revision,reason:'在副本写入期间撤回'});expect(withdrawn.statusCode,withdrawn.body).toBe(200);}finally{resume();}
  expect(await pending).toMatchObject({code:'PRIVATE_OBJECT_REVOKED'});const copy=await publicCopy(p);
  const row=(await db.pool.query('SELECT state,delete_requested,object_key FROM private_object_writes WHERE authorized_sample_id=$1',[copy.id])).rows[0];expect(row).toMatchObject({state:'STORED',delete_requested:true});
  expect((await db.pool.query('SELECT state FROM stage_runs WHERE id=$1',[lease!.id])).rows[0].state).toBe('CANCELLED');
  await drainMedia();expect(await store.exists(row.object_key)).toBe(false);expect(await store.exists(source.key)).toBe(true);
});

it('ends an expired preparation without reviving its private sample or opening sales',async()=>{
  const f=await fixture();const s=await ready(f);const p=await approve(f,await submit(f,[s.sample_id]),false);
  await db.pool.query("UPDATE stage_runs SET deadline_at=now()-interval '1 second' WHERE scope_type='PUBLICATION' AND scope_id=$1",[p.publication_id]);
  expect((await expireWork(db.pool)).stages).toBeGreaterThan(0);
  const ended=(await api('GET',`/preset-publications/${p.publication_id}`,a)).json().data;expect(ended).toMatchObject({state:'SUSPENDED',public_sample_state:'FAILED',sale_enabled:false});
  expect((await db.pool.query('SELECT state FROM public_samples WHERE id=$1',[s.sample_id])).rows[0].state).toBe('READY');
});

it('rejects changed prepared bytes and reclaims expired public grants',async()=>{
  const f=await fixture();const source=await ready(f);const p=await approve(f,await submit(f,[source.sample_id]));const copy=await publicCopy(p);const key=copy.private.media![0]!.object_key;
  await store.put(key,Buffer.from('changed independent public copy'),'image/png');const damaged=await managed(`/publications/${p.publication_id}/publish`,{reason:'篡改样例必须阻断',evidence_record_ids:f.rights});expect(damaged.statusCode).toBe(503);
  await store.put(key,png,'image/png');await publish(f,p);
  const clock=vi.spyOn(Date,'now').mockReturnValue(Date.now()+31*86400000);
  try {expect(await expireAuthorizedSamples(db.pool)).toBeGreaterThan(0);}finally{clock.mockRestore();}
  expect((await api('GET',`/public-samples/${copy.id}`)).statusCode).toBe(410);
  expect((await publicCopy(p)).state).toBe('EXPIRED');await drainMedia();expect(await store.exists(key)).toBe(false);
});

it('stops public downloads immediately when the frozen third-party resource is revoked',async()=>{
  const f=await fixture();const resourceId=id('resource');const resource:DTO<'ResourceOption'>={resource_version_id:resourceId,kind:'LAYOUT',name:'合成公开样例资源',license_summary:'仅限合成协议验证',usable:true};
  await db.pool.query('INSERT INTO resource_licenses(id,resource_id,version,data) VALUES($1,$1,$2,$3)',[resourceId,'synthetic-public-1',resource]);
  const edited=await api('PATCH',`/preset-drafts/${f.draft.draft_id}`,a,{expected_revision:f.draft.revision,config:{...f.draft.config,resource_version_ids:[resourceId]}});expect(edited.statusCode,edited.body).toBe(200);f.draft=edited.json().data;
  const grant=await api('POST','/rights-records',a,{scope:'THIRD_PARTY_RESOURCE',statement:'合成公开样例资源授权',resource_version_ids:[resourceId],evidence_asset_ids:[proof]});expect(grant.statusCode,grant.body).toBe(201);f.rights.push(grant.json().data.rights_record_id);
  const source=await ready(f);const p=await publish(f,await approve(f,await submit(f,[source.sample_id])));const copy=await publicCopy(p);const links=await api('GET',`/public-samples/${copy.id}`);expect(links.statusCode).toBe(200);
  await db.pool.query('UPDATE resource_licenses SET revoked_at=now() WHERE id=$1',[resourceId]);
  expect((await app.inject({method:'GET',url:localUrl(links.json().data.items[0].url)})).statusCode).toBe(410);
  await expireAuthorizedSamples(db.pool);expect((await publicCopy(p)).state).toBe('WITHDRAWN');await drainMedia();expect(await store.exists(copy.private.media![0]!.object_key)).toBe(false);
});

it('ends public distribution and stops new sales when its license retires',async()=>{
  const f=await fixture();const s=await ready(f);const p=await publish(f,await approve(f,await submit(f,[s.sample_id])));const copy=await publicCopy(p);
  const links=(await api('GET',`/public-samples/${copy.id}`)).json().data;
  const retired=await managed(`/preset-licenses/${f.license.license_id}/decision`,{expected_state:'ACTIVE',expected_content_hash:f.license.content_hash,decision:'RETIRE',review_reference:'synthetic-public-retirement',reason:'测试公开样例许可退役'});expect(retired.statusCode,retired.body).toBe(200);
  expect((await app.inject({method:'GET',url:localUrl(links.items[0].url)})).statusCode).toBe(410);
  await expireAuthorizedSamples(db.pool);expect((await publicCopy(p)).state).toBe('WITHDRAWN');await drainMedia();expect(await store.exists(copy.private.media![0]!.object_key)).toBe(false);
});

it('signs distinct retention and user-deletion scopes and keeps their public-copy behavior during journal replay',async()=>{
  const natural=await fixture();const ns=await ready(natural);const np=await publish(natural,await approve(natural,await submit(natural,[ns.sample_id])));const nc=await publicCopy(np);
  const manual=await fixture();const ms=await ready(manual);const mp=await publish(manual,await approve(manual,await submit(manual,[ms.sample_id])));const mc=await publicCopy(mp);
  const journalCfg={...cfg,privacyJournal:{enabled:true,directory:`journal-${id('public')}`,sourceId:id('source'),keyId:'synthetic-public-sample-key',hmacKey:'synthetic-public-journal-key-only-not-production'}};
  await bootstrapDeletionJournal(db.pool,journalCfg);const journal=new DeletionJournal(journalCfg);
  const retain=await transaction(db.pool,d=>requestDeletion(d,a.principal,{scope:'PRODUCT',product_id:natural.input.product_id,acknowledge_inflight_contract:true},{journal,origin:'RETENTION'}));
  const remove=await transaction(db.pool,d=>requestDeletion(d,a.principal,{scope:'PRODUCT',product_id:manual.input.product_id,acknowledge_inflight_contract:true},{journal}));
  const snapshot=await journal.snapshot();const byId=(id:string)=>snapshot.entries.find(e=>e.intent.request_id===id)!.intent;
  expect(byId(retain.deletion_id)).toMatchObject({origin:'RETENTION',authorized_sample_ids:[]});expect(byId(remove.deletion_id)).toMatchObject({origin:'USER',authorized_sample_ids:[mc.id]});
  await drainMedia();await replayDeletionJournal(db.pool,journalCfg,snapshot.sha256);await drainMedia();
  expect((await api('GET',`/public-samples/${nc.id}`)).statusCode).toBe(200);expect((await api('GET',`/public-samples/${mc.id}`)).statusCode).toBe(410);
  expect(await store.exists(nc.private.media![0]!.object_key)).toBe(true);expect(await store.exists(mc.private.media![0]!.object_key)).toBe(false);
  expect((await db.pool.query('SELECT state FROM privacy_deletions WHERE id=$1',[retain.deletion_id])).rows[0].state).toBe('PARTIAL_BLOCKED');
});

it('returns retryable 429 and Retry-After for an actual IP limit without reporting an internal failure',async()=>{
  const request=()=>app.inject({method:'GET',url:'/v1/p01/runtime-info',remoteAddress:'198.18.1.1'});
  for(let n=0;n<180;n++) expect((await request()).statusCode).toBe(200);
  const blocked=await request();expect(blocked.statusCode,blocked.body).toBe(429);expect(blocked.json()).toMatchObject({code:'RATE_LIMITED',retryable:true});expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
});

it('withdraws all of an account’s public samples while preserving a different owner’s authorized copies',async()=>{
  const keep=await fixture();const ks=await ready(keep);const kp=await publish(keep,await approve(keep,await submit(keep,[ks.sample_id])));const kc=await publicCopy(kp);
  const f=await fixture({actor:b});const s=await ready(f);const submitted=await submit(f,[s.sample_id]);
  const review=await managed(`/publications/${submitted.publication_id}/review-decisions`,{expected_revision:submitted.revision,decision:'APPROVE',reason:'独立账户清理验证',evidence_record_ids:f.rights});expect(review.statusCode,review.body).toBe(200);
  const p=review.json<{data:DTO<'Publication'>}>().data;const lease=await claimStage(db.pool,id('account_copy'),['PUBLIC_SAMPLE_PREPARE']);
  const service=new PublicSamplePreparationService(db.pool,cfg,store);await completeStage(db.pool,lease!,await service.handle(lease!,new AbortController().signal));const published=await publish(f,p);const copy=await publicCopy(published);
  const removed=await transaction(db.pool,d=>requestDeletion(d,b.principal,{scope:'ACCOUNT_MEDIA',acknowledge_inflight_contract:true}));expect(removed.state).toBe('REQUESTED');
  expect((await api('GET',`/public-samples/${copy.id}`)).statusCode).toBe(410);expect((await api('GET',`/public-samples/${kc.id}`)).statusCode).toBe(200);
  await drainMedia();expect(await store.exists(copy.private.media![0]!.object_key)).toBe(false);expect(await store.exists(kc.private.media![0]!.object_key)).toBe(true);
});
