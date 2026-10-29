import {afterAll,beforeAll,expect,it} from 'vitest';
import type {FastifyInstance} from 'fastify';
import {testDatabase,type TestDatabase} from '../helpers/database.js';
import {mediaFixture} from '../helpers/media.js';
import {syntheticSse} from '../helpers/codex.js';
import {FixtureLauncher} from '../helpers/role-launcher.js';
import {buildApp} from '../../src/api/app.js';
import {id,hash} from '../../src/api/lib/crypto.js';
import {CodexRuntimeAdapter} from '../../src/worker/codex/runtime.js';
import {MediaStageService} from '../../src/worker/codex/media-stage.js';
import {ToolConsumer} from '../../src/worker/tool-gateway/consumer.js';
import type {ToolHandler} from '../../src/worker/tool-gateway/consumer.js';
import {productionTools} from '../../src/worker/tool-gateway/production-tools.js';
import {reviewTools} from '../../src/worker/tool-gateway/review-tools.js';
import {claimStage,completeStage,heartbeatStage,type StageLease} from '../../src/worker/queue/leases.js';
import {enqueueStage} from '../../src/worker/queue/enqueue.js';
import {QualityControlService} from '../../src/worker/review/qc.js';
import {ReviewStageService} from '../../src/worker/review/stage.js';
import {PublicationService} from '../../src/worker/review/publication.js';
import {executionContext} from '../../src/worker/compiler/order-context.js';
import {currentReviewPacket} from '../../src/worker/review/context.js';
import {validateReviewReport} from '../../src/worker/review/reports.js';
import {RepairCoordinator} from '../../src/worker/repair/coordinator.js';
import {RepairPlanningService,repairPlanningTools,validateRepairPlanningResult} from '../../src/worker/repair/planning.js';
import {checkedRepairPlan} from '../../src/worker/repair/context.js';

let db:TestDatabase,app:FastifyInstance|undefined,consumer:Promise<void>|undefined;
const controller=new AbortController();
beforeAll(async()=>{db=await testDatabase();});
afterAll(async()=>{controller.abort();await consumer;await app?.close();await db?.close();});

it('repairs a located failed photo candidate once, seals new bytes and publishes only fresh independent consensus',async()=>{
  // This synthetic sold contract includes the preparation turn from the outset.
  // Runtime repair never raises a buyer's existing token, call or budget limit.
  const f=await mediaFixture(db,{configureContract:async c=>{
    c.repair_ceiling_micro=250000;
    c.codex_contract.max_turns_per_role=3;
    c.codex_contract.max_input_tokens=200000;c.runtime_binding!.limits.max_input_tokens=200000;
    c.runtime_binding!.limits.max_requests=12;c.runtime_binding!.limits.max_requests_per_role=3;
  }});
  app=await buildApp({cfg:f.cfg,pool:db.pool,inferenceHttp:async()=>({status:200,
    headers:{'content-type':'text/event-stream'},bytes:syntheticSse(f.admission),json:()=>null})});
  const gateFailures:{status:number;code:string}[]=[];
  app.addHook('onSend',async(_request,reply,payload)=>{
    if(reply.statusCode>=400&&typeof payload==='string'){
      try{const body=JSON.parse(payload);const code=body.error?.code??body.code??'UNSPECIFIED';
        gateFailures.push({status:reply.statusCode,code:/^[A-Z][A-Z0-9_]{1,79}$/.test(code)?code:'UNSPECIFIED'});}catch{}
    }return payload;
  });
  await app.listen({host:'127.0.0.1',port:0});const address=app.server.address();
  if(!address||typeof address==='string')throw new Error('Missing synthetic HTTPS listener');
  f.cfg.publicBaseUrl=`https://localhost:${address.port}`;
  const media=productionTools(db.pool,f.cfg,f.store),reviews=reviewTools(db.pool,f.cfg,f.store),repairTools=repairPlanningTools(db.pool);
  const handlers:Record<string,ToolHandler>={};
  for(const name of new Set([...Object.keys(media),...Object.keys(reviews),...Object.keys(repairTools)]))handlers[name]=(scope,...args)=>{
    const selected=scope.stage_name==='REPAIR_PLAN'?repairTools:scope.role.startsWith('REVIEW_')?reviews:media;
    if(!selected[name])throw new Error('Unexpected tool');return selected[name]!(scope,...args);
  };
  consumer=new ToolConsumer(db.pool,id('tools'),handlers).run(controller.signal);
  const coordinator=new RepairCoordinator(f.cfg);
  const executor=()=>new CodexRuntimeAdapter(db.pool,f.cfg,new FixtureLauncher());
  const mediaService=new MediaStageService(db.pool,f.cfg,executor());
  const quality=new QualityControlService(db.pool,f.cfg,f.store);
  const review=new ReviewStageService(db.pool,f.cfg,executor());
  const failing=new ReviewStageService(db.pool,f.cfg,new CodexRuntimeAdapter(db.pool,f.cfg,new FixtureLauncher('REVIEW_LOCATED_FAIL')));
  const planning=new RepairPlanningService(db.pool,f.cfg,executor());
  const publisher=new PublicationService(db.pool,f.cfg,f.store);
  async function finish(lease:StageLease,handler:()=>Promise<(db:import('pg').PoolClient)=>Promise<void>>){
    const pulse=setInterval(()=>{void heartbeatStage(db.pool,lease);},5000);
    try{await completeStage(db.pool,lease,await handler(),(client,current)=>coordinator.afterStageCommit(client,current));}
    catch(error){
      const failures=(await db.pool.query(`SELECT tool_name,data->>'error_code' AS code FROM agent_tool_intents
        WHERE state='FAILED' ORDER BY created_at DESC LIMIT 3`)).rows;
      throw new Error(`Synthetic ${lease.stage_name} attempt ${lease.attempt}: ${JSON.stringify({failures,gateFailures})}`,{cause:error});
    }
    finally{clearInterval(pulse);}
  }
  let parent=f.lease.id;
  for(const name of ['QC','REVIEW_FACTS','REVIEW_STYLE','DELIVER']){
    if(name==='QC')parent=(await db.pool.query("SELECT id FROM stage_runs WHERE job_id=$1 AND stage_name='POST'",[f.lease.job_id])).rows[0].id;
    parent=await enqueueStage(db.pool,{tenantId:f.p.tenantId,scopeType:'ORDER',scopeId:f.orderId,name,inputHash:f.snapshotHash,
      deadlineAt:f.snapshot.deadline_at,jobId:f.lease.job_id!,dependencies:[parent]});
  }
  await finish(f.lease,()=>mediaService.handle(f.lease,controller.signal));
  for(const name of ['POST','QC','REVIEW_FACTS']){
    const lease=(await claimStage(db.pool,id('worker'),[name]))!;
    await finish(lease,()=>name==='POST'?mediaService.handle(lease,controller.signal):name==='QC'?quality.handle(lease,controller.signal):failing.handle(lease,controller.signal));
  }
  const base=await executionContext(db.pool,f.p.tenantId,f.orderId,f.snapshotHash);
  const original=await currentReviewPacket(db.pool,base);
  expect(original.state).toBe('FAILED');expect(original.reports).toHaveLength(1);
  const firstStyle=(await claimStage(db.pool,id('worker'),['REVIEW_STYLE']))!;
  await finish(firstStyle,()=>review.handle(firstStyle,controller.signal));
  const oldPacket=await currentReviewPacket(db.pool,base);
  expect(oldPacket.reports).toHaveLength(2);expect(oldPacket.publication_decision).toBe('BLOCK');
  expect((await db.pool.query("SELECT state FROM stage_runs WHERE job_id=$1 AND attempt=1 AND stage_name='DELIVER'",[f.lease.job_id])).rows[0].state).toBe('CANCELLED');
  expect((await db.pool.query('SELECT count(*)::int AS n FROM repair_cost_authorizations WHERE order_id=$1',[f.orderId])).rows[0].n).toBe(1);
  expect(await claimStage(db.pool,id('blocked-delivery'),['DELIVER'])).toBeNull();
  const prep=(await claimStage(db.pool,id('repair'),['REPAIR_PLAN']))!;
  const context=await executionContext(db.pool,f.p.tenantId,f.orderId,f.snapshotHash,prep.id);
  expect(()=>checkedRepairPlan(context,f.contract.creative)).toThrow();
  const changed=structuredClone(f.contract.creative);changed.copy='未经定位的共享文案';
  await expect(validateRepairPlanningResult(db.pool,f.p.tenantId,f.orderId,f.snapshotHash,prep.id,changed)).rejects.toMatchObject({code:'REPAIR_PLAN_OUTSIDE_FINDINGS'});
  await finish(prep,()=>planning.handle(prep,controller.signal));
  for(const name of ['PRODUCTION','POST','QC','REVIEW_FACTS','REVIEW_STYLE']){
    const lease=(await claimStage(db.pool,id('repair'),[name]))!;expect(lease.attempt).toBe(2);
    await finish(lease,()=>name==='QC'?quality.handle(lease,controller.signal):name.startsWith('REVIEW_')?review.handle(lease,controller.signal):mediaService.handle(lease,controller.signal));
  }
  const deliver=(await claimStage(db.pool,id('repair'),['DELIVER']))!;
  const candidateContext=await executionContext(db.pool,f.p.tenantId,f.orderId,f.snapshotHash,deliver.id);
  const candidate=await currentReviewPacket(db.pool,candidateContext);
  expect(candidate.state).toBe('PASSED');expect(candidate.packet_hash).not.toBe(oldPacket.packet_hash);
  expect(candidate.output_set_hash).not.toBe(oldPacket.output_set_hash);
  const slot=candidateContext.repair!.target_slot_ids[0]!;
  expect(candidate.outputs.find(o=>o.slot_id===slot)!.sha256).not.toBe(oldPacket.outputs.find(o=>o.slot_id===slot)!.sha256);
  expect(candidate.reports).toHaveLength(2);
  expect(new Set([...oldPacket.reports,...candidate.reports].map(r=>r.runtime_process_ref)).size).toBe(4);
  await expect(validateReviewReport(db.pool,f.cfg,candidateContext,candidate,oldPacket.reports[1]!.run_id,oldPacket.reports[1]))
    .rejects.toThrow();
  await finish(deliver,()=>publisher.handle(deliver,controller.signal));
  const order=(await db.pool.query('SELECT fulfillment_state,private,budget_micro,deadline_at FROM orders WHERE id=$1',[f.orderId])).rows[0];
  expect(order.fulfillment_state).toBe('DELIVERED');expect(hash(order.private.contract)).toBe(hash(f.contract));
  expect(Number(order.budget_micro)).toBe(f.contract.budget_micro);expect(order.deadline_at.toISOString()).toBe(f.snapshot.deadline_at);
  const costs=(await db.pool.query("SELECT count(*)::int AS n,COALESCE(sum(settled_micro),0)::int AS spent FROM budget_reservations WHERE order_id=$1 AND purpose='REPAIR'",[f.orderId])).rows[0];
  expect(costs.n).toBe(5);expect(costs.spent).toBeLessThanOrEqual(f.contract.repair_ceiling_micro);
  expect((await db.pool.query("SELECT id FROM agent_instances WHERE order_id=$1 AND state<>'RELEASED'",[f.orderId])).rowCount).toBe(0);
  expect((await db.pool.query('SELECT id FROM delivery_manifests WHERE order_id=$1',[f.orderId])).rowCount).toBe(1);
},180_000);
