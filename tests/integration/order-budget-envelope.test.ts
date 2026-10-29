import { afterAll, beforeAll, expect, it } from 'vitest';
import { testDatabase, orderFixture, type TestDatabase } from '../helpers/database.js';
import { transaction } from '../../src/api/db/pool.js';
import { reserve, settle } from '../../src/worker/budget/reservations.js';
import { addSeconds } from '../../src/api/lib/crypto.js';
import { setTimeout as pause } from 'node:timers/promises';

let db: TestDatabase;
beforeAll(async () => { db = await testDatabase(); });
afterAll(async () => { await db?.close(); });
const rate = { version: 'synthetic-budget-only', currency: 'CNY', ceiling_micro: 10 };
async function fixture(contract: unknown = { repair_ceiling_micro: 30, revision_policy: { budget_micro: 20 } }) {
  const f = await orderFixture(db, 100);
  await db.pool.query(`UPDATE orders SET private=jsonb_build_object('contract',$2::jsonb) WHERE id=$1`, [f.orderId, JSON.stringify(contract)]);
  const scope = { tenantId: f.principal.tenantId, orderId: f.orderId };
  return { ...f, scope, buy: (key: string, amount: number, pricing: unknown = rate) =>
    transaction(db.pool, c => reserve(c, scope, `${f.orderId}:${key}`, amount, pricing)) };
}

it('protects repair and aftercare together under concurrent first-pass purchases and UNKNOWN recovery', async () => {
  const f = await fixture();
  const attempts = await Promise.allSettled(Array.from({ length: 12 }, (_, n) => f.buy(`parallel-${n}`, 10)));
  const wins = attempts.filter((v): v is PromiseFulfilledResult<string> => v.status === 'fulfilled');
  expect(wins).toHaveLength(5);
  expect(attempts.filter(v => v.status === 'rejected').every(v => v.reason.code === 'BUDGET_OR_DEADLINE_EXCEEDED')).toBe(true);
  const first = wins[0]!.value, second = wins[1]!.value;
  await transaction(db.pool, c => settle(c, f.scope.tenantId, first, null));
  await expect(f.buy('unknown-is-not-free', 1)).rejects.toMatchObject({ code: 'BUDGET_OR_DEADLINE_EXCEEDED' });
  await transaction(db.pool, c => settle(c, f.scope.tenantId, first, 6));
  await transaction(db.pool, c => settle(c, f.scope.tenantId, first, 6));
  await f.buy('only-actual-unused-bound', 4);
  await expect(f.buy('cannot-use-protected-holds', 1)).rejects.toMatchObject({ code: 'BUDGET_OR_DEADLINE_EXCEEDED' });
  await transaction(db.pool, c => settle(c, f.scope.tenantId, second, null, true));
  await f.buy('known-no-charge-releases-original', 10);
  const row = (await db.pool.query('SELECT budget_micro,spent_micro,reserved_micro,deadline_at,private FROM orders WHERE id=$1', [f.orderId])).rows[0];
  expect([Number(row.budget_micro), Number(row.spent_micro), Number(row.reserved_micro)]).toEqual([100, 6, 44]);
  expect(row.private.contract).toEqual({ repair_ceiling_micro: 30, revision_policy: { budget_micro: 20 } });
});

it('replays only the same cost owner, amount and canonical rate without replenishing an UNKNOWN hold', async () => {
  const f = await fixture();
  const original = await f.buy('one-original', 20);
  await transaction(db.pool, c => settle(c, f.scope.tenantId, original, null));
  expect(await f.buy('one-original', 20, { ceiling_micro: 10, currency: 'CNY', version: 'synthetic-budget-only' })).toBe(original);
  await expect(f.buy('one-original', 19)).rejects.toMatchObject({ code: 'COST_INTENT_CONFLICT' });
  await expect(f.buy('one-original', 20, { ...rate, version: 'changed-rate' })).rejects.toMatchObject({ code: 'COST_INTENT_CONFLICT' });
  const other = await fixture();
  await expect(transaction(db.pool, c => reserve(c, other.scope, `${f.orderId}:one-original`, 20, rate)))
    .rejects.toMatchObject({ code: 'COST_INTENT_CONFLICT' });
  const row = (await db.pool.query('SELECT reserved_micro FROM orders WHERE id=$1', [f.orderId])).rows[0];
  expect(Number(row.reserved_micro)).toBe(20);
  expect((await db.pool.query('SELECT state FROM budget_reservations WHERE id=$1', [original])).rows[0].state).toBe('UNKNOWN');
});

it('fails closed on malformed or overflowing frozen holds without creating a cost intent', async () => {
  const f = await fixture();
  const invalid = [
    { repair_ceiling_micro: '30' }, { repair_ceiling_micro: -1 }, { repair_ceiling_micro: 0.5 },
    { repair_ceiling_micro: null }, { repair_ceiling_micro: Number.MAX_SAFE_INTEGER + 1 },
    { repair_ceiling_micro: 81, revision_policy: { budget_micro: 20 } },
    { repair_ceiling_micro: 30, revision_policy: { budget_micro: -1 } },
    { revision_policy: null }, { revision_policy: {} }, null, [],
  ];
  for (const [index, contract] of invalid.entries()) {
    await db.pool.query(`UPDATE orders SET private=jsonb_build_object('contract',$2::jsonb) WHERE id=$1`, [f.orderId, JSON.stringify(contract)]);
    await expect(f.buy(`invalid-${index}`, 1)).rejects.toMatchObject({ code: 'ORDER_BUDGET_INVALID' });
  }
  expect((await db.pool.query('SELECT count(*) FROM budget_reservations WHERE order_id=$1', [f.orderId])).rows[0].count).toBe('0');
  expect(Number((await db.pool.query('SELECT reserved_micro FROM orders WHERE id=$1', [f.orderId])).rows[0].reserved_micro)).toBe(0);
});

it('rejects new spending after revocation, payment withdrawal or the original deadline while retaining original accounting', async () => {
  const f = await fixture();
  const original = await f.buy('original', 10);
  await db.pool.query(`UPDATE orders SET private=private||'{"media_revoked":true}'::jsonb WHERE id=$1`, [f.orderId]);
  await expect(f.buy('revoked', 1)).rejects.toMatchObject({ code: 'BUDGET_OR_DEADLINE_EXCEEDED' });
  await db.pool.query(`UPDATE orders SET private=private-'media_revoked',payment_state='PENDING' WHERE id=$1`, [f.orderId]);
  await expect(f.buy('not-paid', 1)).rejects.toMatchObject({ code: 'BUDGET_OR_DEADLINE_EXCEEDED' });
  await db.pool.query(`UPDATE orders SET payment_state='CONFIRMED',deadline_at=$2 WHERE id=$1`, [f.orderId, addSeconds(-1)]);
  await expect(f.buy('expired', 1)).rejects.toMatchObject({ code: 'BUDGET_OR_DEADLINE_EXCEEDED' });
  expect(await f.buy('original', 10)).toBe(original); // Accounting replay alone does not authorize provider I/O.
  await transaction(db.pool, c => settle(c, f.scope.tenantId, original, 7));
  const row = (await db.pool.query('SELECT spent_micro,reserved_micro FROM orders WHERE id=$1', [f.orderId])).rows[0];
  expect([Number(row.spent_micro), Number(row.reserved_micro)]).toEqual([7, 0]);
});

it('checks the wall clock after a competing transaction releases the order lock', async () => {
  const f = await fixture(); const lock = await db.pool.connect(), waiter = await db.pool.connect();
  let attempt: Promise<{ error?: unknown }> | undefined;
  try {
    await lock.query('BEGIN'); await lock.query('SELECT id FROM orders WHERE id=$1 FOR UPDATE', [f.orderId]);
    await waiter.query('BEGIN');
    const pid = (await waiter.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
    attempt = reserve(waiter, f.scope, `${f.orderId}:waited-past-deadline`, 1, rate)
      .then(() => ({}), error => ({ error }));
    let blocked = false; const until = Date.now() + 5000;
    while (Date.now() < until) {
      const row = (await db.pool.query('SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1', [pid])).rows[0];
      if (row?.wait_event_type === 'Lock') { blocked = true; break; }
      await pause(25);
    }
    expect(blocked, 'The cost transaction must actually wait behind the competing order lock').toBe(true);
    // Its transaction has already started: now() would incorrectly admit it.
    // Only this owned synthetic order is expired; original limits stay intact.
    await lock.query('UPDATE orders SET deadline_at=clock_timestamp() WHERE id=$1', [f.orderId]);
    await lock.query('COMMIT');
    expect((await attempt).error).toMatchObject({ code: 'BUDGET_OR_DEADLINE_EXCEEDED' });
  } finally {
    await lock.query('ROLLBACK');
    await attempt;
    await waiter.query('ROLLBACK');
    lock.release(); waiter.release();
  }
  expect((await db.pool.query('SELECT count(*) FROM budget_reservations WHERE order_id=$1', [f.orderId])).rows[0].count).toBe('0');
});

it('preserves historical obligations that already consumed the protected portion and blocks additional purchases', async () => {
  const f = await fixture({});
  const original = await f.buy('historical-original', 80);
  // Recreate an old ledger written before the hold was enforced. Do not
  // rewrite the original reservation or pretend an unknown bill is free.
  await db.pool.query(`UPDATE orders SET private=jsonb_build_object('contract',$2::jsonb) WHERE id=$1`,
    [f.orderId, JSON.stringify({ repair_ceiling_micro: 30, revision_policy: { budget_micro: 20 } })]);
  await expect(f.buy('new-spend-blocked', 1)).rejects.toMatchObject({ code: 'BUDGET_OR_DEADLINE_EXCEEDED' });
  expect(await f.buy('historical-original', 80)).toBe(original);
  await transaction(db.pool, c => settle(c, f.scope.tenantId, original, 70));
  await expect(f.buy('settlement-did-not-replenish', 1)).rejects.toMatchObject({ code: 'BUDGET_OR_DEADLINE_EXCEEDED' });
  const row = (await db.pool.query('SELECT budget_micro,spent_micro,reserved_micro FROM orders WHERE id=$1', [f.orderId])).rows[0];
  expect([Number(row.budget_micro), Number(row.spent_micro), Number(row.reserved_micro)]).toEqual([100, 70, 0]);
});
