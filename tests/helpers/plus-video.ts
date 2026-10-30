import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {plusRenderFixture} from './plus-render';
import {syntheticListeningContract,syntheticControlListeningPass,listeningSse} from './listening';
import {hash,sha256,id} from '../../src/api/lib/crypto';
import {insert} from '../../src/api/db/store';
import {nativeCommand,inspectVideo} from '../../src/worker/media/native';
import {ListeningClient,type PreparedListening} from '../../src/worker/providers/omni-listening';
import {NativeListeningGateway} from '../../src/worker/audio/listening-gateway';
import {ReviewStageService} from '../../src/worker/review/stage';
import {CodexRuntimeAdapter} from '../../src/worker/codex/runtime';
import type {DTO} from '../../src/shared/contracts/types';

/** Real native media/HTTPS/PG/MCP; identities, payment and positive listening
 * verdicts are synthetic control fixtures, never production admission. */
export async function plusVideoFixture(){
  const f=await plusRenderFixture();
  try{
    const listening=syntheticListeningContract();
    f.cfg.plusVideoRender={enabled:true,priceFen:300,pricingVersion:'SYNTHETIC-VIDEO-1',budgetMicro:10000000,listeningModelVersionId:listening.model_version_id};
    f.cfg.generationEnabled=true;f.cfg.provider.listening={enabled:true,baseUrl:listening.base_url,apiKey:'SYNTHETIC-NOT-REAL',allowedHosts:['listening.example.test']};
    const model={provider:listening.provider,actual_model:listening.actual_model,registry_version:listening.registry_version,roles:['QC'],
      capability_hash:hash(listening),rate_snapshot_id:listening.rate_snapshot_id};
    await insert(f.db.pool,'provider_model_versions',{id:listening.model_version_id,provider:model.provider,actual_model:model.actual_model,
      status:'ADMITTED',version:model.registry_version,data:model,private:{listening_contract:listening}});
    await f.db.pool.query(`UPDATE execution_variants SET private=jsonb_set(private,'{codex_contract,max_input_tokens}','600000'::jsonb)
      WHERE variant_id='minimal-clean.photo-layout'`);
    const directory=join(f.cfg.runtimeRoot,'test-plus-video',id('source'));await mkdir(directory,{recursive:true});
    const png=join(directory,'source.png'),path=join(directory,'source.mp4');await writeFile(png,f.png);
    await nativeCommand(f.cfg,process.env.FFMPEG_PATH?.trim()||'ffmpeg',['-hide_banner','-loglevel','error','-nostdin','-threads','2','-loop','1','-framerate','30','-i',png,
      '-f','lavfi','-i','sine=frequency=660:sample_rate=48000:duration=4','-map','0:v:0','-map','1:a:0','-t','4','-frames:v','120',
      '-c:v','libx264','-threads','2','-preset','veryfast','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-ac','2','-movflags','+faststart',path],{cwd:directory,timeoutMs:60000});
    const artifactId=id('artifact'),manifestId=id('manifest');
    const bytes=await readFile(path),inspection=await inspectVideo(f.cfg,path),key=`${f.buyer.principal.tenantId}/synthetic-plus-parent/${artifactId}.mp4`;
    await f.store.put(key,bytes,'video/mp4');
    const item:DTO<'Deliverable'>={...f.pack.items[0]!,deliverable_id:artifactId,kind:'video',file_name:'synthetic-original-video.mp4',mime_type:'video/mp4',
      size_bytes:bytes.length,sha256:sha256(bytes),fps:30,duration_frames:120};
    const pack:DTO<'Deliverables'>={...f.pack,manifest_id:manifestId,manifest_revision:2,items:[item]};
    await insert(f.db.pool,'artifacts',{id:artifactId,tenant_id:f.buyer.principal.tenantId,order_id:f.originalId,stage_run_id:f.lease.id,
      slot_id:'hero-video',object_key:key,sha256:item.sha256,spec_json:{kind:'video',inspection},data:{synthetic_original:true},expires_at:pack.expires_at});
    await insert(f.db.pool,'delivery_manifests',{id:manifestId,tenant_id:f.buyer.principal.tenantId,owner_id:f.buyer.principal.userId,order_id:f.originalId,
      revision:2,hash:hash(pack),data:pack,private:{synthetic_original:true},expires_at:pack.expires_at});
    let listeningCalls=0,blockListening=false;
    const client=new ListeningClient(f.cfg,async(_url,_hosts,options={})=>{
      listeningCalls++;const request=JSON.parse(String(options.body));
      const summary=JSON.parse(request.messages[0].content.find((p:{type:string})=>p.type==='text').text).input as PreparedListening['summary'];
      const result=syntheticControlListeningPass(summary);if(blockListening)result.verdict='INSUFFICIENT';
      const raw=listeningSse(listening,result);return {status:200,headers:{'content-type':'text/event-stream'},bytes:raw,json:()=>null};
    });
    const gateway=new NativeListeningGateway(f.db.pool,f.cfg,f.store,client),runtime=new CodexRuntimeAdapter(f.db.pool,f.cfg,f.launcher);
    f.services.REVIEW_FACTS=new ReviewStageService(f.db.pool,f.cfg,runtime,gateway);f.services.REVIEW_STYLE=new ReviewStageService(f.db.pool,f.cfg,runtime,gateway);
    return {...f,pack,artifactId,sourceVideo:bytes,sourcePath:path,inspection,listening,listenCount:()=>listeningCalls,blockListening:()=>{blockListening=true;}};
  }catch(e){await f.close();throw e;}
}
