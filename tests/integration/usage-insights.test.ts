import {beforeAll,afterAll,it,expect} from 'vitest';
import {testDatabase,account,orderFixture} from '../helpers/database';
import {buildApp} from '../../src/api/app';
import {config} from '../../src/api/config';
import {id,sha256,addSeconds} from '../../src/api/lib/crypto';
import {insert} from '../../src/api/db/store';
import {transaction} from '../../src/api/db/pool';
import {reservePlatform,settlePlatform} from '../../src/worker/budget/platform';

let db:Awaited<ReturnType<typeof testDatabase>>,app:Awaited<ReturnType<typeof buildApp>>;
let buyer:Awaited<ReturnType<typeof account>>,other:Awaited<ReturnType<typeof account>>,orderId:string,productId:string,profileId:string,photoId:string;
const reader=id('synthetic-reader'),classifier=id('synthetic-classifier');
const start=new Date(Date.now()-3600000).toISOString(),end=new Date(Date.now()+3600000).toISOString();
const headers=(token=buyer.accessToken)=>({authorization:`Bearer ${token}`});
const feedback=()=>`/v1/p01/orders/${orderId}/usage-feedback`;
const insights=(group='ALL')=>`/v1/internal/p01/metrics/product-insights?${new URLSearchParams({window_start:start,window_end:end,traffic_group:group})}`;
const classify=()=>`/v1/internal/p01/metrics/accounts/${buyer.principal.tenantId}/${buyer.principal.userId}`;
async function choose(choice:string|null,revision:number){return app.inject({method:'PUT',url:feedback(),headers:headers(),payload:{choice,expected_revision:revision}});}
beforeAll(async()=>{
  db=await testDatabase();
  try{
    buyer=await account(db);other=await account(db);const f=await orderFixture(db,10000,buyer.principal);orderId=f.orderId;
    const scope=(await db.pool.query(`SELECT p.product_id,p.photo_version_id,p.profile_id FROM orders o JOIN quotes q ON q.id=o.quote_id JOIN plan_versions p ON p.id=q.plan_id WHERE o.id=$1`,[orderId])).rows[0];
    productId=scope.product_id;photoId=scope.photo_version_id;profileId=scope.profile_id;
    await db.pool.query("UPDATE orders SET fulfillment_state='DELIVERED',spent_micro=200 WHERE id=$1",[orderId]);
    await insert(db.pool,'delivery_manifests',{id:id('manifest'),tenant_id:buyer.principal.tenantId,owner_id:buyer.principal.userId,order_id:orderId,revision:1,
      hash:'a'.repeat(64),data:{synthetic_aggregate_fixture:true},expires_at:addSeconds(86400)});
    app=await buildApp({cfg:config({...db.cfg,managementTokens:JSON.stringify([
      {actor:'synthetic-metrics-reader',token_hash:sha256(reader),permissions:['metrics:read']},
      {actor:'synthetic-traffic-classifier',token_hash:sha256(classifier),permissions:['metrics:classify']}])}),pool:db.pool,tls:false});
  }catch(error){await app?.close();await db.close();throw error;}
});
afterAll(async()=>{await app?.close();await db?.close();});
it('authorizes optional feedback, compares revisions, and lets withdrawal survive a late old write',async()=>{
  expect((await app.inject({url:feedback()})).statusCode).toBe(401);
  expect((await app.inject({url:feedback(),headers:headers(other.accessToken)})).statusCode).toBe(404);
  const empty=await app.inject({url:feedback(),headers:headers()});expect(empty.statusCode,empty.body).toBe(200);expect(empty.headers['cache-control']).toBe('private, no-store');
  expect(empty.json().data).toMatchObject({order_id:orderId,choice:null,revision:0,updated_at:null});
  const set=await choose('USED',0);expect(set.statusCode,set.body).toBe(200);expect(set.json().data).toMatchObject({choice:'USED',revision:1});
  expect((await choose('USED',0)).json().data.revision).toBe(1);
  expect((await choose('PLANNED_USE',0)).statusCode).toBe(409);
  const withdrawn=await choose(null,1);expect(withdrawn.statusCode,withdrawn.body).toBe(200);expect(withdrawn.json().data).toMatchObject({choice:null,revision:2});
  expect((await choose('USED',0)).statusCode).toBe(409);expect((await app.inject({url:feedback(),headers:headers()})).json().data.choice).toBeNull();
  expect((await choose('PUBLISHED',2)).statusCode).toBe(400);
  expect((await app.inject({method:'PUT',url:feedback(),headers:headers(),payload:{choice:'USED',expected_revision:2,url:'private-url'}})).statusCode).toBe(400);
});
it('counts durable unknown evidence, deduplicated server-time saves and settled platform costs without claiming accuracy',async()=>{
  const tenant=buyer.principal.tenantId,owner=buyer.principal.userId,analysis=id('analysis'),machine=id('profile');
  await insert(db.pool,'analysis_jobs',{id:analysis,tenant_id:tenant,owner_id:owner,product_id:productId,photo_version_id:photoId,input_hash:sha256(analysis),
    state:'READY',model_version:'synthetic-vision',deadline_at:addSeconds(30),data:{profile_id:machine},private:{}});
  // Synthetic rows exercise aggregate definitions, not recognition quality.
  await insert(db.pool,'profile_versions',{id:machine,tenant_id:tenant,owner_id:owner,product_id:productId,photo_version_id:photoId,revision:2,profile_hash:sha256(machine),
    data:{observations:[],label_texts:[],hypotheses:[{claim:'unproven'}],unknowns:['material','size']},private:{analysis_id:analysis}});
  for(const attempt of [1,2])await insert(db.pool,'analysis_attempts',{id:id('attempt'),tenant_id:tenant,analysis_id:analysis,attempt,request_hash:sha256(String(attempt)),data:{}});
  for(const index of [0,1]){const session=id('save');await insert(db.pool,'save_sessions',{id:session,tenant_id:tenant,owner_id:owner,order_id:orderId,installation_id:id('installation'),data:{}});
    await insert(db.pool,'save_receipts',{id:id('receipt'),tenant_id:tenant,save_session_id:session,deliverable_id:'synthetic-same-file',attempt:index+1,state:'SAVED',occurred_at:'2000-01-01T00:00:00Z',data:{}});
    if(index===0)await insert(db.pool,'save_receipts',{id:id('receipt'),tenant_id:tenant,save_session_id:session,deliverable_id:'synthetic-legacy-file',attempt:1,state:'SAVED',occurred_at:new Date().toISOString(),received_at:null,data:{}});
  }
  await transaction(db.pool,async tx=>{const scope={tenantId:tenant,ownerId:owner,category:'ANALYSIS',dailyCeilingMicro:1000000};
    const settled=await reservePlatform(tx,scope,id('platform-intent'),1000,{});await settlePlatform(tx,tenant,settled,100);
    const unknown=await reservePlatform(tx,scope,id('platform-intent'),1000,{});await settlePlatform(tx,tenant,unknown,null);});
  const result=await app.inject({url:insights(),headers:headers(reader)});expect(result.statusCode,result.body).toBe(200);
  expect(result.json().data).toMatchObject({traffic_group:'ALL',recognition:{jobs:1,attempts:2,machine_profiles:1,observed_fields:0,hypothesis_fields:1,unknown_fields:2,evidenced_field_share:0,accuracy:null},
    album:{saved_files:1,saved_orders:1,unwindowed_receipts:1},feedback:{withdrawn:1,used:0},funnel:{paid_orders:1,first_deliveries:1,recommendation_impressions:null,automatic_success_ratio:null},
    costs:{order_settled_micro:200,platform_settled_micro:100,platform_unresolved_reservations:1,complete_cost_micro:null,review_support_micro:null}});
  for(const value of [orderId,productId,profileId,machine,analysis,tenant,owner,reader,'unproven'])expect(result.body).not.toContain(value);
});
it('separates reading from classification and excludes test accounts from marked external metrics',async()=>{
  expect((await app.inject({url:insights(),headers:headers()})).statusCode).toBe(401);
  expect((await app.inject({url:insights(),headers:headers(classifier)})).statusCode).toBe(403);
  const request={method:'PUT' as const,url:classify(),payload:{traffic_group:'INTERNAL_TEST'},headers:{...headers(reader),'idempotency-key':'synthetic-cohort-1'}};
  expect((await app.inject(request)).statusCode).toBe(403);
  const set=await app.inject({...request,headers:{...headers(classifier),'idempotency-key':'synthetic-cohort-1'}});expect(set.statusCode,set.body).toBe(200);
  expect(set.json().data.traffic_group).toBe('INTERNAL_TEST');
  const own=await app.inject({url:insights('INTERNAL_TEST'),headers:headers(reader)});expect(own.statusCode,own.body).toBe(200);expect(own.json().data.funnel.paid_orders).toBe(1);
  const external=await app.inject({url:insights('EXTERNAL'),headers:headers(reader)});expect(external.statusCode,external.body).toBe(200);expect(external.json().data.funnel.paid_orders).toBe(0);
  expect(external.json().data.recognition.evidenced_field_share).toBeNull();expect(external.json().data.costs.platform_settled_micro).toBe(0);
  expect((await app.inject({url:insights('INVALID'),headers:headers(reader)})).statusCode).toBe(400);
  expect((await app.inject({url:insights()+'&traffic_group=EXTERNAL',headers:headers(reader)})).statusCode).toBe(400);
});
it('clears optional feedback on both order revocation and product deletion and cannot restore it from an old response',async()=>{
  expect((await choose('USED',2)).statusCode).toBe(200);
  await db.pool.query("UPDATE orders SET private=private||'{\"media_revoked\":true}'::jsonb WHERE id=$1",[orderId]);
  expect((await db.pool.query('SELECT * FROM order_usage_feedback WHERE order_id=$1',[orderId])).rowCount).toBe(0);
  expect((await choose('USED',2)).statusCode).toBe(410);
  const f=await orderFixture(db,10000,buyer.principal);await db.pool.query("UPDATE orders SET fulfillment_state='DELIVERED' WHERE id=$1",[f.orderId]);
  await insert(db.pool,'delivery_manifests',{id:id('manifest'),tenant_id:buyer.principal.tenantId,owner_id:buyer.principal.userId,order_id:f.orderId,revision:1,hash:'b'.repeat(64),data:{synthetic_aggregate_fixture:true},expires_at:addSeconds(86400)});
  const url=`/v1/p01/orders/${f.orderId}/usage-feedback`;const set=await app.inject({method:'PUT',url,headers:headers(),payload:{choice:'PLANNED_USE',expected_revision:0}});expect(set.statusCode,set.body).toBe(200);
  await db.pool.query('UPDATE product_drafts SET deleted_at=now() WHERE id=(SELECT product_id FROM privacy_order_scope WHERE id=$1)',[f.orderId]);
  expect((await db.pool.query('SELECT * FROM order_usage_feedback WHERE order_id=$1',[f.orderId])).rowCount).toBe(0);
  expect((await app.inject({method:'PUT',url,headers:headers(),payload:{choice:'USED',expected_revision:0}})).statusCode).toBe(410);
});
