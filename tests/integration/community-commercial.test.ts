import {beforeAll,afterAll,it,expect} from 'vitest';
import {writeFile} from 'node:fs/promises';
import type {FastifyInstance} from 'fastify';
import {testDatabase,account,type TestDatabase} from '../helpers/database.js';
import {mediaFixture} from '../helpers/media.js';
import {syntheticSse} from '../helpers/codex.js';
import {FixtureLauncher} from '../helpers/role-launcher.js';
import {buildApp} from '../../src/api/app.js';
import {transaction} from '../../src/api/db/pool.js';
import {insert} from '../../src/api/db/store.js';
import {hash,id} from '../../src/api/lib/crypto.js';
import type {DTO} from '../../src/shared/contracts/types.js';
import {createDraft,compilePresetConfig} from '../../src/api/modules/community.js';
import {registerLicense,decideLicense} from '../../src/api/modules/licenses.js';
import {prepareCommunityCommercial} from '../../src/api/modules/community-commercial.js';
import {variantDto,type VariantSource} from '../../src/api/modules/catalog.js';
import {createPlan} from '../../src/api/modules/plans.js';
import {createQuote,createOrder,confirmPayment} from '../../src/api/modules/commerce.js';
import {getDeliverables,createDownloadLink} from '../../src/api/modules/delivery.js';
import {bundleForSource,bundleForVariant} from '../../src/worker/codex/skills.js';
import {CodexRuntimeAdapter} from '../../src/worker/codex/runtime.js';
import {ContentPlanningService} from '../../src/worker/codex/planning.js';
import {MediaStageService} from '../../src/worker/codex/media-stage.js';
import {QualityControlService} from '../../src/worker/review/qc.js';
import {ReviewStageService} from '../../src/worker/review/stage.js';
import {PublicationService} from '../../src/worker/review/publication.js';
import {ToolConsumer} from '../../src/worker/tool-gateway/consumer.js';
import {contentTools} from '../../src/worker/tool-gateway/content-tools.js';
import {productionTools} from '../../src/worker/tool-gateway/production-tools.js';
import {reviewTools} from '../../src/worker/tool-gateway/review-tools.js';
import {claimStage,completeStage,heartbeatStage,type StageLease} from '../../src/worker/queue/leases.js';

let db:TestDatabase,f:Awaited<ReturnType<typeof mediaFixture>>,app:FastifyInstance,consumer:Promise<void>;
let source:VariantSource,presetId:string,versionId:string,licenseId:string,author:Awaited<ReturnType<typeof account>>;
const controller=new AbortController();
beforeAll(async()=>{
  db=await testDatabase();f=await mediaFixture(db);author=await account(db);
  await db.pool.query("UPDATE stage_runs SET state='CANCELLED' WHERE state NOT IN ('SUCCEEDED','FAILED','CANCELLED')");
  const model=id('synthetic_model');
  await insert(db.pool,'provider_model_versions',{id:model,provider:'synthetic-fixture',actual_model:'synthetic-vision',status:'ADMITTED',version:'SYNTHETIC-NOT-PRODUCTION',data:f.contract.model_versions[0]!,private:{}});
  const base=structuredClone(f.contract.source),cc=structuredClone(f.contract.codex_contract);
  await db.pool.query("UPDATE execution_variants SET admission_state='ADMITTED',price_fen=100,data=$2,private=$3 WHERE variant_id=$1",
    [base.variant_id,JSON.stringify({...variantDto(base),admission_state:'ADMITTED',price_fen:100}),JSON.stringify({source:base,preset_id:'minimal-clean',codex_contract:cc,
      model_version_ids:[model],budget_micro:10000000,repair_ceiling_micro:0,resource_versions:[]})]);
  const skill=await bundleForVariant(f.cfg,'quiet-luxury.photo-layout');await db.pool.query("UPDATE skill_bundles SET state='ADMITTED' WHERE bundle_hash=$1",[skill.sha256]);
  const draft=await createDraft(db.pool,author.principal,{name:'合成社区商业协议',description:'Synthetic configuration fixture; publication/sample semantics tested separately.',
    style_tags:['静谧'],parent_preset_version:null,component_versions:['style.quiet-luxury.1'],variant_blueprint_ids:['blueprint.minimal-clean.photo-layout'],resource_version_ids:[],fork_allowed:true});
  const compiled=await compilePresetConfig(db.pool,draft.config);presetId=id('community');versionId=`${presetId}.1.0.0`;
  source={...compiled[0]!.source,variant_id:`${presetId}.variant-1`,version:'1.0.0',name:'合成社区商业协议·照片动效'};
  const terms=await registerLicense(db.pool,{license_id:id('license'),version:'1.0.0',name:'仅合成协议测试许可',full_text:'Synthetic test license; not a production rights grant.',fork_allowed:true,attribution_required:true});licenseId=terms.license_id;
  await decideLicense(db.pool,licenseId,{expected_state:'DRAFT',expected_content_hash:terms.content_hash,decision:'APPROVE',review_reference:'synthetic-commercial-test',reason:'仅验证原生配置协议'});
  const summary:DTO<'PresetSummary'>={preset_id:presetId,version:'1.0.0',name:'合成社区商业协议',author_name:'合成独立作者',source:'COMMUNITY',style_tags:['静谧'],sample_id:null,sample_label:'AUTHORIZED_SAMPLE_NOT_YOUR_RESULT',sale_enabled:false};
  await insert(db.pool,'presets',{id:presetId,author_id:author.principal.userId,source:'COMMUNITY',current_version:'1.0.0',data:summary});
  await insert(db.pool,'preset_versions',{id:versionId,preset_id:presetId,version:'1.0.0',hash:hash(summary),license_version:licenseId,data:{preset:summary,description:'合成商业配置测试',variants:[variantDto(source)],license_summary:terms.full_text,fork_allowed:true,parent_version:null}});
  await insert(db.pool,'execution_variants',{id:`${source.variant_id}.1.0.0`,preset_version_id:versionId,variant_id:source.variant_id,version:'1.0.0',engine:source.engine,data:variantDto(source),private:{source,preset_id:presetId,community_config:draft.config}});
  // Explicit fixture boundary: no fabricated sample QC/admission is treated as
  // author production proof. Only buyer execution below launches actual tools.
  await insert(db.pool,'publications',{id:id('publication'),tenant_id:author.principal.tenantId,owner_id:author.principal.userId,draft_id:draft.draft_id,draft_revision:draft.revision,
    review_state:'PUBLISHED',admission_state:'NOT_EVALUATED',published_version_id:versionId,data:{},private:{config:draft.config,request:{license_content_hash:terms.content_hash}}});
  await writeFile(f.cfg.codex.admissionPath,JSON.stringify(f.admission));
  app=await buildApp({cfg:f.cfg,pool:db.pool,inferenceHttp:async()=>({status:200,headers:{'content-type':'text/event-stream'},bytes:syntheticSse(f.admission),json:()=>null})});
  await app.listen({host:'127.0.0.1',port:0});const address=app.server.address();if(!address||typeof address==='string')throw new Error('Fixture listener missing');
  f.cfg.publicBaseUrl=`https://localhost:${address.port}`;
  const content=contentTools(db.pool),media=productionTools(db.pool,f.cfg,f.store),review=reviewTools(db.pool,f.cfg,f.store);
  consumer=new ToolConsumer(db.pool,id('tools'),{...content,...media,...review,persist_stage_result:(scope,...args)=>
    (scope.role==='CONTENT'?content:scope.role.startsWith('REVIEW_')?review:media).persist_stage_result!(scope,...args)}).run(controller.signal);
});
afterAll(async()=>{controller.abort();await consumer;await app?.close();await db?.close();});
const preparation=(revision=0)=>({variantId:source.variant_id,version:source.version,expectedRevision:revision,actor:'synthetic-platform-operator',reason:'验证独立社区配置，绝非真实准入'});
const prepare=(revision=0)=>transaction(db.pool,db=>prepareCommunityCommercial(db,f.cfg,preparation(revision)));
async function finish(lease:StageLease,handler:()=>Promise<(db:import('pg').PoolClient)=>Promise<void>>){
  const pulse=setInterval(()=>void heartbeatStage(db.pool,lease),5000);try{await completeStage(db.pool,lease,await handler());}finally{clearInterval(pulse);}
}
it('resolves only the compiled trusted style and rejects hash, engine and arbitrary-ID substitutions',async()=>{
  expect((await bundleForSource(f.cfg,source)).payload.variant_id).toBe('quiet-luxury.photo-layout');
  for(const changed of [{...source,community_binding:undefined},{...source,engine:'REFERENCE_FILM' as const},
    {...source,creative_components:{...source.creative_components,platform_style_id:'minimal-clean'}},
    {...source,skill_bundle:{...source.skill_bundle,hash:f.contract.codex_contract.skill_bundle_hash}}]){
    await expect(bundleForSource(f.cfg,changed)).rejects.toMatchObject({code:'SKILL_SOURCE_BINDING_INVALID'});
  }
});
it('requires admitted costs and active license, freezes once without admitting or selling, and protects database configuration',async()=>{
  await expect(transaction(db.pool,async db=>{
    await db.query("UPDATE community_licenses SET state='RETIRED',data=jsonb_set(data,'{state}','\"RETIRED\"') WHERE id=$1",[licenseId]);
    await expect(prepareCommunityCommercial(db,f.cfg,preparation())).rejects.toMatchObject({code:'LICENSE_NOT_AVAILABLE'});
    throw new Error('rollback temporary license revocation');
  })).rejects.toThrow('rollback temporary license revocation');
  await db.pool.query("UPDATE execution_variants SET admission_state='NOT_EVALUATED',data=jsonb_set(data,'{admission_state}','\"NOT_EVALUATED\"') WHERE variant_id='minimal-clean.photo-layout'");
  await expect(prepare()).rejects.toMatchObject({code:'BLUEPRINT_NOT_ADMITTED'});
  await db.pool.query("UPDATE execution_variants SET admission_state='ADMITTED',data=jsonb_set(data,'{admission_state}','\"ADMITTED\"') WHERE variant_id='minimal-clean.photo-layout'");
  const configured=await prepare();expect(configured).toMatchObject({revision:1,admission_state:'NOT_EVALUATED',sale_enabled:false,price_fen:100});
  await expect(prepare()).rejects.toMatchObject({code:'REVISION_CONFLICT'});await expect(prepare(1)).rejects.toMatchObject({code:'COMMERCIAL_ALREADY_FROZEN'});
  await expect(db.pool.query("UPDATE execution_variants SET private=jsonb_set(private,'{budget_micro}','20000000') WHERE variant_id=$1",[source.variant_id])).rejects.toThrow('frozen community configuration');
  await expect(db.pool.query('UPDATE execution_variants SET price_fen=200 WHERE variant_id=$1',[source.variant_id])).rejects.toThrow('frozen community offer');
});
it('runs community buyer planning, frozen quote/checkout, original payment, native media and two fresh reviews through private delivery',async()=>{
  const launcher=new FixtureLauncher(),runtime=new CodexRuntimeAdapter(db.pool,f.cfg,launcher);
  const request:DTO<'PlanRequest'>={product_id:f.product.product_id,photo_version:1,profile_id:f.profile.profile_id,identity_lock_id:f.profile.identity_lock_id,
    preset_id:presetId,preset_version:'1.0.0',variant_id:source.variant_id,variant_version:source.version};
  const plan=await createPlan(db.pool,f.cfg,f.p,request),lease=(await claimStage(db.pool,id('plan'),['PLAN']))!;
  await finish(lease,()=>new ContentPlanningService(db.pool,f.cfg,runtime).handle(lease,controller.signal));
  const ready=(await db.pool.query('SELECT data FROM plan_versions WHERE id=$1',[plan.plan_id])).rows[0].data as DTO<'Plan'>;
  const quoteRequest={plan_id:plan.plan_id,plan_hash:ready.plan_hash!};
  await expect(transaction(db.pool,db=>createQuote(db,f.cfg,f.p,quoteRequest))).rejects.toMatchObject({code:'VARIANT_NOT_FOR_SALE'});
  // Synthetic independent admission only, never a replacement for production
  // full-pack/device/fault evidence. The actual catalog stays disabled.
  await db.pool.query("UPDATE execution_variants SET admission_state='ADMITTED',sale_enabled=true,data=data||'{\"admission_state\":\"ADMITTED\",\"sale_enabled\":true}'::jsonb WHERE variant_id=$1",[source.variant_id]);
  f.cfg.paymentsEnabled=true;
  const quote=await transaction(db.pool,db=>createQuote(db,f.cfg,f.p,quoteRequest));
  const order=await transaction(db.pool,db=>createOrder(db,f.cfg,f.p,{quote_id:quote.quote_id,channel:f.p.platform}));
  const paid=await transaction(db.pool,db=>confirmPayment(db,{channel:f.p.platform,appId:f.p.appId,subjectId:f.p.subjectId,merchantId:f.cfg.alipay.merchantId,
    orderId:order.order_id,providerOrderId:id('synthetic-payment'),eventKey:id('event'),amountFen:100,rawHash:hash('synthetic verified event; no real payment')}));
  expect(paid.fulfillment_state).toBe('QUEUED');
  // New sales can stop while this already paid immutable version completes.
  await db.pool.query("UPDATE presets SET visibility='SUSPENDED' WHERE id=$1",[presetId]);
  await db.pool.query("UPDATE execution_variants SET sale_enabled=false,data=jsonb_set(data,'{sale_enabled}','false') WHERE variant_id=$1",[source.variant_id]);
  const contract=(await db.pool.query('SELECT private FROM orders WHERE id=$1',[order.order_id])).rows[0].private.contract;
  expect(contract.revision_policy.skill_variant_id).toBe('quiet-luxury.photo-layout');expect(contract.revision_policy.image_text.background).toBeTruthy();
  const media=new MediaStageService(db.pool,f.cfg,runtime),qc=new QualityControlService(db.pool,f.cfg,f.store),review=new ReviewStageService(db.pool,f.cfg,runtime),publication=new PublicationService(db.pool,f.cfg,f.store);
  for(const name of ['PRODUCTION','POST','QC','REVIEW_FACTS','REVIEW_STYLE','DELIVER']){
    const next=(await claimStage(db.pool,id('buyer-worker'),[name]))!;expect(next.scope_id).toBe(order.order_id);
    const service=name==='QC'?qc:name==='DELIVER'?publication:name.startsWith('REVIEW_')?review:media;
    await finish(next,()=>service.handle(next,controller.signal));
  }
  expect(launcher.launches).toBe(5);const pack=await getDeliverables(db.pool,f.p,order.order_id);expect(pack.items.length).toBeGreaterThan(2);
  const link=await createDownloadLink(db.pool,f.cfg,f.p,pack.items[0]!.deliverable_id);
  expect(link.url).toContain('https://localhost:');
  await expect(getDeliverables(db.pool,author.principal,order.order_id)).rejects.toMatchObject({code:'NOT_FOUND'});
  expect((await db.pool.query("SELECT id FROM agent_instances WHERE order_id=$1 AND state<>'RELEASED'",[order.order_id])).rowCount).toBe(0);
  expect((await db.pool.query('SELECT variant_id FROM execution_variants WHERE sale_enabled=true')).rows).toHaveLength(0);
});
