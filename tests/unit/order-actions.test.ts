import {it,expect} from 'vitest';
import {ClientSession} from '../../src/shared/client/session';
import {orderActions,payOriginalOrder,cancelOriginalOrder,requestOriginalRefund} from '../../src/shared/client/order-actions';
import type {DTO} from '../../src/shared/contracts/types';
import type {HostPort} from '../../src/shared/platform/ports';
import type {WireRequest} from '../../src/shared/client/api';
const order:DTO<'Order'>={order_id:'original-order',quote_id:'original-quote',channel:'alipay',currency:'CNY',amount_fen:100,payment_state:'PENDING',fulfillment_state:'NOT_STARTED',refund_id:null,job_id:null,payable_until:'2099-01-01T00:00:00Z',delivery_expires_at:null,created_at:'2026-10-30T00:00:00Z'};
const payment:DTO<'PaymentAction'>={payment_id:'original-payment',order_id:order.order_id,channel:'alipay',state:'PENDING',expires_at:order.payable_until,action:{kind:'INVOKE_PLATFORM_PAYMENT',adapter_contract_version:'synthetic-only',serialized_platform_payload:'{}'}};
const session=(user='buyer-a'):DTO<'Session'>=>({user_id:user,access_token:`synthetic-${user}`,token_type:'Bearer',expires_at:order.payable_until});
function setup(handler:(r:WireRequest)=>unknown|Promise<unknown>){
  const records=new Map<string,unknown>(),sent:WireRequest[]=[];let paid=0;
  const host:HostPort={platform:'alipay',storage:{get:<T>(k:string)=>(records.get(k)??null) as T|null,set:(k,v)=>{records.set(k,v);},remove:k=>{records.delete(k);}},
    transport:async r=>{sent.push(r);return {status:200,headers:{},data:{data:await handler(r)}};},login:async()=>'',choosePhotos:async()=>[],upload:async()=>{},
    pay:async()=>{paid++;return 'RETURNED';},download:async()=>'',save:async()=> 'UNKNOWN',copy:async()=>{}};
  const client=new ClientSession(host,'https://api.example.test');client.attach(session());return {client,host,sent,paid:()=>paid};
}
it('offers payment only before its window and keeps cancellation/refund separate from production and collection',()=>{
  expect(orderActions(order,'alipay')).toEqual({pay:true,cancel:true,refund:false});
  for(const state of ['UNKNOWN','CONFIRMED','FAILED','CANCELLED'] as const)expect(orderActions({...order,payment_state:state},'alipay').pay).toBe(false);
  expect(orderActions(order,'douyin').pay).toBe(false);expect(orderActions(order,'alipay',Date.parse(order.payable_until)).pay).toBe(false);
  for(const state of ['IN_PROGRESS','DELIVERED'] as const)expect(orderActions({...order,fulfillment_state:state},'alipay')).toEqual({pay:false,cancel:false,refund:false});
  expect(orderActions({...order,fulfillment_state:'CANCELLED',payment_state:'CONFIRMED'},'alipay').refund).toBe(true);
});
it('re-reads a stale order and never invokes native payment for cancellation or unknown payment',async()=>{
  for(const fresh of [{...order,fulfillment_state:'CANCELLED'},{...order,payment_state:'UNKNOWN'}] as DTO<'Order'>[]){
    const f=setup(()=>fresh);expect(await payOriginalOrder(f.client,order.order_id)).toBe('QUERY');expect(f.paid()).toBe(0);expect(f.sent.every(r=>r.method==='GET')).toBe(true);
  }
});
it('uses the same original payment-action key and treats native return only as a return',async()=>{
  const f=setup(r=>r.method==='GET'?order:payment);
  for(let i=0;i<2;i++)expect(await payOriginalOrder(f.client,order.order_id)).toBe('RETURNED');
  const posts=f.sent.filter(r=>r.method==='POST');expect(new Set(posts.map(r=>r.headers['Idempotency-Key'])).size).toBe(1);
  expect(f.paid()).toBe(2);expect(f.client.recover()).toEqual({});expect(posts.every(r=>r.url.endsWith('/payment-attempts'))).toBe(true);
});
it('blocks mismatched, expired, unknown and query-only payment actions before native invocation',async()=>{
  for(const action of [{...payment,order_id:'other-order'},{...payment,channel:'douyin'},{...payment,expires_at:'2000-01-01T00:00:00Z'},{...payment,state:'UNKNOWN'},{...payment,action:{kind:'QUERY_ORIGINAL_ORDER'}}] as DTO<'PaymentAction'>[]){
    const f=setup(r=>r.method==='GET'?order:action);
    try{expect(await payOriginalOrder(f.client,order.order_id)).toBe('QUERY');}catch(error){expect(error).toMatchObject({code:'PAYMENT_ACTION_INVALID'});}
    expect(f.paid()).toBe(0);
  }
});
it('recovers a lost cancellation ACK from the same original order without another cancellation POST',async()=>{
  let cancelled=false;const f=setup(r=>{if(r.method==='GET')return {...order,fulfillment_state:cancelled?'CANCELLED':'NOT_STARTED'};cancelled=true;throw new Error('ACK lost');});
  await expect(cancelOriginalOrder(f.client,order.order_id)).rejects.toMatchObject({code:'NETWORK_UNKNOWN'});
  expect((await cancelOriginalOrder(f.client,order.order_id)).fulfillment_state).toBe('CANCELLED');expect(f.sent.filter(r=>r.method==='POST')).toHaveLength(1);
});
it('stops cancellation after production starts and does not claim a refund for an unconfirmed payment',async()=>{
  const f=setup(()=>({...order,fulfillment_state:'IN_PROGRESS'}));await expect(cancelOriginalOrder(f.client,order.order_id)).rejects.toMatchObject({code:'CANCELLATION_NOT_ALLOWED'});
  const unpaid=setup(()=>({...order,fulfillment_state:'CANCELLED'}));await expect(requestOriginalRefund(unpaid.client,order.order_id)).rejects.toMatchObject({code:'REFUND_REQUIRES_SUPPORT'});
  expect([...f.sent,...unpaid.sent].every(r=>r.method==='GET')).toBe(true);
});
it('queries an existing refund and preserves REQUESTED rather than presenting it as received',async()=>{
  const refund={refund_id:'original-refund',order_id:order.order_id,amount_fen:100,state:'REQUESTED'};
  const f=setup(r=>r.url.endsWith('/original-refund')?refund:{...order,payment_state:'CONFIRMED',fulfillment_state:'CANCELLED',refund_id:refund.refund_id});
  expect((await requestOriginalRefund(f.client,order.order_id)).state).toBe('REQUESTED');expect(f.sent.every(r=>r.method==='GET')).toBe(true);
});
it('keeps the refund request key on network ambiguity and rejects a foreign amount',async()=>{
  let first=true;const keys:string[]=[];
  const f=setup(r=>{if(r.method==='GET')return {...order,payment_state:'CONFIRMED',fulfillment_state:'FAILED'};
    keys.push(r.headers['Idempotency-Key']!);if(first){first=false;throw new Error('Original response unavailable');}
    return {refund_id:'original-refund',order_id:order.order_id,amount_fen:99,state:'REQUESTED'};});
  await expect(requestOriginalRefund(f.client,order.order_id)).rejects.toMatchObject({code:'NETWORK_UNKNOWN'});
  await expect(requestOriginalRefund(f.client,order.order_id)).rejects.toMatchObject({code:'REFUND_SCOPE_INVALID'});expect(keys).toHaveLength(2);expect(new Set(keys).size).toBe(1);
});
it('rejects a late native callback after an account switch',async()=>{
  const f=setup(r=>r.method==='GET'?order:payment);let release!:(r:'RETURNED')=>void;
  f.host.pay=()=>new Promise(resolve=>{release=resolve;});const pending=payOriginalOrder(f.client,order.order_id);
  await new Promise(resolve=>setTimeout(resolve,0));f.client.attach(session('buyer-b'));release('RETURNED');
  await expect(pending).rejects.toMatchObject({code:'ACCOUNT_CHANGED'});expect(f.client.recover()).toEqual({});
});
