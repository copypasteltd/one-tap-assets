import {beforeAll,afterAll,it,expect} from 'vitest';
import {plusFixture} from '../helpers/plus';
import {issueSession,authenticate} from '../../src/api/modules/identity';
import {id,sha256} from '../../src/api/lib/crypto';
import type {DTO,Principal} from '../../src/shared/contracts/types';

// Real native PostgreSQL transactions and HTTP handlers; platform identities,
// completed order/QA and the PNG are explicit synthetic fixtures, not providers.
let f:Awaited<ReturnType<typeof plusFixture>>,peer:{accessToken:string;principal:Principal},third:typeof peer;
let request:DTO<'AccountBindingRequest'>,binding:DTO<'AccountBinding'>,grant:DTO<'PlusBrowserSession'>,web:DTO<'PlusBrowserSession'>,link:DTO<'PlusLink'>,download:string;
const base='/v1/p01';
function call(path:string,method:'GET'|'POST'|'PUT'|'DELETE'='GET',payload?:Record<string,unknown>,access?:string){
  return f.app.inject({method,url:base+path,...(access?{headers:{authorization:`Bearer ${access}`,'idempotency-key':id('bindingcheck')}}:{}),...(payload===undefined?{}:{payload})});
}
async function douyin(){const session=await issueSession(f.db.pool,{platform:'douyin',appId:'dev-douyin',subjectId:id('bindingpeer')});return{accessToken:session.access_token,principal:await authenticate(f.db.pool,`Bearer ${session.access_token}`,f.cfg)};}
async function boundRequest(){
  const start=await call('/account-bindings/requests','POST',{},f.buyer.accessToken);expect(start.statusCode,start.body).toBe(200);
  const request=start.json().data as DTO<'AccountBindingRequest'>;
  const claim=await call('/account-bindings/claim','POST',{user_code:request.user_code},peer.accessToken);expect(claim.statusCode,claim.body).toBe(200);
  const done=await call(`/account-bindings/requests/${request.request_id}/decision`,'POST',{decision:'CONFIRM',verification_code:claim.json().data.verification_code},f.buyer.accessToken);expect(done.statusCode,done.body).toBe(200);
  return done.json().data as DTO<'AccountBindingRequest'>;
}
beforeAll(async()=>{f=await plusFixture();peer=await douyin();third=await douyin();});
afterAll(async()=>{await f?.close();});

it('requires native control of both platforms, hides unrelated requests and keeps a fixed invite deadline',async()=>{
  const start=await call('/account-bindings/requests','POST',{},f.buyer.accessToken);expect(start.statusCode,start.body).toBe(200);request=start.json().data;
  const replay=(await call('/account-bindings/requests','POST',{},f.buyer.accessToken)).json().data;expect(replay).toEqual(request);
  const raw=(await f.db.pool.query('SELECT code_hash FROM account_binding_requests WHERE id=$1',[request.request_id])).rows[0];expect(raw.code_hash).toBe(sha256(request.user_code!));expect(raw.code_hash).not.toContain(request.user_code);
  expect((await call('/account-bindings/inspect','POST',{user_code:request.user_code},f.other.accessToken)).statusCode).toBe(403);
  expect((await call(`/account-bindings/requests/${request.request_id}`,'GET',undefined,third.accessToken)).statusCode).toBe(404);
  const inspected=await call('/account-bindings/inspect','POST',{user_code:request.user_code},peer.accessToken);expect(inspected.statusCode,inspected.body).toBe(200);expect(inspected.json().data).toMatchObject({role:'CANDIDATE',state:'PENDING'});expect(inspected.json().data.user_code).toBeUndefined();expect(inspected.json().data.verification_code).toBeUndefined();
  expect((await call(`/orders/${f.orderId}/deliverables`,'GET',undefined,peer.accessToken)).statusCode).toBe(404);
  expect((await call(`/account-bindings/requests/${request.request_id}/decision`,'POST',{decision:'CONFIRM',verification_code:'22222222'},f.buyer.accessToken)).statusCode).toBe(409);
});
it('grants no access on claim and requires the origin to verify the peer code; concurrent confirmation creates one binding',async()=>{
  const claim=await call('/account-bindings/claim','POST',{user_code:request.user_code},peer.accessToken);expect(claim.statusCode,claim.body).toBe(200);
  const claimed=claim.json().data as DTO<'AccountBindingRequest'>;expect(claimed.role).toBe('PEER');expect(claimed.verification_code).toHaveLength(8);
  const origin=(await call(`/account-bindings/requests/${request.request_id}`,'GET',undefined,f.buyer.accessToken)).json().data;expect(origin.verification_code).toBe(claimed.verification_code);
  expect((await call('/account-bindings','GET',undefined,peer.accessToken)).json().data.items).toEqual([]);
  expect((await call('/account-bindings/claim','POST',{user_code:request.user_code},third.accessToken)).statusCode).toBe(404);
  expect((await call(`/account-bindings/requests/${request.request_id}/decision`,'POST',{decision:'CONFIRM',verification_code:claimed.verification_code},peer.accessToken)).statusCode).toBe(403);
  const wrong=claimed.verification_code==='22222222'?'33333333':'22222222';
  expect((await call(`/account-bindings/requests/${request.request_id}/decision`,'POST',{decision:'CONFIRM',verification_code:wrong},f.buyer.accessToken)).statusCode).toBe(422);
  const decisions=await Promise.all([1,2].map(()=>call(`/account-bindings/requests/${request.request_id}/decision`,'POST',{decision:'CONFIRM',verification_code:claimed.verification_code},f.buyer.accessToken)));
  for(const result of decisions)expect(result.statusCode,result.body).toBe(200);
  expect(decisions[0]!.json().data.binding_id).toBe(decisions[1]!.json().data.binding_id);request=decisions[0]!.json().data;
  binding=(await call('/account-bindings','GET',undefined,peer.accessToken)).json().data.items[0];expect(binding.state).toBe('ACTIVE');expect(binding.peer_platform).toBe('alipay');
  expect((await call('/account-bindings/requests','POST',{},f.buyer.accessToken)).statusCode).toBe(409);
  const outsider=(await call('/account-bindings/requests','POST',{},f.other.accessToken)).json().data;
  expect((await call('/account-bindings/claim','POST',{user_code:outsider.user_code},peer.accessToken)).statusCode).toBe(409);
});
it('shares real project and PNG reads with a short isolated grant, while ownership and all payment mutations stay in the original channel',async()=>{
  expect((await call(`/account-bindings/${binding.binding_id}/project-session`,'POST',{},third.accessToken)).statusCode).toBe(404);
  const result=await call(`/account-bindings/${binding.binding_id}/project-session`,'POST',{},peer.accessToken);expect(result.statusCode,result.body).toBe(200);grant=result.json().data;
  expect(grant.user_id).toBe(f.buyer.principal.userId);expect(grant.connection).toMatchObject({account_binding_id:binding.binding_id,platform:'alipay',can_prepare_render_plans:false,can_prepare_video_render_plans:false});expect(Date.parse(grant.expires_at)-Date.now()).toBeLessThanOrEqual(900000);
  expect((await call('/products','GET',undefined,grant.access_token)).json().data.items.some((value:DTO<'Product'>)=>value.product_id===f.productId)).toBe(true);
  expect((await call(`/orders/${f.orderId}/deliverables`,'GET',undefined,grant.access_token)).json().data).toEqual(f.pack);
  const url=await call(`/deliverables/${f.artifactId}/download-link`,'POST',{},grant.access_token);expect(url.statusCode,url.body).toBe(200);const parsed=new URL(url.json().data.url);download=parsed.pathname+parsed.search;
  const bytes=await f.app.inject({url:download});expect(bytes.statusCode).toBe(200);expect(bytes.rawPayload.equals(f.png)).toBe(true);
  const original=(await f.db.pool.query('SELECT tenant_id,owner_id,channel,app_id,subject_id,quote_id FROM orders WHERE id=$1',[f.orderId])).rows[0];
  expect((await call('/orders','POST',{quote_id:original.quote_id,channel:'douyin'},grant.access_token)).statusCode).toBe(403);
  expect((await call('/account-bindings/requests','POST',{},grant.access_token)).statusCode).toBe(403);
  expect((await call(`/orders/${f.orderId}`,'GET',undefined,peer.accessToken)).statusCode).toBe(404);
  expect((await call(`/orders/${f.orderId}`,'GET',undefined,f.buyer.accessToken)).statusCode).toBe(200);
  expect(original).toMatchObject({tenant_id:f.buyer.principal.tenantId,owner_id:f.buyer.principal.userId,channel:'alipay',app_id:'dev-alipay',subject_id:f.buyer.principal.subjectId});
  expect((await f.db.pool.query('SELECT tenant_id,owner_id,channel,app_id,subject_id,quote_id FROM orders WHERE id=$1',[f.orderId])).rows[0]).toEqual(original);
});
it('lets the bound native account explicitly choose the peer source for Plus and revoke its sponsored connection',async()=>{
  link=(await call('/plus/links','POST',{})).json().data;
  const approved=await call('/plus/links/decision','POST',{user_code:link.user_code,decision:'APPROVE',account_binding_id:binding.binding_id},peer.accessToken);expect(approved.statusCode,approved.body).toBe(200);expect(approved.json().data).toMatchObject({account_binding_id:binding.binding_id,source_platform:'alipay'});
  const polls=await Promise.all([1,2].map(()=>call(`/plus/links/${link.link_id}/poll`,'POST',{poll_key:link.poll_key})));
  for(const result of polls)expect(result.statusCode,result.body).toBe(200);
  web=polls[0]!.json().data.session;expect(polls[1]!.json().data.session).toEqual(web);expect(web.user_id).toBe(f.buyer.principal.userId);
  const draft=await call('/plus/edit-drafts','POST',{order_id:f.orderId,deliverable_id:f.artifactId},web.access_token);expect(draft.statusCode,draft.body).toBe(200);expect(draft.json().data.source_sha256).toBe(f.item.sha256);
  expect((await call('/plus/sessions','GET',undefined,peer.accessToken)).json().data.items.some((value:DTO<'PlusSessionInfo'>)=>value.session_id===web.connection.session_id)).toBe(true);
  expect((await call(`/plus/sessions/${web.connection.session_id}`,'DELETE',undefined,third.accessToken)).statusCode).toBe(404);
  expect((await call(`/plus/sessions/${web.connection.session_id}`,'DELETE',undefined,peer.accessToken)).statusCode).toBe(200);
  expect((await call('/plus/session','GET',undefined,web.access_token)).statusCode).toBe(401);
  expect((await call(`/plus/links/${link.link_id}/poll`,'POST',{poll_key:link.poll_key})).statusCode).toBe(410);
  link=(await call('/plus/links','POST',{})).json().data;
  expect((await call('/plus/links/decision','POST',{user_code:link.user_code,decision:'APPROVE',account_binding_id:binding.binding_id},peer.accessToken)).statusCode).toBe(200);
  web=(await call(`/plus/links/${link.link_id}/poll`,'POST',{poll_key:link.poll_key})).json().data.session;
});
it('revokes shared sessions and previously signed downloads from either end; rebinding cannot revive them or the old poll',async()=>{
  expect((await call(`/account-bindings/${binding.binding_id}`,'DELETE',undefined,third.accessToken)).statusCode).toBe(404);
  const removed=await call(`/account-bindings/${binding.binding_id}`,'DELETE',undefined,peer.accessToken);expect(removed.statusCode,removed.body).toBe(200);expect(removed.json().data.state).toBe('REVOKED');
  for(const session of [grant,web])expect((await call('/plus/session','GET',undefined,session.access_token)).statusCode).toBe(401);
  expect((await f.app.inject({url:download})).statusCode).toBe(410);
  expect((await call(`/plus/links/${link.link_id}/poll`,'POST',{poll_key:link.poll_key})).statusCode).toBe(410);
  expect((await call(`/account-bindings/requests/${request.request_id}/decision`,'POST',{decision:'CONFIRM',verification_code:request.verification_code},f.buyer.accessToken)).statusCode).toBe(410);
  const replacement=await boundRequest();expect(replacement.binding_id).not.toBe(binding.binding_id);
  expect((await f.app.inject({url:download})).statusCode).toBe(410);expect((await call('/plus/session','GET',undefined,grant.access_token)).statusCode).toBe(401);
  const reverse=(await call(`/account-bindings/${replacement.binding_id}/project-session`,'POST',{},f.buyer.accessToken)).json().data as DTO<'PlusBrowserSession'>;
  expect(reverse.connection.platform).toBe('douyin');
  expect((await call(`/account-bindings/${replacement.binding_id}`,'DELETE',undefined,f.buyer.accessToken)).statusCode).toBe(200);
  expect((await call('/plus/session','GET',undefined,reverse.access_token)).statusCode).toBe(401);
  await expect(f.db.pool.query('UPDATE account_bindings SET revoked_at=NULL WHERE id=$1',[replacement.binding_id])).rejects.toBeTruthy();
  expect((await call(`/orders/${f.orderId}`,'GET',undefined,f.buyer.accessToken)).statusCode).toBe(200);
});
it('rejects expired invites and irreversible request rewrites, and supports origin cancellation and peer rejection',async()=>{
  const first=(await call('/account-bindings/requests','POST',{},f.buyer.accessToken)).json().data as DTO<'AccountBindingRequest'>;
  await expect(f.db.pool.query("UPDATE account_binding_requests SET expires_at=expires_at+interval '1 minute' WHERE id=$1",[first.request_id])).rejects.toBeTruthy();
  await f.db.pool.query("UPDATE account_binding_requests SET expires_at=now()-interval '1 second' WHERE id=$1",[first.request_id]);
  expect((await call('/account-bindings/claim','POST',{user_code:first.user_code},peer.accessToken)).statusCode).toBe(410);
  const next=(await call('/account-bindings/requests','POST',{},f.buyer.accessToken)).json().data as DTO<'AccountBindingRequest'>;expect(next.request_id).not.toBe(first.request_id);
  expect((await call(`/account-bindings/requests/${next.request_id}/decision`,'POST',{decision:'CANCEL'},f.buyer.accessToken)).json().data.state).toBe('CANCELLED');
  expect((await call('/account-bindings/claim','POST',{user_code:next.user_code},peer.accessToken)).statusCode).toBe(409);
  const pending=(await call('/account-bindings/requests','POST',{},f.buyer.accessToken)).json().data as DTO<'AccountBindingRequest'>;
  expect((await call('/account-bindings/claim','POST',{user_code:pending.user_code},peer.accessToken)).statusCode).toBe(200);
  expect((await call(`/account-bindings/requests/${pending.request_id}/decision`,'POST',{decision:'REJECT'},peer.accessToken)).json().data.state).toBe('REJECTED');
  await expect(f.db.pool.query("UPDATE account_binding_requests SET state='PENDING',peer_identity_id=NULL WHERE id=$1",[pending.request_id])).rejects.toBeTruthy();
});
