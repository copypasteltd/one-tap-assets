import Ajv2020 from 'ajv/dist/2020.js';
import {isIP} from 'node:net';
import type {Config} from '../../api/config.js';
import {hash} from '../../api/lib/crypto.js';
import {AppError,requireThat} from '../../api/lib/errors.js';
import {safeHttp,type HttpResponse} from '../../api/lib/http.js';
import {object} from '../../shared/domain/json.js';
import type {NativeAudioEvidence} from '../media/native-audio.js';
import type {NativeTranscript,TranscriptWord} from '../media/native-captions.js';

export const ASR_DOCUMENTATION='https://help.aliyun.com/zh/model-studio/qwen-asr-api-reference';
export interface SpeechContract {
  version:'YPCC-DASHSCOPE-FILETRANS-1';provider:'ALIYUN_DASHSCOPE';state:'ADMITTED';
  model_version_id:string;request_model:'qwen3-asr-flash-filetrans';actual_model:string;registry_version:string;rate_snapshot_id:string;
  base_url:string;official_documentation:typeof ASR_DOCUMENTATION;capability_evidence_sha256:string;valid_until:string;
  input_hosts:string[];result_hosts:string[];max_response_bytes:number;max_queries:number;poll_seconds:number;
  max_audio_seconds:number;rate:{unit:'AUDIO_SECOND';micro_per_million_units:number;max_billable_units:number;ceiling_micro:number};
}
const s={type:'string',minLength:1,maxLength:200};
const n=(minimum:number,maximum:number)=>({type:'integer',minimum,maximum});
const exact=(properties:Record<string,unknown>)=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
const hosts={type:'array',minItems:1,maxItems:8,uniqueItems:true,items:{type:'string',pattern:'^[a-z0-9.-]{1,253}$'}};
const valid=new Ajv2020({strict:false}).compile<SpeechContract>(exact({version:{const:'YPCC-DASHSCOPE-FILETRANS-1'},provider:{const:'ALIYUN_DASHSCOPE'},state:{const:'ADMITTED'},
  model_version_id:s,request_model:{const:'qwen3-asr-flash-filetrans'},actual_model:s,registry_version:s,rate_snapshot_id:s,base_url:{type:'string',maxLength:1000},
  official_documentation:{const:ASR_DOCUMENTATION},capability_evidence_sha256:{type:'string',pattern:'^[a-f0-9]{64}$'},valid_until:s,
  input_hosts:hosts,result_hosts:hosts,max_response_bytes:n(1000,4_000_000),max_queries:n(1,720),poll_seconds:n(1,60),max_audio_seconds:n(1,120),
  rate:exact({unit:{const:'AUDIO_SECOND'},micro_per_million_units:n(1,1_000_000_000_000),max_billable_units:n(1,120),ceiling_micro:n(1,1_000_000_000)})}));
export function speechCost(c:SpeechContract,seconds:number):number {
  requireThat(Number.isSafeInteger(seconds)&&seconds>=0&&seconds<=c.rate.max_billable_units,'ASR_USAGE_INVALID','转写实际秒数缺失或超出冻结上界',503);
  const cost=Number((BigInt(seconds)*BigInt(c.rate.micro_per_million_units)+999999n)/1000000n);
  requireThat(Number.isSafeInteger(cost)&&cost<=c.rate.ceiling_micro,'ASR_COST_BOUND_VIOLATED','转写费用超出原预留',503);return cost;
}
export function speechUrl(value:string,allowed:readonly string[]):URL {
  let u:URL;try{u=new URL(value);}catch{requireThat(false,'ASR_URL_INVALID','转写地址无效',503);}
  requireThat(u.protocol==='https:'&&!u.username&&!u.password&&!u.hash&&(!u.port||u.port==='443')&&!isIP(u.hostname)&&allowed.includes(u.hostname),
    'ASR_URL_INVALID','转写地址不在冻结的HTTPS许可中',503);return u;
}
export function frozenSpeechContract(raw:unknown):SpeechContract {
  requireThat(valid(raw),'ASR_CONTRACT_INVALID','转写冻结协议无效',503);const c=raw;
  let u:URL;try{u=new URL(c.base_url);}catch{requireThat(false,'ASR_CONTRACT_INVALID','转写服务地址无效',503);}
  requireThat(u.protocol==='https:'&&!u.username&&!u.password&&!u.search&&!u.hash&&(!u.port||u.port==='443')&&!isIP(u.hostname)
    &&u.pathname.replace(/\/$/,'')==='/api/v1'&&Number.isFinite(Date.parse(c.valid_until))
    &&[...c.input_hosts,...c.result_hosts].every(h=>!isIP(h)&&!h.endsWith('.')&&!h.includes('..'))
    &&c.rate.max_billable_units===c.max_audio_seconds,'ASR_CONTRACT_INVALID','转写端点、声道计费上界或有效期无效',503);
  speechCost(c,c.rate.max_billable_units);return c;
}
export function admitSpeechContract(cfg:Config,raw:unknown):SpeechContract {
  const c=frozenSpeechContract(raw),p=cfg.provider.speech;
  requireThat(p?.enabled&&p.apiKey&&p.baseUrl.replace(/\/$/,'')===c.base_url.replace(/\/$/,'')&&Date.parse(c.valid_until)>Date.now()
    &&p.allowedHosts.includes(new URL(c.base_url).hostname)&&[...c.input_hosts,...c.result_hosts].every(h=>p.allowedHosts.includes(h)),
    'ASR_NOT_ADMITTED','转写服务未配置或许可已到期',503);
  requireThat(cfg.env==='test'||/^(?:[a-z0-9-]+\.cn-beijing\.maas|dashscope)\.aliyuncs\.com$/.test(new URL(c.base_url).hostname),
    'ASR_NOT_ADMITTED','当前只允许已核验的北京地域协议',503);return c;
}
export type SpeechTransport=typeof safeHttp;
/** Absolute deadline includes DNS. Result downloads never receive the API key. */
export class SpeechClient {
  constructor(private cfg:Config,private transport:SpeechTransport=safeHttp){
    requireThat(transport===safeHttp||cfg.env==='test','TEST_PORT_FORBIDDEN','转写替身只能用于显式测试环境',500);
  }
  private async request(c:SpeechContract,url:string,deadline:Date,signal:AbortSignal,options:{method?:string;body?:string;authenticated?:boolean}):Promise<HttpResponse>{
    admitSpeechContract(this.cfg,c);const remaining=deadline.getTime()-Date.now();
    requireThat(Number.isFinite(remaining)&&remaining>0&&!signal.aborted,'ASR_DEADLINE','转写原截止已到或已取消',409);
    const combined=AbortSignal.any([signal,AbortSignal.timeout(Math.max(1,Math.min(remaining,60000)))]);
    const headers:Record<string,string>={};if(options.authenticated){headers.Authorization=`Bearer ${this.cfg.provider.speech!.apiKey}`;}
    if(options.body){headers['Content-Type']='application/json';headers['X-DashScope-Async']='enable';}
    let abort:()=>void=()=>{};
    const interrupted=new Promise<never>((_resolve,reject)=>{abort=()=>reject(new AppError('ASR_DEADLINE','转写原期限已结束或已取消',409));
      combined.addEventListener('abort',abort,{once:true});if(combined.aborted)abort();});
    let r:HttpResponse;try{r=await Promise.race([interrupted,this.transport(url,this.cfg.provider.speech!.allowedHosts,
      {...options,headers,maxBytes:c.max_response_bytes,timeoutMs:Math.min(remaining,60000),signal:combined})]);}
    finally{combined.removeEventListener('abort',abort);}
    requireThat(!combined.aborted&&Date.now()<deadline.getTime(),'ASR_DEADLINE','转写已超过原截止或已取消',409);
    requireThat(r.bytes.length<=c.max_response_bytes,'ASR_RESPONSE_TOO_LARGE','转写响应超过原上限',503);return r;
  }
  async submit(c:SpeechContract,body:string,deadline:Date,signal:AbortSignal):Promise<HttpResponse>{
    const b=object(JSON.parse(body) as unknown),input=object(b.input),params=object(b.parameters);
    requireThat(b.model===c.request_model&&Object.keys(b).sort().join(',')==='input,model,parameters'&&Object.keys(input).join(',')==='file_url'
      &&typeof input.file_url==='string'&&hash(params)===hash({channel_id:[0],language:'zh',enable_itn:false,enable_words:true}),
      'ASR_REQUEST_INVALID','转写必须使用原文件与真实字级时间码',503);
    speechUrl(input.file_url,c.input_hosts);
    return this.request(c,`${c.base_url.replace(/\/$/,'')}/services/audio/asr/transcription`,deadline,signal,{method:'POST',body,authenticated:true});
  }
  async query(c:SpeechContract,task:string,deadline:Date,signal:AbortSignal):Promise<HttpResponse>{
    requireThat(/^[a-zA-Z0-9_-]{1,200}$/.test(task),'ASR_TASK_INVALID','原转写任务标识无效',503);
    return this.request(c,`${c.base_url.replace(/\/$/,'')}/tasks/${task}`,deadline,signal,{authenticated:true});
  }
  async download(c:SpeechContract,url:string,deadline:Date,signal:AbortSignal):Promise<HttpResponse>{
    return this.request(c,speechUrl(url,c.result_hosts).href,deadline,signal,{});
  }
}
export function speechTask(raw:unknown,expected?:string):{id:string;status:string;result_url?:string;seconds?:number}{
  const b=object(raw),o=object(b.output);requireThat(typeof b.request_id==='string'&&b.request_id.length>0&&b.request_id.length<=200
    &&typeof o.task_id==='string'&&/^[a-zA-Z0-9_-]{1,200}$/.test(o.task_id)&&(!expected||o.task_id===expected)
    &&['PENDING','RUNNING','SUCCEEDED','FAILED','UNKNOWN'].includes(String(o.task_status)),'ASR_RECEIPT_INVALID','转写回执与原任务不一致',503);
  const result=o.result===undefined?{}:object(o.result),usage=b.usage===undefined?{}:object(b.usage);
  return {id:o.task_id,status:String(o.task_status),...(typeof result.transcription_url==='string'?{result_url:result.transcription_url}:{}),
    ...(typeof usage.seconds==='number'?{seconds:usage.seconds}:{})};
}
/** The raw result, including punctuation, is the only source of caption text.
 * Long sentences split only at real word boundaries; timestamps are never distributed. */
export function actualSpeechTranscript(c:SpeechContract,bytes:Buffer,input:{url:string;audio:NativeAudioEvidence;receipt_sha256:string}):NativeTranscript {
  frozenSpeechContract(c);requireThat(bytes.length>0&&bytes.length<=c.max_response_bytes,'ASR_RESULT_INVALID','转写文件大小无效',503);
  const body=object(JSON.parse(bytes.toString('utf8')) as unknown);
  requireThat(body.file_url===input.url&&Array.isArray(body.transcripts)&&body.transcripts.length===1,'ASR_RESULT_BINDING_INVALID','转写结果不是原单声道文件',503);
  const track=object(body.transcripts[0]);requireThat(track.channel_id===0&&Array.isArray(track.sentences)&&track.sentences.length>0&&track.sentences.length<=300,
    'ASR_RESULT_INVALID','转写声道或句子无效',503);
  const segments:NativeTranscript['segments']=[];let previousEnd=0,total=0;const full:string[]=[];
  const normalized=(t:string)=>t.replace(/\s/gu,'');
  function text(value:unknown):string {
    requireThat(typeof value==='string'&&value.length<=12000&&!/[\p{Cc}\p{Cf}\\{}]/u.test(value),'ASR_TEXT_INVALID','转写文字含控制字符或无效注入',503);return value;
  }
  for(const item of track.sentences){const sentence=object(item);const sentenceText=text(sentence.text);
    requireThat(sentence.language==='zh'&&Number.isSafeInteger(sentence.begin_time)&&Number.isSafeInteger(sentence.end_time)
      &&Number(sentence.begin_time)>=previousEnd&&Number(sentence.end_time)>Number(sentence.begin_time)&&Number(sentence.end_time)<=input.audio.duration_ms
      &&Array.isArray(sentence.words)&&sentence.words.length>0&&sentence.words.length<=6000,'ASR_TIMING_INVALID','转写语言或原句时间码无效',503);
    previousEnd=Number(sentence.end_time);let wordEnd=Number(sentence.begin_time);const words:TranscriptWord[]=[];
    for(const raw of sentence.words){const w=object(raw),content=text(w.text)+text(w.punctuation??'');
      requireThat(content.trim().length>0&&[...content].length<=48&&Number.isSafeInteger(w.begin_time)&&Number.isSafeInteger(w.end_time)
        &&Number(w.begin_time)>=wordEnd&&Number(w.end_time)-Number(w.begin_time)>=10&&Number(w.end_time)<=Number(sentence.end_time),
        'ASR_TIMING_INVALID','转写字级时间码缺失、重叠或越界',503);
      words.push({start_ms:Number(w.begin_time),end_ms:Number(w.end_time),text:content});wordEnd=Number(w.end_time);
    }
    requireThat(normalized(words.map(w=>w.text).join(''))===normalized(sentenceText),'ASR_TEXT_MISMATCH','原句与字级文本不一致',503);
    // Preserve spaces in Latin product names without inventing timing. Only
    // whitespace gaps may attach to an existing supplier-timed word.
    let cursor=0;
    for(const word of words){const at=sentenceText.indexOf(word.text,cursor),originalLength=word.text.length;
      requireThat(at>=cursor&&/^\s*$/u.test(sentenceText.slice(cursor,at)),'ASR_TEXT_MISMATCH','字级原文顺序不一致',503);
      word.text=sentenceText.slice(cursor,at)+word.text;cursor=at+originalLength;
    }
    const tail=sentenceText.slice(cursor);requireThat(/^\s*$/u.test(tail),'ASR_TEXT_MISMATCH','原句存在未对齐内容',503);words.at(-1)!.text+=tail;
    requireThat(words.every(w=>[...w.text].length<=48),'ASR_TEXT_MISMATCH','实际字级文本超过字幕上限',503);
    let group:TranscriptWord[]=[],length=0;
    const flush=()=>{if(!group.length)return;const segment={start_ms:group[0]!.start_ms,end_ms:group.at(-1)!.end_ms,text:group.map(w=>w.text).join(''),words:group};
      requireThat(segment.end_ms-segment.start_ms>=100,'ASR_TIMING_INVALID','实际字幕片段过短，不能捏造时间码',503);segments.push(segment);group=[];length=0;};
    for(const w of words){const size=[...w.text].length;if(length+size>48)flush();group.push(w);length+=size;}flush();
    full.push(sentenceText);total+=[...sentenceText].length;
  }
  requireThat(segments.length<=300&&total<=6000&&normalized(text(track.text))===normalized(full.join('')),'ASR_TEXT_MISMATCH','完整转写内容不一致或超出字幕上限',503);
  requireThat(/^[a-f0-9]{64}$/.test(input.receipt_sha256),'ASR_RECEIPT_INVALID','缺少原转写结果回执摘要',503);
  return {version:'YPCC-ACTUAL-AUDIO-TRANSCRIPT-1',source_sha256:input.audio.source_sha256,pcm_sha256:input.audio.pcm_sha256,audio_evidence_hash:hash(input.audio),language:'zh-CN',
    recognizer:{provider:c.provider,actual_model:c.actual_model,registry_version:c.registry_version,rate_snapshot_id:c.rate_snapshot_id,original_receipt_sha256:input.receipt_sha256},segments};
}
export function speechRequest(c:SpeechContract,url:string):string {
  frozenSpeechContract(c);speechUrl(url,c.input_hosts);
  return JSON.stringify({model:c.request_model,input:{file_url:url},parameters:{channel_id:[0],language:'zh',enable_itn:false,enable_words:true}});
}
