import { requireThat } from '../../api/lib/errors.js';

/** Both holds belong to the original sold total. They are unavailable to
 * first-pass work even while no repair or aftercare request exists yet. */
export function productionCeiling(total: number, contract: unknown): number {
  requireThat(contract === undefined || contract !== null && typeof contract === 'object' && !Array.isArray(contract),
    'ORDER_BUDGET_INVALID', '原订单费用合同格式无效', 503);
  const data = contract as { repair_ceiling_micro?: unknown; revision_policy?: { budget_micro?: unknown } } | undefined;
  requireThat(data?.revision_policy === undefined || data.revision_policy !== null
    && typeof data.revision_policy === 'object' && !Array.isArray(data.revision_policy)
    && data.revision_policy.budget_micro !== undefined,
  'ORDER_BUDGET_INVALID', '原订单售后费用合同格式无效', 503);
  const repair = data?.repair_ceiling_micro === undefined ? 0 : data.repair_ceiling_micro;
  const revision = data?.revision_policy?.budget_micro === undefined ? 0 : data.revision_policy.budget_micro;
  requireThat(Number.isSafeInteger(total) && total >= 0
    && typeof repair === 'number' && Number.isSafeInteger(repair) && repair >= 0
    && typeof revision === 'number' && Number.isSafeInteger(revision) && revision >= 0
    && BigInt(repair) + BigInt(revision) <= BigInt(total),
  'ORDER_BUDGET_INVALID', '原订单总预算不能覆盖冻结的修复与售后额度', 503);
  return total - repair - revision;
}
