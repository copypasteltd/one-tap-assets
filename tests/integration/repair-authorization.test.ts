import { afterAll, beforeAll, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { testDatabase, type TestDatabase } from '../helpers/database.js';
import { mediaFixture } from '../helpers/media.js';
import { syntheticSse } from '../helpers/codex.js';
import { FixtureLauncher } from '../helpers/role-launcher.js';
import { buildApp } from '../../src/api/app.js';
import { transaction } from '../../src/api/db/pool.js';
import { id } from '../../src/api/lib/crypto.js';
import { CodexRuntimeAdapter } from '../../src/worker/codex/runtime.js';
import { MediaStageService } from '../../src/worker/codex/media-stage.js';
import { ToolConsumer } from '../../src/worker/tool-gateway/consumer.js';
import { productionTools } from '../../src/worker/tool-gateway/production-tools.js';
import { reviewTools } from '../../src/worker/tool-gateway/review-tools.js';
import { claimStage, completeStage, heartbeatStage, type StageLease } from '../../src/worker/queue/leases.js';
import { enqueueStage } from '../../src/worker/queue/enqueue.js';
import { QualityControlService } from '../../src/worker/review/qc.js';
import { ReviewStageService } from '../../src/worker/review/stage.js';
import { currentReviewPacket } from '../../src/worker/review/context.js';
import { executionContext } from '../../src/worker/compiler/order-context.js';
import { authorizeRepairCosts, type RepairCostRequest } from '../../src/worker/repair/cost-authorization.js';
import { reserve, reserveStageCost, settle } from '../../src/worker/budget/reservations.js';

let db: TestDatabase, app: FastifyInstance | undefined, consumer: Promise<void> | undefined;
const controller = new AbortController();
beforeAll(async () => { db = await testDatabase(); });
afterAll(async () => { controller.abort(); await consumer; await app?.close(); await db?.close(); });

it('authorizes costs once from an actual sealed failed role, never publishing or executing a repaired candidate', async () => {
  const f = await mediaFixture(db, { configureContract: async contract => { contract.repair_ceiling_micro = 30; } });
  app = await buildApp({ cfg: f.cfg, pool: db.pool, inferenceHttp: async () => ({ status: 200,
    headers: { 'content-type': 'text/event-stream' }, bytes: syntheticSse(f.admission), json: () => null }) });
  await app.listen({ host: '127.0.0.1', port: 0 }); const address = app.server.address();
  if (!address || typeof address === 'string') throw new Error('Synthetic listener missing');
  f.cfg.publicBaseUrl = `https://localhost:${address.port}`;
  const media = productionTools(db.pool, f.cfg, f.store), review = reviewTools(db.pool, f.cfg, f.store);
  consumer = new ToolConsumer(db.pool, id('tools'), { ...media, ...review,
    persist_stage_result: (scope, ...args) => (scope.role.startsWith('REVIEW_') ? review : media).persist_stage_result!(scope, ...args) }).run(controller.signal);
  async function finish(lease: StageLease, handler: () => Promise<(db: import('pg').PoolClient) => Promise<void>>) {
    const pulse = setInterval(() => { void heartbeatStage(db.pool, lease); }, 5000);
    try { await completeStage(db.pool, lease, await handler()); } finally { clearInterval(pulse); }
  }
  async function next(name: string, parent: StageLease) {
    const stageId = await enqueueStage(db.pool, { tenantId: f.p.tenantId, scopeType: 'ORDER', scopeId: f.orderId,
      name, inputHash: f.snapshotHash, deadlineAt: f.snapshot.deadline_at, jobId: f.lease.job_id!, dependencies: [parent.id] });
    const lease = (await claimStage(db.pool, id('worker'), [name]))!; expect(lease.id).toBe(stageId); return lease;
  }
  const mediaService = new MediaStageService(db.pool, f.cfg, new CodexRuntimeAdapter(db.pool, f.cfg, new FixtureLauncher()));
  await finish(f.lease, () => mediaService.handle(f.lease, controller.signal));
  const post = (await claimStage(db.pool, id('worker'), ['POST']))!; await finish(post, () => mediaService.handle(post, controller.signal));
  const qc = await next('QC', post), quality = new QualityControlService(db.pool, f.cfg, f.store);
  await finish(qc, () => quality.handle(qc, controller.signal));
  const facts = await next('REVIEW_FACTS', qc);
  const reviewService = new ReviewStageService(db.pool, f.cfg, new CodexRuntimeAdapter(db.pool, f.cfg, new FixtureLauncher('REVIEW_FAIL')));
  await finish(facts, () => reviewService.handle(facts, controller.signal));
  const context = await executionContext(db.pool, f.p.tenantId, f.orderId, f.snapshotHash), packet = await currentReviewPacket(db.pool, context);
  expect(packet.state).toBe('FAILED'); expect(packet.publication_decision).toBe('BLOCK');
  expect(packet.reports).toHaveLength(1); expect(packet.reports[0]!.verdict).toBe('FAIL');
  const stageIds: string[] = [];
  await transaction(db.pool, async c => {
    for (const name of ['PRODUCTION','POST','QC','REVIEW_FACTS','REVIEW_STYLE','DELIVER']) {
      stageIds.push(await enqueueStage(c, { tenantId: f.p.tenantId, scopeType: 'ORDER', scopeId: f.orderId,
        name, inputHash: f.snapshotHash, deadlineAt: f.snapshot.deadline_at, jobId: f.lease.job_id!, attempt: 2,
        dependencies: stageIds.length ? [stageIds[stageIds.length - 1]!] : [] }));
    }
  });
  const request: RepairCostRequest = { tenantId: f.p.tenantId, orderId: f.orderId, snapshotHash: f.snapshotHash,
    sourcePacketId: packet.packet_id, stageIds, generationNodes: [] };
  const authorize = (change: Partial<RepairCostRequest> = {}) => transaction(db.pool, c => authorizeRepairCosts(c, f.cfg, { ...request, ...change }));
  await expect(authorize({ sourcePacketId: 'invented_packet' })).rejects.toMatchObject({ code: 'REPAIR_SOURCE_INVALID' });
  const originalSpent = (await db.pool.query('SELECT spent_micro FROM orders WHERE id=$1', [f.orderId])).rows[0].spent_micro;
  await db.pool.query('UPDATE orders SET spent_micro=budget_micro WHERE id=$1', [f.orderId]);
  await expect(authorize()).rejects.toMatchObject({ code: 'REPAIR_BUDGET_UNAVAILABLE' });
  await db.pool.query('UPDATE orders SET spent_micro=$2 WHERE id=$1', [f.orderId, originalSpent]);
  const scope = { tenantId: f.p.tenantId, orderId: f.orderId };
  const unknown = await transaction(db.pool, c => reserve(c, scope, id('original_unknown'), 1, { synthetic: true }));
  await transaction(db.pool, c => settle(c, f.p.tenantId, unknown, null));
  await expect(authorize()).rejects.toMatchObject({ code: 'REPAIR_ORIGINAL_CALL_UNRESOLVED' });
  await transaction(db.pool, c => settle(c, f.p.tenantId, unknown, null, true));
  await expect(authorize({ stageIds: [facts.id, ...stageIds.slice(1)] })).rejects.toMatchObject({ code: 'REPAIR_STAGES_INVALID' });
  await db.pool.query(`UPDATE review_packets SET data=jsonb_set(data,'{reports}','[]'::jsonb) WHERE id=$1`, [packet.packet_id]);
  await expect(authorize()).rejects.toMatchObject({ code: 'REPAIR_SOURCE_INVALID' });
  await db.pool.query('UPDATE review_packets SET data=$2::jsonb WHERE id=$1', [packet.packet_id, JSON.stringify(packet)]);
  const authorizationId = await authorize();
  expect(await authorize()).toBe(authorizationId);
  await expect(authorize({ stageIds: [facts.id, ...stageIds.slice(1)] })).rejects.toMatchObject({ code: 'REPAIR_AUTHORIZATION_CHANGED' });
  const job = (await db.pool.query('SELECT repair_rounds,data,deadline_at FROM render_jobs WHERE id=$1', [f.lease.job_id])).rows[0];
  expect(job.repair_rounds).toBe(1); expect(job.data.repair_rounds).toBe(1); expect(job.deadline_at.toISOString()).toBe(f.snapshot.deadline_at);
  const repair = (await claimStage(db.pool, id('repair-worker'), ['PRODUCTION']))!;
  expect(repair.id).toBe(stageIds[0]); expect(repair.attempt).toBe(2);
  const reservationId = await transaction(db.pool, c => reserveStageCost(c, repair, id('repair-inference-control'), 1, { synthetic: true }, { kind: 'INFERENCE' }));
  expect((await db.pool.query('SELECT purpose,repair_authorization_id FROM budget_reservations WHERE id=$1', [reservationId])).rows[0])
    .toEqual({ purpose: 'REPAIR', repair_authorization_id: authorizationId });
  expect((await currentReviewPacket(db.pool, context)).publication_decision).toBe('BLOCK');
  expect((await db.pool.query('SELECT id FROM delivery_manifests WHERE order_id=$1', [f.orderId])).rowCount).toBe(0);
  expect((await db.pool.query("SELECT id FROM stage_runs WHERE job_id=$1 AND attempt=2 AND state='SUCCEEDED'", [f.lease.job_id])).rowCount).toBe(0);
}, 240_000);
