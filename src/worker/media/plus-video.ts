import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import sharp from 'sharp';
import type {VariantSource} from '../../api/modules/catalog.js';
import type {CreativePlan} from '../compiler/plan.js';
import type {AiDisclosureContract} from '../compiler/disclosure.js';
import {frozenAiDisclosure} from '../compiler/disclosure.js';
import type {ProductionFont} from './font.js';
import {loadProductionFont} from './font.js';
import {rasterLayoutText,wrapLayoutText,type TextRaster} from './text-layout.js';
import {STYLES} from './layout.js';
import {plusVideoBinding,plusVideoNeedsListening,PLUS_VIDEO_VERSION,PLUS_VIDEO_PIXELS} from '../../shared/domain/plus-video.js';
import {requireThat} from '../../api/lib/errors.js';
import {sha256} from '../../api/lib/crypto.js';
import {nativeCommand,inspectVideo,type MediaInspection} from './native.js';
import {PhotoMediaPipeline,assertMediaAlive,inspectImage} from './photo-pipeline.js';
import {disclosureRaster,markDisclosureImage,inspectDisclosure} from './disclosure.js';
import type {ExecutionContext} from '../compiler/order-context.js';
import type {MediaOperation,MediaReceipt,PrivateArtifact} from './artifacts.js';
import type {ToolScope} from '../tool-gateway/http.js';

import {preparePlusVideoText} from './plus-video-layout.js';

export class PlusVideoMediaPipeline extends PhotoMediaPipeline{
  protected override version():string{return PLUS_VIDEO_VERSION;}
  protected override pixelLimit():number{return PLUS_VIDEO_PIXELS;}
  protected override assertRoute(c:ExecutionContext):void{requireThat(!!plusVideoBinding(c.contract.source)&&c.snapshot.engine==='PHOTO_LAYOUT'
    &&c.snapshot.audio_policy.speech_mode==='NONE','PLUS_VIDEO_ROUTE_INVALID','视频编辑只执行已冻结的原片选段，不购买新视频或配音',503);}
  protected override async videoInspection(c:ExecutionContext,path:string,signal:AbortSignal):Promise<MediaInspection>{
    assertMediaAlive(c,signal);const b=plusVideoBinding(c.contract.source)!,actual=await inspectVideo(this.cfg,path,signal),audio=plusVideoNeedsListening(c.contract.source);
    requireThat(actual.codec==='h264'&&actual.pixelFormat==='yuv420p'&&actual.width===b.settings.canvas.width&&actual.height===b.settings.canvas.height
      &&actual.fps===30&&actual.frames===c.snapshot.timeline.target_frames&&actual.hasAudio===audio&&(!audio||actual.audioCodec==='aac')
      &&actual.durationSeconds!==null&&Math.abs(actual.durationSeconds-c.snapshot.timeline.target_frames/30)<=.12,
      'PLUS_VIDEO_SPEC_INVALID','实际视频尺寸、帧数或原声选择与已确认清单不一致',422);
    await nativeCommand(this.cfg,process.env.FFMPEG_PATH?.trim()||'ffmpeg',['-hide_banner','-loglevel','error','-xerror','-nostdin','-threads','2',
      '-protocol_whitelist','file,pipe','-i',path,'-map','0:v:0','-map','0:a:0?','-f','null','-'],
      {cwd:this.cfg.runtimeRoot,timeoutMs:Math.max(1,Math.min(120000,Date.parse(c.snapshot.deadline_at)-Date.now())),signal});return actual;
  }
  override async verify(c:ExecutionContext,receipt:MediaReceipt,directory:string,signal:AbortSignal,selected?:ReadonlySet<string>):Promise<void>{
    await super.verify(c,receipt,directory,signal,selected);
    const policy=frozenAiDisclosure(c.contract);if(!policy)return;
    for(const a of receipt.artifacts){if(selected&&!selected.has(a.id)||a.spec.kind==='copy')continue;
      const bytes=await this.store.get(a.object_key,a.spec.kind==='video'?512000000:30000000),b=plusVideoBinding(c.contract.source)!;
      const proof=await inspectDisclosure(this.cfg,policy,bytes,{kind:a.spec.kind,width:b.settings.canvas.width,height:b.settings.canvas.height,
        frames:a.spec.kind==='video'?c.snapshot.timeline.target_frames:1,directory:join(directory,'disclosure-'+a.id),deadline_at:c.snapshot.deadline_at,signal});
      requireThat(a.spec.ai_disclosure&&JSON.stringify(a.spec.ai_disclosure)===JSON.stringify(proof),'AI_DISCLOSURE_PROOF_INVALID','视频编辑未完整保留AI来源标识',503);
    }
  }
  protected override async produce(c:ExecutionContext,operation:MediaOperation,directory:string,signal:AbortSignal,_scope:ToolScope):Promise<PrivateArtifact[]>{
    const b=plusVideoBinding(c.contract.source)!,font=await loadProductionFont(this.cfg.projectRoot),policy=frozenAiDisclosure(c.contract);
    const layout=await preparePlusVideoText({source:c.contract.source,plan:c.contract.creative,presetId:c.snapshot.preset_id,font,...(policy?{disclosure:policy}:{})});
    const source=await this.store.get(b.source_object_key,512000000);
    requireThat(source.length===b.source_bytes&&sha256(source)===b.source_sha256,'PLUS_SOURCE_BYTES_CHANGED','原视频实际字节与已确认来源不一致',503);
    const input=join(directory,'source.mp4'),frame=join(directory,'frame.png'),output=join(directory,'edited.mp4');await writeFile(input,source,{flag:'wx'});
    const original=await inspectVideo(this.cfg,input,signal);
    requireThat(original.width===b.source_width&&original.height===b.source_height&&original.frames===b.source_frames&&original.fps===b.source_fps
      &&original.hasAudio===b.source_has_audio&&original.codec==='h264'&&original.pixelFormat==='yuv420p',
      'PLUS_VIDEO_SOURCE_CHANGED','原视频实际解码规格或音轨与冻结证明不一致',503);
    const frameBytes=policy?await markDisclosureImage(layout.frame,await disclosureRaster(this.cfg,policy,layout.width,layout.height),PLUS_VIDEO_PIXELS):layout.frame;
    await writeFile(frame,frameBytes,{flag:'wx'});
    const crop=b.settings.crop,x=Math.floor(crop.x*b.source_width/2)*2,y=Math.floor(crop.y*b.source_height/2)*2;
    const width=Math.max(2,Math.min(b.source_width-x,Math.round(crop.width*b.source_width/2)*2)),height=Math.max(2,Math.min(b.source_height-y,Math.round(crop.height*b.source_height/2)*2));
    const args=['-hide_banner','-loglevel','error','-xerror','-nostdin','-y','-filter_complex_threads','1','-threads','2','-protocol_whitelist','file,pipe','-i',input,
      '-threads','1','-loop','1','-framerate','30','-i',frame];
    const filters=[`[0:v:0]trim=start_frame=${b.settings.trim.start_frame}:end_frame=${b.settings.trim.end_frame},setpts=PTS-STARTPTS,crop=${width}:${height}:${x}:${y},scale=${layout.videoWidth}:${layout.videoHeight}:force_original_aspect_ratio=decrease:force_divisible_by=2,pad=${layout.videoWidth}:${layout.videoHeight}:(ow-iw)/2:(oh-ih)/2,setsar=1[v]`,
      `[1:v:0][v]overlay=${layout.margin}:${layout.videoTop}:shortest=1[base]`];
    let label='base';
    for(const [i,cue] of layout.cues.entries()){
      const path=join(directory,`caption-${i}.png`);await writeFile(path,cue.png,{flag:'wx'});
      args.push('-threads','1','-loop','1','-framerate','30','-i',path);
      const next=`caption${i}`;filters.push(`[${label}][${i+2}:v:0]overlay=${layout.margin}:${layout.captionTop}:shortest=1:enable='gte(t,${cue.start_frame/30})*lt(t,${cue.end_frame/30})'[${next}]`);label=next;
    }
    if(plusVideoNeedsListening(c.contract.source))filters.push(`[0:a:0]aresample=48000,aformat=channel_layouts=stereo,atrim=start_sample=${b.settings.trim.start_frame*1600}:end_sample=${b.settings.trim.end_frame*1600},asetpts=PTS-STARTPTS,apad=whole_len=${c.snapshot.timeline.target_frames*1600},atrim=end_sample=${c.snapshot.timeline.target_frames*1600}[audio]`);
    args.push('-filter_complex',filters.join(';'),'-map',`[${label}]`);
    if(plusVideoNeedsListening(c.contract.source))args.push('-map','[audio]','-c:a','aac','-b:a','192k');else args.push('-an');
    args.push('-map_metadata','-1','-map_chapters','-1','-frames:v',String(c.snapshot.timeline.target_frames),'-t',String(c.snapshot.timeline.target_frames/30),
      '-c:v','libx264','-threads','2','-preset','veryfast','-crf','20','-r','30','-pix_fmt','yuv420p','-movflags','+faststart',output);
    await nativeCommand(this.cfg,process.env.FFMPEG_PATH?.trim()||'ffmpeg',args,{cwd:directory,timeoutMs:Math.max(1,Math.min(240000,Date.parse(c.snapshot.deadline_at)-Date.now())),signal});
    const bytes=await readFile(output),inspection=await this.videoInspection(c,output,signal),spec=this.spec(c,'PRODUCTION','video',inspection,[b.source_artifact_id]);
    if(policy)spec.ai_disclosure=await inspectDisclosure(this.cfg,policy,bytes,{kind:'video',width:layout.width,height:layout.height,frames:c.snapshot.timeline.target_frames,
      directory:join(directory,'video-disclosure'),deadline_at:c.snapshot.deadline_at,signal});
    const coverPath=join(directory,'cover.png');await nativeCommand(this.cfg,process.env.FFMPEG_PATH?.trim()||'ffmpeg',
      ['-hide_banner','-loglevel','error','-nostdin','-threads','2','-protocol_whitelist','file,pipe','-i',output,'-frames:v','1','-threads','1',coverPath],
      {cwd:directory,timeoutMs:30000,signal});
    const cover=await readFile(coverPath),coverSpec=this.spec(c,'PRODUCTION','image',await inspectImage(cover,PLUS_VIDEO_PIXELS),[b.source_artifact_id]);
    if(policy)coverSpec.ai_disclosure=await inspectDisclosure(this.cfg,policy,cover,{kind:'image',width:layout.width,height:layout.height,frames:1,
      directory:join(directory,'cover-disclosure'),deadline_at:c.snapshot.deadline_at,signal});
    return [await this.artifact(c,operation,'plus-video',bytes,spec),await this.artifact(c,operation,'plus-video-cover',cover,coverSpec)];
  }
  protected override async post(c:ExecutionContext,operation:MediaOperation,source:MediaReceipt,directory:string,signal:AbortSignal,_scope:ToolScope):Promise<PrivateArtifact[]>{
    const artifacts:PrivateArtifact[]=[];
    for(const slot of c.snapshot.outputs){assertMediaAlive(c,signal);
      if(slot.kind==='copy'){const bytes=Buffer.from(c.contract.creative.copy);artifacts.push(await this.artifact(c,operation,slot.slot_id,bytes,
        this.spec(c,'POST','copy',{kind:'copy',bytes:bytes.length,encoding:'utf-8'},[])));continue;}
      const original=source.artifacts.find(a=>a.slot_id===slot.slot_id)!;let bytes=await this.store.get(original.object_key,slot.kind==='video'?512000000:30000000);
      let inspection=original.spec.inspection;
      if(slot.kind==='video'){const input=join(directory,'production.mp4'),output=join(directory,'final.mp4');await writeFile(input,bytes,{flag:'wx'});
        await nativeCommand(this.cfg,process.env.FFMPEG_PATH?.trim()||'ffmpeg',['-hide_banner','-loglevel','error','-nostdin','-threads','2','-protocol_whitelist','file,pipe','-i',input,
          '-map','0:v:0','-map','0:a:0?','-map_metadata','-1','-map_chapters','-1','-c','copy','-movflags','+faststart',output],{cwd:directory,timeoutMs:60000,signal});
        bytes=await readFile(output);inspection=await this.videoInspection(c,output,signal);}
      const spec=this.spec(c,'POST',slot.kind,inspection,original.spec.source_asset_ids,[original.id]);
      if(original.spec.ai_disclosure)spec.ai_disclosure=original.spec.ai_disclosure;
      artifacts.push(await this.artifact(c,operation,slot.slot_id,bytes,spec));
    }return artifacts;
  }
}
