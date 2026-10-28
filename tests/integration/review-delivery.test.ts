import { beforeAll, afterAll, it, expect } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { testDatabase, account, type TestDatabase } from '../helpers/database.js';
import { mediaFixture } from '../helpers/media.js';
import { syntheticSse } from '../helpers/codex.js';
import { FixtureLauncher } from '../helpers/role-launcher.js';
import { buildApp } from '../../src/api/app.js';
import { id, hash, sha256 } from '../../src/api/lib/crypto.js';
import { insert } from '../../src/api/db/store.js';
import { createDownloadLink, getDeliverables } from '../../src/api/modules/delivery.js';
import type { DTO } from '../../src/shared/contracts/types.js';
import { CodexRuntimeAdapter } from '../../src/worker/codex/runtime.js';
import { MediaStageService } from '../../src/worker/codex/media-stage.js';
import { executionContext } from '../../src/worker/compiler/order-context.js';
import { ToolConsumer } from '../../src/worker/tool-gateway/consumer.js';
import { productionTools } from '../../src/worker/tool-gateway/production-tools.js';
import { reviewTools } from '../../src/worker/tool-gateway/review-tools.js';
import { claimStage, completeStage, heartbeatStage, type StageLease } from '../../src/worker/queue/leases.js';
import { enqueueStage } from '../../src/worker/queue/enqueue.js';
import { QualityControlService } from '../../src/worker/review/qc.js';
import { ReviewStageService } from '../../src/worker/review/stage.js';
import { PublicationService } from '../../src/worker/review/publication.js';
import { currentReviewPacket } from '../../src/worker/review/context.js';
import { validateReviewReport } from '../../src/worker/review/reports.js';

let db: TestDatabase; let app: FastifyInstance | undefined; let consumer: Promise<void> | undefined;
let f: Awaited<ReturnType<typeof mediaFixture>>; let facts: StageLease; let style: StageLease; let delivery: StageLease;
let publisher: PublicationService; const controller = new AbortController(); let factsReport: DTO<'ReviewReport'>;
const upstreamImages: number[] = [];
async function finish(lease: StageLease, handle: () => Promise<(db: import('pg').PoolClient) => Promise<void>>): Promise<void> {
  const pulse = setInterval(() => { void heartbeatStage(db.pool, lease); }, 5000);
  try { await completeStage(db.pool, lease, await handle()); } finally { clearInterval(pulse); }
}
async function stage(name: string, parent: StageLease, fixture = f): Promise<StageLease> {
  const stageId = await enqueueStage(db.pool, { tenantId: fixture.p.tenantId, scopeType: 'ORDER', scopeId: fixture.orderId, name,
    inputHash: fixture.snapshotHash, deadlineAt: fixture.snapshot.deadline_at, jobId: fixture.lease.job_id!, dependencies: [parent.id] });
  const claimed = (await claimStage(db.pool, id('worker'), [name]))!; expect(claimed.id).toBe(stageId); return claimed;
}
beforeAll(async () => {
  db = await testDatabase(); f = await mediaFixture(db);
  app = await buildApp({ cfg: f.cfg, pool: db.pool, inferenceHttp: async (_cfg, _url, options) => {
    const request = JSON.parse(options!.body!.toString()) as { input: { content: unknown }[] };
    const content = request.input[0]!.content;
    upstreamImages.push(Array.isArray(content) ? content.filter(i => i.type === 'input_image').length : 0);
    return { status: 200, headers: { 'content-type': 'text/event-stream' }, bytes: syntheticSse(f.admission), json: () => null };
  } });
  await app.listen({ host: '127.0.0.1', port: 0 }); const address = app.server.address();
  if (!address || typeof address === 'string') throw new Error('Missing synthetic HTTPS listener');
  f.cfg.publicBaseUrl = `https://localhost:${address.port}`;
  const media = productionTools(db.pool, f.cfg, f.store); const review = reviewTools(db.pool, f.cfg, f.store);
  consumer = new ToolConsumer(db.pool, id('tools'), { ...media, ...review,
    persist_stage_result: (scope, ...args) => (scope.role.startsWith('REVIEW_') ? review : media).persist_stage_result!(scope, ...args) }).run(controller.signal);
  const service = new MediaStageService(db.pool, f.cfg, new CodexRuntimeAdapter(db.pool, f.cfg, new FixtureLauncher()));
  await finish(f.lease, () => service.handle(f.lease, controller.signal));
  const post = (await claimStage(db.pool, id('post'), ['POST']))!; await finish(post, () => service.handle(post, controller.signal));
  const qc = await stage('QC', post); const quality = new QualityControlService(db.pool, f.cfg, f.store);
  await finish(qc, () => quality.handle(qc, controller.signal)); facts = await stage('REVIEW_FACTS', qc);
  publisher = new PublicationService(db.pool, f.cfg, f.store);
});
afterAll(async () => { controller.abort(); await consumer; await app?.close(); await db?.close(); });

it('requires actual completed independent reports before publication', async () => {
  await expect(publisher.handle({ ...facts, stage_name: 'DELIVER' }, controller.signal)).rejects.toMatchObject({ code: 'PUBLICATION_NOT_READY' });
  expect((await db.pool.query('SELECT id FROM delivery_manifests WHERE order_id=$1', [f.orderId])).rowCount).toBe(0);
});
it('rejects missing context, omitted/tampered/low-detail pictures and forged identity/evidence before accepting a persisted review', async () => {
  const launcher = new FixtureLauncher('REVIEW_NEGATIVE_PROBES');
  const service = new ReviewStageService(db.pool, f.cfg, new CodexRuntimeAdapter(db.pool, f.cfg, launcher));
  const commit = await service.handle(facts, controller.signal);
  expect(launcher.launches).toBe(1);
  const row = (await db.pool.query<{ data: DTO<'ReviewReport'> }>("SELECT data FROM review_reports WHERE role='REVIEW_FACTS'")).rows[0]!;
  factsReport = row.data;
  expect((await db.pool.query("SELECT id FROM review_reports WHERE role='REVIEW_FACTS'")).rowCount).toBe(1);
  expect((await db.pool.query("SELECT id FROM agent_tool_intents WHERE run_id=$1 AND tool_name='persist_stage_result' AND state='FAILED'", [factsReport.run_id])).rowCount).toBe(2);
  // Accepted inference crossed the actual HTTPS boundary with all exact PNGs.
  expect(upstreamImages).toHaveLength(3); expect(upstreamImages[2]).toBeGreaterThan(3);
  const requests = (await db.pool.query<{ data: { review_image_hashes: string[] }; reserved_input_tokens: string }>(
    'SELECT data,reserved_input_tokens FROM inference_requests WHERE run_id=$1', [factsReport.run_id])).rows;
  expect(requests).toHaveLength(1); expect(requests[0]!.data.review_image_hashes).toHaveLength(upstreamImages[2]!);
  expect(Number(requests[0]!.reserved_input_tokens)).toBeGreaterThan(upstreamImages[2]! * f.admission.review_vision!.tokens_per_image_bound);
  await db.pool.query("UPDATE stage_runs SET lease_expires_at=now()-interval '1 second' WHERE id=$1", [facts.id]);
  const old = facts; facts = (await claimStage(db.pool, id('takeover'), ['REVIEW_FACTS']))!;
  await finish(facts, () => service.handle(facts, controller.signal));
  expect(launcher.launches).toBe(1); expect(upstreamImages).toHaveLength(3);
  await expect(completeStage(db.pool, old, commit)).rejects.toMatchObject({ code: 'LEASE_LOST' });
  const context = await executionContext(db.pool, f.p.tenantId, f.orderId, f.snapshotHash); const packet = await currentReviewPacket(db.pool, context);
  expect(packet.state).toBe('REVIEWING'); expect(packet.publication_decision).toBe('PENDING');
  await expect(db.pool.query("UPDATE review_reports SET verdict='FAIL' WHERE id=$1", [factsReport.report_id])).rejects.toThrow('immutable');
  await expect(validateReviewReport(db.pool, f.cfg, context, packet, factsReport.run_id, { ...factsReport, output_set_hash: '0'.repeat(64) }))
    .rejects.toMatchObject({ code: 'REVIEW_REPORT_BINDING_INVALID' });
  style = await stage('REVIEW_STYLE', facts);
});
it('uses a fresh style process and requires two authoritative PASS reports on the same bytes', async () => {
  const service = new ReviewStageService(db.pool, f.cfg, new CodexRuntimeAdapter(db.pool, f.cfg, new FixtureLauncher()));
  await finish(style, () => service.handle(style, controller.signal));
  const packet = await currentReviewPacket(db.pool, await executionContext(db.pool, f.p.tenantId, f.orderId, f.snapshotHash));
  expect(packet.state).toBe('PASSED'); expect(packet.publication_decision).toBe('PENDING'); expect(packet.reports).toHaveLength(2);
  expect(new Set(packet.reports.map(r => r.thread_id)).size).toBe(2);
  expect(new Set(packet.reports.map(r => r.runtime_process_ref)).size).toBe(2);
  expect(packet.reports.every(r => !packet.production_process_refs.includes(r.runtime_process_ref))).toBe(true);
  expect(upstreamImages).toHaveLength(4); expect(upstreamImages[3]).toBe(upstreamImages[2]);
  delivery = await stage('DELIVER', style);
});
it('blocks unsettled charges, revoked resources and detached reports without a public manifest', async () => {
  const reservation = id('reserve'); await insert(db.pool, 'budget_reservations', { id: reservation, tenant_id: f.p.tenantId, order_id: f.orderId,
    intent_key: id('unknown'), amount_micro: 1, currency: 'CNY', rate_snapshot: {}, state: 'UNKNOWN' });
  try { await expect(publisher.handle(delivery, controller.signal)).rejects.toMatchObject({ code: 'PUBLICATION_PAID_CALL_UNRESOLVED' }); }
  finally { await db.pool.query("UPDATE budget_reservations SET state='RELEASED' WHERE id=$1", [reservation]); }
  await db.pool.query("UPDATE resource_licenses SET revoked_at=now() WHERE id=$1", [f.snapshot.resource_versions[0]!.license_record_id]);
  try { await expect(publisher.handle(delivery, controller.signal)).rejects.toMatchObject({ code: 'RESOURCE_LICENSE_UNAVAILABLE' }); }
  finally { await db.pool.query('UPDATE resource_licenses SET revoked_at=NULL WHERE id=$1', [f.snapshot.resource_versions[0]!.license_record_id]); }
  await db.pool.query("UPDATE stage_runs SET state='UNKNOWN' WHERE id=$1", [facts.id]);
  try { await expect(publisher.handle(delivery, controller.signal)).rejects.toMatchObject({ code: 'REVIEW_REPORT_STALE' }); }
  finally { await db.pool.query("UPDATE stage_runs SET state='SUCCEEDED' WHERE id=$1", [facts.id]); }
  expect((await db.pool.query('SELECT id FROM delivery_manifests WHERE order_id=$1', [f.orderId])).rowCount).toBe(0);
});
it('rechecks actual bytes and revoked access in the publish transaction and rolls back an expired final fence', async () => {
  const pulse = setInterval(() => { void heartbeatStage(db.pool, delivery); }, 5000);
  try {
    const commit = await publisher.handle(delivery, controller.signal);
    const artifact = (await db.pool.query("SELECT * FROM artifacts WHERE order_id=$1 AND spec_json->>'phase'='POST' AND spec_json->>'kind'='image' LIMIT 1", [f.orderId])).rows[0];
    const bytes = await f.store.get(artifact.object_key);
    try {
      await f.store.put(artifact.object_key, Buffer.from('changed-after-preflight'), 'image/png');
      await expect(completeStage(db.pool, delivery, commit)).rejects.toMatchObject({ code: 'ARTIFACT_HASH_MISMATCH' });
    } finally { await f.store.put(artifact.object_key, bytes, 'image/png'); }
    await db.pool.query("UPDATE orders SET private=private||'{\"media_revoked\":true}'::jsonb WHERE id=$1", [f.orderId]);
    try { await expect(completeStage(db.pool, delivery, commit)).rejects.toMatchObject({ code: 'ORDER_NO_LONGER_EXECUTABLE' }); }
    finally { await db.pool.query("UPDATE orders SET private=private-'media_revoked' WHERE id=$1", [f.orderId]); }
    await expect(completeStage(db.pool, delivery, async tx => {
      await commit(tx); await tx.query("UPDATE stage_runs SET lease_expires_at=clock_timestamp()-interval '1 second' WHERE id=$1", [delivery.id]);
    })).rejects.toMatchObject({ code: 'LEASE_LOST' });
    expect((await db.pool.query('SELECT id FROM delivery_manifests WHERE order_id=$1', [f.orderId])).rowCount).toBe(0);
    expect((await db.pool.query('SELECT fulfillment_state FROM orders WHERE id=$1', [f.orderId])).rows[0].fulfillment_state).toBe('IN_PROGRESS');
    expect((await db.pool.query('SELECT data FROM review_packets WHERE order_id=$1', [f.orderId])).rows[0].data.publication_decision).toBe('PENDING');
  } finally { clearInterval(pulse); }
});
it('publishes all slots atomically, binds downloads to actual hashes and separately requests instance release', async () => {
  await finish(delivery, () => publisher.handle(delivery, controller.signal));
  const pack = await getDeliverables(db.pool, f.p, f.orderId);
  expect(pack.items.map(i => i.slot_id)).toEqual(f.snapshot.outputs.map(o => o.slot_id));
  expect(Date.parse(pack.expires_at) - Date.now()).toBeGreaterThan(6.99 * 86400000);
  const retained = (await db.pool.query<{ expires_at: Date }>(`SELECT a.expires_at FROM product_photo_versions v
    JOIN product_photo_items p ON p.tenant_id=v.tenant_id AND p.photo_version_id=v.id
    JOIN assets a ON a.tenant_id=p.tenant_id AND a.id=p.asset_id WHERE v.tenant_id=$1 AND v.product_id=$2 AND v.revision=$3`,
    [f.p.tenantId, f.snapshot.product_id, f.snapshot.photo_version])).rows;
  expect(retained).toHaveLength(3);
  expect(retained.every(row => row.expires_at.getTime() >= Date.parse(pack.expires_at))).toBe(true);
  const copy = pack.items.find(i => i.kind === 'copy')!; expect(copy.text).toBe(f.contract.creative.copy);
  await expect(createDownloadLink(db.pool, f.cfg, f.p, copy.deliverable_id)).rejects.toMatchObject({ code: 'COPY_AS_TEXT' });
  const other = await account(db); await expect(getDeliverables(db.pool, other.principal, f.orderId)).rejects.toBeDefined();
  const image = pack.items.find(i => i.kind === 'image')!; const link = await createDownloadLink(db.pool, f.cfg, f.p, image.deliverable_id);
  const url = new URL(link.url); const downloaded = await app!.inject({ method: 'GET', url: url.pathname + url.search });
  expect(downloaded.statusCode).toBe(200); expect(sha256(downloaded.rawPayload)).toBe(image.sha256);
  const partial = await app!.inject({ method: 'GET', url: url.pathname + url.search, headers: { range: 'bytes=0-7' } });
  expect(partial.statusCode).toBe(206); expect(partial.rawPayload).toEqual(downloaded.rawPayload.subarray(0, 8));
  const artifact = (await db.pool.query('SELECT object_key,expires_at FROM artifacts WHERE id=$1', [image.deliverable_id])).rows[0];
  expect(artifact.expires_at.toISOString()).toBe(pack.expires_at);
  try {
    await f.store.put(artifact.object_key, Buffer.from('corrupt-after-delivery'), 'image/png');
    expect((await app!.inject({ method: 'GET', url: url.pathname + url.search })).statusCode).toBe(503);
  } finally { await f.store.put(artifact.object_key, downloaded.rawPayload, 'image/png'); }
  await db.pool.query("UPDATE orders SET private=private||'{\"media_revoked\":true}'::jsonb WHERE id=$1", [f.orderId]);
  expect((await app!.inject({ method: 'GET', url: url.pathname + url.search })).statusCode).toBe(410);
  expect((await db.pool.query(`SELECT c.id FROM agent_capabilities c JOIN stage_runs s ON s.id=c.stage_run_id AND s.tenant_id=c.tenant_id
    WHERE s.scope_id=$1 AND c.revoked_at IS NULL`, [f.orderId])).rowCount).toBe(0);
  expect((await db.pool.query("SELECT id FROM outbox_events WHERE aggregate_id=$1 AND aggregate_type='ReleaseRequested' AND event_key=$2",
    [f.orderId, `release:delivered:${f.orderId}`])).rowCount).toBe(1);
  const persisted = (await db.pool.query('SELECT hash,data FROM delivery_manifests WHERE order_id=$1', [f.orderId])).rows;
  expect(persisted).toHaveLength(1); expect(hash(persisted[0].data)).toBe(persisted[0].hash);
  expect((await db.pool.query('SELECT data FROM review_packets WHERE order_id=$1', [f.orderId])).rows[0].data.publication_decision).toBe('ALLOW');
});
it.each(['REVIEW_FAIL', 'REVIEW_INSUFFICIENT'])('persists %s and stops further paid review or publication', async mode => {
  const blocked = await mediaFixture(db); blocked.cfg.publicBaseUrl = f.cfg.publicBaseUrl;
  const media = new MediaStageService(db.pool, blocked.cfg, new CodexRuntimeAdapter(db.pool, blocked.cfg, new FixtureLauncher()));
  await finish(blocked.lease, () => media.handle(blocked.lease, controller.signal));
  const post = (await claimStage(db.pool, id('post'), ['POST']))!;
  await finish(post, () => media.handle(post, controller.signal));
  const qc = await stage('QC', post, blocked); const quality = new QualityControlService(db.pool, blocked.cfg, blocked.store);
  await finish(qc, () => quality.handle(qc, controller.signal));
  const first = await stage('REVIEW_FACTS', qc, blocked);
  const review = new ReviewStageService(db.pool, blocked.cfg, new CodexRuntimeAdapter(db.pool, blocked.cfg, new FixtureLauncher(mode)));
  await finish(first, () => review.handle(first, controller.signal));
  const packet = await currentReviewPacket(db.pool, await executionContext(db.pool, blocked.p.tenantId, blocked.orderId, blocked.snapshotHash));
  expect(packet.state).toBe(mode === 'REVIEW_FAIL' ? 'FAILED' : 'INSUFFICIENT_EVIDENCE'); expect(packet.publication_decision).toBe('BLOCK');
  const next = await stage('REVIEW_STYLE', first, blocked);
  await expect(review.handle(next, controller.signal)).rejects.toMatchObject({ code: 'REVIEW_PACKET_BLOCKED' });
  expect((await db.pool.query("SELECT r.id FROM agent_runs r JOIN agent_instances i ON i.id=r.instance_id WHERE i.order_id=$1 AND r.role='REVIEW_STYLE'", [blocked.orderId])).rowCount).toBe(0);
  await expect(new PublicationService(db.pool, blocked.cfg, blocked.store).handle({ ...next, stage_name: 'DELIVER' }, controller.signal))
    .rejects.toMatchObject({ code: 'PUBLICATION_NOT_READY' });
  expect((await db.pool.query('SELECT id FROM delivery_manifests WHERE order_id=$1', [blocked.orderId])).rowCount).toBe(0);
});
