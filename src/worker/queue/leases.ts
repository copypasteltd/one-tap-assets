import type pg from 'pg';
import { transaction, type Db } from '../../api/db/pool.js';
import { iso } from '../../api/lib/crypto.js';
import { AppError, requireThat } from '../../api/lib/errors.js';
import type { DTO } from '../../shared/contracts/types.js';
import { stopScope } from '../lifecycle/termination.js';
import { lockMediaOwner } from '../../api/modules/media-access.js';
import { revisionContext } from '../revisions/context.js';

export interface StageLease {
  id: string; tenant_id: string; job_id: string | null; scope_type: string; scope_id: string;
  stage_name: string; attempt: number; input_hash: string; fencing_token: string;
  lease_owner: string; deadline_at: Date; private: Record<string, unknown>; data: DTO<'Stage'>;
}
export const LEASE_SECONDS = 45;
export async function claimStage(pool: pg.Pool, workerId: string, names?: readonly string[]): Promise<StageLease | null> {
  return transaction(pool, async db => {
    const candidate = (await db.query<StageLease>(`SELECT s.* FROM stage_runs s
      WHERE s.available_at<=now() AND s.deadline_at>now()
      AND ($1::text[] IS NULL OR s.stage_name=ANY($1))
      AND (s.state IN ('READY','UNKNOWN') OR (s.state IN ('CLAIMED','RUNNING') AND s.lease_expires_at<now()))
      AND NOT EXISTS(SELECT 1 FROM unnest(s.dependencies) dep(id) LEFT JOIN stage_runs d ON d.id=dep.id AND d.tenant_id=s.tenant_id WHERE d.state IS DISTINCT FROM 'SUCCEEDED')
      AND (s.scope_type<>'ORDER' OR EXISTS(SELECT 1 FROM orders o WHERE o.id=s.scope_id AND o.tenant_id=s.tenant_id
        AND o.payment_state='CONFIRMED' AND o.fulfillment_state IN ('QUEUED','IN_PROGRESS') AND NOT (o.private ? 'media_revoked')))
      AND (s.scope_type<>'PUBLICATION' OR EXISTS(SELECT 1 FROM publications p WHERE p.id=s.scope_id AND p.tenant_id=s.tenant_id
        AND p.review_state='APPROVED' AND p.data->>'public_sample_state'='PREPARING'))
      ORDER BY s.available_at,s.created_at,s.id FOR UPDATE OF s SKIP LOCKED LIMIT 1`, [names ?? null])).rows[0];
    if (!candidate) return null;
    const row = (await db.query<StageLease>(`UPDATE stage_runs SET state='RUNNING',lease_owner=$2,
      lease_expires_at=LEAST(deadline_at,now()+$3::int*interval '1 second'),fencing_token=fencing_token+1,
      data=data||jsonb_build_object('state','RUNNING','updated_at',$4::text),updated_at=now() WHERE id=$1 RETURNING *`, [candidate.id, workerId, LEASE_SECONDS, iso()])).rows[0]!;
    if (row.scope_type === 'ORDER') await db.query(`UPDATE orders SET fulfillment_state='IN_PROGRESS',updated_at=now(),
      data=data||jsonb_build_object('fulfillment_state','IN_PROGRESS') WHERE id=$1 AND tenant_id=$2 AND fulfillment_state='QUEUED'`, [row.scope_id, row.tenant_id]);
    if (row.job_id) {
      const state = row.stage_name === 'PRODUCTION' ? 'GENERATING' : row.stage_name === 'POST' ? 'POST_PROCESSING' : 'QC';
      await db.query(`UPDATE render_jobs SET state=$5,updated_at=now(),
        data=data||jsonb_build_object('state',$5::text,'current_stage',$3::text,'updated_at',$4::text) WHERE id=$1 AND tenant_id=$2`, [row.job_id, row.tenant_id, row.stage_name, iso(), state]);
    }
    return row;
  });
}
export async function assertLease(db: Db, lease: StageLease, lock = true): Promise<void> {
  if(lease.scope_type==='REVISION')await revisionContext(db,lease.tenant_id,lease.scope_id,lease.input_hash,lock);
  if(lease.scope_type==='PREVIEW') {
    const hint=(await db.query<{owner_id:string}>('SELECT owner_id FROM optional_previews WHERE tenant_id=$1 AND id=$2',[lease.tenant_id,lease.scope_id])).rows[0];
    requireThat(hint,'PREVIEW_NO_LONGER_EXECUTABLE','本人预览不存在',409);
    if(lock) await lockMediaOwner(db,lease.tenant_id,hint.owner_id);
    requireThat((await db.query(`SELECT id FROM optional_previews WHERE tenant_id=$1 AND id=$2 AND state IN ('QUEUED','GENERATING')
      AND expires_at>clock_timestamp()${lock?' FOR UPDATE':''}`,[lease.tenant_id,lease.scope_id])).rowCount===1,
    'PREVIEW_NO_LONGER_EXECUTABLE','本人预览已结束或过期',409);
  }
  if (lease.scope_type === 'PUBLICATION') {
    const hint = (await db.query<{owner_id:string}>('SELECT owner_id FROM publications WHERE tenant_id=$1 AND id=$2',[lease.tenant_id,lease.scope_id])).rows[0];
    requireThat(hint,'PUBLICATION_NO_LONGER_EXECUTABLE','发布已停止',409);
    if (lock) await lockMediaOwner(db,lease.tenant_id,hint.owner_id);
    requireThat((await db.query(`SELECT id FROM publications WHERE tenant_id=$1 AND id=$2 AND review_state='APPROVED'
      AND data->>'public_sample_state'='PREPARING'${lock?' FOR UPDATE':''}`,[lease.tenant_id,lease.scope_id])).rowCount===1,
    'PUBLICATION_NO_LONGER_EXECUTABLE','公开副本准备已停止或完成',409);
  }
  if (lease.scope_type === 'SAMPLE') {
    if (lock) {
      const owner = (await db.query<{owner_id:string}>('SELECT owner_id FROM public_samples WHERE tenant_id=$1 AND id=$2',[lease.tenant_id,lease.scope_id])).rows[0];
      requireThat(owner,'SAMPLE_NO_LONGER_EXECUTABLE','样例不存在',409); await lockMediaOwner(db,lease.tenant_id,owner.owner_id);
    }
    const sample = await db.query(`SELECT id FROM public_samples WHERE tenant_id=$1 AND id=$2 AND state IN ('QUEUED','GENERATING')
      AND NOT (private ? 'media_revoked')${lock ? ' FOR UPDATE' : ''}`, [lease.tenant_id, lease.scope_id]);
    requireThat(sample.rowCount === 1, 'SAMPLE_NO_LONGER_EXECUTABLE', '样例已结束或权限已撤销', 409);
  }
  if (lease.scope_type === 'ORDER') {
    const order = await db.query(`SELECT id FROM orders WHERE id=$1 AND tenant_id=$2 AND payment_state='CONFIRMED'
      AND fulfillment_state IN ('QUEUED','IN_PROGRESS') AND deadline_at>clock_timestamp() AND NOT (private ? 'media_revoked')${lock ? ' FOR UPDATE' : ''}`, [lease.scope_id, lease.tenant_id]);
    requireThat(order.rowCount === 1, 'ORDER_NO_LONGER_EXECUTABLE', '订单已取消、到期或撤销媒体访问', 409);
  }
  const row = await db.query(`SELECT id FROM stage_runs WHERE id=$1 AND tenant_id=$2 AND fencing_token=$3
    AND lease_owner=$4 AND state='RUNNING' AND lease_expires_at>clock_timestamp() AND deadline_at>clock_timestamp()${lock ? ' FOR UPDATE' : ''}`,
  [lease.id, lease.tenant_id, lease.fencing_token, lease.lease_owner]);
  requireThat(row.rowCount === 1, 'LEASE_LOST', '该执行租约已过期或已由新 Worker 接管', 409);
}
export async function heartbeatStage(pool: pg.Pool, lease: StageLease): Promise<boolean> {
  return (await pool.query(`UPDATE stage_runs SET lease_expires_at=LEAST(deadline_at,now()+$5::int*interval '1 second')
    WHERE id=$1 AND tenant_id=$2 AND fencing_token=$3 AND lease_owner=$4 AND state='RUNNING'
    AND lease_expires_at>now() AND deadline_at>now() RETURNING id`, [lease.id, lease.tenant_id, lease.fencing_token, lease.lease_owner, LEASE_SECONDS])).rowCount === 1;
}
export async function completeStage<T>(pool: pg.Pool, lease: StageLease, mutation: (db: pg.PoolClient) => Promise<T>): Promise<T> {
  return transaction(pool, async db => {
    await assertLease(db, lease); const result = await mutation(db);
    const completed = await db.query(`UPDATE stage_runs SET state='SUCCEEDED',lease_owner=NULL,lease_expires_at=NULL,updated_at=now(),
      data=data||jsonb_build_object('state','SUCCEEDED','updated_at',$2::text,'reason_code',NULL)
      WHERE id=$1 AND tenant_id=$3 AND fencing_token=$4 AND lease_owner=$5 AND state='RUNNING'
      AND lease_expires_at>clock_timestamp() AND deadline_at>clock_timestamp()`, [lease.id, iso(), lease.tenant_id, lease.fencing_token, lease.lease_owner]);
    requireThat(completed.rowCount === 1, 'LEASE_LOST', '提交期间租约已过期，回滚本次阶段结果', 409);
    if (lease.job_id) await db.query(`UPDATE render_jobs j SET updated_at=now(),data=j.data||jsonb_build_object(
      'completed_stage_count',(SELECT count(*)::int FROM stage_runs WHERE job_id=j.id AND state='SUCCEEDED'),'updated_at',$2::text) WHERE j.id=$1`, [lease.job_id, iso()]);
    return result;
  });
}
export class PendingExternal extends AppError {
  constructor(public readonly delaySeconds = 5, code = 'PROVIDER_PENDING') { super(code, '原任务仍在处理，稍后查询原任务', 202, true); }
}
export async function deferStage(pool: pg.Pool, lease: StageLease, reason: string, delaySeconds: number): Promise<void> {
  await transaction(pool, async db => {
    await assertLease(db, lease);
    await db.query(`UPDATE stage_runs SET state='UNKNOWN',lease_owner=NULL,lease_expires_at=NULL,
      available_at=now()+$2::int*interval '1 second',updated_at=now(),data=data||jsonb_build_object(
      'state','UNKNOWN','reason_code',$3::text,'updated_at',$4::text) WHERE id=$1`, [lease.id, Math.min(60, Math.max(1, delaySeconds)), reason, iso()]);
  });
}
export async function failStage(pool: pg.Pool, lease: StageLease, code: string): Promise<void> {
  await transaction(pool, async db => {
    await assertLease(db, lease);
    await db.query(`UPDATE stage_runs SET state='FAILED',lease_owner=NULL,lease_expires_at=NULL,updated_at=now(),
      data=data||jsonb_build_object('state','FAILED','reason_code',$2::text,'updated_at',$3::text) WHERE id=$1`, [lease.id, code, iso()]);
    if (lease.scope_type === 'ANALYSIS') await db.query(`UPDATE analysis_jobs SET state='FAILED',updated_at=now(),
      data=data||jsonb_build_object('state','FAILED','reason_codes',jsonb_build_array($3::text),'updated_at',$4::text) WHERE id=$1 AND tenant_id=$2`, [lease.scope_id, lease.tenant_id, code, iso()]);
    if (lease.scope_type === 'PLAN') await db.query(`UPDATE plan_versions SET state='FAILED',updated_at=now(),
      data=data||jsonb_build_object('state','FAILED','reason_codes',jsonb_build_array($3::text)) WHERE id=$1 AND tenant_id=$2`, [lease.scope_id, lease.tenant_id, code]);
    if (lease.scope_type === 'PREVIEW') await db.query(`UPDATE optional_previews SET state='FAILED',data=data||'{"state":"FAILED"}'::jsonb WHERE id=$1 AND tenant_id=$2`, [lease.scope_id, lease.tenant_id]);
    if (lease.scope_type === 'ORDER') {
      await stopScope(db, { tenantId: lease.tenant_id, type: 'ORDER', id: lease.scope_id }, code);
    } else {
      await stopScope(db, { tenantId: lease.tenant_id, type: lease.scope_type, id: lease.scope_id }, code);
    }
  });
}
