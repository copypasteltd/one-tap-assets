import {beforeAll,afterAll,it,expect} from 'vitest';
import {testDatabase,account,type TestDatabase} from '../helpers/database';
import {profile as fixtureProfile} from '../helpers/fixtures';
import {buildApp} from '../../src/api/app';
import {createProduct} from '../../src/api/modules/products';
import {insert,update} from '../../src/api/db/store';
import {id,hash} from '../../src/api/lib/crypto';
import {makeIdentityLock} from '../../src/worker/analysis/profile';
import type {DTO,Principal} from '../../src/shared/contracts/types';

let db:TestDatabase,app:Awaited<ReturnType<typeof buildApp>>;
beforeAll(async()=>{db=await testDatabase();app=await buildApp({cfg:db.cfg,pool:db.pool,tls:false});});
afterAll(async()=>{await app?.close();await db?.close();});
async function ready(p:Principal,capped=false){
  const initial=await createProduct(db.pool,p),photo=id('photos'),profileId=id('profile'),lockId=id('lock');
  await insert(db.pool,'product_photo_versions',{id:photo,tenant_id:p.tenantId,product_id:initial.product_id,revision:1,photo_set_hash:'a'.repeat(64),data:[]});
  const profile={...fixtureProfile(),profile_id:profileId,identity_lock_id:lockId,product_id:initial.product_id,photo_version:1};
  if(capped)profile.observations=Array.from({length:100},()=>({...profile.observations[0]!}));
  const lock=makeIdentityLock(p.tenantId,profile);
  await insert(db.pool,'profile_versions',{id:profileId,tenant_id:p.tenantId,owner_id:p.userId,product_id:initial.product_id,photo_version_id:photo,revision:1,profile_hash:profile.profile_hash,data:profile});
  await insert(db.pool,'identity_locks',{id:lockId,tenant_id:p.tenantId,profile_id:profileId,hash:lock.content_hash,data:lock});
  const product:DTO<'Product'>={...initial,photo_version:1,profile_id:profileId,revision:1};
  await update(db.pool,'product_drafts',product.product_id,{data:product,current_photo_version:1,current_profile_id:profileId,revision:1},p.tenantId);return {product,profile,lock};
}
function post(token:string,product:string,body:DTO<'CorrectionRequest'>,key=id('correction-key')){return app.inject({method:'POST',url:`/v1/p01/products/${product}/corrections`,headers:{authorization:`Bearer ${token}`,'idempotency-key':key},payload:body});}
it('writes one new profile/lock and replays the original ACK without changing its parent or adding inference/payment work',async()=>{
  const owner=await account(db),f=await ready(owner.principal),key=id('original-intent'),body:DTO<'CorrectionRequest'>={expected_revision:1,profile_id:f.profile.profile_id,field:'name',value:' 蓝色旅行杯 '};
  const first=await post(owner.accessToken,f.product.product_id,body,key),again=await post(owner.accessToken,f.product.product_id,body,key);
  expect(first.statusCode).toBe(200);expect(again.statusCode).toBe(200);expect(again.json().data).toEqual(first.json().data);
  const next=first.json().data as DTO<'Profile'>;expect(next).toMatchObject({name:'蓝色旅行杯',revision:2,photo_version:1});expect(next.profile_id).not.toBe(f.profile.profile_id);expect(next.identity_lock_id).not.toBe(f.lock.identity_lock_id);
  const old=(await db.pool.query('SELECT data FROM profile_versions WHERE id=$1',[f.profile.profile_id])).rows[0].data;expect(old).toEqual(f.profile);
  expect((await db.pool.query('SELECT count(*)::int AS count FROM correction_versions WHERE product_id=$1',[f.product.product_id])).rows[0].count).toBe(1);
  const current=(await app.inject({url:`/v1/p01/products/${f.product.product_id}`,headers:{authorization:`Bearer ${owner.accessToken}`}})).json().data;expect(current).toMatchObject({profile_id:next.profile_id,revision:2});
  for(const table of ['orders','provider_submissions','agent_runs','quotes','analysis_jobs'])expect((await db.pool.query(`SELECT count(*)::int AS count FROM ${table}`)).rows[0].count).toBe(0);
});
it('serializes two different corrections of the same expected revision instead of overwriting either parent',async()=>{
  const owner=await account(db),f=await ready(owner.principal),base={expected_revision:1,profile_id:f.profile.profile_id,field:'name' as const};
  const replies=await Promise.all([post(owner.accessToken,f.product.product_id,{...base,value:'第一处名称'}),post(owner.accessToken,f.product.product_id,{...base,value:'另一处名称'})]);
  expect(replies.map(r=>r.statusCode).sort()).toEqual([200,409]);expect(replies.find(r=>r.statusCode===409)!.json().code).toBe('REVISION_CONFLICT');
  expect((await db.pool.query('SELECT count(*)::int AS count FROM correction_versions WHERE product_id=$1',[f.product.product_id])).rows[0].count).toBe(1);
});
it('rejects another owner, foreign evidence, duplicate evidence and absent observation evidence before any new version',async()=>{
  const owner=await account(db),other=await account(db),f=await ready(owner.principal),body:DTO<'CorrectionRequest'>={expected_revision:1,profile_id:f.profile.profile_id,field:'observation',value:'可见纹理'};
  expect((await post(other.accessToken,f.product.product_id,{...body,evidence_asset_ids:['asset-a']})).statusCode).toBe(404);
  for(const evidence of [[],['foreign-photo'],['asset-a','asset-a']])expect((await post(owner.accessToken,f.product.product_id,{...body,evidence_asset_ids:evidence})).statusCode).toBe(422);
  expect((await db.pool.query('SELECT count(*)::int AS count FROM correction_versions WHERE product_id=$1',[f.product.product_id])).rows[0].count).toBe(0);
});
it('rejects invalid name/category lengths and blank text without persisting an invalid Profile',async()=>{
  const owner=await account(db),f=await ready(owner.principal);
  for(const [field,value] of [['name','长'.repeat(201)],['category','类'.repeat(121)],['name','   ']] as const){
    const reply=await post(owner.accessToken,f.product.product_id,{expected_revision:1,profile_id:f.profile.profile_id,field,value});expect(reply.statusCode).toBe(422);expect(reply.json().code).toBe('CORRECTION_VALUE_INVALID');
  }
  expect((await db.pool.query('SELECT revision FROM product_drafts WHERE id=$1',[f.product.product_id])).rows[0].revision).toBe(1);
  const capped=await ready(owner.principal,true);
  const capacity=await post(owner.accessToken,capped.product.product_id,{expected_revision:1,profile_id:capped.profile.profile_id,field:'observation',value:'可见纹理',evidence_asset_ids:['asset-a']});
  expect(capacity.statusCode).toBe(422);expect(capacity.json().code).toBe('CORRECTION_CAPACITY_REACHED');
  expect((await db.pool.query('SELECT count(*)::int AS count FROM correction_versions WHERE product_id=ANY($1)',[[f.product.product_id,capped.product.product_id]])).rows[0].count).toBe(0);
});
it('keeps user label corrections separate from observed facts and preserves unknowns in the new identity lock',async()=>{
  const owner=await account(db),f=await ready(owner.principal),reply=await post(owner.accessToken,f.product.product_id,{expected_revision:1,profile_id:f.profile.profile_id,field:'label_text',value:'容量500ml',evidence_asset_ids:['asset-a']});
  expect(reply.statusCode).toBe(200);const profile=reply.json().data as DTO<'Profile'>;expect(profile.label_texts.at(-1)).toMatchObject({status:'USER_CORRECTED',value:'容量500ml',source_asset_ids:['asset-a']});
  expect(profile.observations).toEqual(f.profile.observations);expect(profile.unknowns).toEqual(f.profile.unknowns);
  const lock=(await db.pool.query('SELECT data FROM identity_locks WHERE id=$1',[profile.identity_lock_id])).rows[0].data;
  expect(lock.features).toEqual(f.lock.features);expect(lock.unknowns).toEqual(f.lock.unknowns);expect(JSON.stringify(lock.features)).not.toContain('500ml');
  const {profile_hash:_,...body}=profile;expect(profile.profile_hash).toBe(hash(body));
  const role=await post(owner.accessToken,f.product.product_id,{expected_revision:2,profile_id:profile.profile_id,field:'photo_role',value:'LABEL',evidence_asset_ids:['asset-b']});
  expect(role.statusCode).toBe(200);expect(role.json().data.photo_roles).toEqual(profile.photo_roles.map(p=>p.asset_id==='asset-b'?{...p,role:'LABEL'}:p));
  expect(role.json().data.label_texts).toEqual(profile.label_texts);
});
