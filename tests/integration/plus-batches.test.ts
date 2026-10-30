import {beforeAll,afterAll,it,expect} from 'vitest';
import sharp from 'sharp';
import {plusBatchFixture} from '../helpers/plus-batches';
import {id,hash,sha256} from '../../src/api/lib/crypto';
import type {DTO} from '../../src/shared/contracts/types';

let f:Awaited<ReturnType<typeof plusBatchFixture>>,session:DTO<'PlusBrowserSession'>,batch:DTO<'PlusBatch'>,body:DTO<'PlusBatchCreateRequest'>;
const drafts:DTO<'PlusEditDraft'>[]=[],native=()=>f.buyer.accessToken,access=()=>session.access_token;
beforeAll(async()=>{f=await plusBatchFixture();});afterAll(async()=>{await f?.close();});
it('requires explicit phone permission, rejects duplicate selection and isolates a stale third product',async()=>{
  const old=await f.connect();
  for(const [index,parent] of f.parents.entries()){
    const created=await f.call('/plus/edit-drafts','POST',{order_id:parent.orderId,deliverable_id:parent.artifactId},old.access_token);expect(created.statusCode,created.body).toBe(200);
    const d=created.json().data as DTO<'PlusEditDraft'>;
    const saved=await f.call(`/plus/edit-drafts/${d.draft_id}`,'PUT',{expected_revision:1,settings:{...d.settings,title:['蓝色随行杯','暖橙收纳罐','浅绿整理盒'][index],canvas:{width:1080,height:1440}}},old.access_token);expect(saved.statusCode,saved.body).toBe(200);drafts.push(saved.json().data);
  }
  body={request_key:id('synthetic_batch_intent'),items:drafts.map((draft,index)=>({draft_id:draft.draft_id,expected_revision:index===2?1:draft.revision,variant_id:'minimal-clean.photo-layout',variant_version:'3.1.0'}))};
  expect((await f.call('/plus/render-batches','POST',body,old.access_token)).statusCode).toBe(403);
  expect((await f.call('/plus/render-batches','POST',body,native())).statusCode).toBe(403);
  session=await f.connect(true);
  const duplicate=await f.call('/plus/render-batches','POST',{...body,items:[body.items[0],{...body.items[0],expected_revision:1}]},access());expect(duplicate.statusCode,duplicate.body).toBe(422);
  const created=await f.call('/plus/render-batches','POST',body,access());expect(created.statusCode,created.body).toBe(200);batch=created.json().data;
  expect(batch).toMatchObject({item_count:3,prepared_count:2,preparation_failed_count:1,removed_count:0});
  expect(batch.items.map(item=>item.state)).toEqual(['PREPARED','PREPARED','PREPARATION_FAILED']);
  expect(batch.items[2]!.failure?.code).toBe('PLUS_DRAFT_CONFLICT');
  expect(batch.items[0]!.render!.source_order_id).not.toBe(batch.items[1]!.render!.source_order_id);
  expect((await f.db.pool.query("SELECT id FROM stage_runs WHERE stage_name='PLAN' AND state='READY'")).rowCount).toBe(2);
});
it('replays the same intent without new plans, rejects changed intent and scopes all reads and financial writes',async()=>{
  const retry=await f.call('/plus/render-batches','POST',body,access());expect(retry.statusCode,retry.body).toBe(200);expect(retry.json().data.batch_id).toBe(batch.batch_id);
  expect((await f.call('/plus/render-batches','POST',{...body,items:body.items.slice(0,2)},access())).statusCode).toBe(409);
  expect((await f.db.pool.query('SELECT id FROM plus_render_plans')).rowCount).toBe(2);
  const list=await f.call('/plus/render-batches?limit=1','GET',undefined,native());expect(list.statusCode,list.body).toBe(200);expect(list.json().data.items[0].batch_id).toBe(batch.batch_id);
  expect((await f.call(`/plus/render-batches/${batch.batch_id}`,'GET',undefined,f.other.accessToken)).statusCode).toBe(404);
  expect((await f.call('/plus/render-batches','GET',undefined,f.other.accessToken)).json().data.items).toEqual([]);
  expect((await f.call('/quotes','POST',{plan_id:batch.items[0]!.render!.plan.plan_id,plan_hash:'a'.repeat(64)},access())).statusCode).toBe(403);
  const foreign=await f.call('/plus/render-batches','POST',{request_key:id('synthetic_foreign'),items:[{...body.items[0],draft_id:'plusdraft_unknown_other_owner'},body.items[1]]},access());
  expect(foreign.statusCode,foreign.body).toBe(200);expect(foreign.json().data).toMatchObject({prepared_count:1,preparation_failed_count:1});
  expect((await f.db.pool.query('SELECT id FROM plus_render_plans')).rowCount).toBe(2);
});
it('delivers one paid product through actual PNG and both reviews while its sibling remains independently unpaid',async()=>{
  await f.step('PLAN');await f.step('PLAN');
  const read=await f.call(`/plus/render-batches/${batch.batch_id}`,'GET',undefined,access());expect(read.statusCode,read.body).toBe(200);batch=read.json().data;
  const orders:DTO<'Order'>[]=[];
  for(const item of batch.items.slice(0,2)){
    const render=item.render!;expect(render.plan.state).toBe('READY');
    const quote=await f.call('/quotes','POST',{plan_id:render.plan.plan_id,plan_hash:render.plan.plan_hash},native());expect(quote.statusCode,quote.body).toBe(201);expect(quote.json().data.amount_fen).toBe(200);
    const order=await f.call('/orders','POST',{quote_id:quote.json().data.quote_id,channel:'alipay'},native());expect(order.statusCode,order.body).toBe(201);orders.push(order.json().data);
  }
  expect(orders[0]!.order_id).not.toBe(orders[1]!.order_id);await f.pay(orders[0]!);
  for(const name of ['PRODUCTION','POST','QC','REVIEW_FACTS','REVIEW_STYLE','DELIVER'] as const)await f.step(name);
  const final=await f.call(`/plus/render-batches/${batch.batch_id}`,'GET',undefined,access());expect(final.statusCode,final.body).toBe(200);batch=final.json().data;
  expect(batch.items[0]!.render!.order!.fulfillment_state).toBe('DELIVERED');expect(batch.items[1]!.render!.order).toMatchObject({payment_state:'CREATED',fulfillment_state:'NOT_STARTED'});
  const delivered=await f.call(`/orders/${orders[0]!.order_id}/deliverables`,'GET',undefined,access());expect(delivered.statusCode,delivered.body).toBe(200);
  const pack=delivered.json().data as DTO<'Deliverables'>,image=pack.items.find(item=>item.kind==='image')!;
  const object=(await f.db.pool.query('SELECT object_key FROM artifacts WHERE id=$1',[image.deliverable_id])).rows[0];const bytes=await f.store.get(object.object_key);
  expect(sha256(bytes)).toBe(image.sha256);expect(await sharp(bytes).metadata()).toMatchObject({format:'png',width:1080,height:1440});
  expect((await f.db.pool.query("SELECT id FROM agent_instances WHERE state='ACTIVE'")).rowCount).toBe(0);expect(f.images.filter(count=>count>0)).toHaveLength(2);expect(f.launcher.launches).toBe(6);
  for(const parent of f.parents){const original=await f.call(`/orders/${parent.orderId}/deliverables`,'GET',undefined,native());expect(original.statusCode,original.body).toBe(200);expect(hash(original.json().data)).toBe(hash(parent.pack));}
  expect(JSON.stringify(batch)).not.toContain('source_object_key');
});
it('redacts deleted product slots even on idempotent replay and immediately rejects revoked browser access',async()=>{
  await f.db.pool.query('UPDATE product_drafts SET deleted_at=now() WHERE id=$1',[f.parents[0]!.productId]);
  const retry=await f.call('/plus/render-batches','POST',body,access());expect(retry.statusCode,retry.body).toBe(200);
  const value=retry.json().data as DTO<'PlusBatch'>;expect(value.items[0]).toEqual({position:1,state:'SOURCE_REMOVED',input:null,render:null,failure:null});expect(value).toMatchObject({prepared_count:1,preparation_failed_count:1,removed_count:1});
  expect(JSON.stringify(value)).not.toContain(drafts[0]!.draft_id);expect((await f.db.pool.query('SELECT id FROM plus_render_batch_items WHERE product_id=$1',[f.parents[0]!.productId])).rowCount).toBe(0);
  const list=await f.call('/plus/render-batches','GET',undefined,native());expect(list.statusCode,list.body).toBe(200);expect(list.json().data.items.find((item:DTO<'PlusBatchSummary'>)=>item.batch_id===batch.batch_id).removed_count).toBe(1);
  await f.db.pool.query("UPDATE product_drafts SET expires_at=now()-interval '1 second' WHERE id=$1",[f.parents[2]!.productId]);
  const expired=await f.call('/plus/render-batches','POST',body,access());expect(expired.statusCode,expired.body).toBe(200);expect(expired.json().data).toMatchObject({prepared_count:1,preparation_failed_count:0,removed_count:2});
  expect(expired.json().data.items[2]).toEqual({position:3,state:'SOURCE_REMOVED',input:null,render:null,failure:null});
  const revoke=await f.call(`/plus/sessions/${session.connection.session_id}`,'DELETE',undefined,native());expect(revoke.statusCode,revoke.body).toBe(200);
  expect((await f.call('/plus/render-batches','POST',body,access())).statusCode).toBe(401);expect((await f.call(`/plus/render-batches/${batch.batch_id}`,'GET',undefined,access())).statusCode).toBe(401);
});
