import {beforeAll,afterAll,afterEach,describe,it,expect,vi} from 'vitest';
import {mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import sharp from 'sharp';
import {testDatabase,type TestDatabase} from '../helpers/database.js';
import {mediaFixture} from '../helpers/media.js';
import {syntheticArkContract as wire} from '../helpers/generation.js';
import {reviewGeneratedReferences} from '../helpers/reference.js';
import {config,inside} from '../../src/api/config.js';
import {hash,id,sha256,addSeconds} from '../../src/api/lib/crypto.js';
import {AppError} from '../../src/api/lib/errors.js';
import type {HttpResponse} from '../../src/api/lib/http.js';
import type {ObjectStorage} from '../../src/api/storage/storage.js';
import type {Principal} from '../../src/shared/contracts/types.js';
import {reconcileUncertainObjectWrites} from '../../src/api/storage/private-objects.js';
import {ArkClient,arkUsage,frozenArkContract,prepareArkImage,type ArkContract,type ArkTransport} from '../../src/worker/providers/ark.js';
import {GenerationGateway,type GenerationRequest} from '../../src/worker/generation/gateway.js';
import {freezeGenerationContracts,validateGenerationBudget} from '../../src/worker/generation/contracts.js';
import {nativeCommand} from '../../src/worker/media/native.js';
import {MediaErasureService} from '../../src/worker/lifecycle/media-erasure.js';

let db:TestDatabase,image:Buffer,video:Buffer;const roots:string[]=[];
const signal=()=>new AbortController().signal;
beforeAll(async()=>{
  db=await testDatabase();image=await sharp({create:{width:640,height:800,channels:3,background:'#284E73'}}).jpeg().toBuffer();
  const root=inside(db.cfg.runtimeRoot,`tests/generation/${id('video')}`);roots.push(root);await mkdir(root,{recursive:true});const path=join(root,'actual.mp4');
  await nativeCommand(db.cfg,process.env.FFMPEG_PATH?.trim()||'ffmpeg',['-v','error','-f','lavfi','-i','color=c=green:s=480x640:r=24','-t','1','-an',
    '-c:v','libx264','-pix_fmt','yuv420p','-movflags','+faststart',path],{cwd:root,timeoutMs:30000});video=await readFile(path);
});
afterAll(async()=>{await db?.close();for(const root of roots)await rm(inside(db.cfg.runtimeRoot,root),{recursive:true,force:true});});
afterEach(async()=>{await db.pool.query("UPDATE stage_runs SET state='CANCELLED' WHERE state NOT IN ('SUCCEEDED','FAILED')");});
const http=(body:unknown,status=200):HttpResponse=>{const bytes=Buffer.isBuffer(body)?body:Buffer.from(JSON.stringify(body));return {status,headers:{},bytes,json:()=>JSON.parse(bytes.toString('utf8')) as unknown};};
async function fixture(options:{principal?:Principal;engine?:'PER_SHOT_AI'|'REFERENCE_FILM';transport?:ArkTransport;store?:(original:ObjectStorage)=>ObjectStorage}={},testDb=db){
  const imageContract=wire('IMAGE'),videoContract=wire('VIDEO');
  const root=inside(testDb.cfg.runtimeRoot,`tests/generation/${id('case')}`);roots.push(root);await mkdir(root,{recursive:true});
  const cfg=config({...testDb.cfg,runtimeRoot:root,generationEnabled:true,provider:{...testDb.cfg.provider,baseUrl:imageContract.base_url,
    apiKey:'synthetic-not-a-real-key',imageModel:imageContract.request_model,videoModel:videoContract.request_model,allowedHosts:['generation.example.test','media.example.test']}});
  const engine=options.engine??'REFERENCE_FILM';
  const f=await mediaFixture({...testDb,cfg},{...(options.principal?{principal:options.principal}:{}),generation:{engine,contracts:[imageContract,videoContract],
    variantId:engine==='PER_SHOT_AI'?'quiet-luxury.ai-detail':'portrait-social.ai-presenter-multi'}});
  f.cfg.provider.allowedHosts=[...f.cfg.provider.allowedHosts,'generation.example.test','media.example.test'];
  const calls:{url:string;method:string;headers:Record<string,string>}[]=[];
  const transport:ArkTransport=async(url,hosts,opts={})=>{
    calls.push({url,method:opts.method??'GET',headers:opts.headers??{}});
    if(options.transport)return options.transport(url,hosts,opts);
    if(url.includes('/images/generations'))return http({model:imageContract.actual_model,data:[{b64_json:image.toString('base64'),size:'640x800'}],usage:{generated_images:1}});
    if(opts.method==='POST')return http({id:'synthetic-task-1'});
    if(url.startsWith('https://media.example.test/'))return http(video);
    return http({id:'synthetic-task-1',model:videoContract.actual_model,status:'succeeded',content:{video_url:'https://media.example.test/original.mp4'},
      usage:{completion_tokens:250,total_tokens:250},duration:1,resolution:'480p',ratio:'3:4',generate_audio:false});
  };
  const store=options.store?options.store(f.store):f.store;const client=new ArkClient(f.cfg,transport);
  const gateway=new GenerationGateway(testDb.pool,f.cfg,store,client);
  const request:GenerationRequest={kind:'IMAGE',operation_key:`image:${f.contract.source.output_slots.find(slot=>slot.kind==='image')!.slot_id}`,
    prompt:'Use the authorized product, preserve its visible structure.',reference_asset_ids:[f.assetIds[0]!]};
  const videoRequest:GenerationRequest={kind:'VIDEO',operation_key:engine==='REFERENCE_FILM'?'film:original':`video:${f.contract.creative.shots[0]!.shot_id}`,prompt:'Show the authorized product in one continuous shot.',reference_asset_ids:[f.assetIds[0]!],
    video:{duration:1,resolution:'480p',ratio:'3:4',audio:false,mode:'FIRST_FRAME'}};
  const approve=async(mode='NORMAL')=>{
    // Preparation uses its own transport/store so ACK-loss faults remain aimed
    // at the video under test. Its real incurred cost remains in order funds.
    const preparation=new GenerationGateway(testDb.pool,f.cfg,f.store,new ArkClient(f.cfg,async()=>http({model:imageContract.actual_model,
      data:[{b64_json:image.toString('base64')}],usage:{generated_images:1}})));
    const generated=await preparation.submit(f.lease,{kind:'IMAGE',operation_key:engine==='REFERENCE_FILM'?'reference:film':`reference:${f.contract.creative.shots[0]!.shot_id}`,
      prompt:'Preserve the authorized product identity.',reference_asset_ids:[f.assetIds[0]!]},signal());
    const approval=await reviewGeneratedReferences(testDb,f,mode);videoRequest.reference_asset_ids=[generated.submission_id];
    return {approval,generated,beforeVideo:(await testDb.pool.query<{spent:number;reserved:number}>('SELECT spent_micro::int AS spent,reserved_micro::int AS reserved FROM orders WHERE id=$1',[f.orderId])).rows[0]!};
  };
  return {...f,imageContract,videoContract,calls,client,gateway,request,videoRequest,store,approve};
}
async function due(submissionId:string){await db.pool.query('UPDATE provider_submissions SET next_query_at=now()-interval \'1 second\' WHERE id=$1',[submissionId]);}
async function funds(orderId:string){return (await db.pool.query<{spent:number;reserved:number}>('SELECT spent_micro::int AS spent,reserved_micro::int AS reserved FROM orders WHERE id=$1',[orderId])).rows[0]!;}

describe('generation gateway / native PG, actual PNG + MP4, synthetic provider only',()=>{
  it('refuses a reference-film video purchase before any generated-frame identity approval',async()=>{
    const f=await fixture();
    await expect(f.gateway.submit(f.lease,f.videoRequest,signal())).rejects.toMatchObject({code:'GENERATION_REFERENCE_REVIEW_REQUIRED'});
    expect(f.calls).toHaveLength(0);expect(await funds(f.orderId)).toEqual({spent:0,reserved:0});
    expect((await db.pool.query("SELECT id FROM provider_submissions WHERE order_id=$1 AND generation_kind='VIDEO'",[f.orderId])).rowCount).toBe(0);
  });
  it('also refuses a per-shot video purchase without a complete reference review',async()=>{
    const f=await fixture({engine:'PER_SHOT_AI'});
    await expect(f.gateway.submit(f.lease,f.videoRequest,signal())).rejects.toMatchObject({code:'GENERATION_REFERENCE_REVIEW_REQUIRED'});
    expect(f.calls).toHaveLength(0);expect(await funds(f.orderId)).toEqual({spent:0,reserved:0});
  });
  it.each(['REFERENCE_FAIL','REFERENCE_UNCERTAIN'])('does not purchase a video after persisted %s',async mode=>{
    const f=await fixture();await expect(f.approve(mode)).rejects.toMatchObject({code:'REFERENCE_IDENTITY_REJECTED'});
    const before=await funds(f.orderId);
    await expect(f.gateway.submit(f.lease,f.videoRequest,signal())).rejects.toMatchObject({code:'REFERENCE_IDENTITY_REJECTED'});
    expect(f.calls).toHaveLength(0);expect(await funds(f.orderId)).toEqual(before);
    expect((await db.pool.query("SELECT id FROM provider_submissions WHERE order_id=$1 AND generation_kind='VIDEO'",[f.orderId])).rowCount).toBe(0);
  });
  it('binds the original report and generated per-shot bytes, rejecting original-photo substitution',async()=>{
    const f=await fixture({engine:'PER_SHOT_AI'}),{approval,generated,beforeVideo}=await f.approve();
    await expect(f.gateway.submit(f.lease,{...f.videoRequest,reference_asset_ids:[f.assetIds[0]!] },signal())).rejects.toMatchObject({code:'GENERATION_REFERENCE_INVALID'});
    expect(f.calls).toHaveLength(0);expect(await funds(f.orderId)).toEqual(beforeVideo);
    const accepted=await f.gateway.submit(f.lease,f.videoRequest,signal());
    const row=(await db.pool.query('SELECT private FROM provider_submissions WHERE id=$1',[accepted.submission_id])).rows[0];
    expect(row.private.prepared.reference_approval).toEqual(approval);
    expect(row.private.prepared.references).toEqual([expect.objectContaining({id:generated.submission_id,sha256:generated.output!.sha256})]);
    const sent=JSON.parse((await f.store.get(row.private.request_key)).toString('utf8'));
    const content=sent.content.find((item:{type:string})=>item.type==='image_url');
    expect(sha256(Buffer.from(content.image_url.url.split(',')[1],'base64'))).toBe(generated.output!.sha256);
    await due(accepted.submission_id);expect((await f.gateway.resume(f.lease,accepted.submission_id,signal())).state).toBe('SUCCEEDED');
    expect(f.calls.filter(call=>call.method==='POST')).toHaveLength(1);expect(await funds(f.orderId)).toEqual({spent:beforeVideo.spent+250,reserved:0});
  });
  it('blocks polling on changed reference bytes and restores only the original accepted task',async()=>{
    const f=await fixture(),{generated,beforeVideo}=await f.approve();
    const accepted=await f.gateway.submit(f.lease,f.videoRequest,signal()),bytes=await f.store.get(generated.output!.object_key);
    await f.store.put(generated.output!.object_key,Buffer.from('changed-approved-frame'),'image/png');await due(accepted.submission_id);
    await expect(f.gateway.resume(f.lease,accepted.submission_id,signal())).rejects.toMatchObject({code:'REFERENCE_BYTES_CHANGED'});
    expect(f.calls).toHaveLength(1);expect(await funds(f.orderId)).toEqual({spent:beforeVideo.spent,reserved:500});
    await f.store.put(generated.output!.object_key,bytes,'image/png');
    expect((await f.gateway.resume(f.lease,accepted.submission_id,signal())).state).toBe('SUCCEEDED');
    expect(f.calls.filter(call=>call.method==='POST')).toHaveLength(1);expect(await funds(f.orderId)).toEqual({spent:beforeVideo.spent+250,reserved:0});
  });
  it('rejects a valid stage lease rebound to another order of the same owner before purchase',async()=>{
    const original=await fixture(),other=await fixture({principal:original.p});
    const rebound={...original.lease,scope_id:other.orderId,input_hash:other.snapshotHash};
    await expect(other.gateway.submit(rebound,other.request,signal())).rejects.toMatchObject({code:'GENERATION_SCOPE_INVALID'});
    expect(other.calls).toHaveLength(0);expect(await funds(other.orderId)).toEqual({spent:0,reserved:0});
    expect((await db.pool.query('SELECT id FROM provider_submissions WHERE order_id=$1',[other.orderId])).rowCount).toBe(0);
  });
  it('rejects an extended deadline on an otherwise valid stage lease before reserving money',async()=>{
    const f=await fixture(),extended={...f.lease,deadline_at:new Date(f.lease.deadline_at.getTime()+3600000)};
    await expect(f.gateway.submit(extended,f.request,signal())).rejects.toMatchObject({code:'GENERATION_SCOPE_INVALID'});
    expect(f.calls).toHaveLength(0);expect(await funds(f.orderId)).toEqual({spent:0,reserved:0});
    expect((await db.pool.query('SELECT id FROM provider_submissions WHERE order_id=$1',[f.orderId])).rowCount).toBe(0);
  });
  it('normalizes the actual generated JPEG, registers private bytes and settles original cost once',async()=>{
    const f=await fixture();const first=await f.gateway.submit(f.lease,f.request,signal());expect(first.state).toBe('SUCCEEDED');expect(first.output?.inspection.codec).toBe('png');
    const bytes=await f.store.get(first.output!.object_key);expect((await sharp(bytes).metadata()).format).toBe('png');expect(sha256(bytes)).toBe(first.output!.sha256);
    const replay=await f.gateway.submit(f.lease,f.request,signal());expect(replay).toEqual(first);expect(f.calls).toHaveLength(1);expect(await funds(f.orderId)).toEqual({spent:100,reserved:0});
    expect((await db.pool.query('SELECT kind,state FROM private_object_writes WHERE order_id=$1',[f.orderId])).rows).toEqual(expect.arrayContaining([{kind:'MEDIA',state:'STORED'},{kind:'RECEIPT',state:'STORED'}]));
  });
  it('allows only one POST under concurrent replay of the same paid node',async()=>{
    let release!:()=>void;const held=new Promise<void>(resolve=>{release=resolve;});let entered!:()=>void;const started=new Promise<void>(resolve=>{entered=resolve;});
    const f=await fixture({transport:async()=>{entered();await held;return http({model:'synthetic-image',data:[{b64_json:image.toString('base64')}],usage:{generated_images:1}});}});
    const original=f.gateway.submit(f.lease,f.request,signal());await started;
    await expect(f.gateway.submit(f.lease,f.request,signal())).rejects.toMatchObject({code:'GENERATION_BUSY'});release();expect((await original).state).toBe('SUCCEEDED');
    expect(f.calls).toHaveLength(1);expect(await funds(f.orderId)).toEqual({spent:100,reserved:0});
  });
  it('holds an ambiguous image purchase and never resubmits it after retry',async()=>{
    const f=await fixture({transport:async()=>{throw new AppError('REMOTE_UNKNOWN','synthetic timeout',503);}});
    await expect(f.gateway.submit(f.lease,f.request,signal())).rejects.toMatchObject({code:'REMOTE_UNKNOWN'});
    const replay=await f.gateway.submit(f.lease,f.request,signal());expect(replay.state).toBe('UNKNOWN');expect(f.calls).toHaveLength(1);
    expect(await funds(f.orderId)).toEqual({spent:0,reserved:100});expect(await f.gateway.reconcileReceipts()).toEqual({settled:0,blocked:1});
  });
  it('recovers the original stored receipt after an uncertain PUT without purchasing again',async()=>{
    let lost=false;const f=await fixture({store:original=>({...original,put:async(key,bytes,mime)=>{await original.put(key,bytes,mime);
      if(key.endsWith('/submit.json')&&!lost){lost=true;throw new Error('synthetic lost PUT acknowledgement');}},get:original.get.bind(original),exists:original.exists.bind(original),delete:original.delete.bind(original)})});
    await expect(f.gateway.submit(f.lease,f.request,signal())).rejects.toThrow('synthetic lost PUT');expect(await funds(f.orderId)).toEqual({spent:0,reserved:100});
    expect((await reconcileUncertainObjectWrites(db.pool,f.store)).recovered).toBeGreaterThanOrEqual(1);
    const replay=await f.gateway.submit(f.lease,f.request,signal());expect(replay.state).toBe('SUCCEEDED');expect(f.calls).toHaveLength(1);expect(await funds(f.orderId)).toEqual({spent:100,reserved:0});
  });
  it('persists a video acknowledgement, polls only that task and inspects the actual MP4',async()=>{
    const f=await fixture(),{beforeVideo}=await f.approve();const first=await f.gateway.submit(f.lease,f.videoRequest,signal());expect(first.state).toBe('RUNNING');expect(await funds(f.orderId)).toEqual({spent:beforeVideo.spent,reserved:500});
    await due(first.submission_id);const ready=await f.gateway.resume(f.lease,first.submission_id,signal());expect(ready.state).toBe('SUCCEEDED');
    expect(ready.output?.inspection).toMatchObject({kind:'video',width:480,height:640,fps:24,frames:24,hasAudio:false});expect(await funds(f.orderId)).toEqual({spent:beforeVideo.spent+250,reserved:0});
    expect(f.calls.filter(call=>call.method==='POST')).toHaveLength(1);expect(f.calls[1]?.url.endsWith('/synthetic-task-1')).toBe(true);
    const download=f.calls.find(call=>call.url.startsWith('https://media.example.test/'));expect(download?.headers).toEqual({});
    expect(await f.gateway.resume(f.lease,first.submission_id,signal())).toEqual(ready);expect(f.calls).toHaveLength(3);
  });
  it('recovers a lost original video ACK and keeps the same paid task',async()=>{
    let lost=false;const f=await fixture({store:original=>({put:async(key,bytes,mime)=>{await original.put(key,bytes,mime);
      if(key.endsWith('/submit.json')&&!lost){lost=true;throw new Error('synthetic lost ACK storage acknowledgement');}},get:original.get.bind(original),exists:original.exists.bind(original),delete:original.delete.bind(original)})});
    await f.approve();await expect(f.gateway.submit(f.lease,f.videoRequest,signal())).rejects.toThrow('synthetic lost ACK');await reconcileUncertainObjectWrites(db.pool,f.store);
    const recovered=await f.gateway.submit(f.lease,f.videoRequest,signal());expect(recovered.state).toBe('RUNNING');await due(recovered.submission_id);
    expect((await f.gateway.resume(f.lease,recovered.submission_id,signal())).state).toBe('SUCCEEDED');expect(f.calls.filter(call=>call.method==='POST')).toHaveLength(1);
  });
  it('settles a stored historical receipt while purchases are disabled and the model admission has expired',async()=>{
    let lost=false;const f=await fixture({store:original=>({put:async(key,bytes,mime)=>{await original.put(key,bytes,mime);if(key.endsWith('/submit.json')&&!lost){lost=true;throw new Error('lost ACK');}},
      get:original.get.bind(original),exists:original.exists.bind(original),delete:original.delete.bind(original)})});
    await expect(f.gateway.submit(f.lease,f.request,signal())).rejects.toThrow('lost ACK');await reconcileUncertainObjectWrites(db.pool,f.store);
    const disabled=config({...f.cfg,generationEnabled:false,provider:{...f.cfg.provider,apiKey:''}});const gateway=new GenerationGateway(db.pool,disabled,f.store);
    const clock=vi.spyOn(Date,'now').mockReturnValue(Date.now()+7200000);
    try{expect((await gateway.reconcileReceipts()).settled).toBeGreaterThanOrEqual(1);}finally{clock.mockRestore();}
    expect(await funds(f.orderId)).toEqual({spent:100,reserved:0});expect(f.calls).toHaveLength(1);
  });
  it('does not redownload or repurchase corrupted registered output bytes',async()=>{
    const f=await fixture(),ready=await f.gateway.submit(f.lease,f.request,signal());await f.store.put(ready.output!.object_key,Buffer.from('corrupt'),'image/png');
    await expect(f.gateway.resume(f.lease,ready.submission_id,signal())).rejects.toMatchObject({code:'GENERATION_OBJECT_HASH_MISMATCH'});expect(f.calls).toHaveLength(1);
  });
  it('rejects changed replay prompts before another charge or call',async()=>{
    const f=await fixture();await f.gateway.submit(f.lease,f.request,signal());
    await expect(f.gateway.submit(f.lease,{...f.request,prompt:'changed'},signal())).rejects.toMatchObject({code:'GENERATION_REQUEST_CHANGED'});expect(f.calls).toHaveLength(1);
  });
  it('holds unknown billing when the provider returns another model or omits usage',async()=>{
    for(const body of [{model:'another-model',data:[],usage:{generated_images:1}},{model:'synthetic-image',data:[]}]){
      const f=await fixture({transport:async()=>http(body)}),failed=await f.gateway.submit(f.lease,f.request,signal());expect(failed.state).toBe('FAILED');expect(failed.output).toBeUndefined();
      expect(await funds(f.orderId)).toEqual({spent:0,reserved:100});expect((await f.gateway.submit(f.lease,f.request,signal())).state).toBe('FAILED');expect(f.calls).toHaveLength(1);
    }
  });
  it('releases only an explicitly frozen non-chargeable submission error',async()=>{
    const f=await fixture({transport:async()=>http({error:{code:'bad_request'}},400)});
    expect((await f.gateway.submit(f.lease,f.request,signal())).state).toBe('FAILED');expect(await funds(f.orderId)).toEqual({spent:0,reserved:0});
  });
  it('settles late costs after cancellation but never writes or exposes media',async()=>{
    const f=await fixture({transport:async()=>{await db.pool.query("UPDATE orders SET fulfillment_state='FAILED',private=private||'{\"media_revoked\":true}'::jsonb WHERE id=$1",[f.orderId]);
      return http({model:'synthetic-image',data:[{b64_json:image.toString('base64')}],usage:{generated_images:1}});}});
    await expect(f.gateway.submit(f.lease,f.request,signal())).rejects.toMatchObject({code:'ORDER_NO_LONGER_EXECUTABLE'});expect(await funds(f.orderId)).toEqual({spent:100,reserved:0});
    await f.gateway.reconcileReceipts();expect((await db.pool.query('SELECT state,private FROM provider_submissions WHERE order_id=$1',[f.orderId])).rows[0]).toMatchObject({state:'FAILED',private:{billing_valid:true}});
    expect((await db.pool.query("SELECT id FROM private_object_writes WHERE order_id=$1 AND kind='MEDIA'",[f.orderId])).rowCount).toBe(0);
  });
  it('rejects foreign photos, old stage leases and conflicting frozen registry bindings',async()=>{
    const f=await fixture();await expect(f.gateway.submit(f.lease,{...f.request,reference_asset_ids:['foreign-photo']},signal())).rejects.toMatchObject({code:'GENERATION_REFERENCE_INVALID'});
    await expect(f.gateway.submit({...f.lease,fencing_token:String(Number(f.lease.fencing_token)+1)},f.request,signal())).rejects.toMatchObject({code:'LEASE_LOST'});
    const rows=(await db.pool.query('SELECT id,status,data,private FROM provider_model_versions WHERE id=ANY($1)',[[f.imageContract.model_version_id,f.videoContract.model_version_id]])).rows;
    expect(freezeGenerationContracts(f.cfg,rows)).toHaveLength(2);rows[0]!.data.capability_hash='f'.repeat(64);
    expect(()=>freezeGenerationContracts(f.cfg,rows)).toThrow(expect.objectContaining({code:'GENERATION_MODEL_BINDING_INVALID'}));expect(f.calls).toHaveLength(0);
    const small=structuredClone(f.contract);small.budget_micro=100;expect(()=>validateGenerationBudget(small)).toThrow(expect.objectContaining({code:'GENERATION_BUDGET_INVALID'}));
  });
  it('protects the original task, frozen rate, receipt history and completed result in PostgreSQL',async()=>{
    const f=await fixture(),ready=await f.gateway.submit(f.lease,f.request,signal());
    for(const sql of ["UPDATE provider_submissions SET private=jsonb_set(private,'{wire_contract,rate,ceiling_micro}','999') WHERE id=$1",
      "UPDATE provider_submissions SET private=jsonb_set(private,'{receipts}','[]') WHERE id=$1",
      "UPDATE provider_submissions SET state='UNKNOWN' WHERE id=$1",
      "UPDATE provider_submissions SET operation_key='another' WHERE id=$1"]){await expect(db.pool.query(sql,[ready.submission_id])).rejects.toThrow();}
    await f.approve();const accepted=await f.gateway.submit(f.lease,f.videoRequest,signal());await expect(db.pool.query("UPDATE provider_submissions SET provider_task_id='another-task' WHERE id=$1",[accepted.submission_id])).rejects.toThrow('original provider task');
    await expect(db.pool.query("UPDATE provider_submissions SET private=jsonb_set(private,'{prepared,reference_approval,report_hash}',to_jsonb(repeat('0',64))) WHERE id=$1",[accepted.submission_id])).rejects.toThrow();
  });
  it('rejects unauthorized media origins and redirects without leaking API credentials',async()=>{
    const f=await fixture();await expect(f.client.download(f.videoContract,'https://127.0.0.1/private',signal())).rejects.toMatchObject({code:'GENERATION_MEDIA_URL_INVALID'});
    await expect(f.client.download(f.videoContract,'https://attacker.example.test/video',signal())).rejects.toMatchObject({code:'GENERATION_MEDIA_URL_INVALID'});
    const redirect=new ArkClient(f.cfg,async()=>http({},302));await expect(redirect.download(f.videoContract,'https://media.example.test/video',signal())).rejects.toMatchObject({code:'GENERATION_DOWNLOAD_PENDING'});
    expect(f.calls).toHaveLength(0);expect(()=>new ArkClient({...f.cfg,env:'production'},async()=>http({}))).toThrow(expect.objectContaining({code:'GENERATION_TEST_TRANSPORT_FORBIDDEN'}));
  });
  it('isolates generation credentials from a different vision origin and refuses an empty dedicated key',async()=>{
    const f=await fixture();let authorization:string|undefined;
    const cfg=config({...f.cfg,provider:{...f.cfg.provider,baseUrl:'https://vision.example.test/v1',apiKey:'vision-only-key',allowedHosts:['vision.example.test'],
      generation:{baseUrl:f.imageContract.base_url,apiKey:'generation-only-key',allowedHosts:['generation.example.test','media.example.test']}}});
    const client=new ArkClient(cfg,async(_url,_hosts,options={})=>{authorization=options.headers?.Authorization;
      return http({model:'synthetic-image',data:[{b64_json:image.toString('base64')}],usage:{generated_images:1}});});
    expect((await new GenerationGateway(db.pool,cfg,f.store,client).submit(f.lease,f.request,signal())).state).toBe('SUCCEEDED');expect(authorization).toBe('Bearer generation-only-key');
    const second=await fixture();const blocked=config({...second.cfg,provider:{...second.cfg.provider,generation:{baseUrl:second.imageContract.base_url,apiKey:'',allowedHosts:[]}}});
    await expect(new GenerationGateway(db.pool,blocked,second.store).submit(second.lease,second.request,signal())).rejects.toMatchObject({code:'GENERATION_NOT_ADMITTED'});
    expect(await funds(second.orderId)).toEqual({spent:0,reserved:0});
  });
  it('holds a possibly chargeable error instead of releasing its original reservation',async()=>{
    const f=await fixture({transport:async()=>http({error:{code:'provider_error'}},500)});expect((await f.gateway.submit(f.lease,f.request,signal())).state).toBe('FAILED');
    expect(await funds(f.orderId)).toEqual({spent:0,reserved:100});expect((await f.gateway.submit(f.lease,f.request,signal())).state).toBe('FAILED');expect(f.calls).toHaveLength(1);
  });
  it('keeps polling the accepted task after HTTP errors and running responses without a new POST',async()=>{
    let queries=0;const f=await fixture({transport:async(url,_hosts,opts={})=>{
      if(opts.method==='POST')return http({id:'synthetic-task-1'});if(url.startsWith('https://media.example.test/'))return http(video);
      queries++;if(queries===1)return http({error:{code:'temporary'}},503);
      if(queries===2)return http({id:'synthetic-task-1',model:'synthetic-video',status:'running'});
      return http({id:'synthetic-task-1',model:'synthetic-video',status:'succeeded',content:{video_url:'https://media.example.test/original.mp4'},usage:{completion_tokens:250,total_tokens:250}});
    }});
    const {beforeVideo}=await f.approve(),initial=await f.gateway.submit(f.lease,f.videoRequest,signal());
    for(let i=0;i<2;i++){await due(initial.submission_id);expect((await f.gateway.resume(f.lease,initial.submission_id,signal())).state).toBe('RUNNING');expect(await funds(f.orderId)).toEqual({spent:beforeVideo.spent,reserved:500});}
    await due(initial.submission_id);expect((await f.gateway.resume(f.lease,initial.submission_id,signal())).state).toBe('SUCCEEDED');
    expect(queries).toBe(3);expect(f.calls.filter(call=>call.method==='POST')).toHaveLength(1);expect(await funds(f.orderId)).toEqual({spent:beforeVideo.spent+250,reserved:0});
  });
  it('enforces the frozen query limit without reopening the purchase or its budget',async()=>{
    const f=await fixture({transport:async(_url,_hosts,opts={})=>opts.method==='POST'?http({id:'synthetic-task-1'}):http({id:'synthetic-task-1',model:'synthetic-video',status:'running'})});
    const {beforeVideo}=await f.approve(),initial=await f.gateway.submit(f.lease,f.videoRequest,signal());
    for(let i=0;i<4;i++){await due(initial.submission_id);expect((await f.gateway.resume(f.lease,initial.submission_id,signal())).state).toBe('RUNNING');}
    await due(initial.submission_id);await expect(f.gateway.resume(f.lease,initial.submission_id,signal())).rejects.toMatchObject({code:'GENERATION_QUERY_LIMIT'});
    expect(f.calls).toHaveLength(5);expect(f.calls.filter(call=>call.method==='POST')).toHaveLength(1);expect(await funds(f.orderId)).toEqual({spent:beforeVideo.spent,reserved:500});
  });
  it('recovers an uncertain generated-media PUT by its original key, with one write and one purchase',async()=>{
    let writes=0;const f=await fixture({store:original=>({put:async(key,bytes,mime)=>{await original.put(key,bytes,mime);
      if(key.endsWith('/output.png')){writes++;if(writes===1)throw new Error('synthetic lost media PUT acknowledgement');}},
      get:original.get.bind(original),exists:original.exists.bind(original),delete:original.delete.bind(original)})});
    await expect(f.gateway.submit(f.lease,f.request,signal())).rejects.toThrow('synthetic lost media PUT');expect(await funds(f.orderId)).toEqual({spent:100,reserved:0});
    await reconcileUncertainObjectWrites(db.pool,f.store);expect((await f.gateway.submit(f.lease,f.request,signal())).state).toBe('SUCCEEDED');expect(writes).toBe(1);expect(f.calls).toHaveLength(1);
  });
  it('rejects a wrong-size image after recording its actual cost, then preserves that terminal failure',async()=>{
    const wrong=await sharp({create:{width:320,height:400,channels:3,background:'red'}}).jpeg().toBuffer();
    const f=await fixture({transport:async()=>http({model:'synthetic-image',data:[{b64_json:wrong.toString('base64')}],usage:{generated_images:1}})});
    await expect(f.gateway.submit(f.lease,f.request,signal())).rejects.toMatchObject({code:'GENERATION_IMAGE_INVALID'});
    expect(await funds(f.orderId)).toEqual({spent:100,reserved:0});const original=await f.gateway.submit(f.lease,f.request,signal());expect(original.state).toBe('FAILED');expect(original.output).toBeUndefined();expect(f.calls).toHaveLength(1);
  });
  it('fences a late old stage while allowing the new owner to recover the paid original result',async()=>{
    let f!:Awaited<ReturnType<typeof fixture>>;f=await fixture({transport:async()=>{
      await db.pool.query("UPDATE stage_runs SET fencing_token=fencing_token+1,lease_owner='recovered-generation-worker',lease_expires_at=now()+interval '45 seconds' WHERE id=$1",[f.lease.id]);
      return http({model:'synthetic-image',data:[{b64_json:image.toString('base64')}],usage:{generated_images:1}});
    }});
    await expect(f.gateway.submit(f.lease,f.request,signal())).rejects.toMatchObject({code:'LEASE_LOST'});expect(await funds(f.orderId)).toEqual({spent:100,reserved:0});
    expect((await db.pool.query("SELECT id FROM private_object_writes WHERE order_id=$1 AND kind='MEDIA'",[f.orderId])).rowCount).toBe(0);
    const current={...f.lease,fencing_token:String(Number(f.lease.fencing_token)+1),lease_owner:'recovered-generation-worker'};
    expect((await f.gateway.submit(current,f.request,signal())).state).toBe('SUCCEEDED');expect(f.calls).toHaveLength(1);
  });
  it('rejects a real MP4 with the wrong admitted dimensions after settling the original video cost',async()=>{
    let wrong:Buffer;const f=await fixture({transport:async(url,_hosts,options={})=>{
      if(options.method==='POST')return http({id:'synthetic-task-1'});if(url.startsWith('https://media.example.test/'))return http(wrong);
      return http({id:'synthetic-task-1',model:'synthetic-video',status:'succeeded',content:{video_url:'https://media.example.test/video.mp4'},usage:{completion_tokens:250,total_tokens:250}});
    }});
    const root=inside(f.cfg.runtimeRoot,'wrong-size'),source=join(root,'source.mp4'),output=join(root,'wrong.mp4');await mkdir(root,{recursive:true});await writeFile(source,video);
    await nativeCommand(f.cfg,process.env.FFMPEG_PATH?.trim()||'ffmpeg',['-v','error','-i',source,'-vf','scale=240:320','-an','-c:v','libx264','-pix_fmt','yuv420p',output],{cwd:root,timeoutMs:30000});wrong=await readFile(output);
    const {beforeVideo}=await f.approve(),accepted=await f.gateway.submit(f.lease,f.videoRequest,signal());await due(accepted.submission_id);
    await expect(f.gateway.resume(f.lease,accepted.submission_id,signal())).rejects.toMatchObject({code:'GENERATION_VIDEO_INVALID'});
    expect(await funds(f.orderId)).toEqual({spent:beforeVideo.spent+250,reserved:0});expect((await f.gateway.resume(f.lease,accepted.submission_id,signal())).state).toBe('FAILED');
    expect(f.calls.filter(call=>call.method==='POST')).toHaveLength(1);
  });
  it('rejects unsold nodes, changed duration and newly revoked model capability before reserving money',async()=>{
    const f=await fixture();await expect(f.gateway.submit(f.lease,{...f.request,operation_key:'image:unsold-slot'},signal())).rejects.toMatchObject({code:'GENERATION_NODE_INVALID'});
    await expect(f.gateway.submit(f.lease,{...f.videoRequest,video:{...f.videoRequest.video!,duration:2}},signal())).rejects.toMatchObject({code:'GENERATION_NODE_INVALID'});
    await db.pool.query("UPDATE provider_model_versions SET status='REVOKED' WHERE id=$1",[f.imageContract.model_version_id]);
    await expect(f.gateway.submit(f.lease,f.request,signal())).rejects.toMatchObject({code:'GENERATION_MODEL_NOT_ADMITTED'});expect(await funds(f.orderId)).toEqual({spent:0,reserved:0});expect(f.calls).toHaveLength(0);
  });
  it('retains every generation request/receipt while billing is unknown and erases them after original settlement',async()=>{
    const isolated=await testDatabase();let lost=false;
    try{
      const f=await fixture({store:original=>({put:async(key,bytes,mime)=>{await original.put(key,bytes,mime);
        if(key.endsWith('/submit.json')&&!lost){lost=true;throw new Error('synthetic lost receipt ACK');}},
        get:original.get.bind(original),exists:original.exists.bind(original),delete:original.delete.bind(original),erase:original.erase!.bind(original)})},isolated);
      await expect(f.gateway.submit(f.lease,f.request,signal())).rejects.toThrow('synthetic lost receipt ACK');await reconcileUncertainObjectWrites(isolated.pool,f.store);
      const original=(await isolated.pool.query<{object_key:string}>("UPDATE private_object_writes SET delete_requested=true,erase_available_at=now() WHERE order_id=$1 AND kind='RECEIPT' RETURNING object_key",[f.orderId])).rows;
      expect(original).toHaveLength(2);const eraser=new MediaErasureService(isolated.pool,f.store,id('generation_eraser'));
      expect(await eraser.eraseOne(signal())).toBe(false);
      for(const object of original){expect(await f.store.exists(object.object_key)).toBe(true);}
      expect((await isolated.pool.query("SELECT count(*)::int AS n FROM private_object_writes WHERE order_id=$1 AND last_error='BILLING_RECEIPT_PENDING'",[f.orderId])).rows[0].n).toBe(2);
      expect((await f.gateway.submit(f.lease,f.request,signal())).state).toBe('SUCCEEDED');
      await isolated.pool.query("UPDATE private_object_writes SET erase_available_at=now() WHERE order_id=$1 AND kind='RECEIPT'",[f.orderId]);
      expect(await eraser.eraseOne(signal())).toBe(true);expect(await eraser.eraseOne(signal())).toBe(true);
      for(const object of original){expect(await f.store.exists(object.object_key)).toBe(false);}
      expect(f.calls).toHaveLength(1);
    }finally{await isolated.close();}
  });
  it('propagates the absolute purchase deadline into its signal before a slow transport can submit',async()=>{
    const f=await fixture();const prepared=await prepareArkImage(f.imageContract,'Authorized product',[{id:f.assetIds[0]!,bytes:image,sha256:sha256(image)}]);
    const client=new ArkClient(f.cfg,async(_url,_hosts,options={})=>{await new Promise(resolve=>setTimeout(resolve,120));expect(options.signal?.aborted).toBe(true);
      throw new AppError('REMOTE_UNKNOWN','synthetic elapsed transport',503);});
    await expect(client.submit(f.imageContract,prepared,new Date(Date.now()+60),signal())).rejects.toMatchObject({code:'REMOTE_UNKNOWN'});
  });
  it('accepts optional absent tool usage but rejects extra tools, invalid contracts and unbounded units',()=>{
    const c=wire('IMAGE');expect(arkUsage(c,{model:c.actual_model,usage:{generated_images:1}})).toBe(100);
    expect(()=>arkUsage(c,{model:c.actual_model,usage:{generated_images:1,tool_usage:{web_search:1}}})).toThrow();
    expect(()=>arkUsage(c,{model:c.actual_model,tools:{unknown:true},usage:{generated_images:1}})).toThrow();
    expect(()=>arkUsage(c,{model:c.actual_model,usage:{generated_images:2}})).toThrow();
    expect(()=>frozenArkContract({...c,base_url:'invalid'})).toThrow(expect.objectContaining({code:'GENERATION_CONTRACT_INVALID'}));
    expect(hash(frozenArkContract(c))).toBe(hash(c));
  });
});
