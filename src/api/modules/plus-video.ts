import type {Db} from '../db/pool.js';
import type {Config} from '../config.js';
import type {DTO,Principal} from '../../shared/contracts/types.js';
import type {FrozenContract} from '../../worker/compiler/snapshot.js';
import type {MediaInspection} from '../../worker/media/native.js';
import {owned,type PageQuery} from '../db/store.js';
import {id,hash,iso} from '../lib/crypto.js';
import {requireThat,notFound} from '../lib/errors.js';
import {cursor,limit} from '../lib/pagination.js';
import {getDeliverables} from './delivery.js';
import {lockMediaOwner} from './media-access.js';
import {getVariant} from './catalog.js';
import {listPlusRenderStyles} from './plus-render.js';
import {assertPlusVideoGrant} from './plus-access.js';
import {verifyPlusRenderSource} from './plus-render-source.js';
import {createPlan} from './plans.js';
import {frozenAiDisclosure} from '../../worker/compiler/disclosure.js';
import {PLUS_VIDEO_VERSION,validatePlusVideoSettings,type PlusVideoBinding} from '../../shared/domain/plus-video.js';

function browser(p:Principal){requireThat(!!p.plusSessionId,'PLUS_SESSION_REQUIRED','请先在小程序确认当前电脑连接',403);}
async function source(db:Db,p:Principal,orderId:string,itemId:string){
  browser(p);await lockMediaOwner(db,p.tenantId,p.userId);const order=await owned<DTO<'Order'>>(db,'orders',orderId,p);
  requireThat(order.payment_state==='CONFIRMED','PLUS_SOURCE_UNAVAILABLE','原素材暂不可用于进阶编辑',410);
  const scope=(await db.query<{product_id:string}>('SELECT product_id FROM privacy_order_scope WHERE tenant_id=$1 AND owner_id=$2 AND id=$3',[p.tenantId,p.userId,orderId])).rows[0]??notFound();
  await owned(db,'product_drafts',scope.product_id,p);const pack=await getDeliverables(db,p,orderId),item=pack.items.find(x=>x.deliverable_id===itemId);
  requireThat(item?.kind==='video','PLUS_VIDEO_REQUIRED','请选择本人当前素材包中的视频',422);
  const artifact=(await db.query<{object_key:string;sha256:string;spec:{inspection:MediaInspection}}>('SELECT object_key,sha256,spec_json AS spec FROM artifacts WHERE tenant_id=$1 AND order_id=$2 AND id=$3',[p.tenantId,orderId,itemId])).rows[0]??notFound();
  const v=artifact.spec.inspection;
  requireThat(v.kind==='video'&&v.codec==='h264'&&v.pixelFormat==='yuv420p'&&v.fps===30&&Number.isSafeInteger(v.frames)&&v.frames!>=30&&v.frames!<=3600
    &&v.width===item!.width&&v.height===item!.height&&v.bytes===item!.size_bytes&&v.bytes>0&&v.bytes<=512000000&&artifact.sha256===item!.sha256
    &&(!v.hasAudio||v.audioCodec==='aac'),'PLUS_VIDEO_SOURCE_INVALID','原视频缺少可核对的H.264/30帧规格或实际音轨信息',422);
  const meta:DTO<'PlusVideoSource'>={width:v.width,height:v.height,fps:30,frames:v.frames!,has_audio:v.hasAudio,size_bytes:v.bytes};
  return {pack,item:item!,productId:scope.product_id,artifact,meta};
}
export async function createPlusVideoDraft(db:Db,p:Principal,request:DTO<'PlusEditCreateRequest'>):Promise<DTO<'PlusVideoDraft'>>{
  const s=await source(db,p,request.order_id,request.deliverable_id);
  const old=(await db.query<{data:DTO<'PlusVideoDraft'>}>(`SELECT data FROM plus_edit_drafts WHERE tenant_id=$1 AND owner_id=$2 AND manifest_id=$3 AND deliverable_id=$4 AND media_kind='video'`,[p.tenantId,p.userId,s.pack.manifest_id,request.deliverable_id])).rows[0];if(old)return old.data;
  requireThat((await db.query('SELECT id FROM plus_edit_drafts WHERE tenant_id=$1 AND owner_id=$2',[p.tenantId,p.userId])).rows.length<100,'PLUS_DRAFT_LIMIT','当前最多保存100份编辑草稿',422);
  const scale=Math.min(1,1920/s.meta.width,1920/s.meta.height,Math.sqrt(2073600/(s.meta.width*s.meta.height)));
  const width=Math.max(256,Math.floor(s.meta.width*scale/2)*2),height=Math.max(256,Math.floor(s.meta.height*scale/2)*2),now=iso();
  const draft:DTO<'PlusVideoDraft'>={draft_id:id('plusdraft'),order_id:request.order_id,product_id:s.productId,manifest_id:s.pack.manifest_id,
    manifest_revision:s.pack.manifest_revision,deliverable_id:request.deliverable_id,source_sha256:s.item.sha256,revision:1,media_kind:'video',source:s.meta,
    settings:{crop:{x:0,y:0,width:1,height:1},canvas:{width,height},title:'',brand:'',facts:[],trim:{start_frame:0,end_frame:Math.min(1800,s.meta.frames)},audio_mode:'PRESERVE',captions:[]},
    fact_status:'USER_PROVIDED_UNVERIFIED',state:'DRAFT',created_at:now,updated_at:now};
  validatePlusVideoSettings(draft.settings,s.meta.frames);
  await db.query(`INSERT INTO plus_edit_drafts(id,tenant_id,owner_id,order_id,product_id,manifest_id,deliverable_id,revision,data,media_kind)
    VALUES($1,$2,$3,$4,$5,$6,$7,1,$8,'video')`,[draft.draft_id,p.tenantId,p.userId,draft.order_id,draft.product_id,draft.manifest_id,draft.deliverable_id,JSON.stringify(draft)]);
  await db.query('INSERT INTO plus_edit_versions(draft_id,revision,settings_hash,settings) VALUES($1,1,$2,$3)',[draft.draft_id,hash(draft.settings),JSON.stringify(draft.settings)]);return draft;
}
export async function getPlusVideoDraft(db:Db,p:Principal,draftId:string):Promise<DTO<'PlusVideoDraft'>>{
  browser(p);await lockMediaOwner(db,p.tenantId,p.userId);
  const row=(await db.query<{data:DTO<'PlusVideoDraft'>}>(`SELECT data FROM plus_edit_drafts WHERE tenant_id=$1 AND owner_id=$2 AND id=$3 AND media_kind='video'`,[p.tenantId,p.userId,draftId])).rows[0]??notFound();
  const s=await source(db,p,row.data.order_id,row.data.deliverable_id);
  requireThat(row.data.manifest_id===s.pack.manifest_id&&row.data.manifest_revision===s.pack.manifest_revision&&row.data.source_sha256===s.item.sha256&&hash(row.data.source)===hash(s.meta),
    'PLUS_SOURCE_CHANGED','原视频已有新版本或规格变化，请从新素材建立草稿',409);return row.data;
}
export async function savePlusVideoDraft(db:Db,p:Principal,draftId:string,request:DTO<'PlusVideoSaveRequest'>):Promise<DTO<'PlusVideoDraft'>>{
  const current=await getPlusVideoDraft(db,p,draftId);validatePlusVideoSettings(request.settings,current.source.frames);
  if(hash(request.settings)===hash(current.settings))return current;
  requireThat(current.revision===request.expected_revision,'PLUS_DRAFT_CONFLICT','视频草稿已更新，请读取后重新编辑',409);
  const next:DTO<'PlusVideoDraft'>={...current,revision:current.revision+1,settings:request.settings,updated_at:iso()};
  await db.query('INSERT INTO plus_edit_versions(draft_id,revision,settings_hash,settings) VALUES($1,$2,$3,$4)',[draftId,next.revision,hash(next.settings),JSON.stringify(next.settings)]);
  await db.query('UPDATE plus_edit_drafts SET revision=$1,data=$2,updated_at=now() WHERE tenant_id=$3 AND owner_id=$4 AND id=$5',[next.revision,JSON.stringify(next),p.tenantId,p.userId,draftId]);return next;
}
export async function listPlusVideoDrafts(db:Db,cfg:Config,p:Principal,q:PageQuery):Promise<DTO<'PlusVideoList'>>{
  browser(p);const scope=`plus-video-drafts:${p.tenantId}:${p.userId}`,size=limit(q.limit),point=cursor.decode(cfg,q.cursor,scope);
  const rows=(await db.query<{id:string;created_at:Date;data:DTO<'PlusVideoDraft'>}>(`SELECT d.id,d.created_at,d.data FROM plus_edit_drafts d
    JOIN product_drafts p ON p.tenant_id=d.tenant_id AND p.id=d.product_id JOIN orders o ON o.tenant_id=d.tenant_id AND o.id=d.order_id
    JOIN delivery_manifests m ON m.tenant_id=d.tenant_id AND m.id=d.manifest_id WHERE d.tenant_id=$1 AND d.owner_id=$2 AND d.media_kind='video'
    AND p.deleted_at IS NULL AND p.expires_at>now() AND o.payment_state='CONFIRMED' AND o.fulfillment_state='DELIVERED'
    AND o.private->>'media_revoked' IS DISTINCT FROM 'true' AND m.expires_at>now()
    AND NOT EXISTS(SELECT 1 FROM delivery_manifests n WHERE n.tenant_id=d.tenant_id AND n.order_id=d.order_id AND n.revision>m.revision)
    AND ($3::timestamptz IS NULL OR (d.created_at,d.id)<($3,$4)) ORDER BY d.created_at DESC,d.id DESC LIMIT $5`,[p.tenantId,p.userId,point?.createdAt??null,point?.id??null,size+1])).rows;
  const slice=rows.slice(0,size),last=slice.at(-1);return {items:slice.map(v=>v.data),next_cursor:rows.length>size&&last?cursor.encode(cfg,{createdAt:last.created_at.toISOString(),id:last.id},scope):null};
}
export function plusVideoPricing(cfg:Config){const p=cfg.plusVideoRender;
  requireThat(p.enabled&&Number.isSafeInteger(p.priceFen)&&p.priceFen>0&&p.priceFen<=2147483647&&/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(p.pricingVersion),
    'PLUS_VIDEO_NOT_ADMITTED','视频独立编辑制作与价格尚未开放，草稿可继续保存',503);
  requireThat(Number.isSafeInteger(p.budgetMicro)&&p.budgetMicro>0&&p.budgetMicro<=1000000000000,'PLUS_VIDEO_BUDGET_NOT_ADMITTED','视频制作的原费用上限尚未配置，草稿可继续保存',503);
  return {amount_fen:p.priceFen,version:p.pricingVersion,budget_micro:p.budgetMicro,listening_model_version_id:p.listeningModelVersionId||null};}
export function listPlusVideoStyles(db:Db,cfg:Config){const p=cfg.plusVideoRender;
  return listPlusRenderStyles(db,{...cfg,plusRender:{...p,enabled:p.enabled&&Number.isSafeInteger(p.budgetMicro)&&p.budgetMicro>0&&p.budgetMicro<=1000000000000}});}
const visible=`SELECT r.*,v.data plan FROM plus_render_plans r JOIN plan_versions v ON v.tenant_id=r.tenant_id AND v.id=r.plan_id
 JOIN product_drafts p ON p.tenant_id=r.tenant_id AND p.id=r.product_id WHERE r.tenant_id=$1 AND r.owner_id=$2 AND r.media_kind='video' AND p.deleted_at IS NULL AND p.expires_at>now()`;
interface Row{id:string;draft_id:string;draft_revision:number;source_order_id:string;plan_id:string;binding:PlusVideoBinding;created_at:Date;plan:DTO<'Plan'>}
async function dto(db:Db,p:Principal,row:Row):Promise<DTO<'PlusVideoRenderPlan'>>{
  const order=(await db.query<{data:DTO<'Order'>;delivery_expires_at:Date|null}>(`SELECT o.data,o.delivery_expires_at FROM orders o JOIN quotes q ON q.tenant_id=o.tenant_id AND q.id=o.quote_id
    WHERE o.tenant_id=$1 AND o.owner_id=$2 AND q.plan_id=$3 ORDER BY o.created_at DESC,o.id DESC LIMIT 1`,[p.tenantId,p.userId,row.plan_id])).rows[0];
  return {request_id:row.id,draft_id:row.draft_id,draft_revision:row.draft_revision,source_order_id:row.source_order_id,created_at:row.created_at.toISOString(),settings:row.binding.settings,
    price_fen:row.binding.pricing.amount_fen,pricing_version:row.binding.pricing.version,plan:row.plan,order:order?{...order.data,...(order.delivery_expires_at?{delivery_expires_at:order.delivery_expires_at.toISOString()}:{})}:null};
}
export async function getPlusVideoPlan(db:Db,p:Principal,requestId:string):Promise<DTO<'PlusVideoRenderPlan'>>{return dto(db,p,(await db.query<Row>(visible+' AND r.id=$3',[p.tenantId,p.userId,requestId])).rows[0]??notFound());}
export async function listPlusVideoPlans(db:Db,cfg:Config,p:Principal,q:PageQuery):Promise<DTO<'PlusVideoRenderPlanList'>>{
  const scope=`plus-video-plans:${p.tenantId}:${p.userId}`,size=limit(q.limit),point=cursor.decode(cfg,q.cursor,scope);
  const rows=(await db.query<Row>(visible+' AND ($3::timestamptz IS NULL OR (r.created_at,r.id)<($3,$4)) ORDER BY r.created_at DESC,r.id DESC LIMIT $5',[p.tenantId,p.userId,point?.createdAt??null,point?.id??null,size+1])).rows;
  const slice=rows.slice(0,size),last=slice.at(-1);return {items:await Promise.all(slice.map(row=>dto(db,p,row))),next_cursor:rows.length>size&&last?cursor.encode(cfg,{createdAt:last.created_at.toISOString(),id:last.id},scope):null};
}
export async function createPlusVideoPlan(db:Db,cfg:Config,p:Principal,draftId:string,request:DTO<'PlusRenderCreateRequest'>):Promise<DTO<'PlusVideoRenderPlan'>>{
  await lockMediaOwner(db,p.tenantId,p.userId);await assertPlusVideoGrant(db,p);const pricing=plusVideoPricing(cfg);
  requireThat(cfg.paymentsEnabled&&cfg.codex.enabled,'SERVICE_NOT_ADMITTED','正式制作与交易服务尚未开放',503);
  const draft=await getPlusVideoDraft(db,p,draftId);requireThat(draft.revision===request.expected_revision,'PLUS_DRAFT_CONFLICT','视频草稿已更新，请重新核对制作版本',409);
  const variant=await getVariant(db,request.variant_id,request.variant_version);
  requireThat(variant.data.engine==='PHOTO_LAYOUT'&&variant.data.sale_enabled&&variant.data.admission_state==='ADMITTED','VARIANT_NOT_FOR_SALE','所选视频编辑风格尚未开放',422);
  const s=await source(db,p,draft.order_id,draft.deliverable_id);
  const row=(await db.query<{private:{contract:FrozenContract;contract_hash:string}}>('SELECT private FROM orders WHERE tenant_id=$1 AND owner_id=$2 AND id=$3',[p.tenantId,p.userId,draft.order_id])).rows[0]??notFound();
  const original=row.private.contract;requireThat(original&&hash(original)===row.private.contract_hash,'PLUS_SOURCE_CONTRACT_CHANGED','原视频的制作合同证明不完整',503);
  const binding:PlusVideoBinding={version:PLUS_VIDEO_VERSION,draft_id:draftId,draft_revision:draft.revision,settings:structuredClone(draft.settings),settings_hash:hash(draft.settings),
    source_order_id:draft.order_id,source_product_id:draft.product_id,source_manifest_id:draft.manifest_id,source_manifest_revision:draft.manifest_revision,source_manifest_hash:hash(s.pack),
    source_artifact_id:draft.deliverable_id,source_sha256:draft.source_sha256,source_bytes:s.meta.size_bytes,source_width:s.meta.width,source_height:s.meta.height,source_object_key:s.artifact.object_key,
    source_contract_hash:row.private.contract_hash,source_expires_at:s.pack.expires_at,inherits_ai:!!frozenAiDisclosure(original),base_source_hash:hash(variant.private.source),pricing,
    source_frames:s.meta.frames,source_fps:30,source_has_audio:s.meta.has_audio,source_inspection_hash:hash(s.artifact.spec.inspection)};
  await verifyPlusRenderSource(db,p.tenantId,p.userId,binding,true,1200);
  const inputHash=hash({binding,variant_id:variant.id}),old=(await db.query<{id:string}>(`SELECT id FROM plus_render_plans WHERE tenant_id=$1 AND owner_id=$2 AND input_hash=$3 AND media_kind='video'`,[p.tenantId,p.userId,inputHash])).rows[0];if(old)return getPlusVideoPlan(db,p,old.id);
  const preset=(await db.query<{preset_id:string;version:string}>('SELECT preset_id,version FROM preset_versions WHERE id=$1',[variant.preset_version_id])).rows[0]??notFound();
  const plan=await createPlan(db,cfg,p,{product_id:draft.product_id,profile_id:original.profile.profile_id,photo_version:original.profile.photo_version,identity_lock_id:original.profile.identity_lock_id,
    preset_id:preset.preset_id,preset_version:preset.version,variant_id:request.variant_id,variant_version:request.variant_version},binding);
  const requestId=id('plusvideo');plan.plus_video_request_id=requestId;await db.query('UPDATE plan_versions SET data=$1 WHERE tenant_id=$2 AND id=$3',[JSON.stringify(plan),p.tenantId,plan.plan_id]);
  await db.query(`INSERT INTO plus_render_plans(id,tenant_id,owner_id,product_id,draft_id,draft_revision,source_order_id,plan_id,input_hash,binding,media_kind)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'video')`,[requestId,p.tenantId,p.userId,draft.product_id,draftId,draft.revision,draft.order_id,plan.plan_id,inputHash,JSON.stringify(binding)]);
  return getPlusVideoPlan(db,p,requestId);
}
