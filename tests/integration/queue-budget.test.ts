import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { testDatabase, account, orderFixture, type TestDatabase } from '../helpers/database.js';
import { enqueueStage } from '../../src/worker/queue/enqueue.js';
import { claimStage, heartbeatStage, completeStage, type StageLease } from '../../src/worker/queue/leases.js';
import { claimEvent, finishEvent } from '../../src/worker/queue/outbox.js';
import { outbox, idempotent } from '../../src/api/db/store.js';
import { transaction } from '../../src/api/db/pool.js';
import { addSeconds } from '../../src/api/lib/crypto.js';
import { reserve, settle } from '../../src/worker/budget/reservations.js';
let db: TestDatabase;
beforeAll(async () => { db = await testDatabase(); }); afterAll(async () => { await db?.close(); });
describe('native PostgreSQL recovery and money boundaries', () => {
  it('claims once under concurrency and rejects an expired worker after takeover', async () => {
    const { principal: p } = await account(db);
    const stageId = await enqueueStage(db.pool, { tenantId: p.tenantId, scopeType: 'PLAN', scopeId: 'test-plan', name: 'PLAN', inputHash: 'a'.repeat(64), deadlineAt: addSeconds(300) });
    const claimed = (await Promise.all(Array.from({ length: 8 }, (_, i) => claimStage(db.pool, `worker-${i}`)))).filter((v): v is StageLease => !!v);
    expect(claimed).toHaveLength(1); const first = claimed[0]!; expect(first.id).toBe(stageId);
    await db.pool.query("UPDATE stage_runs SET lease_expires_at=now()-interval '1 second' WHERE id=$1", [stageId]);
    const second = (await claimStage(db.pool, 'worker-new'))!; expect(BigInt(second.fencing_token)).toBe(BigInt(first.fencing_token) + 1n);
    expect(await heartbeatStage(db.pool, first)).toBe(false);
    await expect(completeStage(db.pool, first, async client => { await client.query("UPDATE stage_runs SET private='{\"illegal\":true}' WHERE id=$1", [stageId]); })).rejects.toMatchObject({ code: 'LEASE_LOST' });
    await completeStage(db.pool, second, async client => { await client.query("UPDATE stage_runs SET private='{\"accepted\":true}' WHERE id=$1", [stageId]); });
    const row = (await db.pool.query('SELECT state,private FROM stage_runs WHERE id=$1', [stageId])).rows[0]; expect(row.state).toBe('SUCCEEDED'); expect(row.private).toEqual({ accepted: true });
  });
  it('does not claim dependent stages until every prerequisite succeeds', async () => {
    const { principal: p } = await account(db);
    const firstId = await enqueueStage(db.pool, { tenantId: p.tenantId, scopeType: 'PLAN', scopeId: 'dep-plan-a', name: 'PLAN', inputHash: 'b'.repeat(64), deadlineAt: addSeconds(300) });
    const secondId = await enqueueStage(db.pool, { tenantId: p.tenantId, scopeType: 'PLAN', scopeId: 'dep-plan-b', name: 'PLAN', inputHash: 'c'.repeat(64), deadlineAt: addSeconds(300), dependencies: [firstId] });
    const first = (await claimStage(db.pool, 'dependency-worker'))!; expect(first.id).toBe(firstId); expect(await claimStage(db.pool, 'other-worker')).toBeNull();
    await completeStage(db.pool, first, async () => {}); const second = (await claimStage(db.pool, 'dependency-worker'))!; expect(second.id).toBe(secondId); await completeStage(db.pool, second, async () => {});
  });
  it('reserves the shared ceiling atomically and keeps uncertain charges occupied', async () => {
    const { principal: p, orderId } = await orderFixture(db, 100);
    const scope = { tenantId: p.tenantId, orderId };
    const results = await Promise.allSettled(Array.from({ length: 14 }, (_, i) => transaction(db.pool, c => reserve(c, scope, `budget:${orderId}:${i}`, 10, { version: 'synthetic-test-only' }))));
    const wins = results.filter((r): r is PromiseFulfilledResult<string> => r.status === 'fulfilled'); expect(wins).toHaveLength(10);
    const first = wins[0]!.value; const second = wins[1]!.value;
    await transaction(db.pool, c => settle(c, p.tenantId, first, null));
    expect(Number((await db.pool.query('SELECT reserved_micro FROM orders WHERE id=$1', [orderId])).rows[0].reserved_micro)).toBe(100);
    await transaction(db.pool, c => settle(c, p.tenantId, first, 6)); await transaction(db.pool, c => settle(c, p.tenantId, first, 6));
    await transaction(db.pool, c => settle(c, p.tenantId, second, null, true));
    const row = (await db.pool.query('SELECT spent_micro,reserved_micro FROM orders WHERE id=$1', [orderId])).rows[0]; expect(Number(row.spent_micro)).toBe(6); expect(Number(row.reserved_micro)).toBe(80);
  });
  it('fences outbox completion and safely reclaims abandoned events', async () => {
    const { principal: p } = await account(db); await outbox(db.pool, p.tenantId, 'SyntheticTestEvent', 'resource-test', 'event-test-key', {});
    const first = (await claimEvent(db.pool, 'event-worker-a'))!; expect(await claimEvent(db.pool, 'event-worker-b')).toBeNull();
    await db.pool.query("UPDATE outbox_events SET lease_expires_at=now()-interval '1 second' WHERE id=$1", [first.id]);
    const second = (await claimEvent(db.pool, 'event-worker-b'))!; await finishEvent(db.pool, first);
    expect((await db.pool.query('SELECT delivered_at FROM outbox_events WHERE id=$1', [first.id])).rows[0].delivered_at).toBeNull();
    await finishEvent(db.pool, second); expect((await db.pool.query('SELECT delivered_at FROM outbox_events WHERE id=$1', [first.id])).rows[0].delivered_at).not.toBeNull();
  });
  it('returns the original mutation under concurrent idempotent requests and rejects content changes', async () => {
    const { principal: p } = await account(db); let mutations = 0;
    const request = () => transaction(db.pool, client => idempotent(client, p, 'synthetic-test', 'resource', 'request-key-0001', { selected: 'a' }, async () => { mutations++; return { identity: 'original' }; }));
    const results = await Promise.all(Array.from({ length: 6 }, request)); expect(mutations).toBe(1); expect(results.every(r => r.identity === 'original')).toBe(true);
    await expect(transaction(db.pool, client => idempotent(client, p, 'synthetic-test', 'resource', 'request-key-0001', { selected: 'b' }, async () => ({ identity: 'different' })))).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
  });
});
