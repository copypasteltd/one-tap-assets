import {beforeAll,afterAll,it,expect} from 'vitest';
import sharp from 'sharp';
import {testDatabase,account,orderFixture,type TestDatabase} from '../helpers/database';
import {buildApp} from '../../src/api/app';
import {ClientSession} from '../../src/shared/client/session';
import {SupportSubmission} from '../../src/shared/client/support';
import {uploadEvidence} from '../../src/shared/client/evidence';
import {sha256,addSeconds} from '../../src/api/lib/crypto';
import type {HostPort,LocalPhoto} from '../../src/shared/platform/ports';
import type {DTO} from '../../src/shared/contracts/types';
let db:TestDatabase,app:Awaited<ReturnType<typeof buildApp>>;
beforeAll(async()=>{db=await testDatabase();app=await buildApp({cfg:db.cfg,pool:db.pool,tls:false});});
afterAll(async()=>{await app?.close();await db?.close();});
async function fixture(){
  const user=await account(db),order=await orderFixture(db,100000,user.principal),memory=new Map<string,unknown>();let lose=false,uploads=0;
  const source=(await db.pool.query('SELECT quote_id,created_at FROM orders WHERE id=$1',[order.orderId])).rows[0]!;
  await db.pool.query('UPDATE orders SET data=data||$2::jsonb WHERE id=$1',[order.orderId,JSON.stringify({quote_id:source.quote_id,created_at:source.created_at.toISOString(),job_id:null,refund_id:null,delivery_expires_at:null})]);
  const requests:{url:string;key:string|undefined;body:unknown}[]=[];
  const host:HostPort={platform:'alipay',storage:{get:<T>(k:string)=>(memory.get(k)??null) as T|null,set:(k,v)=>{memory.set(k,v);},remove:k=>{memory.delete(k);}},
    transport:async request=>{const url=new URL(request.url);requests.push({url:url.pathname,key:request.headers['Idempotency-Key'],body:request.body});
      const result=await app.inject({method:request.method as 'GET'|'POST',url:url.pathname+url.search,headers:request.headers,...(request.body?{payload:String(request.body)}:{})});
      if(lose&&result.statusCode>=200&&result.statusCode<300&&url.pathname.endsWith('/tickets')){lose=false;throw new Error('Synthetic committed support ACK loss');}
      return {status:result.statusCode,data:result.json(),headers:{}};},
    upload:async(grant,photo)=>{uploads++;const result=await app.inject({method:'PUT',url:new URL(grant.upload_url).pathname,headers:{...grant.headers,'content-type':'application/octet-stream'},payload:Buffer.from(photo.bytes)});expect(result.statusCode,result.body).toBe(204);},
    login:async()=>{throw new Error('Native login excluded');},choosePhotos:async()=>[],download:async()=>'',save:async()=> 'UNKNOWN',copy:async()=>{},pay:async()=>{throw new Error('No support payment');}};
  const client=new ClientSession(host,db.cfg.publicBaseUrl);client.attach({access_token:user.accessToken,user_id:user.principal.userId,token_type:'Bearer',expires_at:addSeconds(3600)});
  const bytes=await sharp({create:{width:1024,height:1024,channels:3,background:'#CFE9D6'}}).png().toBuffer();
  const photo:LocalPhoto={path:'synthetic-evidence.png',bytes:Uint8Array.from(bytes).buffer,width:1024,height:1024,mime:'image/png',sha256:sha256(bytes)};
  return {...user,...order,client,photo,requests,uploads:()=>uploads,loseAck:()=>{lose=true;},memory};
}
it('uploads actual PNG evidence once and recovers one original ticket after a committed ACK is lost',async()=>{
  const f=await fixture(),s=new SupportSubmission(f.client,f.orderId),value={category:'PRODUCT_ERROR' as const,message:' 合成商品文字不一致 ',photos:[f.photo]};f.loseAck();
  await expect(s.submit(value)).rejects.toMatchObject({code:'NETWORK_UNKNOWN'});const ticket=await s.submit(value);expect(f.uploads()).toBe(1);
  const tickets=await db.pool.query('SELECT data,private FROM support_tickets WHERE order_id=$1',[f.orderId]);expect(tickets.rowCount).toBe(1);expect(tickets.rows[0]!.private.message).toBe('合成商品文字不一致');
  const assetId=tickets.rows[0]!.private.attachment_asset_ids[0];expect((await db.pool.query('SELECT state,purpose,sha256 FROM assets WHERE id=$1',[assetId])).rows[0]).toMatchObject({state:'READY',purpose:'SUPPORT_EVIDENCE',sha256:f.photo.sha256});
  const posts=f.requests.filter(r=>r.url.endsWith('/tickets'));expect(posts).toHaveLength(2);expect(posts[0]!.key).toBe(posts[1]!.key);expect(posts[0]!.body).toBe(posts[1]!.body);
  const list=await f.client.api.call('listSupportTickets');const current=await f.client.api.call('getSupportTicket',{params:{ticket_id:ticket.ticket_id}});expect(list.items).toEqual([current]);
  expect(Object.keys(current).sort()).toEqual(['category','order_id','state','ticket_id','updated_at']);expect(JSON.stringify(current)).not.toContain('合成商品文字');expect(JSON.stringify([...f.memory])).not.toContain('合成商品文字');
  expect((await db.pool.query('SELECT id FROM revision_requests WHERE order_id=$1',[f.orderId])).rowCount).toBe(0);expect((await db.pool.query('SELECT id FROM refunds WHERE order_id=$1',[f.orderId])).rowCount).toBe(0);
});
it('scopes paged support history and ticket reads to the buyer, including cursor binding',async()=>{
  const f=await fixture(),stranger=await fixture();
  const tickets:DTO<'Ticket'>[]=[];for(const message of ['第一条反馈','第二条反馈'])tickets.push(await new SupportSubmission(f.client,f.orderId).submit({category:'OTHER',message,photos:[]}));
  const first=await f.client.api.call('listSupportTickets',{query:{limit:1}});expect(first.items).toHaveLength(1);expect(first.next_cursor).toBeTruthy();
  const second=await f.client.api.call('listSupportTickets',{query:{limit:1,cursor:first.next_cursor!}});expect(new Set([...first.items,...second.items].map(t=>t.ticket_id))).toEqual(new Set(tickets.map(t=>t.ticket_id)));
  expect((await stranger.client.api.call('listSupportTickets')).items).toEqual([]);
  await expect(stranger.client.api.call('getSupportTicket',{params:{ticket_id:tickets[0]!.ticket_id}})).rejects.toMatchObject({status:404});
  await expect(stranger.client.api.call('listSupportTickets',{query:{cursor:first.next_cursor!}})).rejects.toMatchObject({status:400});
  await expect(new SupportSubmission(stranger.client,f.orderId).submit({category:'OTHER',message:'Foreign order',photos:[]})).rejects.toMatchObject({status:404});
});
it('rejects wrong-purpose, foreign and revoked evidence even when an asset ID is known',async()=>{
  const f=await fixture(),stranger=await fixture();
  const wrong=await uploadEvidence(f.client,[f.photo],'wrong-purpose-evidence','RIGHTS_EVIDENCE');const foreign=await uploadEvidence(stranger.client,[stranger.photo],'foreign-evidence','SUPPORT_EVIDENCE');
  const revoked=await uploadEvidence(f.client,[f.photo],'revoked-evidence','SUPPORT_EVIDENCE');await db.pool.query("UPDATE assets SET state='DELETED' WHERE id=$1",[revoked[0]]);
  for(const ids of [wrong,foreign,revoked])await expect(f.client.api.call('createSupportTicket',{params:{order_id:f.orderId},body:{category:'OTHER',message:'Scope rejection',attachment_asset_ids:ids},key:f.client.intent('support-scope-test',{ids})})).rejects.toMatchObject({code:'EVIDENCE_SCOPE_INVALID',status:422});
  expect((await db.pool.query('SELECT id FROM support_tickets WHERE order_id=$1',[f.orderId])).rowCount).toBe(0);
});
it('reads the current stored processing state without replaying the original OPEN creation response',async()=>{
  const f=await fixture(),input={category:'SAVE' as const,message:'Synthetic state projection only',photos:[]},ticket=await new SupportSubmission(f.client,f.orderId).submit(input);
  // Explicit fixture update: this does not certify a staff processing workflow or an actual refund/repair.
  for(const state of ['PROCESSING','RESOLVED','CLOSED'] as const){await db.pool.query("UPDATE support_tickets SET state=$2,data=data||jsonb_build_object('state',$2::text,'updated_at',$3::text),updated_at=now() WHERE id=$1",[ticket.ticket_id,state,new Date().toISOString()]);
    expect((await f.client.api.call('getSupportTicket',{params:{ticket_id:ticket.ticket_id}})).state).toBe(state);expect((await f.client.api.call('listSupportTickets')).items[0]!.state).toBe(state);}
  expect((await db.pool.query('SELECT payment_state,fulfillment_state FROM orders WHERE id=$1',[f.orderId])).rows[0]).toMatchObject({payment_state:'CONFIRMED',fulfillment_state:'IN_PROGRESS'});
});
