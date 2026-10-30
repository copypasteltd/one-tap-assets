import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import type {Config} from '../../api/config.js';
import {requireThat} from '../../api/lib/errors.js';
import type {GenerationContext} from './scope.js';
import type {generatedOutputs} from './outputs.js';
import {frozenAiDisclosure} from '../compiler/disclosure.js';
import {disclosureRaster} from '../media/disclosure.js';
import {nativeCommand,inspectVideo} from '../media/native.js';

/** Only actual generated MP4 inputs are accepted; no still-image substitute. */
export async function assembleSilentGeneratedVideo(cfg:Config,context:GenerationContext,
  material:Awaited<ReturnType<typeof generatedOutputs>>,directory:string,signal:AbortSignal):Promise<Buffer>{
  const clips=join(directory,'generated-clips');await mkdir(clips,{recursive:true});
  const mark=await disclosureRaster(cfg,frozenAiDisclosure(context.contract)!,1080,1920);
  await writeFile(join(clips,'disclosure.png'),mark.png);
  for(const [index,key] of material.videoKeys.entries()){
    const input=join(clips,`input${index}.mp4`),output=join(clips,`segment${index}.mp4`);
    const frames=context.snapshot.engine==='REFERENCE_FILM'?context.snapshot.timeline.target_frames:
      context.contract.creative.shots[index]!.end_frame-context.contract.creative.shots[index]!.start_frame;
    await writeFile(input,material.outputs.get(key)!.bytes);
    await nativeCommand(cfg,process.env.FFMPEG_PATH?.trim()||'ffmpeg',['-v','error','-nostdin','-y','-threads','2','-filter_threads','1',
      '-filter_complex_threads','1','-protocol_whitelist','file,pipe','-i',input,'-i',join(clips,'disclosure.png'),
      '-filter_complex',`[0:v]fps=30,scale=1080:1920:flags=lanczos,setsar=1[base];[base][1:v]overlay=${mark.left}:${mark.top}:eof_action=repeat:format=auto[marked]`,
      '-map','[marked]','-an','-frames:v',String(frames),'-map_metadata','-1','-map_chapters','-1','-c:v','libx264','-threads','2',
      '-preset','veryfast','-crf','20','-pix_fmt','yuv420p',output],
      {cwd:clips,timeoutMs:Math.max(1,Math.min(180000,Date.parse(context.snapshot.deadline_at)-Date.now())),signal});
    const actual=await inspectVideo(cfg,output,signal);
    requireThat(actual.frames===frames&&actual.fps===30&&!actual.hasAudio,'GENERATION_TIMELINE_INVALID','生成视频不足以组成冻结镜头帧数',422);
  }
  const list=join(clips,'concat.txt'),final=join(clips,'assembled.mp4');
  await writeFile(list,material.videoKeys.map((_,i)=>`file 'segment${i}.mp4'`).join('\n')+'\n');
  await nativeCommand(cfg,process.env.FFMPEG_PATH?.trim()||'ffmpeg',['-v','error','-nostdin','-y','-protocol_whitelist','file,pipe','-f','concat',
    '-safe','1','-i',list,'-map','0:v:0','-an','-c:v','copy','-map_metadata','-1','-map_chapters','-1','-movflags','+faststart',final],
    {cwd:clips,timeoutMs:Math.max(1,Math.min(120000,Date.parse(context.snapshot.deadline_at)-Date.now())),signal});
  return readFile(final);
}
