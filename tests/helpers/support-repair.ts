import {testDatabase} from './database.js';
import {mediaFixture} from './media.js';
import {FixtureLauncher} from './role-launcher.js';
import {syntheticSse} from './codex.js';
import {buildApp} from '../../src/api/app.js';
import {id,sha256} from '../../src/api/lib/crypto.js';
import {issueSession} from '../../src/api/modules/identity.js';
import {getDeliverables} from '../../src/api/modules/delivery.js';
import {CodexRuntimeAdapter} from '../../src/worker/codex/runtime.js';
import {MediaStageService} from '../../src/worker/codex/media-stage.js';
import {ToolConsumer,type ToolHandler} from '../../src/worker/tool-gateway/consumer.js';
import {productionTools} from '../../src/worker/tool-gateway/production-tools.js';
import {reviewTools} from '../../src/worker/tool-gateway/review-tools.js';
import {revisionTools} from '../../src/worker/tool-gateway/revision-tools.js';
import {claimStage,completeStage,heartbeatStage,type StageLease} from '../../src/worker/queue/leases.js';
import {enqueueStage} from '../../src/worker/queue/enqueue.js';
import {QualityControlService} from '../../src/worker/review/qc.js';
import {ReviewStageService} from '../../src/worker/review/stage.js';
import {PublicationService} from '../../src/worker/review/publication.js';
import {RevisionService} from '../../src/worker/revisions/service.js';
import {REVISION_STAGES} from '../../src/worker/revisions/contract.js';
import type {NativeLaunchManifest} from '../../src/worker/codex/launcher.js';
import type {DTO} from '../../src/shared/contracts/types.js';
import type {StageCommit} from '../../src/worker/runtime.js';

// Real PostgreSQL, private bytes, native stdio/HTTP and five-stage execution.
// Identity, semantic verdicts and inference metering remain synthetic fixtures.
class RepairLauncher extends FixtureLauncher{
  override async launch(path:string,manifest:NativeLaunchManifest){const result=await super.launch(path,manifest);result.receipt.os_identity_ref=`SYNTHETIC-NOT-RESTRICTED:${manifest.run_id}`;result.receipt.process_ref+=`:${manifest.run_id}`;return result;}
}
export async function supportRepairEnvironment(){
  const db=await testDatabase(),stop=new AbortController();let app:Awaited<ReturnType<typeof buildApp>>|undefined,consumer:Promise<void>|undefined;
  const close=async()=>{stop.abort();try{if(consumer)await consumer;}finally{try{await app?.close();}finally{await db.close();}}};
  try{
    const f=await mediaFixture(db,{revisions:true});
    const roles={alpha:'SYNTHETIC-REPAIR-UI-ALPHA',beta:'SYNTHETIC-REPAIR-UI-BETA',read:'SYNTHETIC-REPAIR-UI-READ'};
    f.cfg.managementTokens=JSON.stringify(Object.entries(roles).map(([actor,token])=>({actor:`repair-ui-${actor}`,token_hash:sha256(token),permissions:actor==='read'?['support:read']:['support:read','support:write','support:repair']})));
    app=await buildApp({cfg:f.cfg,pool:db.pool,inferenceHttp:async()=>({status:200,headers:{'content-type':'text/event-stream'},bytes:syntheticSse(f.admission),json:()=>null})});
    await app.listen({host:'127.0.0.1',port:0});const address=app.server.address();if(!address||typeof address==='string')throw new Error('Missing fixture listener');
    const origin=`https://localhost:${address.port}`;f.cfg.publicBaseUrl=origin;
    const media=productionTools(db.pool,f.cfg,f.store),review=reviewTools(db.pool,f.cfg,f.store),revisions=revisionTools(db.pool,f.cfg,f.store);
    const normal:Record<string,ToolHandler>={...media,...review,persist_stage_result:(scope,...args)=>(scope.role.startsWith('REVIEW_')?review:media).persist_stage_result!(scope,...args)};
    const handlers=Object.fromEntries(Object.keys(normal).map(name=>[name,((scope,...args)=>(scope.scope_type==='REVISION'?revisions:normal)[name]!(scope,...args)) as ToolHandler]));
    consumer=new ToolConsumer(db.pool,id('repair-ui-tools'),handlers).run(stop.signal);
    const next=async(name:string)=>{const lease=await claimStage(db.pool,id('repair-ui-worker'),[name]);if(!lease)throw new Error(`Missing fixture stage ${name}`);return lease;};
    const finish=async(lease:StageLease,handler:()=>Promise<StageCommit>)=>{
      let pulse:Promise<void>|undefined,failure:unknown;const timer=setInterval(()=>{pulse??=heartbeatStage(db.pool,lease).then(ok=>{if(!ok)throw new Error('Fixture lease lost');}).catch(e=>{failure=e;}).finally(()=>{pulse=undefined;});},4000);
      try{const commit=await handler();if(pulse)await pulse;if(failure)throw failure;await completeStage(db.pool,lease,commit);}finally{clearInterval(timer);if(pulse)await pulse;}
    };
    const runtime=new CodexRuntimeAdapter(db.pool,f.cfg,new FixtureLauncher()),mediaStage=new MediaStageService(db.pool,f.cfg,runtime);
    await finish(f.lease,()=>mediaStage.handle(f.lease,stop.signal));const post=await next('POST');await finish(post,()=>mediaStage.handle(post,stop.signal));let dependency=post.id;
    for(const name of ['QC','REVIEW_FACTS','REVIEW_STYLE','DELIVER']){
      await enqueueStage(db.pool,{tenantId:f.p.tenantId,scopeType:'ORDER',scopeId:f.orderId,name,inputHash:f.snapshotHash,deadlineAt:f.snapshot.deadline_at,jobId:f.lease.job_id!,dependencies:[dependency]});
      const lease=await next(name);dependency=lease.id;const service=name==='QC'?new QualityControlService(db.pool,f.cfg,f.store):name==='DELIVER'?new PublicationService(db.pool,f.cfg,f.store):new ReviewStageService(db.pool,f.cfg,runtime);
      await finish(lease,()=>service.handle(lease,stop.signal));
    }
    const buyer=(await issueSession(db.pool,{platform:'alipay',appId:f.p.appId,subjectId:f.p.subjectId})).access_token,parent=await getDeliverables(db.pool,f.p,f.orderId);
    const admin=(token=roles.alpha,key=id('repair-ui-request'))=>({authorization:`Bearer ${token}`,'idempotency-key':key});
    const ticket=await app.inject({method:'POST',url:`/v1/p01/orders/${f.orderId}/tickets`,headers:{authorization:`Bearer ${buyer}`,'idempotency-key':id('repair-ui-ticket')},
      payload:{category:'PRODUCT_ERROR',message:'合成演示：请依据原实拍商品资料，更正配套文案。',attachment_asset_ids:[]}});
    if(ticket.statusCode!==201)throw new Error(`Fixture ticket refused: ${ticket.statusCode}`);
    const completeRepair=async(revisionId:string)=>{const service=new RevisionService(db.pool,f.cfg,f.store,new CodexRuntimeAdapter(db.pool,f.cfg,new RepairLauncher()));
      for(const name of REVISION_STAGES){const lease=await next(name);if(lease.scope_id!==revisionId)throw new Error('Fixture scope mismatch');await finish(lease,()=>service.handle(lease,stop.signal));}
      return getDeliverables(db.pool,f.p,f.orderId);
    };
    return {db,f,app,origin,parent,buyer,roles,admin,ticket:ticket.json().data as DTO<'Ticket'>,completeRepair,close};
  }catch(error){await close();throw error;}
}
