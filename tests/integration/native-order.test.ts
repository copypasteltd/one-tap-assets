import {beforeAll,afterAll,afterEach,it,expect} from 'vitest';
import {mkdir,readFile,rm,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import type {FastifyInstance} from 'fastify';
import sharp from 'sharp';
import {testDatabase,type TestDatabase} from '../helpers/database.js';
import {nativeOrderFixture} from '../helpers/native-order.js';
import {withFixtureLease} from '../helpers/lease.js';
import {syntheticSse} from '../helpers/codex.js';
import {FixtureLauncher} from '../helpers/role-launcher.js';
import {inside} from '../../src/api/config.js';
import {buildApp} from '../../src/api/app.js';
import {insert} from '../../src/api/db/store.js';
import {transaction} from '../../src/api/db/pool.js';
import {addSeconds,hash,id,sha256} from '../../src/api/lib/crypto.js';
import {createOrder} from '../../src/api/modules/commerce.js';
import {ArkClient} from '../../src/worker/providers/ark.js';
import {SpeechClient,type SpeechTransport} from '../../src/worker/providers/dashscope-asr.js';
import {GenerationGateway} from '../../src/worker/generation/gateway.js';
import {validateGenerationExecution} from '../../src/worker/generation/contracts.js';
import {SpeechGateway} from '../../src/worker/speech/gateway.js';
import {frozenNativeAudio} from '../../src/worker/audio/contract.js';
import {executionContext} from '../../src/worker/compiler/order-context.js';
import {NativeOrderMediaPipeline} from '../../src/worker/media/native-order-pipeline.js';
import {assembleNativeAudio,verifyNativeAssembly,type NativeSegment} from '../../src/worker/media/native-audio-assembly.js';
import {operationArtifacts} from '../../src/worker/media/artifacts.js';
import {nativeCommand,inspectVideo} from '../../src/worker/media/native.js';
import {CodexRuntimeAdapter} from '../../src/worker/codex/runtime.js';
import {MediaStageService} from '../../src/worker/codex/media-stage.js';
import {QualityControlService,verifySealedEvidence} from '../../src/worker/review/qc.js';
import {currentReviewPacket,packetMaterial} from '../../src/worker/review/context.js';
import {nativeAudioQc,verifyNativeAudioEvidence,NATIVE_QC_KINDS} from '../../src/worker/review/native-audio.js';
import {ReviewStageService} from '../../src/worker/review/stage.js';
import {PublicationService} from '../../src/worker/review/publication.js';
import {ToolConsumer,type ToolHandler} from '../../src/worker/tool-gateway/consumer.js';
import {productionTools} from '../../src/worker/tool-gateway/production-tools.js';
import {reviewTools} from '../../src/worker/tool-gateway/review-tools.js';
import type {ToolScope} from '../../src/worker/tool-gateway/http.js';
import {claimStage,completeStage,deferStage,PendingExternal,type StageLease} from '../../src/worker/queue/leases.js';
import {enqueueStage} from '../../src/worker/queue/enqueue.js';
import {NativeListeningGateway} from '../../src/worker/audio/listening-gateway.js';
import {ListeningClient,type PreparedListening} from '../../src/worker/providers/omni-listening.js';
import {syntheticListeningResult,syntheticControlListeningPass,listeningSse} from '../helpers/listening.js';
import {createDownloadLink,getDeliverables} from '../../src/api/modules/delivery.js';
import {writePrivateObject} from '../../src/api/storage/private-objects.js';
import {frozenOrderListening} from '../../src/worker/audio/listening-contract.js';

// Real native PostgreSQL, HTTPS/stdio/MCP, actual tone/PNG/MP4/ALAC/AAC bytes.
// Authorizations, recognizer text/usage, generation and isolation are synthetic.
let db:TestDatabase,root:string,image:Buffer,music:Buffer;
const clips=new Map<string,Buffer>(),active:{app:FastifyInstance;controller:AbortController;task:Promise<void>}[]=[];
beforeAll(async()=>{
  db=await testDatabase();root=inside(db.cfg.runtimeRoot,`tests/native-order/${id('media')}`);await mkdir(root,{recursive:true});
  image=await sharp({create:{width:640,height:800,channels:3,background:'#295D49'}}).jpeg().toBuffer();
  for(const [key,color,frequency,seconds] of [['red','red',440,1],['blue','blue',880,1],['film','green',660,2]] as const){
    const path=join(root,`${key}.mp4`);await nativeCommand(db.cfg,process.env.FFMPEG_PATH?.trim()||'ffmpeg',['-v','error','-f','lavfi','-i',`color=c=${color}:s=360x640:r=30:d=${seconds}`,
      '-f','lavfi','-i',`sine=frequency=${frequency}:sample_rate=48000:duration=${seconds}`,'-frames:v',String(seconds*30),'-c:v','libx264','-threads','2','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-ac','2','-y',path],
    {cwd:root,timeoutMs:30000});clips.set(key,await readFile(path));
  }
  const path=join(root,'licensed-test-tone.wav');await nativeCommand(db.cfg,process.env.FFMPEG_PATH?.trim()||'ffmpeg',['-v','error','-f','lavfi','-i','sine=frequency=220:sample_rate=48000:duration=1',
    '-af','volume=0.1','-ac','2','-c:a','pcm_s16le','-y',path],{cwd:root,timeoutMs:30000});music=await readFile(path);
});
afterEach(async context=>{
  // Preserve the original failure before a long serial suite or teardown ends.
  // Test-only diagnostics stay in ignored runtime, never in published media.
  const task=context.task as {name:string;result?:{errors?:{name?:string;message?:string;stack?:string;code?:unknown}[]}};
  if(task.result?.errors?.length&&db?.cfg)await writeFile(inside(db.cfg.runtimeRoot,`test-results/${id('native-order-failure')}.json`),
    JSON.stringify({test:task.name,errors:task.result.errors.map(e=>({name:e.name,message:e.message,code:e.code,stack:e.stack}))}),{flag:'wx'});
  for(const item of active.splice(0)){item.controller.abort();await item.task;await item.app.close();}
  await db.pool.query("UPDATE stage_runs SET state='CANCELLED' WHERE state NOT IN ('SUCCEEDED','FAILED')");
  await db.pool.query("UPDATE agent_tool_intents SET state='CANCELLED' WHERE state IN ('QUEUED','UNKNOWN','RUNNING')");
  await db.pool.query('UPDATE agent_capabilities SET revoked_at=COALESCE(revoked_at,now())');
});
afterAll(async()=>{await db?.close();if(root)await rm(inside(db.cfg.runtimeRoot,root),{recursive:true,force:true});});

async function setup(options:{engine?:'PER_SHOT_AI'|'REFERENCE_FILM';music?:boolean;lostAsrAck?:boolean;crashPostCommit?:boolean;revokePostCommit?:boolean;listening?:boolean;dropListeningProof?:boolean}={}){
  const f=await nativeOrderFixture(db,join(root,id('order')),{engine:options.engine??'PER_SHOT_AI',...(options.music?{music}:{}),style:options.engine==='REFERENCE_FILM'?'minimal':'karaoke',...(options.listening?{listening:true}:{})});
  const {image:ic,video:vc}=f.models,tasks=new Map<string,string>(),generationRequests:Record<string,unknown>[]=[];
  let providerCalls=0,asrPosts=0,inputUrl='',postCommits=0,inferences=0;const taskId=id('synthetic_asr_task');
  const gateway=new GenerationGateway(db.pool,f.cfg,f.store,new ArkClient(f.cfg,async(url,_hosts,opt={})=>{
    providerCalls++;const body=opt.body?JSON.parse(String(opt.body)) as Record<string,unknown>:undefined;let value:unknown;
    if(url.includes('/images/generations'))value={model:ic.actual_model,data:[{b64_json:image.toString('base64')}],usage:{generated_images:1}};
    else if(opt.method==='POST'){
      const task=id('synthetic_native_video'),plan=JSON.parse((body!.content as {type:string;text?:string}[]).find(i=>i.type==='text')!.text!.split('\n').at(-1)!);
      generationRequests.push(body!);tasks.set(task,options.engine==='REFERENCE_FILM'?'film':plan.shots[0].shot_id==='shot-1'?'red':'blue');value={id:task};
    }else if(url.startsWith('https://media.example.test/'))value=clips.get(tasks.get(url.split('/').at(-1)!.replace('.mp4',''))!)!;
    else {const task=url.split('/').at(-1)!;value={id:task,model:vc.actual_model,status:'succeeded',content:{video_url:`https://media.example.test/${task}.mp4`},usage:{completion_tokens:250,total_tokens:250}};}
    const bytes=Buffer.isBuffer(value)?value:Buffer.from(JSON.stringify(value));return {status:200,headers:{},bytes,json:()=>JSON.parse(bytes.toString('utf8')) as unknown};
  }));
  const response=(value:unknown)=>({status:200,headers:{},bytes:Buffer.from(JSON.stringify(value)),json:()=>value});
  const transport:SpeechTransport=async(url,_hosts,opt={})=>{
    if(opt.method==='POST'){asrPosts++;inputUrl=JSON.parse(String(opt.body)).input.file_url as string;
      if(options.lostAsrAck)throw new Error('Synthetic original ASR acknowledgement lost');return response({request_id:'synthetic-submit',output:{task_id:taskId,task_status:'PENDING'}});}
    if(url.startsWith('https://result.example.test/'))return response({file_url:inputUrl,transcripts:[{channel_id:0,text:'商品实拍。细节展示。',sentences:[
      {begin_time:100,end_time:800,language:'zh',text:'商品实拍。',words:[{begin_time:100,end_time:400,text:'商品',punctuation:''},{begin_time:400,end_time:800,text:'实拍',punctuation:'。'}]},
      {begin_time:1100,end_time:1800,language:'zh',text:'细节展示。',words:[{begin_time:1100,end_time:1400,text:'细节',punctuation:''},{begin_time:1400,end_time:1800,text:'展示',punctuation:'。'}]}]}]});
    return response({request_id:'synthetic-query',output:{task_id:taskId,task_status:'SUCCEEDED',result:{transcription_url:'https://result.example.test/original.json'}},usage:{seconds:2}});
  };
  const speech=new SpeechGateway(db.pool,f.cfg,f.store,new SpeechClient(f.cfg,transport));
  const app=await buildApp({cfg:f.cfg,pool:db.pool,inferenceHttp:async()=>{inferences++;return {status:200,headers:{'content-type':'text/event-stream'},bytes:syntheticSse(f.admission),json:()=>null};}});
  await app.listen({host:'127.0.0.1',port:0});const address=app.server.address();if(!address||typeof address==='string')throw new Error('Missing native HTTPS');f.cfg.publicBaseUrl=`https://localhost:${address.port}`;
  const controller=new AbortController(),launcher=new FixtureLauncher(),executor=new CodexRuntimeAdapter(db.pool,f.cfg,launcher),media=productionTools(db.pool,f.cfg,f.store,gateway,speech),review=reviewTools(db.pool,f.cfg,f.store);
  const post:ToolHandler=async(...args)=>{
    const result=await media.execute_post_plan!(...args);return {...result,commit:async tx=>{
      postCommits++;
      if(options.revokePostCommit&&postCommits===1)await db.pool.query('UPDATE resource_licenses SET revoked_at=now() WHERE id=$1',[f.character.voice_binding.license_record_id]);
      await result.commit?.(tx);
      if(options.crashPostCommit&&postCommits===1)throw new PendingExternal(1,'SYNTHETIC_POST_COMMIT_LOST');
    }};
  };
  active.push({app,controller,task:new ToolConsumer(db.pool,id('native_tools'),{...media,...review,execute_post_plan:post,
    extract_review_evidence:async(...args)=>{const output=await review.extract_review_evidence!(...args);
      if(options.dropListeningProof&&['REVIEW_FACTS','REVIEW_STYLE'].includes(args[0].stage_name)){
        const {native_listening_hash:_,native_listening:__,...result}=output.result as Record<string,unknown>;
        return {...output,result};
      }return output;},
    persist_stage_result:(scope,...args)=>(scope.role.startsWith('REVIEW_')?review:media).persist_stage_result!(scope,...args)}).run(controller.signal)});
  return {...f,app,controller,launcher,gateway,speech,generationRequests,providerCalls:()=>providerCalls,asrPosts:()=>asrPosts,postCommits:()=>postCommits,inferences:()=>inferences,
    pipeline:new NativeOrderMediaPipeline(db.pool,f.cfg,f.store,gateway,speech),service:new MediaStageService(db.pool,f.cfg,executor,{gateway,store:f.store})};
}
type Fixture=Awaited<ReturnType<typeof setup>>;
async function stage(f:Fixture,lease:StageLease){
  for(let attempt=0;attempt<12;attempt++){
    try{const commit=await withFixtureLease(db.pool,lease,s=>f.service.handle(lease,s),f.controller.signal);await completeStage(db.pool,lease,commit);return;}
    catch(error){if(!(error instanceof PendingExternal)){
      if(error instanceof Error)await writeFile(inside(db.cfg.runtimeRoot,`test-results/${id('native-order-stage-failure')}.json`),
        JSON.stringify({stage:lease.stage_name,name:error.name,message:error.message,code:(error as Error&{code?:unknown}).code,stack:error.stack}),{flag:'wx'}).catch(()=>undefined);
      const tools=(await db.pool.query("SELECT tool_name,state,data->>'error_code' AS error_code FROM agent_tool_intents WHERE tenant_id=$1 AND stage_run_id=$2 ORDER BY created_at",[f.p.tenantId,lease.id])).rows;
      if(error instanceof Error)error.message+=`; synthetic native tool states: ${JSON.stringify(tools)}`;throw error;
    }
      await db.pool.query("UPDATE provider_submissions SET next_query_at=now() WHERE tenant_id=$1 AND order_id=$2 AND generation_kind IN ('IMAGE','VIDEO')",[f.p.tenantId,f.orderId]);}
  }
  throw new Error('Synthetic generation did not reach its original checkpoint');
}
async function postLease(f:Fixture){const lease=(await claimStage(db.pool,id('native_post'),['POST']))!;expect(lease.scope_id).toBe(f.orderId);return lease;}
function directPost(f:Fixture,lease:StageLease):ToolScope{
  return {capability_id:'DIRECT-INTERNAL-TEST',tenant_id:f.p.tenantId,run_id:'DIRECT-INTERNAL-TEST',instance_id:'DIRECT-INTERNAL-TEST',stage_run_id:lease.id,
    order_id:f.orderId,preview_session_id:null,role:'POST',snapshot_hash:f.snapshotHash,packet_hash:null,stage_fencing_token:String(lease.fencing_token),instance_fencing_token:'1',
    expires_at:lease.deadline_at,scope_type:'ORDER',scope_id:f.orderId,stage_name:'POST'};
}

async function listeningReady(engine:'PER_SHOT_AI'|'REFERENCE_FILM'='PER_SHOT_AI',options:{dropListeningProof?:boolean}={}){
  const f=await setup({engine,listening:true,music:engine==='REFERENCE_FILM',...options});await stage(f,f.lease);
  const post=await postLease(f);await stage(f,post);
  await enqueueStage(db.pool,{tenantId:f.p.tenantId,scopeType:'ORDER',scopeId:f.orderId,name:'QC',inputHash:f.snapshotHash,
    deadlineAt:f.snapshot.deadline_at,jobId:f.lease.job_id!,dependencies:[post.id]});
  const qc=(await claimStage(db.pool,id('listening_qc'),['QC']))!;
  await completeStage(db.pool,qc,await withFixtureLease(db.pool,qc,s=>new QualityControlService(db.pool,f.cfg,f.store).handle(qc,s)));
  await enqueueStage(db.pool,{tenantId:f.p.tenantId,scopeType:'ORDER',scopeId:f.orderId,name:'REVIEW_FACTS',inputHash:f.snapshotHash,
    deadlineAt:f.snapshot.deadline_at,jobId:f.lease.job_id!,dependencies:[qc.id]});
  const review=(await claimStage(db.pool,id('listening_facts'),['REVIEW_FACTS']))!;
  const context=await executionContext(db.pool,f.p.tenantId,f.orderId,f.snapshotHash),packet=await currentReviewPacket(db.pool,context);
  return {...f,review,context,packet};
}
type ListeningFixture=Awaited<ReturnType<typeof listeningReady>>;
function listeningClient(f:ListeningFixture,mode:'NORMAL'|'UNKNOWN'|'BAD_RESULT'|'CACHED'|'REVOKE'|'SYNTHETIC_PASS'='NORMAL'){
  let posts=0,last:Buffer|undefined;
  const client=new ListeningClient(f.cfg,async(_url,_hosts,opt={})=>{
    posts++;const request=JSON.parse(String(opt.body));expect(request.use_multichannel).toBe(true);
    const parts=request.messages[0].content as {type:string;text?:string;input_audio?:{data:string}}[];
    const summary=JSON.parse(parts.find(p=>p.type==='text')!.text!).input as PreparedListening['summary'];
    expect(summary.packet_hash).toBe(f.packet.packet_hash);expect(summary.audios).toHaveLength(2);
    expect(parts.filter(p=>p.type==='input_audio').map(p=>sha256(Buffer.from(p.input_audio!.data.split(',')[1]!,'base64'))))
      .toEqual(summary.audios.map(a=>a.sha256));
    expect(parts.filter(p=>p.type==='image_url')).toHaveLength(summary.images.length);
    const result=mode==='SYNTHETIC_PASS'?syntheticControlListeningPass(summary):syntheticListeningResult(summary);
    if(mode==='BAD_RESULT')result.tracks[0]!.segments[0]!.start_ms=1;
    const bytes=listeningSse(f.models.listening!,result,mode==='CACHED'?u=>{(u.prompt_tokens_details as Record<string,unknown>).cached_tokens=1;}:undefined);last=bytes;
    if(mode==='UNKNOWN')throw new Error('Synthetic original HTTP response lost');
    if(mode==='REVOKE')await db.pool.query("UPDATE provider_model_versions SET status='REVOKED' WHERE id=$1",[f.models.listening!.model_version_id]);
    return {status:200,headers:{'content-type':'text/event-stream'},bytes,json:()=>null};
  });
  return {gateway:new NativeListeningGateway(db.pool,f.cfg,f.store,client),posts:()=>posts,response:()=>last!};
}

it.each(['PER_SHOT_AI','REFERENCE_FILM'] as const)('persists original independent listening for %s and keeps insufficient synthetic observations out of delivery',async engine=>{
  const f=await listeningReady(engine),g=listeningClient(f),run=()=>withFixtureLease(db.pool,f.review,s=>g.gateway.review(f.review,s));
  expect(()=>frozenOrderListening({...f.contract,budget_micro:1})).toThrowError(expect.objectContaining({code:'LISTENING_ORDER_CONTRACT_INVALID'}));
  const output=await run();expect(output.result.verdict).toBe('INSUFFICIENT');expect(await run()).toEqual(output);expect(g.posts()).toBe(1);
  const row=(await db.pool.query("SELECT s.*,b.state AS budget_state,b.settled_micro FROM provider_submissions s JOIN budget_reservations b ON b.id=s.reservation_id WHERE s.order_id=$1 AND s.generation_kind='LISTENING'",[f.orderId])).rows[0]!;
  expect(row).toMatchObject({state:'SUCCEEDED',budget_state:'SETTLED',settled_micro:'2'});expect(row.private.prepared.contract_hash).toBe(f.snapshot.listening_contract_hash);
  const raw=await f.store.get(row.private.request_key,32000000);expect(sha256(raw)).toBe(row.input_hash);
  await expect(new ReviewStageService(db.pool,f.cfg).handle(f.review,new AbortController().signal)).rejects.toMatchObject({code:'INDEPENDENT_AUDIO_NOT_PASSED'});
  await expect(db.pool.query("UPDATE provider_submissions SET input_hash=$2 WHERE id=$1",[row.id,'f'.repeat(64)])).rejects.toThrow('immutable');
  await expect(db.pool.query("UPDATE provider_submissions SET private=jsonb_set(private,'{output,result,verdict}','\"PASS\"') WHERE id=$1",[row.id])).rejects.toThrow('immutable');
  const post=await operationArtifacts(db.pool,f.context,'POST'),video=post.receipt.artifacts.find(a=>a.spec.kind==='video')!;
  const videoBytes=await f.store.get(video.object_key,512000000);await f.store.put(video.object_key,Buffer.from('replaced actual final media'),'video/mp4');
  await expect(run()).rejects.toMatchObject({code:'LISTENING_MEDIA_CHANGED'});await f.store.put(video.object_key,videoBytes,'video/mp4');
  await f.store.put(row.private.request_key,Buffer.from('replaced original listening request'),'application/json');
  await expect(run()).rejects.toMatchObject({code:'LISTENING_RECEIPT_CHANGED'});
  await f.store.put(row.private.request_key,raw,'application/json');
  const audio=(await db.pool.query("SELECT object_key FROM review_evidence WHERE packet_id=$1 AND kind='FINAL_AUDIO'",[f.packet.packet_id])).rows[0]!;
  await db.pool.query('UPDATE private_object_writes SET delete_requested=true WHERE object_key=$1',[audio.object_key]);
  await expect(run()).rejects.toMatchObject({code:'REVIEW_AUDIO_SOURCE_REVOKED'});expect(g.posts()).toBe(1);
},240000);

async function finalStage(f:ListeningFixture,name:'REVIEW_STYLE'|'DELIVER',parent?:StageLease){
  const stageId=await enqueueStage(db.pool,{tenantId:f.p.tenantId,scopeType:'ORDER',scopeId:f.orderId,name,inputHash:f.snapshotHash,
    deadlineAt:f.snapshot.deadline_at,jobId:f.lease.job_id!,dependencies:parent?[parent.id]:[]});
  const lease=(await claimStage(db.pool,id('native_final'),[name]))!;expect(lease.id).toBe(stageId);return lease;
}
it.each(['PER_SHOT_AI','REFERENCE_FILM'] as const)('binds synthetic native final review and delivery for %s to one original listening receipt',async engine=>{
  // Actual tone/video bytes; semantic PASS/Chinese text is deliberately
  // fabricated to exercise control bindings, never real hearing certification.
  const f=await listeningReady(engine),g=listeningClient(f,'SYNTHETIC_PASS');
  const executor=new CodexRuntimeAdapter(db.pool,f.cfg,f.launcher),service=new ReviewStageService(db.pool,f.cfg,executor,g.gateway);
  const beforeLaunches=f.launcher.launches,beforeInference=f.inferences();
  const premature=await finalStage(f,'REVIEW_STYLE');
  await expect(withFixtureLease(db.pool,premature,s=>service.handle(premature,s))).rejects.toBeInstanceOf(PendingExternal);
  await deferStage(db.pool,premature,'LISTENING_ORIGINAL_UNRESOLVED',1);
  expect(g.posts()).toBe(0);expect(f.inferences()).toBe(beforeInference);expect(f.launcher.launches).toBe(beforeLaunches);
  let facts=f.review;
  const factsCommit=await withFixtureLease(db.pool,facts,s=>service.handle(facts,s));
  if(engine==='PER_SHOT_AI'){
    await db.pool.query("UPDATE stage_runs SET lease_expires_at=now()-interval '1 second' WHERE id=$1",[facts.id]);
    const old=facts;facts=(await claimStage(db.pool,id('native_takeover'),['REVIEW_FACTS']))!;
    await expect(completeStage(db.pool,old,factsCommit)).rejects.toMatchObject({code:'LEASE_LOST'});
    const recovered=await withFixtureLease(db.pool,facts,s=>service.handle(facts,s));
    await completeStage(db.pool,facts,recovered);
  }else await completeStage(db.pool,facts,factsCommit);
  const style=(await claimStage(db.pool,id('native_final'),['REVIEW_STYLE']))!;expect(style.id).toBe(premature.id);
  const styleCommit=await withFixtureLease(db.pool,style,s=>service.handle(style,s));
  await completeStage(db.pool,style,styleCommit);
  expect(g.posts()).toBe(1);expect(f.launcher.launches).toBe(beforeLaunches+2);expect(f.inferences()).toBe(beforeInference+2);
  const listening=await g.gateway.evidence(f.context),bindingHash=hash(listening);
  const packet=await currentReviewPacket(db.pool,f.context);expect(packet.state).toBe('PASSED');expect(packet.reports).toHaveLength(2);
  expect(new Set(packet.reports.map(r=>r.thread_id)).size).toBe(2);
  expect(new Set(packet.reports.map(r=>r.runtime_process_ref)).size).toBe(2);
  const runs=(await db.pool.query("SELECT r.* FROM agent_runs r JOIN stage_runs s ON s.id=r.private->>'stage_run_id' AND s.tenant_id=r.tenant_id WHERE s.scope_id=$1 AND s.stage_name IN ('REVIEW_FACTS','REVIEW_STYLE')",[f.orderId])).rows;
  expect(runs).toHaveLength(2);
  for(const run of runs){
    expect(hash(run.private.review_input.native_listening)).toBe(bindingHash);
    const tools=(await db.pool.query("SELECT data->'result' AS result FROM agent_tool_intents WHERE run_id=$1 AND tool_name='extract_review_evidence' AND state='SUCCEEDED'",[run.id])).rows;
    expect(tools).toHaveLength(1);expect(tools[0]!.result.native_listening_hash).toBe(bindingHash);
    const inference=(await db.pool.query('SELECT data FROM inference_requests WHERE run_id=$1',[run.id])).rows;
    expect(inference).toHaveLength(1);expect(inference[0]!.data.review_listening_hash).toBe(bindingHash);
    expect(inference[0]!.data.review_image_binding_hash).toBe(hash(run.private.review_input));
    const report=(await db.pool.query('SELECT evidence_hash FROM review_reports WHERE run_id=$1',[run.id])).rows[0]!;
    expect(report.evidence_hash).toBe(hash(run.private.review_input));
  }
  const delivery=await finalStage(f,'DELIVER',style),publisher=new PublicationService(db.pool,f.cfg,f.store);
  const original=(await db.pool.query("SELECT * FROM provider_submissions WHERE order_id=$1 AND generation_kind='LISTENING'",[f.orderId])).rows[0]!;
  if(engine==='PER_SHOT_AI'){
    const key=original.private.receipts[0].key,bytes=await f.store.get(key,4000000);
    await f.store.put(key,Buffer.from('changed original paid response'),'application/json');
    await expect(publisher.handle(delivery,f.controller.signal)).rejects.toMatchObject({code:'LISTENING_RECEIPT_CHANGED'});
    await f.store.put(key,bytes,'application/json');
    await db.pool.query("UPDATE budget_reservations SET state='UNKNOWN' WHERE id=$1",[original.reservation_id]);
    await expect(publisher.handle(delivery,f.controller.signal)).rejects.toMatchObject({code:'LISTENING_BILLING_UNVERIFIED'});
    await db.pool.query("UPDATE budget_reservations SET state='SETTLED' WHERE id=$1",[original.reservation_id]);
  }
  const paid={provider:f.providerCalls(),asr:f.asrPosts(),listening:g.posts(),inference:f.inferences()};
  const deliveryCommit=await withFixtureLease(db.pool,delivery,s=>publisher.handle(delivery,s));
  await completeStage(db.pool,delivery,deliveryCommit);
  expect({provider:f.providerCalls(),asr:f.asrPosts(),listening:g.posts(),inference:f.inferences()}).toEqual(paid);
  const pack=await getDeliverables(db.pool,f.p,f.orderId),video=pack.items.find(i=>i.kind==='video')!;
  const link=await createDownloadLink(db.pool,f.cfg,f.p,video.deliverable_id),url=new URL(link.url);
  const downloaded=await f.app.inject({method:'GET',url:url.pathname+url.search});expect(downloaded.statusCode).toBe(200);expect(sha256(downloaded.rawPayload)).toBe(video.sha256);
  const manifest=(await db.pool.query('SELECT private FROM delivery_manifests WHERE order_id=$1',[f.orderId])).rows[0]!;
  expect(manifest.private.native_listening_hash).toBe(bindingHash);expect(manifest.private.native_listening_submission_id).toBe(listening.submission_id);
  expect((await db.pool.query("SELECT id FROM agent_instances WHERE order_id=$1 AND state<>'RELEASED'",[f.orderId])).rowCount).toBe(0);
  expect((await db.pool.query("SELECT id FROM outbox_events WHERE aggregate_id=$1 AND event_key=$2",[f.orderId,`release:delivered:${f.orderId}`])).rowCount).toBe(1);
  const post=await operationArtifacts(db.pool,f.context,'POST');
  expect(post.receipt.artifacts.find(a=>a.spec.kind==='video')!.spec.native_audio!.post!.kernel.semantic_review).toBe('NOT_PERFORMED');
},300000);

it('blocks synthetic native final review publication after durable voice revocation before commit',async()=>{
  const f=await listeningReady('REFERENCE_FILM'),g=listeningClient(f,'SYNTHETIC_PASS');
  const service=new ReviewStageService(db.pool,f.cfg,new CodexRuntimeAdapter(db.pool,f.cfg,f.launcher),g.gateway);
  const factsCommit=await withFixtureLease(db.pool,f.review,s=>service.handle(f.review,s));
  await completeStage(db.pool,f.review,factsCommit);
  const style=await finalStage(f,'REVIEW_STYLE',f.review);
  const styleCommit=await withFixtureLease(db.pool,style,s=>service.handle(style,s));
  await completeStage(db.pool,style,styleCommit);
  const delivery=await finalStage(f,'DELIVER',style),publisher=new PublicationService(db.pool,f.cfg,f.store);
  const paid={provider:f.providerCalls(),asr:f.asrPosts(),listening:g.posts(),inference:f.inferences()};
  const commit=await withFixtureLease(db.pool,delivery,s=>publisher.handle(delivery,s)),license=f.character.voice_binding.license_record_id;
  await db.pool.query('UPDATE resource_licenses SET revoked_at=now() WHERE id=$1',[license]);
  await expect(completeStage(db.pool,delivery,commit)).rejects.toMatchObject({code:'AUDIO_LICENSE_UNAVAILABLE'});
  // A sold license is irreversibly revoked. Never undo it to force delivery.
  await expect(db.pool.query('UPDATE resource_licenses SET revoked_at=NULL WHERE id=$1',[license])).rejects.toThrow('revocation cannot be undone');
  expect({provider:f.providerCalls(),asr:f.asrPosts(),listening:g.posts(),inference:f.inferences()}).toEqual(paid);
  expect((await db.pool.query('SELECT id FROM delivery_manifests WHERE order_id=$1',[f.orderId])).rowCount).toBe(0);
  expect((await db.pool.query("SELECT id FROM orders WHERE id=$1 AND fulfillment_state='DELIVERED'",[f.orderId])).rowCount).toBe(0);
},300000);

it.each(['OMIT_ROLE_LISTENING','OMIT_TOOL_LISTENING'] as const)('blocks synthetic native final review when %s is missing',async mode=>{
  const f=await listeningReady('PER_SHOT_AI',{dropListeningProof:mode==='OMIT_TOOL_LISTENING'}),g=listeningClient(f,'SYNTHETIC_PASS');
  const runtime=new CodexRuntimeAdapter(db.pool,f.cfg,f.launcher),before=f.inferences();
  const executor=mode==='OMIT_ROLE_LISTENING'?{execute:(request:Parameters<typeof runtime.execute>[0],signal:AbortSignal)=>{
    const {native_listening:_,...review}=request.review!;return runtime.execute({...request,review},signal);
  }}:runtime;
  await expect(withFixtureLease(db.pool,f.review,s=>new ReviewStageService(db.pool,f.cfg,executor,g.gateway).handle(f.review,s))).rejects.toThrow();
  expect(g.posts()).toBe(1);expect(f.inferences()-before).toBe(mode==='OMIT_ROLE_LISTENING'?0:1);
  expect((await db.pool.query('SELECT id FROM review_reports WHERE tenant_id=$1',[f.p.tenantId])).rowCount).toBe(0);
  expect((await db.pool.query('SELECT id FROM delivery_manifests WHERE order_id=$1',[f.orderId])).rowCount).toBe(0);
  if(mode==='OMIT_TOOL_LISTENING')expect((await db.pool.query("SELECT data->>'error_code' AS code FROM agent_tool_intents WHERE stage_run_id=$1 AND tool_name='persist_stage_result'",[f.review.id])).rows)
    .toEqual([{code:'REVIEW_TOOL_PROOF_MISSING'}]);
},300000);

it('recovers only the saved original independent listening response after UNKNOWN without a second purchase',async()=>{
  const f=await listeningReady(),g=listeningClient(f,'UNKNOWN'),run=()=>withFixtureLease(db.pool,f.review,s=>g.gateway.review(f.review,s));
  await expect(run()).rejects.toBeInstanceOf(PendingExternal);await expect(run()).rejects.toBeInstanceOf(PendingExternal);expect(g.posts()).toBe(1);
  const row=(await db.pool.query("SELECT * FROM provider_submissions WHERE order_id=$1 AND generation_kind='LISTENING'",[f.orderId])).rows[0]!;
  expect((await db.pool.query('SELECT state FROM budget_reservations WHERE id=$1',[row.reservation_id])).rows[0]!.state).toBe('UNKNOWN');
  const bytes=g.response(),receipt={version:'YPCC-LISTENING-RECEIPT-1',submission_id:row.id,request_sha256:row.private.request_sha256,status:200,
    content_type:'text/event-stream',response_sha256:sha256(bytes),body_base64:bytes.toString('base64')};
  await writePrivateObject(db.pool,f.store,{tenantId:f.p.tenantId,ownerId:f.p.userId,productId:f.contract.product.product_id,orderId:f.orderId,kind:'RECEIPT'},
    row.private.receipts[0].key,Buffer.from(JSON.stringify(receipt)),'application/json');
  const enabled=f.cfg.provider.listening!.enabled;f.cfg.provider.listening!.enabled=false;
  expect(await g.gateway.reconcileReceipts()).toMatchObject({settled:1});f.cfg.provider.listening!.enabled=enabled;
  expect((await run()).submission_id).toBe(row.id);expect(g.posts()).toBe(1);
},240000);

it.each(['BAD_RESULT','CACHED','REVOKE'] as const)('holds delivery and retains original costs after independent listening %s',async mode=>{
  const f=await listeningReady(),g=listeningClient(f,mode),run=()=>withFixtureLease(db.pool,f.review,s=>g.gateway.review(f.review,s));
  await expect(run()).rejects.toMatchObject({code:mode==='REVOKE'?'LISTENING_MODEL_CHANGED':'LISTENING_NOT_PASSED'});
  if(mode==='REVOKE')await db.pool.query("UPDATE provider_model_versions SET status='ADMITTED' WHERE id=$1",[f.models.listening!.model_version_id]);
  if(mode!=='REVOKE')await expect(run()).rejects.toMatchObject({code:'LISTENING_NOT_PASSED'});
  const row=(await db.pool.query("SELECT s.state,s.private,b.state AS budget_state FROM provider_submissions s JOIN budget_reservations b ON b.id=s.reservation_id WHERE s.order_id=$1 AND s.generation_kind='LISTENING'",[f.orderId])).rows[0]!;
  expect(row.budget_state).toBe(mode==='CACHED'?'UNKNOWN':'SETTLED');expect(g.posts()).toBe(1);
  expect((await db.pool.query('SELECT id FROM delivery_manifests WHERE order_id=$1',[f.orderId])).rowCount).toBe(0);
},240000);

it.each(['PER_SHOT_AI','REFERENCE_FILM'] as const)('seals private %s native production/ASR/POST/QC through real HTTPS/MCP while independent listening and delivery stay closed',async engine=>{
  const f=await setup({engine,music:engine==='REFERENCE_FILM'});await stage(f,f.lease);expect(f.asrPosts()).toBe(0);
  const context=await executionContext(db.pool,f.p.tenantId,f.orderId,f.snapshotHash),production=await operationArtifacts(db.pool,context,'PRODUCTION');
  const original=production.receipt.artifacts.find(a=>a.spec.kind==='video')!;
  expect(original.spec.inspection).toMatchObject({frames:60,hasAudio:true,audioCodec:'alac'});
  expect(original.spec.native_audio!.assembly.segments).toHaveLength(engine==='PER_SHOT_AI'?2:1);
  const post=await postLease(f);await stage(f,post);const made=await operationArtifacts(db.pool,context,'POST');
  const final=made.receipt.artifacts.find(a=>a.spec.kind==='video')!;expect(final.spec.inspection).toMatchObject({frames:60,hasAudio:true,audioCodec:'aac'});
  expect(final.spec.native_audio!.post!.kernel.semantic_review).toBe('NOT_PERFORMED');
  expect(final.spec.native_audio!.post!.kernel.music!==null).toBe(engine==='REFERENCE_FILM');
  expect(final.spec.native_audio!.audio_contract_hash).toBe(f.snapshot.native_audio_contract_hash);expect(f.asrPosts()).toBe(1);expect(f.launcher.launches).toBe(3);
  for(const body of f.generationRequests){expect(body.generate_audio).toBe(true);const prompt=(body.content as {type:string;text?:string}[]).find(i=>i.type==='text')!.text!;
    expect(JSON.parse(prompt.split('\n').at(-1)!).native_character.character_version_id).toBe(f.character.character_version_id);}
  expect((await db.pool.query("SELECT id FROM provider_submissions WHERE order_id=$1 AND generation_kind='ASR'",[f.orderId])).rowCount).toBe(1);
  expect((await db.pool.query("SELECT id FROM budget_reservations WHERE order_id=$1 AND intent_key LIKE 'audio-license:%' AND state='SETTLED'",[f.orderId])).rowCount).toBe(engine==='REFERENCE_FILM'?3:2);
  const qcId=await enqueueStage(db.pool,{tenantId:f.p.tenantId,scopeType:'ORDER',scopeId:f.orderId,name:'QC',inputHash:f.snapshotHash,
    deadlineAt:f.snapshot.deadline_at,jobId:f.lease.job_id!,dependencies:[post.id]});
  const qc=(await claimStage(db.pool,id('native_qc'),['QC']))!;expect(qc.id).toBe(qcId);
  const commit=await withFixtureLease(db.pool,qc,s=>new QualityControlService(db.pool,f.cfg,f.store).handle(qc,s));
  if(engine==='PER_SHOT_AI'){
    const bytes=await f.store.get(final.object_key,512_000_000);await f.store.put(final.object_key,Buffer.from('replaced final video'),'video/mp4');
    await expect(completeStage(db.pool,qc,commit)).rejects.toMatchObject({code:'REVIEW_EVIDENCE_CHANGED'});
    await f.store.put(final.object_key,bytes,'video/mp4');
  }else{
    const right=frozenNativeAudio(f.contract)!.rights.find(r=>r.kind==='MUSIC')!;
    await f.store.put(right.media!.object_key,Buffer.from('replaced licensed music'),'audio/wav');
    await expect(completeStage(db.pool,qc,commit)).rejects.toMatchObject({code:'AUDIO_MUSIC_MEDIA_CHANGED'});
    await f.store.put(right.media!.object_key,music,'audio/wav');
  }
  await completeStage(db.pool,qc,commit);
  const packet=await currentReviewPacket(db.pool,context),rows=await verifySealedEvidence(db.pool,f.store,packet);
  expect(packet).toMatchObject({state:'SEALED',deterministic_pass:true,evidence_complete:true,reports:[],publication_decision:'PENDING'});
  expect(rows.filter(r=>(NATIVE_QC_KINDS as readonly string[]).includes(r.kind)).map(r=>r.kind).sort()).toEqual([...NATIVE_QC_KINDS].sort());
  const material=await packetMaterial(db.pool,f.store,packet) as {audio_evidence:{kind:string;semantic_review:string}[];text_evidence:{kind:string}[]};
  expect(material.audio_evidence.map(r=>r.kind).sort()).toEqual(['FINAL_AUDIO','NATIVE_AUDIO']);
  expect(material.audio_evidence.every(r=>r.semantic_review==='PENDING')).toBe(true);
  expect(material.text_evidence.map(r=>r.kind)).toEqual(expect.arrayContaining(['TRANSCRIPT','CAPTION_SCRIPT','AUDIO_QC']));
  const files=new Map(await Promise.all(rows.map(async r=>[r.id,await f.store.get(r.object_key,30_000_000)] as const)));
  const finalAudio=rows.find(r=>r.kind==='FINAL_AUDIO')!,rawAudio=rows.find(r=>r.kind==='NATIVE_AUDIO')!;
  expect(files.get(rawAudio.id)!.length).toBe(44+48000*2*4);
  expect(files.get(rawAudio.id)!.readUInt16LE(22)).toBe(2);
  expect(()=>verifyNativeAudioEvidence(packet,rows.filter(r=>r.id!==finalAudio.id),files)).toThrowError(expect.objectContaining({code:'REVIEW_AUDIO_EVIDENCE_INCOMPLETE'}));
  const captionFrame=rows.find(r=>r.kind==='VIDEO_FRAME'&&r.frame_index===3&&r.artifact_id===finalAudio.artifact_id)!;
  expect(captionFrame).toBeDefined();
  expect(()=>verifyNativeAudioEvidence(packet,rows.filter(r=>r.id!==captionFrame.id),files)).toThrowError(expect.objectContaining({code:'REVIEW_AUDIO_EVIDENCE_INCOMPLETE'}));
  await f.store.put(finalAudio.object_key,Buffer.from('replaced review audio'),'audio/wav');
  await expect(verifySealedEvidence(db.pool,f.store,packet)).rejects.toMatchObject({code:'REVIEW_EVIDENCE_CHANGED'});
  await f.store.put(finalAudio.object_key,files.get(finalAudio.id)!,'audio/wav');
  const fake=structuredClone(made.receipt);for(const artifact of fake.artifacts.filter(a=>a.spec.kind==='video'))artifact.spec.native_audio!.post!.kernel.mix_pcm_sha256='0'.repeat(64);
  await expect(nativeAudioQc(db.pool,f.cfg,f.store,context,production.receipt,fake,join(root,id('independent-mix')),new AbortController().signal))
    .rejects.toMatchObject({code:'REVIEW_AUDIO_MIX_INVALID'});
  const paidCalls=f.providerCalls(),inferences=f.inferences();
  for(const name of ['REVIEW_FACTS','REVIEW_STYLE','DELIVER']){
    const next=await enqueueStage(db.pool,{tenantId:f.p.tenantId,scopeType:'ORDER',scopeId:f.orderId,name,inputHash:f.snapshotHash,
      deadlineAt:f.snapshot.deadline_at,jobId:f.lease.job_id!,dependencies:[qc.id]});
    const lease=(await claimStage(db.pool,id('native_final_guard'),[name]))!;expect(lease.id).toBe(next);
    const service=name==='DELIVER'?new PublicationService(db.pool,f.cfg,f.store):new ReviewStageService(db.pool,f.cfg);
    await expect(service.handle(lease,new AbortController().signal)).rejects.toMatchObject({code:'INDEPENDENT_AUDIO_REVIEW_REQUIRED'});
  }
  expect(f.providerCalls()).toBe(paidCalls);expect(f.inferences()).toBe(inferences);expect(f.asrPosts()).toBe(1);expect(f.launcher.launches).toBe(3);
  expect((await db.pool.query('SELECT id FROM delivery_manifests WHERE order_id=$1',[f.orderId])).rowCount).toBe(0);
  // Both round trips now execute full media/ASR/POST/QC plus tamper and final
  // admission checks; retain their individual RPC and frozen business limits.
},240_000);

it.each(['original-write','voice-license'] as const)('refuses native QC sealing after %s is revoked between preparation and commit',async revoked=>{
  const f=await setup();await stage(f,f.lease);const post=await postLease(f);await stage(f,post);
  const qcId=await enqueueStage(db.pool,{tenantId:f.p.tenantId,scopeType:'ORDER',scopeId:f.orderId,name:'QC',inputHash:f.snapshotHash,
    deadlineAt:f.snapshot.deadline_at,jobId:f.lease.job_id!,dependencies:[post.id]});
  const qc=(await claimStage(db.pool,id('native_revoke_qc'),['QC']))!;expect(qc.id).toBe(qcId);
  const commit=await withFixtureLease(db.pool,qc,s=>new QualityControlService(db.pool,f.cfg,f.store).handle(qc,s));
  if(revoked==='original-write'){
    const context=await executionContext(db.pool,f.p.tenantId,f.orderId,f.snapshotHash),receipt=await operationArtifacts(db.pool,context,'POST');
    const sourceWrite=receipt.receipt.artifacts.find(a=>a.spec.kind==='video')!.spec.native_audio!.post!.source_write_id;
    await db.pool.query('UPDATE private_object_writes SET delete_requested=true WHERE id=$1',[sourceWrite]);
    await expect(completeStage(db.pool,qc,commit)).rejects.toMatchObject({code:'REVIEW_AUDIO_SOURCE_REVOKED'});
  }else{
    await db.pool.query('UPDATE resource_licenses SET revoked_at=now() WHERE id=$1',[f.character.voice_binding.license_record_id]);
    await expect(completeStage(db.pool,qc,commit)).rejects.toMatchObject({code:'AUDIO_LICENSE_UNAVAILABLE'});
  }
  expect((await db.pool.query('SELECT id FROM review_packets WHERE order_id=$1',[f.orderId])).rowCount).toBe(0);
  expect((await db.pool.query('SELECT id FROM qc_decisions WHERE order_id=$1',[f.orderId])).rowCount).toBe(0);expect(f.asrPosts()).toBe(1);
});
it('restores the stored POST receipt after its transaction rolls back without another ASR or render generation',async()=>{
  const f=await setup({crashPostCommit:true});await stage(f,f.lease);await stage(f,await postLease(f));
  const context=await executionContext(db.pool,f.p.tenantId,f.orderId,f.snapshotHash),post=await operationArtifacts(db.pool,context,'POST');
  expect(f.postCommits()).toBe(2);expect(f.asrPosts()).toBe(1);expect(f.launcher.launches).toBe(3);expect(post.operation.generation).toBe(1);
  const writes=await db.pool.query("SELECT id FROM private_object_writes WHERE order_id=$1 AND object_key LIKE $2",[f.orderId,`${f.p.tenantId}/media/${f.orderId}/${post.operation.id}/%`]);
  expect(writes.rowCount).toBe(post.receipt.artifacts.length+1);
});
it('defers the original UNKNOWN ASR acknowledgement and never replaces its source or purchase',async()=>{
  const f=await setup({lostAsrAck:true});await stage(f,f.lease);const lease=await postLease(f),scope=directPost(f,lease);
  await expect(withFixtureLease(db.pool,lease,s=>f.pipeline.transcribe(scope,undefined,s))).rejects.toBeInstanceOf(PendingExternal);
  await expect(withFixtureLease(db.pool,lease,s=>f.pipeline.transcribe(scope,undefined,s))).rejects.toBeInstanceOf(PendingExternal);
  expect(f.asrPosts()).toBe(1);const rows=(await db.pool.query("SELECT state,provider_task_id FROM provider_submissions WHERE order_id=$1 AND generation_kind='ASR'",[f.orderId])).rows;
  expect(rows).toEqual([{state:'UNKNOWN',provider_task_id:null}]);
  expect((await db.pool.query("SELECT id FROM media_operations WHERE order_id=$1 AND phase='POST' AND state='READY'",[f.orderId])).rowCount).toBe(0);
});
it.each(['missing','changed'] as const)('rejects %s licensed music bytes before reference generation or inference',async mode=>{
  const f=await setup({music:true}),right=frozenNativeAudio(f.contract)!.rights.find(r=>r.kind==='MUSIC')!;
  if(mode==='missing')await f.store.delete(right.media!.object_key);else await f.store.put(right.media!.object_key,Buffer.from('changed'),'audio/wav');
  await expect(f.service.handle(f.lease,new AbortController().signal)).rejects.toThrow();expect(f.providerCalls()).toBe(0);expect(f.inferences()).toBe(0);expect(f.launcher.launches).toBe(0);
});
it('rejects a different artifact, invented assembly proof and changed original bytes before ASR',async()=>{
  const f=await setup();await stage(f,f.lease);const lease=await postLease(f),scope=directPost(f,lease),context=await executionContext(db.pool,f.p.tenantId,f.orderId,f.snapshotHash);
  const source=await operationArtifacts(db.pool,context,'PRODUCTION'),fake=structuredClone(source.receipt),v=fake.artifacts.find(a=>a.spec.kind==='video')!;
  v.spec.native_audio!.assembly.segments.reverse();const directory=join(root,id('proof-probe'));await mkdir(directory,{recursive:true});
  await expect(f.pipeline.verify(context,fake,directory,new AbortController().signal)).rejects.toMatchObject({code:'AUDIO_ASSEMBLY_PROOF_MISMATCH'});
  await expect(f.pipeline.transcribe(scope,'different-artifact',new AbortController().signal)).rejects.toMatchObject({code:'AUDIO_SOURCE_SELECTION_INVALID'});
  const original=source.receipt.artifacts.find(a=>a.spec.kind==='video')!;await f.store.put(original.object_key,clips.get('red')!,'video/mp4');
  await expect(f.pipeline.transcribe(scope,undefined,new AbortController().signal)).rejects.toMatchObject({code:'ARTIFACT_HASH_MISMATCH'});expect(f.asrPosts()).toBe(0);
});
it('rejects native POST commit after voice revocation and exposes no READY post checkpoint',async()=>{
  const f=await setup({revokePostCommit:true});await stage(f,f.lease);const lease=await postLease(f);
  await expect(withFixtureLease(db.pool,lease,s=>f.service.handle(lease,s))).rejects.toThrow();expect(f.asrPosts()).toBe(1);
  expect(f.postCommits()).toBe(1);
  expect((await db.pool.query('SELECT revoked_at FROM resource_licenses WHERE id=$1',[f.character.voice_binding.license_record_id])).rows[0].revoked_at).not.toBeNull();
  expect((await db.pool.query("SELECT state,data->>'error_code' AS code FROM agent_tool_intents WHERE order_id=$1 AND tool_name='execute_post_plan'",[f.orderId])).rows)
    .toEqual([{state:'FAILED',code:'AUDIO_LICENSE_UNAVAILABLE'}]);
  expect((await db.pool.query("SELECT id FROM media_operations WHERE order_id=$1 AND phase='POST' AND state='READY'",[f.orderId])).rowCount).toBe(0);
  expect((await db.pool.query("SELECT id FROM artifacts WHERE order_id=$1 AND spec_json->>'phase'='POST'",[f.orderId])).rowCount).toBe(0);
// A failed role also awaits the unchanged 45s independent reaper. This one
// integration harness cap covers both real media and that bounded cleanup.
},180_000);
it('keeps public order creation closed for a structurally valid internal native contract',async()=>{
  const f=await setup(),quote=id('private_quote'),expires=addSeconds(600);
  await insert(db.pool,'quotes',{id:quote,tenant_id:f.p.tenantId,owner_id:f.p.userId,plan_id:f.plan.plan_id,plan_hash:f.contract.plan_hash,amount_fen:100,expires_at:expires,state:'OPEN',
    data:{quote_id:quote,plan_id:f.plan.plan_id,plan_hash:f.contract.plan_hash,state:'OPEN',currency:'CNY',amount_fen:100,expires_at:expires},private:{contract:f.contract,contract_hash:hash(f.contract)}});
  expect(()=>validateGenerationExecution(f.contract)).toThrowError(expect.objectContaining({code:'NATIVE_AUDIO_NOT_ADMITTED'}));
  await expect(transaction(db.pool,q=>createOrder(q,f.cfg,f.p,{quote_id:quote,channel:'alipay'}))).rejects.toMatchObject({code:'NATIVE_AUDIO_NOT_ADMITTED'});
});
it('assembles and rechecks both original tone segments losslessly, rejecting a gap and replaced PCM evidence',async()=>{
  const directory=join(root,id('assembly'));await mkdir(directory,{recursive:true});const segments:NativeSegment[]=['red','blue'].map((key,i)=>({node_key:`video:shot-${i+1}`,
    start_frame:i*30,end_frame:(i+1)*30,bytes:clips.get(key)!,source_sha256:sha256(clips.get(key)!)}));
  const input={directory,deadline_at:addSeconds(120),signal:new AbortController().signal,target_frames:60,segments},made=await assembleNativeAudio(db.cfg,input);
  expect(made.proof.assembled_pcm_sha256).toBe(made.proof.native_audio.pcm_sha256);await verifyNativeAssembly(db.cfg,{...input,bytes:made.bytes,proof:made.proof});
  const invalid=structuredClone(made.proof);invalid.segments[0]!.pcm_sha256='0'.repeat(64);
  await expect(verifyNativeAssembly(db.cfg,{...input,bytes:made.bytes,proof:invalid})).rejects.toMatchObject({code:'AUDIO_ASSEMBLY_PROOF_MISMATCH'});
  await expect(assembleNativeAudio(db.cfg,{...input,segments:[{...segments[0]!,end_frame:29},segments[1]!]})).rejects.toMatchObject({code:'AUDIO_ASSEMBLY_INVALID'});
  const path=join(directory,'actual.mp4');await writeFile(path,made.bytes);expect(await inspectVideo(db.cfg,path)).toMatchObject({frames:60,audioCodec:'alac'});
});
