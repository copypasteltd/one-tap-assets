import source from '../../assets/presets/presets.v3.1.json';
import {endpoints} from '../shared/contracts/endpoints.generated';
import type {Transport} from '../shared/client/api';
import type {HostPort} from '../shared/platform/ports';
import type {DTO} from '../shared/contracts/types';
import {digest} from '../shared/client/sha256';

const expires='2030-10-28T12:00:00.000Z',created='2026-10-28T08:00:00.000Z';
const memory=new Map<string,unknown>();
const slots=(variant:any)=>[...variant.output_slots.map((s:any)=>({slot_id:s.slot_id,kind:s.kind,count:1,width:s.width,height:s.height,
  fps:s.fps??null,duration_frames:s.duration_seconds?Math.round(s.duration_seconds*(s.fps??30)):null})),
  ...(variant.required_auxiliary_outputs.includes('copy')?[{slot_id:'copy',kind:'copy',count:1,width:null,height:null,fps:null,duration_frames:null}]:[])];
const summaries=source.presets.map(p=>({preset_id:p.preset_id,version:p.version,name:p.name,author_name:'一品成片官方',source:'OFFICIAL',
  style_tags:[p.category,p.style.description.slice(0,45)],sample_id:null,sample_label:'AUTHORIZED_SAMPLE_NOT_YOUR_RESULT',sale_enabled:false}));
const first=source.presets[0]!,firstSlots=slots(first.execution_variants[0]);
const order={order_id:'demo_order',quote_id:'demo_quote',channel:'alipay',currency:'CNY',amount_fen:0,payment_state:'CONFIRMED',fulfillment_state:'DELIVERED',
  payable_until:expires,job_id:'demo_job',refund_id:null,delivery_expires_at:expires,created_at:created};
const session={access_token:'synthetic-browser-only',token_type:'Bearer' as const,expires_at:expires,user_id:'demo_user'};
const profile={product_id:'demo_product',profile_id:'demo_profile',photo_version:1,identity_lock_id:'demo_lock',name:'柚香洗护 · 演示商品',
  summary:'透明琥珀色瓶身，白色泵头，正面可见演示标签。内容为合成回放，不代表真实多模态识别。',unknowns:['成分与功效','未经核实的品牌和认证']};
function response(operation:string,path:string,body:any):unknown{
  switch(operation){
    case 'createPlatformSession':return session;
    case 'listPresets':return {items:summaries,next_cursor:null};
    case 'getPresetVersion':{const p=source.presets.find(p=>path.includes(`/${p.preset_id}/`))??first;return {
      preset:summaries.find(s=>s.preset_id===p.preset_id),description:`${p.style.description}；${p.rhythm.description}。`,license_summary:'官方规格仍禁售；预览不发起真实订单或付费调用。',
      fork_allowed:true,parent_version:null,variants:p.execution_variants.map(v=>({variant_id:v.variant_id,version:v.version,name:v.name,engine:v.engine,
        sale_enabled:false,admission_state:'NOT_EVALUATED',price_fen:null,speech_mode:v.audio_policy.speech==='none'?'NONE':'NATIVE_ZH',output_slots:slots(v),input_guidance:v.input.shot_hints}))};}
    case 'listOrders':return {items:[order],next_cursor:null};
    case 'getOrder':return order;
    case 'listJobStages':return {items:['PRODUCTION','POST','QC','REVIEW_FACTS','REVIEW_STYLE','DELIVER'].map((name,i)=>({stage_id:`demo_stage_${i}`,name,state:'SUCCEEDED'}))};
    case 'getPlan':return {plan_id:'demo_plan',state:'READY',engine:'PHOTO_LAYOUT',plan_hash:'a'.repeat(64),summary:'演示清单：同一件商品，按极简净白方案制作配套图片、短片与文案。',output_slots:firstSlots};
    case 'createQuote':return {quote_id:'demo_quote',amount_fen:0,currency:'CNY',expires_at:expires,hard_deadline_seconds:600};
    case 'createOrder':return order;
    case 'getProductProfile':return profile;
    case 'getAnalysis':return {analysis_id:'demo_analysis',state:'READY'};
    case 'getDeliverables':return {manifest_id:'demo_manifest',order_id:order.order_id,expires_at:expires,cover_deliverable_id:'demo_image',revision:1,
      items:[{deliverable_id:'demo_image',kind:'image',width:1080,height:1440,text:null},
        {deliverable_id:'demo_video',kind:'video',width:1080,height:1920,text:null},
        {deliverable_id:'demo_copy',kind:'copy',width:null,height:null,text:'让日常多一点清新的仪式感。白色泵头，琥珀色瓶身。此为合成演示文案，不包含功效承诺。'}]};
    case 'createDownloadLink':return {url:path.includes('demo_video')?'/product-motion.mp4':'/product-card.png',expires_at:expires};
    case 'listRevisions':case 'listFavorites':case 'listPresetDrafts':case 'listPublications':case 'listModerationCases':return {items:[],next_cursor:null};
    case 'listHelpArticles':return {items:[{article_id:'demo_help',title:'浏览器预览与真机有什么区别？',body:'这里复用共享小程序页面，但数据、商品和订单均为合成回放。支付、相册、真实生成及宿主授权仍需分别验收。'}]};
    default:throw new Error(`PREVIEW_OPERATION_UNAVAILABLE: ${operation}`);
  }
}
const transport:Transport=async request=>{
  const url=new URL(request.url),path=url.pathname.replace(/^\/v1\/p01/,'');
  const found=Object.entries(endpoints).find(([,e])=>e.method===request.method&&new RegExp(`^${e.path.replace(/\{[^}]+\}/g,'[^/]+')}$`).test(path));
  if(!found)return {status:404,headers:{},data:{error:{code:'PREVIEW_ONLY',message:'该操作不在浏览器演示范围内'}}};
  try{return {status:200,headers:{},data:{data:response(found[0],path,request.body?JSON.parse(String(request.body)):null)}};}
  catch{return {status:409,headers:{},data:{error:{code:'PREVIEW_ONLY',message:'该操作需要真实服务，本回放不执行'}}};}
};
let photoSequence=0;
export const previewHost:HostPort={platform:'alipay',transport,storage:{get:<T>(key:string)=>(memory.get(key)??null) as T|null,set:(k,v)=>{memory.set(k,v);},remove:k=>{memory.delete(k);}},
  login:async()=> 'synthetic-browser-code',choosePhotos:async options=>{
    const bitmap=await createImageBitmap(await(await fetch('/product-card.png')).blob());
    try{
      const photos=[],count=options?.source==='camera'?1:Math.min(options?.count??3,3);
      for(let i=0;i<count;i++){
        const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1440;
        const paint=canvas.getContext('2d')!;paint.drawImage(bitmap,0,0,canvas.width,canvas.height);
        paint.fillStyle='#CFE9D6';paint.fillRect(24,1340,400,70);paint.fillStyle='#263B32';paint.font='32px sans-serif';
        paint.fillText(`演示照片 ${++photoSequence}`,40,1386);
        const blob=await new Promise<Blob>(resolve=>canvas.toBlob(value=>resolve(value!),'image/png')),bytes=await blob.arrayBuffer();
        photos.push({path:canvas.toDataURL('image/png'),bytes,width:1080,height:1440,mime:'image/png' as const,sha256:digest(new Uint8Array(bytes))});
      }return photos;
    }finally{bitmap.close();}
  },
  upload:async()=>{throw new Error('Browser replay cannot upload private photos');},pay:async()=>{throw new Error('Browser replay cannot perform payments');},
  download:async link=>link.url,save:async()=> 'UNKNOWN',copy:async text=>{await navigator.clipboard.writeText(text);}};
export function attachPreview(client:{attach(session:DTO<'Session'>):void;remember(ids:Record<string,string>):void}){
  client.attach(session as DTO<'Session'>);client.remember({productId:'demo_product',analysisId:'demo_analysis',planId:'demo_plan',orderId:'demo_order'});
}
