import { beforeAll, afterAll, it, expect } from 'vitest';
import { writeFile, rm } from 'node:fs/promises';
import sharp from 'sharp';
import type { FastifyInstance, HTTPMethods } from 'fastify';
import { testDatabase, account, type TestDatabase } from '../helpers/database.js';
import { planningFixture, syntheticSse } from '../helpers/codex.js';
import { FixtureLauncher } from '../helpers/role-launcher.js';
import {withFixtureLease} from '../helpers/lease.js';
import type { NativeLaunchManifest } from '../../src/worker/codex/launcher.js';
import { buildApp } from '../../src/api/app.js';
import { insert } from '../../src/api/db/store.js';
import { transaction } from '../../src/api/db/pool.js';
import { inside } from '../../src/api/config.js';
import { LocalStorage } from '../../src/api/storage/storage.js';
import { writePrivateObject } from '../../src/api/storage/private-objects.js';
import { id, hash, sha256, addSeconds } from '../../src/api/lib/crypto.js';
import { createDraft, submitRights } from '../../src/api/modules/community.js';
import { claimStage, completeStage, type StageLease } from '../../src/worker/queue/leases.js';
import { stopScope } from '../../src/worker/lifecycle/termination.js';
import { CodexRuntimeAdapter } from '../../src/worker/codex/runtime.js';
import { ToolConsumer } from '../../src/worker/tool-gateway/consumer.js';
import { sampleTools } from '../../src/worker/tool-gateway/sample-tools.js';
import { SampleProductionService } from '../../src/worker/samples/service.js';
import { SAMPLE_STAGES, sampleContext, type SampleContext } from '../../src/worker/samples/context.js';
import { samplePacket, packetAssetIds, validateSampleReview, type SampleReview } from '../../src/worker/samples/review.js';
import { verifyCompletedSample } from '../../src/worker/samples/completion.js';
import { FONT_BINDING } from '../../src/worker/media/font.js';
import type { DTO } from '../../src/shared/contracts/types.js';
import { PublicSamplePreparationService } from '../../src/worker/samples/publication.js';
import type { AuthorizedRow } from '../../src/api/modules/authorized-samples.js';

/** Synthetic identities/AI only; PostgreSQL, HTTPS, MCP, PNG, MP4, receipts and
 * sample DAG are real native operations. No paid order or real model is used. */
class SampleLauncher extends FixtureLauncher {
  override async launch(path: string, manifest: NativeLaunchManifest) {
    const result = await super.launch(path, manifest);
    result.receipt.os_identity_ref = `SYNTHETIC-NOT-RESTRICTED:${manifest.run_id}`;
    return result;
  }
}
let db: TestDatabase; let app: FastifyInstance; let f: Awaited<ReturnType<typeof planningFixture>>;
let actor: Awaited<ReturnType<typeof account>>; let outsider: typeof actor; let store: LocalStorage;
let rights: string[]; let draft: DTO<'PresetDraft'>; let sample: DTO<'Sample'>; let completed: SampleContext;
let controller: AbortController; let consumer: Promise<void>; let service: SampleProductionService;
const upstreamImages: number[] = []; const launcher = new SampleLauncher();
let ambiguousNext = false;
const publicationAdmin='synthetic-produced-sample-admin';
const blueprint = 'blueprint.minimal-clean.photo-layout';
function api(method: HTTPMethods, path: string, body?: unknown, who = actor, key = id('request')) {
  return app.inject({ method, url: `/v1/p01${path}`, headers: { authorization: `Bearer ${who.accessToken}`,
    ...(method !== 'GET' ? { 'idempotency-key': key } : {}), ...(body !== undefined ? { 'content-type': 'application/json' } : {}) },
    ...(body !== undefined ? { payload: JSON.stringify(body) } : {}) });
}
const request = (d = draft): DTO<'SampleRequest'> => ({ draft_revision: d.revision, product_id: f.product.product_id,
  profile_id: f.profile.profile_id, variant_blueprint_id: d.config.variant_blueprint_ids[0]!, rights_record_ids: rights });
async function heartbeat(handlers: readonly string[] = SAMPLE_STAGES) {
  await db.pool.query(`INSERT INTO worker_heartbeats(id,last_seen_at,data) VALUES('sample-test-worker',now(),$1)
    ON CONFLICT(id) DO UPDATE SET last_seen_at=now(),data=excluded.data`, [{ stage_handlers: handlers }]);
}
async function create(d = draft) {
  await heartbeat();
  const result = await api('POST', `/preset-drafts/${d.draft_id}/samples`, request(d));
  expect(result.statusCode, result.body).toBe(202); return result.json<{ data: DTO<'Sample'> }>().data;
}
async function stop(s: DTO<'Sample'>) { await transaction(db.pool, d => stopScope(d, { tenantId: f.p.tenantId, type: 'SAMPLE', id: s.sample_id }, 'TEST_CANCELLED')); }
async function run(name: string, s = sample, mode?: string) {
  const lease = (await claimStage(db.pool, id('sample-worker'), [name]))!;
  expect(lease?.scope_id).toBe(s.sample_id);
  const active = mode ? new SampleProductionService(db.pool, f.cfg, store, new CodexRuntimeAdapter(db.pool, f.cfg, new SampleLauncher(mode))) : service;
  const commit=await withFixtureLease(db.pool,lease,signal=>active.handle(lease,signal),controller.signal);
  await completeStage(db.pool,lease,commit);
  return lease;
}
beforeAll(async () => {
  db = await testDatabase(); const assets = [id('photo'), id('photo'), id('photo')]; f = await planningFixture(db, assets);
  await db.pool.query("UPDATE stage_runs SET state='CANCELLED' WHERE id=$1", [f.lease.id]);
  f.cfg.generationEnabled = true; f.cfg.samples = { costCeilingMicro: 1_000_000, dailyBudgetMicro: 10_000_000, maxConcurrent: 1, deadlineSeconds: 3600 };
  f.cfg.codex.maxInputTokens = 250_000; f.cfg.codex.maxOutputTokens = 20_000;
  f.admission.review_vision = { evidence_sha256: 'f'.repeat(64), detail: 'original', max_images: 100,
    max_image_bytes: 2_000_000, max_image_pixels: 30_000_000, max_total_image_bytes: 24_000_000, tokens_per_image_bound: 100 };
  f.admission.max_request_bytes = 36_000_000;
  await writeFile(f.cfg.codex.admissionPath, JSON.stringify(f.admission));
  actor = await account(db, f.p.subjectId); outsider = await account(db); store = new LocalStorage(f.cfg);
  const bytes = await sharp({ create: { width: 800, height: 1000, channels: 3, background: '#2675A4' } }).png().toBuffer();
  const photoId = (await db.pool.query('SELECT photo_version_id FROM profile_versions WHERE id=$1', [f.profile.profile_id])).rows[0].photo_version_id as string;
  for (const [position, assetId] of assets.entries()) {
    const key = `${f.p.tenantId}/source/${assetId}.png`;
    await insert(db.pool, 'assets', { id: assetId, tenant_id: f.p.tenantId, owner_id: f.p.userId, product_id: f.product.product_id,
      purpose: 'PRODUCT_PHOTO', state: 'READY', object_key: key, upload_token_hash: sha256(id('unused')), expected_bytes: bytes.length,
      declared_mime: 'image/png', sha256: sha256(bytes), expected_sha256: sha256(bytes), size_bytes: bytes.length, width: 800, height: 1000,
      expires_at: addSeconds(86400), grant_expires_at: addSeconds(300), data: {} });
    await writePrivateObject(db.pool, store, { tenantId: f.p.tenantId, ownerId: f.p.userId, productId: f.product.product_id, assetId, kind: 'INPUT' }, key, bytes, 'image/png');
    await insert(db.pool, 'product_photo_items', { id: id('photo-item'), tenant_id: f.p.tenantId, photo_version_id: photoId, asset_id: assetId, position });
  }
  await db.pool.query('UPDATE product_photo_versions SET photo_set_hash=$2 WHERE id=$1', [photoId, hash({ photos: assets.map(asset_id => ({ asset_id, sha256: sha256(bytes) })), revision: 1, normalization: 'sharp-auto-orient-strip-png-v1' })]);
  const evidence = id('rights-proof'); const evidenceKey = `${f.p.tenantId}/proof/${evidence}.png`;
  await insert(db.pool, 'assets', { id: evidence, tenant_id: f.p.tenantId, owner_id: f.p.userId, purpose: 'RIGHTS_EVIDENCE', state: 'READY',
    object_key: evidenceKey, upload_token_hash: sha256(id('unused')), expected_bytes: bytes.length, declared_mime: 'image/png',
    sha256: sha256(bytes), expected_sha256: sha256(bytes), size_bytes: bytes.length, expires_at: addSeconds(86400), grant_expires_at: addSeconds(300), data: {} });
  await writePrivateObject(db.pool, store, { tenantId: f.p.tenantId, ownerId: f.p.userId, assetId: evidence, kind: 'INPUT' }, evidenceKey, bytes, 'image/png');
  rights = [];
  for (const scope of ['OWNED_PRODUCT','SAMPLE_PUBLICATION'] as const) rights.push((await submitRights(db.pool, f.p, {
    scope, product_id: f.product.product_id, statement: 'Synthetic sample protocol test only.', evidence_asset_ids: [evidence] })).rights_record_id);
  draft = await createDraft(db.pool, f.p, { name: 'Synthetic quiet style / minimal blueprint', description: 'Native sample test only.',
    style_tags: ['静谧'], parent_preset_version: null, component_versions: ['style.quiet-luxury.1'], variant_blueprint_ids: [blueprint], resource_version_ids: [], fork_allowed: true });
  f.cfg.publishingEnabled=true;f.cfg.managementTokens=JSON.stringify([{actor:'fixture-produced-sample-reviewer',token_hash:sha256(publicationAdmin),permissions:['*']}]);
  app = await buildApp({ cfg: f.cfg, pool: db.pool, storage: store, inferenceHttp: async (_cfg, _url, options) => {
    const body = JSON.parse(options!.body!.toString()); const content = body.input[0].content;
    upstreamImages.push(Array.isArray(content) ? content.filter((v: { type: string }) => v.type === 'input_image').length : 0);
    if (ambiguousNext) { ambiguousNext = false; throw new Error('Synthetic ambiguous inference submission.'); }
    return { status: 200, headers: { 'content-type': 'text/event-stream' }, bytes: syntheticSse(f.admission), json: () => null };
  } });
  await app.listen({ host: '127.0.0.1', port: 0 }); const address = app.server.address();
  if (!address || typeof address === 'string') throw new Error('Missing test HTTPS listener'); f.cfg.publicBaseUrl = `https://localhost:${address.port}`;
  controller = new AbortController(); consumer = new ToolConsumer(db.pool, id('sample-tools'), sampleTools(db.pool, f.cfg, store)).run(controller.signal);
  service = new SampleProductionService(db.pool, f.cfg, store, new CodexRuntimeAdapter(db.pool, f.cfg, launcher)); await heartbeat();
});
afterAll(async () => {
  controller?.abort(); await consumer; await app?.close(); await db?.close();
  if (f?.dir) await rm(inside(db.cfg.projectRoot, f.dir), { recursive: true, force: true });
});

it('requires all seven live handlers and configured independent budgets before queuing', async () => {
  await heartbeat(['SAMPLE']); const incomplete = await api('POST', `/preset-drafts/${draft.draft_id}/samples`, request());
  expect(incomplete.statusCode).toBe(503); expect(incomplete.json().code).toBe('SAMPLE_SERVICE_UNAVAILABLE'); await heartbeat();
  const ceiling = f.cfg.samples.costCeilingMicro; f.cfg.samples.costCeilingMicro = 0;
  try { const missing = await api('POST', `/preset-drafts/${draft.draft_id}/samples`, request()); expect(missing.json().code).toBe('SAMPLE_LIMITS_NOT_CONFIGURED'); }
  finally { f.cfg.samples.costCeilingMicro = ceiling; }
  expect((await db.pool.query("SELECT count(*)::int AS n FROM stage_runs WHERE scope_type='SAMPLE'")).rows[0].n).toBe(0);
  expect(upstreamImages).toHaveLength(0);
});
it('produces actual full-spec photos/video/copy through five fresh synthetic roles without an order or buyer charge', async () => {
  sample = await create(); const state = (await db.pool.query('SELECT * FROM stage_runs WHERE scope_type=$1 AND scope_id=$2 ORDER BY created_at', ['SAMPLE', sample.sample_id])).rows;
  expect(state).toHaveLength(7); expect(new Set(state.map(s => s.input_hash)).size).toBe(1); expect(new Set(state.map(s => s.deadline_at.toISOString())).size).toBe(1);
  const first = await sampleContext(db.pool, f.p.tenantId, sample.sample_id);
  expect(first.input.skill_variant_id).toBe('quiet-luxury.photo-layout'); expect(first.input.source.variant_id).toBe('minimal-clean.photo-layout');
  const concurrent = await api('POST', `/preset-drafts/${draft.draft_id}/samples`, request()); expect(concurrent.statusCode).toBe(429);
  for (const name of SAMPLE_STAGES) await run(name);
  completed = await sampleContext(db.pool, f.p.tenantId, sample.sample_id, undefined, false, true);
  await verifyCompletedSample(db.pool, f.cfg, f.p.tenantId, sample.sample_id, completed.private);
  expect(launcher.launches).toBe(5); expect(upstreamImages.slice(0,3)).toEqual([0,0,0]);
  expect(upstreamImages[3]).toBeGreaterThan(10); expect(upstreamImages[4]).toBe(upstreamImages[3]);
  expect((await db.pool.query('SELECT count(*)::int AS n FROM orders')).rows[0].n).toBe(0);
  expect((await db.pool.query('SELECT count(*)::int AS n FROM budget_reservations')).rows[0].n).toBe(0);
  expect((await db.pool.query('SELECT scope_id,reserved_micro,spent_micro FROM platform_cost_accounts')).rows).toEqual([expect.objectContaining({ scope_id: expect.stringContaining('CODEX_SAMPLE:'), reserved_micro: '0', spent_micro: '650' })]);
  const runs = (await db.pool.query('SELECT state,role_identity_ref,private FROM agent_runs')).rows;
  expect(runs).toHaveLength(5); expect(runs.every(r => r.state === 'SUCCEEDED')).toBe(true);
  expect(new Set(runs.map(r => r.role_identity_ref)).size).toBe(5);
  expect((await db.pool.query("SELECT count(*)::int AS n FROM agent_instances WHERE state<>'RELEASED'")).rows[0].n).toBe(0);
});
it('serves only private owned sample files and rejects post-QC byte tampering', async () => {
  const denied = await api('POST', `/preset-samples/${sample.sample_id}/media-links`, undefined, outsider); expect(denied.statusCode).toBe(404);
  const response = await api('POST', `/preset-samples/${sample.sample_id}/media-links`); expect(response.statusCode, response.body).toBe(200);
  const media = response.json<{ data: DTO<'SampleMedia'> }>().data; expect(media.label).toBe('PRIVATE_CREATOR_SAMPLE');
  const url = new URL(media.items[0]!.url); const downloaded = await app.inject({ method: 'GET', url: url.pathname + url.search });
  expect(downloaded.statusCode, downloaded.body.slice(0,100)).toBe(200);
  const item = (completed.private.media as { object_key: string; sha256: string }[])[0]!; expect(sha256(downloaded.rawPayload)).toBe(item.sha256);
  const original = await store.get(item.object_key, 125_000_000); await store.put(item.object_key, Buffer.from('tampered'), 'image/png');
  try {
    const rejected = await app.inject({ method: 'GET', url: url.pathname + url.search }); expect(rejected.statusCode).toBe(422); expect(rejected.json().code).toBe('SAMPLE_MEDIA_CHANGED');
    await expect(verifyCompletedSample(db.pool, f.cfg, f.p.tenantId, sample.sample_id, completed.private)).rejects.toMatchObject({ code: 'REVIEW_IMAGE_INVALID' });
  } finally { await store.put(item.object_key, original, 'image/png'); }
});
it('publishes the actually produced complete sample as independent public PNG/MP4 copies without repeating any model work',async()=>{
  const managed=(path:string,body:unknown)=>app.inject({method:'POST',url:`/v1/internal/p01${path}`,remoteAddress:'198.19.0.1',
    headers:{authorization:`Bearer ${publicationAdmin}`,'idempotency-key':id('management'),'content-type':'application/json'},payload:JSON.stringify(body)});
  const licenseId=id('license');const text='Synthetic license for actual sample production integration only. No production rights are granted.';
  const registered=await managed('/preset-licenses',{license_id:licenseId,version:'1.0.0',name:'合成样例全流程测试许可',full_text:text,fork_allowed:true,attribution_required:true});expect(registered.statusCode,registered.body).toBe(200);
  const license=registered.json<{data:DTO<'PresetLicense'>}>().data;
  expect((await managed(`/preset-licenses/${licenseId}/decision`,{expected_state:'DRAFT',expected_content_hash:license.content_hash,decision:'APPROVE',review_reference:'synthetic-complete-sample',reason:'仅测试许可协议'})).statusCode).toBe(200);
  const submitted=await api('POST',`/preset-drafts/${draft.draft_id}/submit`,{expected_revision:draft.revision,sample_ids:[sample.sample_id],rights_record_ids:rights,
    license_version:licenseId,license_content_hash:license.content_hash,accept_license:true,accept_sample_publication:true,public_sample_retention_days:30});expect(submitted.statusCode,submitted.body).toBe(202);
  const p=submitted.json<{data:DTO<'Publication'>}>().data;
  const reviewed=await managed(`/publications/${p.publication_id}/review-decisions`,{expected_revision:p.revision,decision:'APPROVE',reason:'核对实际原图无声样例与全部授权',evidence_record_ids:rights});expect(reviewed.statusCode,reviewed.body).toBe(200);
  const inferenceBefore=(await db.pool.query('SELECT count(*)::int AS n FROM inference_requests')).rows[0].n;const rolesBefore=launcher.launches;
  const lease=await claimStage(db.pool,id('public_sample_worker'),['PUBLIC_SAMPLE_PREPARE']);expect(lease?.scope_id).toBe(p.publication_id);
  const service=new PublicSamplePreparationService(db.pool,f.cfg,store);await completeStage(db.pool,lease!,await service.handle(lease!,controller.signal));
  const published=await managed(`/publications/${p.publication_id}/publish`,{reason:'发布独立样例协议验证',evidence_record_ids:rights});expect(published.statusCode,published.body).toBe(200);
  const copy=(await db.pool.query<AuthorizedRow>('SELECT * FROM authorized_samples WHERE publication_id=$1',[p.publication_id])).rows[0]!;
  expect(copy.private.input.source_completion_hash).toBe(hash(completed.private.completion));expect(copy.private.media).toHaveLength((completed.private.media as unknown[]).length);
  expect(copy.private.media!.some(m=>m.kind==='video')).toBe(true);expect(copy.private.media!.some(m=>m.kind==='image')).toBe(true);
  const links=await app.inject({method:'GET',url:`/v1/p01/public-samples/${copy.id}`});expect(links.statusCode,links.body).toBe(200);
  const outputs=links.json<{data:DTO<'SampleMedia'>}>().data;
  for (const [i,item] of copy.private.media!.entries()) {
    const url=new URL(outputs.items[i]!.url);const download=await app.inject({method:'GET',url:url.pathname+url.search});expect(download.statusCode).toBe(200);expect(sha256(download.rawPayload)).toBe(item.sha256);
    expect((await db.pool.query('SELECT product_id,authorized_sample_id FROM private_object_writes WHERE object_key=$1',[item.object_key])).rows[0]).toMatchObject({product_id:null,authorized_sample_id:copy.id});
  }
  expect((await db.pool.query('SELECT visibility FROM public_samples WHERE id=$1',[sample.sample_id])).rows[0].visibility).toBe('PRIVATE');
  expect((await db.pool.query('SELECT count(*)::int AS n FROM inference_requests')).rows[0].n).toBe(inferenceBefore);expect(launcher.launches).toBe(rolesBefore);
  expect((await db.pool.query('SELECT id FROM orders')).rowCount).toBe(0);
  const scoped=(await db.pool.query<{table_name:string;id:string;owner_id:string}>('SELECT table_name,id,owner_id FROM privacy_content_scope WHERE tenant_id=$1 AND product_id=$2',[f.p.tenantId,f.product.product_id])).rows;
  expect(scoped.some(r=>r.table_name==='public_samples' && r.id===sample.sample_id && r.owner_id===f.p.userId)).toBe(true);
  const stages=(await db.pool.query<{id:string}>("SELECT id FROM stage_runs WHERE tenant_id=$1 AND scope_type='SAMPLE' AND scope_id=$2",[f.p.tenantId,sample.sample_id])).rows;
  for (const stage of stages) expect(scoped.some(r=>r.table_name==='stage_runs' && r.id===stage.id && r.owner_id===f.p.userId)).toBe(true);
  const instances=(await db.pool.query<{id:string}>('SELECT id FROM agent_instances WHERE tenant_id=$1 AND preview_session_id=$2',[f.p.tenantId,sample.sample_id])).rows;
  expect(instances).toHaveLength(5);
  for (const instance of instances) expect(scoped.some(r=>r.table_name==='agent_instances' && r.id===instance.id && r.owner_id===f.p.userId)).toBe(true);
});
it('rejects incomplete, wrong-packet and forged PASS reports and changed completion bindings', async () => {
  const saved = (completed.private.review_reports as Record<string, { run_id: string; report: SampleReview }>).REVIEW_FACTS!;
  await expect(validateSampleReview(db.pool, f.cfg, completed, saved.run_id, { ...saved.report, checked_asset_ids: saved.report.checked_asset_ids.slice(1) }, true)).rejects.toMatchObject({ code: 'SAMPLE_REVIEW_INCOMPLETE' });
  await expect(validateSampleReview(db.pool, f.cfg, completed, saved.run_id, { ...saved.report, packet_hash: '0'.repeat(64) }, true)).rejects.toMatchObject({ code: 'SAMPLE_REVIEW_INCOMPLETE' });
  const wrong = { ...completed, private: { ...completed.private, review_reports: {} } };
  await expect(validateSampleReview(db.pool, f.cfg, wrong, saved.run_id, saved.report, true)).rejects.toMatchObject({ code: 'SAMPLE_REVIEW_NOT_PERSISTED' });
  const forged = { ...saved.report, verdict: 'FAIL' as const, issues: [{ asset_id: saved.report.checked_asset_ids[0]!, code: 'QUALITY', message: 'Synthetic forged replacement.' }] };
  const replaced = { ...completed, private: { ...completed.private, review_reports: { REVIEW_FACTS: { run_id: saved.run_id, report: forged, hash: hash(forged) } } } };
  await expect(validateSampleReview(db.pool, f.cfg, replaced, saved.run_id, forged, true)).rejects.toMatchObject({ code: 'SAMPLE_REVIEW_NOT_PERSISTED' });
  const binding = completed.private.completion;
  await db.pool.query("UPDATE public_samples SET private=jsonb_set(private,'{completion}','{}') WHERE id=$1", [sample.sample_id]);
  try { await expect(verifyCompletedSample(db.pool, f.cfg, f.p.tenantId, sample.sample_id, completed.private)).rejects.toMatchObject({ code: 'SAMPLE_COMPLETION_CHANGED' }); }
  finally { await db.pool.query("UPDATE public_samples SET private=jsonb_set(private,'{completion}',$2) WHERE id=$1", [sample.sample_id, binding]); }
  expect(packetAssetIds(samplePacket(completed))).toHaveLength(saved.report.checked_asset_ids.length);
});
it('does not accept READY/QC flags or test-fixture markers outside APP_ENV=test', async () => {
  await expect(verifyCompletedSample(db.pool, { ...f.cfg, env: 'development' }, f.p.tenantId, sample.sample_id, { qc_passed: true, test_fixture: true })).rejects.toMatchObject({ code: 'SAMPLE_EXECUTION_UNVERIFIED' });
});
it('recovers the original content checkpoint after lease takeover without another role or inference', async () => {
  const s = await create(); const lease = (await claimStage(db.pool, id('old-sample-worker'), ['SAMPLE']))!;
  const calls = upstreamImages.length; const launches = launcher.launches;
  const oldCommit = await service.handle(lease, controller.signal);
  const fresh = (await db.pool.query<StageLease>(`UPDATE stage_runs SET fencing_token=fencing_token+1,lease_owner='new-sample-worker',
    lease_expires_at=now()+interval '30 seconds' WHERE id=$1 RETURNING *`, [lease.id])).rows[0]!;
  await expect(completeStage(db.pool, lease, oldCommit)).rejects.toMatchObject({ code: 'LEASE_LOST' });
  await completeStage(db.pool, fresh, await service.handle(fresh, controller.signal));
  expect(upstreamImages.length - calls).toBe(1); expect(launcher.launches - launches).toBe(1);
  expect((await sampleContext(db.pool, f.p.tenantId, s.sample_id)).private.creative_hash).toMatch(/^[a-f0-9]{64}$/);
  await stop(s);
});
it('checks the frozen sample cost ceiling before submitting any upstream request', async () => {
  const ceiling = f.cfg.samples.costCeilingMicro; f.cfg.samples.costCeilingMicro = 1; let s: DTO<'Sample'> | undefined;
  try {
    s = await create(); const lease = (await claimStage(db.pool, id('sample-budget-worker'), ['SAMPLE']))!; const calls = upstreamImages.length;
    await expect(service.handle(lease, controller.signal)).rejects.toThrow(); expect(upstreamImages).toHaveLength(calls);
    expect((await db.pool.query("SELECT count(*)::int AS n FROM inference_requests WHERE scope_id=$1", [s.sample_id])).rows[0].n).toBe(0);
  } finally { f.cfg.samples.costCeilingMicro = ceiling; if (s) await stop(s); }
});
it('holds an ambiguous sample reservation and does not rebuy inference on stage recovery', async () => {
  const s = await create(); const lease = (await claimStage(db.pool, id('sample-unknown-worker'), ['SAMPLE']))!;
  const calls = upstreamImages.length; ambiguousNext = true;
  try {
    await expect(service.handle(lease, controller.signal)).rejects.toThrow();
    const rows = (await db.pool.query("SELECT state,private FROM inference_requests WHERE scope_id=$1", [s.sample_id])).rows;
    expect(rows).toHaveLength(1); expect(rows[0].state).toBe('UNKNOWN');
    expect((await db.pool.query('SELECT state FROM platform_budget_reservations WHERE id=$1', [rows[0].private.reservation_id])).rows[0].state).toBe('UNKNOWN');
    await expect(service.handle(lease, controller.signal)).rejects.toMatchObject({ code: 'SAMPLE_PREVIOUS_ROLE_UNRESOLVED' });
    expect(upstreamImages.length - calls).toBe(1);
  } finally { ambiguousNext = false; await stop(s); }
});
it('rechecks the pinned resource license before completed samples can be published', async () => {
  await db.pool.query('UPDATE resource_licenses SET revoked_at=now() WHERE id=$1', [FONT_BINDING.license_record_id]);
  try { await expect(verifyCompletedSample(db.pool, f.cfg, f.p.tenantId, sample.sample_id, completed.private)).rejects.toMatchObject({ code: 'RESOURCE_LICENSE_UNAVAILABLE' }); }
  finally { await db.pool.query('UPDATE resource_licenses SET revoked_at=NULL WHERE id=$1', [FONT_BINDING.license_record_id]); }
});
it('fails closed for unsupported generated blueprints before any sample stages or inference', async () => {
  const other = await createDraft(db.pool, f.p, { ...draft.config, component_versions: ['style.quiet-luxury.1'], variant_blueprint_ids: ['blueprint.quiet-luxury.ai-detail'] });
  const calls = upstreamImages.length; const result = await api('POST', `/preset-drafts/${other.draft_id}/samples`, request(other));
  expect(result.statusCode).toBe(503); expect(result.json().code).toBe('SAMPLE_ROUTE_UNAVAILABLE'); expect(upstreamImages).toHaveLength(calls);
});
it('stops a deleted or expired input before consuming any inference budget', async () => {
  const s = await create(); const lease = (await claimStage(db.pool, id('revoked-worker'), ['SAMPLE']))!; const calls = upstreamImages.length;
  await db.pool.query('UPDATE product_drafts SET deleted_at=now() WHERE id=$1', [f.product.product_id]);
  try { await expect(service.handle(lease, controller.signal)).rejects.toMatchObject({ code: 'SAMPLE_INPUT_UNAVAILABLE' }); expect(upstreamImages).toHaveLength(calls); }
  finally { await db.pool.query('UPDATE product_drafts SET deleted_at=NULL WHERE id=$1', [f.product.product_id]); await stop(s); }
});
it('refuses a revoked publication grant for already completed media links', async () => {
  const grant = rights[1]!; await db.pool.query("UPDATE rights_records SET state='REVOKED',data=data||'{\"state\":\"REVOKED\"}'::jsonb WHERE id=$1", [grant]);
  try { const r = await api('POST', `/preset-samples/${sample.sample_id}/media-links`); expect(r.statusCode).toBe(409); expect(r.json().code).toBe('SAMPLE_RIGHTS_REVOKED'); }
  finally { await db.pool.query("UPDATE rights_records SET state='SUBMITTED',data=data||'{\"state\":\"SUBMITTED\"}'::jsonb WHERE id=$1", [grant]); }
});
