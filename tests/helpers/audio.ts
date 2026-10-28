import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import sharp from 'sharp';
import type {Config} from '../../src/api/config.js';
import {sha256} from '../../src/api/lib/crypto.js';
import {loadProductionFont} from '../../src/worker/media/font.js';
import {nativeCommand} from '../../src/worker/media/native.js';
import {decodeNativeAudio,nativeAudioHash} from '../../src/worker/media/native-audio.js';
import type {NativeTranscript} from '../../src/worker/media/native-captions.js';

/** Purely synthetic tones and manually assigned Chinese timing fixtures. No
 * speech, external recognition, customer media or provider billing is implied. */
export async function syntheticAudioFixture(cfg:Config,directory:string){
  await mkdir(directory,{recursive:true});const font=await loadProductionFont(cfg.projectRoot);
  const text=await sharp({text:{text:'<span foreground="#F7F3E7">一品成片 · 音频后期内核\n合成提示音 / 人工时间码夹具\n不是中文语音转写或口播样片</span>',fontfile:font.path,font:'Noto Sans SC 42',rgba:true,
    width:920,align:'centre',spacing:30}}).png().toBuffer();
  const poster=await sharp({create:{width:1080,height:1920,channels:3,background:'#193C2C'}})
    .composite([{input:text,top:180,left:80},{input:Buffer.from('<svg width="600" height="600"><rect x="100" y="60" width="400" height="500" rx="76" fill="#F6A04B"/><rect x="160" y="5" width="280" height="100" rx="28" fill="#F7F3E7"/><circle cx="300" cy="310" r="100" fill="#F7F3E7"/></svg>'),top:700,left:240}])
    .png().toBuffer();await writeFile(join(directory,'poster.png'),poster,{flag:'wx'});
  const path=join(directory,'source.mp4'),musicPath=join(directory,'music.wav');
  const cmd=process.env.FFMPEG_PATH?.trim()||'ffmpeg';
  await nativeCommand(cfg,cmd,['-v','error','-nostdin','-n','-threads','2','-loop','1','-framerate','30','-i',join(directory,'poster.png'),
    '-f','lavfi','-i',"aevalsrc='if(between(t,0.5,1.5)+between(t,2.5,3.5),0.25*sin(2*PI*660*t),0)':s=48000:d=4",
    '-map','0:v:0','-map','1:a:0','-t','4','-frames:v','120','-c:v','libx264','-threads','2','-preset','veryfast','-pix_fmt','yuv420p',
    '-c:a','aac','-b:a','192k','-ac','2','-movflags','+faststart',path],{cwd:directory,timeoutMs:60000});
  await nativeCommand(cfg,cmd,['-v','error','-nostdin','-n','-f','lavfi','-i','sine=frequency=220:sample_rate=48000:duration=4',
    '-ac','2','-c:a','pcm_s16le',musicPath],{cwd:directory,timeoutMs:30000});
  const source_sha256=sha256(await readFile(path)),execution={directory,deadline_at:new Date(Date.now()+120000).toISOString(),signal:new AbortController().signal};
  const decoded=await decodeNativeAudio(cfg,{...execution,path,source_sha256,target_frames:120});
  const transcript:NativeTranscript={version:'YPCC-ACTUAL-AUDIO-TRANSCRIPT-1',source_sha256,pcm_sha256:decoded.evidence.pcm_sha256,
    audio_evidence_hash:nativeAudioHash(decoded.evidence),language:'zh-CN',recognizer:{provider:'SYNTHETIC_MANUAL_TIMING_NOT_ASR',actual_model:'NO_REAL_RECOGNIZER',
      registry_version:'TEST_ONLY',rate_snapshot_id:'NO_PAID_CALL',original_receipt_sha256:sha256('synthetic manually bound tone timing fixture')},
    segments:[{start_ms:550,end_ms:1450,text:'原声音轨',words:[{start_ms:550,end_ms:950,text:'原声'},{start_ms:950,end_ms:1450,text:'音轨'}]},
      {start_ms:2550,end_ms:3450,text:'时间码字幕',words:[{start_ms:2550,end_ms:2950,text:'时间码'},{start_ms:2950,end_ms:3450,text:'字幕'}]}]};
  return {path,musicPath,source_sha256,decoded,transcript,font,poster};
}
