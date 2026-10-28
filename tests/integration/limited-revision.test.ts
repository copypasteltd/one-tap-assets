import {beforeAll,afterAll,it,expect} from 'vitest';
import type {FastifyInstance} from 'fastify';
import {testDatabase,account,orderFixture,type TestDatabase} from '../helpers/database.js';
import {mediaFixture} from '../helpers/media.js';
import {FixtureLauncher} from '../helpers/role-launcher.js';
import {syntheticSse} from '../helpers/codex.js';
import {buildApp} from '../../src/api/app.js';
import {transaction} from '../../src/api/db/pool.js';
import {id,hash} from '../../src/api/lib/crypto.js';
import {getDeliverables,requestRevision,listRevisions} from '../../src/api/modules/delivery.js';
import {issueSession} from '../../src/api/modules/identity.js';
import {requestDeletion} from '../../src/api/modules/support.js';
import type {DTO} from '../../src/shared/contracts/types.js';
import {CodexRuntimeAdapter} from '../../src/worker/codex/runtime.js';
import {MediaStageService} from '../../src/worker/codex/media-stage.js';
import {ToolConsumer,type ToolHandler} from '../../src/worker/tool-gateway/consumer.js';
import {productionTools} from '../../src/worker/tool-gateway/production-tools.js';
import {reviewTools} from '../../src/worker/tool-gateway/review-tools.js';
import {revisionTools} from '../../src/worker/tool-gateway/revision-tools.js';
import {claimStage,completeStage,heartbeatStage,failStage,type StageLease} from '../../src/worker/queue/leases.js';
import {enqueueStage} from '../../src/worker/queue/enqueue.js';
import {QualityControlService} from '../../src/worker/review/qc.js';
import {ReviewStageService} from '../../src/worker/review/stage.js';
import {PublicationService} from '../../src/worker/review/publication.js';
import {RevisionService} from '../../src/worker/revisions/service.js';
import {REVISION_STAGES} from '../../src/worker/revisions/contract.js';
import {revisionContext} from '../../src/worker/revisions/context.js';
import {candidateBytes,revisionPacket} from '../../src/worker/revisions/media.js';
import {validateRevisionReview} from '../../src/worker/revisions/review.js';
import {reserveRevisionCost,settleRevisionCost} from '../../src/worker/revisions/budget.js';
import {stopScope} from '../../src/worker/lifecycle/termination.js';
import {expireWork} from '../../src/worker/lifecycle/deadlines.js';
import {redactPrivateContent} from '../../src/worker/lifecycle/privacy-redaction.js';
import {reserve,settle} from '../../src/worker/budget/reservations.js';
import type {NativeLaunchManifest} from '../../src/worker/codex/launcher.js';
import {writePrivateObject} from '../../src/api/storage/private-objects.js';
import type {ObjectStorage} from '../../src/api/storage/storage.js';
// These remain synthetic identities, matching the explicit APP_ENV=test port.
// Each native protocol process represents a distinct restricted role identity.
class RevisionLauncher extends FixtureLauncher {
  override async launch(path:string,manifest:NativeLaunchManifest){const result=await super.launch(path,manifest);
    result.receipt.os_identity_ref=`SYNTHETIC-NOT-RESTRICTED:${manifest.run_id}`;
    result.receipt.process_ref=`${result.receipt.process_ref}:${manifest.run_id}`;return result;}
}

let db:TestDatabase;let app:FastifyInstance;let consumer:Promise<void>;let endpoint='';
type Fixture=Awaited<ReturnType<typeof mediaFixture>>;
let f:Fixture;let original:DTO<'Deliverables'>;let current:DTO<'Revision'>;let token:string;let requester:ReturnType<typeof account> extends Promise<infer T>?T:never;
let body:DTO<'RevisionRequest'>;let finalLease:StageLease;let finalCommit:(db:import('pg').PoolClient)=>Promise<void>;
let worker:RevisionService;const controller=new AbortController();
let coverFixture:Fixture;let coverParent:DTO<'Deliverables'>;let coverRequest:DTO<'RevisionRequest'>;
async function whileLease<T>(lease:StageLease,action:()=>Promise<T>):Promise<T>{
  let pending:Promise<void>|null=null;let failure:unknown;
  const timer=setInterval(()=>{
    if(pending)return;
    pending=heartbeatStage(db.pool,lease).then(ok=>{if(!ok)throw new Error('Fixture lease was lost');})
      .catch(error=>{failure=error;}).finally(()=>{pending=null;});
  },5000);
  try{
    const result=await action();clearInterval(timer);if(pending)await pending;
    if(failure)throw failure;return result;
  }finally{clearInterval(timer);if(pending)await pending;}
}
async function finish(lease:StageLease,handle:()=>Promise<(db:import('pg').PoolClient)=>Promise<void>>):Promise<void>{
  const commit=await whileLease(lease,handle);await completeStage(db.pool,lease,commit);
}
async function next(name:string):Promise<StageLease>{const lease=await claimStage(db.pool,id('worker'),[name]);expect(lease).toBeTruthy();return lease!;}
async function delivered(revisions=true):Promise<Fixture>{
  const fixture=await mediaFixture(db,{revisions});fixture.cfg.publicBaseUrl=endpoint;
  const runtime=new CodexRuntimeAdapter(db.pool,fixture.cfg,new FixtureLauncher());
  const service=new MediaStageService(db.pool,fixture.cfg,runtime);await finish(fixture.lease,()=>service.handle(fixture.lease,controller.signal));
  const post=await next('POST');await finish(post,()=>service.handle(post,controller.signal));let dependency=post.id;
  for(const name of ['QC','REVIEW_FACTS','REVIEW_STYLE','DELIVER']){
    await enqueueStage(db.pool,{tenantId:fixture.p.tenantId,scopeType:'ORDER',scopeId:fixture.orderId,name,inputHash:fixture.snapshotHash,deadlineAt:fixture.snapshot.deadline_at,jobId:fixture.lease.job_id!,dependencies:[dependency]});
    const lease=await next(name);dependency=lease.id;
    const service=name==='QC'?new QualityControlService(db.pool,fixture.cfg,fixture.store):name==='DELIVER'?new PublicationService(db.pool,fixture.cfg,fixture.store):new ReviewStageService(db.pool,fixture.cfg,runtime);
    await finish(lease,()=>service.handle(lease,controller.signal));
  }return fixture;
}
async function runRevision(fixture:Fixture,revision:DTO<'Revision'>,mode='NORMAL'):Promise<void>{
  const service=new RevisionService(db.pool,fixture.cfg,fixture.store,new CodexRuntimeAdapter(db.pool,fixture.cfg,new RevisionLauncher(mode)));
  for(const name of REVISION_STAGES){const lease=await next(name);expect(lease.scope_id).toBe(revision.revision_id);
    try{await finish(lease,()=>service.handle(lease,controller.signal));}catch(error){
      const tools=(await db.pool.query(`SELECT t.tool_name,t.state,t.data->>'error_code' AS error_code FROM agent_tool_intents t JOIN stage_runs s ON s.tenant_id=t.tenant_id AND s.id=t.stage_run_id WHERE s.scope_id=$1`,[revision.revision_id])).rows;
      const calls=(await db.pool.query("SELECT state,data->>'error_code' AS error_code FROM inference_requests WHERE scope_type='REVISION' AND scope_id=$1",[revision.revision_id])).rows;
      console.error(JSON.stringify({fixture_only:true,stage:name,tools,calls}));throw error;}
  }
}
beforeAll(async()=>{
  db=await testDatabase();const seed=await mediaFixture(db,{revisions:true});
  app=await buildApp({cfg:seed.cfg,pool:db.pool,inferenceHttp:async()=>({status:200,headers:{'content-type':'text/event-stream'},bytes:syntheticSse(seed.admission),json:()=>null})});
  await app.listen({host:'127.0.0.1',port:0});const address=app.server.address();if(!address || typeof address==='string')throw new Error('Missing fixture listener');
  endpoint=`https://localhost:${address.port}`;seed.cfg.publicBaseUrl=endpoint;
  const media=productionTools(db.pool,seed.cfg,seed.store);const review=reviewTools(db.pool,seed.cfg,seed.store);const revisions=revisionTools(db.pool,seed.cfg,seed.store);
  const dispatch:Record<string,ToolHandler>={...media,...review,persist_stage_result:(scope,...args)=>(scope.role.startsWith('REVIEW_')?review:media).persist_stage_result!(scope,...args)};
  const handlers:Record<string,ToolHandler>={};for(const name of Object.keys(dispatch))handlers[name]=(scope,...args)=>(scope.scope_type==='REVISION'?revisions:dispatch)[name]!(scope,...args);
  consumer=new ToolConsumer(db.pool,id('tools'),handlers).run(controller.signal);
  // Complete the seeded real-media fixture rather than inserting a fake delivered manifest.
  f=seed;const runtime=new CodexRuntimeAdapter(db.pool,f.cfg,new FixtureLauncher());const service=new MediaStageService(db.pool,f.cfg,runtime);
  await finish(f.lease,()=>service.handle(f.lease,controller.signal));const post=await next('POST');await finish(post,()=>service.handle(post,controller.signal));let dependency=post.id;
  for(const name of ['QC','REVIEW_FACTS','REVIEW_STYLE','DELIVER']){await enqueueStage(db.pool,{tenantId:f.p.tenantId,scopeType:'ORDER',scopeId:f.orderId,name,inputHash:f.snapshotHash,deadlineAt:f.snapshot.deadline_at,jobId:f.lease.job_id!,dependencies:[dependency]});
    const lease=await next(name);dependency=lease.id;const service=name==='QC'?new QualityControlService(db.pool,f.cfg,f.store):name==='DELIVER'?new PublicationService(db.pool,f.cfg,f.store):new ReviewStageService(db.pool,f.cfg,runtime);await finish(lease,()=>service.handle(lease,controller.signal));}
  original=await getDeliverables(db.pool,f.p,f.orderId);token=(await issueSession(db.pool,{platform:'alipay',appId:f.p.appId,subjectId:f.p.subjectId})).access_token;
  requester=await account(db);body={manifest_revision:1,kind:'DISPLAY_TEXT',display_text:`${f.contract.creative.copy}\n实拍展示，欢迎了解。`};
  worker=new RevisionService(db.pool,f.cfg,f.store,new CodexRuntimeAdapter(db.pool,f.cfg,new RevisionLauncher()));
});
afterAll(async()=>{controller.abort();await consumer;await app?.close();await db?.close();});

it('keeps the sold aftercare allowance inside the original total instead of making it an extra production budget',async()=>{
  // Accounting boundary only; this minimal order is not a media or delivery fixture.
  const accounting=await orderFixture(db,100);await db.pool.query('UPDATE orders SET private=$2::jsonb WHERE id=$1',[accounting.orderId,JSON.stringify({contract:{revision_policy:{budget_micro:40}}})]);
  const scope={tenantId:accounting.principal.tenantId,orderId:accounting.orderId};
  await expect(transaction(db.pool,tx=>reserve(tx,scope,'production-over-aftercare',61,{}))).rejects.toMatchObject({code:'BUDGET_OR_DEADLINE_EXCEEDED'});
  const hold=await transaction(db.pool,tx=>reserve(tx,scope,'production-with-aftercare',60,{}));await transaction(db.pool,tx=>settle(tx,scope.tenantId,hold,0,true));
});
it('rejects mixed fields, no-op, stale manifests, unsupported claims and foreign ownership before allocating a revision',async()=>{
  const before=(await db.pool.query('SELECT count(*) FROM revision_requests')).rows[0].count;
  const bad=await app.inject({method:'POST',url:`/v1/p01/orders/${f.orderId}/revisions`,headers:{authorization:`Bearer ${token}`,'idempotency-key':'bad-mixed-fields'},payload:{...body,cover_deliverable_id:original.items[0]!.deliverable_id}});
  expect(bad.statusCode).toBe(400);
  await expect(transaction(db.pool,tx=>requestRevision(tx,f.p,f.orderId,{...body,display_text:f.contract.creative.copy}))).rejects.toMatchObject({code:'REVISION_NO_CHANGE'});
  await expect(transaction(db.pool,tx=>requestRevision(tx,f.p,f.orderId,{...body,manifest_revision:2}))).rejects.toMatchObject({code:'MANIFEST_CHANGED'});
  await expect(transaction(db.pool,tx=>requestRevision(tx,f.p,f.orderId,{...body,display_text:'治疗疾病，保证有效，全网最低价'}))).rejects.toBeTruthy();
  await expect(transaction(db.pool,tx=>requestRevision(tx,requester.principal,f.orderId,body))).rejects.toMatchObject({status:404});
  expect((await db.pool.query('SELECT count(*) FROM revision_requests')).rows[0].count).toBe(before);
});
it('serializes concurrent claims, replays the original receipt and recovers records only for the owner',async()=>{
  const replies=await Promise.all(['revision-claim-a','revision-claim-b'].map(key=>app.inject({method:'POST',url:`/v1/p01/orders/${f.orderId}/revisions`,headers:{authorization:`Bearer ${token}`,'idempotency-key':key},payload:body})));
  expect(replies.map(r=>r.statusCode).sort()).toEqual([202,422]);const accepted=replies.find(r=>r.statusCode===202)!;current=accepted.json().data;
  const index=replies.indexOf(accepted);const replay=await app.inject({method:'POST',url:`/v1/p01/orders/${f.orderId}/revisions`,headers:{authorization:`Bearer ${token}`,'idempotency-key':index?'revision-claim-b':'revision-claim-a'},payload:body});
  expect(replay.statusCode).toBe(202);expect(replay.json().data.revision_id).toBe(current.revision_id);
  const rows=await listRevisions(db.pool,f.cfg,f.p,f.orderId,{limit:'1'});expect(rows.items[0]!.revision_id).toBe(current.revision_id);
  const privateRead=await app.inject({method:'GET',url:`/v1/p01/orders/${f.orderId}/revisions`,headers:{authorization:`Bearer ${requester.accessToken}`}});expect(privateRead.statusCode).toBe(404);
  expect((await db.pool.query('SELECT id FROM stage_runs WHERE scope_id=$1',[current.revision_id])).rowCount).toBe(5);
});
it('protects frozen inputs, deadline, policy ceiling and already published parent bytes',async()=>{
  await expect(db.pool.query("UPDATE revision_requests SET deadline_at=deadline_at+interval '1 second' WHERE id=$1",[current.revision_id])).rejects.toThrow('immutable');
  await expect(db.pool.query("UPDATE revision_requests SET private=jsonb_set(private,'{input,request,display_text}','\"changed\"') WHERE id=$1",[current.revision_id])).rejects.toThrow('immutable');
  await expect(db.pool.query('UPDATE revision_budgets SET ceiling_micro=ceiling_micro+1 WHERE order_id=$1',[f.orderId])).rejects.toThrow('immutable');
  await expect(db.pool.query("UPDATE delivery_manifests SET data=jsonb_set(data,'{manifest_revision}','2') WHERE order_id=$1",[f.orderId])).rejects.toThrow('immutable');
});
it('keeps UNKNOWN costs reserved across a failed request and settles the original intent before retry',async()=>{
  const hold=await transaction(db.pool,tx=>reserveRevisionCost(tx,f.p.tenantId,current.revision_id,'revision-unknown-cost',123,{fixture:'COUNTER_ONLY'}));
  await transaction(db.pool,tx=>settleRevisionCost(tx,f.p.tenantId,hold,null));await transaction(db.pool,tx=>stopScope(tx,{tenantId:f.p.tenantId,type:'REVISION',id:current.revision_id},'TEST_INTERRUPTED'));
  const redaction=await transaction(db.pool,tx=>redactPrivateContent(tx,{tenantId:f.p.tenantId,ownerId:f.p.userId,productIds:[f.product.product_id],orderIds:[f.orderId],assetIds:f.assetIds},true));
  expect(redaction.blockers).toContain('REVISION_BUDGET_PENDING');
  await expect(transaction(db.pool,tx=>requestRevision(tx,f.p,f.orderId,body))).rejects.toMatchObject({code:'REVISION_COST_UNRESOLVED'});
  await transaction(db.pool,tx=>settleRevisionCost(tx,f.p.tenantId,hold,7));await transaction(db.pool,tx=>settleRevisionCost(tx,f.p.tenantId,hold,7));
  current=await transaction(db.pool,tx=>requestRevision(tx,f.p,f.orderId,body));
  const account=(await db.pool.query('SELECT * FROM revision_budgets WHERE order_id=$1',[f.orderId])).rows[0];expect(Number(account.spent_micro)).toBe(7);expect(Number(account.reserved_micro)).toBe(0);
  expect((await db.pool.query('SELECT id FROM revision_budgets WHERE order_id=$1',[f.orderId])).rowCount).toBe(1);
});
it('changes actual copy bytes and recovers a completed POST checkpoint without purchasing a second inference',async()=>{
  const lease=await next('REVISION');const commit=await whileLease(lease,()=>worker.handle(lease,controller.signal));
  const c=await revisionContext(db.pool,f.p.tenantId,current.revision_id);const item=(c.row.private.candidate as {items:DTO<'Deliverable'>[]}).items.find(i=>i.kind==='copy')!;
  expect(item.deliverable_id).not.toBe(original.items.find(i=>i.kind==='copy')!.deliverable_id);expect((await candidateBytes(db.pool,f.store,c,item)).toString('utf8')).toBe(body.display_text);
  expect((await getDeliverables(db.pool,f.p,f.orderId)).manifest_revision).toBe(1);
  await db.pool.query("UPDATE stage_runs SET lease_expires_at=now()-interval '1 second' WHERE id=$1",[lease.id]);const takeover=await next('REVISION');expect(takeover.id).toBe(lease.id);
  await finish(takeover,()=>worker.handle(takeover,controller.signal));await expect(completeStage(db.pool,lease,commit!)).rejects.toMatchObject({code:'LEASE_LOST'});
  expect((await db.pool.query("SELECT id FROM inference_requests WHERE scope_type='REVISION' AND scope_id=$1",[current.revision_id])).rowCount).toBe(1);
});
it('checks actual candidate bytes and seals a new packet with all original and video pictures',async()=>{
  const lease=await next('REVISION_QC');const c=await revisionContext(db.pool,f.p.tenantId,current.revision_id);const artifact=(await db.pool.query("SELECT * FROM artifacts WHERE order_id=$1 AND spec_json->>'revision_id'=$2",[f.orderId,current.revision_id])).rows[0];
  const bytes=await f.store.get(artifact.object_key);await f.store.put(artifact.object_key,Buffer.from('tampered'),'text/plain');
  try{await expect(worker.handle(lease,controller.signal)).rejects.toMatchObject({code:'ARTIFACT_HASH_MISMATCH'});}finally{await f.store.put(artifact.object_key,bytes,'text/plain');}
  await finish(lease,()=>worker.handle(lease,controller.signal));const sealed=revisionPacket(await revisionContext(db.pool,f.p.tenantId,current.revision_id));
  expect(sealed.images.length).toBeGreaterThan(f.assetIds.length);expect(sealed.parent_manifest_hash).toBe(hash(original));expect(sealed.packet_hash).not.toBe(sealed.source_packet_hash);
});
it('rejects stale reports and preserves the original delivery when the independent style review fails',async()=>{
  const facts=await next('REVISION_REVIEW_FACTS');await finish(facts,()=>worker.handle(facts,controller.signal));
  const c=await revisionContext(db.pool,f.p.tenantId,current.revision_id);const saved=(c.row.private.review_reports as Record<string,{run_id:string;report:Record<string,unknown>}>).REVIEW_FACTS!;
  await expect(validateRevisionReview(db.pool,f.cfg,c,saved.run_id,{...saved.report,packet_hash:'0'.repeat(64)})).rejects.toMatchObject({code:'REVISION_REVIEW_INCOMPLETE'});
  const style=await next('REVISION_REVIEW_STYLE');const rejected=new RevisionService(db.pool,f.cfg,f.store,new CodexRuntimeAdapter(db.pool,f.cfg,new RevisionLauncher('REVIEW_FAIL')));
  await expect(finish(style,()=>rejected.handle(style,controller.signal))).rejects.toMatchObject({code:'REVISION_REVIEW_NOT_PASSED'});await failStage(db.pool,style,'REVISION_REVIEW_NOT_PASSED');
  const ended=(await db.pool.query('SELECT * FROM revision_requests WHERE id=$1',[current.revision_id])).rows[0];expect(ended.state).toBe('FAILED');expect(ended.consumes_user_allowance).toBe(false);
  expect(await getDeliverables(db.pool,f.p,f.orderId)).toEqual(original);expect((await db.pool.query('SELECT id FROM refunds WHERE order_id=$1',[f.orderId])).rowCount).toBe(0);
  expect((await db.pool.query('SELECT delete_requested FROM private_object_writes WHERE revision_id=$1',[current.revision_id])).rows.every(r=>r.delete_requested)).toBe(true);
});
it('retries within the original shared budget and requires two fresh reviews before preparing atomic publication',async()=>{
  const spent=Number((await db.pool.query('SELECT spent_micro FROM revision_budgets WHERE order_id=$1',[f.orderId])).rows[0].spent_micro);
  current=await transaction(db.pool,tx=>requestRevision(tx,f.p,f.orderId,body));expect(Number((await db.pool.query('SELECT spent_micro FROM revision_budgets WHERE order_id=$1',[f.orderId])).rows[0].spent_micro)).toBe(spent);
  for(const name of REVISION_STAGES.slice(0,-1)){const lease=await next(name);await finish(lease,()=>worker.handle(lease,controller.signal));}
  finalLease=await next('REVISION_COMPLETE');finalCommit=await worker.handle(finalLease,controller.signal);
  const c=await revisionContext(db.pool,f.p.tenantId,current.revision_id);const reports=c.row.private.review_reports as Record<string,{run_id:string}>;
  expect(reports.REVIEW_FACTS!.run_id).not.toBe(reports.REVIEW_STYLE!.run_id);expect((await getDeliverables(db.pool,f.p,f.orderId)).manifest_revision).toBe(1);
});
it('rolls back expired final fences and byte tampering before atomically publishing the linked new version',async()=>{
  const artifact=(await db.pool.query("SELECT * FROM artifacts WHERE spec_json->>'revision_id'=$1",[current.revision_id])).rows[0];const bytes=await f.store.get(artifact.object_key);
  await f.store.put(artifact.object_key,Buffer.from('changed-after-preflight'),'text/plain');try{await expect(completeStage(db.pool,finalLease,finalCommit)).rejects.toMatchObject({code:'ARTIFACT_HASH_MISMATCH'});}finally{await f.store.put(artifact.object_key,bytes,'text/plain');}
  await expect(completeStage(db.pool,finalLease,async tx=>{await finalCommit(tx);await tx.query("UPDATE stage_runs SET lease_expires_at=clock_timestamp()-interval '1 second' WHERE id=$1",[finalLease.id]);})).rejects.toMatchObject({code:'LEASE_LOST'});
  expect((await getDeliverables(db.pool,f.p,f.orderId)).manifest_revision).toBe(1);await completeStage(db.pool,finalLease,finalCommit);
  const pack=await getDeliverables(db.pool,f.p,f.orderId);expect(pack.manifest_revision).toBe(2);expect(pack.parent_manifest_id).toBe(original.manifest_id);expect(pack.expires_at).toBe(original.expires_at);expect(pack.items.find(i=>i.kind==='copy')!.text).toBe(body.display_text);
  expect((await db.pool.query('SELECT data FROM delivery_manifests WHERE id=$1',[original.manifest_id])).rows[0].data).toEqual(original);
  expect((await db.pool.query('SELECT deadline_at FROM orders WHERE id=$1',[f.orderId])).rows[0].deadline_at.toISOString()).toBe(f.snapshot.deadline_at);
  await expect(transaction(db.pool,tx=>requestRevision(tx,f.p,f.orderId,{...body,manifest_revision:2,display_text:'另一次修改'}))).rejects.toMatchObject({code:'REVISION_ALLOWANCE_USED'});
});
it('expires revision work without changing the original delivery deadline or asking for a refund',async()=>{
  const fixture=await delivered();const parent=await getDeliverables(db.pool,fixture.p,fixture.orderId);const cover=parent.items.filter(i=>i.kind==='image')[1]!.deliverable_id;
  coverFixture=fixture;coverParent=parent;coverRequest={kind:'COVER',manifest_revision:1,cover_deliverable_id:cover};
  const abandoned=await transaction(db.pool,tx=>requestRevision(tx,fixture.p,fixture.orderId,coverRequest));
  await db.pool.query("UPDATE stage_runs SET deadline_at=now()-interval '1 second' WHERE scope_id=$1 AND stage_name='REVISION'",[abandoned.revision_id]);await expireWork(db.pool);
  expect((await db.pool.query('SELECT state,consumes_user_allowance FROM revision_requests WHERE id=$1',[abandoned.revision_id])).rows[0]).toMatchObject({state:'FAILED',consumes_user_allowance:false});
  expect((await db.pool.query('SELECT deadline_at FROM orders WHERE id=$1',[fixture.orderId])).rows[0].deadline_at.toISOString()).toBe(fixture.snapshot.deadline_at);
  expect((await db.pool.query('SELECT id FROM refunds WHERE order_id=$1',[fixture.orderId])).rowCount).toBe(0);
});
it('reclaims a late object PUT when revision permission ends and never issues a second PUT for the same key',async()=>{
  const fixture=coverFixture;const revision=await transaction(db.pool,tx=>requestRevision(tx,fixture.p,fixture.orderId,coverRequest));
  const artifact=(await db.pool.query('SELECT object_key FROM artifacts WHERE id=$1',[coverParent.items.find(i=>i.kind==='image')!.deliverable_id])).rows[0];const bytes=await fixture.store.get(artifact.object_key);let puts=0;
  const intercepted:ObjectStorage={get:(...args)=>fixture.store.get(...args),delete:key=>fixture.store.delete(key),exists:key=>fixture.store.exists(key),
    put:async(key,body,mime)=>{puts++;await fixture.store.put(key,body,mime);await transaction(db.pool,tx=>stopScope(tx,{tenantId:fixture.p.tenantId,type:'REVISION',id:revision.revision_id},'TEST_LATE_PUT'));}};
  const scope={tenantId:fixture.p.tenantId,ownerId:fixture.p.userId,productId:fixture.product.product_id,orderId:fixture.orderId,revisionId:revision.revision_id,kind:'MEDIA' as const,expiresAt:coverParent.expires_at};
  const key=`${fixture.p.tenantId}/revisions/${revision.revision_id}/late.png`;
  await expect(writePrivateObject(db.pool,intercepted,scope,key,bytes,'image/png')).rejects.toMatchObject({code:'PRIVATE_OBJECT_REVOKED'});
  expect((await db.pool.query('SELECT state,delete_requested FROM private_object_writes WHERE object_key=$1',[key])).rows[0]).toMatchObject({state:'STORED',delete_requested:true});
  await expect(writePrivateObject(db.pool,intercepted,scope,key,bytes,'image/png')).rejects.toMatchObject({code:'PRIVATE_OBJECT_REVOKED'});expect(puts).toBe(1);
  expect(await getDeliverables(db.pool,fixture.p,fixture.orderId)).toEqual(coverParent);
});
it('completes a cover change using existing image bytes and retains the original expiry',async()=>{
  const fixture=coverFixture;const revision=await transaction(db.pool,tx=>requestRevision(tx,fixture.p,fixture.orderId,coverRequest));await runRevision(fixture,revision);
  const updated=await getDeliverables(db.pool,fixture.p,fixture.orderId);expect(updated.cover_deliverable_id).toBe(coverRequest.cover_deliverable_id);expect(updated.items).toEqual(coverParent.items);expect(updated.expires_at).toBe(coverParent.expires_at);
});
it('publishes a reordered full manifest without changing any image, video or copy file',async()=>{
  const fixture=await delivered();const parent=await getDeliverables(db.pool,fixture.p,fixture.orderId);const ids=parent.items.map(i=>i.deliverable_id).reverse();
  const revision=await transaction(db.pool,tx=>requestRevision(tx,fixture.p,fixture.orderId,{kind:'ALLOWED_ORDER',manifest_revision:1,ordered_deliverable_ids:ids}));await runRevision(fixture,revision);
  const updated=await getDeliverables(db.pool,fixture.p,fixture.orderId);expect(updated.items.map(i=>i.deliverable_id)).toEqual(ids);expect([...updated.items].sort((a,b)=>a.slot_id.localeCompare(b.slot_id))).toEqual([...parent.items].sort((a,b)=>a.slot_id.localeCompare(b.slot_id)));
});
it('includes all revision roles in privacy scope and withdraws delivery before physical erasure',async()=>{
  const roles=(await db.pool.query(`SELECT r.id FROM agent_runs r JOIN agent_instances i ON i.tenant_id=r.tenant_id AND i.id=r.instance_id
    JOIN revision_requests v ON v.tenant_id=i.tenant_id AND v.id=i.preview_session_id WHERE v.order_id=$1`,[f.orderId])).rows;
  const covered=(await db.pool.query('SELECT id FROM privacy_run_scope WHERE tenant_id=$1 AND order_id=$2',[f.p.tenantId,f.orderId])).rows.map(r=>r.id);expect(roles.length).toBe(6);expect(roles.every(r=>covered.includes(r.id))).toBe(true);
  await transaction(db.pool,tx=>requestDeletion(tx,f.p,{scope:'PRODUCT',product_id:f.product.product_id,acknowledge_inflight_contract:true}));
  await expect(getDeliverables(db.pool,f.p,f.orderId)).rejects.toMatchObject({code:'DELIVERY_EXPIRED'});
  const result=await transaction(db.pool,tx=>redactPrivateContent(tx,{tenantId:f.p.tenantId,ownerId:f.p.userId,productIds:[f.product.product_id],orderIds:[f.orderId],assetIds:f.assetIds},true));
  expect(result.state).toBe('BLOCKED');expect(result.blockers).toContain('CONTROLLED_OBJECTS_PENDING');
});
