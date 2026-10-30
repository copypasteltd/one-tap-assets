import {testDatabase,account,orderFixture} from './database';
import {buildApp} from '../../src/api/app';
import {config} from '../../src/api/config';
import {insert} from '../../src/api/db/store';
import {id,hash,sha256,addSeconds} from '../../src/api/lib/crypto';

/** Deliberate synthetic finance/fulfilment metadata in an isolated native
 * database schema. It does not fabricate paid media or production acceptance. */
export async function metricsEnvironment(){
  const db=await testDatabase(),reader=id('synthetic-metrics-reader'),other=id('synthetic-review-only');
  const cfg=config({...db.cfg,managementTokens:JSON.stringify([{actor:'synthetic-operator',token_hash:sha256(reader),permissions:['metrics:read']},
    {actor:'synthetic-reviewer',token_hash:sha256(other),permissions:['publication:read']}])});
  let app:Awaited<ReturnType<typeof buildApp>>|undefined;
  try{
    const window={window_start:'2026-10-01T00:00:00.000Z',window_end:'2026-10-08T00:00:00.000Z'},start=Date.parse(window.window_start);
    const buyer=await account(db),orders:string[]=[];
    const time=(offset:number)=>new Date(start+offset*1000).toISOString();
    async function order(at:number,paid:boolean,delivered:boolean,spent:number,seconds:number|null,engine='PHOTO_LAYOUT',manifest=true,redacted=false){
      const f=await orderFixture(db,10000000,buyer.principal);orders.push(f.orderId);
      await db.pool.query('UPDATE orders SET created_at=$2,spent_micro=$3,payment_state=$4,fulfillment_state=$5 WHERE id=$1',
        [f.orderId,time(at),spent,paid?'CONFIRMED':'PENDING',delivered?'DELIVERED':'IN_PROGRESS']);
      if(delivered&&manifest){
        const snapshot={engine,fulfillable_at:redacted?'[privacy removed]':time(at+2)};
        await insert(db.pool,'execution_snapshots',{id:id('snapshot'),tenant_id:f.principal.tenantId,order_id:f.orderId,hash:hash(snapshot),data:snapshot});
        await insert(db.pool,'delivery_manifests',{id:id('manifest'),tenant_id:f.principal.tenantId,owner_id:f.principal.userId,order_id:f.orderId,revision:1,
          hash:'a'.repeat(64),data:{synthetic_fixture:true},delivered_at:time(at+2+(seconds??0)),expires_at:addSeconds(86400)});
      }
      return f;
    }
    const a=await order(0,true,true,1250000,60),b=await order(120,true,true,750000,120,'PER_SHOT_AI');
    const waiting=await order(240,true,false,500000,null);
    await order(360,false,true,100000,1);
    await order(480,true,true,200000,1,'PHOTO_LAYOUT',false);
    await order(600,true,true,300000,1,'REFERENCE_FILM',true,true);
    const outside=await order(-1,true,true,9000000,99999,'REFERENCE_FILM');
    await order(7*86400,true,true,9000000,99999,'REFERENCE_FILM');
    await insert(db.pool,'delivery_manifests',{id:id('revision'),tenant_id:a.principal.tenantId,owner_id:a.principal.userId,order_id:a.orderId,revision:2,
      hash:'b'.repeat(64),data:{synthetic_fixture:true},delivered_at:time(200000),expires_at:addSeconds(86400)});
    async function stage(scope:string,name:string,at:number,failed=false){const stage=id('stage');await insert(db.pool,'stage_runs',{
      id:stage,tenant_id:buyer.principal.tenantId,scope_type:'ORDER',scope_id:scope,stage_name:name,input_hash:'a'.repeat(64),state:failed?'FAILED':'READY',
      deadline_at:addSeconds(60),created_at:time(at),data:failed?{reason_code:'HARD_DEADLINE_EXCEEDED'}:{}});return stage;}
    const production=await stage(a.orderId,'PRODUCTION',20);
    for(const [at,state] of [[30,'UNKNOWN'],[-20,'UNKNOWN'],[40,'ACKNOWLEDGED']] as const)await insert(db.pool,'provider_submissions',{
      id:id('submission'),tenant_id:buyer.principal.tenantId,stage_run_id:production,intent_key:id('intent'),input_hash:'a'.repeat(64),state,created_at:time(at),data:{}});
    await stage(a.orderId,'POST',40,true);await stage(a.orderId,'QC',50,true);await stage(outside.orderId,'QC',-20,true);
    for(const [f,at] of [[waiting,60],[outside,-20]] as const){const payment=id('payment');await insert(db.pool,'payments',{
      id:payment,tenant_id:f.principal.tenantId,order_id:f.orderId,provider:'alipay',merchant_id:'synthetic-merchant',state:'CONFIRMED',amount_fen:100,intent_key:id('pay-intent'),data:{}});
      await insert(db.pool,'refunds',{id:id('refund'),tenant_id:f.principal.tenantId,order_id:f.orderId,payment_id:payment,refund_intent_key:id('refund-intent'),
        state:'UNKNOWN',amount_fen:100,provider:'alipay',merchant_id:'synthetic-merchant',created_at:time(at),data:{}});}
    app=await buildApp({cfg,pool:db.pool,tls:false});
    return {db,cfg,app,reader,other,buyer,orders,window,expected:{paid_orders:5,delivered_orders:3,cost_micro_total:3100000,
      unknown_submissions:1,refunds_pending:1,hard_deadline_failures:1,automatic_pack_success_ratio:0.6,
      route_p95_seconds:{PHOTO_LAYOUT:60,PER_SHOT_AI:120,REFERENCE_FILM:null}},
      headers:(token=reader)=>({authorization:`Bearer ${token}`}),close:async()=>{await app?.close();await db.close();}};
  }catch(error){await app?.close();await db.close();throw error;}
}
