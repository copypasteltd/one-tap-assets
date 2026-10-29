import {beforeAll,afterAll,it,expect} from 'vitest';
import {testDatabase,account,type TestDatabase} from '../helpers/database';
import {profile as fixtureProfile} from '../helpers/fixtures';
import {buildApp} from '../../src/api/app';
import {createProduct} from '../../src/api/modules/products';
import {insert,update} from '../../src/api/db/store';
import {id} from '../../src/api/lib/crypto';
import {ClientSession} from '../../src/shared/client/session';
import {readDraftAnalysis,resumeDraft} from '../../src/shared/client/drafts';
import type {HostPort} from '../../src/shared/platform/ports';
import type {Principal,DTO} from '../../src/shared/contracts/types';

let db:TestDatabase;let app:Awaited<ReturnType<typeof buildApp>>;
beforeAll(async()=>{db=await testDatabase();app=await buildApp({cfg:db.cfg,pool:db.pool,tls:false});});
afterAll(async()=>{await app?.close();await db?.close();});
async function readyDraft(p:Principal){
  const original=await createProduct(db.pool,p),photo=id('photos'),profileId=id('profile'),lock=id('lock');
  await insert(db.pool,'product_photo_versions',{id:photo,tenant_id:p.tenantId,product_id:original.product_id,revision:1,photo_set_hash:'a'.repeat(64),data:[]});
  const profile={...fixtureProfile(),profile_id:profileId,identity_lock_id:lock,product_id:original.product_id,photo_version:1};
  await insert(db.pool,'profile_versions',{id:profileId,tenant_id:p.tenantId,owner_id:p.userId,product_id:original.product_id,photo_version_id:photo,revision:1,profile_hash:profile.profile_hash,data:profile});
  await insert(db.pool,'identity_locks',{id:lock,tenant_id:p.tenantId,profile_id:profileId,hash:'b'.repeat(64),data:{}});
  const product:DTO<'Product'>={...original,photo_version:1,profile_id:profileId,revision:1};
  await update(db.pool,'product_drafts',original.product_id,{data:product,current_photo_version:1,current_profile_id:profileId,revision:1},p.tenantId);
  return {product,profile,photo,lock};
}
function sessionFor(user:{principal:Principal;accessToken:string}){
  const memory=new Map<string,unknown>(),sent:{method:string;path:string}[]=[];
  const host:HostPort={platform:'alipay',storage:{get:<T>(k:string)=>(memory.get(k)??null) as T|null,set:(k,v)=>{memory.set(k,v);},remove:k=>{memory.delete(k);}},
    transport:async r=>{const url=new URL(r.url);sent.push({method:r.method,path:url.pathname});const result=await app.inject({method:r.method as 'GET'|'POST',url:url.pathname+url.search,headers:r.headers,...(r.body?{payload:String(r.body)}:{})});return {status:result.statusCode,data:result.json(),headers:{}};},
    login:async()=>{throw new Error('No real host login in native metadata fixture');},choosePhotos:async()=>{throw new Error('No camera required');},upload:async()=>{throw new Error('No reupload allowed');},pay:async()=> 'UNKNOWN',download:async()=>'',save:async()=> 'UNKNOWN',copy:async()=>{}};
  const client=new ClientSession(host,db.cfg.publicBaseUrl);client.attach({user_id:user.principal.userId,access_token:user.accessToken,token_type:'Bearer',expires_at:'2099-01-01T00:00:00Z'});return {client,sent};
}
it('recovers only live owned server drafts and a ready profile after local recovery is lost',async()=>{
  const owner=await account(db),other=await account(db),ready=await readyDraft(owner.principal);
  const expired=await createProduct(db.pool,owner.principal),deleted=await createProduct(db.pool,owner.principal);await readyDraft(other.principal);
  await db.pool.query('UPDATE product_drafts SET expires_at=now()-interval \'1 second\' WHERE id=$1',[expired.product_id]);
  await db.pool.query('UPDATE product_drafts SET deleted_at=now() WHERE id=$1',[deleted.product_id]);
  const {client,sent}=sessionFor(owner);expect(client.recover()).toEqual({});
  const list=await client.api.call('listProducts',{query:{limit:5}});expect(list.items.map(p=>p.product_id)).toEqual([ready.product.product_id]);
  expect(await resumeDraft(client,ready.product.product_id)).toEqual({page:'analysis',params:{}});
  expect(client.recover().analysisId).toBeUndefined();expect((await readDraftAnalysis(client)).profile).toEqual(ready.profile);
  expect(sent.every(r=>r.method==='GET')).toBe(true);
  expect((await db.pool.query('SELECT count(*)::int AS count FROM analysis_jobs')).rows[0].count).toBe(0);
});
it('restores an exact current plan and rejects another buyer before remembering private IDs',async()=>{
  const owner=await account(db),other=await account(db),ready=await readyDraft(owner.principal),planId=id('plan');
  const plan:DTO<'Plan'>={plan_id:planId,product_id:ready.product.product_id,profile_id:ready.profile.profile_id,variant_id:'minimal-clean.photo-layout',state:'READY',engine:'PHOTO_LAYOUT',plan_hash:'d'.repeat(64),summary:'原生元数据恢复夹具',output_slots:[],reason_codes:[],estimated_seconds_min:30,estimated_seconds_max:600};
  await insert(db.pool,'plan_versions',{id:planId,tenant_id:owner.principal.tenantId,owner_id:owner.principal.userId,product_id:ready.product.product_id,photo_version_id:ready.photo,profile_id:ready.profile.profile_id,identity_lock_id:ready.lock,variant_version_id:'minimal-clean.photo-layout.3.1.0',state:'READY',plan_hash:plan.plan_hash,data:plan,private:{}});
  const {client,sent}=sessionFor(owner);client.remember({productId:ready.product.product_id,planId,variantId:plan.variant_id});
  expect(await resumeDraft(client,ready.product.product_id)).toEqual({page:'confirm',params:{plan_id:planId}});expect(sent.every(r=>r.method==='GET')).toBe(true);
  const foreign=sessionFor(other);await expect(resumeDraft(foreign.client,ready.product.product_id)).rejects.toMatchObject({status:404});expect(foreign.client.recover()).toEqual({});
});
