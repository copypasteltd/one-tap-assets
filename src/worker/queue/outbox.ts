import type pg from 'pg';
import { transaction } from '../../api/db/pool.js';
export interface OutboxLease { id: string; tenant_id: string; aggregate_type: string; aggregate_id: string; event_key: string; payload: Record<string, unknown>; attempts: number; fencing_token: string; lease_owner: string }
export async function claimEvent(pool: pg.Pool, workerId: string, types?: readonly string[]): Promise<OutboxLease | null> {
  return transaction(pool, async db => {
    const candidate = (await db.query<{ id: string }>(`SELECT id FROM outbox_events WHERE delivered_at IS NULL AND available_at<=now()
      AND ($1::text[] IS NULL OR aggregate_type=ANY($1))
      AND (lease_expires_at IS NULL OR lease_expires_at<now()) ORDER BY available_at,created_at FOR UPDATE SKIP LOCKED LIMIT 1`, [types ?? null])).rows[0];
    if (!candidate) return null;
    return (await db.query<OutboxLease>(`UPDATE outbox_events SET lease_owner=$2,lease_expires_at=now()+interval '45 seconds',
      fencing_token=fencing_token+1,attempts=attempts+1 WHERE id=$1 RETURNING *`, [candidate.id, workerId])).rows[0]!;
  });
}
export async function heartbeatEvent(pool: pg.Pool, event: OutboxLease): Promise<boolean> {
  return (await pool.query(`UPDATE outbox_events SET lease_expires_at=now()+interval '45 seconds'
    WHERE id=$1 AND fencing_token=$2 AND lease_owner=$3 AND delivered_at IS NULL AND lease_expires_at>now() RETURNING id`,
  [event.id, event.fencing_token, event.lease_owner])).rowCount === 1;
}
export async function finishEvent(pool: pg.Pool, event: OutboxLease, errorCode?: string): Promise<void> {
  await pool.query(`UPDATE outbox_events SET delivered_at=CASE WHEN $4::text IS NULL THEN now() ELSE NULL END,
    available_at=CASE WHEN $4::text IS NULL THEN available_at ELSE now()+LEAST(300,POWER(2,LEAST(attempts,8)))::int*interval '1 second' END,
    lease_owner=NULL,lease_expires_at=NULL,last_error_code=$4 WHERE id=$1 AND fencing_token=$2 AND lease_owner=$3 AND lease_expires_at>now()`,
  [event.id, event.fencing_token, event.lease_owner, errorCode ?? null]);
}
