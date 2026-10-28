import {beforeAll,afterAll,afterEach,describe,it,expect} from 'vitest';
import {mkdir,readFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {createHmac} from 'node:crypto';
import {testDatabase,type TestDatabase} from '../helpers/database.js';
import {mediaFixture} from '../helpers/media.js';
import {syntheticSpeechContract as contract} from '../helpers/speech.js';
import {config,inside} from '../../src/api/config.js';
import {id,hash,sha256,addSeconds} from '../../src/api/lib/crypto.js';
import type {HttpResponse} from '../../src/api/lib/http.js';
import {OssStorage,type ObjectStorage} from '../../src/api/storage/storage.js';
import {writePrivateObject,reconcileUncertainObjectWrites} from '../../src/api/storage/private-objects.js';
import {claimStage} from '../../src/worker/queue/leases.js';
import {nativeCommand} from '../../src/worker/media/native.js';
import {loadProductionFont} from '../../src/worker/media/font.js';
import {compileNativeCaptions} from '../../src/worker/media/native-captions.js';
import {SpeechGateway} from '../../src/worker/speech/gateway.js';
import {ASR_DOCUMENTATION,SpeechClient,actualSpeechTranscript,frozenSpeechContract,speechTask,speechCost,type SpeechContract,type SpeechTransport} from '../../src/worker/providers/dashscope-asr.js';
import {GenerationGateway} from '../../src/worker/generation/gateway.js';
import {MediaErasureService} from '../../src/worker/lifecycle/media-erasure.js';

let db:TestDatabase,video:Buffer,stereo:Buffer;const roots:string[]=[];
const signal=()=>new AbortController().signal;
const http=(body:unknown,status=200):HttpResponse=>{const bytes=Buffer.from(JSON.stringify(body));return {status,bytes,headers:{},json:()=>body};};
const resultBody=(url:string)=>({file_url:url,transcripts:[{channel_id:0,text:'商品实拍。',sentences:[{begin_time:100,end_time:800,language:'zh',text:'商品实拍。',
  words:[{begin_time:100,end_time:400,text:'商品',punctuation:''},{begin_time:400,end_time:800,text:'实拍',punctuation:'。'}]}]}]});
beforeAll(async()=>{db=await testDatabase();const root=inside(db.cfg.runtimeRoot,`tests/asr/${id('videos')}`);roots.push(root);await mkdir(root,{recursive:true});
  for(const [name,source] of [['mono','sine=frequency=660:sample_rate=48000:duration=1'],['stereo','aevalsrc=0.1*sin(2*PI*660*t)|0.1*sin(2*PI*440*t):s=48000:d=1']]){
    const path=join(root,`${name}.mp4`);await nativeCommand(db.cfg,process.env.FFMPEG_PATH?.trim()||'ffmpeg',['-v','error','-f','lavfi','-i','color=c=green:s=320x480:r=30:d=1',
      '-f','lavfi','-i',source!,'-frames:v','30','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac','-y',path],{cwd:root,timeoutMs:30000});
    if(name==='mono')video=await readFile(path);else stereo=await readFile(path);
  }
});
afterAll(async()=>{await db?.close();for(const root of roots)await rm(inside(db.cfg.runtimeRoot,root),{recursive:true,force:true});});
afterEach(async()=>{await db.pool.query("UPDATE stage_runs SET state='CANCELLED' WHERE state NOT IN ('SUCCEEDED','FAILED')");});
async function fixture(options:{transport?:SpeechTransport;bytes?:Buffer;decorate?:(s:ObjectStorage)=>ObjectStorage}={}){
  const c=contract(),root=inside(db.cfg.runtimeRoot,`tests/asr/${id('case')}`);roots.push(root);await mkdir(root,{recursive:true});
  const cfg=config({...db.cfg,runtimeRoot:root,provider:{...db.cfg.provider,speech:{enabled:true,baseUrl:c.base_url,apiKey:'synthetic-test-key',
    allowedHosts:['speech.example.test','input.example.test','result.example.test']}}});
  const f=await mediaFixture({...db,cfg},{speech:c});
  await db.pool.query("UPDATE stage_runs SET state='SUCCEEDED' WHERE id=$1",[f.lease.id]);const lease=(await claimStage(db.pool,id('asr_test_worker'),['POST']))!;
  expect(lease.scope_id).toBe(f.orderId);
  const store: ObjectStorage={put:f.store.put.bind(f.store),get:f.store.get.bind(f.store),delete:f.store.delete.bind(f.store),exists:f.store.exists.bind(f.store),
    signedReadUrl:(key,expiry)=>`https://input.example.test/${key}?Expires=${Math.floor(expiry.getTime()/1000)}&Signature=SYNTHETIC`};
  const actualStore=options.decorate?.(store)??store;
  const sourceKey=`${f.p.tenantId}/speech-source/${id('actual')}.mp4`;
  await writePrivateObject(db.pool,actualStore,{tenantId:f.p.tenantId,ownerId:f.p.userId,productId:f.product.product_id,orderId:f.orderId,kind:'MEDIA'},sourceKey,options.bytes??video,'video/mp4');
  const sourceId=(await db.pool.query<{id:string}>('SELECT id FROM private_object_writes WHERE object_key=$1',[sourceKey])).rows[0]!.id;
  const calls:{url:string;method:string;headers:Record<string,string>;signal:AbortSignal|undefined}[]=[];let inputUrl='';const taskId=id('synthetic_task');
  const transport:SpeechTransport=async(url,hosts,options2={})=>{
    calls.push({url,method:options2.method??'GET',headers:options2.headers??{},signal:options2.signal});
    if(options2.method==='POST')inputUrl=(JSON.parse(String(options2.body)) as {input:{file_url:string}}).input.file_url;
    if(options.transport)return options.transport(url,hosts,options2);
    if(options2.method==='POST')return http({request_id:id('request'),output:{task_id:taskId,task_status:'PENDING'}});
    if(url.startsWith('https://result.example.test/'))return http(resultBody(inputUrl));
    return http({request_id:id('query'),output:{task_id:taskId,task_status:'SUCCEEDED',result:{transcription_url:'https://result.example.test/original.json'}},usage:{seconds:1}});
  };
  const gateway=new SpeechGateway(db.pool,f.cfg,actualStore,new SpeechClient(f.cfg,transport));
  const latest=async()=>(await db.pool.query('SELECT * FROM provider_submissions WHERE order_id=$1',[f.orderId])).rows[0]!;
  const due=async()=>{await db.pool.query('UPDATE provider_submissions SET next_query_at=now()-interval \'1 second\' WHERE order_id=$1',[f.orderId]);};
  async function complete(){await gateway.submit(lease,sourceId,signal()).catch(e=>{if(!(e instanceof Error&&e.name==='Error'&&'delaySeconds' in e))throw e;});
    const r=await latest();await due();return gateway.resume(lease,r.id as string,signal());}
  return {...f,lease,c,sourceId,sourceKey,calls,gateway,store:actualStore,latest,due,complete,taskId};
}

describe('durable single-channel ASR: synthetic provider, native PG and audio',()=>{
  it('freezes strict contracts, integer-second ceilings, source hosts and response task identity',()=>{
    const c=contract();expect(frozenSpeechContract(c)).toEqual(c);expect(speechCost(c,1)).toBe(100);
    expect(()=>speechCost(c,1.1)).toThrow();expect(()=>frozenSpeechContract({...c,max_audio_seconds:2})).toThrow();
    expect(()=>speechTask({request_id:'q',output:{task_id:'other',task_status:'SUCCEEDED'}},'original')).toThrow();
  });
  it('signs exactly one private OSS object with bounded original expiry',()=>{
    const cfg=config({...db.cfg,storage:{...db.cfg.storage,driver:'oss',endpoint:'https://oss-cn-beijing.aliyuncs.com',bucket:'synthetic-bucket',keyId:'synthetic-id',secret:'synthetic-secret'}});
    const store=new OssStorage(cfg),expires=new Date(Date.now()+60000),url=new URL(store.signedReadUrl('tenant/source.wav',expires));
    const canonical=`GET\n\n\n${url.searchParams.get('Expires')}\n/synthetic-bucket/tenant/source.wav`;
    expect(url.searchParams.get('Signature')).toBe(createHmac('sha1','synthetic-secret').update(canonical).digest('base64'));
    expect(url.protocol).toBe('https:');expect(()=>store.signedReadUrl('../escape.wav',expires)).toThrow();expect(()=>store.signedReadUrl('a',new Date(Date.now()+7201000))).toThrow();
  });
  it('decodes actual audio, records original request/query/result, settles once and returns source-bound word captions',async()=>{
    const f=await fixture();const result=await f.complete();expect(result.state).toBe('SUCCEEDED');expect(result.transcript?.segments[0]?.text).toBe('商品实拍。');
    expect(result.transcript?.source_sha256).toBe(sha256(video));const r=await f.latest();expect(r.private.prepared.source.audio.source_channels).toBe(1);
    const wav=await f.store.get(r.private.prepared.wav_key as string);expect(wav.readUInt16LE(22)).toBe(1);expect(wav.readUInt32LE(24)).toBe(48000);
    const font=await loadProductionFont(f.cfg.projectRoot);
    for(const style of ['standard','bold','minimal','karaoke'] as const){
      const captions=compileNativeCaptions(result.transcript!,r.private.prepared.source.audio,font,style);expect(captions.script).toContain('商品');
      expect(captions.transcript_hash).toBe(hash(result.transcript));
    }
    expect(f.calls.filter(x=>x.method==='POST')).toHaveLength(1);expect(f.calls.find(x=>x.url.startsWith('https://result'))?.headers.Authorization).toBeUndefined();
    expect((await f.gateway.resume(f.lease,r.id as string,signal())).transcript).toEqual(result.transcript);
    const ledger=(await db.pool.query('SELECT state,settled_micro FROM budget_reservations WHERE order_id=$1',[f.orderId])).rows;expect(ledger).toEqual([{state:'SETTLED',settled_micro:'100'}]);
    expect(r.private.receipts.map((p:{kind:string})=>p.kind)).toEqual(['SUBMIT','QUERY','RESULT']);
  });
  it('keeps the same intent and reserved cost after a lost submit ACK, with no repeat POST',async()=>{
    const f=await fixture({transport:async()=>{throw new Error('synthetic connection lost');}});
    await expect(f.gateway.submit(f.lease,f.sourceId,signal())).rejects.toThrow('synthetic connection lost');const r=await f.latest();
    await expect(f.gateway.submit(f.lease,f.sourceId,signal())).rejects.toMatchObject({code:'ASR_ORIGINAL_ACK_UNKNOWN'});
    expect(f.calls.filter(x=>x.method==='POST')).toHaveLength(1);expect((await f.latest()).id).toBe(r.id);
    expect((await db.pool.query('SELECT state FROM budget_reservations WHERE order_id=$1',[f.orderId])).rows).toEqual([{state:'UNKNOWN'}]);
  });
  it('recovers an ACK stored by an uncertain write before querying the same original task',async()=>{
    let fail=true;const f=await fixture({decorate:s=>({...s,put:async(k,b,m)=>{await s.put(k,b,m);if(fail&&k.endsWith('/submit.json')){fail=false;throw new Error('synthetic lost storage ACK');}}})});
    await expect(f.gateway.submit(f.lease,f.sourceId,signal())).rejects.toThrow('synthetic lost storage ACK');
    await reconcileUncertainObjectWrites(db.pool,f.store);await f.due();const r=await f.latest();await expect(f.gateway.resume(f.lease,r.id as string,signal())).resolves.toMatchObject({state:'SUCCEEDED'});
    expect(f.calls.filter(x=>x.method==='POST')).toHaveLength(1);expect(f.calls.some(x=>x.url.endsWith(`/tasks/${f.taskId}`))).toBe(true);
  });
  it('finishes the original pre-send request after a source write ACK is lost without buying twice',async()=>{
    let fail=true;const f=await fixture({decorate:s=>({...s,put:async(k,b,m)=>{await s.put(k,b,m);if(fail&&k.endsWith('/source.wav')){fail=false;throw new Error('synthetic source ACK lost');}}})});
    await expect(f.gateway.submit(f.lease,f.sourceId,signal())).rejects.toThrow('synthetic source ACK lost');expect(f.calls).toHaveLength(0);
    const before=await f.latest();expect(before.private.sending_started_at).toBeUndefined();await reconcileUncertainObjectWrites(db.pool,f.store);
    await expect(f.gateway.resume(f.lease,before.id as string,signal())).rejects.toMatchObject({code:'ASR_ORIGINAL_TASK_PENDING'});
    await f.due();await expect(f.gateway.resume(f.lease,before.id as string,signal())).resolves.toMatchObject({state:'SUCCEEDED'});
    expect(f.calls.filter(c=>c.method==='POST')).toHaveLength(1);expect((await f.latest()).id).toBe(before.id);
  });
  it('recovers the persisted original result after a lost result ACK without downloading another result',async()=>{
    let fail=true;const f=await fixture({decorate:s=>({...s,put:async(k,b,m)=>{await s.put(k,b,m);if(fail&&/\/result-\d+\.json$/.test(k)){fail=false;throw new Error('synthetic result ACK lost');}}})});
    await expect(f.gateway.submit(f.lease,f.sourceId,signal())).rejects.toMatchObject({code:'ASR_ORIGINAL_TASK_PENDING'});const r=await f.latest();await f.due();
    await expect(f.gateway.resume(f.lease,r.id as string,signal())).rejects.toThrow('synthetic result ACK lost');await reconcileUncertainObjectWrites(db.pool,f.store);
    await expect(f.gateway.resume(f.lease,r.id as string,signal())).resolves.toMatchObject({state:'SUCCEEDED'});
    expect(f.calls.filter(c=>c.method==='POST')).toHaveLength(1);expect(f.calls.filter(c=>c.url.startsWith('https://result'))).toHaveLength(1);
  });
  it('does not infer a free failed purchase from an HTTP error while querying the original task',async()=>{
    const f=await fixture();await expect(f.gateway.submit(f.lease,f.sourceId,signal())).rejects.toMatchObject({code:'ASR_ORIGINAL_TASK_PENDING'});await f.due();const r=await f.latest();
    const bad=new SpeechGateway(db.pool,f.cfg,f.store,new SpeechClient(f.cfg,async()=>http({code:'TaskNotFound'},404)));
    await expect(bad.resume(f.lease,r.id as string,signal())).rejects.toMatchObject({code:'ASR_ORIGINAL_TASK_PENDING'});
    expect((await db.pool.query('SELECT state FROM budget_reservations WHERE order_id=$1',[f.orderId])).rows[0]?.state).toBe('UNKNOWN');
    expect((await f.latest()).provider_task_id).toBe(f.taskId);expect((await f.latest()).private.output).toBeUndefined();
  });
  it('retains missing/invalid supplier usage and never treats a failed HTTP query as a zero charge',async()=>{
    const f=await fixture();await expect(f.gateway.submit(f.lease,f.sourceId,signal())).rejects.toMatchObject({code:'ASR_ORIGINAL_TASK_PENDING'});const r=await f.latest();await f.due();
    const bad=new SpeechGateway(db.pool,f.cfg,f.store,new SpeechClient(f.cfg,async()=>http({request_id:'q',output:{task_id:f.taskId,task_status:'SUCCEEDED',result:{transcription_url:'https://result.example.test/a'}}})));
    await expect(bad.resume(f.lease,r.id as string,signal())).rejects.toMatchObject({code:'ASR_USAGE_INVALID'});
    expect((await db.pool.query('SELECT state FROM budget_reservations WHERE order_id=$1',[f.orderId])).rows[0]?.state).toBe('UNKNOWN');
  });
  it('rejects cross-order and forged original stage/deadline leases before any supplier call',async()=>{
    const f=await fixture(),other=await fixture();
    await expect(f.gateway.submit({...f.lease,scope_id:other.orderId},f.sourceId,signal())).rejects.toThrow();
    await expect(f.gateway.submit({...f.lease,deadline_at:new Date(Date.parse(f.snapshot.deadline_at)+1000)},f.sourceId,signal())).rejects.toThrow();
    await expect(f.gateway.submit(f.lease,other.sourceId,signal())).rejects.toMatchObject({code:'ASR_SOURCE_REVOKED'});expect(f.calls).toHaveLength(0);
  });
  it('rejects distinct stereo channels rather than dropping one or risking phase cancellation',async()=>{
    const f=await fixture({bytes:stereo});await expect(f.gateway.submit(f.lease,f.sourceId,signal())).rejects.toMatchObject({code:'ASR_STEREO_REVIEW_REQUIRED'});
    expect(f.calls).toHaveLength(0);expect(await f.latest()).toBeUndefined();
  });
  it('blocks expired or revoked originals and detects changed actual source bytes',async()=>{
    const f=await fixture();await f.store.put(f.sourceKey,Buffer.from('changed'),'video/mp4');
    await expect(f.gateway.submit(f.lease,f.sourceId,signal())).rejects.toMatchObject({code:'ASR_SOURCE_HASH_MISMATCH'});
    await db.pool.query('UPDATE private_object_writes SET delete_requested=true WHERE id=$1',[f.sourceId]);
    await expect(f.gateway.submit(f.lease,f.sourceId,signal())).rejects.toMatchObject({code:'ASR_SOURCE_REVOKED'});expect(f.calls).toHaveLength(0);
  });
  it('does not publish a transcript after the source is revoked during result download',async()=>{
    const f=await fixture();await expect(f.gateway.submit(f.lease,f.sourceId,signal())).rejects.toMatchObject({code:'ASR_ORIGINAL_TASK_PENDING'});await f.due();const r=await f.latest();
    const revoke=new SpeechGateway(db.pool,f.cfg,f.store,new SpeechClient(f.cfg,async(url)=>{
      if(url.startsWith('https://result')){await db.pool.query('UPDATE private_object_writes SET delete_requested=true WHERE id=$1',[f.sourceId]);return http(resultBody(r.private.prepared.url as string));}
      return http({request_id:'q',output:{task_id:f.taskId,task_status:'SUCCEEDED',result:{transcription_url:'https://result.example.test/a'}},usage:{seconds:1}});
    }));
    await expect(revoke.resume(f.lease,r.id as string,signal())).rejects.toMatchObject({code:'ASR_SOURCE_REVOKED'});expect((await f.latest()).private.output).toBeUndefined();
  });
  it('enforces immutable request, source and append-only receipts in PostgreSQL',async()=>{
    const f=await fixture();await expect(f.gateway.submit(f.lease,f.sourceId,signal())).rejects.toMatchObject({code:'ASR_ORIGINAL_TASK_PENDING'});const r=await f.latest();
    await expect(db.pool.query("UPDATE provider_submissions SET private=jsonb_set(private,'{prepared,url}','\"https://other.test/a\"') WHERE id=$1",[r.id])).rejects.toThrow('frozen request is immutable');
    await expect(db.pool.query("UPDATE provider_submissions SET private=jsonb_set(private,'{receipts}','[]') WHERE id=$1",[r.id])).rejects.toThrow('append only');
    await expect(db.pool.query("UPDATE provider_submissions SET provider_task_id='replacement' WHERE id=$1",[r.id])).rejects.toThrow('original provider task is immutable');
  });
  it('bounds network work by the original deadline and rejects redirects or unapproved result hosts without API-key leakage',async()=>{
    const c=contract(),cfg=config({...db.cfg,provider:{...db.cfg.provider,speech:{enabled:true,baseUrl:c.base_url,apiKey:'synthetic',allowedHosts:['speech.example.test','input.example.test','result.example.test']}}});let calls=0;
    const client=new SpeechClient(cfg,async(_url,_hosts,o)=>{calls++;expect(o?.headers?.Authorization).toBeUndefined();expect(o?.signal).toBeDefined();return http({},302);});
    await expect(client.query(c,'original',new Date(Date.now()-1),signal())).rejects.toMatchObject({code:'ASR_DEADLINE'});
    await expect(client.download(c,'http://result.example.test/a',new Date(Date.now()+1000),signal())).rejects.toThrow();
    await expect(client.download(c,'https://evil.test/a',new Date(Date.now()+1000),signal())).rejects.toThrow();expect(calls).toBe(0);
    const aborted=new AbortController();aborted.abort();await expect(client.download(c,'https://result.example.test/a',new Date(Date.now()+1000),aborted.signal)).rejects.toThrow();
    const slow=new SpeechClient(cfg,async()=>new Promise(resolve=>setTimeout(()=>resolve(http({})),150)));
    const start=Date.now();await expect(slow.query(c,'original',new Date(Date.now()+30),signal())).rejects.toMatchObject({code:'ASR_DEADLINE'});
    expect(Date.now()-start).toBeLessThan(140);
  });
  it('splits long sentences only at actual word boundaries and rejects injected, mismatched or missing timecodes',async()=>{
    const f=await fixture();await f.complete();const r=await f.latest(),audio=r.private.prepared.source.audio,url=r.private.prepared.url;
    const words=Array.from({length:55},(_,i)=>({begin_time:i*15,end_time:(i+1)*15,text:'商',punctuation:''}));
    const raw={file_url:url,transcripts:[{channel_id:0,text:'商'.repeat(55),sentences:[{begin_time:0,end_time:825,language:'zh',text:'商'.repeat(55),words}]}]};
    const parse=(b:unknown)=>actualSpeechTranscript(f.c,Buffer.from(JSON.stringify(b)),{url,audio,receipt_sha256:'b'.repeat(64)});
    expect(parse(raw).segments.map(s=>[s.start_ms,s.end_ms,[...s.text].length])).toEqual([[0,720,48],[720,825,7]]);
    const bad=structuredClone(raw);bad.transcripts[0]!.sentences[0]!.words[0]!.text='{\\k99}';expect(()=>parse(bad)).toThrow();
    const mismatch=structuredClone(raw);mismatch.transcripts[0]!.text='不同';expect(()=>parse(mismatch)).toThrow();
    const missing=structuredClone(raw);missing.transcripts[0]!.sentences[0]!.words=[];expect(()=>parse(missing)).toThrow();
    const wrong=structuredClone(raw);wrong.file_url='https://other.test/changed';expect(()=>parse(wrong)).toThrow();
    const spaces=resultBody(url);spaces.transcripts[0]!.text='USB C。';spaces.transcripts[0]!.sentences[0]!.text='USB C。';
    spaces.transcripts[0]!.sentences[0]!.words=[{begin_time:100,end_time:400,text:'USB',punctuation:''},{begin_time:400,end_time:800,text:'C',punctuation:'。'}];
    expect(parse(spaces).segments[0]!.text).toBe('USB C。');
  });
  it('reconciles stored receipts with service disabled and keeps UNKNOWN receipts protected from erasure',async()=>{
    const f=await fixture({transport:async()=>{throw new Error('synthetic unknown');}});await expect(f.gateway.submit(f.lease,f.sourceId,signal())).rejects.toThrow();const r=await f.latest();
    await db.pool.query("UPDATE private_object_writes SET delete_requested=true WHERE order_id=$1 AND kind='RECEIPT'",[f.orderId]);
    const eraser=new MediaErasureService(db.pool,f.store,id('erase'));for(let n=0;n<4;n++)await eraser.eraseOne(signal());
    const request=await f.store.get(r.private.request_key as string);expect(sha256(request)).toBe(r.private.request_sha256);
    const disabled=config({...f.cfg,provider:{...f.cfg.provider,speech:{...f.cfg.provider.speech!,enabled:false}}});
    const gateway=new SpeechGateway(db.pool,disabled,f.store);expect((await gateway.reconcileReceipts()).blocked).toBeGreaterThan(0);
    const ark=new GenerationGateway(db.pool,f.cfg,f.store);await expect(ark.reconcileReceipts()).resolves.toBeDefined();
    await expect(ark.resume(f.lease,r.id as string,signal())).rejects.toThrow();expect(f.calls).toHaveLength(1);
  });
});
