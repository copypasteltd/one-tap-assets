import {beforeAll,afterAll,it,expect} from 'vitest';
import {testDatabase,account,orderFixture,type TestDatabase} from '../helpers/database';
import {buildApp} from '../../src/api/app';
import {insert} from '../../src/api/db/store';
import {id,addSeconds,hash,iso} from '../../src/api/lib/crypto';
import {enqueueStage} from '../../src/worker/queue/enqueue';
import {ClientSession} from '../../src/shared/client/session';
import {AlbumQueue} from '../../src/shared/client/album';
import {ClientError,type WireRequest} from '../../src/shared/client/api';
import type {HostPort} from '../../src/shared/platform/ports';
import type {DTO} from '../../src/shared/contracts/types';
let db:TestDatabase,app:Awaited<ReturnType<typeof buildApp>>;
beforeAll(async()=>{db=await testDatabase();app=await buildApp({cfg:db.cfg,pool:db.pool,tls:false});});
afterAll(async()=>{await app?.close();await db?.close();});
// Explicitly synthetic delivered metadata and SDK callbacks; no QC, provider or actual-album claim.
async function fixture(){
  const user=await account(db),base=await orderFixture(db,100000,user.principal),expiry=addSeconds(3600);
  const stage=await enqueueStage(db.pool,{tenantId:user.principal.tenantId,scopeType:'ORDER',scopeId:base.orderId,name:'DELIVER',inputHash:'a'.repeat(64),deadlineAt:expiry});
  const items:DTO<'Deliverable'>[]=[];
  for(const kind of ['image','video','copy'] as const){
    const item:DTO<'Deliverable'>={deliverable_id:id('artifact'),slot_id:kind,kind,file_name:null,mime_type:null,size_bytes:null,width:null,height:null,fps:null,duration_frames:null,text:kind==='copy'?'Synthetic copy':null,sha256:'a'.repeat(64)};items.push(item);
    if(kind!=='copy')await insert(db.pool,'artifacts',{id:item.deliverable_id,tenant_id:user.principal.tenantId,order_id:base.orderId,stage_run_id:stage,slot_id:kind,
      object_key:`synthetic-no-file/${item.deliverable_id}`,sha256:item.sha256,spec_json:{},data:item,expires_at:expiry});
  }
  const pack:DTO<'Deliverables'>={order_id:base.orderId,manifest_id:id('manifest'),manifest_revision:1,expires_at:expiry,items};
  await insert(db.pool,'delivery_manifests',{id:pack.manifest_id,tenant_id:user.principal.tenantId,owner_id:user.principal.userId,order_id:base.orderId,revision:1,hash:hash(pack),data:pack,expires_at:expiry});
  await db.pool.query("UPDATE orders SET fulfillment_state='DELIVERED',delivery_expires_at=$2::timestamptz,data=data||$3::jsonb WHERE id=$1",[base.orderId,expiry,JSON.stringify({fulfillment_state:'DELIVERED',delivery_expires_at:expiry})]);
  const memory=new Map<string,unknown>(),calls:string[]=[],sent:WireRequest[]=[];let failVideo=true,lostSession=false,lostReceipt=false;
  let loseSession=false,loseSavedReceipt=false;
  const host:HostPort={platform:'alipay',storage:{get:<T>(k:string)=>structuredClone(memory.get(k)??null) as T|null,set:(k,v)=>{memory.set(k,structuredClone(v));},remove:k=>{memory.delete(k);}},
    transport:async r=>{sent.push(r);const path=new URL(r.url).pathname,result=await app.inject({method:r.method as 'GET'|'POST',url:path,headers:r.headers,...(r.body?{payload:String(r.body)}:{})});
      if(result.statusCode>=200&&result.statusCode<300){
        if(loseSession&&!lostSession&&path.endsWith('/save-sessions')){lostSession=true;throw new Error('Synthetic committed save-session ACK lost');}
        if(loseSavedReceipt&&!lostReceipt&&path.endsWith('/save-receipts')&&JSON.parse(String(r.body)).state==='SAVED'){lostReceipt=true;throw new Error('Synthetic committed receipt ACK lost');}
      }return {status:result.statusCode,data:result.json(),headers:{}};},
    login:async()=>{throw new Error('No native login in this fixture');},choosePhotos:async()=>[],upload:async()=>{},copy:async()=>{},pay:async()=>{throw new Error('No payments in album fixture');},
    download:async link=>link.deliverable_id,save:async(path,kind)=>{calls.push(path);if(kind==='video'&&failVideo)throw new ClientError('ALBUM_PERMISSION_DENIED','Synthetic native rejection');return 'SAVED';}};
  const client=new ClientSession(host,db.cfg.publicBaseUrl);client.attach({access_token:user.accessToken,user_id:user.principal.userId,token_type:'Bearer',expires_at:expiry});
  return {...user,client,pack,calls,sent,memory,allowVideo:()=>{failVideo=false;},loseSessionAck:()=>{loseSession=true;},loseReceiptAck:()=>{loseSavedReceipt=true;}};
}
it('uses one native API session for image/video selection, retries only failure and preserves a committed saved receipt after ACK loss',async()=>{
  const f=await fixture();f.loseReceiptAck();const queue=new AlbumQueue(f.client,f.pack);await queue.run({kind:'image'});await queue.run({kind:'video'});
  expect(queue.items.map(i=>i.state)).toEqual(['SAVED','FAILED']);expect(f.calls).toEqual(f.pack.items.slice(0,2).map(i=>i.deliverable_id));
  f.allowVideo();await new AlbumQueue(f.client,f.pack).run();expect(f.calls).toEqual([f.pack.items[0]!.deliverable_id,f.pack.items[1]!.deliverable_id,f.pack.items[1]!.deliverable_id]);
  expect((await db.pool.query('SELECT id FROM save_sessions WHERE order_id=$1',[f.pack.order_id])).rowCount).toBe(1);
  const rows=(await db.pool.query('SELECT r.state,r.attempt FROM save_receipts r JOIN save_sessions s ON s.id=r.save_session_id WHERE s.order_id=$1 ORDER BY r.attempt,r.deliverable_id',[f.pack.order_id])).rows;
  expect(rows.filter(r=>r.state==='SAVED')).toHaveLength(2);expect(rows.filter(r=>r.state==='FAILED')).toHaveLength(1);
  expect((await db.pool.query('SELECT id FROM budget_reservations WHERE order_id=$1',[f.pack.order_id])).rowCount).toBe(0);
  expect(f.sent.every(r=>!r.url.includes('/payment')&&!r.url.includes('/quotes'))).toBe(true);
});
it('recovers a lost committed save-session ACK with the same original key and no duplicate session or native save',async()=>{
  const f=await fixture();f.loseSessionAck();const first=new AlbumQueue(f.client,f.pack);await expect(first.run({kind:'image'})).rejects.toMatchObject({code:'NETWORK_UNKNOWN'});expect(f.calls).toEqual([]);
  await new AlbumQueue(f.client,f.pack).run({kind:'image'});expect(f.calls).toEqual([f.pack.items[0]!.deliverable_id]);
  const requests=f.sent.filter(r=>r.url.endsWith('/save-sessions'));expect(requests).toHaveLength(2);expect(requests[0]!.headers['Idempotency-Key']).toBe(requests[1]!.headers['Idempotency-Key']);expect(requests[0]!.body).toBe(requests[1]!.body);
  expect((await db.pool.query('SELECT id FROM save_sessions WHERE order_id=$1',[f.pack.order_id])).rowCount).toBe(1);
});
it('rejects foreign/copy selections and blocks revoked original delivery before another native album call',async()=>{
  const f=await fixture(),stranger=await account(db);const queue=new AlbumQueue(f.client,f.pack);await queue.run({kind:'image'});
  const request={order_id:f.pack.order_id,installation_id:'synthetic-other-install',deliverable_ids:[f.pack.items[0]!.deliverable_id]};
  const foreign=await app.inject({method:'POST',url:'/v1/p01/save-sessions',headers:{authorization:`Bearer ${stranger.accessToken}`,'idempotency-key':'foreign-album-session'},payload:request});expect(foreign.statusCode).toBe(404);
  const copy=await app.inject({method:'POST',url:'/v1/p01/save-sessions',headers:{authorization:`Bearer ${f.accessToken}`,'idempotency-key':'copy-album-session'},payload:{...request,deliverable_ids:[f.pack.items[2]!.deliverable_id]}});expect(copy.statusCode).toBe(422);
  await db.pool.query("UPDATE orders SET private=private||'{\"media_revoked\":true}'::jsonb WHERE id=$1",[f.pack.order_id]);
  await queue.run({kind:'video'});expect(f.calls).toEqual([f.pack.items[0]!.deliverable_id]);expect(queue.items[1]).toMatchObject({state:'FAILED',error:'DELIVERY_EXPIRED'});
  const order=(await db.pool.query('SELECT payment_state,fulfillment_state,amount_fen FROM orders WHERE id=$1',[f.pack.order_id])).rows[0];expect(order).toMatchObject({payment_state:'CONFIRMED',fulfillment_state:'DELIVERED'});expect(Number(order.amount_fen)).toBe(100);
});
it('never overwrites a confirmed save with a delayed failed receipt and keeps receipt ownership scoped',async()=>{
  const f=await fixture();await new AlbumQueue(f.client,f.pack).run({kind:'image'});const save=(await db.pool.query('SELECT id FROM save_sessions WHERE order_id=$1',[f.pack.order_id])).rows[0]!.id;
  const body={save_session_id:save,deliverable_id:f.pack.items[0]!.deliverable_id,attempt:1,state:'FAILED',error_code:'SYNTHETIC_LATE_FAILURE',occurred_at:iso()};
  const response=await app.inject({method:'POST',url:'/v1/p01/save-receipts',headers:{authorization:`Bearer ${f.accessToken}`,'idempotency-key':'delayed-failed-save-receipt'},payload:body});expect(response.statusCode).toBe(200);
  expect((await db.pool.query('SELECT state FROM save_receipts WHERE save_session_id=$1 AND deliverable_id=$2',[save,body.deliverable_id])).rows[0]!.state).toBe('SAVED');
  const stranger=await account(db);const denied=await app.inject({method:'POST',url:'/v1/p01/save-receipts',headers:{authorization:`Bearer ${stranger.accessToken}`,'idempotency-key':'foreign-save-receipt'},payload:body});expect(denied.statusCode).toBe(404);
});
