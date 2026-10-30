import {readFile,mkdir} from 'node:fs/promises';
import {nativeSampleRegistry} from '../helpers/native-sample.js';
import {SpeechClient} from '../../src/worker/providers/dashscope-asr.js';
import {ListeningClient} from '../../src/worker/providers/omni-listening.js';
import {SampleSpeechGateway} from '../../src/worker/samples/speech.js';
import {SampleListeningGateway} from '../../src/worker/samples/listening.js';
import {syntheticControlListeningPass,syntheticListeningResult,listeningSse} from '../helpers/listening.js';
import {sampleNativeSource} from '../../src/worker/samples/native-media.js';
import {publicSampleMedia,expireAuthorizedSamples} from '../../src/api/modules/authorized-samples.js';
import {syntheticArkContract} from '../helpers/generation.js';
import {ArkClient,type ArkContract} from '../../src/worker/providers/ark.js';
import type {HttpResponse} from '../../src/api/lib/http.js';
import {nativeCommand} from '../../src/worker/media/native.js';
import {sampleGenerationGateway,sampleGenerationContext} from '../../src/worker/samples/generation.js';
import {referenceRequest} from '../../src/worker/generation/requests.js';
import {PendingExternal} from '../../src/worker/queue/leases.js';
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
import { SAMPLE_STAGES, sampleContext,samplePlan, type SampleContext } from '../../src/worker/samples/context.js';
import { samplePacket, packetAssetIds, validateSampleReview, type SampleReview } from '../../src/worker/samples/review.js';
import { verifyCompletedSample } from '../../src/worker/samples/completion.js';
import { FONT_BINDING } from '../../src/worker/media/font.js';
import type { DTO } from '../../src/shared/contracts/types.js';
import { PublicSamplePreparationService } from '../../src/worker/samples/publication.js';
import type { AuthorizedRow } from '../../src/api/modules/authorized-samples.js';
import {storedMedia,artifactBytes} from '../../src/worker/samples/media.js';

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
async function publishProducedSample(draft:DTO<'PresetDraft'>,sample:DTO<'Sample'>,completed:SampleContext){
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
  expect(instances).toHaveLength(completed.input.generation?6:5);
  for (const instance of instances) expect(scoped.some(r=>r.table_name==='agent_instances' && r.id===instance.id && r.owner_id===f.p.userId)).toBe(true);
}
it('publishes the actually produced complete sample as independent public PNG/MP4 copies without repeating any model work',()=>publishProducedSample(draft,sample,completed));
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
it('fails closed for generated blueprints without admitted model protocols before any sample stages or inference', async () => {
  const other = await createDraft(db.pool, f.p, { ...draft.config, component_versions: ['style.quiet-luxury.1'], variant_blueprint_ids: ['blueprint.quiet-luxury.ai-detail'] });
  const calls = upstreamImages.length; const result = await api('POST', `/preset-drafts/${other.draft_id}/samples`, request(other));
  expect(result.statusCode).toBe(503); expect(['GENERATION_MODEL_NOT_ADMITTED','GENERATION_MODEL_BINDING_INVALID','ARK_CONTRACT_INVALID','ARK_CONTRACT_NOT_ADMITTED','SAMPLE_GENERATION_NOT_CONFIGURED']).toContain(result.json().code); expect(upstreamImages).toHaveLength(calls);
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

/** Real native sample pipeline, synthetic model bytes/meaning/identities only. */
async function generatedFixture(engine:'PER_SHOT_AI'|'REFERENCE_FILM',lostAck=false,components:string[]=[],native:boolean|'ORDER_ONLY'=false){
  const contracts=[syntheticArkContract('IMAGE'),syntheticArkContract('VIDEO')];
  const image=contracts[0]!,video=contracts[1]!;
  if(components.length||native)video.video!.durations=[1,2];video.video!.native_audio=!!native;
  video.video!.ratios=['9:16'];video.video!.dimensions=[{resolution:'480p',ratio:'9:16',width:360,height:640}];
  const variant=engine==='PER_SHOT_AI'?'quiet-luxury.ai-detail':'portrait-social.ai-presenter-multi';
  const style=engine==='PER_SHOT_AI'?'quiet-luxury':'portrait-social';
  const row=(await db.pool.query('SELECT id,private FROM execution_variants WHERE variant_id=$1',[variant])).rows[0]!;
  const source=row.private.source;source.audio_policy={...source.audio_policy,speech:'none',language:null,preserve_native_speech:false,caption_alignment:'NO_SPEECH',music:'none'};
  const duration=engine==='PER_SHOT_AI'||components.length||native?2:1;
  source.ai_disclosure_required=true;source.timeline_policy={fps:30,target_frames:duration*30,base_segments:duration===2?
    [{role:'whole',start_seconds:0,end_seconds:1},{role:'detail',start_seconds:1,end_seconds:2}]:[{role:'show',start_seconds:0,end_seconds:1}]};
  source.output_slots=source.output_slots.filter((o:{kind:string})=>o.kind!=='video').slice(0,1);
  source.output_slots.push({slot_id:'video-main',kind:'video',width:1080,height:1920,fps:30,duration_seconds:duration,role:'main'});
  for(const c of contracts){const binding={provider:c.provider,actual_model:c.actual_model,registry_version:c.registry_version,
    roles:[c.wire==='ARK_IMAGE'?'IMAGE':'VIDEO'],capability_hash:hash(c),rate_snapshot_id:c.rate_snapshot_id};
    await insert(db.pool,'provider_model_versions',{id:c.model_version_id,provider:c.provider,actual_model:c.actual_model,status:'ADMITTED',version:c.registry_version,data:binding,private:{ark_contract:c}});}
  const registry=native?await nativeSampleRegistry(db,f.cfg,source,video,native==='ORDER_ONLY'?'ORDER':'SAMPLE'):undefined;
  await db.pool.query(`UPDATE execution_variants SET private=private||jsonb_build_object('source',$2::jsonb,'model_version_ids',$3::jsonb,'sample_native_voice',$4::jsonb) WHERE id=$1`,[row.id,JSON.stringify(source),JSON.stringify([...contracts.map(c=>c.model_version_id),...(registry?[registry.speech.model_version_id,registry.listening.model_version_id]:[])]),JSON.stringify(registry?{character_version_id:registry.character.character_version_id,native_voice_id:registry.character.native_voice_id}:null)]);
  Object.assign(f.cfg.provider,{baseUrl:image.base_url,apiKey:'synthetic-not-real',imageModel:image.request_model,videoModel:video.request_model});
  f.cfg.provider.allowedHosts=[...new Set([...f.cfg.provider.allowedHosts,'generation.example.test','media.example.test'])];
  const d=await createDraft(db.pool,f.p,{...draft.config,name:'Synthetic generated '+engine,component_versions:[`style.${style}.1`,...components],variant_blueprint_ids:[`blueprint.${variant}`]});
  const directory=inside(f.cfg.runtimeRoot,`tests/generated-sample/${id('media')}`);await mkdir(directory,{recursive:true});
  const videoPath=inside(directory,'provider.mp4');
  await nativeCommand(f.cfg,process.env.FFMPEG_PATH?.trim()||'ffmpeg',['-v','error','-f','lavfi','-i','color=c=green:s=360x640:r=30',...(native?['-f','lavfi','-i','sine=frequency=660:sample_rate=48000']:[]),'-t',engine==='REFERENCE_FILM'&&(components.length||native)?'2':'1',...(native?['-c:a','aac','-b:a','192k','-ac','2']:['-an']),'-c:v','libx264','-pix_fmt','yuv420p',videoPath],{cwd:directory,timeoutMs:30000});
  const videoBytes=await readFile(videoPath),imageBytes=await sharp({create:{width:640,height:800,channels:3,background:'#1F5F43'}}).png().toBuffer();
  const calls:{method:string;url:string}[]=[];let task=0;
  const http=(value:unknown):HttpResponse=>{const bytes=Buffer.isBuffer(value)?value:Buffer.from(JSON.stringify(value));return {status:200,headers:{},bytes,json:()=>JSON.parse(bytes.toString('utf8'))};};
  const gateway=sampleGenerationGateway(db.pool,f.cfg,store,new ArkClient(f.cfg,async(url,_hosts,options={})=>{
    calls.push({method:options.method??'GET',url});if(lostAck)throw new Error('Synthetic lost sample ACK');
    if(url.includes('/images/generations'))return http({model:image.actual_model,data:[{b64_json:imageBytes.toString('base64')}],usage:{generated_images:1}});
    if(options.method==='POST')return http({id:`sample-task-${++task}`});
    if(url.startsWith('https://media.example.test/'))return http(videoBytes);
    return http({id:url.split('/').at(-1),model:video.actual_model,status:'succeeded',content:{video_url:'https://media.example.test/generated.mp4'},usage:{completion_tokens:250,total_tokens:250}});
  }));
  const old=consumer;controller.abort();await old;controller=new AbortController();
  const audioCalls={asrPosts:0,queries:0,listening:0,unknownAsr:false,blockListening:false};let signedInput='';
  const sampleStore=Object.assign(Object.create(store) as LocalStorage,{signedReadUrl:(key:string,expiry:Date)=>`https://input.example.test/${key}?Expires=${Math.floor(expiry.getTime()/1000)}&Signature=SYNTHETIC`});
  const speech=registry?new SampleSpeechGateway(db.pool,f.cfg,sampleStore,new SpeechClient(f.cfg,async(url,_hosts,options={})=>{
    if(options.method==='POST'){audioCalls.asrPosts++;signedInput=JSON.parse(String(options.body)).input.file_url as string;
      if(audioCalls.unknownAsr)throw new Error('Synthetic sample ASR lost ACK');
      return http({request_id:'synthetic-request',output:{task_id:'synthetic-sample-asr',task_status:'PENDING'}});}
    if(url.startsWith('https://result.example.test/'))return http({file_url:signedInput,transcripts:[{channel_id:0,text:'商品实拍。',sentences:[{begin_time:100,end_time:800,language:'zh',text:'商品实拍。',words:[{begin_time:100,end_time:400,text:'商品',punctuation:''},{begin_time:400,end_time:800,text:'实拍',punctuation:'。'}]}]}]});
    audioCalls.queries++;return http({request_id:'synthetic-query',output:{task_id:'synthetic-sample-asr',task_status:'SUCCEEDED',result:{transcription_url:'https://result.example.test/sample.json'}},usage:{seconds:duration}});
  })):undefined;
  const listeningClient=new ListeningClient(f.cfg);
  listeningClient.submit=async(c,prepared)=>{audioCalls.listening++;const result=audioCalls.blockListening?syntheticListeningResult(prepared.summary):syntheticControlListeningPass(prepared.summary);
    return {...http(listeningSse(c,result)),headers:{'content-type':'text/event-stream'}};};
  const listening=registry?new SampleListeningGateway(db.pool,f.cfg,sampleStore,listeningClient):undefined;
  consumer=new ToolConsumer(db.pool,id('generated-sample-tools'),sampleTools(db.pool,f.cfg,sampleStore,gateway,speech)).run(controller.signal);
  const executor=new CodexRuntimeAdapter(db.pool,f.cfg,launcher);
  return {draft:d,gateway,calls,service:new SampleProductionService(db.pool,f.cfg,sampleStore,executor,gateway,listening),directory,registry,audioCalls,speech,listening,sampleStore};
}

for(const engine of ['PER_SHOT_AI','REFERENCE_FILM'] as const)it(`native SAMPLE ${engine} keeps whole original audio, actual ASR captions, settled listening and two fresh reviews`,async()=>{
  const g=await generatedFixture(engine,false,[],true),s=await create(g.draft),before=launcher.launches;
  try {
    const input=await sampleContext(db.pool,f.p.tenantId,s.sample_id),binding=input.input.generation!;
    expect(binding.ceiling_micro+binding.audio!.ceiling_micro+input.input.limits.ceiling_micro).toBe(f.cfg.samples.costCeilingMicro);
    for(const name of SAMPLE_STAGES){
      const lease=(await claimStage(db.pool,id('native-sample'),[name]))!;expect(lease.scope_id).toBe(s.sample_id);
      await completeStage(db.pool,lease,await withFixtureLease(db.pool,lease,signal=>g.service.handle(lease,signal),controller.signal));
    }
    const c=await sampleContext(db.pool,f.p.tenantId,s.sample_id,undefined,false,true),packet=samplePacket(c);
    await verifyCompletedSample(db.pool,f.cfg,f.p.tenantId,s.sample_id,c.private);
    expect(launcher.launches-before).toBe(6);expect(g.audioCalls).toMatchObject({asrPosts:1,queries:1,listening:1});
    expect(storedMedia(c,'PRODUCTION').artifacts.find(a=>a.kind==='video')!.inspection).toMatchObject({hasAudio:true,audioCodec:'alac',frames:60});
    const video=storedMedia(c,'POST').artifacts.find(a=>a.kind==='video')!;
    expect(video.inspection).toMatchObject({hasAudio:true,audioCodec:'aac',frames:60});
    expect(video.native_audio?.phase).toBe('POST');expect(packet.native_audio?.audios.map(a=>a.kind)).toEqual(['NATIVE_AUDIO','FINAL_AUDIO']);
    expect(packet.listening?.result.verdict).toBe('PASS');expect(packet.listening?.result.tracks).toHaveLength(2);
    expect(packet.native_audio?.transcript.segments.flatMap(s=>s.words??[]).map(w=>w.text).join('')).toContain('商品实拍');
    const nodes=(await db.pool.query('SELECT * FROM provider_submissions WHERE sample_id=$1',[s.sample_id])).rows;
    expect(nodes.filter(n=>n.generation_kind==='ASR')).toHaveLength(1);expect(nodes.filter(n=>n.generation_kind==='LISTENING')).toHaveLength(1);
    expect(nodes.every(n=>n.order_id===null&&n.state==='SUCCEEDED'&&n.private.billing_valid)).toBe(true);
    expect((await db.pool.query('SELECT id FROM orders')).rowCount).toBe(0);expect((await db.pool.query('SELECT id FROM budget_reservations')).rowCount).toBe(0);
    expect((await db.pool.query(`SELECT b.id FROM platform_budget_reservations b JOIN provider_submissions p ON p.reservation_id=b.id AND p.tenant_id=b.tenant_id WHERE p.sample_id=$1 AND b.state<>'SETTLED'`,[s.sample_id])).rowCount).toBe(0);
    const runs=(await db.pool.query(`SELECT r.* FROM agent_runs r JOIN agent_instances i ON i.id=r.instance_id WHERE i.preview_session_id=$1`,[s.sample_id])).rows;
    expect(runs.filter(r=>['REVIEW_FACTS','REVIEW_STYLE'].includes(r.role)&&!r.private.review_input?.purpose).every(r=>r.private.stage_result.audio_evidence_hash===hash({native_audio:packet.native_audio,listening:packet.listening}))).toBe(true);
    const posts=g.audioCalls.asrPosts+g.audioCalls.listening;
    await publishProducedSample(g.draft,s,c);expect(g.audioCalls.asrPosts+g.audioCalls.listening).toBe(posts);
    if(process.env.YPCC_SAMPLE_PROOF_DIR){const root=inside(f.cfg.projectRoot,process.env.YPCC_SAMPLE_PROOF_DIR);await mkdir(root,{recursive:true});
      await writeFile(inside(root,`${engine.toLowerCase()}.mp4`),await artifactBytes(db.pool,store,c,video));
      await writeFile(inside(root,`${engine.toLowerCase()}.json`),JSON.stringify({synthetic:true,meaning:'Tones, fabricated ASR/listening/rights/AI identities and usage. Not real Chinese speech quality.',input_hash:c.inputHash,video_sha256:video.sha256,proof:video.native_audio,
        source_set:process.env.YPCC_SAMPLE_SOURCE_HASH??null,audio_calls:g.audioCalls,budget:{generation:binding.ceiling_micro,audio:binding.audio!.ceiling_micro,agent:input.input.limits.ceiling_micro,total:binding.total_ceiling_micro}},null,2));}
    const license=g.registry!.licenses[0]!;await db.pool.query('UPDATE resource_licenses SET revoked_at=now() WHERE id=$1',[license]);
    await expect(verifyCompletedSample(db.pool,f.cfg,f.p.tenantId,s.sample_id,c.private)).rejects.toMatchObject({code:'AUDIO_LICENSE_UNAVAILABLE'});
    const publicId=(await db.pool.query('SELECT id FROM authorized_samples WHERE source_sample_id=$1',[s.sample_id])).rows[0].id as string;
    await expect(publicSampleMedia(db.pool,f.cfg,publicId)).rejects.toMatchObject({code:'PUBLIC_SAMPLE_RESOURCE_REVOKED'});
    expect(await expireAuthorizedSamples(db.pool)).toBeGreaterThan(0);
  }finally{await stop(s);await rm(g.directory,{recursive:true,force:true});}
},240000);

it('native SAMPLE refuses missing defaults, paid-order-only rights and an insufficient original allowance before spending',async()=>{
  const g=await generatedFixture('PER_SHOT_AI',false,[],true),blueprint=g.draft.config.variant_blueprint_ids[0]!.slice('blueprint.'.length);
  const row=(await db.pool.query('SELECT id,private FROM execution_variants WHERE variant_id=$1',[blueprint])).rows[0]!;
  const before=upstreamImages.length,amount=(await db.pool.query('SELECT count(*)::int AS n FROM platform_budget_reservations')).rows[0].n;
  try {
    await db.pool.query("UPDATE execution_variants SET private=private-'sample_native_voice' WHERE id=$1",[row.id]);
    let response=await api('POST',`/preset-drafts/${g.draft.draft_id}/samples`,request(g.draft));expect(response.statusCode).toBe(503);expect(response.json().code).toBe('SAMPLE_AUDIO_NOT_CONFIGURED');
    await db.pool.query('UPDATE execution_variants SET private=$2 WHERE id=$1',[row.id,row.private]);
    const extra={resource_version_id:id('unused_resource'),license_record_id:id('unused_license'),hash:sha256('SYNTHETIC UNUSED RESOURCE')};
    await insert(db.pool,'resource_licenses',{id:extra.license_record_id,resource_id:extra.resource_version_id,version:'SYNTHETIC-UNUSED',data:{resource_version_id:extra.resource_version_id,resource_hash:extra.hash,license:'SYNTHETIC UNUSED RESOURCE'}});
    await db.pool.query("UPDATE execution_variants SET private=jsonb_set(private,'{resource_versions}',$2) WHERE id=$1",[row.id,JSON.stringify([FONT_BINDING,extra])]);
    response=await api('POST',`/preset-drafts/${g.draft.draft_id}/samples`,request(g.draft));expect(response.statusCode).toBe(503);expect(response.json().code).toBe('SAMPLE_RESOURCE_INVALID');
    await db.pool.query('UPDATE execution_variants SET private=$2 WHERE id=$1',[row.id,row.private]);
    const paid=await generatedFixture('PER_SHOT_AI',false,[],'ORDER_ONLY');
    try{response=await api('POST',`/preset-drafts/${paid.draft.draft_id}/samples`,request(paid.draft));expect(response.statusCode).toBe(503);expect(response.json().code).toBe('AUDIO_LICENSE_UNAVAILABLE');}
    finally{await rm(paid.directory,{recursive:true,force:true});}
    const ceiling=f.cfg.samples.costCeilingMicro;f.cfg.samples.costCeilingMicro=1;
    try{response=await api('POST',`/preset-drafts/${g.draft.draft_id}/samples`,request(g.draft));expect(response.statusCode).toBe(503);}
    finally{f.cfg.samples.costCeilingMicro=ceiling;}
    expect(upstreamImages).toHaveLength(before);expect(g.calls).toHaveLength(0);expect(g.audioCalls.asrPosts).toBe(0);
    expect((await db.pool.query('SELECT count(*)::int AS n FROM platform_budget_reservations')).rows[0].n).toBe(amount);
    expect((await db.pool.query(`SELECT id FROM public_samples WHERE draft_id=$1`,[g.draft.draft_id])).rowCount).toBe(0);
  }finally{await db.pool.query('UPDATE execution_variants SET private=$2 WHERE id=$1',[row.id,row.private]);await rm(g.directory,{recursive:true,force:true});}
});

it('native SAMPLE holds an unknown ASR in its original platform reservation without a second POST',async()=>{
  const g=await generatedFixture('REFERENCE_FILM',false,[],true),s=await create(g.draft);
  try{
    for(const name of ['SAMPLE','SAMPLE_PRODUCTION']){const lease=(await claimStage(db.pool,id('native-unknown'),[name]))!;
      await completeStage(db.pool,lease,await withFixtureLease(db.pool,lease,signal=>g.service.handle(lease,signal),controller.signal));}
    const lease=(await claimStage(db.pool,id('native-unknown'),['SAMPLE_POST']))!,c=await sampleContext(db.pool,f.p.tenantId,s.sample_id),source=await sampleNativeSource(db.pool,store,c);
    g.audioCalls.unknownAsr=true;
    await expect(g.speech!.submit(lease,source.writeId,controller.signal)).rejects.toThrow();
    await expect(g.speech!.submit(lease,source.writeId,controller.signal)).rejects.toMatchObject({code:'ASR_ORIGINAL_ACK_UNKNOWN'});
    const rows=(await db.pool.query(`SELECT p.*,b.state AS budget_state FROM provider_submissions p JOIN platform_budget_reservations b ON b.id=p.reservation_id WHERE p.sample_id=$1 AND p.generation_kind='ASR'`,[s.sample_id])).rows;
    expect(rows).toHaveLength(1);expect(rows[0]).toMatchObject({state:'UNKNOWN',budget_state:'UNKNOWN',order_id:null});expect(g.audioCalls.asrPosts).toBe(1);
    await db.pool.query("UPDATE provider_model_versions SET status='RETIRED' WHERE id=$1",[g.registry!.speech.model_version_id]);
    await expect(g.speech!.submit(lease,source.writeId,controller.signal)).rejects.toMatchObject({code:'ASR_NOT_ADMITTED'});expect(g.audioCalls.asrPosts).toBe(1);
    await expect(db.pool.query("UPDATE provider_submissions SET private=jsonb_set(private,'{sample_audio_contract_hash}',to_jsonb($2::text)) WHERE id=$1",[rows[0].id,'0'.repeat(64)])).rejects.toThrow('immutable');
    expect(await g.speech!.reconcileReceipts()).toMatchObject({blocked:1});expect(g.audioCalls.asrPosts).toBe(1);
  }finally{await stop(s);await rm(g.directory,{recursive:true,force:true});}
},180000);
for(const engine of ['PER_SHOT_AI','REFERENCE_FILM'] as const)it(`completes ${engine} creator sample, private download and independent public copies within platform funds`,async()=>{
  const g=await generatedFixture(engine);const s=await create(g.draft);const before=launcher.launches;
  try{
    const initial=await sampleContext(db.pool,f.p.tenantId,s.sample_id);
    expect(initial.input.generation!.ceiling_micro+initial.input.limits.ceiling_micro).toBe(f.cfg.samples.costCeilingMicro);
    for(const name of SAMPLE_STAGES){const lease=(await claimStage(db.pool,id('generated-sample'),[name]))!;expect(lease.scope_id).toBe(s.sample_id);
      await completeStage(db.pool,lease,await withFixtureLease(db.pool,lease,signal=>g.service.handle(lease,signal),controller.signal));}
    const c=await sampleContext(db.pool,f.p.tenantId,s.sample_id,undefined,false,true);
    await verifyCompletedSample(db.pool,f.cfg,f.p.tenantId,s.sample_id,c.private);
    expect(launcher.launches-before).toBe(6);
    const runs=(await db.pool.query(`SELECT r.* FROM agent_runs r JOIN agent_instances i ON i.tenant_id=r.tenant_id AND i.id=r.instance_id WHERE i.preview_session_id=$1`,[s.sample_id])).rows;
    expect(runs.filter(r=>r.private.review_input?.purpose==='REFERENCE_IDENTITY')).toHaveLength(1);
    const nodes=(await db.pool.query('SELECT * FROM provider_submissions WHERE sample_id=$1',[s.sample_id])).rows;
    const expectedNodes=engine==='PER_SHOT_AI'?5:3;
    expect(nodes).toHaveLength(expectedNodes);expect(nodes.every(n=>n.order_id===null&&n.state==='SUCCEEDED'&&n.private.billing_valid)).toBe(true);
    const output=(c.private.post as {artifacts:{kind:string;ai_disclosure?:{frames_checked:number};generation_sources?:unknown[];object_key:string}[]}).artifacts;
    expect(output.filter(a=>a.kind!=='copy').every(a=>a.ai_disclosure&&a.generation_sources?.length)).toBe(true);
    expect(output.find(a=>a.kind==='video')!.ai_disclosure!.frames_checked).toBe(engine==='PER_SHOT_AI'?60:30);
    expect(samplePacket(c).images.some(i=>i.asset_id===c.input.profile.photo_roles[0]!.asset_id)).toBe(true);
    expect((await api('POST',`/preset-samples/${s.sample_id}/media-links`,undefined,outsider)).statusCode).toBe(404);
    expect((await api('POST',`/preset-samples/${s.sample_id}/media-links`)).statusCode).toBe(200);
    const purchases=g.calls.filter(c=>c.method==='POST').length;expect(purchases).toBe(expectedNodes);
    await publishProducedSample(g.draft,s,c);expect(g.calls.filter(c=>c.method==='POST')).toHaveLength(purchases);
    expect((await db.pool.query('SELECT id FROM orders')).rowCount).toBe(0);expect((await db.pool.query('SELECT id FROM budget_reservations')).rowCount).toBe(0);
    expect((await db.pool.query(`SELECT b.id FROM platform_budget_reservations b JOIN provider_submissions p ON p.tenant_id=b.tenant_id AND p.reservation_id=b.id WHERE p.sample_id=$1 AND b.state<>'SETTLED'`,[s.sample_id])).rowCount).toBe(0);
    const model=nodes[0]!.model_version_id;await db.pool.query(`UPDATE provider_model_versions SET status='RETIRED' WHERE id=$1`,[model]);
    try{await verifyCompletedSample(db.pool,f.cfg,f.p.tenantId,s.sample_id,c.private);}finally{await db.pool.query(`UPDATE provider_model_versions SET status='ADMITTED' WHERE id=$1`,[model]);}
    const artifact=output.find(a=>a.kind==='image')!,original=await store.get(artifact.object_key);
    await store.put(artifact.object_key,Buffer.from('changed'),'image/png');
    try{await expect(verifyCompletedSample(db.pool,f.cfg,f.p.tenantId,s.sample_id,c.private)).rejects.toMatchObject({code:expect.stringMatching(/REVIEW_IMAGE_INVALID|SAMPLE_OBJECT_CHANGED/)});}finally{await store.put(artifact.object_key,original,'image/png');}
  }finally{await rm(g.directory,{recursive:true,force:true});}
});
it('rejects insufficient frozen sample funds and UNCERTAIN reference identity before buying any video',async()=>{
  const g=await generatedFixture('REFERENCE_FILM');let s:DTO<'Sample'>|undefined;
  try{
    const budget=f.cfg.samples.costCeilingMicro;f.cfg.samples.costCeilingMicro=100;
    try{const rejected=await api('POST',`/preset-drafts/${g.draft.draft_id}/samples`,request(g.draft));
      expect(rejected.statusCode).toBe(503);expect(rejected.json().code).toBe('SAMPLE_GENERATION_BUDGET_INVALID');expect(g.calls).toHaveLength(0);
    }finally{f.cfg.samples.costCeilingMicro=budget;}
    s=await create(g.draft);const content=(await claimStage(db.pool,id('rejected-reference'),['SAMPLE']))!;
    await completeStage(db.pool,content,await withFixtureLease(db.pool,content,signal=>g.service.handle(content,signal),controller.signal));
    const lease=(await claimStage(db.pool,id('rejected-reference'),['SAMPLE_PRODUCTION']))!;
    const active=new SampleProductionService(db.pool,f.cfg,store,new CodexRuntimeAdapter(db.pool,f.cfg,new SampleLauncher('REFERENCE_UNCERTAIN')),g.gateway);
    await expect(withFixtureLease(db.pool,lease,signal=>active.handle(lease,signal),controller.signal)).rejects.toMatchObject({code:'REFERENCE_IDENTITY_REJECTED'});
    expect((await db.pool.query(`SELECT id FROM provider_submissions WHERE sample_id=$1 AND generation_kind='VIDEO'`,[s.sample_id])).rowCount).toBe(0);
    expect(g.calls.filter(c=>c.method==='POST')).toHaveLength(1);
    expect((await db.pool.query(`SELECT r.id FROM agent_runs r JOIN agent_instances i ON i.id=r.instance_id WHERE i.preview_session_id=$1 AND r.role='PRODUCTION'`,[s.sample_id])).rowCount).toBe(0);
  }finally{if(s)await stop(s);await rm(g.directory,{recursive:true,force:true});}
});
it('retains an UNKNOWN sample generation reservation and resumes only its original intent without buyer funds',async()=>{
  const g=await generatedFixture('PER_SHOT_AI',true),s=await create(g.draft);
  try{
    const content=(await claimStage(db.pool,id('sample-content'),['SAMPLE']))!;
    await completeStage(db.pool,content,await withFixtureLease(db.pool,content,signal=>g.service.handle(content,signal),controller.signal));
    const lease=(await claimStage(db.pool,id('sample-reference'),['SAMPLE_PRODUCTION']))!;
    const c=await sampleContext(db.pool,f.p.tenantId,s.sample_id),gc=sampleGenerationContext(c),request=referenceRequest(gc,gc.contract.creative.shots[0]!.shot_id);
    await expect(g.gateway.submit(lease,request,controller.signal)).rejects.toThrow('Synthetic lost sample ACK');
    expect((await g.gateway.submit(lease,request,controller.signal)).state).toBe('UNKNOWN');
    expect(g.calls.filter(c=>c.method==='POST')).toHaveLength(1);
    const nodes=(await db.pool.query('SELECT p.*,b.state AS budget_state FROM provider_submissions p JOIN platform_budget_reservations b ON b.id=p.reservation_id WHERE p.sample_id=$1',[s.sample_id])).rows;
    expect(nodes).toHaveLength(1);expect(nodes[0]).toMatchObject({order_id:null,state:'UNKNOWN',budget_state:'UNKNOWN'});
    await expect(db.pool.query(`UPDATE provider_submissions SET sample_id=NULL WHERE id=$1`,[nodes[0]!.id])).rejects.toThrow(/immutable/);
    await expect(db.pool.query(`UPDATE public_samples SET private=jsonb_set(private,'{execution,input,limits,ceiling_micro}','9999999') WHERE id=$1`,[s.sample_id])).rejects.toThrow(/immutable/);
    await expect(g.gateway.resume({...lease,tenant_id:id('foreign-tenant')},nodes[0]!.id,controller.signal)).rejects.toBeDefined();
    expect((await db.pool.query('SELECT id FROM orders')).rowCount).toBe(0);expect((await db.pool.query('SELECT id FROM budget_reservations')).rowCount).toBe(0);
    await stop(s);const result=await g.gateway.reconcileReceipts();expect(result.blocked).toBeGreaterThan(0);
    expect(g.calls.filter(c=>c.method==='POST')).toHaveLength(1);
  }finally{await stop(s);await rm(g.directory,{recursive:true,force:true});}
});
const creativeSelection=['narrative.detail-first.1','rhythm.quick-open.1','camera.hold.1','caption.bold.1'];
for(const engine of ['PHOTO_LAYOUT','PER_SHOT_AI','REFERENCE_FILM'] as const)it(`creative components complete actual ${engine} media with frozen choices, independent review and released instances`,async()=>{
  const selected=engine==='PER_SHOT_AI'?creativeSelection.map(c=>c==='rhythm.quick-open.1'?'rhythm.even.1':c):creativeSelection;
  const g=engine==='PHOTO_LAYOUT'?null:await generatedFixture(engine,false,selected);
  const d=g?.draft??await createDraft(db.pool,f.p,{...draft.config,name:'受控细节开场样例',component_versions:['style.quiet-luxury.1',...creativeSelection]});
  if(engine==='PER_SHOT_AI'){
    await heartbeat();
    const incompatible=await createDraft(db.pool,f.p,{...d.config,name:'短规格不能购买不兼容节奏',component_versions:d.config.component_versions.map(c=>c==='rhythm.even.1'?'rhythm.quick-open.1':c)});
    const denied=await api('POST',`/preset-drafts/${incompatible.draft_id}/samples`,request(incompatible));
    expect(denied.statusCode,denied.body).toBe(503);expect(denied.json().code).toBe('GENERATION_VIDEO_SPEC_UNAVAILABLE');expect(g!.calls).toHaveLength(0);
    expect((await db.pool.query('SELECT id FROM public_samples WHERE draft_id=$1',[incompatible.draft_id])).rowCount).toBe(0);
  }
  const s=await create(d),before=launcher.launches,active=g?.service??service;
  try{
    const frozen=await sampleContext(db.pool,f.p.tenantId,s.sample_id),sourceHash=hash(frozen.input.source);
    const changed=await api('PATCH',`/preset-drafts/${d.draft_id}`,{expected_revision:d.revision,config:{...d.config,component_versions:d.config.component_versions.filter(c=>c!=='camera.hold.1').concat('camera.pan.1')}});
    expect(changed.statusCode,changed.body).toBe(200);
    for(const name of SAMPLE_STAGES){const lease=(await claimStage(db.pool,id('creative-sample'),[name]))!;expect(lease.scope_id).toBe(s.sample_id);
      try{await completeStage(db.pool,lease,await withFixtureLease(db.pool,lease,signal=>active.handle(lease,signal),controller.signal));}
      catch(error){console.error('CREATIVE_SAMPLE_DIAGNOSTICS',name,(await db.pool.query("SELECT tool_name,state,data->>'error_code' AS code FROM agent_tool_intents WHERE stage_run_id=$1",[lease.id])).rows);throw error;}}
    const c=await sampleContext(db.pool,f.p.tenantId,s.sample_id,undefined,false,true);
    await verifyCompletedSample(db.pool,f.cfg,f.p.tenantId,s.sample_id,c.private);
    expect(hash(c.input.source)).toBe(sourceHash);expect(c.input.source.creative_components.community_direction).toMatchObject({camera:'HOLD',caption:'bold',narrative:'DETAIL_FIRST'});
    expect(samplePlan(c).shots.every(s=>s.camera==='HOLD')).toBe(true);
    expect(launcher.launches-before).toBe(engine==='PHOTO_LAYOUT'?5:6);
    const media=storedMedia(c,'POST'),video=media.artifacts.find(a=>a.kind==='video')!;
    expect(video.inspection).toMatchObject({width:1080,height:1920,fps:30,frames:c.input.source.timeline_policy.target_frames,hasAudio:false});
    const image=media.artifacts.find(a=>a.kind==='image')!;expect((await sharp(await artifactBytes(db.pool,store,c,image)).metadata()).format).toBe('png');
    expect((await db.pool.query("SELECT i.id FROM agent_instances i WHERE i.preview_session_id=$1 AND i.state<>'RELEASED'",[s.sample_id])).rowCount).toBe(0);
    expect((await db.pool.query('SELECT id FROM orders')).rowCount).toBe(0);expect((await db.pool.query('SELECT id FROM budget_reservations')).rowCount).toBe(0);
    if(g)expect(g.calls.filter(x=>x.method==='POST')).toHaveLength(engine==='PER_SHOT_AI'?5:3);
    const output=process.env.YPCC_CREATIVE_MEDIA_DIRECTORY;
    if(output){const directory=inside(f.cfg.projectRoot,output);await mkdir(directory,{recursive:true});
      await writeFile(inside(directory,`${engine.toLowerCase()}.mp4`),await artifactBytes(db.pool,store,c,video));
      if(engine==='PHOTO_LAYOUT')await writeFile(inside(directory,'photo-layout.png'),await artifactBytes(db.pool,store,c,image));
      await writeFile(inside(directory,`${engine.toLowerCase()}.json`),JSON.stringify({engine,source_hash:sourceHash,source:c.input.source,creative:c.private.creative,
        target_frames:video.inspection!.frames,output_count:media.artifacts.length,role_count:launcher.launches-before,synthetic_models:true,actual_native_media:true},null,2));}
  }finally{await stop(s);if(g)await rm(g.directory,{recursive:true,force:true});}
});
