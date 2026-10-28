import {mkdir,rm,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import sharp from 'sharp';
import type pg from 'pg';
import {inside,type Config} from '../../api/config.js';
import type {Db} from '../../api/db/pool.js';
import type {ObjectStorage} from '../../api/storage/storage.js';
import {hash,id,sha256} from '../../api/lib/crypto.js';
import {requireThat} from '../../api/lib/errors.js';
import {frozenNativeAudio,verifyNativeAudioLive} from '../audio/contract.js';
import {NATIVE_ORDER_MEDIA_VERSION,originalNativeTranscript,type NativeOrderAudio} from '../audio/order-proof.js';
import {executionContext,type ExecutionContext} from '../compiler/order-context.js';
import type {GenerationGateway} from '../generation/gateway.js';
import type {generatedOutputs} from '../generation/outputs.js';
import {validateGenerationExecution} from '../generation/contracts.js';
import {assertLease,PendingExternal,type StageLease} from '../queue/leases.js';
import {SpeechGateway} from '../speech/gateway.js';
import {submitSpeechNode} from '../speech/execute.js';
import type {ToolScope} from '../tool-gateway/http.js';
import type {ToolLease} from '../tool-gateway/consumer.js';
import {operationArtifacts,type MediaOperation,type MediaReceipt,type PrivateArtifact} from './artifacts.js';
import {GeneratedMediaPipeline} from './generated-pipeline.js';
import {assertMediaAlive,inspectImage,requiredSlots} from './photo-pipeline.js';
import {inspectVideo,type MediaInspection} from './native.js';
import {assembleNativeAudio,verifyNativeAssembly,type NativeSegment} from './native-audio-assembly.js';
import {decodeNativeAudio} from './native-audio.js';
import {compileNativeCaptions} from './native-captions.js';
import {loadProductionFont} from './font.js';
import {renderNativeAudioPost} from './native-audio-post.js';

export const NATIVE_ORDER_PIPELINE_VERSION='YPCC-NATIVE-ORDER-PIPELINE-1';
type Material=Awaited<ReturnType<typeof generatedOutputs>>;
/** Internal ORDER PRODUCTION/POST only. Public quotes and QC/listening/delivery
 * remain separately closed; silent executors never consume these receipts. */
export class NativeOrderMediaPipeline extends GeneratedMediaPipeline {
  protected override readonly rendererVersion:string=NATIVE_ORDER_PIPELINE_VERSION;
  private speech:SpeechGateway;
  constructor(pool:pg.Pool,cfg:Config,store:ObjectStorage,gateway?:GenerationGateway,speech?:SpeechGateway){
    super(pool,cfg,store,gateway);requireThat(!speech||cfg.env==='test','TEST_PORT_FORBIDDEN','转写端口替身仅限显式测试',500);
    this.speech=speech??new SpeechGateway(pool,cfg,store);
  }
  protected override assertRoute(context:ExecutionContext):void{
    validateGenerationExecution(context.contract,true);const audio=frozenNativeAudio(context.contract);
    requireThat(audio&&context.snapshot.audio_policy.speech_mode==='NATIVE_ZH','MEDIA_ROUTE_UNAVAILABLE','原生声音执行器需要完整独立声音合同',503);
    const right=audio.rights.find(r=>r.kind==='MUSIC');
    requireThat(!audio.music||right?.media&&right.media.sha256===audio.music.binding.hash
      &&right.media.object_key.startsWith(`licensed-resources/${audio.music.binding.resource_version_id}/`),
      'AUDIO_MUSIC_MEDIA_UNAVAILABLE','许可配乐尚未绑定独立资源存储和实际字节',503);
  }
  private segments(context:ExecutionContext,material:Material):NativeSegment[]{
    return material.videoKeys.map((key,index)=>{
      const shot=context.contract.creative.shots[index],source=material.outputs.get(key)!;
      return {node_key:key,start_frame:context.snapshot.engine==='REFERENCE_FILM'?0:shot!.start_frame,
        end_frame:context.snapshot.engine==='REFERENCE_FILM'?context.snapshot.timeline.target_frames:shot!.end_frame,
        source_sha256:source.source.sha256,bytes:source.bytes};
    });
  }
  private async music(context:ExecutionContext){
    const audio=frozenNativeAudio(context.contract)!;if(!audio.music)return undefined;
    const right=audio.rights.find(r=>r.kind==='MUSIC')!;requireThat(right.media,'AUDIO_MUSIC_MEDIA_UNAVAILABLE','配乐没有实际媒体绑定',503);
    const bytes=await this.store.get(right.media.object_key,right.media.size_bytes);
    requireThat(bytes.length===right.media.size_bytes&&sha256(bytes)===right.media.sha256&&sha256(bytes)===right.binding.hash,
      'AUDIO_MUSIC_MEDIA_CHANGED','实际配乐字节与原许可/合同不一致',503);return {bytes,policy:audio.music};
  }
  async preflight(context:ExecutionContext):Promise<void>{
    this.assertRoute(context);await verifyNativeAudioLive(this.pool,context.contract);await this.music(context);
  }
  protected override async produce(context:ExecutionContext,operation:MediaOperation,directory:string,signal:AbortSignal,scope:ToolScope){
    // Reject an unavailable/replaced music resource before any paid generation.
    await this.music(context);return super.produce(context,operation,directory,signal,scope);
  }
  protected override async alternateGeneratedVideo(context:ExecutionContext,material:Material,directory:string,signal:AbortSignal){
    const made=await assembleNativeAudio(this.cfg,{directory,deadline_at:context.snapshot.deadline_at,signal,
      target_frames:context.snapshot.timeline.target_frames,segments:this.segments(context,material)});
    return {bytes:made.bytes,inspection:made.inspection,native_audio:{version:NATIVE_ORDER_MEDIA_VERSION,
      audio_contract_hash:hash(frozenNativeAudio(context.contract)),assembly:made.proof} satisfies NativeOrderAudio};
  }
  protected override async videoInspection(context:ExecutionContext,path:string,signal:AbortSignal):Promise<MediaInspection>{
    assertMediaAlive(context,signal);const actual=await inspectVideo(this.cfg,path,signal);
    requireThat(actual.codec==='h264'&&actual.pixelFormat==='yuv420p'&&actual.width===1080&&actual.height===1920&&actual.fps===30
      &&actual.frames===context.snapshot.timeline.target_frames&&actual.hasAudio&&['alac','aac'].includes(actual.audioCodec??''),
      'MEDIA_CONTRACT_FAILED','原生声音视频编码、完整帧数或实际音轨不符合原合同',422);return actual;
  }
  private async productionSource(db:Db,context:ExecutionContext,artifactId?:string,lock=false){
    const source=await operationArtifacts(db,context,'PRODUCTION'),videos=source.receipt.artifacts.filter(a=>a.spec.kind==='video').sort((a,b)=>a.slot_id.localeCompare(b.slot_id));
    const canonical=videos[0];requireThat(canonical?.spec.native_audio&&(!artifactId||canonical.id===artifactId)
      &&videos.every(a=>a.sha256===canonical.sha256&&a.spec.native_audio&&hash(a.spec.native_audio)===hash(canonical.spec.native_audio)),
      'AUDIO_SOURCE_SELECTION_INVALID','只能转写原制作清单的唯一完整整轨，不能选择其他成品或新来源',422);
    const write=(await db.query<{id:string}>(`SELECT id FROM private_object_writes WHERE tenant_id=$1 AND owner_id=$2 AND order_id=$3
      AND product_id=$4 AND object_key=$5 AND sha256=$6 AND kind='MEDIA' AND state='STORED' AND NOT delete_requested AND expires_at>now()${lock?' FOR SHARE':''}`,
      [context.tenantId,context.ownerId,context.orderId,context.snapshot.product_id,canonical.object_key,canonical.sha256])).rows[0];
    requireThat(write,'ASR_SOURCE_REVOKED','完整制作整轨缺少本订单的有效私有存储登记',410);return {...source,canonical,writeId:write.id};
  }
  private async lease(scope:ToolScope):Promise<StageLease>{
    requireThat(scope.scope_type==='ORDER'&&scope.order_id&&scope.scope_id===scope.order_id&&scope.role==='POST'&&scope.stage_name==='POST',
      'ASR_SCOPE_INVALID','整轨转写只接受原订单后期角色',403);
    const row=(await this.pool.query<StageLease>('SELECT * FROM stage_runs WHERE tenant_id=$1 AND id=$2',[scope.tenant_id,scope.stage_run_id])).rows[0];
    requireThat(row&&String(row.fencing_token)===String(scope.stage_fencing_token)&&row.scope_id===scope.order_id&&row.input_hash===scope.snapshot_hash,
      'LEASE_LOST','后期原租约已被接管或不属于原冻结合同',409);await assertLease(this.pool,row);return row;
  }
  async transcribe(scope:ToolScope,artifactId:string|undefined,signal:AbortSignal){
    const lease=await this.lease(scope),context=await executionContext(this.pool,scope.tenant_id,scope.order_id!,scope.snapshot_hash);
    this.assertRoute(context);const source=await this.productionSource(this.pool,context,artifactId);
    const directory=inside(this.cfg.runtimeRoot,`native-asr-inspect/${id('inspect')}`);await mkdir(directory,{recursive:true});
    try{
      await this.verify(context,source.receipt,directory,signal);
      const result=await submitSpeechNode(this.pool,this.speech,lease,source.writeId,signal);
      requireThat(result.state!=='FAILED','NATIVE_ASR_FAILED','原整轨转写已失败，不能重新购买或拿计划台词替代',503);
      if(result.state!=='SUCCEEDED')throw new PendingExternal(2,'NATIVE_ASR_PENDING');
      const original=await originalNativeTranscript(this.pool,this.store,context,result.submission_id,source.writeId);
      return {...original,submission_id:result.submission_id,source_artifact_id:source.canonical.id,source_write_id:source.writeId};
    }finally{await rm(directory,{recursive:true,force:true});}
  }
  protected override async post(context:ExecutionContext,operation:MediaOperation,source:MediaReceipt,directory:string,signal:AbortSignal,scope:ToolScope):Promise<PrivateArtifact[]>{
    const asr=await this.transcribe(scope,undefined,signal),audio=frozenNativeAudio(context.contract)!,original=source.artifacts.find(a=>a.id===asr.source_artifact_id)!;
    const path=join(directory,'native-source.mp4');await writeFile(path,await this.store.get(original.object_key,512_000_000),{flag:'wx'});
    const music=await this.music(context);let musicInput;
    if(music){const musicPath=join(directory,'licensed-music.media');await writeFile(musicPath,music.bytes,{flag:'wx'});
      musicInput={path:musicPath,binding:music.policy.binding,gain_db:music.policy.gain_db,ducking:music.policy.ducking,loop_to_timeline:music.policy.loop_to_timeline};}
    const final=await renderNativeAudioPost(this.pool,this.cfg,{directory,deadline_at:context.snapshot.deadline_at,signal,path,source_sha256:original.sha256,
      target_frames:audio.target_frames,resources:context.contract.resource_versions,transcript:asr.transcript,caption_style:audio.caption_style,...(musicInput?{music:musicInput}:{})});
    const native:NativeOrderAudio={version:NATIVE_ORDER_MEDIA_VERSION,audio_contract_hash:hash(audio),assembly:original.spec.native_audio!.assembly,
      post:{source_artifact_id:original.id,source_write_id:asr.source_write_id,asr_submission_id:asr.submission_id,transcript_file_sha256:asr.file_sha256,
        transcript_hash:hash(asr.transcript),kernel:final.proof}};
    const artifacts:PrivateArtifact[]=[];
    for(const slot of requiredSlots(context,'POST')){
      assertMediaAlive(context,signal);
      if(slot.kind==='copy'){
        const bytes=Buffer.from(context.contract.creative.copy,'utf8');artifacts.push(await this.artifact(context,operation,slot.slot_id,bytes,
          this.spec(context,'POST','copy',{kind:'copy',bytes:bytes.length,encoding:'utf-8'},[])));continue;
      }
      const input=source.artifacts.find(a=>a.slot_id===slot.slot_id)!,raw=await this.store.get(input.object_key,slot.kind==='video'?512_000_000:30_000_000);
      requireThat(sha256(raw)===input.sha256,'ARTIFACT_HASH_MISMATCH','原制作文件在有声后期期间发生变化',503);
      const bytes=slot.kind==='video'?final.bytes:await sharp(raw,{limitInputPixels:4_000_000,failOn:'warning'}).png({compressionLevel:9}).toBuffer();
      const spec=this.spec(context,'POST',slot.kind,slot.kind==='video'?final.inspection:await inspectImage(bytes),input.spec.source_asset_ids,[input.id]);
      requireThat(input.spec.generation_sources&&input.spec.reference_approval_hash,'GENERATED_PACK_SOURCE_INVALID','有声后期缺少原生成来源与参考核验',503);
      spec.generation_sources=input.spec.generation_sources;spec.reference_approval_hash=input.spec.reference_approval_hash;
      if(slot.kind==='video')spec.native_audio=native;artifacts.push(await this.artifact(context,operation,slot.slot_id,bytes,spec));
    }
    return artifacts;
  }
  private async bindings(db:Db,context:ExecutionContext,receipt:MediaReceipt,lock=false){
    const audio=frozenNativeAudio(context.contract)!;await verifyNativeAudioLive(db,context.contract,lock);
    const source=receipt.phase==='POST'?await this.productionSource(db,context,undefined,lock):undefined;
    for(const a of receipt.artifacts){
      if(a.spec.kind!=='video'){requireThat(!a.spec.native_audio,'AUDIO_MEDIA_PROOF_INVALID','非视频产物不能携带声音凭据',503);continue;}
      const p=a.spec.native_audio;
      requireThat(p?.version===NATIVE_ORDER_MEDIA_VERSION&&p.audio_contract_hash===hash(audio)&&p.assembly.target_frames===audio.target_frames
        &&(receipt.phase==='POST'?!!p.post:!p.post),'AUDIO_MEDIA_PROOF_INVALID','产物缺少本单声音合同或阶段凭据',503);
      if(source){
        const post=p.post!,original=await originalNativeTranscript(db,this.store,context,post.asr_submission_id,source.writeId);
        requireThat(post.source_artifact_id===source.canonical.id&&post.source_write_id===source.writeId&&original.source_sha256===source.canonical.sha256
          &&hash(p.assembly)===hash(source.canonical.spec.native_audio!.assembly)&&post.transcript_file_sha256===original.file_sha256
          &&post.transcript_hash===hash(original.transcript)&&post.kernel.source_sha256===source.canonical.sha256&&post.kernel.output_sha256===a.sha256
          &&post.kernel.transcript_hash===post.transcript_hash&&post.kernel.caption_style===audio.caption_style
          &&hash(post.kernel.font_binding)===hash(audio.font)&&hash(post.kernel.native_audio)===hash(original.audio)
          &&(audio.music?post.kernel.music&&hash(post.kernel.music.binding)===hash(audio.music.binding)&&post.kernel.music.gain_db===audio.music.gain_db
            &&post.kernel.music.ducking===audio.music.ducking&&post.kernel.music.loop_to_timeline===audio.music.loop_to_timeline:post.kernel.music===null),
          'AUDIO_MEDIA_PROOF_INVALID','后期没有绑定原整轨、原转写、字幕/配乐和实际成品',503);
      }else requireThat(p.assembly.output_sha256===a.sha256,'AUDIO_MEDIA_PROOF_INVALID','组装证明不属于实际制作文件',503);
    }
    return source;
  }
  override async verify(context:ExecutionContext,receipt:MediaReceipt,directory:string,signal:AbortSignal,selected?:ReadonlySet<string>):Promise<void>{
    await super.verify(context,receipt,directory,signal,selected);const source=await this.bindings(this.pool,context,receipt);
    const material=await this.material(this.pool,context,receipt),segments=this.segments(context,material),verified=new Set<string>();
    for(const a of receipt.artifacts.filter(a=>a.spec.kind==='video'&&(!selected||selected.has(a.id)))){
      const proof=a.spec.native_audio!,input=source?.canonical??a,token=hash({sha:input.sha256,assembly:proof.assembly});
      if(!verified.has(token)){
        await verifyNativeAssembly(this.cfg,{directory,deadline_at:context.snapshot.deadline_at,signal,target_frames:context.snapshot.timeline.target_frames,
          segments,bytes:await this.store.get(input.object_key,512_000_000),proof:proof.assembly});verified.add(token);
      }
      if(source){
        const path=join(directory,`${id('encoded')}.mp4`),bytes=await this.store.get(a.object_key,512_000_000);await writeFile(path,bytes,{flag:'wx'});
        const decoded=await decodeNativeAudio(this.cfg,{directory,deadline_at:context.snapshot.deadline_at,signal,path,source_sha256:a.sha256,target_frames:context.snapshot.timeline.target_frames});
        const original=await originalNativeTranscript(this.pool,this.store,context,proof.post!.asr_submission_id,source.writeId);
        const captions=compileNativeCaptions(original.transcript,original.audio,await loadProductionFont(this.cfg.projectRoot),frozenNativeAudio(context.contract)!.caption_style);
        requireThat(decoded.evidence.codec==='aac'&&hash(decoded.evidence)===hash(proof.post!.kernel.encoded_audio)
          &&sha256(captions.script)===proof.post!.kernel.caption_script_sha256,'AUDIO_MEDIA_PROOF_INVALID','实际交付音轨或字幕与原后期证据不一致',503);
      }
    }
  }
  override async execute(scope:ToolScope,intent:ToolLease,phase:'PRODUCTION'|'POST',signal:AbortSignal){
    const output=await super.execute(scope,intent,phase,signal);
    return {...output,commit:async(db:pg.PoolClient)=>{
      const context=await executionContext(db,scope.tenant_id,scope.order_id!,scope.snapshot_hash);await this.bindings(db,context,output.receipt,true);await output.commit(db);
    }};
  }
}
