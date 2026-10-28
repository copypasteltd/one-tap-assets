import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { beforeAll, afterAll, afterEach, it, expect } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { testDatabase, type TestDatabase } from '../helpers/database.js';
import { mediaFixture } from '../helpers/media.js';
import { syntheticSse } from '../helpers/codex.js';
import { FixtureLauncher } from '../helpers/role-launcher.js';
import { buildApp } from '../../src/api/app.js';
import { hash, id, sha256 } from '../../src/api/lib/crypto.js';
import { insert } from '../../src/api/db/store.js';
import type { DTO } from '../../src/shared/contracts/types.js';
import { CodexRuntimeAdapter } from '../../src/worker/codex/runtime.js';
import { MediaStageService } from '../../src/worker/codex/media-stage.js';
import { ToolConsumer } from '../../src/worker/tool-gateway/consumer.js';
import { productionTools } from '../../src/worker/tool-gateway/production-tools.js';
import { claimStage, completeStage, heartbeatStage, type StageLease } from '../../src/worker/queue/leases.js';
import { enqueueStage } from '../../src/worker/queue/enqueue.js';
import { QualityControlService, verifySealedEvidence } from '../../src/worker/review/qc.js';
import { assertReviewConsensus, assertSealedPacket } from '../../src/worker/review/packet.js';
import { extractEvidenceFrames } from '../../src/worker/review/evidence.js';
import { nativeCommand } from '../../src/worker/media/native.js';
import { FONT_BINDING, loadProductionFont } from '../../src/worker/media/font.js';
import { renderLayout } from '../../src/worker/media/layout.js';

let db: TestDatabase; let app: FastifyInstance | undefined; let f: Awaited<ReturnType<typeof mediaFixture>>;
let consumerTask: Promise<void> | undefined; const controller = new AbortController();
let qc: QualityControlService; let postId: string;
beforeAll(async () => {
  db = await testDatabase(); f = await mediaFixture(db);
  app = await buildApp({ cfg: f.cfg, pool: db.pool, inferenceHttp: async () => ({ status: 200,
    headers: { 'content-type': 'text/event-stream' }, bytes: syntheticSse(f.admission), json: () => null }) });
  await app.listen({ host: '127.0.0.1', port: 0 }); const address = app.server.address();
  if (!address || typeof address === 'string') throw new Error('Missing synthetic HTTPS listener');
  f.cfg.publicBaseUrl = `https://localhost:${address.port}`;
  consumerTask = new ToolConsumer(db.pool, id('tools'), productionTools(db.pool, f.cfg, f.store)).run(controller.signal);
  const service = new MediaStageService(db.pool, f.cfg, new CodexRuntimeAdapter(db.pool, f.cfg, new FixtureLauncher()));
  const handle = async (lease: StageLease) => {
    const pulse = setInterval(() => { void heartbeatStage(db.pool, lease); }, 5000);
    try { await completeStage(db.pool, lease, await service.handle(lease, controller.signal)); } finally { clearInterval(pulse); }
  };
  await handle(f.lease); const post = (await claimStage(db.pool, id('post'), ['POST']))!; postId = post.id; await handle(post);
  qc = new QualityControlService(db.pool, f.cfg, f.store);
});
// Fault cases never complete their attempted QC stage; remove only those test
// rows so the next independent case still respects the two-attempt contract.
afterEach(async () => { await db.pool.query("DELETE FROM stage_runs WHERE stage_name='QC' AND state<>'SUCCEEDED'"); });
afterAll(async () => { controller.abort(); await consumerTask; await app?.close(); await db?.close(); });
async function lease(): Promise<StageLease> {
  const attempt = Number((await db.pool.query("SELECT count(*) AS n FROM stage_runs WHERE scope_id=$1 AND stage_name='QC'", [f.orderId])).rows[0].n) + 1;
  const stageId = await enqueueStage(db.pool, { tenantId: f.p.tenantId, scopeType: 'ORDER', scopeId: f.orderId,
    name: 'QC', attempt, inputHash: f.snapshotHash, deadlineAt: f.snapshot.deadline_at, jobId: f.lease.job_id!, dependencies: [postId] });
  const claimed = (await claimStage(db.pool, id('qc'), ['QC']))!;
  expect(claimed.id).toBe(stageId); return claimed;
}
it('seals actual complete private media and timecoded frames without publishing or inventing semantic PASS', async () => {
  const stage = await lease(); await completeStage(db.pool, stage, await qc.handle(stage, controller.signal));
  const packet = (await db.pool.query<{ data: DTO<'ReviewPacket'> }>('SELECT data FROM review_packets WHERE qc_stage_id=$1', [stage.id])).rows[0]!.data;
  assertSealedPacket(packet); expect(packet.state).toBe('SEALED'); expect(packet.publication_decision).toBe('PENDING');
  expect(packet.reports).toEqual([]); expect(() => assertReviewConsensus(packet)).toThrow();
  expect(packet.outputs).toHaveLength(f.snapshot.outputs.length); expect(packet.original_assets).toHaveLength(3);
  const evidence = await verifySealedEvidence(db.pool, f.store, packet);
  const frames = evidence.filter(e => e.kind === 'VIDEO_FRAME').sort((a, b) => a.frame_index! - b.frame_index!);
  expect(frames.map(e => e.frame_index)).toEqual([0, 29]); expect(frames.map(e => e.time_ms)).toEqual([0, 967]);
  expect(packet.production_run_ids).toHaveLength(2); expect(new Set(packet.production_process_refs).size).toBe(2);
  expect((await db.pool.query('SELECT id FROM delivery_manifests WHERE order_id=$1', [f.orderId])).rowCount).toBe(0);
  expect((await db.pool.query('SELECT id FROM qc_decisions WHERE order_id=$1', [f.orderId])).rowCount).toBe(packet.outputs.length);
  await expect(db.pool.query("UPDATE review_packets SET data=jsonb_set(data,'{evidence_complete}','false') WHERE id=$1", [packet.packet_id])).rejects.toThrow('immutable');
  await expect(db.pool.query("UPDATE review_evidence SET sha256=$2 WHERE id=$1", [evidence[0]!.id, '0'.repeat(64)])).rejects.toThrow('immutable');
  const original = await f.store.get(evidence[0]!.object_key);
  try {
    await f.store.put(evidence[0]!.object_key, Buffer.from('changed'), 'application/octet-stream');
    await expect(verifySealedEvidence(db.pool, f.store, packet)).rejects.toMatchObject({ code: 'REVIEW_EVIDENCE_CHANGED' });
  } finally { await f.store.put(evidence[0]!.object_key, original, evidence[0]!.mime_type); }
});
it('rejects changed actual candidate bytes before sealing another packet', async () => {
  const artifact = (await db.pool.query("SELECT * FROM artifacts WHERE order_id=$1 AND spec_json->>'phase'='POST' AND spec_json->>'kind'='image' LIMIT 1", [f.orderId])).rows[0];
  const bytes = await f.store.get(artifact.object_key);
  try {
    await f.store.put(artifact.object_key, Buffer.from('corrupt'), 'image/png');
    await expect(qc.handle(await lease(), controller.signal)).rejects.toMatchObject({ code: 'ARTIFACT_HASH_MISMATCH' });
  } finally { await f.store.put(artifact.object_key, bytes, 'image/png'); }
});
it('blocks a revoked font license and keeps paid UNKNOWN calls unresolved', async () => {
  const stage = await lease();
  await db.pool.query('UPDATE resource_licenses SET revoked_at=now() WHERE id=$1', [FONT_BINDING.license_record_id]);
  try { await expect(qc.handle(stage, controller.signal)).rejects.toMatchObject({ code: 'RESOURCE_LICENSE_UNAVAILABLE' }); }
  finally { await db.pool.query('UPDATE resource_licenses SET revoked_at=NULL WHERE id=$1', [FONT_BINDING.license_record_id]); }
  const reservationId = id('reserve');
  await insert(db.pool, 'budget_reservations', { id: reservationId, tenant_id: f.p.tenantId, order_id: f.orderId,
    intent_key: id('unknown'), amount_micro: 1, currency: 'CNY', rate_snapshot: {}, state: 'UNKNOWN' });
  try { await expect(qc.handle(stage, controller.signal)).rejects.toMatchObject({ code: 'QC_PAID_CALL_UNRESOLVED' }); }
  finally { await db.pool.query("UPDATE budget_reservations SET state='RELEASED' WHERE id=$1", [reservationId]); }
});
it('refuses an expired parent commit after actual evidence extraction', async () => {
  const stage = await lease(); const commit = await qc.handle(stage, controller.signal);
  await db.pool.query("UPDATE stage_runs SET lease_expires_at=now()-interval '1 second' WHERE id=$1", [stage.id]);
  await expect(completeStage(db.pool, stage, commit)).rejects.toMatchObject({ code: 'LEASE_LOST' });
  expect((await db.pool.query('SELECT id FROM review_packets WHERE qc_stage_id=$1', [stage.id])).rowCount).toBe(0);
});
it('rebuilds identical evidence on takeover without a second packet or decisions', async () => {
  const stage = await lease(); const abandoned = await qc.handle(stage, controller.signal);
  await db.pool.query("UPDATE stage_runs SET lease_expires_at=now()-interval '1 second' WHERE id=$1", [stage.id]);
  const takeover = (await claimStage(db.pool, id('takeover'), ['QC']))!;
  expect(takeover.id).toBe(stage.id);
  await completeStage(db.pool, takeover, await qc.handle(takeover, controller.signal));
  await expect(completeStage(db.pool, stage, abandoned)).rejects.toMatchObject({ code: 'LEASE_LOST' });
  expect((await db.pool.query('SELECT id FROM review_packets WHERE qc_stage_id=$1', [stage.id])).rowCount).toBe(1);
});
it('samples actual mid-second scene changes in addition to uniform and last frames', async () => {
  const dir = join(f.cfg.runtimeRoot, 'review-sampling', id('case')); await mkdir(dir, { recursive: true }); const path = join(dir, 'source.mp4');
  try {
    await nativeCommand(f.cfg, process.env.FFMPEG_PATH?.trim() || 'ffmpeg', ['-hide_banner', '-loglevel', 'error', '-nostdin', '-y',
      '-f', 'lavfi', '-i', 'color=c=red:s=320x480:r=30:d=0.5', '-f', 'lavfi', '-i', 'color=c=blue:s=320x480:r=30:d=1',
      '-f', 'lavfi', '-i', 'color=c=yellow:s=320x480:r=30:d=1.5', '-filter_complex', '[0:v][1:v][2:v]concat=n=3:v=1:a=0[v]',
      '-map', '[v]', '-c:v', 'libx264', '-threads', '2', '-pix_fmt', 'yuv420p', path], { cwd: dir, timeoutMs: 15000, signal: controller.signal });
    const frames = await extractEvidenceFrames(f.cfg, path, join(dir, 'evidence'), 90, [0, 89], f.snapshot.deadline_at, controller.signal);
    expect(frames.map(f => f.index)).toEqual([0, 15, 30, 45, 60, 89]);
    expect(sha256(frames[0]!.bytes)).not.toBe(sha256(frames[1]!.bytes));
  } finally { await rm(dir, { recursive: true, force: true }); }
});
it('rejects changed bundled font bytes and unsupported glyph fallback', async () => {
  const font = await loadProductionFont(f.cfg.projectRoot);
  const photo = (await db.pool.query('SELECT object_key FROM assets WHERE id=$1', [f.assetIds[0]])).rows[0];
  await expect(renderLayout(await f.store.get(photo.object_key), { presetId: 'minimal-clean', width: 1080, height: 1080,
    title: '商品\u{10ffff}', subtitle: '实拍', sequence: 1, total: 1, font })).rejects.toMatchObject({ code: 'FONT_GLYPH_UNAVAILABLE' });
  const dir = join(f.cfg.runtimeRoot, 'font-tamper', id('case')); const target = join(dir, 'assets/resources/fonts/noto-sans-sc');
  await mkdir(target, { recursive: true });
  try {
    await writeFile(join(target, 'NotoSansSC[wght].ttf'), Buffer.from('changed'));
    await writeFile(join(target, 'OFL.txt'), await readFile(join(f.cfg.projectRoot, 'assets/resources/fonts/noto-sans-sc/OFL.txt')));
    await expect(loadProductionFont(dir)).rejects.toMatchObject({ code: 'FONT_RESOURCE_CHANGED' });
  } finally { await rm(dir, { recursive: true, force: true }); }
});
