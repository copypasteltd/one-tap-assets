import {beforeAll,afterAll,it,expect} from 'vitest';
import {plusFixture} from '../helpers/plus';
import {id,hash,addSeconds} from '../../src/api/lib/crypto';
import {insert} from '../../src/api/db/store';
import type {DTO} from '../../src/shared/contracts/types';

let f:Awaited<ReturnType<typeof plusFixture>>,link:DTO<'PlusLink'>,session:DTO<'PlusBrowserSession'>,draft:DTO<'PlusEditDraft'>,download:string;
const base='/v1/p01';
function call(path:string,method:'GET'|'POST'|'PUT'|'DELETE'='GET',payload?:Record<string,unknown>,access?:string){return f.app.inject({method,url:base+path,...(access?{headers:{authorization:`Bearer ${access}`}}:{}),...(payload===undefined?{}:{payload})});}
const native=()=>f.buyer.accessToken;
beforeAll(async()=>{f=await plusFixture();});afterAll(async()=>{await f?.close();});
it('requires explicit native approval and a separate high-entropy polling secret',async()=>{
  const created=await call('/plus/links','POST',{});expect(created.statusCode,created.body).toBe(200);link=created.json().data;
  expect(created.headers['cache-control']).toContain('no-store');
  expect((await call(`/plus/links/${link.link_id}/poll`,'POST',{poll_key:'a'.repeat(43)})).statusCode).toBe(404);
  expect((await call(`/plus/links/${link.link_id}/poll`,'POST',{poll_key:link.poll_key})).json().data).toEqual({state:'PENDING'});
  const inspected=await call('/plus/links/inspect','POST',{user_code:link.user_code},native());expect(inspected.statusCode,inspected.body).toBe(200);expect(inspected.json().data.state).toBe('PENDING');
  expect((await call('/products','GET',undefined,link.poll_key)).statusCode).toBe(401);
  const raw=(await f.db.pool.query('SELECT * FROM plus_links WHERE id=$1',[link.link_id])).rows[0];expect(JSON.stringify(raw)).not.toContain(link.poll_key);expect(JSON.stringify(raw)).not.toContain(link.user_code);
});
it('issues one fixed-expiry session for concurrent claims and retains original native identity',async()=>{
  expect((await call('/plus/links/decision','POST',{user_code:link.user_code,decision:'APPROVE'},native())).statusCode).toBe(200);
  const claims=await Promise.all([call(`/plus/links/${link.link_id}/poll`,'POST',{poll_key:link.poll_key}),call(`/plus/links/${link.link_id}/poll`,'POST',{poll_key:link.poll_key})]);
  expect(claims.map(r=>r.statusCode)).toEqual([200,200]);session=claims[0]!.json().data.session;expect(claims[1]!.json().data.session).toEqual(session);
  expect(session.user_id).toBe(f.buyer.principal.userId);expect(session.connection.platform).toBe('alipay');
  expect((await call('/plus/session','GET',undefined,session.access_token)).statusCode).toBe(200);
  expect((await call('/products','GET',undefined,session.access_token)).json().data.items.some((p:DTO<'Product'>)=>p.product_id===f.productId)).toBe(true);
  expect((await call('/plus/links/inspect','POST',{user_code:link.user_code},f.other.accessToken)).statusCode).toBe(404);
  expect((await call('/plus/sessions','GET',undefined,native())).json().data.items).toHaveLength(1);
});
it('forbids approval, financial mutations, account deletion and other-owner revocation with a Plus grant',async()=>{
  expect((await call('/plus/links/decision','POST',{user_code:link.user_code,decision:'APPROVE'},session.access_token)).statusCode).toBe(403);
  expect((await call('/products','POST',{},session.access_token)).statusCode).toBe(403);
  expect((await call('/privacy-deletions','POST',{scope:'ACCOUNT_MEDIA',acknowledge_inflight_contract:true},session.access_token)).statusCode).toBe(403);
  expect((await call(`/plus/sessions/${session.connection.session_id}`,'DELETE',undefined,f.other.accessToken)).statusCode).toBe(404);
  const before=(await f.db.pool.query('SELECT count(*) FROM orders')).rows[0].count;
  const order=await f.db.pool.query('SELECT quote_id FROM orders WHERE id=$1',[f.orderId]);
  const denied=await call('/orders','POST',{quote_id:order.rows[0].quote_id,channel:'alipay'},session.access_token);expect(denied.statusCode,denied.body).toBe(403);
  expect((await f.db.pool.query('SELECT count(*) FROM orders')).rows[0].count).toBe(before);
});
it('creates an independent owned image draft once and preserves paid manifest bytes',async()=>{
  const body={order_id:f.orderId,deliverable_id:f.artifactId};
  const created=await call('/plus/edit-drafts','POST',body,session.access_token);expect(created.statusCode,created.body).toBe(200);draft=created.json().data;
  expect((await call('/plus/edit-drafts','POST',body,session.access_token)).json().data).toEqual(draft);
  expect(draft).toMatchObject({revision:1,state:'DRAFT',fact_status:'USER_PROVIDED_UNVERIFIED',source_sha256:f.item.sha256});
  expect((await call(`/plus/edit-drafts/${draft.draft_id}`,'GET',undefined,f.other.accessToken)).statusCode).toBe(403);
  const otherLink=(await call('/plus/links','POST',{})).json().data;
  await call('/plus/links/decision','POST',{user_code:otherLink.user_code,decision:'APPROVE'},f.other.accessToken);
  const otherSession=(await call(`/plus/links/${otherLink.link_id}/poll`,'POST',{poll_key:otherLink.poll_key})).json().data.session;
  expect((await call(`/plus/edit-drafts/${draft.draft_id}`,'GET',undefined,otherSession.access_token)).statusCode).toBe(404);
  expect((await call(`/orders/${f.orderId}/deliverables`,'GET',undefined,otherSession.access_token)).statusCode).toBe(404);
  expect((await call('/plus/edit-drafts','GET',undefined,session.access_token)).json().data.items).toHaveLength(1);
  const link=await f.app.inject({method:'POST',url:`${base}/deliverables/${f.artifactId}/download-link`,headers:{authorization:`Bearer ${session.access_token}`,'idempotency-key':id('download')}});
  expect(link.statusCode,link.body).toBe(200);download=new URL(link.json().data.url).pathname+new URL(link.json().data.url).search;
  const bytes=await f.app.inject({url:download});expect(bytes.statusCode,bytes.body.slice(0,120)).toBe(200);expect(bytes.rawPayload.equals(f.png)).toBe(true);
  expect(hash((await f.db.pool.query('SELECT data FROM delivery_manifests WHERE id=$1',[f.manifestId])).rows[0].data)).toBe(hash(f.pack));
});
it('validates crop/canvas bounds and uses revision compare-and-set across editors',async()=>{
  const settings={...draft.settings,title:'新的展示标题',brand:'用户补充品牌',facts:['仅作为用户补充，未升级为识别事实']};
  const save=(value:DTO<'PlusEditSettings'>,rev=1)=>call(`/plus/edit-drafts/${draft.draft_id}`,'PUT',{expected_revision:rev,settings:value},session.access_token);
  expect((await save({...settings,crop:{x:.9,y:0,width:.5,height:1}})).statusCode).toBe(422);
  expect((await save({...settings,canvas:{width:3840,height:3840}})).statusCode).toBe(422);
  const result=await Promise.all([save(settings),save({...settings,title:'另一个编辑器的标题'})]);expect(result.map(r=>r.statusCode).sort()).toEqual([200,409]);
  draft=result.find(r=>r.statusCode===200)!.json().data;expect(draft.revision).toBe(2);
  expect((await save(draft.settings,1)).json().data.revision).toBe(2);
  expect((await f.db.pool.query('SELECT count(*) FROM plus_edit_versions WHERE draft_id=$1',[draft.draft_id])).rows[0].count).toBe('2');
  await expect(f.db.pool.query('UPDATE plus_edit_versions SET settings_hash=$1 WHERE draft_id=$2',['f'.repeat(64),draft.draft_id])).rejects.toBeTruthy();
});
it('rejects expired and denied links, and never reopens a revoked session from a poll retry',async()=>{
  const pending=(await call('/plus/links','POST',{})).json().data;
  await call('/plus/links/decision','POST',{user_code:pending.user_code,decision:'DENY'},native());
  expect((await call(`/plus/links/${pending.link_id}/poll`,'POST',{poll_key:pending.poll_key})).json().data).toEqual({state:'DENIED'});
  await f.db.pool.query("UPDATE plus_links SET expires_at=now()-interval '1 second' WHERE id=$1",[pending.link_id]);
  expect((await call(`/plus/links/${pending.link_id}/poll`,'POST',{poll_key:pending.poll_key})).statusCode).toBe(410);
  expect((await call(`/plus/sessions/${session.connection.session_id}`,'DELETE',undefined,native())).statusCode).toBe(200);
  expect((await call('/plus/session','GET',undefined,session.access_token)).statusCode).toBe(401);
  expect((await f.app.inject({url:download})).statusCode).toBe(410);
  expect((await call(`/plus/links/${link.link_id}/poll`,'POST',{poll_key:link.poll_key})).statusCode).toBe(410);
});
it('erases source-deleted drafts and versions while preserving the paid original record',async()=>{
  expect((await f.db.pool.query('SELECT count(*) FROM plus_edit_drafts')).rows[0].count).toBe('1');
  await f.db.pool.query('UPDATE product_drafts SET deleted_at=now() WHERE id=$1',[f.productId]);
  expect((await f.db.pool.query('SELECT count(*) FROM plus_edit_drafts')).rows[0].count).toBe('0');expect((await f.db.pool.query('SELECT count(*) FROM plus_edit_versions')).rows[0].count).toBe('0');
  expect((await f.db.pool.query('SELECT id FROM delivery_manifests WHERE id=$1',[f.manifestId])).rowCount).toBe(1);
});
