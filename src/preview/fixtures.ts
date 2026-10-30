import source from '../../assets/presets/presets.v3.1.json';
import {endpoints} from '../shared/contracts/endpoints.generated';
import type {Transport} from '../shared/client/api';
import type {HostPort} from '../shared/platform/ports';
import type {DTO} from '../shared/contracts/types';
import {digest} from '../shared/client/sha256';
import {CREATIVE_COMPONENTS} from '../shared/domain/creative-components';

const expires='2030-10-28T12:00:00.000Z',created='2026-10-28T08:00:00.000Z';
const memory=new Map<string,unknown>();
const creativeScenario=new URLSearchParams(location.search).get('scenario')==='creative-components';
const creativeOptions:DTO<'ComponentOption'>[]=[...source.presets.map(p=>({component_version_id:`style.${p.preset_id}.1`,type:'STYLE',name:p.name,description:p.style.description,supported_engines:['PHOTO_LAYOUT','PER_SHOT_AI','REFERENCE_FILM']} as DTO<'ComponentOption'>)),
  ...(['PHOTO_LAYOUT','PER_SHOT_AI','REFERENCE_FILM'] as const).map(engine=>({component_version_id:`engine.${engine}.1`,type:'ENGINE',name:{PHOTO_LAYOUT:'照片动效',PER_SHOT_AI:'逐镜生成',REFERENCE_FILM:'连续短片'}[engine],description:'受控执行路线',supported_engines:[engine]})),...CREATIVE_COMPONENTS.map(d=>d.option)];
let creativeDraft:DTO<'PresetDraft'>|undefined;
const slots=(variant:any)=>[...variant.output_slots.map((s:any)=>({slot_id:s.slot_id,kind:s.kind,count:1,width:s.width,height:s.height,
  fps:s.fps??null,duration_frames:s.duration_seconds?Math.round(s.duration_seconds*(s.fps??30)):null})),
  ...(variant.required_auxiliary_outputs.includes('copy')?[{slot_id:'copy',kind:'copy',count:1,width:null,height:null,fps:null,duration_frames:null}]:[])];
const summaries=source.presets.map(p=>({preset_id:p.preset_id,version:p.version,name:p.name,author_name:'一品成片官方',source:'OFFICIAL',
  style_tags:[p.category,p.style.description.slice(0,45)],sample_id:null,sample_label:'AUTHORIZED_SAMPLE_NOT_YOUR_RESULT',sale_enabled:false}));
const first=source.presets[0]!,firstSlots=slots(first.execution_variants[0]);
const order:DTO<'Order'>={order_id:'demo_order',quote_id:'demo_quote',channel:'alipay',currency:'CNY',amount_fen:0,payment_state:'CONFIRMED',fulfillment_state:'DELIVERED',
  payable_until:expires,job_id:'demo_job',refund_id:null,delivery_expires_at:expires,created_at:created};
const orderScenario=new URLSearchParams(location.search).get('scenario')==='order-actions';
const albumScenario=new URLSearchParams(location.search).get('scenario')==='album-save';
const supportScenario=new URLSearchParams(location.search).get('scenario')==='support';
const supportTrace={operations:[] as string[],posts:[] as {key:string;body:unknown}[],uploads:0};
if(supportScenario)Object.assign(window,{__YPCC_SUPPORT_REPLAY__:supportTrace});
const supportAssets=new Map<string,boolean>(),supportTickets:DTO<'Ticket'>[]=[
  {ticket_id:'demo_earlier',order_id:'demo_order',state:'CLOSED',category:'SAVE',updated_at:created},
  {ticket_id:'demo_other',order_id:'demo_other_order',state:'PROCESSING',category:'REFUND',updated_at:created}];
const supportKeys=new Map<string,DTO<'Ticket'>>();let supportAckLost=false;
const albumTrace={operations:[] as string[],saves:[] as string[]};
if(albumScenario)Object.assign(window,{__YPCC_ALBUM_REPLAY__:albumTrace});
const albumAttempts=new Map<string,number>();
const demoOrders:Record<string,DTO<'Order'>>={},demoRefunds:Record<string,DTO<'Refund'>>={};
for(const [id,payment,fulfillment] of [['demo_pending','PENDING','NOT_STARTED'],['demo_unknown','UNKNOWN','NOT_STARTED'],['demo_queued','CONFIRMED','QUEUED'],['demo_failed','CONFIRMED','FAILED'],['demo_working','CONFIRMED','IN_PROGRESS'],['demo_refunded','CONFIRMED','CANCELLED']] as const)
  demoOrders[id]={...order,order_id:id,amount_fen:100,payment_state:payment,fulfillment_state:fulfillment,job_id:null,delivery_expires_at:null};
function demoRefund(original:DTO<'Order'>):DTO<'Refund'>{
  const refund:DTO<'Refund'>={refund_id:`refund_${original.order_id}`,order_id:original.order_id,amount_fen:original.amount_fen,state:'REQUESTED',updated_at:created};
  demoRefunds[refund.refund_id]=refund;original.refund_id=refund.refund_id;return refund;
}
demoRefund(demoOrders.demo_refunded!).state='REFUNDED';
const session={access_token:'synthetic-browser-only',token_type:'Bearer' as const,expires_at:expires,user_id:'demo_user'};
const correctionScenario=new URLSearchParams(location.search).get('scenario')==='profile-correction';
const correctionTrace={posts:[] as {key:string;body:DTO<'CorrectionRequest'>}[],ack_lost:false};
if(correctionScenario)Object.assign(window,{__YPCC_CORRECTION_REPLAY__:correctionTrace});
const correctionKeys=new Map<string,DTO<'Profile'>>();
let profile:DTO<'Profile'>={schema_version:'1.1',revision:1,category:'洗护',profile_hash:'a'.repeat(64),label_texts:[],evidence:[],hypotheses:[],product_id:'demo_product',profile_id:'demo_profile',photo_version:1,identity_lock_id:'demo_lock',name:'柚香洗护 · 演示商品',
  summary:'透明琥珀色瓶身，白色泵头，正面可见演示标签。内容为合成回放，不代表真实多模态识别。',unknowns:['成分与功效','未经核实的品牌和认证'],
  conflicts:[],photo_roles:[{asset_id:'demo-a',role:'WHOLE'},{asset_id:'demo-b',role:'DETAIL'},{asset_id:'demo-c',role:'LABEL'}],
  observations:[{feature:'瓶身',value:'透明琥珀色',status:'OBSERVED',source_asset_ids:['demo-a'],evidence_ids:['demo-ev-a'],note:'合成页面示例',model_reported_confidence:null},
    {feature:'结构',value:'白色按压泵头',status:'OBSERVED',source_asset_ids:['demo-b'],evidence_ids:['demo-ev-b'],note:'合成页面示例',model_reported_confidence:null}]};
const product={product_id:'demo_product',revision:1,photo_version:1,profile_id:'demo_profile',created_at:created};
const demoPack:DTO<'Deliverables'>={manifest_id:'demo_manifest',order_id:order.order_id,expires_at:expires,cover_deliverable_id:'demo_image',manifest_revision:1,
  items:[['demo_image','image','商品主图'],...(albumScenario?[['demo_image_detail','image','商品细节']]:[]),['demo_video','video','商品短片'],['demo_copy','copy','商品文案']].map(([id,kind,label])=>({
    deliverable_id:id!,slot_id:id!,kind:kind as 'image'|'video'|'copy',file_name:label!,mime_type:kind==='image'?'image/png':kind==='video'?'video/mp4':null,
    size_bytes:null,width:kind==='copy'?null:1080,height:kind==='image'?1440:kind==='video'?1920:null,fps:kind==='video'?30:null,duration_frames:kind==='video'?60:null,
    text:kind==='copy'?'让日常多一点清新的仪式感。白色泵头，琥珀色瓶身。此为合成演示文案，不包含功效承诺。':null,sha256:'a'.repeat(64)}))};
let demoPlusSessions:DTO<'PlusSessionInfo'>[]=[];
let demoUsageFeedback:DTO<'UsageFeedback'>={order_id:demoPack.order_id,choice:null,revision:0,updated_at:null};
function response(operation:string,path:string,body:any,key=''):unknown{
  switch(operation){
    case 'listCommunityComponents':if(!creativeScenario)throw new Error('Synthetic creator scenario only');return {items:creativeOptions,next_cursor:null};
    case 'listVariantBlueprints':if(!creativeScenario)throw new Error('Synthetic creator scenario only');return {items:source.presets.flatMap(p=>p.execution_variants.map(v=>({blueprint_id:`blueprint.${v.variant_id}`,name:v.name,engine:v.engine,allowed_component_version_ids:creativeOptions.map(c=>c.component_version_id),admission_required:true}))),next_cursor:null};
    case 'listCommunityResources':if(!creativeScenario)throw new Error('Synthetic creator scenario only');return {items:[],next_cursor:null};
    case 'getPresetDraft':if(!creativeScenario||!creativeDraft||path.split('/').at(-1)!==creativeDraft.draft_id)throw new Error('Synthetic draft not found');return creativeDraft;
    case 'createPresetDraft':if(!creativeScenario)throw new Error('Synthetic creator scenario only');creativeDraft={draft_id:'demo_creative_draft',revision:0,config:structuredClone(body.config),publication_id:null,updated_at:created};return creativeDraft;
    case 'updatePresetDraft':if(!creativeScenario||!creativeDraft||body.expected_revision!==creativeDraft.revision)throw new Error('Synthetic revision conflict');creativeDraft={...creativeDraft,revision:creativeDraft.revision+1,config:structuredClone(body.config)};return creativeDraft;
    case 'createPlatformSession':return session;
    case 'listProducts':return {items:[product],next_cursor:null};
    case 'getProduct':return product;
    case 'listPresets':return {items:summaries,next_cursor:null};
    case 'getPresetVersion':{const p=source.presets.find(p=>path.includes(`/${p.preset_id}/`))??first;return {
      preset:summaries.find(s=>s.preset_id===p.preset_id),description:`${p.style.description}；${p.rhythm.description}。`,license_summary:'官方规格仍禁售；预览不发起真实订单或付费调用。',
      fork_allowed:true,parent_version:null,variants:p.execution_variants.map(v=>({variant_id:v.variant_id,version:v.version,name:v.name,engine:v.engine,
        sale_enabled:false,admission_state:'NOT_EVALUATED',price_fen:null,speech_mode:v.audio_policy.speech==='none'?'NONE':'NATIVE_ZH',output_slots:slots(v),input_guidance:v.input.shot_hints}))};}
    case 'listOrders':return {items:[order],next_cursor:null};
    case 'getOrder':return orderScenario?demoOrders[path.split('/').at(-1)!]??order:order;
    case 'getOrCreatePaymentAction':{if(!orderScenario)throw new Error('Synthetic order actions only');const id=path.split('/').at(-2)!;
      return {payment_id:`payment_${id}`,order_id:id,channel:'alipay',state:demoOrders[id]!.payment_state,expires_at:expires,action:{kind:'QUERY_ORIGINAL_ORDER'}};}
    case 'cancelOrder':{if(!orderScenario)throw new Error('Synthetic order actions only');const original=demoOrders[path.split('/').at(-2)!]!;
      if(!['NOT_STARTED','QUEUED'].includes(original.fulfillment_state))throw new Error('Cancellation unavailable');original.fulfillment_state='CANCELLED';
      if(original.payment_state==='CONFIRMED')demoRefund(original);return original;}
    case 'requestRefund':{if(!orderScenario)throw new Error('Synthetic order actions only');return demoRefund(demoOrders[path.split('/').at(-2)!]!);}
    case 'getRefund':{if(!orderScenario)throw new Error('Synthetic order actions only');return demoRefunds[path.split('/').at(-1)!];}
    case 'listJobStages':return {items:['PRODUCTION','POST','QC','REVIEW_FACTS','REVIEW_STYLE','DELIVER'].map((name,i)=>({stage_id:`demo_stage_${i}`,name,state:'SUCCEEDED'}))};
    case 'getPlan':return {plan_id:'demo_plan',product_id:product.product_id,profile_id:profile.profile_id,variant_id:first.execution_variants[0]!.variant_id,state:'READY',engine:'PHOTO_LAYOUT',plan_hash:'a'.repeat(64),summary:'演示清单：同一件商品，按极简净白方案制作配套图片、短片与文案。',output_slots:firstSlots};
    case 'createQuote':return {quote_id:'demo_quote',amount_fen:0,currency:'CNY',expires_at:expires,hard_deadline_seconds:600};
    case 'createOrder':return order;
    case 'listPlusSessions':return {items:demoPlusSessions,next_cursor:null};
    case 'inspectPlusLink':return {link_id:'pluslink_synthetic',user_code:body.user_code,expires_at:expires,state:'PENDING',access:'OWN_PROJECTS_AND_EDIT_DRAFTS'};
    case 'decidePlusLink':{
      if(body.decision==='APPROVE')demoPlusSessions=[{session_id:'plussession_synthetic_replay',platform:'alipay',created_at:created,expires_at:expires,state:'ACTIVE'}];
      return {link_id:'pluslink_synthetic',user_code:body.user_code,expires_at:expires,state:body.decision==='APPROVE'?'APPROVED':'DENIED',access:'OWN_PROJECTS_AND_EDIT_DRAFTS'};}
    case 'revokePlusSession':{const session=demoPlusSessions[0]!;demoPlusSessions=[];return {...session,state:'REVOKED'};}
    case 'recordRecommendationEvent':window.dispatchEvent(new CustomEvent('preview:recommendation-event',{detail:{kind:body.kind}}));return {accepted:true,duplicate:false};
    case 'recommendPresets':return new URLSearchParams(location.search).get('scenario')==='recommendations'
      ?{items:['fresh-daily','feature-cards','color-pop'].map(id=>({preset:{...summaries.find(p=>p.preset_id===id)!,sale_enabled:true},
        variant_ids:[`${id}.photo-layout`],reason:{'fresh-daily':'当前商品类别适合明亮轻盈的日常风格。','feature-cards':'照片已确认结构细节，适合用信息卡片逐项展示。','color-pop':'照片已确认可见配色，可以用色块突出商品原色。'}[id],missing_inputs:[],measurement:{token:`synthetic-recommendation-${id}-not-a-server-token`,expires_at:new Date(Date.now()+900000).toISOString()}})),next_cursor:null}
      :{items:[],next_cursor:null};
    case 'getProductProfile':return profile;
    case 'correctProfile':{
      if(!correctionScenario)throw new Error('Synthetic correction scenario only');
      correctionTrace.posts.push({key,body:structuredClone(body)});const prior=correctionKeys.get(key);if(prior)return prior;
      if(body.expected_revision!==product.revision||body.profile_id!==profile.profile_id)throw new Error('Synthetic revision conflict');
      const next=structuredClone(profile),value=String(body.value).trim(),ids=body.evidence_asset_ids??[];
      next.revision++;next.profile_id=`demo_profile_${next.revision}`;next.identity_lock_id=`demo_lock_${next.revision}`;next.profile_hash=String(next.revision%10).repeat(64);
      if(body.field==='name'||body.field==='category')next[body.field as 'name'|'category']=value;
      else if(body.field==='photo_role')for(const photo of next.photo_roles){if(ids.includes(photo.asset_id))photo.role=value as DTO<'Profile'>['photo_roles'][number]['role'];}
      else {const entries=ids.map((asset:string,index:number)=>({evidence_id:`demo_user_${next.revision}_${index}`,asset_id:asset,kind:'USER_CORRECTION' as const,text:value,region:null}));
        next.evidence.push(...entries);(body.field==='label_text'?next.label_texts:next.observations).push({feature:'用户纠错',value,status:'USER_CORRECTED',
          source_asset_ids:ids,evidence_ids:entries.map((entry:DTO<'Evidence'>)=>entry.evidence_id),note:'合成用户补充，待复核',model_reported_confidence:null});}
      profile=next;product.profile_id=next.profile_id;product.revision++;correctionKeys.set(key,structuredClone(next));return next;
    }
    case 'getAnalysis':return {analysis_id:'demo_analysis',state:'READY'};
    case 'getDeliverables':return demoPack;
    case 'getUsageFeedback':return demoUsageFeedback;
    case 'setUsageFeedback':{
      if(body.expected_revision!==demoUsageFeedback.revision)throw new Error('Synthetic feedback revision conflict');
      if(body.choice!==demoUsageFeedback.choice)demoUsageFeedback={...demoUsageFeedback,choice:body.choice,revision:demoUsageFeedback.revision+1,updated_at:new Date().toISOString()};
      return demoUsageFeedback;
    }
    case 'createDownloadLink':return {deliverable_id:path.split('/').at(-2),url:path.includes('demo_video')?'/product-motion.mp4':'/product-card.png',expires_at:expires,ttl_seconds:300};
    case 'createSaveSession':if(!albumScenario)throw new Error('Synthetic album scenario only');return {save_session_id:'demo_save',...body,created_at:created};
    case 'recordSaveReceipt':if(!albumScenario)throw new Error('Synthetic album scenario only');return {receipt_id:`demo_receipt_${body.deliverable_id}_${body.attempt}`,accepted:true};
    case 'createUploadGrant':{if(!supportScenario||body.purpose!=='SUPPORT_EVIDENCE')throw new Error('Synthetic support uploads only');
      const asset_id=`support_${body.sha256}`;if(!supportAssets.has(asset_id))supportAssets.set(asset_id,false);
      return {asset_id,upload_url:'/synthetic-support-upload',headers:{},expires_at:expires};}
    case 'completeAssetUpload':{if(!supportScenario)throw new Error('Synthetic support uploads only');const asset_id=path.split('/').at(-2)!;
      if(!supportAssets.get(asset_id))throw new Error('UPLOAD_NOT_COMPLETE');return {asset_id,state:'READY'};}
    case 'createSupportTicket':{if(!supportScenario)throw new Error('Synthetic support only');const ticket:DTO<'Ticket'>={ticket_id:'demo_feedback',order_id:path.split('/').at(-2)!,state:'OPEN',category:body.category,updated_at:created};supportTickets.unshift(ticket);return ticket;}
    case 'listSupportTickets':return {items:supportScenario?supportTickets:[],next_cursor:null};
    case 'getSupportTicket':{if(!supportScenario)throw new Error('Synthetic support only');const ticket=supportTickets.find(t=>t.ticket_id===path.split('/').at(-1))!;
      if(ticket.ticket_id==='demo_feedback')ticket.state='PROCESSING';return ticket;}
    case 'listRevisions':case 'listFavorites':case 'listPresetDrafts':case 'listPublications':case 'listModerationCases':return {items:[],next_cursor:null};
    case 'listHelpArticles':return {items:[{article_id:'demo_help',title:'浏览器预览与真机有什么区别？',body:'这里复用共享小程序页面，但数据、商品和订单均为合成回放。支付、相册、真实生成及宿主授权仍需分别验收。'}]};
    default:throw new Error(`PREVIEW_OPERATION_UNAVAILABLE: ${operation}`);
  }
}
const transport:Transport=async request=>{
  const url=new URL(request.url),path=url.pathname.replace(/^\/v1\/p01/,'');
  const found=Object.entries(endpoints).find(([,e])=>e.method===request.method&&new RegExp(`^${e.path.replace(/\{[^}]+\}/g,'[^/]+')}$`).test(path));
  if(!found)return {status:404,headers:{},data:{error:{code:'PREVIEW_ONLY',message:'该操作不在浏览器演示范围内'}}};
  if(albumScenario)albumTrace.operations.push(found[0]);
  if(supportScenario)supportTrace.operations.push(found[0]);
  if(supportScenario&&found[0]==='createSupportTicket'){
    const key=request.headers['Idempotency-Key']!;supportTrace.posts.push({key,body:JSON.parse(String(request.body))});
    let ticket=supportKeys.get(key);if(!ticket){ticket=response(found[0],path,JSON.parse(String(request.body))) as DTO<'Ticket'>;supportKeys.set(key,ticket);}
    if(!supportAckLost){supportAckLost=true;throw new Error('Synthetic committed ACK lost');}
    return {status:200,headers:{},data:{data:ticket}};
  }
  if(correctionScenario&&found[0]==='correctProfile'){
    const result=response(found[0],path,JSON.parse(String(request.body)),request.headers['Idempotency-Key']!);
    if(!correctionTrace.ack_lost){correctionTrace.ack_lost=true;throw new Error('Synthetic correction committed; ACK lost');}
    return {status:200,headers:{},data:{data:result}};
  }
  try{return {status:200,headers:{},data:{data:response(found[0],path,request.body?JSON.parse(String(request.body)):null)}};}
  catch(error){return {status:409,headers:{},data:{code:error instanceof Error&&error.message==='UPLOAD_NOT_COMPLETE'?'UPLOAD_NOT_COMPLETE':'PREVIEW_ONLY',message:'该操作需要真实服务，本回放不执行'}};}
};
let photoSequence=0;
export const previewHost:HostPort={platform:'alipay',transport,
  observeVisibility(nodeId,onRatio){
    const target=document.getElementById(nodeId);if(!target||typeof IntersectionObserver==='undefined')return()=>{};
    const observer=new IntersectionObserver(values=>{for(const value of values)onRatio(document.hidden?0:value.intersectionRatio);},{threshold:[0,.5,1]});
    const visibility=()=>{observer.disconnect();onRatio(0);if(!document.hidden)observer.observe(target);};
    visibility();document.addEventListener('visibilitychange',visibility);
    return()=>{observer.disconnect();document.removeEventListener('visibilitychange',visibility);};
  },storage:{get:<T>(key:string)=>(memory.get(key)??null) as T|null,set:(k,v)=>{memory.set(k,v);},remove:k=>{memory.delete(k);}},
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
  upload:async grant=>{if(!supportScenario||!supportAssets.has(grant.asset_id))throw new Error('Browser replay cannot upload private photos');supportTrace.uploads++;supportAssets.set(grant.asset_id,true);},pay:async()=>{throw new Error('Browser replay cannot perform payments');},
  download:async link=>albumScenario?link.deliverable_id:link.url,save:async(path)=>{
    if(!albumScenario)return 'UNKNOWN';albumTrace.saves.push(path);const attempt=(albumAttempts.get(path)??0)+1;albumAttempts.set(path,attempt);
    await new Promise(done=>setTimeout(done,120));
    if(path==='demo_image_detail'&&attempt===1){const {ClientError}=await import('../shared/client/api');throw new ClientError('ALBUM_PERMISSION_DENIED','Synthetic permission rejection');}
    return path==='demo_video'&&attempt===1?'UNKNOWN':'SAVED';
  },copy:async text=>{await navigator.clipboard.writeText(text);}};
export function attachPreview(client:{attach(session:DTO<'Session'>):void;remember(ids:Record<string,string>):void}){
  client.attach(session as DTO<'Session'>);client.remember({productId:'demo_product',analysisId:'demo_analysis',planId:'demo_plan',orderId:'demo_order'});
  if(new URLSearchParams(location.search).get('scenario')==='draft-resume'){
    const variant=first.execution_variants[0]!;
    client.remember({presetId:first.preset_id,presetVersion:first.version,variantId:variant.variant_id,variantVersion:variant.version});
  }
}
