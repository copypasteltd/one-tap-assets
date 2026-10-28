import {hash} from '../../api/lib/crypto.js';
import {requireThat} from '../../api/lib/errors.js';
import type {ProductionFont} from './font.js';
import {NATIVE_AUDIO_POLICY,nativeAudioHash,type NativeAudioEvidence} from './native-audio.js';

export type CaptionStyle='standard'|'bold'|'minimal'|'karaoke';
export interface TranscriptWord {start_ms:number;end_ms:number;text:string}
export interface NativeTranscript {
  version:'YPCC-ACTUAL-AUDIO-TRANSCRIPT-1';source_sha256:string;pcm_sha256:string;audio_evidence_hash:string;language:'zh-CN';
  recognizer:{provider:string;actual_model:string;registry_version:string;rate_snapshot_id:string;original_receipt_sha256:string};
  segments:{start_ms:number;end_ms:number;text:string;words?:TranscriptWord[]}[];
}
const digest=(s:unknown)=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);
const sameText=(s:string)=>s.normalize('NFC').replace(/\s/gu,'');
function captionText(text:unknown,font:ProductionFont):asserts text is string{
  requireThat(typeof text==='string'&&text.trim().length>0&&[...text].length<=48
    &&!/[\p{Cc}\p{Cf}\\{}]/u.test(text),'CAPTION_TEXT_INVALID','字幕不能为空、过长或包含控制与ASS指令',422);
  requireThat([...text].every(c=>font.supports(c.codePointAt(0)!)),'CAPTION_GLYPH_UNAVAILABLE','固定字幕字体不支持实际转写字符',422);
}
/** This checks binding/timing only. A receipt hash supplied by a caller is not
 * recognizer admission. Production must load the original durable ASR receipt
 * and obtain independent listening review before this can fulfil an order. */
export function validateNativeTranscript(value:NativeTranscript,audio:NativeAudioEvidence,font:ProductionFont,style:CaptionStyle):void{
  requireThat(['standard','bold','minimal','karaoke'].includes(style),'CAPTION_STYLE_INVALID','字幕风格不在冻结词表',422);
  requireThat(value&&audio.policy===NATIVE_AUDIO_POLICY&&value.version==='YPCC-ACTUAL-AUDIO-TRANSCRIPT-1'&&value.language==='zh-CN'
    &&value.source_sha256===audio.source_sha256&&value.pcm_sha256===audio.pcm_sha256&&value.audio_evidence_hash===nativeAudioHash(audio),
    'AUDIO_TRANSCRIPT_BINDING_INVALID','转写不属于本次实际原声音轨',422);
  const recognizer=value.recognizer;
  requireThat(recognizer&&[recognizer.provider,recognizer.actual_model,recognizer.registry_version,recognizer.rate_snapshot_id]
    .every(s=>typeof s==='string'&&s.length>0&&s.length<=160)&&digest(recognizer.original_receipt_sha256),
    'AUDIO_TRANSCRIPT_PROVENANCE_INVALID','转写缺少原识别器、模型、费率或回执摘要',422);
  requireThat(Array.isArray(value.segments)&&value.segments.length>=1&&value.segments.length<=300,
    'AUDIO_TRANSCRIPT_TIMELINE_INVALID','实际转写片段数量无效',422);
  let previous=0,characters=0;
  for(const segment of value.segments){
    requireThat(segment&&typeof segment==='object','AUDIO_TRANSCRIPT_TIMELINE_INVALID','实际转写片段结构无效',422);
    captionText(segment.text,font);characters+=[...segment.text].length;
    requireThat(Number.isSafeInteger(segment.start_ms)&&Number.isSafeInteger(segment.end_ms)&&segment.start_ms>=previous
      &&segment.end_ms-segment.start_ms>=100&&segment.end_ms<=audio.duration_ms,
      'AUDIO_TRANSCRIPT_TIMELINE_INVALID','实际转写时间码越界、重叠或不足100毫秒',422);
    const active=audio.windows.reduce((sum,w)=>sum+(w.rms_dbfs!==null&&w.rms_dbfs>=-60
      ?Math.max(0,Math.min(w.end_ms,segment.end_ms)-Math.max(w.start_ms,segment.start_ms)):0),0);
    requireThat(active/(segment.end_ms-segment.start_ms)>=0.5,'AUDIO_TRANSCRIPT_NO_SIGNAL','字幕主要落在原声无信号区域',422);
    if(style==='karaoke'||segment.words!==undefined){
      requireThat(Array.isArray(segment.words)&&segment.words.length>=1&&segment.words.length<=48,
        'CAPTION_WORD_TIMES_REQUIRED','逐字字幕必须提供实际识别词级时间码',422);
      let wordEnd=segment.start_ms;
      for(const word of segment.words){
        requireThat(word&&typeof word==='object','CAPTION_WORD_TIMES_INVALID','实际识别词级结构无效',422);
        captionText(word.text,font);
        requireThat(Number.isSafeInteger(word.start_ms)&&Number.isSafeInteger(word.end_ms)&&word.start_ms>=wordEnd
          &&word.end_ms-word.start_ms>=10&&word.end_ms<=segment.end_ms,'CAPTION_WORD_TIMES_INVALID','实际识别词级时间码重叠或越界',422);
        wordEnd=word.end_ms;
      }
      requireThat(sameText(segment.words.map(w=>w.text).join(''))===sameText(segment.text),
        'CAPTION_WORD_TEXT_INVALID','词级文本与实际转写句不一致',422);
    }
    previous=segment.end_ms;
  }
  requireThat(characters<=6000,'CAPTION_TEXT_INVALID','实际转写总长度超过上限',422);
}
const centiseconds=(ms:number)=>Math.round(ms/10);
function time(ms:number):string{
  const cs=centiseconds(ms);return `${Math.floor(cs/360000)}:${String(Math.floor(cs/6000)%60).padStart(2,'0')}:${String(Math.floor(cs/100)%60).padStart(2,'0')}.${String(cs%100).padStart(2,'0')}`;
}
export function compileNativeCaptions(transcript:NativeTranscript,audio:NativeAudioEvidence,font:ProductionFont,style:CaptionStyle):{script:string;transcript_hash:string}{
  validateNativeTranscript(transcript,audio,font,style);
  const size=style==='bold'?78:style==='minimal'?54:64,outline=style==='minimal'?1:3;
  const script=['[Script Info]','ScriptType: v4.00+','PlayResX: 1080','PlayResY: 1920','WrapStyle: 0','ScaledBorderAndShadow: yes',
    '[V4+ Styles]','Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    `Style: Caption,Noto Sans SC,${size},&H00FFFFFF,&H000093FF,&H00142F20,&H99000000,${style==='bold'?-1:0},0,0,0,100,100,0,0,1,${outline},1,2,80,80,190,1`,
    'Style: Label,Noto Sans SC,30,&H00FFFFFF,&H00FFFFFF,&H00142F20,&H99000000,0,0,0,0,100,100,0,0,1,2,0,9,48,48,56,1',
    '[Events]','Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
    `Dialogue: 0,${time(0)},${time(audio.target_frames*1000/30)},Label,,0,0,0,,AI 演绎`];
  for(const segment of transcript.segments){
    let text=segment.text;
    if(style==='karaoke'){
      let last=centiseconds(segment.start_ms);text='';
      for(const word of segment.words!){
        const start=centiseconds(word.start_ms),end=centiseconds(word.end_ms),gap=start-last;
        if(gap)text+=`{\\k${gap}}\\h`;
        text+=`{\\k${end-start}}${word.text}`;last=end;
      }
    }
    script.push(`Dialogue: 1,${time(segment.start_ms)},${time(segment.end_ms)},Caption,,0,0,0,,${text}`);
  }
  return {script:script.join('\n')+'\n',transcript_hash:hash(transcript)};
}
