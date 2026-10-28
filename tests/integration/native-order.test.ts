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
import {QualityControlService} from '../../src/worker/review/qc.js';
import {ToolConsumer,type ToolHandler} from '../../src/worker/tool-gateway/consumer.js';
import {productionTools} from '../../src/worker/tool-gateway/production-tools.js';
import {reviewTools} from '../../src/worker/tool-gateway/review-tools.js';
import type {ToolScope} from '../../src/worker/tool-gateway/http.js';
import {claimStage,completeStage,PendingExternal,type StageLease} from '../../src/worker/queue/leases.js';
import {enqueueStage} from '../../src/worker/queue/enqueue.js';

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
afterEach(async()=>{
  for(const item of active.splice(0)){item.controller.abort();await item.task;await item.app.close();}
  await db.pool.query("UPDATE stage_runs SET state='CANCELLED' WHERE state NOT IN ('SUCCEEDED','FAILED')");
  await db.pool.query("UPDATE agent_tool_intents SET state='CANCELLED' WHERE state IN ('QUEUED','UNKNOWN','RUNNING')");
  await db.pool.query('UPDATE agent_capabilities SET revoked_at=COALESCE(revoked_at,now())');
});
afterAll(async()=>{await db?.close();if(root)await rm(inside(db.cfg.runtimeRoot,root),{recursive:true,force:true});});

async function setup(options:{engine?:'PER_SHOT_AI'|'REFERENCE_FILM';music?:boolean;lostAsrAck?:boolean;crashPostCommit?:boolean;revokePostCommit?:boolean}={}){
  const f=await nativeOrderFixture(db,join(root,id('order')),{engine:options.engine??'PER_SHOT_AI',...(options.music?{music}:{}),style:options.engine==='REFERENCE_FILM'?'minimal':'karaoke'});
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
    persist_stage_result:(scope,...args)=>(scope.role.startsWith('REVIEW_')?review:media).persist_stage_result!(scope,...args)}).run(controller.signal)});
  return {...f,app,controller,launcher,gateway,speech,generationRequests,providerCalls:()=>providerCalls,asrPosts:()=>asrPosts,postCommits:()=>postCommits,inferences:()=>inferences,
    pipeline:new NativeOrderMediaPipeline(db.pool,f.cfg,f.store,gateway,speech),service:new MediaStageService(db.pool,f.cfg,executor,{gateway,store:f.store})};
}
type Fixture=Awaited<ReturnType<typeof setup>>;
async function stage(f:Fixture,lease:StageLease){
  for(let attempt=0;attempt<12;attempt++){
    try{const commit=await withFixtureLease(db.pool,lease,s=>f.service.handle(lease,s),f.controller.signal);await completeStage(db.pool,lease,commit);return;}
    catch(error){if(!(error instanceof PendingExternal)){
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

it.each(['PER_SHOT_AI','REFERENCE_FILM'] as const)('runs the private %s native production/ASR/POST through real HTTPS/MCP and keeps audio QC closed',async engine=>{
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
  await expect(new QualityControlService(db.pool,f.cfg,f.store).handle(qc,new AbortController().signal)).rejects.toMatchObject({code:'QC_POLICY_UNAVAILABLE'});
  expect((await db.pool.query('SELECT id FROM delivery_manifests WHERE order_id=$1',[f.orderId])).rowCount).toBe(0);
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
  expect((await db.pool.query("SELECT id FROM media_operations WHERE order_id=$1 AND phase='POST' AND state='READY'",[f.orderId])).rowCount).toBe(0);
  expect((await db.pool.query("SELECT id FROM artifacts WHERE order_id=$1 AND spec_json->>'phase'='POST'",[f.orderId])).rowCount).toBe(0);
});
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
