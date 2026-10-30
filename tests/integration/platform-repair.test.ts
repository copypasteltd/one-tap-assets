import {beforeAll,afterAll,it,expect} from 'vitest';
import type {FastifyInstance} from 'fastify';
import {testDatabase,type TestDatabase} from '../helpers/database';
import {mediaFixture} from '../helpers/media';
import {FixtureLauncher} from '../helpers/role-launcher';
import {syntheticSse} from '../helpers/codex';
import {buildApp} from '../../src/api/app';
import {transaction} from '../../src/api/db/pool';
import {id,sha256} from '../../src/api/lib/crypto';
import {issueSession} from '../../src/api/modules/identity';
import {getDeliverables,requestRevision,listRevisions} from '../../src/api/modules/delivery';
import {CodexRuntimeAdapter} from '../../src/worker/codex/runtime';
import {MediaStageService} from '../../src/worker/codex/media-stage';
import {ToolConsumer,type ToolHandler} from '../../src/worker/tool-gateway/consumer';
import {productionTools} from '../../src/worker/tool-gateway/production-tools';
import {reviewTools} from '../../src/worker/tool-gateway/review-tools';
import {revisionTools} from '../../src/worker/tool-gateway/revision-tools';
import {claimStage,completeStage,heartbeatStage,failStage,type StageLease} from '../../src/worker/queue/leases';
import {enqueueStage} from '../../src/worker/queue/enqueue';
import {QualityControlService} from '../../src/worker/review/qc';
import {ReviewStageService} from '../../src/worker/review/stage';
import {PublicationService} from '../../src/worker/review/publication';
import {RevisionService} from '../../src/worker/revisions/service';
import {REVISION_STAGES} from '../../src/worker/revisions/contract';
import {revisionContext} from '../../src/worker/revisions/context';
import {inspectCandidate} from '../../src/worker/revisions/media';
import type {NativeLaunchManifest} from '../../src/worker/codex/launcher';
import type {DTO} from '../../src/shared/contracts/types';

// Actual native stdio/HTTP, files and PostgreSQL; identities, semantics and
// metering are explicitly synthetic. No external provider or payment is used.
class Launcher extends FixtureLauncher{
  override async launch(path:string,manifest:NativeLaunchManifest){const result=await super.launch(path,manifest);
    result.receipt.os_identity_ref=`SYNTHETIC-NOT-RESTRICTED:${manifest.run_id}`;
    result.receipt.process_ref=`${result.receipt.process_ref}:${manifest.run_id}`;return result;}
}
let db:TestDatabase,app:FastifyInstance,f:Awaited<ReturnType<typeof mediaFixture>>,consumer:Promise<void>,parent:DTO<'Deliverables'>,buyer:string;
const stop=new AbortController(),credential='SYNTHETIC-PLATFORM-REPAIR-STAFF',other='SYNTHETIC-OTHER-REPAIR-STAFF';
const gateDenials:string[]=[];
const staff=(token=credential,key=id('repair-request'))=>({authorization:`Bearer ${token}`,'idempotency-key':key});
async function next(name:string){const lease=await claimStage(db.pool,id('repair-worker'),[name]);expect(lease).toBeTruthy();return lease!;}
async function finish(lease:StageLease,handler:()=>Promise<import('../../src/worker/runtime').StageCommit>){
  let pulse:Promise<void>|undefined;let failure:unknown;
  const timer=setInterval(()=>{pulse??=heartbeatStage(db.pool,lease).then(ok=>{if(!ok)throw new Error('Fixture lease lost');}).catch(e=>{failure=e;}).finally(()=>{pulse=undefined;});},4000);
  try{const commit=await handler();if(pulse)await pulse;if(failure)throw failure;await completeStage(db.pool,lease,commit);}
  catch(error){console.error(JSON.stringify({synthetic_fixture_only:true,stage:lease.stage_name,inference_denials:gateDenials,
    tools:(await db.pool.query("SELECT tool_name,state,data->>'error_code' AS error_code FROM agent_tool_intents WHERE stage_run_id=$1",[lease.id])).rows}));
    if(lease.scope_type==='REVISION'&&!gateDenials.length){try{await inspectCandidate(db.pool,f.cfg,f.store,await revisionContext(db.pool,lease.tenant_id,lease.scope_id),stop.signal);}
      catch(probe){console.error(JSON.stringify({synthetic_fixture_only:true,repeat_actual_check:probe instanceof Error?probe.message:'failed'}));}}
    throw error;}
  finally{clearInterval(timer);if(pulse)await pulse;}
}
beforeAll(async()=>{
  db=await testDatabase();f=await mediaFixture(db,{revisions:true});
  f.cfg.managementTokens=JSON.stringify([credential,other].map((token,i)=>({actor:`repair-staff-${i}`,token_hash:sha256(token),permissions:['support:read','support:write','support:repair']})));
  app=await buildApp({cfg:f.cfg,pool:db.pool,inferenceHttp:async()=>({status:200,headers:{'content-type':'text/event-stream'},bytes:syntheticSse(f.admission),json:()=>null})});
  app.addHook('onSend',(request,reply,payload,done)=>{
    if(request.url==='/v1/internal/p01/agent-inference/responses'&&reply.statusCode>=400&&typeof payload==='string'){
      try{const code=(JSON.parse(payload) as {code?:unknown}).code;if(typeof code==='string')gateDenials.push(code);}catch{}
    }done(null,payload);
  });
  await app.listen({host:'127.0.0.1',port:0});const address=app.server.address();if(!address||typeof address==='string')throw new Error('Fixture listener missing');
  f.cfg.publicBaseUrl=`https://localhost:${address.port}`;
  const media=productionTools(db.pool,f.cfg,f.store),review=reviewTools(db.pool,f.cfg,f.store),revisions=revisionTools(db.pool,f.cfg,f.store);
  const normal:Record<string,ToolHandler>={...media,...review,persist_stage_result:(scope,...args)=>(scope.role.startsWith('REVIEW_')?review:media).persist_stage_result!(scope,...args)};
  const handlers=Object.fromEntries(Object.keys(normal).map(name=>[name,((scope,...args)=>(scope.scope_type==='REVISION'?revisions:normal)[name]!(scope,...args)) as ToolHandler]));
  consumer=new ToolConsumer(db.pool,id('repair-tools'),handlers).run(stop.signal);
  const runtime=new CodexRuntimeAdapter(db.pool,f.cfg,new FixtureLauncher()),mediaStage=new MediaStageService(db.pool,f.cfg,runtime);
  await finish(f.lease,()=>mediaStage.handle(f.lease,stop.signal));const post=await next('POST');await finish(post,()=>mediaStage.handle(post,stop.signal));let dependency=post.id;
  for(const name of ['QC','REVIEW_FACTS','REVIEW_STYLE','DELIVER']){
    await enqueueStage(db.pool,{tenantId:f.p.tenantId,scopeType:'ORDER',scopeId:f.orderId,name,inputHash:f.snapshotHash,deadlineAt:f.snapshot.deadline_at,jobId:f.lease.job_id!,dependencies:[dependency]});
    const lease=await next(name);dependency=lease.id;
    const service=name==='QC'?new QualityControlService(db.pool,f.cfg,f.store):name==='DELIVER'?new PublicationService(db.pool,f.cfg,f.store):new ReviewStageService(db.pool,f.cfg,runtime);
    await finish(lease,()=>service.handle(lease,stop.signal));
  }
  parent=await getDeliverables(db.pool,f.p,f.orderId);buyer=(await issueSession(db.pool,{platform:'alipay',appId:f.p.appId,subjectId:f.p.subjectId})).access_token;
});
afterAll(async()=>{stop.abort();if(consumer)await consumer;await app?.close();await db?.close();});

it('runs an evidence-bound free platform correction through five stages and publishes actual reviewed copy without consuming the customer allowance',async()=>{
  const created=await app.inject({method:'POST',url:`/v1/p01/orders/${f.orderId}/tickets`,headers:{authorization:`Bearer ${buyer}`,'idempotency-key':id('ticket')},
    payload:{category:'PRODUCT_ERROR',message:'合成商品文案纠错，请按原商品资料核对配套说明。',attachment_asset_ids:[]}});
  expect(created.statusCode).toBe(201);const ticket=created.json().data as DTO<'Ticket'>;
  const claim=await app.inject({method:'POST',url:`/v1/internal/p01/support-tickets/${ticket.ticket_id}/process`,headers:staff(),payload:{action:'CLAIM',expected_revision:0}});
  expect(claim.statusCode).toBe(200);
  const copy=`${f.contract.creative.copy}\n实拍展示，欢迎了解。`;
  const payload:DTO<'PlatformErrorRepairRequest'>={ticket_id:ticket.ticket_id,expected_ticket_revision:1,change:{kind:'DISPLAY_TEXT',manifest_revision:1,display_text:copy}};
  const url=`/v1/internal/p01/orders/${f.orderId}/platform-repairs`,key=id('platform-repair');
  expect((await app.inject({method:'POST',url,headers:staff(buyer),payload})).statusCode).toBe(401);
  expect((await app.inject({method:'POST',url,headers:staff(other),payload})).statusCode).toBe(403);
  expect((await app.inject({method:'POST',url,headers:staff(),payload:{...payload,expected_ticket_revision:0}})).statusCode).toBe(409);
  expect((await app.inject({method:'POST',url:url.replace(f.orderId,id('foreign-order')),headers:staff(),payload})).statusCode).toBe(404);
  expect((await app.inject({method:'POST',url,headers:staff(),payload:{reason:'legacy unbound evidence',evidence_record_ids:[ticket.ticket_id]}})).statusCode).toBe(400);
  const accepted=await app.inject({method:'POST',url,headers:staff(credential,key),payload});
  expect(accepted.statusCode,accepted.body).toBe(200);const revision=accepted.json().data as DTO<'Revision'>;expect(revision.consumes_user_allowance).toBe(false);
  const replay=await app.inject({method:'POST',url,headers:staff(credential,key),payload});expect(replay.json().data).toEqual(revision);
  const linked=await app.inject({method:'POST',url,headers:staff(),payload:{...payload,expected_ticket_revision:2}});
  expect(linked.statusCode).toBe(409);expect(linked.json().code).toBe('PLATFORM_REPAIR_ALREADY_LINKED');
  const stages=(await db.pool.query('SELECT stage_name,deadline_at FROM stage_runs WHERE scope_id=$1',[revision.revision_id])).rows;
  expect(stages.map(s=>s.stage_name).sort()).toEqual([...REVISION_STAGES].sort());
  expect(new Set(stages.map(s=>s.deadline_at.toISOString())).size).toBe(1);
  expect(stages[0].deadline_at.getTime()).toBeLessThanOrEqual(Date.now()+300000);
  await expect(transaction(db.pool,tx=>requestRevision(tx,f.p,f.orderId,{kind:'COVER',manifest_revision:1,cover_deliverable_id:parent.items.filter(i=>i.kind==='image')[1]!.deliverable_id}))).rejects.toMatchObject({code:'REVISION_IN_PROGRESS'});
  const service=new RevisionService(db.pool,f.cfg,f.store,new CodexRuntimeAdapter(db.pool,f.cfg,new Launcher()));
  for(const name of REVISION_STAGES){const lease=await next(name);expect(lease.scope_id).toBe(revision.revision_id);await finish(lease,()=>service.handle(lease,stop.signal));}
  const updated=await getDeliverables(db.pool,f.p,f.orderId);expect(updated.manifest_revision).toBe(2);expect(updated.parent_manifest_id).toBe(parent.manifest_id);expect(updated.expires_at).toBe(parent.expires_at);
  const expiry=(await db.pool.query("SELECT private->'input'->>'delivery_expires_at' AS value FROM revision_requests WHERE id=$1",[revision.revision_id])).rows[0].value;
  expect(Date.parse(expiry)).toBe(Date.parse(updated.expires_at));
  const item=updated.items.find(i=>i.kind==='copy')!,artifact=(await db.pool.query('SELECT object_key FROM artifacts WHERE id=$1',[item.deliverable_id])).rows[0];
  expect((await f.store.get(artifact.object_key)).toString('utf8')).toBe(copy);expect(item.text).toBe(copy);
  expect((await db.pool.query('SELECT data FROM delivery_manifests WHERE id=$1',[parent.manifest_id])).rows[0].data).toEqual(parent);
  const records=await listRevisions(db.pool,f.cfg,f.p,f.orderId,{});expect(records.items[0]).toMatchObject({state:'COMPLETED',consumes_user_allowance:false,result_manifest_revision:2});
  const roles=(await db.pool.query("SELECT role,state,instance_id FROM agent_runs WHERE private->>'stage_run_id' IN (SELECT id FROM stage_runs WHERE scope_id=$1)",[revision.revision_id])).rows;
  expect(roles).toHaveLength(3);expect(new Set(roles.map(r=>r.instance_id)).size).toBe(3);expect(roles.every(r=>r.state==='SUCCEEDED')).toBe(true);
  expect((await db.pool.query('SELECT deadline_at FROM orders WHERE id=$1',[f.orderId])).rows[0].deadline_at.toISOString()).toBe(f.snapshot.deadline_at);
  expect((await db.pool.query('SELECT state FROM support_tickets WHERE id=$1',[ticket.ticket_id])).rows[0].state).toBe('PROCESSING');
});

it('retains the original shared inference cap when a new customer revision follows a platform correction',async()=>{
  // The protocol fixture buys exactly one response per role, while the sold
  // policy allows two. A second distinct evidence-bound correction uses the
  // remaining original calls; a third request must not refresh the account.
  const pack=await getDeliverables(db.pool,f.p,f.orderId),secondCover=pack.items.filter(i=>i.kind==='image')[1]!.deliverable_id;
  const ticketResponse=await app.inject({method:'POST',url:`/v1/p01/orders/${f.orderId}/tickets`,headers:{authorization:`Bearer ${buyer}`,'idempotency-key':id('second-ticket')},
    payload:{category:'PRODUCT_ERROR',message:'合成封面纠错，请选择原包另一张图片。',attachment_asset_ids:[]}});
  expect(ticketResponse.statusCode).toBe(201);const ticket=ticketResponse.json().data as DTO<'Ticket'>;
  expect((await app.inject({method:'POST',url:`/v1/internal/p01/support-tickets/${ticket.ticket_id}/process`,headers:staff(),payload:{action:'CLAIM',expected_revision:0}})).statusCode).toBe(200);
  const accepted=await app.inject({method:'POST',url:`/v1/internal/p01/orders/${f.orderId}/platform-repairs`,headers:staff(),
    payload:{ticket_id:ticket.ticket_id,expected_ticket_revision:1,change:{kind:'COVER',manifest_revision:2,cover_deliverable_id:secondCover}}});
  expect(accepted.statusCode,accepted.body).toBe(200);const correction=accepted.json().data as DTO<'Revision'>;
  const secondService=new RevisionService(db.pool,f.cfg,f.store,new CodexRuntimeAdapter(db.pool,f.cfg,new Launcher()));
  for(const name of REVISION_STAGES){const lease=await next(name);await finish(lease,()=>secondService.handle(lease,stop.signal));}
  expect(correction.consumes_user_allowance).toBe(false);
  const before=await db.pool.query("SELECT id FROM inference_requests WHERE tenant_id=$1 AND scope_type='REVISION'",[f.p.tenantId]);
  expect(before.rowCount).toBe(f.contract.revision_policy!.limits.max_requests);
  const budget=(await db.pool.query('SELECT * FROM revision_budgets WHERE order_id=$1',[f.orderId])).rows[0];expect(Number(budget.spent_micro)).toBeGreaterThan(0);
  const updated=await getDeliverables(db.pool,f.p,f.orderId),cover=updated.items.filter(i=>i.kind==='image')[0]!.deliverable_id;
  const user=await transaction(db.pool,tx=>requestRevision(tx,f.p,f.orderId,{kind:'COVER',manifest_revision:3,cover_deliverable_id:cover}));expect(user.consumes_user_allowance).toBe(true);
  const service=new RevisionService(db.pool,f.cfg,f.store,new CodexRuntimeAdapter(db.pool,f.cfg,new Launcher())),lease=await next('REVISION');
  // RPC failure is intentionally generic. Capture the actual local gateway's
  // metadata-only refusal before asserting the original account stayed intact.
  await expect(finish(lease,()=>service.handle(lease,stop.signal))).rejects.toMatchObject({code:'CODEX_TURN_FAILED'});
  expect(gateDenials.at(-1)).toBe('CODEX_ROLE_INFERENCE_LIMIT');
  expect((await db.pool.query("SELECT id FROM inference_requests WHERE tenant_id=$1 AND scope_type='REVISION'",[f.p.tenantId])).rowCount).toBe(before.rowCount);
  const after=(await db.pool.query('SELECT * FROM revision_budgets WHERE order_id=$1',[f.orderId])).rows[0];expect(after.spent_micro).toBe(budget.spent_micro);expect(after.ceiling_micro).toBe(budget.ceiling_micro);
  await failStage(db.pool,lease,'CODEX_ROLE_INFERENCE_LIMIT');expect((await getDeliverables(db.pool,f.p,f.orderId)).manifest_revision).toBe(3);
});
