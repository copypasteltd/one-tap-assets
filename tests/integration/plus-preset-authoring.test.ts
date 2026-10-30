import {beforeAll,afterAll,it,expect} from 'vitest';
import {plusFixture} from '../helpers/plus';
import {id} from '../../src/api/lib/crypto';
import {issueSession} from '../../src/api/modules/identity';
import type {DTO} from '../../src/shared/contracts/types';

let f:Awaited<ReturnType<typeof plusFixture>>,creator:DTO<'PlusBrowserSession'>,plain:DTO<'PlusBrowserSession'>,draft:DTO<'PresetDraft'>,config:DTO<'PresetConfig'>;
const base='/v1/p01';
function call(path:string,method:'GET'|'POST'|'PATCH'|'DELETE'='GET',payload?:Record<string,unknown>,token?:string,key?:string){return f.app.inject({method,url:base+path,headers:{...(token?{authorization:`Bearer ${token}`} :{}),...(key?{'idempotency-key':key}:{})},...(payload===undefined?{}:{payload})});}
async function connect(body:DTO<'PlusLinkCreateRequest'>){const made=await call('/plus/links','POST',body),link:DTO<'PlusLink'>=made.json().data;expect(made.statusCode,made.body).toBe(200);
  const inspect=await call('/plus/links/inspect','POST',{user_code:link.user_code},f.buyer.accessToken);expect(inspect.json().data.can_edit_community_drafts).toBe(body.prepare_community_drafts===true);
  expect((await call('/plus/links/decision','POST',{user_code:link.user_code,decision:'APPROVE'},f.buyer.accessToken)).statusCode).toBe(200);
  const poll=await call(`/plus/links/${link.link_id}/poll`,'POST',{poll_key:link.poll_key});expect(poll.statusCode,poll.body).toBe(200);return poll.json().data.session as DTO<'PlusBrowserSession'>;
}
beforeAll(async()=>{f=await plusFixture();});afterAll(async()=>{await f?.close();});
it('keeps existing grants out of community authoring and requires separate native approval',async()=>{
  plain=await connect({});expect(plain.connection.can_edit_community_drafts).toBe(false);
  for(const path of ['/community-components','/variant-blueprints','/community-resource-versions','/preset-drafts'])expect((await call(path,'GET',undefined,plain.access_token)).statusCode).toBe(403);
  creator=await connect({prepare_community_drafts:true});expect(creator.connection.can_edit_community_drafts).toBe(true);
  const components=await call('/community-components','GET',undefined,creator.access_token),blueprints=await call('/variant-blueprints','GET',undefined,creator.access_token);
  expect(components.statusCode,components.body).toBe(200);expect(blueprints.statusCode,blueprints.body).toBe(200);
  const c:DTO<'ComponentOption'>[]=components.json().data.items,b:DTO<'VariantBlueprint'>[]=blueprints.json().data.items;
  config={name:'午后小店的轻快日常',description:'先展示商品整体，再看细节，以轻快节奏收束。',style_tags:['自然','轻快'],parent_preset_version:null,
    component_versions:['STYLE','NARRATIVE','RHYTHM','CAMERA','CAPTION'].map(type=>c.find(x=>x.type===type&&x.supported_engines.includes('PHOTO_LAYOUT'))!.component_version_id),
    variant_blueprint_ids:b.filter(x=>x.engine==='PHOTO_LAYOUT').slice(0,2).map(x=>x.blueprint_id),resource_version_ids:[],fork_allowed:true};
});
it('creates one owned cloud draft on original intent replay, visible from the native account',async()=>{
  const key=id('creatorintent'),first=await call('/preset-drafts','POST',{config},creator.access_token,key);expect(first.statusCode,first.body).toBe(201);draft=first.json().data;
  expect((await call('/preset-drafts','POST',{config},creator.access_token,key)).json().data).toEqual(draft);
  expect((await call(`/preset-drafts/${draft.draft_id}`,'GET',undefined,f.buyer.accessToken)).json().data).toEqual(draft);
  expect((await call(`/preset-drafts/${draft.draft_id}`,'GET',undefined,f.other.accessToken)).statusCode).toBe(404);
  expect((await call('/preset-drafts','GET',undefined,creator.access_token)).json().data.items.some((x:DTO<'PresetDraft'>)=>x.draft_id===draft.draft_id)).toBe(true);
});
it('serializes conflicting phone/desktop revisions without overwriting the winner',async()=>{
  const patch=(name:string)=>({expected_revision:draft.revision,config:{...config,name}});
  const values=await Promise.all([call(`/preset-drafts/${draft.draft_id}`,'PATCH',patch('手机里的新名字'),f.buyer.accessToken,id('phoneedit')),
    call(`/preset-drafts/${draft.draft_id}`,'PATCH',patch('电脑里的新名字'),creator.access_token,id('desktopedit'))]);
  expect(values.map(x=>x.statusCode).sort()).toEqual([200,409]);const winner=values.find(x=>x.statusCode===200)!.json().data;
  expect((await call(`/preset-drafts/${draft.draft_id}`,'GET',undefined,creator.access_token)).json().data).toEqual(winner);draft=winner;config=winner.config;
});
it('revalidates declarations and retains native-only sample, rights, publication and financial gates',async()=>{
  const invalid=await call('/preset-drafts','POST',{config:{...config,component_versions:['external.untrusted.1']}},creator.access_token,id('invalidcreator'));
  expect(invalid.statusCode,invalid.body).toBe(422);
  expect((await call('/preset-drafts','POST',{config:{...config,parent_preset_version:'some-unaccepted-parent'}},creator.access_token,id('badparent'))).statusCode).toBe(422);
  const quote=(await f.db.pool.query('SELECT quote_id FROM orders WHERE id=$1',[f.orderId])).rows[0].quote_id;
  const requests:[string,Record<string,unknown>][]=[
    [`/preset-drafts/${draft.draft_id}/samples`,{draft_revision:draft.revision,product_id:f.productId,profile_id:'synthetic-profile',variant_blueprint_id:config.variant_blueprint_ids[0],rights_record_ids:['synthetic-rights']}],
    [`/preset-drafts/${draft.draft_id}/submit`,{expected_revision:draft.revision,sample_ids:['synthetic-sample'],rights_record_ids:['synthetic-rights'],license_version:'synthetic-license',license_content_hash:'a'.repeat(64),accept_license:true,accept_sample_publication:true,public_sample_retention_days:30}],
    ['/rights-records',{scope:'OWNED_PRODUCT',statement:'Synthetic gate check',evidence_asset_ids:['synthetic-evidence']}],['/orders',{quote_id:quote,channel:'alipay'}]];
  for(const [path,body] of requests){const result=await call(path,'POST',body,creator.access_token,id('forbiddencreator'));expect(result.statusCode,`${path}: ${result.body}`).toBe(403);}
});
it('rejects authoring through a bound-source approval and freezes requested scope in PostgreSQL',async()=>{
  const peer=await issueSession(f.db.pool,{platform:'douyin',appId:'dev-douyin',subjectId:id('creatorpeer')});
  const a=(await f.db.pool.query('SELECT id FROM platform_identities WHERE tenant_id=$1 AND user_id=$2',[f.buyer.principal.tenantId,f.buyer.principal.userId])).rows[0],
    b=(await f.db.pool.query("SELECT id FROM platform_identities WHERE user_id=$1 AND platform='douyin'",[peer.user_id])).rows[0],binding=id('creatorbinding');
  await f.db.pool.query('INSERT INTO account_bindings(id,alipay_identity_id,douyin_identity_id) VALUES($1,$2,$3)',[binding,a.id,b.id]);
  const made=await call('/plus/links','POST',{prepare_community_drafts:true}),link=made.json().data;
  const result=await call('/plus/links/decision','POST',{user_code:link.user_code,decision:'APPROVE',account_binding_id:binding},f.buyer.accessToken);
  expect(result.statusCode,result.body).toBe(403);expect(result.json().code).toBe('PLUS_CREATOR_NATIVE_SOURCE_REQUIRED');
  expect((await f.db.pool.query('SELECT state FROM plus_links WHERE id=$1',[link.link_id])).rows[0].state).toBe('PENDING');
  await expect(f.db.pool.query('UPDATE plus_sessions SET allow_community_drafts=true WHERE id=$1',[plain.connection.session_id])).rejects.toThrow('scope is frozen');
  await expect(f.db.pool.query('UPDATE plus_links SET allow_community_drafts=false WHERE id=$1',[link.link_id])).rejects.toThrow('scope is frozen');
});
it('revokes all creator operations, including an already successful idempotent request',async()=>{
  const key=id('creatorbeforeclose'),body={config:{...config,name:'撤销前保存'}};
  expect((await call('/preset-drafts','POST',body,creator.access_token,key)).statusCode).toBe(201);
  const count=(await f.db.pool.query('SELECT count(*) FROM preset_drafts')).rows[0].count;
  expect((await call(`/plus/sessions/${creator.connection.session_id}`,'DELETE',undefined,f.buyer.accessToken)).statusCode).toBe(200);
  expect((await call('/preset-drafts','POST',body,creator.access_token,key)).statusCode).toBe(401);
  expect((await call(`/preset-drafts/${draft.draft_id}`,'GET',undefined,creator.access_token)).statusCode).toBe(401);
  expect((await f.db.pool.query('SELECT count(*) FROM preset_drafts')).rows[0].count).toBe(count);
  expect((await call(`/preset-drafts/${draft.draft_id}`,'GET',undefined,f.buyer.accessToken)).statusCode).toBe(200);
});
