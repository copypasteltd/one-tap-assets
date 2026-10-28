import {beforeAll,afterAll,afterEach,describe,it,expect} from 'vitest';
import {mkdir,readFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {testDatabase,type TestDatabase} from '../helpers/database.js';
import {mediaFixture} from '../helpers/media.js';
import {syntheticArkContract} from '../helpers/generation.js';
import {syntheticSpeechContract} from '../helpers/speech.js';
import {config,inside} from '../../src/api/config.js';
import {insert} from '../../src/api/db/store.js';
import {transaction,type Db} from '../../src/api/db/pool.js';
import {addSeconds,hash,id,sha256} from '../../src/api/lib/crypto.js';
import {lockMediaOwner} from '../../src/api/modules/media-access.js';
import {confirmPayment} from '../../src/api/modules/commerce.js';
import type {ObjectStorage} from '../../src/api/storage/storage.js';
import {writePrivateObject} from '../../src/api/storage/private-objects.js';
import {executionContext} from '../../src/worker/compiler/order-context.js';
import type {FrozenContract,ResourceBinding} from '../../src/worker/compiler/snapshot.js';
import {allocateNativeAudioRights,freezeNativeAudio,frozenNativeAudio,verifyNativeAudioLive,type AudioRightKind,type CharacterVoiceAdmission,type SpeechModelRow} from '../../src/worker/audio/contract.js';
import {validateGenerationBudget} from '../../src/worker/generation/contracts.js';
import {nativeCommand} from '../../src/worker/media/native.js';
import {claimStage,PendingExternal} from '../../src/worker/queue/leases.js';
import {SpeechGateway} from '../../src/worker/speech/gateway.js';
import {SpeechClient,type SpeechTransport} from '../../src/worker/providers/dashscope-asr.js';
import type {HttpResponse} from '../../src/api/lib/http.js';

let db:TestDatabase,video:Buffer;const roots:string[]=[];
const signal=()=>new AbortController().signal;
beforeAll(async()=>{
  db=await testDatabase();const root=inside(db.cfg.runtimeRoot,`tests/audio-contract/${id('media')}`);roots.push(root);await mkdir(root,{recursive:true});
  const path=join(root,'native.mp4');
  await nativeCommand(db.cfg,process.env.FFMPEG_PATH?.trim()||'ffmpeg',['-v','error','-f','lavfi','-i','color=c=green:s=320x480:r=30:d=1',
    '-f','lavfi','-i','sine=frequency=660:sample_rate=48000:duration=1','-frames:v','30','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac','-y',path],{cwd:root,timeoutMs:30000});
  video=await readFile(path);
});
afterEach(async()=>{await db.pool.query("UPDATE stage_runs SET state='CANCELLED' WHERE state NOT IN ('SUCCEEDED','FAILED')");});
afterAll(async()=>{await db?.close();for(const root of roots)await rm(inside(db.cfg.runtimeRoot,root),{recursive:true,force:true});});

async function license(kind:AudioRightKind,cost:number,change?:(d:Record<string,unknown>)=>void):Promise<ResourceBinding>{
  const binding={resource_version_id:id('synthetic_resource'),license_record_id:id('synthetic_license'),hash:sha256(id('synthetic_proof'))};
  const text='SYNTHETIC TEST LICENSE ONLY — NOT A REAL PERSON, VOICE OR MUSIC AUTHORIZATION';
  const data:Record<string,unknown>={resource_version_id:binding.resource_version_id,resource_hash:binding.hash,admission_state:'ADMITTED',
    license_text:text,license_sha256:sha256(text),audio_rights:{kind,allowed_use:'GENERATED_COMMERCIAL_AD',allocation_mode:'PREPAID_ORDER_ALLOCATION',allocation_micro:cost}};
  change?.(data);await insert(db.pool,'resource_licenses',{id:binding.license_record_id,resource_id:binding.resource_version_id,version:'SYNTHETIC-1',expires_at:addSeconds(3600),data});return binding;
}
async function fixture(options:{engine?:'PER_SHOT_AI'|'REFERENCE_FILM';style?:string;music?:boolean;zero?:boolean;revisions?:boolean;frames?:number;
  before?:(c:FrozenContract,character:CharacterVoiceAdmission)=>Promise<void>;musicLicense?:(d:Record<string,unknown>)=>void}={}){
  const speech=syntheticSpeechContract(Math.ceil((options.frames??30)/30)),image=syntheticArkContract('IMAGE'),vid=syntheticArkContract('VIDEO');vid.video!.native_audio=true;
  const root=inside(db.cfg.runtimeRoot,`tests/audio-contract/${id('case')}`);roots.push(root);await mkdir(root,{recursive:true});
  const cfg=config({...db.cfg,runtimeRoot:root,provider:{...db.cfg.provider,speech:{enabled:true,baseUrl:speech.base_url,apiKey:'synthetic-test-key',
    allowedHosts:['speech.example.test','input.example.test','result.example.test']}}});
  return mediaFixture({...db,cfg},{speech,generation:{engine:options.engine??'PER_SHOT_AI',contracts:[image,vid]},revisions:options.revisions??false,
    configureContract:async c=>{
      c.source.audio_policy={speech:'native_speech',language:'zh-CN',music:'approved_licensed_or_contract_silent',preserve_native_speech:true,
        caption_alignment:'actual_audio',second_tts_over_native_speech_allowed:false,action_sound_required:false};
      c.source.creative_components={...c.source.creative_components,caption_preset:options.style??'karaoke',music_asset_version:null,font_asset_version:null,
        bgm_volume:0.15,bgm_duck:true,music_loop_to_timeline:false};
      const character:CharacterVoiceAdmission={version:'YPCC-CHARACTER-VOICE-1',character_version_id:id('synthetic_character'),native_voice_id:id('synthetic_voice'),
        video_model_version_id:vid.model_version_id,evidence_sha256:'e'.repeat(64),valid_until:addSeconds(3600),language:'zh-CN',secondary_tts:false,
        character_binding:await license('NATIVE_CHARACTER',options.zero?0:20),voice_binding:await license('NATIVE_VOICE',options.zero?0:30)};
      c.creative.character_version_id=character.character_version_id;c.creative.native_voice_id=character.native_voice_id;c.creative.shots[0]!.spoken_text='商品实拍。';
      if(options.frames){c.creative.target_frames=options.frames;c.creative.shots[0]!.end_frame=options.frames;
        c.source.timeline_policy.target_frames=options.frames;c.source.timeline_policy.base_segments![0]!.end_seconds=options.frames/30;}
      c.plan_hash=hash(c.creative);
      if(options.music){const m=await license('MUSIC',options.zero?0:40,options.musicLicense);c.resource_versions.push(m);c.source.creative_components.music_asset_version=m.resource_version_id;}
      await options.before?.(c,character);
      await insert(db.pool,'character_versions',{id:character.character_version_id,character_id:id('character'),version:'SYNTHETIC-1',data:{admission_state:'ADMITTED',
        native_voice_ids:[character.native_voice_id],native_audio_admissions:[character]}});
      const models=(await db.pool.query<SpeechModelRow>("SELECT id,status,data,private FROM provider_model_versions WHERE status='ADMITTED' AND id=$1",[speech.model_version_id])).rows;
      await transaction(db.pool,q=>freezeNativeAudio(q,cfg,c,models));
    }});
}
type Fixture=Awaited<ReturnType<typeof fixture>>;
async function allocate(f:Fixture,q?:Db){
  const run=async(db2:Db)=>{await lockMediaOwner(db2,f.p.tenantId,f.p.userId);await db2.query('SELECT id FROM orders WHERE tenant_id=$1 AND id=$2 FOR UPDATE',[f.p.tenantId,f.orderId]);
    await allocateNativeAudioRights(db2,f.p.tenantId,f.orderId,f.contract);};
  if(q)await run(q);else await transaction(db.pool,run);
}
async function speechFixture(options:{secondSource?:boolean;frames?:number;lostAck?:boolean;music?:boolean}={}){
  const f=await fixture({music:options.music??false,frames:options.frames??30});
  await db.pool.query("UPDATE stage_runs SET state='SUCCEEDED' WHERE id=$1",[f.lease.id]);const lease=(await claimStage(db.pool,id('audio_post'),['POST']))!;
  expect(lease.scope_id).toBe(f.orderId);
  const store:ObjectStorage={put:f.store.put.bind(f.store),get:f.store.get.bind(f.store),delete:f.store.delete.bind(f.store),exists:f.store.exists.bind(f.store),
    signedReadUrl:(key,expiry)=>`https://input.example.test/${key}?Expires=${Math.floor(expiry.getTime()/1000)}&Signature=SYNTHETIC`};
  async function source(){const key=`${f.p.tenantId}/native-source/${id('original')}.mp4`;
    await writePrivateObject(db.pool,store,{tenantId:f.p.tenantId,ownerId:f.p.userId,productId:f.product.product_id,orderId:f.orderId,kind:'MEDIA'},key,video,'video/mp4');
    return (await db.pool.query<{id:string}>('SELECT id FROM private_object_writes WHERE object_key=$1',[key])).rows[0]!.id;}
  const sourceId=await source(),secondId=options.secondSource?await source():undefined;
  let posts=0,inputUrl='';const taskId=id('asr_task');
  const response=(body:unknown):HttpResponse=>({status:200,bytes:Buffer.from(JSON.stringify(body)),headers:{},json:()=>body});
  const transport:SpeechTransport=async(url,_hosts,opt={})=>{
    if(opt.method==='POST'){posts++;inputUrl=JSON.parse(String(opt.body)).input.file_url as string;
      if(options.lostAck)throw new Error('synthetic original ACK lost');return response({request_id:'synthetic-submit',output:{task_id:taskId,task_status:'PENDING'}});}
    if(url.startsWith('https://result.example.test/'))return response({file_url:inputUrl,transcripts:[{channel_id:0,text:'商品实拍。',sentences:[{begin_time:100,end_time:800,language:'zh',text:'商品实拍。',
      words:[{begin_time:100,end_time:400,text:'商品',punctuation:''},{begin_time:400,end_time:800,text:'实拍',punctuation:'。'}]}]}]});
    return response({request_id:'synthetic-query',output:{task_id:taskId,task_status:'SUCCEEDED',result:{transcription_url:'https://result.example.test/original.json'}},usage:{seconds:1}});
  };
  const gateway=new SpeechGateway(db.pool,f.cfg,store,new SpeechClient(f.cfg,transport));
  return {...f,lease,sourceId,secondId,store,gateway,posts:()=>posts};
}

describe('native audio frozen contract and original order accounting (synthetic authorizations/model)',()=>{
  it.each(['PER_SHOT_AI','REFERENCE_FILM'] as const)('freezes %s original voice/character, full-track ASR and explicit no-bed policy',async engine=>{
    const f=await fixture({engine}),audio=frozenNativeAudio(f.contract)!;
    expect(audio.music).toBeNull();expect(audio.asr.input_strategy).toBe('ASSEMBLED_NATIVE_TRACK');expect(audio.asr.max_calls).toBe(1);
    expect(audio.cost).toEqual({asr_ceiling_micro:100,license_allocation_micro:50,ceiling_micro:150});
    expect(f.snapshot.native_audio_contract_hash).toBe(hash(audio));expect(f.snapshot.audio_policy.music_license_ids).toEqual([]);expect(f.snapshot.audio_policy.ducking_enabled).toBe(false);
    await expect(executionContext(db.pool,f.p.tenantId,f.orderId,f.snapshotHash)).resolves.toHaveProperty('orderId',f.orderId);
  });
  it.each(['standard','bold','minimal','karaoke'])('freezes %s captions and licensed music gain/duck/loop',async style=>{
    const f=await fixture({style,music:true,before:async c=>{c.source.creative_components.music_loop_to_timeline=true;}}),a=frozenNativeAudio(f.contract)!;
    expect(a.caption_style).toBe(style);expect(a.music).toMatchObject({linear_gain:0.15,gain_db:-16.478175,ducking:true,loop_to_timeline:true});
    expect(a.cost.ceiling_micro).toBe(190);expect(f.snapshot.audio_policy.music_license_ids).toEqual([a.music!.binding.license_record_id]);
    expect(f.snapshot.audio_policy.ducking_enabled).toBe(true);await verifyNativeAudioLive(db.pool,f.contract);
  });
  it('rejects changing frozen caption, voice, cost or selected background without a new contract',async()=>{
    const f=await fixture({music:true});
    for(const change of [(c:FrozenContract)=>{c.source.creative_components.caption_preset='bold';},(c:FrozenContract)=>{c.creative.native_voice_id='another-voice';},
      (c:FrozenContract)=>{c.native_audio_contract!.cost.ceiling_micro++;},(c:FrozenContract)=>{c.native_audio_contract!.music=null;}]){
      const c=structuredClone(f.contract);change(c);expect(()=>frozenNativeAudio(c)).toThrow();}
  });
  it('requires full license text and its exact digest before compiling selected music',async()=>{
    await expect(fixture({music:true,musicLicense:d=>{d.license_sha256='f'.repeat(64);}})).rejects.toMatchObject({code:'AUDIO_LICENSE_UNAVAILABLE'});
    await expect(fixture({music:true,musicLicense:d=>{delete d.license_text;}})).rejects.toMatchObject({code:'AUDIO_LICENSE_UNAVAILABLE'});
  });
  it('rejects unknown caption style, secondary TTS and unbound font',async()=>{
    await expect(fixture({style:'unknown'})).rejects.toMatchObject({code:'AUDIO_CONTRACT_REQUIRED'});
    await expect(fixture({before:async c=>{c.source.audio_policy.second_tts_over_native_speech_allowed=true;}})).rejects.toMatchObject({code:'AUDIO_POLICY_UNSUPPORTED'});
    await expect(fixture({before:async c=>{c.source.creative_components.font_asset_version='another-font';}})).rejects.toMatchObject({code:'AUDIO_FONT_UNAVAILABLE'});
  });
  it('requires the admitted exact character/voice/video model combination and unexpired proof',async()=>{
    await expect(fixture({before:async(_c,p)=>{p.video_model_version_id='other-video-model';}})).rejects.toMatchObject({code:'CHARACTER_VOICE_NOT_ADMITTED'});
    await expect(fixture({before:async(_c,p)=>{p.valid_until=addSeconds(-1);}})).rejects.toMatchObject({code:'CHARACTER_VOICE_NOT_ADMITTED'});
  });
  it('refuses to silently drop selected music or action audio on a silent route',async()=>{
    const f=await mediaFixture(db);
    for(const key of ['action','music']){const c=structuredClone(f.contract);if(key==='action')c.source.audio_policy.action_sound_required=true;else c.source.creative_components.music_asset_version='selected-music';
      expect(()=>frozenNativeAudio(c)).toThrow();}
  });
  it('includes ASR and all fixed license allocations inside the same generation, Agent, repair and aftercare ceiling',async()=>{
    const f=await fixture({music:true,revisions:true}),c=structuredClone(f.contract),[image,vid]=c.generation_contracts!;
    const images=c.source.output_slots.filter(s=>s.kind==='image').length+c.creative.shots.length;
    c.budget_micro=images*image!.rate.ceiling_micro+c.creative.shots.length*vid!.rate.ceiling_micro+c.codex_contract.agent_cost_ceiling_micro
      +c.revision_policy!.budget_micro+c.repair_ceiling_micro;
    expect(()=>validateGenerationBudget(c)).toThrowError(expect.objectContaining({code:'GENERATION_BUDGET_INVALID'}));
    c.budget_micro+=c.native_audio_contract!.cost.ceiling_micro;
    expect(()=>validateGenerationBudget(c)).toThrowError(expect.objectContaining({code:'NATIVE_AUDIO_NOT_ADMITTED'}));
  });
  it('settles prepaid resource allocations once across concurrent tool/resume attempts',async()=>{
    const f=await fixture({music:true,revisions:true});await Promise.all([allocate(f),allocate(f),allocate(f)]);
    const rows=(await db.pool.query('SELECT intent_key,state,settled_micro FROM budget_reservations WHERE order_id=$1',[f.orderId])).rows;
    expect(rows).toHaveLength(3);expect(rows.every(r=>r.state==='SETTLED')).toBe(true);expect(rows.reduce((sum,r)=>sum+Number(r.settled_micro),0)).toBe(90);
    const order=(await db.pool.query('SELECT spent_micro,reserved_micro FROM orders WHERE id=$1',[f.orderId])).rows[0];expect(Number(order.spent_micro)).toBe(90);expect(Number(order.reserved_micro)).toBe(0);
  });
  it('records zero-cost prepaid rights explicitly without adding ASR or spending extra',async()=>{
    const f=await fixture({zero:true});await allocate(f);await allocate(f);
    const rows=(await db.pool.query('SELECT state,amount_micro,settled_micro FROM budget_reservations WHERE order_id=$1',[f.orderId])).rows;
    expect(rows).toHaveLength(2);expect(rows.every(r=>r.state==='SETTLED'&&r.amount_micro==='0'&&r.settled_micro==='0')).toBe(true);
  });
  it('protects reserved aftercare and rolls back all allocations when remaining original funds do not fit',async()=>{
    const f=await fixture({revisions:true});await db.pool.query('UPDATE orders SET budget_micro=$2 WHERE id=$1',[f.orderId,f.contract.revision_policy!.budget_micro+49]);
    await expect(allocate(f)).rejects.toMatchObject({code:'BUDGET_OR_DEADLINE_EXCEEDED'});
    expect((await db.pool.query('SELECT id FROM budget_reservations WHERE order_id=$1',[f.orderId])).rowCount).toBe(0);
  });
  it('immutable registrations reject altered price/evidence, deletion and admission revival',async()=>{
    const f=await fixture(),a=frozenNativeAudio(f.contract)!,licenseId=a.rights[0]!.binding.license_record_id,charId=a.character.character_version_id;
    await expect(db.pool.query("UPDATE resource_licenses SET data=jsonb_set(data,'{audio_rights,allocation_micro}','999') WHERE id=$1",[licenseId])).rejects.toThrow(/immutable/);
    await expect(db.pool.query("UPDATE character_versions SET data=data-'native_audio_admissions' WHERE id=$1",[charId])).rejects.toThrow(/immutable/);
    await expect(db.pool.query('DELETE FROM resource_licenses WHERE id=$1',[licenseId])).rejects.toThrow(/immutable/);
    await db.pool.query("UPDATE resource_licenses SET data=jsonb_set(data,'{admission_state}','\"RETIRED\"') WHERE id=$1",[licenseId]);
    await expect(db.pool.query("UPDATE resource_licenses SET data=jsonb_set(data,'{admission_state}','\"ADMITTED\"') WHERE id=$1",[licenseId])).rejects.toThrow(/revived/);
    await expect(db.pool.query("UPDATE resource_licenses SET data=data-'admission_state' WHERE id=$1",[licenseId])).rejects.toThrow(/revived/);
    await db.pool.query("UPDATE character_versions SET data=jsonb_set(data,'{admission_state}','\"RETIRED\"') WHERE id=$1",[charId]);
    await expect(db.pool.query("UPDATE character_versions SET data=jsonb_set(data,'{admission_state}','\"ADMITTED\"') WHERE id=$1",[charId])).rejects.toThrow(/revived/);
  });
  it('license expiry may tighten and revocation is irreversible, including during checkpoint recovery',async()=>{
    const f=await fixture(),right=f.contract.native_audio_contract!.rights[1]!.binding.license_record_id;
    await db.pool.query('UPDATE resource_licenses SET expires_at=now()-interval \'1 second\' WHERE id=$1',[right]);
    await expect(db.pool.query('UPDATE resource_licenses SET expires_at=now()+interval \'1 hour\' WHERE id=$1',[right])).rejects.toThrow(/extended/);
    await expect(executionContext(db.pool,f.p.tenantId,f.orderId,f.snapshotHash)).rejects.toMatchObject({code:'AUDIO_LICENSE_UNAVAILABLE'});
    await db.pool.query('UPDATE resource_licenses SET revoked_at=now() WHERE id=$1',[right]);
    await expect(db.pool.query('UPDATE resource_licenses SET revoked_at=NULL WHERE id=$1',[right])).rejects.toThrow(/undone/);
  });
  it('acknowledges an original payment after rights revocation and requests one refund instead of opening production',async()=>{
    const f=await fixture(),payment=id('payment'),merchant='synthetic-merchant';
    await db.pool.query(`UPDATE orders SET payment_state='CREATED',fulfillment_state='NOT_STARTED',
      data=jsonb_set(jsonb_set(data,'{payment_state}','"CREATED"'),'{fulfillment_state}','"NOT_STARTED"') WHERE id=$1`,[f.orderId]);
    await insert(db.pool,'payments',{id:payment,tenant_id:f.p.tenantId,order_id:f.orderId,provider:'alipay',merchant_id:merchant,state:'CREATED',amount_fen:100,
      intent_key:`payment:${f.orderId}`,data:{payment_id:payment,order_id:f.orderId,state:'CREATED',channel:'alipay',expires_at:addSeconds(900),action:{kind:'QUERY_ORIGINAL_ORDER'}}});
    await db.pool.query('UPDATE resource_licenses SET revoked_at=now() WHERE id=$1',[f.contract.native_audio_contract!.rights[0]!.binding.license_record_id]);
    const event={channel:'alipay' as const,appId:f.p.appId,subjectId:f.p.subjectId,merchantId:merchant,orderId:f.orderId,providerOrderId:id('synthetic_paid'),
      eventKey:id('synthetic_callback'),amountFen:100,rawHash:sha256('SYNTHETIC PAYMENT RECEIPT')};
    const paid=await transaction(db.pool,q=>confirmPayment(q,event));expect(paid.payment_state).toBe('CONFIRMED');expect(paid.fulfillment_state).toBe('CANCELLED');expect(paid.refund_id).toBeTruthy();
    expect((await transaction(db.pool,q=>confirmPayment(q,event))).refund_id).toBe(paid.refund_id);
    const refund=(await db.pool.query('SELECT private FROM refunds WHERE order_id=$1',[f.orderId])).rows;expect(refund).toHaveLength(1);expect(refund[0].private.reason).toBe('AUDIO_RIGHTS_UNAVAILABLE');
  });
  it('does not acquire a second full-track ASR when another registered source ID is supplied concurrently',async()=>{
    const f=await speechFixture({secondSource:true,music:true});
    const result=await Promise.allSettled([f.gateway.submit(f.lease,f.sourceId,signal()),f.gateway.submit(f.lease,f.secondId!,signal())]);
    expect(result.some(r=>r.status==='rejected'&&'code' in r.reason&&r.reason.code==='ASR_ORIGINAL_CALL_LIMIT')).toBe(true);
    expect((await db.pool.query("SELECT id FROM provider_submissions WHERE order_id=$1 AND generation_kind='ASR'",[f.orderId])).rowCount).toBe(1);expect(f.posts()).toBe(1);
    const cost=(await db.pool.query('SELECT spent_micro,reserved_micro FROM orders WHERE id=$1',[f.orderId])).rows[0];
    expect(Number(cost.spent_micro)+Number(cost.reserved_micro)).toBe(190);
  });
  it('resumes the same successful ASR without charging rights or the provider twice',async()=>{
    const f=await speechFixture({music:true});let result;
    try{result=await f.gateway.submit(f.lease,f.sourceId,signal());}catch(e){if(!(e instanceof PendingExternal))throw e;}
    const original=(await db.pool.query('SELECT id FROM provider_submissions WHERE order_id=$1',[f.orderId])).rows[0]!.id as string;
    await db.pool.query('UPDATE provider_submissions SET next_query_at=now()-interval \'1 second\' WHERE id=$1',[original]);
    result=await f.gateway.resume(f.lease,original,signal());expect(result.state).toBe('SUCCEEDED');expect(result.transcript?.segments.map(s=>s.text).join('')).toBe('商品实拍。');
    await expect(db.pool.query("UPDATE provider_submissions SET private=private-'audio_contract_hash' WHERE id=$1",[original])).rejects.toThrow(/immutable/);
    expect((await f.gateway.submit(f.lease,f.sourceId,signal())).submission_id).toBe(original);expect(f.posts()).toBe(1);
    const cost=(await db.pool.query('SELECT spent_micro,reserved_micro FROM orders WHERE id=$1',[f.orderId])).rows[0];expect(Number(cost.spent_micro)).toBe(190);expect(Number(cost.reserved_micro)).toBe(0);
  });
  it('unknown original ACK keeps its reservation and forbids a replacement source purchase',async()=>{
    const f=await speechFixture({secondSource:true,lostAck:true});await expect(f.gateway.submit(f.lease,f.sourceId,signal())).rejects.toThrow(/ACK lost/);
    await expect(f.gateway.submit(f.lease,f.secondId!,signal())).rejects.toMatchObject({code:'ASR_ORIGINAL_CALL_LIMIT'});expect(f.posts()).toBe(1);
    const rows=(await db.pool.query('SELECT state,amount_micro FROM budget_reservations WHERE order_id=$1',[f.orderId])).rows;
    expect(rows.filter(r=>r.state==='UNKNOWN')).toEqual([expect.objectContaining({amount_micro:'100'})]);expect(rows.filter(r=>r.state==='SETTLED')).toHaveLength(2);
  });
  it('rejects a partial clip instead of treating it as the full sold audio timeline',async()=>{
    const f=await speechFixture({frames:60});await expect(f.gateway.submit(f.lease,f.sourceId,signal())).rejects.toMatchObject({code:'ASR_TIMELINE_MISMATCH'});
    expect(f.posts()).toBe(0);expect((await db.pool.query('SELECT id FROM budget_reservations WHERE order_id=$1',[f.orderId])).rowCount).toBe(0);
  });
  it('revoking a license stops original ASR recovery and publishes no transcript',async()=>{
    const f=await speechFixture({lostAck:true});await expect(f.gateway.submit(f.lease,f.sourceId,signal())).rejects.toThrow();
    await db.pool.query('UPDATE resource_licenses SET revoked_at=now() WHERE id=$1',[f.contract.native_audio_contract!.rights[0]!.binding.license_record_id]);
    const original=(await db.pool.query('SELECT id FROM provider_submissions WHERE order_id=$1',[f.orderId])).rows[0]!.id as string;
    await expect(f.gateway.resume(f.lease,original,signal())).rejects.toMatchObject({code:'AUDIO_LICENSE_UNAVAILABLE'});expect(f.posts()).toBe(1);
    expect((await db.pool.query("SELECT id FROM private_object_writes WHERE order_id=$1 AND object_key LIKE '%/transcript.json'",[f.orderId])).rowCount).toBe(0);
  });
});
