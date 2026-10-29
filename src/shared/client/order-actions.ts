import type {DTO,Platform} from '../contracts/types';
import type {ClientSession} from './session';
import {ClientError} from './api';

export function orderActions(order:DTO<'Order'>,platform:Platform,now=Date.now()){
  return {pay:order.channel===platform&&order.fulfillment_state==='NOT_STARTED'&&!order.refund_id
      &&['CREATED','PENDING'].includes(order.payment_state)&&Date.parse(order.payable_until)>now,
    cancel:['NOT_STARTED','QUEUED'].includes(order.fulfillment_state)&&!order.refund_id,
    refund:order.payment_state==='CONFIRMED'&&['FAILED','CANCELLED'].includes(order.fulfillment_state)&&!order.refund_id};
}
async function currentOrder(client:ClientSession,orderId:string){
  await client.login();const buyer=client.api.userId;
  const scope=()=>{if(!buyer||client.api.userId!==buyer)throw new ClientError('ACCOUNT_CHANGED','账户已变化，请查询当前账户的原订单');};
  const order=await client.api.call('getOrder',{params:{order_id:orderId}});scope();
  if(order.order_id!==orderId)throw new ClientError('ORDER_CHANGED','返回的订单不一致，请重新查询');
  return {order,scope};
}
export async function payOriginalOrder(client:ClientSession,orderId:string):Promise<'QUERY'|'RETURNED'|'CANCELLED'|'UNKNOWN'>{
  const {order,scope}=await currentOrder(client,orderId);
  if(order.channel!==client.host.platform)throw new ClientError('PAYMENT_CHANNEL_MISMATCH','请回到原小程序继续支付',403);
  if(!orderActions(order,client.host.platform).pay)return 'QUERY';
  const payment=await client.api.call('getOrCreatePaymentAction',{params:{order_id:orderId},key:client.intent('payment-action',{order:orderId})});scope();
  if(payment.order_id!==orderId||payment.channel!==order.channel)throw new ClientError('PAYMENT_ACTION_INVALID','付款信息与原订单不一致，请重新查询');
  if(payment.action.kind!=='INVOKE_PLATFORM_PAYMENT'||!['CREATED','PENDING'].includes(payment.state)
    ||Date.parse(payment.expires_at)<=Date.now()||!Number.isFinite(Date.parse(payment.expires_at))
    ||!orderActions(order,client.host.platform).pay)return 'QUERY';
  const result=await client.host.pay(payment);scope();return result;
}
export async function cancelOriginalOrder(client:ClientSession,orderId:string):Promise<DTO<'Order'>>{
  const {order,scope}=await currentOrder(client,orderId);
  if(order.fulfillment_state==='CANCELLED')return order;
  if(!orderActions(order,client.host.platform).cancel)throw new ClientError('CANCELLATION_NOT_ALLOWED','制作已开始或订单状态已更新，请查询原单或通过问题反馈处理',409);
  const request={reason_code:'BUYER_CANCEL_BEFORE_PRODUCTION'};
  const result=await client.api.call('cancelOrder',{params:{order_id:orderId},body:request,key:client.intent('cancel-order',{order:orderId,...request})});scope();
  if(result.order_id!==orderId)throw new ClientError('ORDER_CHANGED','取消结果与原订单不一致，请重新查询');return result;
}
export async function requestOriginalRefund(client:ClientSession,orderId:string):Promise<DTO<'Refund'>>{
  const {order,scope}=await currentOrder(client,orderId);let result:DTO<'Refund'>;
  if(order.refund_id)result=await client.api.call('getRefund',{params:{refund_id:order.refund_id}});
  else{
    if(!orderActions(order,client.host.platform).refund)throw new ClientError('REFUND_REQUIRES_SUPPORT','当前订单请通过问题反馈申请处理',422);
    const request={reason_code:'BUYER_REQUEST_ORIGINAL_REFUND'};
    result=await client.api.call('requestRefund',{params:{order_id:orderId},body:request,key:client.intent('refund-request',{order:orderId,...request})});
  }scope();
  if(result.order_id!==orderId||result.amount_fen!==order.amount_fen)throw new ClientError('REFUND_SCOPE_INVALID','退款结果与原订单不一致，请查询原单');return result;
}
