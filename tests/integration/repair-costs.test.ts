import { afterAll, beforeAll, expect, it } from 'vitest';
import { setTimeout as pause } from 'node:timers/promises';
import { testDatabase, orderFixture, type TestDatabase } from '../helpers/database.js';
import { transaction } from '../../src/api/db/pool.js';
import { insert } from '../../src/api/db/store.js';
import { hash, id, addSeconds } from '../../src/api/lib/crypto.js';
import { enqueueStage } from '../../src/worker/queue/enqueue.js';
import type { StageLease } from '../../src/worker/queue/leases.js';
import { reserve, reserveStageCost, settle, type StageCost } from '../../src/worker/budget/reservations.js';

let db: TestDatabase;
beforeAll(async () => { db = await testDatabase(); });
afterAll(async () => { await db?.close(); });
const rate = { version: 'synthetic-repair-ledger', currency: 'CNY' };

/** Explicit database-only authorization control, NOT a real report/repair.
 * These fixtures bypass the coordinator to exercise the money boundary. */
async function fixture(options: { grant?: boolean; calls?: number; purposeStage?: string } = {}) {
  const f = await orderFixture(db, 100), tenantId = f.principal.tenantId;
  const deadline = (await db.pool.query('SELECT deadline_at FROM orders WHERE id=$1', [f.orderId])).rows[0].deadline_at.toISOString();
  const contract = { repair_ceiling_micro: 30, revision_policy: { budget_micro: 20 } };
  await db.pool.query(`UPDATE orders SET private=jsonb_build_object('contract',$2::jsonb) WHERE id=$1`, [f.orderId, JSON.stringify(contract)]);
  const snapshot = { tenant_id: tenantId, order_id: f.orderId, deadline_at: deadline,
    budget: { ceiling_micro: 100, repair_ceiling_micro: 30, extra_calls_limit: options.calls ?? 20,
      max_repair_rounds: 1, retry_extends_deadline: false } };
  const snapshotId = id('snapshot'), jobId = id('job'), packetId = id('packet'), authorizationId = id('repair_cost');
  await insert(db.pool, 'execution_snapshots', { id: snapshotId, tenant_id: tenantId, order_id: f.orderId, hash: hash(snapshot), data: snapshot });
  await insert(db.pool, 'render_jobs', { id: jobId, tenant_id: tenantId, owner_id: f.principal.userId, order_id: f.orderId,
    execution_snapshot_id: snapshotId, state: 'QC', deadline_at: deadline, repair_rounds: 1, data: {} });
  await insert(db.pool, 'review_packets', { id: packetId, tenant_id: tenantId, order_id: f.orderId, snapshot_hash: hash(snapshot),
    output_set_hash: 'e'.repeat(64), packet_hash: 'f'.repeat(64), state: 'FAILED', data: {} });
  const stageIds: string[] = [], stages = ['PRODUCTION','POST','QC','REVIEW_FACTS','REVIEW_STYLE','DELIVER'];
  let lease!: StageLease;
  for (const name of stages) {
    const stageId = await enqueueStage(db.pool, { tenantId, scopeType: 'ORDER', scopeId: f.orderId, jobId, name,
      attempt: 2, inputHash: hash(snapshot), deadlineAt: deadline });
    stageIds.push(stageId);
    if (name === (options.purposeStage ?? 'PRODUCTION')) lease = (await db.pool.query<StageLease>(`UPDATE stage_runs
      SET state='RUNNING',lease_owner=$2,fencing_token=1,lease_expires_at=now()+interval '45 seconds' WHERE id=$1 RETURNING *`,
    [stageId, id('worker')])).rows[0]!;
  }
  if (options.grant !== false) await insert(db.pool, 'repair_cost_authorizations', { id: authorizationId, tenant_id: tenantId,
    order_id: f.orderId, job_id: jobId, source_packet_id: packetId, source_packet_hash: 'f'.repeat(64), snapshot_hash: hash(snapshot),
    binding_hash: hash({ synthetic: f.orderId }), ceiling_micro: 30, extra_calls_limit: options.calls ?? 20, deadline_at: deadline,
    stage_ids: stageIds, generation_nodes: JSON.stringify([{ kind: 'IMAGE', operation_key: 'reference:shot-1', original_submission_id: 'synthetic_original' }]) });
  const scope = { tenantId, orderId: f.orderId };
  return { ...f, scope, lease, authorizationId, snapshotId,
    buy: (key: string, amount: number, cost: StageCost = { kind: 'INFERENCE' }, pricing: unknown = rate) =>
      transaction(db.pool, c => reserveStageCost(c, lease, `${f.orderId}:${key}`, amount, pricing, cost)),
    first: (key: string, amount: number) => transaction(db.pool, c => reserve(c, scope, `${f.orderId}:${key}`, amount, rate)) };
}

it('shares the original total under concurrent first-pass/repair purchases while retaining the aftercare hold', async () => {
  const f = await fixture();
  const first = await Promise.allSettled(Array.from({ length: 8 }, (_, n) => f.first(`first-${n}`, 10)));
  expect(first.filter(r => r.status === 'fulfilled')).toHaveLength(5);
  const repairs = await Promise.allSettled(Array.from({ length: 9 }, (_, n) => f.buy(`repair-${n}`, 10)));
  expect(repairs.filter(r => r.status === 'fulfilled')).toHaveLength(3);
  expect(repairs.filter(r => r.status === 'rejected').every(r => r.reason.code === 'REPAIR_COST_LIMIT')).toBe(true);
  await expect(f.first('cannot-use-repair-or-aftercare', 1)).rejects.toMatchObject({ code: 'BUDGET_OR_DEADLINE_EXCEEDED' });
  const row = (await db.pool.query('SELECT budget_micro,reserved_micro,spent_micro FROM orders WHERE id=$1', [f.orderId])).rows[0];
  expect([+row.budget_micro, +row.reserved_micro, +row.spent_micro]).toEqual([100, 80, 0]);
});

it('does not freeze remaining first-pass capacity merely because a repair has consumed its own hold', async () => {
  const f = await fixture();
  await f.buy('repair', 30);
  await f.first('remaining-first-pass', 50);
  await expect(f.first('no-extra-first-pass', 1)).rejects.toMatchObject({ code: 'BUDGET_OR_DEADLINE_EXCEEDED' });
  expect(+(await db.pool.query('SELECT reserved_micro FROM orders WHERE id=$1', [f.orderId])).rows[0].reserved_micro).toBe(80);
});

it('retains UNKNOWN, replays only its exact original binding and returns only actual unused cost to the same repair ceiling', async () => {
  const f = await fixture();
  const original = await f.buy('original', 30);
  await transaction(db.pool, c => settle(c, f.scope.tenantId, original, null));
  expect(await f.buy('original', 30, undefined, { currency: 'CNY', version: 'synthetic-repair-ledger' })).toBe(original);
  await expect(f.buy('other', 1)).rejects.toMatchObject({ code: 'REPAIR_COST_LIMIT' });
  await expect(f.buy('original', 29)).rejects.toMatchObject({ code: 'COST_INTENT_CONFLICT' });
  await expect(f.buy('original', 30, undefined, { version: 'changed' })).rejects.toMatchObject({ code: 'COST_INTENT_CONFLICT' });
  await expect(f.first('original', 30)).rejects.toMatchObject({ code: 'COST_INTENT_CONFLICT' });
  await transaction(db.pool, c => settle(c, f.scope.tenantId, original, 22));
  await transaction(db.pool, c => settle(c, f.scope.tenantId, original, 22));
  await f.buy('only-unused-eight', 8);
  await expect(f.buy('still-not-replenished', 1)).rejects.toMatchObject({ code: 'REPAIR_COST_LIMIT' });
  expect((await db.pool.query('SELECT purpose,state,settled_micro FROM budget_reservations WHERE id=$1', [original])).rows[0])
    .toMatchObject({ purpose: 'REPAIR', state: 'SETTLED', settled_micro: '22' });
});

it('counts known-no-charge and zero-cost extra calls without resetting the original whole-order call limit', async () => {
  const f = await fixture({ calls: 2 });
  const original = await f.buy('no-charge', 1);
  await transaction(db.pool, c => settle(c, f.scope.tenantId, original, null, true));
  await f.buy('zero-cost-still-a-call', 0);
  await expect(f.buy('third-call', 0)).rejects.toMatchObject({ code: 'REPAIR_COST_LIMIT' });
  expect(await f.buy('no-charge', 1)).toBe(original);
  expect((await db.pool.query('SELECT count(*) FROM budget_reservations WHERE order_id=$1', [f.orderId])).rows[0].count).toBe('2');
});

it('permits one extra purchase of an affected generation node, even after known-no-charge, and rejects other nodes', async () => {
  const f = await fixture(), node: StageCost = { kind: 'IMAGE', operationKey: 'reference:shot-1' };
  const original = await f.buy('node-original', 2, node);
  await transaction(db.pool, c => settle(c, f.scope.tenantId, original, null, true));
  expect(await f.buy('node-original', 2, node)).toBe(original);
  await expect(f.buy('node-repurchase', 2, node)).rejects.toMatchObject({ code: 'REPAIR_NODE_CALL_EXHAUSTED' });
  await expect(f.buy('unaffected', 2, { kind: 'IMAGE', operationKey: 'reference:shot-2' })).rejects.toMatchObject({ code: 'REPAIR_NODE_NOT_AUTHORIZED' });
  await expect(f.buy('wrong-kind', 2, { kind: 'VIDEO', operationKey: 'reference:shot-1' })).rejects.toMatchObject({ code: 'REPAIR_NODE_NOT_AUTHORIZED' });
  await expect(f.buy('node-original', 2, { kind: 'INFERENCE' })).rejects.toMatchObject({ code: 'COST_INTENT_CONFLICT' });
});

it('requires a registered repair stage, original snapshot, job round and permitted paid capability', async () => {
  const missing = await fixture({ grant: false });
  await expect(missing.buy('no-authorization', 1)).rejects.toMatchObject({ code: 'REPAIR_COST_NOT_AUTHORIZED' });
  const f = await fixture();
  await expect(f.buy('wrong-role', 1, { kind: 'LISTENING' })).rejects.toMatchObject({ code: 'REPAIR_COST_STAGE_INVALID' });
  await db.pool.query("UPDATE stage_runs SET input_hash=$2 WHERE id=$1", [f.lease.id, '0'.repeat(64)]);
  await expect(f.buy('changed-snapshot', 1)).rejects.toMatchObject({ code: 'COST_STAGE_INVALID' });
  await db.pool.query('UPDATE stage_runs SET input_hash=$2 WHERE id=$1', [f.lease.id, f.lease.input_hash]);
  await db.pool.query('UPDATE render_jobs SET repair_rounds=0 WHERE id=$1', [f.lease.job_id]);
  await expect(f.buy('round-not-started', 1)).rejects.toMatchObject({ code: 'REPAIR_COST_NOT_AUTHORIZED' });
  expect((await db.pool.query('SELECT count(*) FROM budget_reservations WHERE order_id=ANY($1::text[])', [[f.orderId, missing.orderId]])).rows[0].count).toBe('0');
});

it('rejects revoked media, expired original deadlines and stale leases without releasing existing holds', async () => {
  const f = await fixture(); const original = await f.buy('already-purchased', 5);
  await db.pool.query(`UPDATE orders SET private=private||'{"media_revoked":true}'::jsonb WHERE id=$1`, [f.orderId]);
  await expect(f.buy('revoked', 1)).rejects.toMatchObject({ code: 'ORDER_NO_LONGER_EXECUTABLE' });
  await db.pool.query(`UPDATE orders SET private=private-'media_revoked' WHERE id=$1`, [f.orderId]);
  await db.pool.query('UPDATE stage_runs SET fencing_token=fencing_token+1 WHERE id=$1', [f.lease.id]);
  await expect(f.buy('stale', 1)).rejects.toMatchObject({ code: 'LEASE_LOST' });
  await db.pool.query('UPDATE orders SET deadline_at=$2 WHERE id=$1', [f.orderId, addSeconds(-1)]);
  await expect(f.buy('expired', 1)).rejects.toMatchObject({ code: 'ORDER_NO_LONGER_EXECUTABLE' });
  await transaction(db.pool, c => settle(c, f.scope.tenantId, original, null));
  expect(+(await db.pool.query('SELECT reserved_micro FROM orders WHERE id=$1', [f.orderId])).rows[0].reserved_micro).toBe(5);
});

it('rechecks the actual deadline after waiting on a competing order transaction', async () => {
  const f = await fixture(), lock = await db.pool.connect(), waiter = await db.pool.connect();
  let attempt: Promise<{ error?: unknown }> | undefined;
  try {
    await lock.query('BEGIN'); await lock.query('SELECT id FROM orders WHERE id=$1 FOR UPDATE', [f.orderId]);
    await waiter.query('BEGIN'); const pid = (await waiter.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
    attempt = reserveStageCost(waiter, f.lease, `${f.orderId}:blocked`, 1, rate, { kind: 'INFERENCE' }).then(() => ({}), error => ({ error }));
    let blocked = false; const until = Date.now() + 5000;
    while (Date.now() < until) {
      if ((await db.pool.query('SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1', [pid])).rows[0]?.wait_event_type === 'Lock') { blocked = true; break; }
      await pause(25);
    }
    expect(blocked).toBe(true);
    await lock.query('UPDATE orders SET deadline_at=clock_timestamp() WHERE id=$1', [f.orderId]); await lock.query('COMMIT');
    expect((await attempt).error).toMatchObject({ code: 'ORDER_NO_LONGER_EXECUTABLE' });
  } finally {
    await lock.query('ROLLBACK'); await attempt; await waiter.query('ROLLBACK'); lock.release(); waiter.release();
  }
  expect((await db.pool.query('SELECT count(*) FROM budget_reservations WHERE order_id=$1', [f.orderId])).rows[0].count).toBe('0');
});

it('makes purpose, authorization, rate and terminal settlements immutable', async () => {
  const f = await fixture(), reservation = await f.buy('immutable', 4);
  await expect(db.pool.query('UPDATE repair_cost_authorizations SET ceiling_micro=31 WHERE id=$1', [f.authorizationId])).rejects.toThrow('immutable');
  await expect(db.pool.query('DELETE FROM repair_cost_authorizations WHERE id=$1', [f.authorizationId])).rejects.toThrow('immutable');
  await expect(db.pool.query("UPDATE budget_reservations SET repair_node_key='changed' WHERE id=$1", [reservation])).rejects.toThrow('immutable');
  await expect(db.pool.query("UPDATE budget_reservations SET rate_snapshot='{}'::jsonb WHERE id=$1", [reservation])).rejects.toThrow('immutable');
  await transaction(db.pool, c => settle(c, f.scope.tenantId, reservation, 3));
  await expect(db.pool.query('UPDATE budget_reservations SET settled_micro=2 WHERE id=$1', [reservation])).rejects.toThrow('immutable');
  await expect(db.pool.query("UPDATE budget_reservations SET state='UNKNOWN' WHERE id=$1", [reservation])).rejects.toThrow('immutable');
});

it('rejects a forged first-pass lease order, job, input or phase before charging either order', async () => {
  const owner = await orderFixture(db, 100), other = await orderFixture(db, 100, owner.principal);
  expect(other.principal.tenantId).toBe(owner.principal.tenantId);
  const stageId = await enqueueStage(db.pool, { tenantId: owner.principal.tenantId, scopeType: 'ORDER', scopeId: owner.orderId,
    name: 'PRODUCTION', inputHash: 'a'.repeat(64), deadlineAt: addSeconds(300) });
  const lease = (await db.pool.query<StageLease>(`UPDATE stage_runs SET state='RUNNING',lease_owner=$2,
    fencing_token=1,lease_expires_at=now()+interval '45 seconds' WHERE id=$1 RETURNING *`, [stageId, id('worker')])).rows[0]!;
  for (const [n, forged] of [{ ...lease, scope_id: other.orderId }, { ...lease, job_id: 'invented_job' },
    { ...lease, input_hash: 'b'.repeat(64) }, { ...lease, stage_name: 'POST' }].entries()) {
    await expect(transaction(db.pool, c => reserveStageCost(c, forged, `${owner.orderId}:forged-${n}`, 1, rate, { kind: 'INFERENCE' })))
      .rejects.toMatchObject({ code: 'COST_STAGE_INVALID' });
  }
  expect((await db.pool.query('SELECT count(*) FROM budget_reservations WHERE order_id=ANY($1::text[])', [[owner.orderId, other.orderId]])).rows[0].count).toBe('0');
  const foreign = await orderFixture(db, 100);
  await expect(transaction(db.pool, c => reserveStageCost(c, { ...lease, scope_id: foreign.orderId }, `${owner.orderId}:foreign`, 1, rate, { kind: 'INFERENCE' })))
    .rejects.toMatchObject({ code: 'ORDER_NO_LONGER_EXECUTABLE' });
  const original = await transaction(db.pool, c => reserveStageCost(c, lease, `${owner.orderId}:valid`, 3, rate, { kind: 'INFERENCE' }));
  expect((await db.pool.query('SELECT order_id,purpose FROM budget_reservations WHERE id=$1', [original])).rows[0])
    .toEqual({ order_id: owner.orderId, purpose: 'FIRST_PASS' });
});
