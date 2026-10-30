import type {Db} from '../db/pool.js';
import type {DTO,Principal} from '../../shared/contracts/types.js';
import {owned} from '../db/store.js';
import {requireThat} from '../lib/errors.js';
import {lockMediaOwner} from './media-access.js';

type Row={choice:DTO<'UsageFeedback'>['choice'];revision:number;updated_at:Date};
async function scope(db:Db,p:Principal,orderId:string):Promise<void>{
  await lockMediaOwner(db,p.tenantId,p.userId);
  const order=await owned<DTO<'Order'>>(db,'orders',orderId,p,true);
  const product=await db.query(`SELECT p.id FROM privacy_order_scope s JOIN product_drafts p ON p.tenant_id=s.tenant_id AND p.id=s.product_id
    WHERE s.tenant_id=$1 AND s.id=$2 AND s.owner_id=$3 AND p.deleted_at IS NULL`,[p.tenantId,orderId,p.userId]);
  requireThat(String(order.private?.media_revoked)!=='true'&&!!product.rowCount,'MEDIA_REVOKED','原订单素材已撤回，使用反馈已清除',410);
  requireThat(order.payment_state==='CONFIRMED'&&order.fulfillment_state==='DELIVERED','FEEDBACK_NOT_AVAILABLE','整套素材交付后可自愿反馈使用情况',422);
  requireThat(!!(await db.query('SELECT id FROM delivery_manifests WHERE tenant_id=$1 AND order_id=$2 AND revision=1',[p.tenantId,orderId])).rowCount,
    'FEEDBACK_NOT_AVAILABLE','整套素材交付后可自愿反馈使用情况',422);
}
function dto(orderId:string,row?:Row):DTO<'UsageFeedback'>{return {order_id:orderId,choice:row?.choice??null,revision:row?.revision??0,updated_at:row?.updated_at.toISOString()??null};}
export async function getUsageFeedback(db:Db,p:Principal,orderId:string):Promise<DTO<'UsageFeedback'>>{
  await scope(db,p,orderId);
  return dto(orderId,(await db.query<Row>('SELECT choice,revision,updated_at FROM order_usage_feedback WHERE tenant_id=$1 AND owner_id=$2 AND order_id=$3',[p.tenantId,p.userId,orderId])).rows[0]);
}
/** A compare-and-set field, not a payment intent. No cached personal response
 * can resurrect a withdrawn value. The owner lock also serializes deletion. */
export async function setUsageFeedback(db:Db,p:Principal,orderId:string,request:DTO<'UsageFeedbackRequest'>):Promise<DTO<'UsageFeedback'>>{
  const current=await getUsageFeedback(db,p,orderId);
  if(current.choice===request.choice)return current;
  requireThat(current.revision===request.expected_revision,'FEEDBACK_REVISION_CONFLICT','反馈已在另一处更新，请读取后重新选择',409);
  const result=await db.query<Row>(`INSERT INTO order_usage_feedback(tenant_id,owner_id,order_id,choice,revision)
    VALUES($1,$2,$3,$4,$5) ON CONFLICT(tenant_id,order_id) DO UPDATE SET choice=EXCLUDED.choice,revision=EXCLUDED.revision,updated_at=now()
    RETURNING choice,revision,updated_at`,[p.tenantId,p.userId,orderId,request.choice,current.revision+1]);
  return dto(orderId,result.rows[0]);
}
