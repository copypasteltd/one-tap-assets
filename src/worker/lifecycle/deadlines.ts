import type pg from 'pg';
import { transaction } from '../../api/db/pool.js';
import { outbox } from '../../api/db/store.js';
import { stopScope } from './termination.js';
import { lockMediaOwner } from '../../api/modules/media-access.js';

/** Independent of claimStage: expired stages can no longer obtain a live lease. */
export async function expireWork(pool: pg.Pool, batchSize = 50): Promise<{ orders: number; stages: number; unpaid: number }> {
  if (!Number.isSafeInteger(batchSize) || batchSize < 1 || batchSize > 500) throw new Error('Invalid expiry batch');
  const result = await transaction(pool, async db => {
    const expiredOrders = await db.query<{ id: string; tenant_id: string }>(`SELECT id,tenant_id FROM orders
      WHERE deadline_at<=now() AND payment_state='CONFIRMED' AND fulfillment_state IN ('QUEUED','IN_PROGRESS')
      ORDER BY deadline_at FOR UPDATE SKIP LOCKED LIMIT $1`, [batchSize]);
    for (const order of expiredOrders.rows) await stopScope(db, { tenantId: order.tenant_id, type: 'ORDER', id: order.id }, 'DEADLINE_EXCEEDED');

    const stages = await db.query<{ id: string; tenant_id: string; scope_type: string; scope_id: string }>(`SELECT id,tenant_id,scope_type,scope_id FROM stage_runs
      WHERE deadline_at<=now() AND state IN ('READY','UNKNOWN','CLAIMED','RUNNING') AND scope_type NOT IN ('ORDER','SAMPLE','PUBLICATION','PREVIEW','REVISION')
      ORDER BY deadline_at FOR UPDATE SKIP LOCKED LIMIT $1`, [batchSize]);
    for (const stage of stages.rows) {
      await stopScope(db, { tenantId: stage.tenant_id, type: stage.scope_type, id: stage.scope_id }, 'DEADLINE_EXCEEDED');
      const params = [stage.tenant_id, stage.scope_id];
      if (stage.scope_type === 'ANALYSIS') await db.query(`UPDATE analysis_jobs SET state='FAILED',updated_at=now(),data=data||
        '{"state":"FAILED","reason_codes":["DEADLINE_EXCEEDED"]}'::jsonb WHERE tenant_id=$1 AND id=$2 AND state NOT IN ('SUCCEEDED','FAILED','NEEDS_PHOTOS')`, params);
      if (stage.scope_type === 'PLAN') await db.query(`UPDATE plan_versions SET state='FAILED',updated_at=now(),data=data||
        '{"state":"FAILED","reason_codes":["DEADLINE_EXCEEDED"]}'::jsonb WHERE tenant_id=$1 AND id=$2 AND state NOT IN ('READY','FAILED')`, params);
      if (stage.scope_type === 'PREVIEW') await db.query(`UPDATE optional_previews SET state='FAILED',updated_at=now(),data=data||
        '{"state":"FAILED"}'::jsonb WHERE tenant_id=$1 AND id=$2 AND state NOT IN ('READY','FAILED')`, params);
      if (stage.scope_type === 'REVISION') await db.query(`UPDATE revision_requests SET state='FAILED',updated_at=now(),data=data||
        '{"state":"FAILED"}'::jsonb WHERE tenant_id=$1 AND id=$2 AND state NOT IN ('COMPLETED','FAILED')`, params);
      if (stage.scope_type === 'SAMPLE') await db.query(`UPDATE public_samples SET state='FAILED',updated_at=now(),data=data||
        '{"state":"FAILED"}'::jsonb WHERE tenant_id=$1 AND id=$2 AND state NOT IN ('READY','FAILED')`, params);
    }

    const unpaid = await db.query<{ id: string; tenant_id: string }>(`SELECT id,tenant_id FROM orders WHERE payable_until<=now()
      AND payment_state IN ('CREATED','PENDING','UNKNOWN') AND fulfillment_state='NOT_STARTED'
      ORDER BY payable_until FOR UPDATE SKIP LOCKED LIMIT $1`, [batchSize]);
    for (const order of unpaid.rows) {
      await stopScope(db, { tenantId: order.tenant_id, type: 'ORDER', id: order.id }, 'PAYMENT_WINDOW_EXPIRED', 'CANCELLED');
      // Closing the local payment window is not evidence of an unpaid provider
      // transaction. A late confirmed payment follows the original refund path.
      await outbox(db, order.tenant_id, 'PaymentQueryRequested', order.id, `pay-expiry:${order.id}`, {});
    }
    return { orders: expiredOrders.rows.length, stages: stages.rows.length, unpaid: unpaid.rows.length };
  });
  // Owner -> resource -> stage matches delivery, cancellation and private erasure.
  const isolated = (await pool.query<{id:string;tenant_id:string;scope_type:'SAMPLE'|'PUBLICATION'|'PREVIEW'|'REVISION';scope_id:string;owner_id:string;order_id:string|null}>(`SELECT s.id,s.tenant_id,s.scope_type,s.scope_id,COALESCE(a.owner_id,p.owner_id,v.owner_id,r.owner_id) AS owner_id,r.order_id
    FROM stage_runs s LEFT JOIN public_samples a ON s.scope_type='SAMPLE' AND a.tenant_id=s.tenant_id AND a.id=s.scope_id
    LEFT JOIN publications p ON s.scope_type='PUBLICATION' AND p.tenant_id=s.tenant_id AND p.id=s.scope_id
    LEFT JOIN optional_previews v ON s.scope_type='PREVIEW' AND v.tenant_id=s.tenant_id AND v.id=s.scope_id
    LEFT JOIN revision_requests r ON s.scope_type='REVISION' AND r.tenant_id=s.tenant_id AND r.id=s.scope_id
    WHERE s.scope_type IN ('SAMPLE','PUBLICATION','PREVIEW','REVISION') AND s.deadline_at<=now() AND s.state IN ('READY','UNKNOWN','CLAIMED','RUNNING') ORDER BY s.deadline_at,s.id LIMIT $1`,[batchSize])).rows;
  for (const row of isolated) result.stages+=await transaction(pool,async db=>{
    if (!row.owner_id) return 0;
    await lockMediaOwner(db,row.tenant_id,row.owner_id);
    if(row.order_id)await db.query('SELECT id FROM orders WHERE tenant_id=$1 AND id=$2 FOR UPDATE',[row.tenant_id,row.order_id]);
    const table = row.scope_type==='SAMPLE'?'public_samples':row.scope_type==='PREVIEW'?'optional_previews':row.scope_type==='REVISION'?'revision_requests':'publications';
    await db.query(`SELECT id FROM ${table} WHERE tenant_id=$1 AND id=$2 FOR UPDATE`,[row.tenant_id,row.scope_id]);
    const current = await db.query(`SELECT id FROM stage_runs WHERE tenant_id=$1 AND id=$2 AND deadline_at<=now() AND state IN ('READY','UNKNOWN','CLAIMED','RUNNING') FOR UPDATE`,[row.tenant_id,row.id]);
    if (!current.rowCount) return 0;
    await stopScope(db,{tenantId:row.tenant_id,type:row.scope_type,id:row.scope_id},'DEADLINE_EXCEEDED'); return 1;
  });
  return result;
}
