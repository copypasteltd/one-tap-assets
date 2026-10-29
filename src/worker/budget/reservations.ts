import type pg from 'pg';
import { transaction, type Db } from '../../api/db/pool.js';
import { hash, id } from '../../api/lib/crypto.js';
import { requireThat, notFound } from '../../api/lib/errors.js';
import { insert } from '../../api/db/store.js';
import { productionCeiling } from './envelope.js';

export async function reserve(db: Db, scope: { tenantId: string; orderId: string }, intentKey: string, amountMicro: number, rateSnapshot: unknown): Promise<string> {
  requireThat(Number.isSafeInteger(amountMicro) && amountMicro >= 0, 'COST_INVALID', '成本预留必须为非负整数微单位', 500);
  await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`budget:${intentKey}`]);
  const existing = (await db.query<{ id: string; tenant_id: string; order_id: string; amount_micro: string; rate_snapshot: unknown }>(
    'SELECT id,tenant_id,order_id,amount_micro,rate_snapshot FROM budget_reservations WHERE intent_key=$1', [intentKey])).rows[0];
  if (existing) {
    requireThat(existing.tenant_id === scope.tenantId && existing.order_id === scope.orderId
      && Number(existing.amount_micro) === amountMicro && hash(existing.rate_snapshot) === hash(rateSnapshot),
    'COST_INTENT_CONFLICT', '原成本意图的归属、金额和费率快照不能改变', 409);
    return existing.id;
  }
  // Lock before deriving the first-pass ceiling. Repair and aftercare are
  // protected parts of this order, never independently replenishable budgets.
  const order = (await db.query<{ budget_micro: string; private: { contract?: unknown } }>(`SELECT budget_micro,private FROM orders
    WHERE id=$1 AND tenant_id=$2 AND payment_state='CONFIRMED' AND deadline_at>clock_timestamp()
    AND fulfillment_state IN ('QUEUED','IN_PROGRESS') AND NOT (private ? 'media_revoked') FOR UPDATE`,
  [scope.orderId, scope.tenantId])).rows[0];
  requireThat(order, 'BUDGET_OR_DEADLINE_EXCEEDED', '制作预算、授权或交付截止已达到限制', 422);
  const ceiling = productionCeiling(Number(order.budget_micro), order.private.contract);
  const result = await db.query(`UPDATE orders SET reserved_micro=reserved_micro+$1 WHERE id=$2 AND tenant_id=$3
    AND spent_micro+reserved_micro+$1<=$4
    AND deadline_at>clock_timestamp() AND payment_state='CONFIRMED' AND fulfillment_state IN ('QUEUED','IN_PROGRESS')
    AND NOT (private ? 'media_revoked') RETURNING id`, [amountMicro, scope.orderId, scope.tenantId, ceiling]);
  requireThat(result.rowCount === 1, 'BUDGET_OR_DEADLINE_EXCEEDED', '制作预算或交付截止已达到限制', 422);
  const reservation = id('reservation');
  await insert(db, 'budget_reservations', { id: reservation, tenant_id: scope.tenantId, order_id: scope.orderId, intent_key: intentKey, amount_micro: amountMicro, currency: 'CNY', rate_snapshot: rateSnapshot, state: 'RESERVED' });
  return reservation;
}
export async function settle(db: Db, tenantId: string, reservationId: string, actualMicro: number | null, knownNoCharge = false): Promise<void> {
  const row = (await db.query<{ state: string; amount_micro: string; order_id: string }>('SELECT * FROM budget_reservations WHERE id=$1 AND tenant_id=$2 FOR UPDATE', [reservationId, tenantId])).rows[0] ?? notFound();
  if (['SETTLED', 'RELEASED'].includes(row.state)) return;
  if (actualMicro === null && !knownNoCharge) { await db.query("UPDATE budget_reservations SET state='UNKNOWN' WHERE id=$1", [reservationId]); return; }
  const actual = knownNoCharge ? 0 : actualMicro!;
  requireThat(Number.isSafeInteger(actual) && actual >= 0 && actual <= Number(row.amount_micro), 'COST_RECEIPT_INVALID', '实际成本超出冻结的调用上界，需人工核对', 422);
  await db.query('UPDATE orders SET reserved_micro=reserved_micro-$1,spent_micro=spent_micro+$2 WHERE id=$3 AND tenant_id=$4', [row.amount_micro, actual, row.order_id, tenantId]);
  await db.query('UPDATE budget_reservations SET state=$1,settled_micro=$2 WHERE id=$3', [knownNoCharge ? 'RELEASED' : 'SETTLED', actual, reservationId]);
}
