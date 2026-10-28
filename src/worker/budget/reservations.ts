import type pg from 'pg';
import { transaction, type Db } from '../../api/db/pool.js';
import { id } from '../../api/lib/crypto.js';
import { requireThat, notFound } from '../../api/lib/errors.js';
import { insert } from '../../api/db/store.js';

export async function reserve(db: Db, scope: { tenantId: string; orderId: string }, intentKey: string, amountMicro: number, rateSnapshot: unknown): Promise<string> {
  requireThat(Number.isSafeInteger(amountMicro) && amountMicro >= 0, 'COST_INVALID', '成本预留必须为非负整数微单位', 500);
  await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`budget:${intentKey}`]);
  const existing = (await db.query<{ id: string; amount_micro: string }>('SELECT id,amount_micro FROM budget_reservations WHERE intent_key=$1 AND tenant_id=$2 AND order_id=$3', [intentKey, scope.tenantId, scope.orderId])).rows[0];
  if (existing) { requireThat(Number(existing.amount_micro) === amountMicro, 'COST_INTENT_CONFLICT', '同一成本意图的预留不能改变', 409); return existing.id; }
  // Aftercare is part of the sold total, reserved before production starts.
  // A revision never opens a second independently replenishable order budget.
  const result = await db.query(`UPDATE orders SET reserved_micro=reserved_micro+$1 WHERE id=$2 AND tenant_id=$3
    AND spent_micro+reserved_micro+$1<=budget_micro-COALESCE((private->'contract'->'revision_policy'->>'budget_micro')::bigint,0)
    AND deadline_at>now() AND fulfillment_state IN ('QUEUED','IN_PROGRESS') RETURNING id`, [amountMicro, scope.orderId, scope.tenantId]);
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
