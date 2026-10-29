import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import type pg from 'pg';
import type {Config} from '../../api/config.js';
import type {ObjectStorage} from '../../api/storage/storage.js';
import {hash,sha256} from '../../api/lib/crypto.js';
import {requireThat} from '../../api/lib/errors.js';
import type {Db} from '../../api/db/pool.js';
import {executionContext,type ExecutionContext} from '../compiler/order-context.js';
import {GenerationGateway} from '../generation/gateway.js';
import {readReferenceApproval} from '../generation/reference-approval.js';
import {generatedOutputs,sourcesForSlot,checkGeneratedSources} from '../generation/outputs.js';
import {imageRequest,videoRequest} from '../generation/requests.js';
import {validateGenerationExecution} from '../generation/contracts.js';
import {submitGenerationNode} from '../generation/execute.js';
import {PendingExternal,type StageLease} from '../queue/leases.js';
import type {ToolScope} from '../tool-gateway/http.js';
import type {ToolLease} from '../tool-gateway/consumer.js';
import {PhotoMediaPipeline,assertMediaAlive,inspectImage} from './photo-pipeline.js';
import {operationArtifacts,type ArtifactSpec,type MediaOperation,type MediaPhase,type MediaReceipt,type PrivateArtifact} from './artifacts.js';
import {loadProductionFont} from './font.js';
import {renderLayout} from './layout.js';
import {nativeCommand,inspectVideo,type MediaInspection} from './native.js';
import type {NativeOrderAudio} from '../audio/order-proof.js';
import {frozenAiDisclosure} from '../compiler/disclosure.js';
import {disclosureRaster,markDisclosureImage,inspectDisclosure,type AiDisclosureProof} from './disclosure.js';

export const GENERATED_PIPELINE_VERSION='YPCC-GENERATED-SILENT-1.1.0';
/** Actual generated PNG/MP4 inputs only; no still-animation substitution. */
export class GeneratedMediaPipeline extends PhotoMediaPipeline {
  protected override readonly rendererVersion:string=GENERATED_PIPELINE_VERSION;
  private gateway:GenerationGateway;
  constructor(pool:pg.Pool,cfg:Config,store:ObjectStorage,gateway?:GenerationGateway){
    super(pool,cfg,store);requireThat(!gateway||cfg.env==='test','TEST_PORT_FORBIDDEN','生成执行替身仅限测试',500);
    this.gateway=gateway??new GenerationGateway(pool,cfg,store);
  }
  protected override assertRoute(context:ExecutionContext):void{
    validateGenerationExecution(context.contract);
    requireThat(context.snapshot.engine!=='PHOTO_LAYOUT'&&context.snapshot.audio_policy.speech_mode==='NONE'
      &&!context.snapshot.audio_policy.music_license_ids.length,'MEDIA_ROUTE_UNAVAILABLE','当前生成执行器仅接受冻结的无声整包',503);
  }
  protected async material(db:Db,context:ExecutionContext,receipt:MediaReceipt){
    const stageId=receipt.phase==='POST'?(await operationArtifacts(db,context,'PRODUCTION')).operation.stage_run_id
      :(await db.query<{stage_run_id:string}>('SELECT stage_run_id FROM media_operations WHERE tenant_id=$1 AND order_id=$2 AND id=$3 AND phase=$4',
        [context.tenantId,context.orderId,receipt.operation_id,receipt.phase])).rows[0]?.stage_run_id;
    requireThat(stageId,'GENERATED_PACK_SOURCE_INVALID','生成式产物缺少原制作阶段',503);
    return generatedOutputs(db,this.cfg,this.store,context,stageId);
  }
  override async verify(context:ExecutionContext,receipt:MediaReceipt,directory:string,signal:AbortSignal,selected?:ReadonlySet<string>):Promise<void>{
    this.assertRoute(context);checkGeneratedSources(receipt,await this.material(this.pool,context,receipt));
    await super.verify(context,receipt,directory,signal,selected);
    const policy=frozenAiDisclosure(context.contract)!;const checked=new Map<string,AiDisclosureProof>();
    for(const artifact of receipt.artifacts.filter(a=>!selected||selected.has(a.id))){
      if(artifact.spec.kind==='copy'){requireThat(!artifact.spec.ai_disclosure,'AI_DISCLOSURE_PROOF_INVALID','文案不能伪装成媒体像素检查',503);continue;}
      const raw=await this.store.get(artifact.object_key,artifact.spec.kind==='video'?512_000_000:30_000_000);
      requireThat(sha256(raw)===artifact.sha256,'ARTIFACT_HASH_MISMATCH','标识检查时实际媒体字节已变化',503);
      let proof=checked.get(artifact.sha256);
      if(!proof){const inspection=artifact.spec.inspection;
        requireThat('width' in inspection&&inspection.width&&inspection.height,'AI_DISCLOSURE_PROOF_INVALID','缺少原实际媒体尺寸',503);
        proof=await inspectDisclosure(this.cfg,policy,raw,{kind:artifact.spec.kind,width:inspection.width,height:inspection.height,
          frames:context.snapshot.timeline.target_frames,directory,deadline_at:context.snapshot.deadline_at,signal});checked.set(artifact.sha256,proof);}
      requireThat(artifact.spec.ai_disclosure&&hash(artifact.spec.ai_disclosure)===hash(proof),
        'AI_DISCLOSURE_PROOF_INVALID','AI标识实际像素、完整帧数或原证明不一致',503);
    }
  }
  protected override async artifact(context:ExecutionContext,operation:MediaOperation,slotId:string,bytes:Buffer,spec:ArtifactSpec,signal?:AbortSignal):Promise<PrivateArtifact>{
    const policy=frozenAiDisclosure(context.contract)!;
    if(spec.kind!=='copy'){
      requireThat(signal,'AI_DISCLOSURE_SIGNAL_REQUIRED','标识制作必须传播原执行取消信号',500);
      const inspection=spec.inspection;requireThat('width' in inspection&&inspection.width&&inspection.height,
        'AI_DISCLOSURE_PROOF_INVALID','缺少标识实际媒体尺寸',503);
      spec.ai_disclosure=await inspectDisclosure(this.cfg,policy,bytes,{kind:spec.kind,width:inspection.width,height:inspection.height,
        frames:context.snapshot.timeline.target_frames,directory:join(this.cfg.runtimeRoot,'tmp'),deadline_at:context.snapshot.deadline_at,signal});
    }
    return super.artifact(context,operation,slotId,bytes,spec);
  }
  protected async alternateGeneratedVideo(_context:ExecutionContext,_material:Awaited<ReturnType<typeof generatedOutputs>>,_directory:string,_signal:AbortSignal):
    Promise<{bytes:Buffer;inspection:MediaInspection;native_audio:NativeOrderAudio}|undefined>{return undefined;}
  protected override async produce(context:ExecutionContext,operation:MediaOperation,directory:string,signal:AbortSignal,scope:ToolScope):Promise<PrivateArtifact[]>{
    const lease=(await this.pool.query<StageLease>('SELECT * FROM stage_runs WHERE tenant_id=$1 AND id=$2',[scope.tenant_id,scope.stage_run_id])).rows[0]!;
    requireThat(String(lease.fencing_token)===String(scope.stage_fencing_token),'LEASE_LOST','制作租约代次已变化',409);
    const {approval}=await readReferenceApproval(this.pool,this.cfg,this.store,context,lease.id);
    const requests=[...context.snapshot.outputs.filter(s=>s.kind==='image').map(s=>imageRequest(context,s.slot_id)),
      ...(context.snapshot.engine==='REFERENCE_FILM'?[videoRequest(context,approval,null)]:context.contract.creative.shots.map(s=>videoRequest(context,approval,s.shot_id)))];
    for(const request of requests){
      assertMediaAlive(context,signal);const result=await submitGenerationNode(this.pool,this.gateway,lease,request,signal);
      requireThat(result.state!=='FAILED','GENERATION_NODE_FAILED','原生成节点已失败，不得重新购买',503);
      if(result.state!=='SUCCEEDED')throw new PendingExternal(2,'GENERATION_PACK_PENDING');
    }
    const material=await generatedOutputs(this.pool,this.cfg,this.store,context,lease.id),artifacts:PrivateArtifact[]=[];
    const font=await loadProductionFont(this.cfg.projectRoot),configured=context.contract.source.creative_components.platform_style_id;
    const style=typeof configured==='string'?configured:context.snapshot.preset_id;
    for(const [index,slot] of context.snapshot.outputs.filter(s=>s.kind==='image').entries()){
      const planned=context.contract.creative.image_slots.find(s=>s.slot_id===slot.slot_id)!;
      const input=material.outputs.get(`image:${slot.slot_id}`)!;
      const layout=await renderLayout(input.bytes,{presetId:style,width:slot.width!,height:slot.height!,title:planned.title,
        subtitle:context.contract.creative.copy,sequence:index+1,total:context.contract.creative.image_slots.length,font,aiLabel:true,
        disclosure:frozenAiDisclosure(context.contract)!});
      const bytes=await markDisclosureImage(layout,await disclosureRaster(this.cfg,frozenAiDisclosure(context.contract)!,slot.width!,slot.height!));
      const spec=this.spec(context,'PRODUCTION','image',await inspectImage(bytes),[planned.asset_id]);
      spec.generation_sources=sourcesForSlot(material,'image',slot.slot_id);spec.reference_approval_hash=hash(material.approval);
      artifacts.push(await this.artifact(context,operation,slot.slot_id,bytes,spec,signal));
    }
    const alternate=await this.alternateGeneratedVideo(context,material,directory,signal);
    if(alternate){
      for(const slot of context.snapshot.outputs.filter(s=>s.kind==='video')){
        const spec=this.spec(context,'PRODUCTION','video',alternate.inspection,context.contract.creative.shots.map(s=>s.asset_id));
        spec.generation_sources=sourcesForSlot(material,'video',slot.slot_id);spec.reference_approval_hash=hash(material.approval);spec.native_audio=alternate.native_audio;
        artifacts.push(await this.artifact(context,operation,slot.slot_id,alternate.bytes,spec,signal));
      }
      return artifacts;
    }
    const clips=join(directory,'generated-clips');await mkdir(clips);
    const mark=await disclosureRaster(this.cfg,frozenAiDisclosure(context.contract)!,1080,1920);
    await writeFile(join(clips,'disclosure.png'),mark.png,{flag:'wx'});
    for(const [index,key] of material.videoKeys.entries()){
      const input=join(clips,`input${index}.mp4`),output=join(clips,`segment${index}.mp4`);
      const shot=context.contract.creative.shots[index],frames=context.snapshot.engine==='REFERENCE_FILM'?context.snapshot.timeline.target_frames:shot!.end_frame-shot!.start_frame;
      await writeFile(input,material.outputs.get(key)!.bytes,{flag:'wx'});
      await nativeCommand(this.cfg,process.env.FFMPEG_PATH?.trim()||'ffmpeg',['-v','error','-nostdin','-threads','2','-filter_threads','1',
        '-filter_complex_threads','1','-protocol_whitelist','file,pipe','-i',input,'-i',join(clips,'disclosure.png'),
        '-filter_complex',`[0:v]fps=30,scale=1080:1920:flags=lanczos,setsar=1[base];[base][1:v]overlay=${mark.left}:${mark.top}:eof_action=repeat:format=auto[marked]`,
        '-map','[marked]','-an',
        '-frames:v',String(frames),'-map_metadata','-1','-map_chapters','-1','-c:v','libx264','-threads','2','-preset','veryfast',
        '-crf','20','-pix_fmt','yuv420p',output],{cwd:clips,timeoutMs:Math.max(1,Math.min(180000,Date.parse(context.snapshot.deadline_at)-Date.now())),signal});
      const actual=await inspectVideo(this.cfg,output,signal);
      requireThat(actual.frames===frames&&actual.fps===30&&!actual.hasAudio,'GENERATION_TIMELINE_INVALID','原生成视频不足以组成冻结镜头帧数',422);
    }
    const list=join(clips,'concat.txt'),final=join(clips,'assembled.mp4');
    await writeFile(list,material.videoKeys.map((_,i)=>`file 'segment${i}.mp4'`).join('\n')+'\n',{flag:'wx'});
    await nativeCommand(this.cfg,process.env.FFMPEG_PATH?.trim()||'ffmpeg',['-v','error','-nostdin','-protocol_whitelist','file,pipe','-f','concat',
      '-safe','1','-i',list,'-map','0:v:0','-an','-c:v','copy','-map_metadata','-1','-map_chapters','-1','-movflags','+faststart',final],
      {cwd:clips,timeoutMs:Math.max(1,Math.min(120000,Date.parse(context.snapshot.deadline_at)-Date.now())),signal});
    const inspection=await this.videoInspection(context,final,signal),bytes=await readFile(final);
    for(const slot of context.snapshot.outputs.filter(s=>s.kind==='video')){
      const spec=this.spec(context,'PRODUCTION','video',inspection,context.contract.creative.shots.map(s=>s.asset_id));
      spec.generation_sources=sourcesForSlot(material,'video',slot.slot_id);spec.reference_approval_hash=hash(material.approval);
      artifacts.push(await this.artifact(context,operation,slot.slot_id,bytes,spec,signal));
    }
    return artifacts;
  }
  protected override async post(context:ExecutionContext,operation:MediaOperation,source:MediaReceipt,directory:string,signal:AbortSignal,scope:ToolScope):Promise<PrivateArtifact[]>{
    const artifacts=await super.post(context,operation,source,directory,signal,scope);
    for(const item of artifacts.filter(a=>a.spec.kind!=='copy')){
      const original=source.artifacts.find(a=>a.slot_id===item.slot_id)!;
      requireThat(original.spec.generation_sources&&original.spec.reference_approval_hash,
        'GENERATED_PACK_SOURCE_INVALID','后期输入缺少原生成来源与参考核验',503);
      item.spec.generation_sources=original.spec.generation_sources;item.spec.reference_approval_hash=original.spec.reference_approval_hash;
    }
    return artifacts;
  }
  override async execute(scope:ToolScope,intent:ToolLease,phase:MediaPhase,signal:AbortSignal){
    const result=await super.execute(scope,intent,phase,signal);
    return {...result,commit:async(db:pg.PoolClient)=>{
      const context=await executionContext(db,scope.tenant_id,scope.order_id!,scope.snapshot_hash);
      const policy=frozenAiDisclosure(context.contract)!;
      for(const a of result.receipt.artifacts.filter(a=>a.spec.kind!=='copy'))requireThat(a.spec.ai_disclosure?.contract_hash===hash(policy)
        &&a.spec.ai_disclosure.output_sha256===a.sha256&&sha256(await this.store.get(a.object_key,a.spec.kind==='video'?512_000_000:30_000_000))===a.sha256,
        'AI_DISCLOSURE_PROOF_INVALID','事务提交时AI标识证明或实际文件已变化',503);
      checkGeneratedSources(result.receipt,await this.material(db,context,result.receipt));await result.commit(db);
    }};
  }
}
