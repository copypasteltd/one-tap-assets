import {beforeAll,afterAll,afterEach,it,expect} from 'vitest';
import {mkdir,readFile,rm,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import type {FastifyInstance} from 'fastify';
import sharp from 'sharp';
import {testDatabase,type TestDatabase} from '../helpers/database.js';
import {mediaFixture} from '../helpers/media.js';
import {withFixtureLease} from '../helpers/lease.js';
import {syntheticArkContract} from '../helpers/generation.js';
import {syntheticSse} from '../helpers/codex.js';
import {FixtureLauncher} from '../helpers/role-launcher.js';
import {config,inside} from '../../src/api/config.js';
import {buildApp} from '../../src/api/app.js';
import {id,hash,sha256} from '../../src/api/lib/crypto.js';
import {AppError} from '../../src/api/lib/errors.js';
import {createDownloadLink,getDeliverables} from '../../src/api/modules/delivery.js';
import {issueSession} from '../../src/api/modules/identity.js';
import {revisionTools} from '../../src/worker/tool-gateway/revision-tools.js';
import {RevisionService} from '../../src/worker/revisions/service.js';
import {REVISION_STAGES} from '../../src/worker/revisions/contract.js';
import {revisionContext} from '../../src/worker/revisions/context.js';
import {inspectCandidate} from '../../src/worker/revisions/media.js';
import type {NativeLaunchManifest} from '../../src/worker/codex/launcher.js';
import type {DTO} from '../../src/shared/contracts/types.js';
import {ArkClient} from '../../src/worker/providers/ark.js';
import {GenerationGateway} from '../../src/worker/generation/gateway.js';
import {validateGenerationExecution} from '../../src/worker/generation/contracts.js';
import {executionContext} from '../../src/worker/compiler/order-context.js';
import {operationArtifacts} from '../../src/worker/media/artifacts.js';
import {nativeCommand,inspectVideo} from '../../src/worker/media/native.js';
import {CodexRuntimeAdapter} from '../../src/worker/codex/runtime.js';
import {MediaStageService} from '../../src/worker/codex/media-stage.js';
import {ToolConsumer} from '../../src/worker/tool-gateway/consumer.js';
import type {ToolHandler} from '../../src/worker/tool-gateway/consumer.js';
import {productionTools} from '../../src/worker/tool-gateway/production-tools.js';
import {reviewTools} from '../../src/worker/tool-gateway/review-tools.js';
import {claimStage,completeStage,PendingExternal,type StageLease} from '../../src/worker/queue/leases.js';
import {enqueueStage} from '../../src/worker/queue/enqueue.js';
import {QualityControlService} from '../../src/worker/review/qc.js';
import {ReviewStageService} from '../../src/worker/review/stage.js';
import {PublicationService} from '../../src/worker/review/publication.js';
import {RepairCoordinator} from '../../src/worker/repair/coordinator.js';
import {RepairPlanningService,repairPlanningTools} from '../../src/worker/repair/planning.js';
import {currentReviewPacket} from '../../src/worker/review/context.js';
import {validateReviewReport} from '../../src/worker/review/reports.js';
import {imageRequest} from '../../src/worker/generation/requests.js';

// Real PostgreSQL/HTTPS/stdio/MCP/PNG/MP4; synthetic model and OS identity.
// These small silent contracts do not certify the official generated variants.
let db:TestDatabase,root:string,image:Buffer,repairedImage:Buffer;
const clips=new Map<string,Buffer>();
const active:{app:FastifyInstance;controller:AbortController;task:Promise<void>}[]=[];
beforeAll(async()=>{
  db=await testDatabase();root=inside(db.cfg.runtimeRoot,`tests/generated-pack/${id('media')}`);await mkdir(root,{recursive:true});
  image=await sharp({create:{width:640,height:800,channels:3,background:'#284E73'}}).jpeg().toBuffer();
  repairedImage=await sharp({create:{width:640,height:800,channels:3,background:'#736028'}}).jpeg().toBuffer();
  for(const color of ['red','blue']){
    const path=join(root,`${color}.mp4`);
    await nativeCommand(db.cfg,process.env.FFMPEG_PATH?.trim()||'ffmpeg',['-v','error','-f','lavfi','-i',`color=c=${color}:s=360x640:r=24`,
      '-t','1','-an','-c:v','libx264','-pix_fmt','yuv420p','-movflags','+faststart',path],{cwd:root,timeoutMs:30000});
    clips.set(color,await readFile(path));
  }
  await writeFile(join(root,'concat.txt'),"file 'red.mp4'\nfile 'blue.mp4'\n");
  await nativeCommand(db.cfg,process.env.FFMPEG_PATH?.trim()||'ffmpeg',['-v','error','-f','concat','-safe','1','-i',join(root,'concat.txt'),
    '-an','-c','copy',join(root,'film.mp4')],{cwd:root,timeoutMs:30000});clips.set('film',await readFile(join(root,'film.mp4')));
  await writeFile(join(root,'reverse.txt'),"file 'blue.mp4'\nfile 'red.mp4'\n");
  await nativeCommand(db.cfg,process.env.FFMPEG_PATH?.trim()||'ffmpeg',['-v','error','-f','concat','-safe','1','-i',join(root,'reverse.txt'),
    '-an','-c','copy',join(root,'repaired-film.mp4')],{cwd:root,timeoutMs:30000});clips.set('repaired-film',await readFile(join(root,'repaired-film.mp4')));
});
afterEach(async()=>{
  for(const a of active.splice(0)){a.controller.abort();await a.task;await a.app.close();}
  await db.pool.query("UPDATE stage_runs SET state='CANCELLED' WHERE state NOT IN ('SUCCEEDED','FAILED')");
});
afterAll(async()=>{await db?.close();if(root)await rm(root,{recursive:true,force:true});});
type Engine='PER_SHOT_AI'|'REFERENCE_FILM';
async function setup(engine:Engine,options:{mode?:string;wrongAspect?:boolean;unknownReference?:boolean;loseFirstQuery?:boolean;repair?:boolean;revisions?:boolean}={}){
  const ic=syntheticArkContract('IMAGE'),vc=syntheticArkContract('VIDEO');vc.video!.durations=[1,2];
  if(!options.wrongAspect){vc.video!.ratios=['9:16'];vc.video!.dimensions=[{resolution:'480p',ratio:'9:16',width:360,height:640}];}
  const cfg=config({...db.cfg,generationEnabled:true,provider:{...db.cfg.provider,apiKey:'synthetic-not-real',baseUrl:ic.base_url,
    imageModel:ic.request_model,videoModel:vc.request_model,allowedHosts:['generation.example.test','media.example.test']}});
  const f=await mediaFixture({...db,cfg},{revisions:options.revisions??false,generation:{engine,contracts:[ic,vc],twoShots:true,
    variantId:engine==='PER_SHOT_AI'?'quiet-luxury.ai-detail':'portrait-social.ai-presenter-multi'},
    ...(options.repair?{configureContract:async(c:import('../../src/worker/compiler/snapshot.js').FrozenContract)=>{
      // Pre-sold synthetic allowance, never an in-flight limit increase.
      c.repair_ceiling_micro=1000000;c.codex_contract.max_turns_per_role=4;c.codex_contract.max_tool_calls=32;
      c.codex_contract.max_input_tokens=400000;c.runtime_binding!.limits.max_input_tokens=400000;
      c.runtime_binding!.limits.max_requests=16;c.runtime_binding!.limits.max_requests_per_role=4;
    }}:{})});
  f.cfg.provider.allowedHosts.push('generation.example.test','media.example.test');
  const calls:{url:string;method:string;body?:Record<string,unknown>}[]=[],tasks=new Map<string,string>(),images:number[]=[];let queryLost=false;
  const gateway=new GenerationGateway(db.pool,f.cfg,f.store,new ArkClient(f.cfg,async(url,_hosts,optionsHttp={})=>{
    const body=optionsHttp.body?JSON.parse(String(optionsHttp.body)) as Record<string,unknown>:undefined;
    calls.push({url,method:optionsHttp.method??'GET',...(body?{body}:{})});
    let value:unknown;
    if(url.includes('/images/generations')){
      if(options.unknownReference)throw new AppError('REMOTE_UNKNOWN','Synthetic lost acknowledgement',503);
      const bytes=String(body!.prompt).startsWith('修复以下封存复核定位的问题')?repairedImage:image;
      value={model:ic.actual_model,data:[{b64_json:bytes.toString('base64')}],usage:{generated_images:1}};
    }else if(optionsHttp.method==='POST'){
      const task=id('synthetic_video'),content=body!.content as {type:string;text?:string}[];
      const plan=JSON.parse(content.find(i=>i.type==='text')!.text!.split('\n').at(-1)!) as {shots:{shot_id:string}[]};
      const repairing=content.find(i=>i.type==='text')!.text!.startsWith('修复以下封存复核定位的问题');
      tasks.set(task,engine==='REFERENCE_FILM'?(repairing?'repaired-film':'film'):plan.shots[0]!.shot_id==='shot-1'?'red':'blue');value={id:task};
    }else if(url.startsWith('https://media.example.test/'))value=clips.get(tasks.get(url.split('/').at(-1)!.replace('.mp4',''))!)!;
    else {if(options.loseFirstQuery&&!queryLost){queryLost=true;throw new AppError('REMOTE_UNKNOWN','Synthetic original status timeout',503);}
      const task=url.split('/').at(-1)!;value={id:task,model:vc.actual_model,status:'succeeded',
      content:{video_url:`https://media.example.test/${task}.mp4`},usage:{completion_tokens:250,total_tokens:250}};}
    const bytes=Buffer.isBuffer(value)?value:Buffer.from(JSON.stringify(value));
    return {status:200,headers:{},bytes,json:()=>JSON.parse(bytes.toString('utf8')) as unknown};
  }));
  const app=await buildApp({cfg:f.cfg,pool:db.pool,inferenceHttp:async(_cfg,_url,o)=>{
    const input=JSON.parse(o!.body!.toString()).input[0].content as {type:string}[];
    images.push(Array.isArray(input)?input.filter(c=>c.type==='input_image').length:0);
    return {status:200,headers:{'content-type':'text/event-stream'},bytes:syntheticSse(f.admission),json:()=>null};
  }});
  if(options.repair)app.addHook('onSend',async(_request,reply,payload)=>{
    if(reply.statusCode>=400&&typeof payload==='string'){
      try{const body=JSON.parse(payload),code=body.error?.code??body.code;
        if(typeof code==='string'&&/^[A-Z][A-Z0-9_]{1,79}$/.test(code))console.log(`Synthetic HTTP gate: ${reply.statusCode}/${code}`);
      }catch{/* Diagnostic output never includes response bodies. */}
    }return payload;
  });
  await app.listen({host:'127.0.0.1',port:0});const address=app.server.address();if(!address||typeof address==='string')throw new Error('Missing HTTPS');
  f.cfg.publicBaseUrl=`https://localhost:${address.port}`;
  const controller=new AbortController(),launcher=new FixtureLauncher(options.mode),executor=new CodexRuntimeAdapter(db.pool,f.cfg,launcher);
  const media=productionTools(db.pool,f.cfg,f.store,gateway),review=reviewTools(db.pool,f.cfg,f.store);
  const repair=repairPlanningTools(db.pool),handlers:Record<string,ToolHandler>={};
  const aftercare=revisionTools(db.pool,f.cfg,f.store);
  for(const name of new Set([...Object.keys(media),...Object.keys(review),...Object.keys(repair)]))handlers[name]=(scope,...args)=>{
    const selected=scope.scope_type==='REVISION'?aftercare:scope.stage_name==='REPAIR_PLAN'?repair:scope.role.startsWith('REVIEW_')?review:media;
    return selected[name]!(scope,...args);
  };
  active.push({app,controller,task:new ToolConsumer(db.pool,id('generated_tools'),handlers).run(controller.signal)});
  return {...f,app,controller,launcher,executor,gateway,calls,images,
    service:new MediaStageService(db.pool,f.cfg,executor,{gateway,store:f.store})};
}
async function finish(lease:StageLease,handle:()=>Promise<(db:import('pg').PoolClient)=>Promise<void>>,coordinator?:RepairCoordinator){
  if(coordinator)console.log(`Synthetic repair stage ${lease.stage_name}/${lease.attempt}: START`);
  const commit=await withFixtureLease(db.pool,lease,handle);
  await completeStage(db.pool,lease,commit,coordinator?(client,current)=>coordinator.afterStageCommit(client,current):undefined);
  if(coordinator)console.log(`Synthetic repair stage ${lease.stage_name}/${lease.attempt}: COMMITTED`);
}
async function next(f:Awaited<ReturnType<typeof setup>>,name:string,parent:StageLease){
  const stageId=await enqueueStage(db.pool,{tenantId:f.p.tenantId,scopeType:'ORDER',scopeId:f.orderId,name,inputHash:f.snapshotHash,
    deadlineAt:f.snapshot.deadline_at,jobId:f.lease.job_id!,dependencies:[parent.id]});
  const lease=(await claimStage(db.pool,id('generated_worker'),[name]))!;expect(lease.id).toBe(stageId);return lease;
}
it.each(['PER_SHOT_AI','REFERENCE_FILM'] as const)('delivers the actual silent %s pack through reference review, production, post, QC and final independent reviews',async engine=>{
  const f=await setup(engine,{loseFirstQuery:true}),signal=f.controller.signal;
  // A crash after role completion but before stage commit must reuse its role,
  // supplier intents and charged responses after a real lease takeover.
  const first=await f.service.handle(f.lease,signal),posts=f.calls.filter(c=>c.method==='POST').length;
  expect(f.launcher.launches).toBe(2);expect(f.images[0]).toBe(3+(engine==='PER_SHOT_AI'?2:1));
  await db.pool.query("UPDATE stage_runs SET lease_expires_at=now()-interval '1 second' WHERE id=$1",[f.lease.id]);
  const old=f.lease,lease=(await claimStage(db.pool,id('takeover'),['PRODUCTION']))!;
  expect(lease.id).toBe(old.id);expect(Number(lease.fencing_token)).toBe(Number(old.fencing_token)+1);
  await finish(lease,()=>f.service.handle(lease,signal));expect(f.launcher.launches).toBe(2);
  await expect(completeStage(db.pool,old,first)).rejects.toMatchObject({code:'LEASE_LOST'});
  expect(f.calls.filter(c=>c.method==='POST')).toHaveLength(posts);
  const post=(await claimStage(db.pool,id('post'),['POST']))!;await finish(post,()=>f.service.handle(post,signal));
  const qc=await next(f,'QC',post);await finish(qc,()=>new QualityControlService(db.pool,f.cfg,f.store).handle(qc,signal));
  const reviewer=new ReviewStageService(db.pool,f.cfg,f.executor);
  const facts=await next(f,'REVIEW_FACTS',qc);await finish(facts,()=>reviewer.handle(facts,signal));
  const style=await next(f,'REVIEW_STYLE',facts);await finish(style,()=>reviewer.handle(style,signal));
  const delivery=await next(f,'DELIVER',style),publisher=new PublicationService(db.pool,f.cfg,f.store);
  const context=await executionContext(db.pool,f.p.tenantId,f.orderId,f.snapshotHash),postPack=await operationArtifacts(db.pool,context,'POST');
  for(const a of postPack.receipt.artifacts.filter(a=>a.spec.kind!=='copy')){
    expect(a.spec.generation_sources!.length).toBeGreaterThan(0);expect(a.spec.reference_approval_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(a.spec.ai_disclosure).toMatchObject({contract_hash:hash(f.contract.ai_disclosure_contract),output_sha256:a.sha256,
      frames_checked:a.spec.kind==='video'?60:1});
  }
  const commit=await publisher.handle(delivery,signal);
  // Publication repeats source authorization in its transaction, including a
  // reference revoked after preflight. Rollback cannot publish a partial pack.
  const source=(await db.pool.query("SELECT private FROM provider_submissions WHERE order_id=$1 AND generation_kind='VIDEO' LIMIT 1",[f.orderId])).rows[0].private.output;
  await db.pool.query('UPDATE private_object_writes SET delete_requested=true WHERE object_key=$1',[source.object_key]);
  await expect(completeStage(db.pool,delivery,commit)).rejects.toMatchObject({code:'GENERATION_MEDIA_REVOKED'});
  expect((await db.pool.query('SELECT id FROM delivery_manifests WHERE order_id=$1',[f.orderId])).rowCount).toBe(0);
  await db.pool.query('UPDATE private_object_writes SET delete_requested=false WHERE object_key=$1',[source.object_key]);
  await completeStage(db.pool,delivery,commit);
  const pack=await getDeliverables(db.pool,f.p,f.orderId);expect(pack.items).toHaveLength(f.snapshot.outputs.length);
  const item=pack.items.find(i=>i.kind==='video')!;expect(item.duration_frames).toBe(60);expect(item.fps).toBe(30);
  const link=await createDownloadLink(db.pool,f.cfg,f.p,item.deliverable_id),url=new URL(link.url);
  const download=await f.app.inject({method:'GET',url:url.pathname+url.search});expect(download.statusCode).toBe(200);
  expect(sha256(download.rawPayload)).toBe(item.sha256);
  const actual=join(root,`${engine}.mp4`);await writeFile(actual,download.rawPayload);const inspected=await inspectVideo(f.cfg,actual,signal);
  expect(inspected).toMatchObject({width:1080,height:1920,frames:60,fps:30,hasAudio:false});
  for(const [index,red] of [[5,true],[45,false]] as const){
    const path=join(root,`${engine}-${index}.png`);
    await nativeCommand(f.cfg,process.env.FFMPEG_PATH?.trim()||'ffmpeg',['-v','error','-i',actual,'-vf',`select=eq(n\\,${index})`,
      '-frames:v','1',path],{cwd:root,timeoutMs:30000,signal});const stats=await sharp(path).stats();
    expect(red?stats.channels[0]!.mean-stats.channels[2]!.mean:stats.channels[2]!.mean-stats.channels[0]!.mean).toBeGreaterThan(150);
  }
  const runs=(await db.pool.query(`SELECT r.id,r.role,r.state,i.state AS instance_state FROM agent_runs r JOIN agent_instances i ON i.id=r.instance_id
    WHERE i.order_id=$1`,[f.orderId])).rows;expect(runs).toHaveLength(5);expect(new Set(runs.map(r=>r.id)).size).toBe(5);
  expect(runs.every(r=>r.state==='SUCCEEDED'&&r.instance_state==='RELEASED')).toBe(true);
  const counts=(await db.pool.query(`SELECT r.role,count(*)::int AS n FROM inference_requests q JOIN agent_runs r ON r.id=q.run_id
    WHERE q.scope_id=$1 GROUP BY r.role ORDER BY r.role`,[f.orderId])).rows;
  expect(counts).toEqual([{role:'POST',n:1},{role:'PRODUCTION',n:1},{role:'REVIEW_FACTS',n:2},{role:'REVIEW_STYLE',n:1}]);
  const submissions=(await db.pool.query('SELECT operation_key,state FROM provider_submissions WHERE order_id=$1',[f.orderId])).rows;
  expect(submissions.every(s=>s.state==='SUCCEEDED')).toBe(true);expect(new Set(submissions.map(s=>s.operation_key)).size).toBe(submissions.length);
  expect(f.calls.filter(c=>c.method==='POST')).toHaveLength(submissions.length);
  expect((await db.pool.query("SELECT id FROM provider_submissions WHERE order_id=$1 AND generation_kind='VIDEO' AND private->>'last_error'='REMOTE_UNKNOWN'",[f.orderId])).rowCount).toBe(1);
  const packTools=(await db.pool.query("SELECT state,data->>'error_code' AS code FROM agent_tool_intents WHERE stage_run_id=$1 AND tool_name='render_generated_pack'",[lease.id])).rows;
  expect(packTools).toEqual([{state:'SUCCEEDED',code:'GENERATION_PACK_PENDING'}]);
  const money=(await db.pool.query('SELECT reserved_micro::int AS reserved,spent_micro::int AS spent,private FROM orders WHERE id=$1',[f.orderId])).rows[0];
  expect(money.reserved).toBe(0);expect(money.spent).toBeGreaterThan(0);expect(hash(money.private.contract)).toBe(hash(f.contract));
  expect((await db.pool.query("SELECT id FROM outbox_events WHERE aggregate_id=$1 AND aggregate_type='ReleaseRequested' AND event_key=$2",[f.orderId,`release:delivered:${f.orderId}`])).rowCount).toBe(1);
},120000);
it.each(['REFERENCE_FAIL','REFERENCE_UNCERTAIN'])('stops %s before starting production or buying a video and reuses the original decision',async mode=>{
  const f=await setup('PER_SHOT_AI',{mode});
  for(let i=0;i<2;i++)await expect(f.service.handle(f.lease,f.controller.signal)).rejects.toMatchObject({code:'REFERENCE_IDENTITY_REJECTED'});
  expect(f.launcher.launches).toBe(1);expect(f.calls.filter(c=>c.method==='POST')).toHaveLength(2);
  expect((await db.pool.query("SELECT id FROM provider_submissions WHERE order_id=$1 AND generation_kind='VIDEO'",[f.orderId])).rowCount).toBe(0);
  expect((await db.pool.query('SELECT id FROM media_operations WHERE order_id=$1',[f.orderId])).rowCount).toBe(0);
});
it('refuses an unsupported sold video aspect before any reference purchase or role',async()=>{
  const f=await setup('REFERENCE_FILM',{wrongAspect:true});
  await expect(f.service.handle(f.lease,f.controller.signal)).rejects.toMatchObject({code:'GENERATION_VIDEO_SPEC_UNAVAILABLE'});
  expect(f.calls).toHaveLength(0);expect(f.launcher.launches).toBe(0);
});
it('rejects insufficient original reference/final-review quotas, vision capacity and durations at admission',async()=>{
  const f=await setup('PER_SHOT_AI');
  for(const [change,code] of [
    [(c:typeof f.contract)=>{c.runtime_binding!.limits.max_requests_per_role=1;},'GENERATION_ROLE_BUDGET_INVALID'],
    [(c:typeof f.contract)=>{c.runtime_binding!.admission.review_vision!.max_images=4;},'REFERENCE_VISION_NOT_ADMITTED'],
    [(c:typeof f.contract)=>{c.generation_contracts!.find(c=>c.wire==='ARK_VIDEO')!.video!.durations=[2];
      const wire=c.generation_contracts!.find(c=>c.wire==='ARK_VIDEO')!;c.model_versions.find(m=>m.actual_model===wire.actual_model)!.capability_hash=hash(wire);},'GENERATION_VIDEO_SPEC_UNAVAILABLE']
  ] as const){const c=structuredClone(f.contract);change(c);expect(()=>validateGenerationExecution(c)).toThrowError(expect.objectContaining({code}));}
  expect(f.calls).toHaveLength(0);expect(f.launcher.launches).toBe(0);
});
it('retains an unknown reference purchase and its original hold without resubmitting or starting a reviewer',async()=>{
  const f=await setup('REFERENCE_FILM',{unknownReference:true});
  await expect(f.service.handle(f.lease,f.controller.signal)).rejects.toBeInstanceOf(PendingExternal);
  await expect(f.service.handle(f.lease,f.controller.signal)).rejects.toMatchObject({code:'GENERATION_REFERENCE_PENDING'});
  expect(f.calls.filter(c=>c.method==='POST')).toHaveLength(1);expect(f.launcher.launches).toBe(0);
  const rows=(await db.pool.query('SELECT state FROM provider_submissions WHERE order_id=$1',[f.orderId])).rows;expect(rows).toEqual([{state:'UNKNOWN'}]);
  expect((await db.pool.query('SELECT reserved_micro::int AS n FROM orders WHERE id=$1',[f.orderId])).rows[0].n).toBe(100);
});

it.each([
  {engine:'PER_SHOT_AI' as const,kind:'image',nodes:1},
  {engine:'REFERENCE_FILM' as const,kind:'video',nodes:2}
])('repairs the actual silent $engine $kind candidate using only authorized purchases and fresh reviews',async({engine,kind,nodes})=>{
  const f=await setup(engine,{repair:true}),signal=f.controller.signal,coordinator=new RepairCoordinator(f.cfg);
  const qcService=new QualityControlService(db.pool,f.cfg,f.store),review=new ReviewStageService(db.pool,f.cfg,f.executor);
  const failing=new ReviewStageService(db.pool,f.cfg,new CodexRuntimeAdapter(db.pool,f.cfg,
    new FixtureLauncher(kind==='image'?'REVIEW_LOCATED_FAIL':'REVIEW_VIDEO_FAIL')));
  let parent=(await db.pool.query("SELECT id FROM stage_runs WHERE job_id=$1 AND stage_name='POST'",[f.lease.job_id])).rows[0].id;
  for(const name of ['QC','REVIEW_FACTS','REVIEW_STYLE','DELIVER'])parent=await enqueueStage(db.pool,{tenantId:f.p.tenantId,
    scopeType:'ORDER',scopeId:f.orderId,name,inputHash:f.snapshotHash,deadlineAt:f.snapshot.deadline_at,jobId:f.lease.job_id!,dependencies:[parent]});
  await finish(f.lease,()=>f.service.handle(f.lease,signal),coordinator);
  for(const name of ['POST','QC','REVIEW_FACTS','REVIEW_STYLE']){
    const lease=(await claimStage(db.pool,id('first'),[name]))!;
    await finish(lease,()=>name==='POST'?f.service.handle(lease,signal):name==='QC'?qcService.handle(lease,signal)
      :name==='REVIEW_FACTS'?failing.handle(lease,signal):review.handle(lease,signal),coordinator);
  }
  const base=await executionContext(db.pool,f.p.tenantId,f.orderId,f.snapshotHash),old=await currentReviewPacket(db.pool,base);
  expect(old.state).toBe('FAILED');expect(old.reports).toHaveLength(2);
  expect(await claimStage(db.pool,id('blocked'),['DELIVER'])).toBeNull();
  const grant=(await db.pool.query('SELECT generation_nodes FROM repair_cost_authorizations WHERE order_id=$1',[f.orderId])).rows[0];
  expect(grant.generation_nodes).toHaveLength(nodes);
  const purchases=f.calls.filter(c=>c.method==='POST').length;
  const prep=(await claimStage(db.pool,id('repair'),['REPAIR_PLAN']))!;
  await finish(prep,()=>new RepairPlanningService(db.pool,f.cfg,f.executor).handle(prep,signal),coordinator);
  const production=(await claimStage(db.pool,id('repair'),['PRODUCTION']))!;
  const repair=await executionContext(db.pool,f.p.tenantId,f.orderId,f.snapshotHash,production.id);
  const untouched=repair.snapshot.outputs.find(s=>s.kind==='image'&&!repair.repair!.target_slot_ids.includes(s.slot_id))!;
  const changed=imageRequest(repair,untouched.slot_id);changed.prompt+=' unauthorized change';
  await expect(f.gateway.submit(production,changed,signal)).rejects.toMatchObject({code:'REPAIR_REUSE_INPUT_CHANGED'});
  expect(f.calls.filter(c=>c.method==='POST')).toHaveLength(purchases);
  await finish(production,()=>f.service.handle(production,signal),coordinator);
  expect(f.calls.filter(c=>c.method==='POST')).toHaveLength(purchases+nodes);
  const rows=(await db.pool.query(`SELECT operation_key,stage_run_id,state FROM provider_submissions WHERE order_id=$1
    AND generation_kind IN ('IMAGE','VIDEO') ORDER BY created_at`,[f.orderId])).rows;
  expect(rows.filter(r=>r.stage_run_id===production.id)).toHaveLength(nodes);
  expect(rows.every(r=>r.state==='SUCCEEDED')).toBe(true);
  for(const name of ['POST','QC','REVIEW_FACTS','REVIEW_STYLE']){
    const lease=(await claimStage(db.pool,id('repair'),[name]))!;expect(lease.attempt).toBe(2);
    await finish(lease,()=>name==='POST'?f.service.handle(lease,signal):name==='QC'?qcService.handle(lease,signal):review.handle(lease,signal),coordinator);
  }
  const delivery=(await claimStage(db.pool,id('repair'),['DELIVER']))!;
  const candidateContext=await executionContext(db.pool,f.p.tenantId,f.orderId,f.snapshotHash,delivery.id);
  const candidate=await currentReviewPacket(db.pool,candidateContext);
  expect(candidate.state).toBe('PASSED');expect(candidate.packet_hash).not.toBe(old.packet_hash);
  for(const target of candidateContext.repair!.target_slot_ids)
    expect(candidate.outputs.find(o=>o.slot_id===target)!.sha256).not.toBe(old.outputs.find(o=>o.slot_id===target)!.sha256);
  expect(new Set([...old.reports,...candidate.reports].map(r=>r.runtime_process_ref)).size).toBe(4);
  await expect(validateReviewReport(db.pool,f.cfg,candidateContext,candidate,old.reports[1]!.run_id,old.reports[1])).rejects.toThrow();
  const referenceRuns=(await db.pool.query(`SELECT r.thread_id,r.data->>'runtime_process_ref' AS runtime_process_ref
    FROM agent_runs r JOIN agent_instances i ON i.tenant_id=r.tenant_id AND i.id=r.instance_id WHERE i.order_id=$1
    AND r.private->'review_input'->>'purpose'='REFERENCE_IDENTITY'`,[f.orderId])).rows;
  expect(referenceRuns).toHaveLength(2);expect(new Set(referenceRuns.map(r=>r.runtime_process_ref)).size).toBe(2);
  const publisher=new PublicationService(db.pool,f.cfg,f.store);
  await finish(delivery,()=>publisher.handle(delivery,signal),coordinator);
  const pack=await getDeliverables(db.pool,f.p,f.orderId);expect(pack.items).toHaveLength(f.snapshot.outputs.length);
  const costs=(await db.pool.query(`SELECT purpose,state,count(*)::int AS n FROM budget_reservations WHERE order_id=$1
    GROUP BY purpose,state`,[f.orderId])).rows;
  expect(costs.find(c=>c.purpose==='REPAIR')).toMatchObject({state:'SETTLED',n:6+nodes});
  expect((await db.pool.query('SELECT repair_rounds FROM render_jobs WHERE order_id=$1',[f.orderId])).rows[0].repair_rounds).toBe(1);
  expect((await db.pool.query("SELECT id FROM agent_instances WHERE order_id=$1 AND state<>'RELEASED'",[f.orderId])).rowCount).toBe(0);
  const order=(await db.pool.query('SELECT private,budget_micro,deadline_at,fulfillment_state FROM orders WHERE id=$1',[f.orderId])).rows[0];
  expect(hash(order.private.contract)).toBe(hash(f.contract));expect(Number(order.budget_micro)).toBe(f.contract.budget_micro);
  expect(order.deadline_at.toISOString()).toBe(f.snapshot.deadline_at);expect(order.fulfillment_state).toBe('DELIVERED');
});


class AftercareLauncher extends FixtureLauncher{
  override async launch(path:string,manifest:NativeLaunchManifest){const result=await super.launch(path,manifest);
    result.receipt.os_identity_ref=`SYNTHETIC-NOT-RESTRICTED:${manifest.run_id}`;result.receipt.process_ref+=`:${manifest.run_id}`;return result;}
}
it.each(['PER_SHOT_AI','REFERENCE_FILM'] as const)('preserves both silent-generated aftercare flows for %s without repurchasing media or spending the customer success on a platform correction',async engine=>{
  const f=await setup(engine,{revisions:true}),signal=f.controller.signal;
  await finish(f.lease,()=>f.service.handle(f.lease,signal));const post=(await claimStage(db.pool,id('aftercare'),['POST']))!;
  await finish(post,()=>f.service.handle(post,signal));let previous=post;
  for(const name of ['QC','REVIEW_FACTS','REVIEW_STYLE','DELIVER']){
    const lease=await next(f,name,previous);previous=lease;
    await finish(lease,()=>name==='QC'?new QualityControlService(db.pool,f.cfg,f.store).handle(lease,signal):name==='DELIVER'?
      new PublicationService(db.pool,f.cfg,f.store).handle(lease,signal):new ReviewStageService(db.pool,f.cfg,f.executor).handle(lease,signal));
  }
  const original=await getDeliverables(db.pool,f.p,f.orderId),purchases=f.calls.filter(c=>c.method==='POST').length;
  const originalCost=(await db.pool.query('SELECT spent_micro,deadline_at,private FROM orders WHERE id=$1',[f.orderId])).rows[0];
  const token=(await issueSession(db.pool,{platform:'alipay',appId:f.p.appId,subjectId:f.p.subjectId})).access_token;
  const staffToken='SYNTHETIC-GENERATED-AFTERCARE-STAFF';f.cfg.managementTokens=JSON.stringify([{actor:'generated-aftercare-staff',token_hash:sha256(staffToken),permissions:['support:read','support:write','support:repair']}]);
  const user=(key=id('aftercare-http'))=>({authorization:`Bearer ${token}`,'idempotency-key':key});
  const staff=()=>({authorization:`Bearer ${staffToken}`,'idempotency-key':id('aftercare-staff-http')});
  const created=await f.app.inject({method:'POST',url:`/v1/p01/orders/${f.orderId}/tickets`,headers:user(),payload:{category:'PRODUCT_ERROR',message:'合成生成式封面纠错；只更换原包封面。',attachment_asset_ids:[]}});
  expect(created.statusCode,created.body).toBe(201);const ticket=created.json().data as DTO<'Ticket'>,ticketUrl=`/v1/internal/p01/support-tickets/${ticket.ticket_id}`;
  expect((await f.app.inject({method:'POST',url:ticketUrl+'/process',headers:staff(),payload:{action:'CLAIM',expected_revision:0}})).statusCode).toBe(200);
  const offered=await f.app.inject({url:ticketUrl+'/repair-context',headers:staff()});expect(offered.statusCode,offered.body).toBe(200);expect(offered.json().data.can_submit).toBe(true);
  const cover=original.items.filter(i=>i.kind==='image')[1]!.deliverable_id;
  const accepted=await f.app.inject({method:'POST',url:`/v1/internal/p01/orders/${f.orderId}/platform-repairs`,headers:staff(),
    payload:{ticket_id:ticket.ticket_id,expected_ticket_revision:1,change:{kind:'COVER',manifest_revision:1,cover_deliverable_id:cover}}});
  expect(accepted.statusCode,accepted.body).toBe(200);const correction=accepted.json().data as DTO<'Revision'>;expect(correction.consumes_user_allowance).toBe(false);
  const execute=async(revision:DTO<'Revision'>,revocationProbe=false)=>{
    const service=new RevisionService(db.pool,f.cfg,f.store,new CodexRuntimeAdapter(db.pool,f.cfg,new AftercareLauncher()));
    for(const name of REVISION_STAGES){const lease=(await claimStage(db.pool,id('aftercare-worker'),[name]))!;expect(lease.scope_id).toBe(revision.revision_id);
      if(name==='REVISION_QC'&&revocationProbe){
        const generated=(await db.pool.query("SELECT private->'output'->>'object_key' AS object_key FROM provider_submissions WHERE order_id=$1 AND generation_kind='VIDEO' LIMIT 1",[f.orderId])).rows[0].object_key;
        await db.pool.query('UPDATE private_object_writes SET delete_requested=true WHERE object_key=$1',[generated]);
        try{await expect(service.handle(lease,signal)).rejects.toMatchObject({code:'GENERATION_MEDIA_REVOKED'});expect((await getDeliverables(db.pool,f.p,f.orderId)).manifest_revision).toBe(1);}
        finally{await db.pool.query('UPDATE private_object_writes SET delete_requested=false WHERE object_key=$1',[generated]);}
      }
      try{await finish(lease,()=>service.handle(lease,signal));}catch(error){
        console.error(JSON.stringify({synthetic_fixture_only:true,stage:name,tools:(await db.pool.query("SELECT tool_name,state,data->>'error_code' AS code FROM agent_tool_intents WHERE stage_run_id=$1",[lease.id])).rows}));
        if(name==='REVISION'){try{await inspectCandidate(db.pool,f.cfg,f.store,await revisionContext(db.pool,f.p.tenantId,revision.revision_id),signal);}catch(probe){console.error(probe instanceof Error?probe.message:'Candidate failed');}}
        throw error;}
    }
  };
  await execute(correction,true);const corrected=await getDeliverables(db.pool,f.p,f.orderId);
  expect(corrected.manifest_revision).toBe(2);expect(corrected.cover_deliverable_id).toBe(cover);expect(corrected.items).toEqual(original.items);
  expect((await f.app.inject({url:ticketUrl+'/repair-context',headers:staff()})).json().data.repair).toMatchObject({state:'COMPLETED',consumes_user_allowance:false});
  const text=`${f.contract.creative.copy}\n实拍展示，欢迎了解。`,url=`/v1/p01/orders/${f.orderId}/revisions`,key=id('aftercare-buyer');
  const payload={kind:'DISPLAY_TEXT',manifest_revision:2,display_text:text};
  const requested=await f.app.inject({method:'POST',url,headers:user(key),payload});expect(requested.statusCode,requested.body).toBe(202);
  const revision=requested.json().data as DTO<'Revision'>;expect(revision.consumes_user_allowance).toBe(true);
  expect((await f.app.inject({method:'POST',url,headers:user(key),payload})).json().data).toEqual(revision);
  await execute(revision);const updated=await getDeliverables(db.pool,f.p,f.orderId),copy=updated.items.find(i=>i.kind==='copy')!;
  expect(updated.manifest_revision).toBe(3);expect(updated.parent_manifest_id).toBe(corrected.manifest_id);expect(updated.expires_at).toBe(original.expires_at);
  expect(updated.items.filter(i=>i.kind!=='copy')).toEqual(original.items.filter(i=>i.kind!=='copy'));
  const artifact=(await db.pool.query('SELECT object_key FROM artifacts WHERE id=$1',[copy.deliverable_id])).rows[0];expect((await f.store.get(artifact.object_key)).toString('utf8')).toBe(text);
  expect(f.calls.filter(c=>c.method==='POST')).toHaveLength(purchases);
  const order=(await db.pool.query('SELECT spent_micro,deadline_at,private FROM orders WHERE id=$1',[f.orderId])).rows[0];
  expect(order.spent_micro).toBe(originalCost.spent_micro);expect(order.deadline_at).toEqual(originalCost.deadline_at);expect(order.private.contract).toEqual(originalCost.private.contract);
  expect((await db.pool.query('SELECT data FROM delivery_manifests WHERE id=$1',[original.manifest_id])).rows[0].data).toEqual(original);
  const budget=(await db.pool.query('SELECT * FROM revision_budgets WHERE order_id=$1',[f.orderId])).rows[0];expect(Number(budget.spent_micro)).toBeGreaterThan(0);expect(Number(budget.ceiling_micro)).toBe(f.contract.revision_policy!.budget_micro);
  expect((await db.pool.query("SELECT id FROM inference_requests WHERE scope_type='REVISION' AND scope_id=ANY($1::text[])",[[correction.revision_id,revision.revision_id]])).rowCount).toBe(6);
  const denied=await f.app.inject({method:'POST',url,headers:user(),payload:{kind:'COVER',manifest_revision:3,cover_deliverable_id:original.items.filter(i=>i.kind==='image')[0]!.deliverable_id}});
  expect(denied.statusCode,denied.body).toBe(422);expect(denied.json().code).toBe('REVISION_ALLOWANCE_USED');
});
