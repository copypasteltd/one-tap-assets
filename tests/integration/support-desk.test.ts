import {beforeAll,afterAll,it,expect} from 'vitest';
import sharp from 'sharp';
import {supportDeskEnvironment} from '../helpers/support-desk';
import {SupportDeskClient} from '../../src/shared/client/support-desk';
import {sha256} from '../../src/api/lib/crypto';
import type {DTO} from '../../src/shared/contracts/types';
let env:Awaited<ReturnType<typeof supportDeskEnvironment>>;
beforeAll(async()=>{env=await supportDeskEnvironment();});afterAll(async()=>{await env?.close();});
const path=(ticket:string)=>`/v1/internal/p01/support-tickets/${ticket}`;
const process=(ticket:string,body:DTO<'SupportProcessRequest'>,key:string,token?:string)=>env.app.inject({method:'POST',url:`${path(ticket)}/process`,headers:{...env.admin(token),'idempotency-key':key},payload:body});
it('separates buyer, read, write and proof permissions and keeps queue projections private',async()=>{
  const f=await env.fixture(true);
  expect((await env.app.inject({url:path(f.ticket.ticket_id),headers:f.headers})).statusCode).toBe(401);
  expect((await env.app.inject({url:path(f.ticket.ticket_id),headers:env.admin(env.roles.write)})).statusCode).toBe(403);
  expect((await process(f.ticket.ticket_id,{action:'CLAIM',expected_revision:0},'read-denied-claim',env.roles.read)).statusCode).toBe(403);
  expect((await env.app.inject({url:`${path(f.ticket.ticket_id)}/evidence/${f.ids[0]}`,headers:env.admin(env.roles.read)})).statusCode).toBe(403);
  const queue=await env.app.inject({url:'/v1/internal/p01/support-tickets?state=OPEN',headers:env.admin(env.roles.read)});
  expect(queue.statusCode,queue.body).toBe(200);expect(queue.headers['cache-control']).toBe('no-store');expect(queue.body).not.toContain('合成反馈');expect(queue.body).not.toContain(f.ids[0]!);
  const detail=await env.app.inject({url:path(f.ticket.ticket_id),headers:env.admin(env.roles.read)});expect(detail.statusCode,detail.body).toBe(200);expect(detail.json().data.message).toContain('合成反馈');
  expect((await env.db.pool.query("SELECT id FROM audit_events WHERE target=$1 AND action='SUPPORT_DETAIL_READ'",[f.ticket.ticket_id])).rowCount).toBe(1);
});
it('recovers one lost committed claim, replies through real management API, and returns the reply only to the owner',async()=>{
  const f=await env.fixture(),requests:{key:string|null;body:string}[]=[];let lose=true;
  const desk=new SupportDeskClient(async(url,init)=>{const headers=init!.headers as Record<string,string>;requests.push({key:headers['Idempotency-Key']??null,body:String(init!.body)});
    const result=await env.app.inject({method:init!.method as 'GET'|'POST',url:String(url),headers,payload:String(init!.body)});
    if(lose&&result.statusCode===200){lose=false;throw new Error('Synthetic committed claim ACK loss');}return new Response(result.body,{status:result.statusCode,headers:{'content-type':'application/json'}});});
  desk.connect(env.roles.alpha);await expect(desk.process(f.ticket.ticket_id,{action:'CLAIM',expected_revision:0})).rejects.toMatchObject({code:'NETWORK_UNKNOWN'});expect(desk.pending).toBe(true);
  expect((await desk.retry()).revision).toBe(1);expect(requests[1]).toEqual(requests[0]);
  expect((await env.db.pool.query("SELECT id FROM audit_events WHERE target=$1 AND action='processSupportTicket'",[f.ticket.ticket_id])).rowCount).toBe(1);
  expect((await process(f.ticket.ticket_id,{action:'REPLY',expected_revision:1,message:'Other staff cannot reply'},'other-staff-reply',env.roles.beta)).statusCode).toBe(403);
  for(const [revision,action,message] of [[1,'REPLY','已接手，正在核对保存步骤。'],[2,'RESOLVE','已说明保存步骤，请返回原素材页重试。'],[3,'CLOSE',undefined]] as const){
    const response=await process(f.ticket.ticket_id,{expected_revision:revision,action,...(message?{message}:{})},`lifecycle-${revision}`);expect(response.statusCode,response.body).toBe(200);expect(response.json().data.revision).toBe(revision+1);expect(response.body).not.toContain(message??'已说明保存');}
  const publicRead=await env.app.inject({url:`/v1/p01/tickets/${f.ticket.ticket_id}`,headers:f.headers});expect(publicRead.statusCode,publicRead.body).toBe(200);
  expect(publicRead.json().data).toMatchObject({state:'CLOSED',revision:4,response:{message:'已说明保存步骤，请返回原素材页重试。'}});expect(publicRead.body).not.toContain('fixture-alpha');expect(publicRead.body).not.toContain('合成反馈');
  const history=await env.app.inject({url:'/v1/p01/tickets',headers:f.headers});expect(history.statusCode,history.body).toBe(200);expect(history.json().data.items[0].response).toEqual(publicRead.json().data.response);
  const stranger=await env.fixture();expect((await env.app.inject({url:`/v1/p01/tickets/${f.ticket.ticket_id}`,headers:stranger.headers})).statusCode).toBe(404);
  const receipts=await env.db.pool.query('SELECT response FROM management_idempotency_records WHERE target_id=$1',[f.ticket.ticket_id]);expect(JSON.stringify(receipts.rows)).not.toContain('保存步骤');
  expect((await env.db.pool.query('SELECT payment_state,fulfillment_state FROM orders WHERE id=$1',[f.orderId])).rows[0]).toMatchObject({payment_state:'CONFIRMED',fulfillment_state:'IN_PROGRESS'});
  expect((await env.db.pool.query('SELECT id FROM refunds WHERE order_id=$1 UNION ALL SELECT id FROM revision_requests WHERE order_id=$1',[f.orderId])).rowCount).toBe(0);
});
it('serializes concurrent claims and rejects stale versions, blank replies and invalid transitions',async()=>{
  const f=await env.fixture(),id=f.ticket.ticket_id;
  expect((await process(id,{action:'RESOLVE',expected_revision:0,message:'Skip claim'},'skip-claim-action')).statusCode).toBe(403);
  const race=await Promise.all([process(id,{action:'CLAIM',expected_revision:0},'claim-race-alpha'),process(id,{action:'CLAIM',expected_revision:0},'claim-race-beta',env.roles.beta)]);
  expect(race.map(r=>r.statusCode).sort()).toEqual([200,409]);const winner=race[0]!.statusCode===200?env.roles.alpha:env.roles.beta;
  expect((await process(id,{action:'CLOSE',expected_revision:1},'premature-close',winner)).statusCode).toBe(422);
  expect((await process(id,{action:'REPLY',expected_revision:1,message:'   '},'blank-support-reply',winner)).statusCode).toBe(422);
  expect((await process(id,{action:'REPLY',expected_revision:0,message:'Stale'},'stale-support-reply',winner)).statusCode).toBe(409);
  const changed=await process(id,{action:'CLAIM',expected_revision:1},'claim-race-alpha');expect(changed.statusCode).toBe(409);
  expect((await env.db.pool.query('SELECT data FROM support_tickets WHERE id=$1',[id])).rows[0].data.revision).toBe(1);
});
it('reads actual normalized proof bytes and rejects foreign, expired, wrong-purpose and changed objects',async()=>{
  const f=await env.fixture(true),other=await env.fixture(true),id=f.ticket.ticket_id,asset=f.ids[0]!;
  const read=()=>env.app.inject({url:`${path(id)}/evidence/${asset}`,headers:env.admin()});
  const first=await read();expect(first.statusCode,first.body).toBe(200);const bytes=Buffer.from(first.json().data.bytes_base64,'base64');expect(sha256(bytes)).toBe(first.json().data.sha256);expect((await sharp(bytes).metadata()).width).toBe(1024);
  expect((await env.app.inject({url:`${path(id)}/evidence/${other.ids[0]}`,headers:env.admin()})).statusCode).toBe(404);
  await env.db.pool.query("UPDATE assets SET purpose='RIGHTS_EVIDENCE' WHERE id=$1",[asset]);expect((await read()).statusCode).toBe(410);
  await env.db.pool.query("UPDATE assets SET purpose='SUPPORT_EVIDENCE',expires_at=now()-interval '1 second' WHERE id=$1",[asset]);expect((await read()).statusCode).toBe(410);
  await env.db.pool.query("UPDATE assets SET expires_at=now()+interval '1 hour' WHERE id=$1",[asset]);const key=(await env.db.pool.query('SELECT object_key FROM assets WHERE id=$1',[asset])).rows[0].object_key;
  await env.store.put(key,Buffer.from('adversarial synthetic bytes'),'image/png');expect((await read()).statusCode).toBe(503);
});
it('withdraws private correspondence and proof access immediately after the actual deletion request without restoring it on replay',async()=>{
  const f=await env.fixture(true),id=f.ticket.ticket_id;
  expect((await process(id,{action:'CLAIM',expected_revision:0},'privacy-claim-key')).statusCode).toBe(200);
  expect((await process(id,{action:'REPLY',expected_revision:1,message:'私有回复，仅供当前账户查看'},'privacy-reply-key')).statusCode).toBe(200);
  const deletion=await env.app.inject({method:'POST',url:'/v1/p01/privacy-deletions',headers:{...f.headers,'idempotency-key':'support-privacy-deletion'},payload:{scope:'ACCOUNT_MEDIA',acknowledge_inflight_contract:true}});
  expect(deletion.statusCode,deletion.body).toBe(202);
  const detail=await env.app.inject({url:path(id),headers:env.admin()});expect(detail.statusCode,detail.body).toBe(200);expect(detail.json().data).toMatchObject({summary:{content_available:false},message:null,attachment_asset_ids:[],response:null});
  const buyer=await env.app.inject({url:`/v1/p01/tickets/${id}`,headers:f.headers});expect(buyer.statusCode,buyer.body).toBe(200);expect(buyer.json().data.response).toBeUndefined();
  expect((await process(id,{action:'RESOLVE',expected_revision:2,message:'不得复活'},'privacy-after-delete')).statusCode).toBe(410);
  expect((await env.app.inject({url:`${path(id)}/evidence/${f.ids[0]}`,headers:env.admin()})).statusCode).toBe(410);
  const replay=await process(id,{action:'REPLY',expected_revision:1,message:'私有回复，仅供当前账户查看'},'privacy-reply-key');expect(replay.statusCode).toBe(200);expect(replay.body).not.toContain('私有回复');
  expect((await env.db.pool.query('SELECT data FROM support_tickets WHERE id=$1',[id])).rows[0].data.revision).toBe(2);
});
it('binds queue cursors to the staff actor and state filter',async()=>{
  await env.fixture();await env.fixture();const first=await env.app.inject({url:'/v1/internal/p01/support-tickets?state=OPEN&limit=1',headers:env.admin()});expect(first.statusCode,first.body).toBe(200);
  const point=first.json().data.next_cursor;expect(point).toBeTruthy();const suffix=`?state=OPEN&limit=1&cursor=${encodeURIComponent(point)}`;
  const second=await env.app.inject({url:`/v1/internal/p01/support-tickets${suffix}`,headers:env.admin()});expect(second.statusCode).toBe(200);expect(second.json().data.items[0].ticket_id).not.toBe(first.json().data.items[0].ticket_id);
  expect((await env.app.inject({url:`/v1/internal/p01/support-tickets${suffix}`,headers:env.admin(env.roles.beta)})).statusCode).toBe(400);
  expect((await env.app.inject({url:`/v1/internal/p01/support-tickets${suffix.replace('state=OPEN','state=PROCESSING')}`,headers:env.admin()})).statusCode).toBe(400);
});
