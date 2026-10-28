import Ajv2020 from 'ajv/dist/2020.js';
import {isIP} from 'node:net';
import sharp from 'sharp';
import type {Config} from '../../api/config.js';
import {hash,sha256} from '../../api/lib/crypto.js';
import {requireThat} from '../../api/lib/errors.js';
import {object} from '../../shared/domain/json.js';
import {safeHttp, type HttpResponse} from '../../api/lib/http.js';

export interface ArkContract {
  schema_version:'1.0.0';state:'ADMITTED';provider:'VOLCENGINE_ARK';wire:'ARK_IMAGE'|'ARK_VIDEO';
  model_version_id:string;request_model:string;actual_model:string;registry_version:string;rate_snapshot_id:string;
  base_url:string;official_documentation:string;capability_evidence_sha256:string;valid_until:string;
  max_request_bytes:number;max_response_bytes:number;max_download_bytes:number;max_images:number;
  max_image_pixels:number;max_total_pixels:number;media_hosts:string[];no_charge_http_statuses:number[];
  rate:{unit:'IMAGE'|'VIDEO_TOKEN';micro_per_million_units:number;max_billable_units:number;ceiling_micro:number};
  image:{width:number;height:number;grouping_control:'EXPLICIT_DISABLED'|'SINGLE_ONLY'}|null;
  video:{durations:number[];resolutions:('480p'|'720p'|'1080p')[];ratios:('9:16'|'16:9'|'1:1'|'3:4'|'4:3')[];
    dimensions:{resolution:string;ratio:string;width:number;height:number}[];
    reference_modes:('FIRST_FRAME'|'REFERENCE_IMAGES')[];native_audio:boolean;max_status_queries:number;poll_seconds:number}|null;
}
const integer=(minimum:number,maximum:number)=>({type:'integer',minimum,maximum});
const text={type:'string',minLength:1,maxLength:200};
const exact=(properties:Record<string,unknown>)=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
const schema=exact({schema_version:{const:'1.0.0'},state:{const:'ADMITTED'},provider:{const:'VOLCENGINE_ARK'},wire:{enum:['ARK_IMAGE','ARK_VIDEO']},
  model_version_id:text,request_model:text,actual_model:text,registry_version:text,rate_snapshot_id:text,
  base_url:{type:'string',maxLength:1000},official_documentation:{type:'string',pattern:'^https://(?:docs\\.volcengine\\.com|www\\.volcengine\\.com|console\\.volcengine\\.com)/'},
  capability_evidence_sha256:{type:'string',pattern:'^[a-f0-9]{64}$'},valid_until:{type:'string'},
  max_request_bytes:integer(1000,64_000_000),max_response_bytes:integer(1000,90_000_000),max_download_bytes:integer(1000,120_000_000),
  max_images:integer(1,30),max_image_pixels:integer(1,36_000_000),max_total_pixels:integer(1,180_000_000),
  media_hosts:{type:'array',minItems:1,maxItems:20,uniqueItems:true,items:{type:'string',pattern:'^[A-Za-z0-9.-]{1,253}$'}},
  no_charge_http_statuses:{type:'array',uniqueItems:true,items:{enum:[400,401,403,404,413,422,429]}},
  rate:exact({unit:{enum:['IMAGE','VIDEO_TOKEN']},micro_per_million_units:integer(1,1_000_000_000_000),max_billable_units:integer(1,10_000_000),ceiling_micro:integer(1,1_000_000_000)}),
  image:{anyOf:[{type:'null'},exact({width:integer(16,6000),height:integer(16,6000),grouping_control:{enum:['EXPLICIT_DISABLED','SINGLE_ONLY']}})]},
  video:{anyOf:[{type:'null'},exact({durations:{type:'array',minItems:1,maxItems:30,uniqueItems:true,items:integer(1,60)},
    resolutions:{type:'array',minItems:1,uniqueItems:true,items:{enum:['480p','720p','1080p']}},
    ratios:{type:'array',minItems:1,uniqueItems:true,items:{enum:['9:16','16:9','1:1','3:4','4:3']}},
    dimensions:{type:'array',minItems:1,maxItems:15,items:exact({resolution:{enum:['480p','720p','1080p']},ratio:{enum:['9:16','16:9','1:1','3:4','4:3']},width:integer(16,6000),height:integer(16,6000)})},
    reference_modes:{type:'array',minItems:1,uniqueItems:true,items:{enum:['FIRST_FRAME','REFERENCE_IMAGES']}},native_audio:{type:'boolean'},
    max_status_queries:integer(1,720),poll_seconds:integer(1,60)})]},
});
const valid=new Ajv2020({strict:false}).compile<ArkContract>(schema);
export function arkCost(contract:ArkContract,units:number):number {
  requireThat(Number.isSafeInteger(units)&&units>=0&&units<=contract.rate.max_billable_units,'GENERATION_USAGE_INVALID','生成服务用量缺失或超出原能力上界',503);
  const cost=Number((BigInt(units)*BigInt(contract.rate.micro_per_million_units)+999999n)/1000000n);
  requireThat(Number.isSafeInteger(cost)&&cost<=contract.rate.ceiling_micro,'GENERATION_COST_BOUND_VIOLATED','生成费用超出原预留上界',503);return cost;
}
export function frozenArkContract(raw:unknown):ArkContract {
  requireThat(valid(raw),'GENERATION_CONTRACT_INVALID','生成服务的冻结协议不符合规范',503);
  const c=raw;let url:URL;try{url=new URL(c.base_url);}catch{requireThat(false,'GENERATION_CONTRACT_INVALID','生成服务地址无效',503);}
  requireThat(url.protocol==='https:'&&!url.username&&!url.password&&!url.search&&!url.hash&&(!url.port||url.port==='443')
    &&!isIP(url.hostname)&&url.pathname.replace(/\/$/,'')==='/api/v3'&&Number.isFinite(Date.parse(c.valid_until)),
  'GENERATION_CONTRACT_INVALID','生成服务地址或有效期不符合规范',503);
  requireThat(c.max_total_pixels>=c.max_image_pixels&&c.media_hosts.every(host=>!isIP(host)&&!host.endsWith('.')&&!host.includes('..'))
    &&(c.wire==='ARK_IMAGE'?c.image&&!c.video&&c.rate.unit==='IMAGE'&&c.rate.max_billable_units===1
      &&c.image.width*c.image.height<=c.max_image_pixels:!c.image&&c.video&&c.rate.unit==='VIDEO_TOKEN'),
  'GENERATION_CONTRACT_INVALID','生成协议类型、参考额度或费用单位不匹配',503);
  if(c.video){const v=c.video;
    requireThat(v.dimensions.length===v.resolutions.length*v.ratios.length
      &&new Set(v.dimensions.map(d=>`${d.resolution}:${d.ratio}`)).size===v.dimensions.length
      &&v.dimensions.every(d=>v.resolutions.includes(d.resolution as '720p')&&v.ratios.includes(d.ratio as '9:16')&&d.width*d.height<=c.max_image_pixels),
      'GENERATION_CONTRACT_INVALID','视频尺寸表未完整覆盖冻结规格',503);
  }
  arkCost(c,c.rate.max_billable_units);return c;
}
const endpoint=(cfg:Config)=>cfg.provider.generation??cfg.provider;
export function admitArkContract(cfg:Config,raw:unknown):ArkContract {
  const c=frozenArkContract(raw),connection=endpoint(cfg);
  requireThat(cfg.generationEnabled&&connection.apiKey&&connection.baseUrl.replace(/\/$/,'')===c.base_url.replace(/\/$/,'')
    &&connection.allowedHosts.includes(new URL(c.base_url).hostname)&&c.media_hosts.every(h=>connection.allowedHosts.includes(h))
    &&(c.wire==='ARK_IMAGE'?cfg.provider.imageModel:cfg.provider.videoModel)===c.request_model&&Date.parse(c.valid_until)>Date.now(),
  'GENERATION_NOT_ADMITTED','生成模型、地址、费用能力或有效期尚未准入',503);return c;
}
export interface ArkImage {id:string;bytes:Buffer;sha256:string}
async function references(c:ArkContract,images:ArkImage[]):Promise<{data:string[];hashes:{id:string;sha256:string;pixels:number}[]}> {
  requireThat(images.length>0&&images.length<=c.max_images&&new Set(images.map(i=>i.id)).size===images.length,
    'GENERATION_REFERENCE_LIMIT','参考图片数量或身份映射无效',422);
  const data:string[]=[];const hashes:{id:string;sha256:string;pixels:number}[]=[];
  for(const image of images){
    requireThat(sha256(image.bytes)===image.sha256&&image.bytes.length<=c.max_download_bytes,'GENERATION_REFERENCE_INVALID','参考图片字节或摘要不一致',422);
    const decoded=sharp(image.bytes,{limitInputPixels:c.max_image_pixels,failOn:'warning'});const m=await decoded.metadata();
    requireThat((m.format==='png'||m.format==='jpeg')&&m.width&&m.height&&(!m.pages||m.pages===1),'GENERATION_REFERENCE_INVALID','参考图片格式无效',422);
    await decoded.raw().toBuffer();data.push(`data:image/${m.format};base64,${image.bytes.toString('base64')}`);
    hashes.push({id:image.id,sha256:image.sha256,pixels:m.width*m.height});
  }
  requireThat(hashes.reduce((n,i)=>n+i.pixels,0)<=c.max_total_pixels,'GENERATION_REFERENCE_LIMIT','参考图片总像素超过原能力额度',422);
  return {data,hashes};
}
export interface PreparedArk {kind:'IMAGE'|'VIDEO';body:string;request_hash:string;contract_hash:string;
  references:{id:string;sha256:string;pixels:number}[];output:{width?:number;height?:number;duration?:number;audio?:boolean;resolution?:string;ratio?:string}}
function prepared(c:ArkContract,body:Record<string,unknown>,refs:PreparedArk['references'],output:PreparedArk['output']):PreparedArk {
  const encoded=JSON.stringify(body);requireThat(Buffer.byteLength(encoded)<=c.max_request_bytes,'GENERATION_REQUEST_TOO_LARGE','生成请求超过原能力大小限制',422);
  return {kind:c.wire==='ARK_IMAGE'?'IMAGE':'VIDEO',body:encoded,request_hash:sha256(encoded),contract_hash:hash(c),references:refs,output};
}
export async function prepareArkImage(c:ArkContract,prompt:string,images:ArkImage[]):Promise<PreparedArk> {
  frozenArkContract(c);requireThat(c.image&&typeof prompt==='string'&&prompt.trim().length>0&&prompt.length<=15000,'GENERATION_REQUEST_INVALID','图片生成输入不符合原合同',422);
  const refs=await references(c,images);
  return prepared(c,{model:c.request_model,prompt,image:refs.data,size:`${c.image.width}x${c.image.height}`,response_format:'b64_json',watermark:true,
    ...(c.image.grouping_control==='EXPLICIT_DISABLED'?{sequential_image_generation:'disabled'}:{})},refs.hashes,{width:c.image.width,height:c.image.height});
}
export async function prepareArkVideo(c:ArkContract,prompt:string,images:ArkImage[],options:{duration:number;resolution:string;ratio:string;audio:boolean;mode:'FIRST_FRAME'|'REFERENCE_IMAGES'}):Promise<PreparedArk> {
  frozenArkContract(c);requireThat(c.video&&typeof prompt==='string'&&prompt.trim().length>0&&prompt.length<=15000&&c.video.durations.includes(options.duration)
    &&c.video.resolutions.includes(options.resolution as '720p')&&c.video.ratios.includes(options.ratio as '9:16')
    &&c.video.reference_modes.includes(options.mode)&&(!options.audio||c.video.native_audio)&& (options.mode!=='FIRST_FRAME'||images.length===1),
  'GENERATION_REQUEST_INVALID','视频时长、原声、参考模式或规格不符合原合同',422);
  const refs=await references(c,images);
  const dimensions=c.video.dimensions.find(d=>d.resolution===options.resolution&&d.ratio===options.ratio);
  requireThat(dimensions,'GENERATION_REQUEST_INVALID','原视频尺寸组合未准入',422);
  return prepared(c,{model:c.request_model,content:[{type:'text',text:prompt},...refs.data.map(url=>({type:'image_url',image_url:{url},role:options.mode==='FIRST_FRAME'?'first_frame':'reference_image'}))],
    duration:options.duration,resolution:options.resolution,ratio:options.ratio,generate_audio:options.audio,watermark:true,service_tier:'default',draft:false,execution_expires_after:3600},
  refs.hashes,{duration:options.duration,resolution:options.resolution,ratio:options.ratio,audio:options.audio,width:dimensions.width,height:dimensions.height});
}
export function arkUsage(c:ArkContract,body:unknown):number {
  const b=object(body);const usage=object(b.usage);const tools=usage.tool_usage===undefined?{}:object(usage.tool_usage);
  requireThat(b.model===c.actual_model&&(b.tools===undefined||Array.isArray(b.tools)&&b.tools.length===0)
    &&Object.values(tools).every(value=>value===0),
  'GENERATION_MODEL_MISMATCH','生成服务返回了未冻结的模型或额外付费工具',503);
  const units=c.wire==='ARK_IMAGE'?usage.generated_images:usage.completion_tokens;
  requireThat(typeof units==='number'&&(c.wire!=='ARK_VIDEO'||usage.total_tokens===units),'GENERATION_USAGE_INVALID','生成服务未返回可核对的原始用量',503);
  return arkCost(c,units);
}
export type ArkTransport=typeof safeHttp;
/** Authentication is used only on the frozen API origin, never on a media URL. */
export class ArkClient {
  constructor(private cfg:Config,private transport:ArkTransport=safeHttp){
    requireThat(transport===safeHttp||cfg.env==='test','GENERATION_TEST_TRANSPORT_FORBIDDEN','生产生成服务不能注入测试出口',503);
  }
  private enabled(c:ArkContract):void{
    frozenArkContract(c);const connection=endpoint(this.cfg);
    requireThat(this.cfg.generationEnabled&&connection.apiKey&&connection.baseUrl.replace(/\/$/,'')===c.base_url.replace(/\/$/,''),
      'GENERATION_NOT_ADMITTED','原生成服务出口当前不可用',503);
  }
  async submit(c:ArkContract,p:PreparedArk,deadlineAt:Date,signal:AbortSignal):Promise<HttpResponse>{
    admitArkContract(this.cfg,c);requireThat(p.contract_hash===hash(c)&&p.request_hash===sha256(p.body)&&!signal.aborted&&deadlineAt.getTime()>Date.now(),
      'GENERATION_REQUEST_INVALID','生成请求已改变、取消或超过截止',409);
    const remaining=deadlineAt.getTime()-Date.now();requireThat(remaining>0,'GENERATION_REQUEST_INVALID','生成请求已超过原截止',409);
    // Start the absolute deadline before DNS/transport work, not only when
    // safeHttp eventually constructs the HTTPS request.
    const boundedSignal=AbortSignal.any([signal,AbortSignal.timeout(remaining)]);
    const connection=endpoint(this.cfg);
    return this.transport(`${c.base_url.replace(/\/$/,'')}/${c.wire==='ARK_IMAGE'?'images/generations':'contents/generations/tasks'}`,connection.allowedHosts,
      {method:'POST',headers:{Authorization:`Bearer ${connection.apiKey}`,'Content-Type':'application/json'},body:p.body,maxBytes:c.max_response_bytes,
        timeoutMs:Math.min(120000,remaining),signal:boundedSignal});
  }
  async query(c:ArkContract,taskId:string,signal:AbortSignal):Promise<HttpResponse>{
    this.enabled(c);requireThat(c.wire==='ARK_VIDEO'&&/^[A-Za-z0-9_-]{1,200}$/.test(taskId),'GENERATION_TASK_INVALID','原视频任务标识无效',503);
    const connection=endpoint(this.cfg);
    return this.transport(`${c.base_url.replace(/\/$/,'')}/contents/generations/tasks/${encodeURIComponent(taskId)}`,connection.allowedHosts,
      {headers:{Authorization:`Bearer ${connection.apiKey}`},maxBytes:c.max_response_bytes,timeoutMs:20000,signal});
  }
  async download(c:ArkContract,urlValue:string,signal:AbortSignal):Promise<Buffer>{
    this.enabled(c);let url:URL;try{url=new URL(urlValue);}catch{requireThat(false,'GENERATION_MEDIA_URL_INVALID','原媒体地址无效',503);}
    requireThat(url.protocol==='https:'&&!url.username&&!url.password&&!url.hash&&!isIP(url.hostname)&&(!url.port||url.port==='443')
      &&c.media_hosts.includes(url.hostname)&&endpoint(this.cfg).allowedHosts.includes(url.hostname),
      'GENERATION_MEDIA_URL_INVALID','原媒体地址未在冻结许可中',503);
    const response=await this.transport(url.href,c.media_hosts,{maxBytes:c.max_download_bytes,timeoutMs:60000,signal});
    requireThat(response.status===200,'GENERATION_DOWNLOAD_PENDING','原媒体尚未成功转存，不能跟随跳转',503);
    requireThat(response.bytes.length>0&&response.bytes.length<=c.max_download_bytes,'GENERATION_MEDIA_INVALID','原媒体长度无效',503);return response.bytes;
  }
}
