import type { Db } from '../../api/db/pool.js';
import { hash, id } from '../../api/lib/crypto.js';
import { requireThat, notFound } from '../../api/lib/errors.js';
import { insert } from '../../api/db/store.js';
import { productionCeiling } from './envelope.js';
import { assertLease, type StageLease } from '../queue/leases.js';
import type { Snapshot } from '../compiler/snapshot.js';
import type { RepairGenerationNode } from '../repair/cost-authorization.js';

interface CostBinding { purpose: 'FIRST_PASS' | 'REPAIR'; authorizationId: string | null; stageId: string | null; nodeKey: string | null }
const firstPass: CostBinding = { purpose: 'FIRST_PASS', authorizationId: null, stageId: null, nodeKey: null };
export type StageCost = { kind: 'INFERENCE' | 'IMAGE' | 'VIDEO' | 'ASR' | 'LISTENING'; operationKey?: string };

/** The caller supplies its platform lease, never a buyer/LLM-selected budget
 * purpose. Attempt 2 is unusable without a durable coordinator authorization. */
export async function reserveStageCost(db: Db, lease: StageLease, intentKey: string, amountMicro: number,
  rateSnapshot: unknown, cost: StageCost): Promise<string> {
  requireThat(lease.scope_type === 'ORDER', 'COST_STAGE_INVALID', '制作费用必须属于原订单阶段', 409);
  await assertLease(db, lease);
  const stage = (await db.query<{ attempt: number; stage_name: string }>(
    `SELECT attempt,stage_name FROM stage_runs WHERE tenant_id=$1 AND id=$2 AND scope_type='ORDER'
     AND scope_id=$3 AND input_hash=$4 AND job_id IS NOT DISTINCT FROM $5 AND stage_name=$6`,
  [lease.tenant_id, lease.id, lease.scope_id, lease.input_hash, lease.job_id, lease.stage_name])).rows[0];
  requireThat(stage, 'COST_STAGE_INVALID', '费用租约与数据库中的原订单、任务、快照或阶段不一致', 409);
  const scope = { tenantId: lease.tenant_id, orderId: lease.scope_id };
  if (stage.attempt === 1) return reserve(db, scope, intentKey, amountMicro, rateSnapshot);
  requireThat(stage.attempt === 2 && (cost.kind === 'INFERENCE' && ['PRODUCTION','POST','REVIEW_FACTS','REVIEW_STYLE'].includes(stage.stage_name)
    || ['IMAGE','VIDEO'].includes(cost.kind) && stage.stage_name === 'PRODUCTION'
    || cost.kind === 'ASR' && stage.stage_name === 'POST' || cost.kind === 'LISTENING' && stage.stage_name === 'REVIEW_FACTS'),
  'REPAIR_COST_STAGE_INVALID', '该修复阶段无权创建此类付费调用', 409);
  const authorization = (await db.query<{ id: string; generation_nodes: RepairGenerationNode[] }>(`SELECT a.id,a.generation_nodes
    FROM repair_cost_authorizations a JOIN stage_runs s ON s.tenant_id=a.tenant_id AND s.job_id=a.job_id AND s.id=ANY(a.stage_ids)
    JOIN render_jobs j ON j.tenant_id=a.tenant_id AND j.id=a.job_id
    WHERE a.tenant_id=$1 AND a.order_id=$2 AND s.id=$3 AND s.scope_type='ORDER' AND s.scope_id=a.order_id
      AND s.input_hash=a.snapshot_hash AND s.deadline_at=a.deadline_at AND j.repair_rounds=1`,
  [lease.tenant_id, lease.scope_id, lease.id])).rows[0];
  requireThat(authorization, 'REPAIR_COST_NOT_AUTHORIZED', '该阶段没有原订单的一次性修复费用授权', 409);
  const generation = cost.kind === 'IMAGE' || cost.kind === 'VIDEO';
  requireThat(!generation || authorization.generation_nodes.some(n => n.kind === cost.kind && n.operation_key === cost.operationKey),
    'REPAIR_NODE_NOT_AUTHORIZED', '该生成节点不在受影响节点的费用授权中', 409);
  const binding: CostBinding = { purpose: 'REPAIR', authorizationId: authorization.id, stageId: lease.id,
    nodeKey: generation ? `${cost.kind}:${cost.operationKey}` : cost.kind };
  return reserveBound(db, scope, intentKey, amountMicro, rateSnapshot, binding);
}

export async function reserve(db: Db, scope: { tenantId: string; orderId: string }, intentKey: string, amountMicro: number, rateSnapshot: unknown): Promise<string> {
  return reserveBound(db, scope, intentKey, amountMicro, rateSnapshot, firstPass);
}
async function reserveBound(db: Db, scope: { tenantId: string; orderId: string }, intentKey: string, amountMicro: number,
  rateSnapshot: unknown, binding: CostBinding): Promise<string> {
  requireThat(Number.isSafeInteger(amountMicro) && amountMicro >= 0, 'COST_INVALID', '成本预留必须为非负整数微单位', 500);
  // All purposes take the same order lock before the intent lock. Existing
  // accounting can replay after expiry; provider I/O still needs a live lease.
  const order = (await db.query<{ budget_micro: string; spent_micro: string; reserved_micro: string; deadline_at: Date;
    private: { contract?: { repair_ceiling_micro?: number; revision_policy?: { budget_micro: number } } } }>(
    'SELECT budget_micro,spent_micro,reserved_micro,deadline_at,private FROM orders WHERE id=$1 AND tenant_id=$2 FOR UPDATE',
  [scope.orderId, scope.tenantId])).rows[0];
  requireThat(order, 'BUDGET_OR_DEADLINE_EXCEEDED', '制作预算、授权或交付截止已达到限制', 422);
  await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`budget:${intentKey}`]);
  const existing = (await db.query<{ id: string; tenant_id: string; order_id: string; amount_micro: string; rate_snapshot: unknown;
    purpose: string; repair_authorization_id: string | null; repair_stage_id: string | null; repair_node_key: string | null }>(
    'SELECT * FROM budget_reservations WHERE intent_key=$1', [intentKey])).rows[0];
  if (existing) {
    requireThat(existing.tenant_id === scope.tenantId && existing.order_id === scope.orderId
      && Number(existing.amount_micro) === amountMicro && hash(existing.rate_snapshot) === hash(rateSnapshot)
      && existing.purpose === binding.purpose && existing.repair_authorization_id === binding.authorizationId
      && existing.repair_stage_id === binding.stageId && existing.repair_node_key === binding.nodeKey,
    'COST_INTENT_CONFLICT', '原成本意图的归属、金额、费率和修复用途不能改变', 409);
    return existing.id;
  }
  const productionLimit = productionCeiling(Number(order.budget_micro), order.private.contract);
  const repairUsage = (await db.query<{ used: string; calls: string }>(`SELECT COALESCE(sum(CASE WHEN state IN ('RESERVED','UNKNOWN')
    THEN amount_micro ELSE COALESCE(settled_micro,0) END),0) AS used,count(*) AS calls FROM budget_reservations
    WHERE tenant_id=$1 AND order_id=$2 AND purpose='REPAIR'`, [scope.tenantId, scope.orderId])).rows[0]!;
  const used = Number(repairUsage.used);
  requireThat(Number.isSafeInteger(used) && used >= 0 && used <= (order.private.contract?.repair_ceiling_micro ?? 0)
    && used <= Number(order.spent_micro) + Number(order.reserved_micro),
    'COST_LEDGER_INVALID', '原订单与修复成本账本不一致', 503);
  let ceiling = productionLimit + used;
  if (binding.purpose === 'REPAIR') {
    const grant = (await db.query<{ ceiling_micro: string; extra_calls_limit: number; deadline_at: Date; snapshot_hash: string; data: Snapshot }>(
      `SELECT a.ceiling_micro,a.extra_calls_limit,a.deadline_at,a.snapshot_hash,e.data FROM repair_cost_authorizations a
       JOIN render_jobs j ON j.tenant_id=a.tenant_id AND j.id=a.job_id AND j.repair_rounds=1
       JOIN execution_snapshots e ON e.tenant_id=j.tenant_id AND e.id=j.execution_snapshot_id AND e.hash=a.snapshot_hash
       WHERE a.tenant_id=$1 AND a.order_id=$2 AND a.id=$3`, [scope.tenantId, scope.orderId, binding.authorizationId])).rows[0];
    requireThat(grant && hash(grant.data) === grant.snapshot_hash && grant.data.order_id === scope.orderId && grant.data.tenant_id === scope.tenantId
      && grant.data.deadline_at === order.deadline_at.toISOString() && grant.deadline_at.toISOString() === grant.data.deadline_at
      && grant.data.budget.max_repair_rounds === 1 && grant.data.budget.retry_extends_deadline === false
      && grant.data.budget.ceiling_micro === Number(order.budget_micro)
      && grant.data.budget.repair_ceiling_micro === Number(grant.ceiling_micro)
      && Number(grant.ceiling_micro) === order.private.contract?.repair_ceiling_micro
      && grant.data.budget.extra_calls_limit === grant.extra_calls_limit,
    'REPAIR_BUDGET_INVALID', '修复授权与原订单预算、次数或截止不一致', 503);
    requireThat(used + amountMicro <= Number(grant.ceiling_micro) && Number(repairUsage.calls) < grant.extra_calls_limit,
      'REPAIR_COST_LIMIT', '原修复费用或额外调用次数已达上限', 422);
    if (binding.nodeKey!.startsWith('IMAGE:') || binding.nodeKey!.startsWith('VIDEO:')) {
      requireThat((await db.query(`SELECT id FROM budget_reservations WHERE tenant_id=$1 AND repair_authorization_id=$2
        AND repair_node_key=$3 LIMIT 1`, [scope.tenantId, binding.authorizationId, binding.nodeKey])).rowCount === 0,
      'REPAIR_NODE_CALL_EXHAUSTED', '该生成节点已使用唯一额外生成，必须恢复原调用', 409);
    }
    ceiling = Number(order.budget_micro) - (order.private.contract?.revision_policy?.budget_micro ?? 0);
  }
  ceiling = Math.min(ceiling, Number(order.budget_micro) - (order.private.contract?.revision_policy?.budget_micro ?? 0));
  const result = await db.query(`UPDATE orders SET reserved_micro=reserved_micro+$1 WHERE id=$2 AND tenant_id=$3
    AND spent_micro+reserved_micro+$1<=$4
    AND deadline_at>clock_timestamp() AND payment_state='CONFIRMED' AND fulfillment_state IN ('QUEUED','IN_PROGRESS')
    AND NOT (private ? 'media_revoked') RETURNING id`, [amountMicro, scope.orderId, scope.tenantId, ceiling]);
  requireThat(result.rowCount === 1, 'BUDGET_OR_DEADLINE_EXCEEDED', '制作预算或交付截止已达到限制', 422);
  const reservation = id('reservation');
  await insert(db, 'budget_reservations', { id: reservation, tenant_id: scope.tenantId, order_id: scope.orderId, intent_key: intentKey, amount_micro: amountMicro,
    currency: 'CNY', rate_snapshot: rateSnapshot, state: 'RESERVED', purpose: binding.purpose,
    repair_authorization_id: binding.authorizationId, repair_stage_id: binding.stageId, repair_node_key: binding.nodeKey });
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
