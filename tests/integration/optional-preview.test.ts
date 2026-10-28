import {beforeAll,afterAll,beforeEach,it,expect} from 'vitest';
import {rm} from 'node:fs/promises';
import sharp from 'sharp';
import type {FastifyInstance,HTTPMethods} from 'fastify';
import {testDatabase,account,type TestDatabase} from '../helpers/database';
import {rawProfile,variant} from '../helpers/fixtures';
import {config,inside} from '../../src/api/config';
import {buildApp} from '../../src/api/app';
import {transaction} from '../../src/api/db/pool';
import {insert} from '../../src/api/db/store';
import {createProduct} from '../../src/api/modules/products';
import {requestDeletion} from '../../src/api/modules/support';
import {LocalStorage,type ObjectStorage} from '../../src/api/storage/storage';
import {writePrivateObject,reconcileUncertainObjectWrites} from '../../src/api/storage/private-objects';
import {id,hash,sha256,addSeconds} from '../../src/api/lib/crypto';
import {normalizeVision} from '../../src/worker/analysis/profile';
import {basePlan} from '../../src/worker/compiler/plan';
import {outputSlots} from '../../src/api/modules/catalog';
import {OptionalPreviewService} from '../../src/worker/previews/service';
import {claimStage,completeStage,deferStage,failStage,PendingExternal,type StageLease} from '../../src/worker/queue/leases';
import {expireWork} from '../../src/worker/lifecycle/deadlines';
import {MediaErasureService} from '../../src/worker/lifecycle/media-erasure';
import type {DTO} from '../../src/shared/contracts/types';

type Actor=Awaited<ReturnType<typeof account>>;
let db:TestDatabase;let app:FastifyInstance;let cfg:ReturnType<typeof config>;let store:LocalStorage;let directory:string;
let peer=0;let address='198.19.0.1';const signal=new AbortController().signal;
beforeEach(()=>{address=`198.19.0.${++peer}`;});
beforeAll(async()=>{
  db=await testDatabase();directory=inside(db.cfg.runtimeRoot,`tests/optional-preview/${id('case')}`);
  cfg=config({...db.cfg,runtimeRoot:directory,generationEnabled:true,codex:{...db.cfg.codex,enabled:false}});
  store=new LocalStorage(cfg);app=await buildApp({cfg,pool:db.pool,storage:store,tls:false});
});
afterAll(async()=>{await app?.close();await db?.close();if(directory)await rm(directory,{recursive:true,force:true});});
async function api(method:HTTPMethods,path:string,actor:Actor,body?:unknown){
  return app.inject({method,url:`/v1/p01${path}`,remoteAddress:address,headers:{authorization:`Bearer ${actor.accessToken}`,'idempotency-key':id('preview-intent')},...(body?{payload:body}:{})});
}
async function fixture(variantId='minimal-clean.photo-layout'){
  const actor=await account(db);const p=actor.principal;const product=await transaction(db.pool,c=>createProduct(c,p));
  const photos:{asset_id:string;sha256:string;key:string}[]=[];
  for(let n=0;n<3;n++){
    const bytes=await sharp({create:{width:360,height:480,channels:3,background:{r:40+n*15,g:80+n*15,b:180}}}).png().toBuffer();
    const assetId=id('photo');const key=`${p.tenantId}/preview-input/${assetId}.png`;
    await insert(db.pool,'assets',{id:assetId,tenant_id:p.tenantId,owner_id:p.userId,product_id:product.product_id,purpose:'PRODUCT',state:'READY',
      object_key:key,upload_token_hash:hash('synthetic-only'),expected_bytes:bytes.length,declared_mime:'image/png',sha256:sha256(bytes),size_bytes:bytes.length,
      width:360,height:480,expires_at:addSeconds(86400),grant_expires_at:addSeconds(900),data:{}});
    await writePrivateObject(db.pool,store,{tenantId:p.tenantId,ownerId:p.userId,productId:product.product_id,kind:'INPUT'},key,bytes,'image/png');
    photos.push({asset_id:assetId,sha256:sha256(bytes),key});
  }
  const photoVersionId=id('photos');
  await insert(db.pool,'product_photo_versions',{id:photoVersionId,tenant_id:p.tenantId,product_id:product.product_id,revision:1,
    photo_set_hash:hash({photos:photos.map(({asset_id,sha256})=>({asset_id,sha256})),revision:1,normalization:'sharp-auto-orient-strip-png-v1'}),data:photos});
  for(const [position,photo]of photos.entries())await insert(db.pool,'product_photo_items',{id:id('photoitem'),tenant_id:p.tenantId,photo_version_id:photoVersionId,asset_id:photo.asset_id,position});
  let raw=JSON.stringify(rawProfile());['asset-a','asset-b','asset-c'].forEach((old,n)=>{raw=raw.replaceAll(old,photos[n]!.asset_id);});
  const {profile,identityLock}=normalizeVision(JSON.parse(raw),{tenantId:p.tenantId,productId:product.product_id,photoVersion:1,revision:1,assetIds:photos.map(p=>p.asset_id)});
  await insert(db.pool,'profile_versions',{id:profile.profile_id,tenant_id:p.tenantId,owner_id:p.userId,product_id:product.product_id,photo_version_id:photoVersionId,revision:1,profile_hash:profile.profile_hash,data:profile});
  await insert(db.pool,'identity_locks',{id:profile.identity_lock_id,tenant_id:p.tenantId,profile_id:profile.profile_id,hash:identityLock.content_hash,data:identityLock});
  await db.pool.query(`UPDATE product_drafts SET current_photo_version=1,current_profile_id=$2,data=data||jsonb_build_object('photo_version',1,'profile_id',$2::text) WHERE id=$1`,[product.product_id,profile.profile_id]);
  const source=structuredClone(variant(variantId));const creative=basePlan(profile,source);const planId=id('plan');
  const plan:DTO<'Plan'>={plan_id:planId,state:'READY',plan_hash:hash(creative),product_id:product.product_id,profile_id:profile.profile_id,
    variant_id:source.variant_id,engine:source.engine,summary:'合成商品照片与内容计划，仅验证原生预览行为',output_slots:outputSlots(source),reason_codes:[],estimated_seconds_min:30,estimated_seconds_max:60};
  const request={product_id:product.product_id,photo_version:1,profile_id:profile.profile_id,identity_lock_id:profile.identity_lock_id,preset_id:source.variant_id.split('.')[0],preset_version:'3.1.0',variant_id:source.variant_id,variant_version:source.version};
  const planValues={tenant_id:p.tenantId,owner_id:p.userId,product_id:product.product_id,photo_version_id:photoVersionId,profile_id:profile.profile_id,
    identity_lock_id:profile.identity_lock_id,variant_version_id:`${source.variant_id}.${source.version}`,state:'READY',plan_hash:plan.plan_hash,private:{creative,source,request}};
  await insert(db.pool,'plan_versions',{...planValues,id:planId,data:plan});return{actor,p,product,photos,plan,planValues};
}
type Fixture=Awaited<ReturnType<typeof fixture>>;
async function request(f:Fixture){const response=await api('POST',`/products/${f.product.product_id}/previews`,f.actor,{plan_id:f.plan.plan_id,plan_hash:f.plan.plan_hash});
  expect(response.statusCode,response.body).toBe(202);return response.json<{data:DTO<'Preview'>}>().data;}
async function claim(previewId:string){const lease=await claimStage(db.pool,id('preview-worker'),['PREVIEW']);expect(lease?.scope_id).toBe(previewId);return lease!;}
async function finish(previewId:string,storage:ObjectStorage=store){const lease=await claim(previewId);const commit=await new OptionalPreviewService(db.pool,cfg,storage).handle(lease,signal);await completeStage(db.pool,lease,commit);return lease;}
async function link(f:Fixture,preview:DTO<'Preview'>){const response=await api('POST',`/previews/${preview.preview_id}/download-link`,f.actor,{});expect(response.statusCode,response.body).toBe(200);return response.json<{data:DTO<'PreviewLink'>}>().data.url;}
const local=(url:string)=>new URL(url).pathname+new URL(url).search;

it('creates an actual watermarked private PNG from the frozen plan, with no order or paid inference',async()=>{
  const f=await fixture();const expires=(await db.pool.query('SELECT expires_at FROM product_drafts WHERE id=$1',[f.product.product_id])).rows[0].expires_at;
  const preview=await request(f);expect(preview.state).toBe('QUEUED');await finish(preview.preview_id);
  const status=await api('GET',`/previews/${preview.preview_id}`,f.actor);expect(status.statusCode,status.body).toBe(200);expect(status.json().data.state).toBe('READY');expect(status.body).not.toContain('object_key');
  const response=await app.inject({method:'GET',url:local(await link(f,preview)),remoteAddress:address});expect(response.statusCode,response.body).toBe(200);
  const row=(await db.pool.query('SELECT * FROM optional_previews WHERE id=$1',[preview.preview_id])).rows[0];
  expect(sha256(response.rawPayload)).toBe(row.private.output.sha256);const meta=await sharp(response.rawPayload).metadata();expect(meta.width).toBe(720);
  expect(meta.height).toBe(row.private.output.height);expect(meta.exif).toBeUndefined();
  const banner=await sharp(response.rawPayload).extract({left:0,top:meta.height!-96,width:720,height:96}).raw().toBuffer();
  expect(banner.includes(255)).toBe(true);expect((await sharp(response.rawPayload).extract({left:0,top:meta.height!-1,width:1,height:1}).removeAlpha().raw().toBuffer()).subarray(0,3)).toEqual(Buffer.from([38,59,50]));
  expect((await db.pool.query('SELECT expires_at FROM product_drafts WHERE id=$1',[f.product.product_id])).rows[0].expires_at).toEqual(expires);
  expect((await db.pool.query('SELECT count(*)::int AS n FROM orders')).rows[0].n).toBe(0);expect((await db.pool.query('SELECT count(*)::int AS n FROM inference_requests')).rows[0].n).toBe(0);
});
it('serializes concurrent same-plan requests and only charges five new previews per business day',async()=>{
  const f=await fixture();const responses=await Promise.all(Array.from({length:12},()=>request(f)));
  expect(new Set(responses.map(r=>r.preview_id)).size).toBe(1);
  expect((await db.pool.query("SELECT used_count FROM quota_buckets WHERE owner_id=$1 AND kind='PREVIEW'",[f.p.userId])).rows[0].used_count).toBe(1);
  for(let n=0;n<4;n++){const planId=id('plan');await insert(db.pool,'plan_versions',{...f.planValues,id:planId,data:{...f.plan,plan_id:planId}});await request({...f,plan:{...f.plan,plan_id:planId}});}
  const planId=id('plan');await insert(db.pool,'plan_versions',{...f.planValues,id:planId,data:{...f.plan,plan_id:planId}});
  const denied=await api('POST',`/products/${f.product.product_id}/previews`,f.actor,{plan_id:planId,plan_hash:f.plan.plan_hash});expect(denied.statusCode).toBe(429);
  expect((await request(f)).preview_id).toBe(responses[0]!.preview_id);
  await db.pool.query("UPDATE stage_runs SET deadline_at=now()-interval '1 second' WHERE scope_type='PREVIEW' AND scope_id IN (SELECT id FROM optional_previews WHERE owner_id=$1)",[f.p.userId]);await expireWork(db.pool);
});
it('keeps preview grants owner-bound, rejects changed inputs, and verifies the real download bytes',async()=>{
  const f=await fixture();const preview=await request(f);await finish(preview.preview_id);const url=await link(f,preview);const other=await account(db);
  expect((await api('GET',`/previews/${preview.preview_id}`,other)).statusCode).toBe(404);expect((await api('POST',`/previews/${preview.preview_id}/download-link`,other,{})).statusCode).toBe(404);
  const key=(await db.pool.query('SELECT object_key FROM optional_previews WHERE id=$1',[preview.preview_id])).rows[0].object_key;
  const original=await store.get(key,12_000_000);await store.put(key,Buffer.from('corrupted-preview'),'image/png');
  expect((await app.inject({method:'GET',url:local(url),remoteAddress:address})).statusCode).toBe(503);await store.put(key,original,'image/png');
  await db.pool.query("UPDATE product_drafts SET data=data||'{\"photo_version\":2}'::jsonb WHERE id=$1",[f.product.product_id]);
  expect((await app.inject({method:'GET',url:local(url),remoteAddress:address})).statusCode).toBe(410);
});
it('recovers the original UNKNOWN write and fences an old lease without another PUT',async()=>{
  const f=await fixture();const preview=await request(f);let puts=0;
  const uncertain: ObjectStorage={...store,put:async(key,bytes,mime)=>{puts++;await store.put(key,bytes,mime);throw new Error('synthetic lost PUT acknowledgement');},
    get:store.get.bind(store),exists:store.exists.bind(store),delete:store.delete.bind(store),erase:store.erase.bind(store)};
  const first=await claim(preview.preview_id);const service=new OptionalPreviewService(db.pool,cfg,uncertain);
  await expect(service.handle(first,signal)).rejects.toThrow('synthetic lost PUT acknowledgement');
  expect((await db.pool.query('SELECT state FROM private_object_writes WHERE preview_id=$1',[preview.preview_id])).rows[0].state).toBe('UNKNOWN');
  await expect(service.handle(first,signal)).rejects.toBeInstanceOf(PendingExternal);
  await reconcileUncertainObjectWrites(db.pool,store);await deferStage(db.pool,first,'ORIGINAL_WRITE_RECOVERED',1);
  await db.pool.query('UPDATE stage_runs SET available_at=now() WHERE id=$1',[first.id]);const second=await claim(preview.preview_id);
  const commit=await service.handle(second,signal);await expect(completeStage(db.pool,first,commit)).rejects.toMatchObject({code:'LEASE_LOST'});await completeStage(db.pool,second,commit);
  expect(puts).toBe(1);expect((await api('GET',`/previews/${preview.preview_id}`,f.actor)).json().data.state).toBe('READY');
});
it('revokes a paused write on deletion, removes actual late bytes and redacts preview recovery payloads',async()=>{
  const f=await fixture();const preview=await request(f);const lease=await claim(preview.preview_id);
  let resume!:()=>void;let entered!:()=>void;const paused=new Promise<void>(r=>{resume=r;});const started=new Promise<void>(r=>{entered=r;});let key='';
  const slow:ObjectStorage={put:async(k,b,m)=>{key=k;entered();await paused;await store.put(k,b,m);},get:store.get.bind(store),exists:store.exists.bind(store),delete:store.delete.bind(store),erase:store.erase.bind(store)};
  const running=new OptionalPreviewService(db.pool,cfg,slow).handle(lease,signal);const observed=running.catch(e=>e);await started;
  const deletion=await transaction(db.pool,c=>requestDeletion(c,f.p,{scope:'PRODUCT',product_id:f.product.product_id,acknowledge_inflight_contract:true}));
  resume();expect(await observed).toMatchObject({code:'PRIVATE_OBJECT_REVOKED'});expect(await store.exists(key)).toBe(true);
  expect((await db.pool.query('SELECT state,delete_requested FROM private_object_writes WHERE preview_id=$1',[preview.preview_id])).rows[0]).toMatchObject({state:'STORED',delete_requested:true});
  const eraser=new MediaErasureService(db.pool,store,id('preview-eraser'));for(let n=0;n<30 && await eraser.eraseOne(signal);n++){}
  await eraser.refreshDeletion(f.p.tenantId,deletion.deletion_id);expect(await store.exists(key)).toBe(false);
  const row=(await db.pool.query('SELECT state,private FROM optional_previews WHERE id=$1',[preview.preview_id])).rows[0];expect(row.state).toBe('FAILED');expect(row.private).toEqual({privacy_deleted:true});
  expect((await api('GET',`/previews/${preview.preview_id}`,f.actor)).statusCode).toBe(410);
});
it('expires unfinished preview work independently and keeps its original plan usable',async()=>{
  const f=await fixture();const preview=await request(f);const lease=await claim(preview.preview_id);const commit=await new OptionalPreviewService(db.pool,cfg,store).handle(lease,signal);
  await db.pool.query("UPDATE stage_runs SET deadline_at=now()-interval '1 second' WHERE id=$1",[lease.id]);await expireWork(db.pool);
  await expect(completeStage(db.pool,lease,commit)).rejects.toMatchObject({code:'PREVIEW_NO_LONGER_EXECUTABLE'});
  expect((await db.pool.query('SELECT state FROM optional_previews WHERE id=$1',[preview.preview_id])).rows[0].state).toBe('FAILED');
  expect((await db.pool.query('SELECT state FROM plan_versions WHERE id=$1',[f.plan.plan_id])).rows[0].state).toBe('READY');
  expect((await db.pool.query('SELECT delete_requested FROM private_object_writes WHERE preview_id=$1',[preview.preview_id])).rows[0].delete_requested).toBe(true);
});
it('rejects modified source bytes, seals frozen inputs, and exposes a terminal failure without consuming an order allowance',async()=>{
  const f=await fixture();const preview=await request(f);const lease=await claim(preview.preview_id);
  await expect(db.pool.query("UPDATE optional_previews SET private=jsonb_set(private,'{input,plan_hash}',to_jsonb($2::text)) WHERE id=$1",[preview.preview_id,'f'.repeat(64)])).rejects.toThrow('preview checkpoint is immutable');
  await expect(db.pool.query("UPDATE optional_previews SET expires_at=expires_at+interval '1 day' WHERE id=$1",[preview.preview_id])).rejects.toThrow('preview input binding is immutable');
  await store.put(f.photos[0]!.key,Buffer.from('changed input bytes'),'image/png');
  await expect(new OptionalPreviewService(db.pool,cfg,store).handle(lease,signal)).rejects.toMatchObject({code:'PHOTO_HASH_MISMATCH'});await failStage(db.pool,lease,'PHOTO_HASH_MISMATCH');
  expect((await api('GET',`/previews/${preview.preview_id}`,f.actor)).json().data.state).toBe('FAILED');
  expect((await db.pool.query('SELECT count(*)::int AS n FROM revision_requests')).rows[0].n).toBe(0);
});
it('previews all ten official photo styles as actual PNGs using their own frozen plans',async()=>{
  for(const preset of ['minimal-clean','warm-handmade','quiet-luxury','fresh-daily','appetite-flash','home-calm','feature-cards','color-pop','launch-story','portrait-social']){
    const f=await fixture(`${preset}.photo-layout`);const preview=await request(f);await finish(preview.preview_id);
    const response=await app.inject({method:'GET',url:local(await link(f,preview)),remoteAddress:address});expect(response.statusCode,response.body).toBe(200);
    const row=(await db.pool.query('SELECT private FROM optional_previews WHERE id=$1',[preview.preview_id])).rows[0];
    expect(row.private.input.style_id).toBe(preset);expect(sha256(response.rawPayload)).toBe(row.private.output.sha256);
    expect((await sharp(response.rawPayload).metadata()).format).toBe('png');
  }
});
it('rejects disabled generation, unsupported AI previews and stale plan hashes before quota allocation',async()=>{
  const f=await fixture();
  const stale=await api('POST',`/products/${f.product.product_id}/previews`,f.actor,{plan_id:f.plan.plan_id,plan_hash:'f'.repeat(64)});expect(stale.statusCode).toBe(409);
  cfg.generationEnabled=false;
  try{const off=await api('POST',`/products/${f.product.product_id}/previews`,f.actor,{plan_id:f.plan.plan_id,plan_hash:f.plan.plan_hash});expect(off.statusCode).toBe(503);}
  finally{cfg.generationEnabled=true;}
  const original=(await db.pool.query('SELECT private FROM execution_variants WHERE id=$1',[f.planValues.variant_version_id])).rows[0].private;
  await db.pool.query(`UPDATE execution_variants SET private=private||jsonb_build_object('resource_versions',$2::jsonb) WHERE id=$1`,
    [f.planValues.variant_version_id,JSON.stringify([{resource_version_id:'synthetic-extra-logo',license_record_id:'synthetic-unregistered-license',hash:'a'.repeat(64)}])]);
  try{const extra=await api('POST',`/products/${f.product.product_id}/previews`,f.actor,{plan_id:f.plan.plan_id,plan_hash:f.plan.plan_hash});expect(extra.statusCode).toBe(503);expect(extra.json().code).toBe('PREVIEW_RESOURCES_NOT_AVAILABLE');}
  finally{await db.pool.query('UPDATE execution_variants SET private=$2::jsonb WHERE id=$1',[f.planValues.variant_version_id,JSON.stringify(original)]);}
  const generated=await fixture('quiet-luxury.ai-detail');const response=await api('POST',`/products/${generated.product.product_id}/previews`,generated.actor,{plan_id:generated.plan.plan_id,plan_hash:generated.plan.plan_hash});
  expect(response.statusCode,response.body).toBe(503);expect(response.json().code).toBe('PREVIEW_ENGINE_NOT_AVAILABLE');
  expect((await db.pool.query("SELECT count(*)::int AS n FROM quota_buckets WHERE owner_id=ANY($1) AND kind='PREVIEW'",[[f.p.userId,generated.p.userId]])).rows[0].n).toBe(0);
});
it('rechecks resource revocation on previously issued links and rejects corruption at the final commit',async()=>{
  const f=await fixture();const preview=await request(f);const lease=await claim(preview.preview_id);const commit=await new OptionalPreviewService(db.pool,cfg,store).handle(lease,signal);
  const row=(await db.pool.query('SELECT private FROM optional_previews WHERE id=$1',[preview.preview_id])).rows[0];const output=row.private.output;
  const bytes=await store.get(output.object_key,12_000_000);await store.put(output.object_key,Buffer.from('corrupted before commit'),'image/png');
  await expect(completeStage(db.pool,lease,commit)).rejects.toMatchObject({code:'PREVIEW_FILE_CHANGED'});
  expect((await db.pool.query('SELECT state FROM optional_previews WHERE id=$1',[preview.preview_id])).rows[0].state).toBe('GENERATING');
  await store.put(output.object_key,bytes,'image/png');await completeStage(db.pool,lease,commit);const url=await link(f,preview);
  const licenseId=row.private.input.resource_versions[0].license_record_id;
  await db.pool.query('UPDATE resource_licenses SET revoked_at=now() WHERE id=$1',[licenseId]);
  try{const denied=await app.inject({method:'GET',url:local(url),remoteAddress:address});expect(denied.statusCode).toBe(503);expect(denied.json().code).toBe('RESOURCE_LICENSE_UNAVAILABLE');}
  finally{await db.pool.query('UPDATE resource_licenses SET revoked_at=NULL WHERE id=$1',[licenseId]);}
});
