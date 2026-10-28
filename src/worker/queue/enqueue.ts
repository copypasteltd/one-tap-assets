import type { Db } from '../../api/db/pool.js';
import { insert } from '../../api/db/store.js';
import { id, iso } from '../../api/lib/crypto.js';
import type { DTO } from '../../shared/contracts/types.js';
export interface StageSpec { tenantId: string; scopeType: string; scopeId: string; name: string; inputHash: string; deadlineAt: string; jobId?: string; dependencies?: string[]; private?: unknown; attempt?: number }
export async function enqueueStage(db: Db, spec: StageSpec): Promise<string> {
  const stageId = id('stage'); const attempt = spec.attempt ?? 1;
  const data: DTO<'Stage'> = { stage_id: stageId, name: spec.name, state: 'READY', attempt, updated_at: iso(), reason_code: null };
  await insert(db, 'stage_runs', { id: stageId, tenant_id: spec.tenantId, job_id: spec.jobId ?? null,
    scope_type: spec.scopeType, scope_id: spec.scopeId, stage_name: spec.name, input_hash: spec.inputHash,
    deadline_at: spec.deadlineAt, dependencies: spec.dependencies ?? [], data, private: spec.private ?? {}, attempt });
  return stageId;
}
