import type { Db } from '../../api/db/pool.js';
import { id } from '../../api/lib/crypto.js';
import { AppError, requireThat, notFound } from '../../api/lib/errors.js';
import { insert } from '../../api/db/store.js';

export async function reservePlatform(db: Db, scope: { tenantId: string; ownerId: string; category: string; dailyCeilingMicro: number }, intentKey: string, amountMicro: number, rateSnapshot: unknown): Promise<string> {
  requireThat(Number.isSafeInteger(amountMicro) && amountMicro > 0 && Number.isSafeInteger(scope.dailyCeilingMicro) && scope.dailyCeilingMicro >= amountMicro,
    'PLATFORM_BUDGET_NOT_CONFIGURED', '平台识别成本额度尚未配置或已达限制', 503);
  requireThat(/^[A-Z_]{1,30}$/.test(scope.category), 'COST_SCOPE_INVALID', '平台成本域无效', 500);
  await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`platform-budget:${intentKey}`]);
  const old = (await db.query<{ id: string; amount_micro: string; tenant_id: string }>('SELECT id,amount_micro,tenant_id FROM platform_budget_reservations WHERE intent_key=$1', [intentKey])).rows[0];
  if (old) { requireThat(old.tenant_id === scope.tenantId && Number(old.amount_micro) === amountMicro, 'COST_INTENT_CONFLICT', '同一成本意图不可更换', 409); return old.id; }
  const day = (await db.query<{ day: string; until: Date }>(`SELECT to_char(now() AT TIME ZONE 'Asia/Shanghai','YYYY-MM-DD') AS day,
    ((date_trunc('day',now() AT TIME ZONE 'Asia/Shanghai')+interval '1 day') AT TIME ZONE 'Asia/Shanghai') AS until`)).rows[0]!;
  const scopeId = `${scope.category}:${scope.ownerId}:${day.day}`;
  await db.query(`INSERT INTO platform_cost_accounts(id,tenant_id,scope_id,ceiling_micro,deadline_at) VALUES($1,$2,$3,$4,$5)
    ON CONFLICT(tenant_id,scope_id) DO NOTHING`, [id('platformcost'), scope.tenantId, scopeId, scope.dailyCeilingMicro, day.until]);
  const account = (await db.query<{ id: string }>(`UPDATE platform_cost_accounts SET reserved_micro=reserved_micro+$4
    WHERE tenant_id=$1 AND scope_id=$2 AND ceiling_micro=$3 AND spent_micro+reserved_micro+$4<=ceiling_micro AND deadline_at>now() RETURNING id`,
  [scope.tenantId, scopeId, scope.dailyCeilingMicro, amountMicro])).rows[0];
  if (!account) throw new AppError('PLATFORM_BUDGET_EXCEEDED', '今日自动识别服务额度已达限制，请稍后再试', 429);
  const reservationId = id('platformreservation');
  await insert(db, 'platform_budget_reservations', { id: reservationId, tenant_id: scope.tenantId, account_id: account.id,
    intent_key: intentKey, amount_micro: amountMicro, state: 'RESERVED', rate_snapshot: rateSnapshot });
  return reservationId;
}
export async function settlePlatform(db: Db, tenantId: string, reservationId: string, actualMicro: number | null, knownNoCharge = false): Promise<void> {
  const row = (await db.query<{ state: string; amount_micro: string; account_id: string }>('SELECT * FROM platform_budget_reservations WHERE id=$1 AND tenant_id=$2 FOR UPDATE', [reservationId, tenantId])).rows[0] ?? notFound();
  if (['SETTLED', 'RELEASED'].includes(row.state)) return;
  if (actualMicro === null && !knownNoCharge) { await db.query("UPDATE platform_budget_reservations SET state='UNKNOWN' WHERE id=$1", [reservationId]); return; }
  const actual = knownNoCharge ? 0 : actualMicro!;
  requireThat(Number.isSafeInteger(actual) && actual >= 0 && actual <= Number(row.amount_micro), 'COST_RECEIPT_INVALID', '实际识别成本超出已核验上界，需对账', 422);
  await db.query('UPDATE platform_cost_accounts SET reserved_micro=reserved_micro-$1,spent_micro=spent_micro+$2 WHERE id=$3 AND tenant_id=$4', [row.amount_micro, actual, row.account_id, tenantId]);
  await db.query('UPDATE platform_budget_reservations SET state=$1,settled_micro=$2 WHERE id=$3', [knownNoCharge ? 'RELEASED' : 'SETTLED', actual, reservationId]);
}
