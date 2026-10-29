import type { Config } from '../../api/config.js';
import type { Db } from '../../api/db/pool.js';
import { insert } from '../../api/db/store.js';
import { hash, id } from '../../api/lib/crypto.js';
import { requireThat } from '../../api/lib/errors.js';
import { executionContext } from '../compiler/order-context.js';
import { currentReviewPacket } from '../review/context.js';
import { packetReports } from '../review/reports.js';
import { unsettledOrderCalls } from '../review/qc.js';
import { productionCeiling } from '../budget/envelope.js';

export interface RepairGenerationNode {
  kind: 'IMAGE' | 'VIDEO'; operation_key: string; original_submission_id: string;
}
export interface RepairCostRequest {
  tenantId: string; orderId: string; snapshotHash: string; sourcePacketId: string;
  stageIds: string[]; generationNodes: RepairGenerationNode[];
}
const phaseOrder = ['PRODUCTION', 'POST', 'QC', 'REVIEW_FACTS', 'REVIEW_STYLE', 'DELIVER'];

/** Internal coordinator port. Call inside the same transaction that prepares
 * the six new candidate stages. It is deliberately absent from HTTP/MCP.
 * This does not plan, execute, repair, approve or publish any candidate. */
export async function authorizeRepairCosts(db: Db, cfg: Config, request: RepairCostRequest): Promise<string> {
  const order = (await db.query<{ budget_micro: string; spent_micro: string; reserved_micro: string }>(`SELECT budget_micro,spent_micro,reserved_micro FROM orders WHERE tenant_id=$1 AND id=$2
    AND deadline_at>clock_timestamp() AND payment_state='CONFIRMED' AND fulfillment_state IN ('QUEUED','IN_PROGRESS')
    AND NOT (private ? 'media_revoked') FOR UPDATE`, [request.tenantId, request.orderId])).rows[0];
  requireThat(order, 'REPAIR_NOT_EXECUTABLE', '原订单不能授权修复费用', 409);
  const context = await executionContext(db, request.tenantId, request.orderId, request.snapshotHash);
  const firstPassCeiling = productionCeiling(Number(order.budget_micro), context.contract);
  requireThat(BigInt(order.spent_micro) + BigInt(order.reserved_micro) <= BigInt(firstPassCeiling),
    'REPAIR_BUDGET_UNAVAILABLE', '原支出已占用冻结修复或售后额度，不能核发新的修复费用权限', 422);
  const budget = context.snapshot.budget;
  requireThat(budget.max_repair_rounds === 1 && budget.retry_extends_deadline === false
    && budget.ceiling_micro === Number(order.budget_micro) && budget.repair_ceiling_micro === context.contract.repair_ceiling_micro
    && Number.isSafeInteger(budget.repair_ceiling_micro) && budget.repair_ceiling_micro > 0
    && Number.isSafeInteger(budget.extra_calls_limit) && budget.extra_calls_limit > 0,
  'REPAIR_BUDGET_INVALID', '修复必须使用原快照中的一次性费用和调用上限', 503);
  requireThat(request.stageIds.length === 6 && new Set(request.stageIds).size === 6,
    'REPAIR_STAGES_INVALID', '修复需要新制作、后期、文件验收、双独立复核和交付阶段', 422);
  const stageIds = [...request.stageIds].sort();
  const nodes = [...request.generationNodes].sort((a, b) => `${a.kind}:${a.operation_key}`.localeCompare(`${b.kind}:${b.operation_key}`));
  requireThat(nodes.length <= budget.extra_calls_limit && nodes.every(n => ['IMAGE','VIDEO'].includes(n.kind)
    && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,159}$/.test(n.operation_key))
    && new Set(nodes.map(n => `${n.kind}:${n.operation_key}`)).size === nodes.length,
  'REPAIR_NODES_INVALID', '修复生成节点必须唯一并在原调用上限内', 422);
  const binding = { order_id: request.orderId, snapshot_hash: context.snapshotHash, source_packet_id: request.sourcePacketId,
    ceiling_micro: budget.repair_ceiling_micro, extra_calls_limit: budget.extra_calls_limit,
    deadline_at: context.snapshot.deadline_at, stage_ids: stageIds, generation_nodes: nodes };
  const prior = (await db.query<{ id: string; binding_hash: string }>(
    'SELECT id,binding_hash FROM repair_cost_authorizations WHERE tenant_id=$1 AND order_id=$2', [request.tenantId, request.orderId])).rows[0];
  if (prior) {
    requireThat(prior.binding_hash === hash(binding), 'REPAIR_AUTHORIZATION_CHANGED', '原修复费用授权不能更换节点、阶段或来源', 409);
    return prior.id;
  }
  const packet = await currentReviewPacket(db, context);
  requireThat(packet.packet_id === request.sourcePacketId && packet.state === 'FAILED' && packet.publication_decision === 'BLOCK',
    'REPAIR_SOURCE_INVALID', '只有原封存包的失败复核可进入修复费用授权', 409);
  const reports = await packetReports(db, cfg, context, packet);
  requireThat(reports.length > 0 && hash(reports) === hash(packet.reports)
    && reports.every(r => r.evidence_complete && r.verdict !== 'INSUFFICIENT_EVIDENCE')
    && reports.some(r => r.verdict === 'FAIL' || r.findings.length > 0),
  'REPAIR_SOURCE_INVALID', '修复必须引用已完成并经平台重新验证的独立失败报告', 409);
  requireThat(await unsettledOrderCalls(db, context) === 0 && (await db.query(`SELECT id FROM budget_reservations
    WHERE tenant_id=$1 AND order_id=$2 AND state IN ('RESERVED','UNKNOWN') LIMIT 1`, [request.tenantId, request.orderId])).rowCount === 0,
  'REPAIR_ORIGINAL_CALL_UNRESOLVED', '原付费调用尚未核对，不能授权新的修复购买', 409);
  const jobs = (await db.query<{ id: string; repair_rounds: number }>(`SELECT id,repair_rounds FROM render_jobs
    WHERE tenant_id=$1 AND order_id=$2 AND execution_snapshot_id IN
      (SELECT id FROM execution_snapshots WHERE tenant_id=$1 AND order_id=$2 AND hash=$3) FOR UPDATE`,
  [request.tenantId, request.orderId, context.snapshotHash])).rows;
  requireThat(jobs.length === 1, 'REPAIR_JOB_INVALID', '原快照必须只有一个明确的制作任务', 409);
  const job = jobs[0]!;
  requireThat(job?.repair_rounds === 0, 'REPAIR_ROUND_EXHAUSTED', '原订单已使用唯一修复轮次', 409);
  requireThat((await db.query(`SELECT id FROM stage_runs WHERE tenant_id=$1 AND job_id=$2 AND attempt=1
    AND state NOT IN ('SUCCEEDED','FAILED','CANCELLED') LIMIT 1`, [request.tenantId, job.id])).rowCount === 0,
  'REPAIR_ORIGINAL_STAGE_ACTIVE', '原阶段尚未结束或撤销，不能同时启动修复费用域', 409);
  requireThat((await db.query(`SELECT p.id FROM review_packets p JOIN stage_runs s ON s.tenant_id=p.tenant_id AND s.id=p.qc_stage_id
    WHERE p.tenant_id=$1 AND p.id=$2 AND s.job_id=$3 AND s.attempt=1 AND s.state='SUCCEEDED'`,
  [request.tenantId, packet.packet_id, job.id])).rowCount === 1, 'REPAIR_SOURCE_INVALID', '修复必须引用首轮任务已完成的文件验收封存包', 409);
  const stages = (await db.query<{ id: string; stage_name: string; dependencies: string[] }>(`SELECT id,stage_name,dependencies FROM stage_runs WHERE tenant_id=$1
    AND id=ANY($2::text[]) AND job_id=$3 AND scope_type='ORDER' AND scope_id=$4 AND input_hash=$5
    AND attempt=2 AND state='READY' AND fencing_token=0 AND lease_owner IS NULL AND deadline_at=$6::timestamptz FOR UPDATE`,
  [request.tenantId, stageIds, job.id, request.orderId, context.snapshotHash, context.snapshot.deadline_at])).rows;
  requireThat(hash(stages.map(s => s.stage_name).sort()) === hash([...phaseOrder].sort())
    && phaseOrder.every((name, index) => {
      const current = stages.find(s => s.stage_name === name), previous = stages.find(s => s.stage_name === phaseOrder[index - 1]);
      return current && hash(current.dependencies) === hash(index ? [previous!.id] : []);
    }), 'REPAIR_STAGES_INVALID', '新候选阶段必须按原快照串行依赖，并重新经过完整双复核', 409);
  for (const node of nodes) {
    requireThat((await db.query(`SELECT p.id FROM provider_submissions p JOIN stage_runs s ON s.tenant_id=p.tenant_id AND s.id=p.stage_run_id
      WHERE p.tenant_id=$1 AND p.order_id=$2 AND p.id=$3 AND p.generation_kind=$4 AND p.operation_key=$5 AND p.state='SUCCEEDED'
      AND s.scope_type='ORDER' AND s.scope_id=$2 AND s.attempt=1 AND s.stage_name='PRODUCTION' AND s.input_hash=$6`,
    [request.tenantId, request.orderId, node.original_submission_id, node.kind, node.operation_key, context.snapshotHash])).rowCount === 1,
    'REPAIR_NODE_NOT_ORIGINAL', '修复只能重复原制作中已完成的受影响生成节点', 409);
  }
  const authorizationId = id('repair_cost');
  await insert(db, 'repair_cost_authorizations', { id: authorizationId, tenant_id: request.tenantId, order_id: request.orderId,
    job_id: job.id, source_packet_id: packet.packet_id, source_packet_hash: packet.packet_hash, snapshot_hash: context.snapshotHash,
    binding_hash: hash(binding), ceiling_micro: budget.repair_ceiling_micro, extra_calls_limit: budget.extra_calls_limit,
    deadline_at: context.snapshot.deadline_at, stage_ids: stageIds, generation_nodes: JSON.stringify(nodes) });
  const changed = await db.query(`UPDATE render_jobs SET repair_rounds=1,data=data||'{"repair_rounds":1}'::jsonb,updated_at=now()
    WHERE tenant_id=$1 AND id=$2 AND repair_rounds=0 AND deadline_at>clock_timestamp()`, [request.tenantId, job.id]);
  requireThat(changed.rowCount === 1, 'REPAIR_NOT_EXECUTABLE', '修复授权提交前原截止或轮次已失效', 409);
  return authorizationId;
}
