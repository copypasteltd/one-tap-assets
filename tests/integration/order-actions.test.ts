import {beforeAll,afterAll,it,expect} from 'vitest';
import {testDatabase,account,orderFixture,type TestDatabase} from '../helpers/database';
import {buildApp} from '../../src/api/app';
import {insert} from '../../src/api/db/store';
import {transaction} from '../../src/api/db/pool';
import {id,iso,addSeconds} from '../../src/api/lib/crypto';
import {confirmPayment,type VerifiedPayment} from '../../src/api/modules/commerce';
import {enqueueStage} from '../../src/worker/queue/enqueue';
import {ClientSession} from '../../src/shared/client/session';
import {cancelOriginalOrder,requestOriginalRefund} from '../../src/shared/client/order-actions';
import type {DTO,Principal} from '../../src/shared/contracts/types';
import type {HostPort} from '../../src/shared/platform/ports';
let db:TestDatabase,app:Awaited<ReturnType<typeof buildApp>>,disabled:typeof app;
beforeAll(async()=>{db=await testDatabase();app=await buildApp({cfg:{...db.cfg,paymentsEnabled:true},pool:db.pool,tls:false});disabled=await buildApp({cfg:db.cfg,pool:db.pool,tls:false});});
afterAll(async()=>{await app?.close();await disabled?.close();await db?.close();});
async function fixture(paymentState:DTO<'PaymentState'>='PENDING',fulfillment:DTO<'FulfillmentState'>='NOT_STARTED'){
  const user=await account(db),base=await orderFixture(db,100000,user.principal),quote=(await db.pool.query<{quote_id:string}>('SELECT quote_id FROM orders WHERE id=$1',[base.orderId])).rows[0]!;
  const order:DTO<'Order'>={order_id:base.orderId,quote_id:quote.quote_id,channel:'alipay',currency:'CNY',amount_fen:100,payment_state:paymentState,fulfillment_state:fulfillment,
    payable_until:addSeconds(900),refund_id:null,job_id:null,delivery_expires_at:null,created_at:iso()};
  await db.pool.query('UPDATE orders SET payment_state=$2,fulfillment_state=$3,data=$4 WHERE id=$1',[order.order_id,paymentState,fulfillment,order]);
  const payment:DTO<'PaymentAction'>={payment_id:id('payment'),order_id:order.order_id,channel:'alipay',state:paymentState,expires_at:order.payable_until,
    action:{kind:'INVOKE_PLATFORM_PAYMENT',adapter_contract_version:'SYNTHETIC_ORDER_ACTION_FIXTURE',serialized_platform_payload:'{}'}};
  await insert(db.pool,'payments',{id:payment.payment_id,tenant_id:user.principal.tenantId,order_id:order.order_id,provider:'alipay',merchant_id:'synthetic-merchant',state:paymentState,amount_fen:100,intent_key:`payment:${order.order_id}`,data:payment});
  return {...user,order,payment};
}
function clientFor(user:{principal:Principal;accessToken:string},loseRefundAck=false){
  const memory=new Map<string,unknown>(),sent:{path:string;method:string}[]=[];let lost=false;
  const host:HostPort={platform:'alipay',storage:{get:<T>(k:string)=>(memory.get(k)??null) as T|null,set:(k,v)=>{memory.set(k,v);},remove:k=>{memory.delete(k);}},
    transport:async r=>{const path=new URL(r.url).pathname;sent.push({path,method:r.method});const result=await app.inject({method:r.method as 'GET'|'POST',url:path,headers:r.headers,...(r.body?{payload:String(r.body)}:{})});
      if(loseRefundAck&&!lost&&path.endsWith('/refund-requests')&&result.statusCode>=200&&result.statusCode<300){lost=true;throw new Error('Synthetic ACK lost after committed original refund');}
      return {status:result.statusCode,data:result.json(),headers:{}};},login:async()=>'',choosePhotos:async()=>[],upload:async()=>{},pay:async()=>{throw new Error('No native payment or external provider in this fixture');},download:async()=>'',save:async()=> 'UNKNOWN',copy:async()=>{}};
  const client=new ClientSession(host,db.cfg.publicBaseUrl);client.attach({user_id:user.principal.userId,access_token:user.accessToken,token_type:'Bearer',expires_at:addSeconds(3600)});return {client,sent};
}
async function paymentAction(f:Awaited<ReturnType<typeof fixture>>,target=app,key='original-payment-action-key'){
  return target.inject({method:'POST',url:`/v1/p01/orders/${f.order.order_id}/payment-attempts`,headers:{authorization:`Bearer ${f.accessToken}`,'idempotency-key':key},payload:{}});
}
it('revalidates a cached payment action after cancellation and refunds one late confirmed original payment',async()=>{
  const f=await fixture(),{client}=clientFor(f),first=await paymentAction(f);expect(first.statusCode).toBe(200);expect(first.json().data.action.kind).toBe('INVOKE_PLATFORM_PAYMENT');
  expect((await cancelOriginalOrder(client,f.order.order_id)).fulfillment_state).toBe('CANCELLED');
  const current=await paymentAction(f);expect(current.statusCode).toBe(200);expect(current.json().data.action.kind).toBe('QUERY_ORIGINAL_ORDER');
  const saved=(await db.pool.query('SELECT data,state FROM payments WHERE id=$1',[f.payment.payment_id])).rows[0];expect(saved.state).toBe('PENDING');expect(saved.data.action.kind).toBe('INVOKE_PLATFORM_PAYMENT');
  expect((await db.pool.query('SELECT count(*)::int AS n FROM idempotency_records WHERE operation=$1 AND target_id=$2',['getOrCreatePaymentAction',f.order.order_id])).rows[0].n).toBe(1);
  const event:VerifiedPayment={channel:'alipay',appId:f.principal.appId,subjectId:f.principal.subjectId,merchantId:'synthetic-merchant',orderId:f.order.order_id,providerOrderId:id('vendor'),eventKey:id('event'),amountFen:100,rawHash:'a'.repeat(64)};
  const paid=await transaction(db.pool,c=>confirmPayment(c,event));expect(paid).toMatchObject({payment_state:'CONFIRMED',fulfillment_state:'CANCELLED'});expect(paid.refund_id).toBeTruthy();
  expect((await transaction(db.pool,c=>confirmPayment(c,event))).refund_id).toBe(paid.refund_id);
  for(const [table,n] of [['refunds',1],['ledger_entries',1],['render_jobs',0],['execution_snapshots',0]] as const)
    expect((await db.pool.query(`SELECT count(*)::int AS n FROM ${table} WHERE order_id=$1`,[f.order.order_id])).rows[0].n).toBe(n);
});
it('cancels a paid queued order, fences queued work and requests exactly the original refund once',async()=>{
  const f=await fixture('CONFIRMED','QUEUED'),{client,sent}=clientFor(f);
  const stage=await enqueueStage(db.pool,{tenantId:f.principal.tenantId,scopeType:'ORDER',scopeId:f.order.order_id,name:'PRODUCTION',inputHash:'a'.repeat(64),deadlineAt:addSeconds(600)});
  const before=(await db.pool.query('SELECT fencing_token FROM stage_runs WHERE id=$1',[stage])).rows[0].fencing_token;
  const cancelled=await cancelOriginalOrder(client,f.order.order_id);expect(cancelled.refund_id).toBeTruthy();expect((await cancelOriginalOrder(client,f.order.order_id)).refund_id).toBe(cancelled.refund_id);
  const stopped=(await db.pool.query('SELECT state,fencing_token FROM stage_runs WHERE id=$1',[stage])).rows[0];expect(stopped.state).toBe('CANCELLED');expect(Number(stopped.fencing_token)).toBe(Number(before)+1);
  const refund=(await db.pool.query('SELECT provider,amount_fen,state FROM refunds WHERE order_id=$1',[f.order.order_id])).rows;
  expect(refund).toEqual([{provider:'alipay',amount_fen:100,state:'REQUESTED'}]);expect(sent.filter(r=>r.path.endsWith('/cancel')&&r.method==='POST')).toHaveLength(1);
});
it('recovers a committed refund after losing its ACK and keeps it private to its original buyer',async()=>{
  const f=await fixture('CONFIRMED','FAILED'),{client,sent}=clientFor(f,true);
  await expect(requestOriginalRefund(client,f.order.order_id)).rejects.toMatchObject({code:'NETWORK_UNKNOWN'});
  const refund=await requestOriginalRefund(client,f.order.order_id);expect(refund).toMatchObject({order_id:f.order.order_id,amount_fen:100,state:'REQUESTED'});
  expect(sent.filter(r=>r.path.endsWith('/refund-requests'))).toHaveLength(1);
  expect((await db.pool.query('SELECT count(*)::int AS n FROM refunds WHERE order_id=$1',[f.order.order_id])).rows[0].n).toBe(1);
  const stranger=clientFor(await account(db));await expect(stranger.client.api.call('getRefund',{params:{refund_id:refund.refund_id}})).rejects.toMatchObject({status:404});
});
it('rejects direct cancellation and refund requests after production starts or delivery succeeds',async()=>{
  for(const state of ['IN_PROGRESS','DELIVERED'] as const){
    const f=await fixture('CONFIRMED',state),{client}=clientFor(f);
    await expect(client.api.call('cancelOrder',{params:{order_id:f.order.order_id},body:{reason_code:'BUYER_CANCEL'},key:'original-cancel-request'})).rejects.toMatchObject({code:'CANCELLATION_NOT_ALLOWED'});
    await expect(client.api.call('requestRefund',{params:{order_id:f.order.order_id},body:{reason_code:'BUYER_REFUND'},key:'original-refund-request'})).rejects.toMatchObject({code:'REFUND_REQUIRES_SUPPORT'});
    expect((await paymentAction(f)).json().data.action.kind).toBe('QUERY_ORIGINAL_ORDER');
    expect((await db.pool.query('SELECT count(*)::int AS n FROM refunds WHERE order_id=$1',[f.order.order_id])).rows[0].n).toBe(0);
  }
});
it('keeps unknown, expired and disabled payment actions observational and binds the original app and subject',async()=>{
  const unknown=await fixture('UNKNOWN');expect((await paymentAction(unknown)).json().data).toMatchObject({state:'UNKNOWN',action:{kind:'QUERY_ORIGINAL_ORDER'}});
  const expired=await fixture();await db.pool.query("UPDATE orders SET data=jsonb_set(data,'{payable_until}',to_jsonb((now()-interval '1 second')::text)) WHERE id=$1",[expired.order.order_id]);
  expect((await paymentAction(expired)).json().data.action.kind).toBe('QUERY_ORIGINAL_ORDER');
  const off=await fixture();expect((await paymentAction(off,disabled)).json().data.action.kind).toBe('QUERY_ORIGINAL_ORDER');
  const foreign=await fixture();await db.pool.query('UPDATE orders SET app_id=$2 WHERE id=$1',[foreign.order.order_id,'another-app']);expect((await paymentAction(foreign)).statusCode).toBe(403);
  await db.pool.query('UPDATE orders SET app_id=$2,subject_id=$3 WHERE id=$1',[foreign.order.order_id,foreign.principal.appId,'another-subject']);expect((await paymentAction(foreign)).statusCode).toBe(403);
  expect((await db.pool.query('SELECT state FROM payments WHERE id=$1',[unknown.payment.payment_id])).rows[0].state).toBe('UNKNOWN');
});
it('rechecks cancellation after an actual original-order row-lock wait',async()=>{
  const f=await fixture('CONFIRMED','QUEUED'),{client}=clientFor(f),blocker=await db.pool.connect();let released=false;
  try{
    await blocker.query('BEGIN');const pid=(await blocker.query<{pid:number}>('SELECT pg_backend_pid() AS pid')).rows[0]!.pid;
    await blocker.query("UPDATE orders SET fulfillment_state='IN_PROGRESS',data=jsonb_set(data,'{fulfillment_state}','\"IN_PROGRESS\"') WHERE id=$1",[f.order.order_id]);
    const pending=client.api.call('cancelOrder',{params:{order_id:f.order.order_id},body:{reason_code:'BUYER_CANCEL'},key:'row-lock-cancel-request'});void pending.catch(()=>{});
    let waited=false;
    for(let i=0;i<100;i++){waited=(await db.pool.query<{blocked:boolean}>('SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE $1=ANY(pg_blocking_pids(pid))) AS blocked',[pid])).rows[0]!.blocked;if(waited)break;await new Promise(r=>setTimeout(r,20));}
    expect(waited).toBe(true);await blocker.query('COMMIT');released=true;
    await expect(pending).rejects.toMatchObject({code:'CANCELLATION_NOT_ALLOWED'});
    expect((await db.pool.query('SELECT count(*)::int AS n FROM refunds WHERE order_id=$1',[f.order.order_id])).rows[0].n).toBe(0);
  }finally{if(!released)await blocker.query('ROLLBACK');blocker.release();}
});
