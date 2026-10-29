import type {Db} from '../db/pool.js';
import type {Config} from '../config.js';
import type {DTO,Principal} from '../../shared/contracts/types.js';
import {owned} from '../db/store.js';
import {notFound,requireThat} from '../lib/errors.js';

/** Read the original payment only. A cached invocation must never bypass current order state. */
export async function originalPaymentAction(db:Db,cfg:Config,p:Principal,orderId:string):Promise<DTO<'PaymentAction'>>{
  const order=await owned<DTO<'Order'>>(db,'orders',orderId,p,true);
  requireThat(order.data.channel===p.platform&&order.app_id===p.appId&&order.subject_id===p.subjectId,
    'PAYMENT_CHANNEL_MISMATCH','请回到原账户和原小程序继续支付',403);
  const payment=(await db.query<{id:string;state:DTO<'PaymentState'>;data:DTO<'PaymentAction'>}>('SELECT id,state,data FROM payments WHERE order_id=$1 AND tenant_id=$2',[order.id,p.tenantId])).rows[0]??notFound();
  const action=payment.data;
  requireThat(action.order_id===order.id&&action.payment_id===payment.id&&action.channel===order.data.channel,
    'PAYMENT_ACTION_SCOPE_INVALID','付款信息与原订单不一致，请查询原订单',503);
  const now=Date.now(),payable=cfg.paymentsEnabled&&order.data.fulfillment_state==='NOT_STARTED'&&!order.data.refund_id
    &&!Object.hasOwn(order.private??{},'media_revoked')&&order.private?.privacy_deleted!==true&&['CREATED','PENDING'].includes(order.data.payment_state)
    &&['CREATED','PENDING'].includes(payment.state)&&['CREATED','PENDING'].includes(action.state)
    &&Date.parse(order.data.payable_until)>now&&Date.parse(action.expires_at)>now;
  return payable?action:{...action,state:order.data.payment_state==='CONFIRMED'?'CONFIRMED':payment.state,action:{kind:'QUERY_ORIGINAL_ORDER'}};
}
