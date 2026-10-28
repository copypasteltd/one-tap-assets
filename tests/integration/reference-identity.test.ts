import {beforeAll,afterAll,afterEach,it,expect} from 'vitest';
import {mkdir,rm} from 'node:fs/promises';
import type {FastifyInstance} from 'fastify';
import sharp from 'sharp';
import {testDatabase,type TestDatabase} from '../helpers/database.js';
import {mediaFixture} from '../helpers/media.js';
import {syntheticArkContract} from '../helpers/generation.js';
import {syntheticSse} from '../helpers/codex.js';
import {FixtureLauncher} from '../helpers/role-launcher.js';
import {config,inside} from '../../src/api/config.js';
import {id,hash} from '../../src/api/lib/crypto.js';
import {buildApp} from '../../src/api/app.js';
import {ArkClient} from '../../src/worker/providers/ark.js';
import {GenerationGateway} from '../../src/worker/generation/gateway.js';
import {ReferenceIdentityService} from '../../src/worker/generation/reference-service.js';
import {referenceMaterial} from '../../src/worker/generation/reference-material.js';
import {executionContext} from '../../src/worker/compiler/order-context.js';
import {CodexRuntimeAdapter} from '../../src/worker/codex/runtime.js';
import {ToolConsumer} from '../../src/worker/tool-gateway/consumer.js';
import {reviewTools} from '../../src/worker/tool-gateway/review-tools.js';
import {claimStage} from '../../src/worker/queue/leases.js';

let db:TestDatabase,app:FastifyInstance|undefined;const roots:string[]=[],running:{controller:AbortController;task:Promise<void>}[]=[];
const signal=()=>new AbortController().signal;
beforeAll(async()=>{db=await testDatabase();});
afterEach(async()=>{
  for(const item of running.splice(0)){item.controller.abort();await item.task;}
  await app?.close();app=undefined;
  await db.pool.query("UPDATE stage_runs SET state='CANCELLED' WHERE state NOT IN ('SUCCEEDED','FAILED')");
});
afterAll(async()=>{await db?.close();for(const root of roots)await rm(root,{recursive:true,force:true});});
async function setup(mode='NORMAL',options:{cleanupFails?:boolean;inferenceGate?:()=>Promise<void>}={}){
  const imageContract=syntheticArkContract('IMAGE'),videoContract=syntheticArkContract('VIDEO');
  const root=inside(db.cfg.runtimeRoot,`tests/reference/${id('case')}`);roots.push(root);await mkdir(root,{recursive:true});
  const cfg=config({...db.cfg,generationEnabled:true,provider:{...db.cfg.provider,baseUrl:imageContract.base_url,
    apiKey:'synthetic-no-real-provider',imageModel:imageContract.request_model,videoModel:videoContract.request_model,allowedHosts:['generation.example.test']}});
  const f=await mediaFixture({...db,cfg},{generation:{engine:'PER_SHOT_AI',contracts:[imageContract,videoContract],variantId:'quiet-luxury.ai-detail'}});
  f.cfg.provider.allowedHosts.push('generation.example.test','media.example.test');let generationCalls=0,inferences=0;
  const bytes=await sharp({create:{width:640,height:800,channels:3,background:'#284E73'}}).jpeg().toBuffer();
  const gateway=new GenerationGateway(db.pool,f.cfg,f.store,new ArkClient(f.cfg,async()=>{
    generationCalls++;const response=Buffer.from(JSON.stringify({model:imageContract.actual_model,data:[{b64_json:bytes.toString('base64')}],usage:{generated_images:1}}));
    return {status:200,headers:{},bytes:response,json:()=>JSON.parse(response.toString('utf8')) as unknown};
  }));
  const generated=await gateway.submit(f.lease,{kind:'IMAGE',operation_key:`reference:${f.contract.creative.shots[0]!.shot_id}`,
    prompt:'Keep the authorized product identity in the frozen shot.',reference_asset_ids:[f.assetIds[0]!] },signal());
  app=await buildApp({cfg:f.cfg,pool:db.pool,inferenceHttp:async()=>{
    inferences++;await options.inferenceGate?.();return {status:200,headers:{'content-type':'text/event-stream'},bytes:syntheticSse(f.admission),json:()=>null};
  }});
  await app.listen({host:'127.0.0.1',port:0});const address=app.server.address();if(!address||typeof address==='string')throw new Error('Missing reference HTTPS listener');
  f.cfg.publicBaseUrl=`https://localhost:${address.port}`;
  const controller=new AbortController(),consumer=new ToolConsumer(db.pool,id('ref_tools'),reviewTools(db.pool,f.cfg,f.store));
  running.push({controller,task:consumer.run(controller.signal)});
  const launcher=new FixtureLauncher(mode,options.cleanupFails??false),executor=new CodexRuntimeAdapter(db.pool,f.cfg,launcher);
  const service=new ReferenceIdentityService(db.pool,f.cfg,f.store,executor);
  return {...f,generated,gateway,service,launcher,inferences:()=>inferences,generationCalls:()=>generationCalls};
}

it('sends all original PNGs and generated frames to a fresh role, persists each anchor and releases its instance',async()=>{
  const f=await setup(),approval=await f.service.review(f.lease,signal());
  expect(approval.frames.map(frame=>frame.asset_id)).toEqual([f.generated.submission_id]);
  const run=(await db.pool.query('SELECT * FROM agent_runs WHERE id=$1',[approval.run_id])).rows[0];
  expect(run).toMatchObject({state:'SUCCEEDED',role:'REVIEW_FACTS'});expect(run.private.stage_result.verdict).toBe('PASS');
  expect(run.private.review_input.purpose).toBe('REFERENCE_IDENTITY');expect(run.private.review_input.images).toHaveLength(4);
  expect(run.private.stage_result.frames[0].anchors).toHaveLength(f.identityLock.features.length);
  expect(hash(run.private.stage_result)).toBe(approval.report_hash);
  const request=(await db.pool.query('SELECT state,data FROM inference_requests WHERE run_id=$1',[approval.run_id])).rows[0];
  expect(request.state).toBe('SUCCEEDED');expect(request.data.review_image_hashes).toHaveLength(4);
  expect((await db.pool.query('SELECT state FROM agent_instances WHERE id=$1',[run.instance_id])).rows[0].state).toBe('RELEASED');
  expect((await db.pool.query('SELECT id FROM review_packets WHERE order_id=$1',[f.orderId])).rowCount).toBe(0);
  expect(f.inferences()).toBe(1);expect(f.launcher.launches).toBe(1);
});
it('restores the original approved reference checkpoint after worker takeover without another model turn',async()=>{
  const f=await setup(),approval=await f.service.review(f.lease,signal());
  await db.pool.query("UPDATE stage_runs SET lease_expires_at=now()-interval '1 second' WHERE id=$1",[f.lease.id]);
  const next=(await claimStage(db.pool,id('ref_recovery'),['PRODUCTION']))!;expect(next.id).toBe(f.lease.id);
  expect(await f.service.review(next,signal())).toEqual(approval);expect(f.inferences()).toBe(1);expect(f.launcher.launches).toBe(1);
});
it.each(['REFERENCE_FAIL','REFERENCE_UNCERTAIN'])('blocks further production for an actual persisted %s verdict',async mode=>{
  const f=await setup(mode);await expect(f.service.review(f.lease,signal())).rejects.toMatchObject({code:'REFERENCE_IDENTITY_REJECTED'});
  await expect(f.service.review(f.lease,signal())).rejects.toMatchObject({code:'REFERENCE_IDENTITY_REJECTED'});
  expect(f.inferences()).toBe(1);expect(f.launcher.launches).toBe(1);
  const run=(await db.pool.query("SELECT state,private FROM agent_runs WHERE private->'review_input'->>'purpose'='REFERENCE_IDENTITY' AND tenant_id=$1",[f.p.tenantId])).rows[0];
  expect(run.state).toBe('SUCCEEDED');expect(run.private.stage_result.verdict).not.toBe('PASS');
  expect((await db.pool.query("SELECT id FROM provider_submissions WHERE order_id=$1 AND generation_kind='VIDEO'",[f.orderId])).rowCount).toBe(0);
});
it.each(['REFERENCE_MISSING_FRAME','REFERENCE_MISSING_ANCHOR','REFERENCE_WRONG_SOURCE','REFERENCE_FAKE_PASS','REFERENCE_WRONG_IDENTITY',
  'REVIEW_MISSING_IMAGE','REVIEW_WRONG_IMAGE'])('rejects incomplete or invented reference proof: %s',async mode=>{
  const f=await setup(mode);await expect(f.service.review(f.lease,signal())).rejects.toThrow();
  expect((await db.pool.query("SELECT id FROM agent_runs WHERE tenant_id=$1 AND role='REVIEW_FACTS' AND state='SUCCEEDED'",[f.p.tenantId])).rowCount).toBe(0);
  await expect(f.service.review(f.lease,signal())).rejects.toThrow();expect(f.inferences()).toBeLessThanOrEqual(1);expect(f.launcher.launches).toBe(1);
});
it('rechecks actual source and generated bytes after approval instead of trusting unchanged metadata',async()=>{
  const f=await setup();await f.service.review(f.lease,signal());
  const original=await f.store.get(f.generated.output!.object_key);await f.store.put(f.generated.output!.object_key,Buffer.from('changed-reference'),'image/png');
  await expect(f.service.review(f.lease,signal())).rejects.toMatchObject({code:'REFERENCE_BYTES_CHANGED'});
  await f.store.put(f.generated.output!.object_key,original,'image/png');
  const photo=(await db.pool.query('SELECT object_key FROM assets WHERE id=$1',[f.assetIds[0]])).rows[0];
  await f.store.put(photo.object_key,Buffer.from('changed-source'),'image/png');
  await expect(f.service.review(f.lease,signal())).rejects.toMatchObject({code:'REFERENCE_BYTES_CHANGED'});
  expect(f.inferences()).toBe(1);expect(f.launcher.launches).toBe(1);
});
it('does not issue approval when role cleanup failed despite a complete model report',async()=>{
  const f=await setup('NORMAL',{cleanupFails:true});await expect(f.service.review(f.lease,signal())).rejects.toMatchObject({code:'REFERENCE_RESULT_NOT_PERSISTED'});
  await expect(f.service.review(f.lease,signal())).rejects.toMatchObject({code:'REFERENCE_RESULT_NOT_PERSISTED'});expect(f.launcher.launches).toBe(1);
});
it('keeps a single original reference review under concurrent callers',async()=>{
  let release!:()=>void,entered!:()=>void;const gate=new Promise<void>(r=>{release=r;}),started=new Promise<void>(r=>{entered=r;});
  const f=await setup('NORMAL',{inferenceGate:async()=>{entered();await gate;}}),first=f.service.review(f.lease,signal());
  try{await started;await expect(f.service.review(f.lease,signal())).rejects.toThrow();}finally{release();}
  expect((await first).frames).toHaveLength(1);expect(f.inferences()).toBe(1);expect(f.launcher.launches).toBe(1);
});
it('refuses another order or an extended lease deadline before starting any reference role',async()=>{
  const f=await setup();await expect(f.service.review({...f.lease,deadline_at:new Date(f.lease.deadline_at.getTime()+1000)},signal())).rejects.toMatchObject({code:'GENERATION_SCOPE_INVALID'});
  const context=await executionContext(db.pool,f.p.tenantId,f.orderId,f.snapshotHash);
  await expect(referenceMaterial(db.pool,f.store,context,id('foreign_stage'))).rejects.toMatchObject({code:'REFERENCE_SCOPE_INVALID'});
  expect(f.inferences()).toBe(0);expect(f.launcher.launches).toBe(0);
});
