import type { Db } from '../../api/db/pool.js';
import { outbox } from '../../api/db/store.js';
import { iso } from '../../api/lib/crypto.js';
import { requireThat, notFound } from '../../api/lib/errors.js';
import type { DTO } from '../../shared/contracts/types.js';

export type ReleaseReason = DTO<'CleanupReceipt'>['release_reason'];
export interface InstanceRow {
  id: string; tenant_id: string; order_id: string | null; preview_session_id: string | null; state: string; fencing_token: string;
  workspace_ref: string; lease_expires_at: Date; data: DTO<'AgentInstance'>; private: Record<string, unknown>;
}
/** The caller owns the transaction. A live role may only release itself after
 * its durable terminal/checkpoint result. This also guards admin requests. */
export async function requestInstanceRelease(db: Db, tenantId: string, instanceId: string, reason: ReleaseReason,
  expectedFencing?: number): Promise<boolean> {
  const scope = (await db.query<{ order_id: string | null }>('SELECT order_id FROM agent_instances WHERE tenant_id=$1 AND id=$2', [tenantId, instanceId])).rows[0] ?? notFound();
  if (scope.order_id) await db.query('SELECT id FROM orders WHERE tenant_id=$1 AND id=$2 FOR UPDATE', [tenantId, scope.order_id]);
  const instance = (await db.query<InstanceRow>('SELECT * FROM agent_instances WHERE tenant_id=$1 AND id=$2 FOR UPDATE', [tenantId, instanceId])).rows[0] ?? notFound();
  requireThat(expectedFencing === undefined || String(expectedFencing) === String(instance.fencing_token), 'FENCING_CONFLICT', '实例已更换执行代次', 409);
  if (instance.state === 'RELEASED') return false;
  const live = (await db.query(`SELECT r.id FROM agent_runs r JOIN stage_runs s ON s.tenant_id=r.tenant_id AND s.id=r.private->>'stage_run_id'
    WHERE r.tenant_id=$1 AND r.instance_id=$2 AND r.state NOT IN ('SUCCEEDED','FAILED','CANCELLED','UNKNOWN')
    AND s.state='RUNNING' AND s.fencing_token::text=r.private->>'stage_fencing_token' AND s.lease_expires_at>clock_timestamp()
    AND s.deadline_at>clock_timestamp() AND $3::timestamptz>clock_timestamp()
    AND (s.scope_type<>'ORDER' OR EXISTS(SELECT 1 FROM orders o WHERE o.tenant_id=s.tenant_id AND o.id=s.scope_id
      AND o.fulfillment_state IN ('QUEUED','IN_PROGRESS') AND o.deadline_at>clock_timestamp() AND NOT (o.private ? 'media_revoked')))`,
  [tenantId, instanceId, instance.lease_expires_at])).rowCount;
  requireThat(!live || ['DRAINING','RELEASING','CLEANUP_FAILED'].includes(instance.state),
    'INSTANCE_STILL_ACTIVE', '实例仍在执行且未形成可释放检查点', 409);
  const requested = iso();
  await db.query(`UPDATE agent_capabilities SET revoked_at=COALESCE(revoked_at,now()) WHERE tenant_id=$1 AND instance_id=$2`, [tenantId, instanceId]);
  await db.query(`UPDATE agent_instances SET state=CASE WHEN state='RELEASING' THEN state ELSE 'DRAINING' END,
    cleanup_requested_at=COALESCE(cleanup_requested_at,now()),cleanup_available_at=LEAST(cleanup_available_at,now()),updated_at=now(),
    data=data||jsonb_build_object('state',CASE WHEN state='RELEASING' THEN state ELSE 'DRAINING' END,'release_reason',$3::text),
    private=private||jsonb_build_object('release_reason',$3::text) WHERE tenant_id=$1 AND id=$2`, [tenantId, instanceId, reason]);
  await outbox(db, tenantId, 'ReleaseRequested', instance.order_id ?? instance.preview_session_id ?? instanceId,
    `release:instance:${instanceId}`, { instance_id: instanceId, reason, requested_at: requested });
  return true;
}
