import {it,expect} from 'vitest';
import {ClientSession} from '../../src/shared/client/session';
import {ClientError,type WireRequest} from '../../src/shared/client/api';
import {usePreset,loadSelectedPreset,startSelectedPlan} from '../../src/shared/client/preset-selection';
import {readDraftAnalysis,resumeDraft} from '../../src/shared/client/drafts';
import type {HostPort} from '../../src/shared/platform/ports';
import type {DTO} from '../../src/shared/contracts/types';

const session=(user='buyer-a'):DTO<'Session'>=>({user_id:user,access_token:`synthetic-${user}`,token_type:'Bearer',expires_at:'2099-01-01T00:00:00Z'});
const product:DTO<'Product'>={product_id:'product-a',photo_version:1,profile_id:'profile-a',revision:1,created_at:'2026-10-30T00:00:00Z'};
const profile={product_id:product.product_id,photo_version:1,profile_id:'profile-a',identity_lock_id:'lock-a'} as DTO<'Profile'>;
const variant=(id:string):DTO<'Variant'>=>({variant_id:id,version:'3.1.0',name:id,engine:'PHOTO_LAYOUT',sale_enabled:true,admission_state:'ADMITTED',price_fen:100,output_slots:[],reason_codes:[],speech_mode:'NONE',input_guidance:[]});
const detail:DTO<'PresetDetail'>={preset:{preset_id:'style-a',version:'3.1.0',name:'测试方案',author_name:'测试作者',source:'OFFICIAL',style_tags:[],sample_id:null,sample_label:'AUTHORIZED_SAMPLE_NOT_YOUR_RESULT',sale_enabled:true},
  variants:[variant('first-spec'),variant('chosen-spec')],description:'合成协议夹具，非上线准入',license_summary:'fixture',fork_allowed:false,parent_version:null};
const plan={plan_id:'plan-a',product_id:product.product_id,profile_id:'profile-a',variant_id:'chosen-spec',state:'PLANNING'} as DTO<'Plan'>;
type Handler=(request:WireRequest)=>unknown|Promise<unknown>;
function setup(handler:Handler){
  const records=new Map<string,unknown>(),sent:WireRequest[]=[];
  const host:HostPort={platform:'alipay',storage:{get:<T>(key:string)=>(records.get(key)??null) as T|null,set:(k,v)=>{records.set(k,v);},remove:k=>{records.delete(k);}},
    transport:async request=>{sent.push(request);return {status:200,headers:{},data:{data:await handler(request)}};},login:async()=> 'synthetic-login',
    choosePhotos:async()=>{throw new Error('Must not reopen camera');},upload:async()=>{throw new Error('Must not upload again');},pay:async()=>{throw new Error('Must not pay');},download:async()=>'',save:async()=> 'UNKNOWN',copy:async()=>{}};
  const client=new ClientSession(host,'https://api.example.test');client.attach(session());return {client,host,sent,records};
}
function normal(request:WireRequest):unknown{
  const url=new URL(request.url),path=url.pathname;
  if(path.endsWith('/sessions/platform'))return session();
  if(path.includes('/presets/'))return detail;
  if(path.endsWith('/profile'))return profile;
  if(path.endsWith('/input-check'))return {eligible:true,reason_codes:[],capture_guidance:[]};
  if(path.endsWith('/plans')||path.endsWith('/plans/plan-a'))return plan;
  if(path.endsWith('/products/product-a'))return product;
  throw new Error(`Unexpected operation ${request.method} ${path}`);
}
it('preserves the second specification across capture, cold login and an unknown plan ACK using one original intent',async()=>{
  const keys:string[]=[];let lost=true;
  const {client,host,sent}=setup(request=>{
    if(request.method==='POST'&&new URL(request.url).pathname.endsWith('/plans')){
      keys.push(request.headers['Idempotency-Key']!);if(lost){lost=false;throw new Error('ACK lost after original creation');}
    }return normal(request);
  });
  expect(await usePreset(client,detail,'chosen-spec')).toEqual({page:'photos',params:{}});
  const cold=new ClientSession(host,'https://api.example.test');expect(cold.recover()).toEqual({});expect(cold.hasPreviousAccount()).toBe(true);
  await cold.login();expect((await loadSelectedPreset(cold))?.variant.variant_id).toBe('chosen-spec');
  cold.remember({productId:product.product_id});
  await expect(startSelectedPlan(cold)).rejects.toMatchObject({code:'NETWORK_UNKNOWN'});
  expect(cold.recover().planId).toBeUndefined();expect((await startSelectedPlan(cold)).plan_id).toBe('plan-a');
  expect(keys).toHaveLength(2);expect(new Set(keys).size).toBe(1);
  for(const request of sent.filter(r=>r.method==='POST'&&r.url.endsWith('/plans'))){expect(JSON.parse(String(request.body))).toMatchObject({variant_id:'chosen-spec',variant_version:'3.1.0',photo_version:1,profile_id:'profile-a',identity_lock_id:'lock-a'});}
  expect(sent.some(r=>/\/(quotes|orders|assets)$/.test(new URL(r.url).pathname))).toBe(false);
});
it('blocks a withdrawn or missing exact variant instead of choosing the first or latest one',async()=>{
  const {client,sent}=setup(r=>r.url.includes('/presets/')?{...detail,variants:[detail.variants[0]]}:normal(r));
  await usePreset(client,detail,'chosen-spec');client.remember({productId:product.product_id});
  await expect(startSelectedPlan(client)).rejects.toMatchObject({code:'PRESET_SELECTION_CHANGED'});
  expect(sent.filter(r=>r.method==='POST')).toHaveLength(0);
  const closed=setup(r=>r.url.includes('/presets/')?{...detail,variants:detail.variants.map(v=>({...v,sale_enabled:false}))}:normal(r));
  await usePreset(closed.client,detail,'chosen-spec');closed.client.remember({productId:product.product_id});
  await expect(startSelectedPlan(closed.client)).rejects.toMatchObject({code:'VARIANT_NOT_FOR_SALE'});
  expect(closed.sent.filter(r=>r.method==='POST')).toHaveLength(0);
});
it('preserves capture guidance and creates no plan when the current product is ineligible',async()=>{
  const {client,sent}=setup(r=>r.url.endsWith('/input-check')?{eligible:false,capture_guidance:['补拍清晰标签'],reason_codes:['DETAIL_PHOTO_REQUIRED']}:normal(r));
  await usePreset(client,detail,'chosen-spec');client.remember({productId:product.product_id});
  await expect(startSelectedPlan(client)).rejects.toMatchObject({code:'MORE_PHOTOS_REQUIRED',message:'补拍清晰标签'});
  expect(sent.some(r=>r.method==='POST'&&r.url.endsWith('/plans'))).toBe(false);
});
it('resumes bound server photos with the original analysis key and no draft creation or upload',async()=>{
  const keys:string[]=[];
  const {client,sent}=setup(r=>{
    if(r.url.endsWith('/analyses')){keys.push(r.headers['Idempotency-Key']!);return {analysis_id:'analysis-a',product_id:product.product_id,photo_version:1,state:'QUEUED'};}
    return {...product,profile_id:null};
  });
  client.remember({productId:'old-product',analysisId:'old-analysis',planId:'old-plan',batchId:'old-batch',photoSetHash:'old-hash'});
  const expected=client.intent('analysis',{product:product.product_id,version:1});
  for(let i=0;i<2;i++)expect((await resumeDraft(client,product.product_id)).page).toBe('analysis');
  expect(keys).toEqual([expected,expected]);expect(client.recover()).toMatchObject({productId:product.product_id,analysisId:'analysis-a'});
  expect(client.recover().batchId).toBeUndefined();expect(client.recover().planId).toBeUndefined();
  expect(sent.some(r=>r.url.endsWith('/products')||r.url.endsWith('/assets'))).toBe(false);
});
it('opens a ready server profile without a local analysis ID and resumes only a matching current plan',async()=>{
  const {client,sent}=setup(normal);client.remember({productId:product.product_id});
  expect((await readDraftAnalysis(client)).profile?.profile_id).toBe('profile-a');
  client.remember({planId:'plan-a',variantId:'chosen-spec'});expect((await resumeDraft(client,product.product_id)).page).toBe('confirm');
  client.remember({variantId:'other-spec'});expect((await resumeDraft(client,product.product_id)).page).toBe('analysis');expect(client.recover().planId).toBeUndefined();
  expect(sent.every(r=>r.method==='GET')).toBe(true);
});
it('drops an expired current draft on explicit preset use while retaining the selected specification',async()=>{
  const {client}=setup(r=>{if(r.url.endsWith('/products/product-a'))throw new ClientError('MEDIA_REVOKED','已过期',410);return normal(r);});
  client.remember({productId:product.product_id,planId:'expired-plan'});
  expect((await usePreset(client,detail,'chosen-spec')).page).toBe('photos');
  expect(client.recover().productId).toBeUndefined();expect(client.recover().variantId).toBe('chosen-spec');
});
it('rejects an account switch during public preset lookup before private calls or recovery writes',async()=>{
  let release!:(value:unknown)=>void;
  const {client,sent}=setup(r=>r.url.includes('/presets/')?new Promise(resolve=>{release=resolve;}):normal(r));
  await usePreset(client,detail,'chosen-spec');client.remember({productId:product.product_id});const pending=startSelectedPlan(client);
  await new Promise(resolve=>setTimeout(resolve,0));client.attach(session('buyer-b'));release(detail);
  await expect(pending).rejects.toMatchObject({code:'ACCOUNT_CHANGED'});expect(client.recover()).toEqual({});expect(sent).toHaveLength(1);
});
it('rejects a same-account product switch while input checking before creating a plan',async()=>{
  let release!:(value:unknown)=>void;
  const {client,sent}=setup(r=>r.url.endsWith('/input-check')?new Promise(resolve=>{release=resolve;}):normal(r));
  await usePreset(client,detail,'chosen-spec');client.remember({productId:product.product_id});const pending=startSelectedPlan(client);
  await new Promise(resolve=>setTimeout(resolve,0));client.remember({productId:'other-product'});release({eligible:true,capture_guidance:[],reason_codes:[]});
  await expect(pending).rejects.toMatchObject({code:'INPUT_VERSION_CHANGED'});expect(client.recover().planId).toBeUndefined();
  expect(sent.some(r=>r.method==='POST'&&r.url.endsWith('/plans'))).toBe(false);
});
it('explicit logout prevents automatic login restoration and discards the account recovery reference',()=>{
  const {client,host}=setup(normal);client.remember({productId:product.product_id});client.logout();
  expect(client.hasPreviousAccount()).toBe(false);expect(new ClientSession(host,'https://api.example.test').hasPreviousAccount()).toBe(false);
  expect(client.recover()).toEqual({});
});
