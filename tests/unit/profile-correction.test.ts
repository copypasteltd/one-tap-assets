import {it,expect} from 'vitest';
import {rawProfile} from '../helpers/fixtures';
import {ClientSession} from '../../src/shared/client/session';
import {prepareCorrection,submitCorrection} from '../../src/shared/client/profile-correction';
import {readDraftAnalysis} from '../../src/shared/client/drafts';
import type {DTO} from '../../src/shared/contracts/types';
import type {HostPort} from '../../src/shared/platform/ports';
import type {WireRequest} from '../../src/shared/client/api';

const profile=rawProfile(),product:DTO<'Product'>={product_id:profile.product_id,photo_version:1,profile_id:profile.profile_id,revision:4,created_at:'2026-10-30T00:00:00Z'};
const updated:DTO<'Profile'>={...profile,profile_id:'next-profile',identity_lock_id:'next-lock',revision:2,name:'蓝色旅行杯',profile_hash:'b'.repeat(64)};
const nextProduct={...product,profile_id:updated.profile_id,revision:5};
const session=(user='buyer-a'):DTO<'Session'>=>({user_id:user,access_token:'SYNTHETIC-ONLY-'+user,token_type:'Bearer',expires_at:'2099-01-01T00:00:00Z'});
function setup(handler:(r:WireRequest)=>unknown|Promise<unknown>){
  const records=new Map<string,unknown>(),sent:WireRequest[]=[];
  const host:HostPort={platform:'alipay',storage:{get:<T>(k:string)=>(records.get(k)??null) as T|null,set:(k,v)=>{records.set(k,v);},remove:k=>{records.delete(k);}},
    transport:async r=>{sent.push(r);return {status:200,headers:{},data:{data:await handler(r)}};},login:async()=>{throw Error('Explicit synthetic session only');},
    choosePhotos:async()=>{throw Error('No camera');},upload:async()=>{throw Error('No upload');},pay:async()=>{throw Error('No payment');},download:async()=>'',save:async()=> 'UNKNOWN',copy:async()=>{}};
  const client=new ClientSession(host,'https://api.example.test');client.attach(session());client.remember({productId:product.product_id,planId:'old-plan',previewId:'old-preview',quoteId:'old-quote',orderId:'original-paid-order'});
  return {client,sent,records};
}
function normal(r:WireRequest){return r.url.endsWith('/corrections')||r.url.endsWith('/profile')?updated:nextProduct;}
it('replays a lost correction ACK using one original key/body and clears only obsolete unpaid references',async()=>{
  let lost=true;const {client,sent,records}=setup(r=>{if(r.method==='POST'&&lost){lost=false;throw Error('ACK lost after synthetic commit');}return normal(r);});
  const intent=prepareCorrection(client,{product,profile},{field:'name',value:' 蓝色旅行杯 ',evidence_asset_ids:[]});
  await expect(submitCorrection(client,intent)).rejects.toMatchObject({code:'NETWORK_UNKNOWN'});
  expect(client.recover().planId).toBe('old-plan');expect(await submitCorrection(client,intent)).toEqual({product:nextProduct,profile:updated});
  const posts=sent.filter(r=>r.method==='POST');expect(posts).toHaveLength(2);expect(posts[0]!.body).toBe(posts[1]!.body);expect(posts[0]!.headers['Idempotency-Key']).toBe(posts[1]!.headers['Idempotency-Key']);
  expect(JSON.parse(String(posts[0]!.body))).toEqual({expected_revision:4,profile_id:profile.profile_id,field:'name',value:'蓝色旅行杯'});
  expect(client.recover()).toEqual({productId:product.product_id,orderId:'original-paid-order'});
  expect(JSON.stringify([...records])).not.toContain('蓝色旅行杯');expect(sent.some(r=>/\/(orders|quotes|analyses|assets)$/.test(r.url))).toBe(false);
});
it('rejects wrong evidence, duplicate photos, empty text, name/category limits and unchanged input before transport',()=>{
  const {client,sent}=setup(normal);
  for(const draft of [{field:'name',value:' ',evidence_asset_ids:[]},{field:'name',value:'长'.repeat(201),evidence_asset_ids:[]},
    {field:'category',value:'类'.repeat(121),evidence_asset_ids:[]},{field:'observation',value:'可见纹理',evidence_asset_ids:[]},
    {field:'label_text',value:'标签',evidence_asset_ids:['foreign-photo']},{field:'photo_role',value:'WHOLE',evidence_asset_ids:['asset-a','asset-a']},
    {field:'photo_role',value:'UNSUPPORTED',evidence_asset_ids:['asset-a']},{field:'name',value:profile.name!,evidence_asset_ids:[]}] as const)
    expect(()=>prepareCorrection(client,{product,profile},{...draft,evidence_asset_ids:[...draft.evidence_asset_ids]})).toThrow();
  expect(sent).toHaveLength(0);
  const a=prepareCorrection(client,{product,profile},{field:'label_text',value:'可见文字',evidence_asset_ids:['asset-c','asset-a']});
  const b=prepareCorrection(client,{product,profile},{field:'label_text',value:'可见文字',evidence_asset_ids:['asset-a','asset-c']});expect(a.key).toBe(b.key);
});
it('does not apply late results to another account or a different current product',async()=>{
  let release!:(value:unknown)=>void;const {client,sent}=setup(()=>new Promise(resolve=>{release=resolve;}));
  const intent=prepareCorrection(client,{product,profile},{field:'name',value:'蓝色旅行杯',evidence_asset_ids:[]});const result=submitCorrection(client,intent);
  client.attach(session('buyer-b'));client.remember({productId:'new-product',planId:'new-plan'});release(updated);
  await expect(result).rejects.toMatchObject({code:'ACCOUNT_CHANGED'});expect(client.recover()).toEqual({productId:'new-product',planId:'new-plan'});expect(sent).toHaveLength(1);
  const other=setup(normal),next=prepareCorrection(other.client,{product,profile},{field:'name',value:'蓝色旅行杯',evidence_asset_ids:[]});
  other.client.remember({productId:'other-product'});await expect(submitCorrection(other.client,next)).rejects.toMatchObject({code:'INPUT_VERSION_CHANGED'});expect(other.sent).toHaveLength(0);
});
it('rejects a mismatched reply, a concurrent newer profile and a page-aborted result without clearing recovery',async()=>{
  for(const handler of [(r:WireRequest)=>r.method==='POST'?{...updated,photo_version:2}:normal(r),(r:WireRequest)=>r.method==='POST'?updated:{...nextProduct,profile_id:'concurrent-profile'}]){
    const {client}=setup(handler),intent=prepareCorrection(client,{product,profile},{field:'name',value:'蓝色旅行杯',evidence_asset_ids:[]});
    await expect(submitCorrection(client,intent)).rejects.toMatchObject({code:'INPUT_VERSION_CHANGED'});expect(client.recover().planId).toBe('old-plan');
  }
  const {client,sent}=setup(normal),intent=prepareCorrection(client,{product,profile},{field:'name',value:'蓝色旅行杯',evidence_asset_ids:[]}),abort=new AbortController();abort.abort();
  await expect(submitCorrection(client,intent,abort.signal)).rejects.toMatchObject({code:'CORRECTION_INTERRUPTED'});expect(sent).toHaveLength(0);
});
it('rejects an analysis read when its current draft changes while the response is pending',async()=>{
  const {client}=setup(r=>{if(r.url.endsWith('/profile'))client.remember({productId:'another-draft'});return r.url.endsWith('/profile')?profile:product;});
  await expect(readDraftAnalysis(client)).rejects.toMatchObject({code:'INPUT_VERSION_CHANGED'});
});
