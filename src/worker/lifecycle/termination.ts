import type { Db } from '../../api/db/pool.js';
import { outbox } from '../../api/db/store.js';
import { requestRefundInternal } from '../../api/modules/refunds.js';
import { iso } from '../../api/lib/crypto.js';
import { lockMediaOwner } from '../../api/modules/media-access.js';
import { endAuthorizedPublications } from '../../api/modules/authorized-samples.js';

export interface WorkScope { tenantId: string; type: string; id: string }
/** Caller owns the transaction. Fencing and revocation commit with termination. */
export async function stopScope(db: Db, scope: WorkScope, reason: string, finalState: 'FAILED' | 'CANCELLED' = 'FAILED'): Promise<void> {
  const { tenantId, type, id } = scope;
  const now = iso();
  if(type==='REVISION') {
    const revision=(await db.query<{owner_id:string;order_id:string}>('SELECT owner_id,order_id FROM revision_requests WHERE tenant_id=$1 AND id=$2',[tenantId,id])).rows[0];
    if(!revision)return;await lockMediaOwner(db,tenantId,revision.owner_id);
    await db.query('SELECT id FROM orders WHERE tenant_id=$1 AND id=$2 FOR UPDATE',[tenantId,revision.order_id]);
    await db.query(`UPDATE revision_requests r SET state='FAILED',consumes_user_allowance=false,updated_at=now(),
      data=data||'{"state":"FAILED","consumes_user_allowance":false}'::jsonb,
      private=private||jsonb_build_object('termination_reason',$3::text)
      WHERE tenant_id=$1 AND id=$2 AND state IN ('REQUESTED','PROCESSING') AND NOT EXISTS
      (SELECT 1 FROM privacy_redactions p WHERE p.tenant_id=r.tenant_id AND p.target_table='revision_requests' AND p.target_id=r.id)`,[tenantId,id,reason]);
    await db.query(`UPDATE private_object_writes w SET delete_requested=true,erase_available_at=now(),updated_at=now()
      WHERE tenant_id=$1 AND revision_id=$2 AND EXISTS(SELECT 1 FROM revision_requests r WHERE r.tenant_id=w.tenant_id AND r.id=w.revision_id AND r.state='FAILED')`,[tenantId,id]);
  }
  if(type==='PREVIEW') {
    const preview=(await db.query<{owner_id:string}>('SELECT owner_id FROM optional_previews WHERE tenant_id=$1 AND id=$2',[tenantId,id])).rows[0];
    if(!preview) return; await lockMediaOwner(db,tenantId,preview.owner_id);
    await db.query(`UPDATE optional_previews p SET state='FAILED',updated_at=now(),data=data||'{"state":"FAILED"}'::jsonb
      WHERE tenant_id=$1 AND id=$2 AND NOT EXISTS(SELECT 1 FROM privacy_redactions r WHERE r.tenant_id=p.tenant_id AND r.target_table='optional_previews' AND r.target_id=p.id)`,[tenantId,id]);
    await db.query('UPDATE private_object_writes SET delete_requested=true,erase_available_at=now(),updated_at=now() WHERE tenant_id=$1 AND preview_id=$2',[tenantId,id]);
  }
  if (type === 'PUBLICATION') {
    const publication = (await db.query<{owner_id:string}>('SELECT owner_id FROM publications WHERE tenant_id=$1 AND id=$2',[tenantId,id])).rows[0];
    if (!publication) return;
    await lockMediaOwner(db,tenantId,publication.owner_id);
    await endAuthorizedPublications(db,{tenantId,userId:publication.owner_id},{publicationIds:[id]},reason,'FAILED'); return;
  }
  if (type === 'SAMPLE') {
    const stopped = await db.query(`UPDATE public_samples SET state='FAILED',updated_at=now(),data=data||'{"state":"FAILED"}'::jsonb,
      private=private||jsonb_build_object('termination_reason',$3::text,'media_revoked',true)
      WHERE tenant_id=$1 AND id=$2 AND state IN ('QUEUED','GENERATING') RETURNING id`, [tenantId,id,reason]);
    if (!stopped.rowCount) return;
  }
  if (type === 'ORDER') {
    // Order lock precedes stage/capability changes and serializes with delivery.
    const order = (await db.query<{ payment_state: string; fulfillment_state: string; private: { privacy_deleted?: boolean } }>(
      'SELECT payment_state,fulfillment_state,private FROM orders WHERE tenant_id=$1 AND id=$2 FOR UPDATE', [tenantId, id])).rows[0];
    if (!order || ['DELIVERED', 'EXPIRED'].includes(order.fulfillment_state)) return;
    if (!order.private.privacy_deleted) await db.query(`UPDATE orders SET fulfillment_state=$3,updated_at=now(),
      data=data||jsonb_build_object('fulfillment_state',$3::text),
      private=private||jsonb_build_object('termination_reason',$4::text) WHERE tenant_id=$1 AND id=$2`, [tenantId, id, finalState, reason]);
    await db.query(`UPDATE render_jobs SET state=$3,updated_at=now(),data=data||jsonb_build_object(
      'state',$3::text,'updated_at',$5::text),private=private||jsonb_build_object('termination_reason',$4::text)
      WHERE tenant_id=$1 AND order_id=$2 AND state NOT IN ('DELIVERED','FAILED','CANCELLED')`, [tenantId, id, finalState, reason, now]);
    if (order.payment_state === 'CONFIRMED') await requestRefundInternal(db, tenantId, id, reason);
  }
  await db.query(`UPDATE stage_runs SET state=$4,fencing_token=fencing_token+1,lease_owner=NULL,lease_expires_at=NULL,
    updated_at=now(),data=data||jsonb_build_object('state',$4::text,'reason_code',$5::text,'updated_at',$6::text)
    WHERE tenant_id=$1 AND scope_type=$2 AND scope_id=$3 AND state NOT IN ('SUCCEEDED','FAILED','CANCELLED')`, [tenantId, type, id, finalState, reason, now]);
  await db.query(`UPDATE agent_capabilities c SET revoked_at=COALESCE(revoked_at,now())
    FROM stage_runs s WHERE c.tenant_id=$1 AND s.tenant_id=c.tenant_id AND s.id=c.stage_run_id
    AND s.scope_type=$2 AND s.scope_id=$3 AND c.revoked_at IS NULL`, [tenantId, type, id]);
  await db.query(`UPDATE agent_instances SET state='DRAINING',fencing_token=fencing_token+1,updated_at=now(),
    data=data||jsonb_build_object('state','DRAINING','fencing_token',fencing_token+1,'release_reason',$5::text),
    private=private||jsonb_build_object('release_reason',$4::text)
    WHERE tenant_id=$1 AND (($2='ORDER' AND order_id=$3) OR ($2<>'ORDER' AND preview_session_id=$3))
    AND state NOT IN ('DRAINING','RELEASING','RELEASED','CLEANUP_FAILED')`, [tenantId, type, id, reason, finalState === 'CANCELLED' ? 'CANCELLED' : 'FAILED']);
  await outbox(db, tenantId, 'ReleaseRequested', id, `release:terminal:${type}:${id}`, { reason, scope_type: type });
}
