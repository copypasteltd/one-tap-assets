import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { account, orderFixture, testDatabase, type TestDatabase } from '../helpers/database.js';
import { addSeconds, id } from '../../src/api/lib/crypto.js';
import { insert, outbox } from '../../src/api/db/store.js';
import { enqueueStage } from '../../src/worker/queue/enqueue.js';
import { expireWork } from '../../src/worker/lifecycle/deadlines.js';
import { WorkerRuntime } from '../../src/worker/runtime.js';
import { PendingExternal } from '../../src/worker/queue/leases.js';
import { validate } from '../../src/api/lib/validation.js';

let db: TestDatabase;
beforeAll(async () => { db = await testDatabase(); }); afterAll(async () => { await db?.close(); });
const signal = (): AbortSignal => new AbortController().signal;
describe('durable worker execution and expiry', () => {
  it('expires an already-unclaimable paid order and creates one original refund and release event', async () => {
    const { principal: p, orderId } = await orderFixture(db);
    await insert(db.pool, 'payments', { id: id('payment'), tenant_id: p.tenantId, order_id: orderId, provider: 'alipay', merchant_id: 'test-merchant', state: 'CONFIRMED', amount_fen: 100, intent_key: `payment:${orderId}`, data: {} });
    const snapshotId = id('snapshot'); const jobId = id('job'); const deadline = addSeconds(-1);
    await insert(db.pool, 'execution_snapshots', { id: snapshotId, tenant_id: p.tenantId, order_id: orderId, hash: 'a'.repeat(64), data: {} });
    await insert(db.pool, 'render_jobs', { id: jobId, tenant_id: p.tenantId, owner_id: p.userId, order_id: orderId, execution_snapshot_id: snapshotId,
      state: 'QUEUED', deadline_at: deadline, data: { job_id: jobId, order_id: orderId, state: 'QUEUED', current_stage: 'PRODUCTION', completed_stage_count: 0, total_stage_count: 6, repair_rounds: 0, deadline_at: deadline, updated_at: addSeconds(0) } });
    const stageId = await enqueueStage(db.pool, { tenantId: p.tenantId, scopeType: 'ORDER', scopeId: orderId, name: 'PRODUCTION', inputHash: 'a'.repeat(64), deadlineAt: deadline, jobId });
    await db.pool.query("UPDATE orders SET deadline_at=now()-interval '1 second' WHERE id=$1", [orderId]);
    const results = await Promise.all([expireWork(db.pool), expireWork(db.pool)]);
    expect(results.reduce((n, r) => n + r.orders, 0)).toBe(1);
    const order = (await db.pool.query('SELECT fulfillment_state,data FROM orders WHERE id=$1', [orderId])).rows[0];
    expect(order.fulfillment_state).toBe('FAILED'); expect(order.data.refund_id).toMatch(/^refund_/);
    const stage = (await db.pool.query('SELECT state,fencing_token FROM stage_runs WHERE id=$1', [stageId])).rows[0];
    expect(stage.state).toBe('FAILED'); expect(Number(stage.fencing_token)).toBe(1);
    const job = (await db.pool.query('SELECT data FROM render_jobs WHERE id=$1', [jobId])).rows[0];
    expect(validate('Job', job.data).state).toBe('FAILED');
    expect((await db.pool.query('SELECT count(*)::int AS n FROM refunds WHERE order_id=$1', [orderId])).rows[0].n).toBe(1);
    expect((await db.pool.query("SELECT count(*)::int AS n FROM outbox_events WHERE aggregate_id=$1 AND aggregate_type='ReleaseRequested'", [orderId])).rows[0].n).toBe(1);
  });
  it('only claims registered work and never acknowledges an unsupported durable event', async () => {
    const { principal: p } = await account(db);
    const unknown = await enqueueStage(db.pool, { tenantId: p.tenantId, scopeType: 'PLAN', scopeId: id('plan'), name: 'NOT_IMPLEMENTED_TEST', inputHash: 'a'.repeat(64), deadlineAt: addSeconds(90) });
    const known = await enqueueStage(db.pool, { tenantId: p.tenantId, scopeType: 'PLAN', scopeId: id('plan'), name: 'KNOWN_TEST', inputHash: 'b'.repeat(64), deadlineAt: addSeconds(90) });
    await outbox(db.pool, p.tenantId, 'UnsupportedTest', 'unknown-event', id('evtkey'), {});
    await outbox(db.pool, p.tenantId, 'SupportedTest', 'known-event', id('evtkey'), {});
    let events = 0;
    const runtime = new WorkerRuntime({ pool: db.pool, workerId: 'worker-routing', stages: { KNOWN_TEST: async () => async client => { await client.query("UPDATE stage_runs SET private='{\"done\":true}' WHERE id=$1", [known]); } }, events: { SupportedTest: async () => { events++; } } });
    await runtime.tick(signal()); expect(events).toBe(1);
    expect((await db.pool.query('SELECT state FROM stage_runs WHERE id=$1', [known])).rows[0].state).toBe('SUCCEEDED');
    expect((await db.pool.query('SELECT state FROM stage_runs WHERE id=$1', [unknown])).rows[0].state).toBe('READY');
    expect((await db.pool.query("SELECT delivered_at,attempts FROM outbox_events WHERE aggregate_id='unknown-event'")).rows[0]).toMatchObject({ delivered_at: null, attempts: 0 });
  });
  it('persists UNKNOWN without restarting the external operation or spending a repair attempt', async () => {
    const { principal: p } = await account(db);
    const stageId = await enqueueStage(db.pool, { tenantId: p.tenantId, scopeType: 'PLAN', scopeId: id('plan'), name: 'PENDING_TEST', inputHash: 'c'.repeat(64), deadlineAt: addSeconds(90) });
    const runtime = new WorkerRuntime({ pool: db.pool, workerId: 'worker-pending', stages: { PENDING_TEST: async () => { throw new PendingExternal(10); } }, events: {} });
    await runtime.processStage(signal());
    expect((await db.pool.query('SELECT state,attempt,lease_owner FROM stage_runs WHERE id=$1', [stageId])).rows[0]).toMatchObject({ state: 'UNKNOWN', attempt: 1, lease_owner: null });
    expect(await runtime.processStage(signal())).toBe(false);
  });
  it('aborts a running handler after lease loss and prevents its result from committing', async () => {
    const { principal: p } = await account(db);
    const stageId = await enqueueStage(db.pool, { tenantId: p.tenantId, scopeType: 'PLAN', scopeId: id('plan'), name: 'LEASE_TEST', inputHash: 'd'.repeat(64), deadlineAt: addSeconds(90) });
    let observedAbort = false; let committed = false;
    const runtime = new WorkerRuntime({ pool: db.pool, workerId: 'worker-heartbeat', heartbeatMs: 10, stages: { LEASE_TEST: async (_lease, s) => {
      await db.pool.query('UPDATE stage_runs SET fencing_token=fencing_token+1 WHERE id=$1', [stageId]);
      await new Promise<void>((resolve, reject) => { const timeout = setTimeout(() => reject(new Error('Heartbeat did not cancel handler')), 2000); s.addEventListener('abort', () => { observedAbort = true; clearTimeout(timeout); resolve(); }, { once: true }); });
      return async () => { committed = true; };
    } }, events: {} });
    await runtime.processStage(signal()); expect(observedAbort).toBe(true); expect(committed).toBe(false);
  });
  it('ends an expired unpaid window without fabricating a payment failure or a refund', async () => {
    const { principal: p, orderId } = await orderFixture(db);
    await db.pool.query(`UPDATE orders SET payment_state='PENDING',fulfillment_state='NOT_STARTED',deadline_at=NULL,payable_until=now()-interval '1 second',
      data=data||'{"payment_state":"PENDING","fulfillment_state":"NOT_STARTED"}'::jsonb WHERE id=$1`, [orderId]);
    await expireWork(db.pool);
    expect((await db.pool.query('SELECT payment_state,fulfillment_state FROM orders WHERE id=$1', [orderId])).rows[0]).toEqual({ payment_state: 'PENDING', fulfillment_state: 'CANCELLED' });
    expect((await db.pool.query('SELECT id FROM refunds WHERE order_id=$1 AND tenant_id=$2', [orderId, p.tenantId])).rows).toHaveLength(0);
    expect((await db.pool.query("SELECT id FROM outbox_events WHERE aggregate_id=$1 AND aggregate_type='PaymentQueryRequested'", [orderId])).rows).toHaveLength(1);
  });
});
