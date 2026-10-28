import {beforeAll,afterAll,afterEach,it,expect} from 'vitest';
import {mkdir,readFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import type {FastifyInstance} from 'fastify';
import sharp from 'sharp';
import {testDatabase,type TestDatabase} from '../helpers/database.js';
import {mediaFixture} from '../helpers/media.js';
import {syntheticArkContract} from '../helpers/generation.js';
import {reviewGeneratedReferences} from '../helpers/reference.js';
import {syntheticSse} from '../helpers/codex.js';
import {FixtureLauncher} from '../helpers/role-launcher.js';
import {config,inside} from '../../src/api/config.js';
import {buildApp} from '../../src/api/app.js';
import {hash,id} from '../../src/api/lib/crypto.js';
import {ArkClient} from '../../src/worker/providers/ark.js';
import {GenerationGateway} from '../../src/worker/generation/gateway.js';
import {CodexRuntimeAdapter} from '../../src/worker/codex/runtime.js';
import {ToolConsumer} from '../../src/worker/tool-gateway/consumer.js';
import {generationTools} from '../../src/worker/tool-gateway/generation-tools.js';
import {claimStage} from '../../src/worker/queue/leases.js';
import {nativeCommand} from '../../src/worker/media/native.js';

let db:TestDatabase,image:Buffer,video:Buffer,mediaRoot:string;
const active:{app:FastifyInstance;controller:AbortController;task:Promise<void>}[]=[];
const signal=()=>new AbortController().signal;
beforeAll(async()=>{
  db=await testDatabase();image=await sharp({create:{width:640,height:800,channels:3,background:'#284E73'}}).jpeg().toBuffer();
  mediaRoot=inside(db.cfg.runtimeRoot,`tests/generation-tools/${id('media')}`);await mkdir(mediaRoot,{recursive:true});
  const path=join(mediaRoot,'actual.mp4');
  await nativeCommand(db.cfg,process.env.FFMPEG_PATH?.trim()||'ffmpeg',['-v','error','-f','lavfi','-i','color=c=green:s=360x640:r=24','-t','1','-an',
    '-c:v','libx264','-pix_fmt','yuv420p','-movflags','+faststart',path],{cwd:mediaRoot,timeoutMs:30000});video=await readFile(path);
});
afterEach(async()=>{
  for(const item of active.splice(0)){item.controller.abort();await item.task;await item.app.close();}
  await db.pool.query("UPDATE stage_runs SET state='CANCELLED' WHERE state NOT IN ('SUCCEEDED','FAILED')");
});
afterAll(async()=>{await db?.close();if(mediaRoot)await rm(mediaRoot,{recursive:true,force:true});});
interface ProbeCall {tool:string;arguments:Record<string,unknown>;expect_error?:boolean;wait_ms?:number}
async function setup(engine:'PER_SHOT_AI'|'REFERENCE_FILM'='REFERENCE_FILM',wrongAspect=false){
  const imageContract=syntheticArkContract('IMAGE'),videoContract=syntheticArkContract('VIDEO');
  if(!wrongAspect){videoContract.video!.ratios=['9:16'];videoContract.video!.dimensions=[{resolution:'480p',ratio:'9:16',width:360,height:640}];}
  const cfg=config({...db.cfg,generationEnabled:true,provider:{...db.cfg.provider,apiKey:'synthetic-not-real',
    baseUrl:imageContract.base_url,imageModel:imageContract.request_model,videoModel:videoContract.request_model,
    allowedHosts:['generation.example.test','media.example.test']}});
  const f=await mediaFixture({...db,cfg},{generation:{engine,contracts:[imageContract,videoContract],
    variantId:engine==='PER_SHOT_AI'?'quiet-luxury.ai-detail':'portrait-social.ai-presenter-multi'}});
  f.cfg.provider.allowedHosts.push('generation.example.test','media.example.test');
  const calls:{url:string;method:string;body?:unknown}[]=[];
  const gateway=new GenerationGateway(db.pool,f.cfg,f.store,new ArkClient(f.cfg,async(url,_hosts,options={})=>{
    calls.push({url,method:options.method??'GET',...(options.body?{body:JSON.parse(String(options.body)) as unknown}:{})});
    const value=url.includes('/images/generations')?{model:imageContract.actual_model,data:[{b64_json:image.toString('base64')}],usage:{generated_images:1}}
      :options.method==='POST'?{id:'synthetic-tool-video'}:url.startsWith('https://media.example.test/')?video
        :{id:'synthetic-tool-video',model:videoContract.actual_model,status:'succeeded',content:{video_url:'https://media.example.test/original.mp4'},usage:{completion_tokens:250,total_tokens:250}};
    const bytes=Buffer.isBuffer(value)?value:Buffer.from(JSON.stringify(value));return {status:200,headers:{},bytes,json:()=>JSON.parse(bytes.toString('utf8')) as unknown};
  }));
  const app=await buildApp({cfg:f.cfg,pool:db.pool,inferenceHttp:async()=>({status:200,headers:{'content-type':'text/event-stream'},bytes:syntheticSse(f.admission),json:()=>null})});
  await app.listen({host:'127.0.0.1',port:0});const address=app.server.address();if(!address||typeof address==='string')throw new Error('No MCP listener');
  f.cfg.publicBaseUrl=`https://localhost:${address.port}`;
  const controller=new AbortController();
  const handlers=generationTools(db.pool,f.cfg,f.store,gateway);
  // Test-only protocol observation persistence, deliberately not a production
  // result or media receipt. It cannot advance the original parent stage.
  handlers.persist_stage_result=async(scope,args)=>({result:args.result,commit:async client=>{
    await client.query("UPDATE agent_runs SET output_hash=$2,private=private||jsonb_build_object('stage_result',$3::jsonb) WHERE id=$1",
      [scope.run_id,hash(args.result),JSON.stringify(args.result)]);
  }});
  active.push({app,controller,task:new ToolConsumer(db.pool,id('generation_mcp'),handlers).run(controller.signal)});
  const executor=new CodexRuntimeAdapter(db.pool,f.cfg,new FixtureLauncher());
  const probe=async(calls:ProbeCall[],lease=f.lease)=>executor.execute({lease,role:lease.stage_name as 'PRODUCTION'|'POST',
    variantId:f.snapshot.variant_id,bundleHash:f.snapshot.codex_contract.skill_bundle_hash,admission:f.admission,limits:f.contract.runtime_binding!.limits,
    maxToolCalls:24,maxScopeToolCalls:24,allowedTools:[...new Set([...calls.map(call=>call.tool),'persist_stage_result'])],
    input:{phase:'GENERATION_TOOL_PROBE',calls},outputSchema:{type:'object',additionalProperties:false,required:['results'],properties:{results:{type:'array',items:{type:'object'}}}}},signal());
  const shot=engine==='REFERENCE_FILM'?'film':f.contract.creative.shots[0]!.shot_id;
  const reference=async()=>{
    const result=await probe([{tool:'generate_reference_frames',arguments:{shot_id:shot}}]);
    return (result.result as {results:{submission_id:string;state:string}[]}).results[0]!;
  };
  const takeover=async()=>{
    // The current runtime correctly forbids a second same-role run in one
    // stage generation. Exercise original-stage recovery, not an index bypass.
    await db.pool.query("UPDATE stage_runs SET lease_expires_at=now()-interval '1 second' WHERE id=$1",[f.lease.id]);
    const next=(await claimStage(db.pool,id('generation_takeover'),['PRODUCTION']))!;
    expect(next.id).toBe(f.lease.id);expect(Number(next.fencing_token)).toBe(Number(f.lease.fencing_token)+1);f.lease=next;return next;
  };
  return {...f,gateway,calls,probe,reference,shot,takeover};
}

it.each(['PER_SHOT_AI','REFERENCE_FILM'] as const)('executes scoped reference/video/query MCP for %s using the approved generated PNG',async engine=>{
  const f=await setup(engine),reference=await f.reference();expect(reference.state).toBe('SUCCEEDED');
  const approval=await reviewGeneratedReferences(db,f);expect(approval.frames[0]!.asset_id).toBe(reference.submission_id);
  await f.takeover();
  const role=await f.probe([{tool:'submit_video',arguments:{shot_id:engine==='REFERENCE_FILM'?null:f.shot}},
    {tool:'query_original_submission',arguments:{submission_id:'$PREVIOUS'},wait_ms:1250}]);
  const results=(role.result as {results:{submission_id:string;state:string;output?:unknown}[]}).results;
  expect(results.map(r=>r.state)).toEqual(['RUNNING','SUCCEEDED']);expect(results[1]!.submission_id).toBe(results[0]!.submission_id);
  expect(f.calls.filter(c=>c.method==='POST')).toHaveLength(2); // One reference + one video, independent of query count.
  expect(JSON.stringify(results)).not.toMatch(/object_key|https:|Bearer|synthetic-not-real/);
  const submission=(await db.pool.query('SELECT private FROM provider_submissions WHERE id=$1',[results[0]!.submission_id])).rows[0];
  expect(submission.private.prepared.references[0].id).toBe(reference.submission_id);expect(submission.private.prepared.reference_approval).toEqual(approval);
  expect((await db.pool.query('SELECT state FROM stage_runs WHERE id=$1',[f.lease.id])).rows[0].state).toBe('RUNNING');
});
it('rejects a video MCP call before reference approval without reserving a supplier purchase',async()=>{
  const f=await setup();await f.probe([{tool:'submit_video',arguments:{shot_id:null},expect_error:true}]);
  expect(f.calls).toHaveLength(0);
  expect((await db.pool.query("SELECT data->>'error_code' AS code FROM agent_tool_intents WHERE stage_run_id=$1 AND tool_name='submit_video'",[f.lease.id])).rows).toEqual([{code:'GENERATION_REFERENCE_REVIEW_REQUIRED'}]);
  expect((await db.pool.query('SELECT reserved_micro::int AS reserved FROM orders WHERE id=$1',[f.orderId])).rows[0].reserved).toBe(0);
});
it('refuses model-supplied prompts, original reference IDs and unplanned shot IDs at the tool boundary',async()=>{
  const f=await setup();await f.probe([
    {tool:'generate_reference_frames',arguments:{shot_id:'film',prompt:'Override frozen content',reference_asset_ids:f.assetIds},expect_error:true},
    {tool:'generate_reference_frames',arguments:{shot_id:'another-shot'},expect_error:true},
  ]);expect(f.calls).toHaveLength(0);
  expect((await db.pool.query("SELECT id FROM provider_submissions WHERE order_id=$1",[f.orderId])).rowCount).toBe(0);
});
it('does not silently replace the sold video aspect ratio when the frozen supplier cannot provide it',async()=>{
  const f=await setup('REFERENCE_FILM',true);await f.reference();await reviewGeneratedReferences(db,f);await f.takeover();
  await f.probe([{tool:'submit_video',arguments:{shot_id:null},expect_error:true}]);
  expect(f.calls.filter(c=>c.method==='POST')).toHaveLength(1);
  expect((await db.pool.query("SELECT data->>'error_code' AS code FROM agent_tool_intents WHERE stage_run_id=$1 AND tool_name='submit_video'",[f.lease.id])).rows).toEqual([{code:'GENERATION_VIDEO_SPEC_UNAVAILABLE'}]);
  expect((await db.pool.query("SELECT id FROM provider_submissions WHERE order_id=$1 AND generation_kind='VIDEO'",[f.orderId])).rowCount).toBe(0);
});
it('allows POST to read only a completed original result, with no supplier purchase or query',async()=>{
  const f=await setup(),reference=await f.reference();
  // This fixture transition tests the POST input boundary only. It does not
  // claim that the unimplemented generated production pack has completed.
  await db.pool.query("UPDATE stage_runs SET state='SUCCEEDED',lease_owner=NULL,lease_expires_at=NULL WHERE id=$1",[f.lease.id]);
  const post=(await claimStage(db.pool,id('generation_post'),['POST']))!;expect(post.scope_id).toBe(f.orderId);
  const before=f.calls.length,result=await f.probe([{tool:'query_original_submission',arguments:{submission_id:reference.submission_id}}],post);
  expect((result.result as {results:{state:string}[]}).results[0]!.state).toBe('SUCCEEDED');expect(f.calls).toHaveLength(before);
  expect(JSON.stringify(result.result)).not.toMatch(/object_key|https:|Bearer/);
});
