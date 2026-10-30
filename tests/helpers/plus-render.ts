import sharp from 'sharp';
import {writeFile} from 'node:fs/promises';
import {testDatabase,account} from './database';
import {mediaFixture} from './media';
import {syntheticSse} from './codex';
import {FixtureLauncher} from './role-launcher';
import {withFixtureLease} from './lease';
import {buildApp} from '../../src/api/app';
import {transaction} from '../../src/api/db/pool';
import {insert} from '../../src/api/db/store';
import {id,hash,sha256,iso,addSeconds} from '../../src/api/lib/crypto';
import {confirmPayment} from '../../src/api/modules/commerce';
import type {DTO} from '../../src/shared/contracts/types';
import {ToolConsumer,type ToolHandler} from '../../src/worker/tool-gateway/consumer';
import {contentTools} from '../../src/worker/tool-gateway/content-tools';
import {productionTools} from '../../src/worker/tool-gateway/production-tools';
import {reviewTools} from '../../src/worker/tool-gateway/review-tools';
import {CodexRuntimeAdapter} from '../../src/worker/codex/runtime';
import {ContentPlanningService} from '../../src/worker/codex/planning';
import {MediaStageService} from '../../src/worker/codex/media-stage';
import {QualityControlService} from '../../src/worker/review/qc';
import {ReviewStageService} from '../../src/worker/review/stage';
import {PublicationService} from '../../src/worker/review/publication';
import {claimStage,completeStage} from '../../src/worker/queue/leases';

/** Native PG/HTTPS/MCP/PNG. Original paid metadata, inference, payment event,
 * semantic verdicts and process identity are SYNTHETIC; never admission proof. */
export async function plusRenderFixture(){
  const db=await testDatabase(),controller=new AbortController();
  let app:Awaited<ReturnType<typeof buildApp>>|undefined,consumer:Promise<void>|undefined;
  try{
    const buyer=await account(db),other=await account(db),f=await mediaFixture(db,{principal:buyer.principal}),p=buyer.principal;
    const cfg=f.cfg;cfg.plusRender={enabled:true,priceFen:200,pricingVersion:'SYNTHETIC-PLUS-1'};cfg.paymentsEnabled=true;
    await writeFile(cfg.codex.admissionPath,JSON.stringify(f.admission));
    await db.pool.query("UPDATE stage_runs SET state='CANCELLED' WHERE state NOT IN ('SUCCEEDED','FAILED')");
    const modelId=id('synthetic_model'),model=f.contract.model_versions[0]!;
    await insert(db.pool,'provider_model_versions',{id:modelId,provider:model.provider,actual_model:model.actual_model,status:'ADMITTED',version:model.registry_version,data:model,private:{synthetic_only:true}});
    await db.pool.query(`UPDATE execution_variants SET admission_state='ADMITTED',sale_enabled=true,price_fen=200,
      data=data||'{"admission_state":"ADMITTED","sale_enabled":true,"price_fen":200}'::jsonb,
      private=private||jsonb_build_object('codex_contract',$2::jsonb,'budget_micro',10000000,'model_version_ids',$3::jsonb)
      WHERE variant_id=$1`,['minimal-clean.photo-layout',JSON.stringify(f.contract.codex_contract),JSON.stringify([modelId])]);
    await db.pool.query("UPDATE skill_bundles SET state='ADMITTED' WHERE bundle_hash=$1",[f.contract.codex_contract.skill_bundle_hash]);
    await db.pool.query("UPDATE provider_model_versions SET status='ADMITTED'");
    const originalId=f.orderId,artifactId=id('artifact'),manifestId=id('manifest'),expires=addSeconds(86400);
    const png=await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000"><rect width="800" height="1000" fill="#CFE9D6"/><rect x="230" y="170" width="300" height="650" rx="40" fill="#2675A4"/><text x="380" y="480" text-anchor="middle" font-family="sans-serif" font-size="34" fill="white">SYNTHETIC</text></svg>')).png().toBuffer();
    const key=`${p.tenantId}/synthetic-plus-parent/${artifactId}.png`;await f.store.put(key,png,'image/png');
    const item:DTO<'Deliverable'>={deliverable_id:artifactId,slot_id:'hero',kind:'image',file_name:'synthetic-original.png',mime_type:'image/png',size_bytes:png.length,width:800,height:1000,fps:null,duration_frames:null,text:null,sha256:sha256(png)};
    const pack:DTO<'Deliverables'>={order_id:originalId,manifest_id:manifestId,manifest_revision:1,expires_at:expires,items:[item]};
    await insert(db.pool,'artifacts',{id:artifactId,tenant_id:p.tenantId,order_id:originalId,stage_run_id:f.lease.id,slot_id:'hero',object_key:key,sha256:item.sha256,spec_json:{kind:'image',width:800,height:1000},data:{synthetic_original:true},expires_at:expires});
    await insert(db.pool,'delivery_manifests',{id:manifestId,tenant_id:p.tenantId,owner_id:p.userId,order_id:originalId,revision:1,hash:hash(pack),data:pack,private:{synthetic_original:true},expires_at:expires});
    await db.pool.query("UPDATE orders SET fulfillment_state='DELIVERED',data=data||jsonb_build_object('fulfillment_state','DELIVERED','delivery_expires_at',$2::text) WHERE id=$1",[originalId,expires]);
    const images:number[]=[];
    app=await buildApp({cfg,pool:db.pool,inferenceHttp:async(_cfg,_url,options)=>{
      const input=JSON.parse(options!.body!.toString()).input[0].content;
      images.push(Array.isArray(input)?input.filter((c:{type:string})=>c.type==='input_image').length:0);
      return {status:200,headers:{'content-type':'text/event-stream'},bytes:syntheticSse(f.admission),json:()=>null};
    }});
    await app.listen({host:'127.0.0.1',port:0});const address=app.server.address();if(!address||typeof address==='string')throw new Error('Missing native HTTPS');
    cfg.publicBaseUrl=`https://localhost:${address.port}`;
    const content=contentTools(db.pool),media=productionTools(db.pool,cfg,f.store),review=reviewTools(db.pool,cfg,f.store),handlers:Record<string,ToolHandler>={...content,...media,...review};
    handlers.persist_stage_result=(scope,...args)=>(scope.role==='CONTENT'?content:scope.role.startsWith('REVIEW_')?review:media).persist_stage_result!(scope,...args);
    consumer=new ToolConsumer(db.pool,id('plus_tools'),handlers).run(controller.signal);
    const launcher=new FixtureLauncher(),runtime=new CodexRuntimeAdapter(db.pool,cfg,launcher);
    const services={PLAN:new ContentPlanningService(db.pool,cfg,runtime),PRODUCTION:new MediaStageService(db.pool,cfg,runtime),POST:new MediaStageService(db.pool,cfg,runtime),
      QC:new QualityControlService(db.pool,cfg,f.store),REVIEW_FACTS:new ReviewStageService(db.pool,cfg,runtime),REVIEW_STYLE:new ReviewStageService(db.pool,cfg,runtime),DELIVER:new PublicationService(db.pool,cfg,f.store)};
    const call=async(path:string,method:'GET'|'POST'|'PUT'|'DELETE'='GET',payload?:unknown,access?:string)=>app!.inject({method,url:'/v1/p01'+path,
      headers:{...(access?{authorization:`Bearer ${access}`}:{ }),...(method!=='GET'?{'idempotency-key':id('synthetic_intent')}:{})},...(payload===undefined?{}:{payload:payload as Record<string,unknown>})});
    const connect=async(prepare=false,prepareVideo=false)=>{
      const link=(await call('/plus/links','POST',{prepare_render_plans:prepare,prepare_video_render_plans:prepareVideo})).json().data as DTO<'PlusLink'>;
      const approved=await call('/plus/links/decision','POST',{user_code:link.user_code,decision:'APPROVE'},buyer.accessToken);
      if(approved.statusCode!==200)throw new Error(`Synthetic phone approval ${approved.statusCode}`);
      return (await call(`/plus/links/${link.link_id}/poll`,'POST',{poll_key:link.poll_key})).json().data.session as DTO<'PlusBrowserSession'>;
    };
    const step=async(name:keyof typeof services)=>{
      const lease=await claimStage(db.pool,id('plus_worker'),[name]);if(!lease)throw new Error(`Missing Plus stage ${name}`);
      await completeStage(db.pool,lease,await withFixtureLease(db.pool,lease,()=>services[name].handle(lease,controller.signal)));
    };
    const pay=async(order:DTO<'Order'>)=>{
      const merchant=(await db.pool.query('SELECT merchant_id FROM payments WHERE order_id=$1',[order.order_id])).rows[0].merchant_id;
      return transaction(db.pool,client=>confirmPayment(client,{channel:p.platform,appId:p.appId,subjectId:p.subjectId,merchantId:merchant,
        orderId:order.order_id,providerOrderId:id('synthetic_payment'),eventKey:id('synthetic_event'),amountFen:order.amount_fen,rawHash:hash({synthetic:true,at:iso()})}));
    };
    return {...f,db,buyer,other,cfg,app,call,connect,step,pay,launcher,images,originalId,artifactId,pack,png,services,
      close:async()=>{controller.abort();await consumer;await app!.close();await db.close();}};
  }catch(error){controller.abort();await consumer;await app?.close();await db.close();throw error;}
}
