import type {Db} from '../db/pool.js';
import type {Config} from '../config.js';
import type {DTO,Principal} from '../../shared/contracts/types.js';
import type {FrozenContract} from '../../worker/compiler/snapshot.js';
import type {VariantSource} from './catalog.js';
import {getVariant} from './catalog.js';
import {id,hash} from '../lib/crypto.js';
import {requireThat,notFound} from '../lib/errors.js';
import {cursor,limit} from '../lib/pagination.js';
import type {PageQuery} from '../db/store.js';
import {lockMediaOwner} from './media-access.js';
import {getPlusEditDraft} from './plus-edits.js';
import {assertPlusRenderGrant} from './plus-access.js';
import {createPlan} from './plans.js';
import {frozenAiDisclosure} from '../../worker/compiler/disclosure.js';
import {verifyPlusRenderSource} from './plus-render-source.js';
import {PLUS_RENDER_VERSION,type PlusRenderBinding} from '../../shared/domain/plus-render.js';

export function plusRenderPricing(cfg:Config){
  const p=cfg.plusRender;
  requireThat(p.enabled&&Number.isSafeInteger(p.priceFen)&&p.priceFen>0&&p.priceFen<=2147483647&&/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(p.pricingVersion),
    'PLUS_RENDER_NOT_ADMITTED','进阶图片的独立制作与价格尚未开放，编辑草稿可继续保存',503);
  return {amount_fen:p.priceFen,version:p.pricingVersion};
}
export async function listPlusRenderStyles(db:Db,cfg:Config):Promise<DTO<'PlusRenderStyleList'>> {
  const rows=(await db.query<{preset_id:string;preset_version:string;data:DTO<'Variant'>;private:{source:VariantSource}}>(
    `SELECT pv.preset_id,pv.version preset_version,v.data,v.private FROM execution_variants v
     JOIN preset_versions pv ON pv.id=v.preset_version_id JOIN presets p ON p.id=pv.preset_id
     WHERE p.visibility='PUBLIC' AND v.engine='PHOTO_LAYOUT'
     ORDER BY CASE WHEN pv.data->'preset'->>'source'='OFFICIAL' THEN 0 ELSE 1 END,pv.preset_id,pv.version DESC,v.variant_id LIMIT 100`)).rows;
  let pricing:ReturnType<typeof plusRenderPricing>|null=null;try{pricing=plusRenderPricing(cfg);}catch{/* Keep draft-only browsing available. */}
  return {items:rows.map(row=>({preset_id:row.preset_id,preset_version:row.preset_version,variant_id:row.data.variant_id,variant_version:row.data.version,name:row.data.name,
    sale_enabled:!!pricing&&cfg.paymentsEnabled&&cfg.codex.enabled&&row.data.sale_enabled&&row.data.admission_state==='ADMITTED',price_fen:pricing?.amount_fen??null,
    reason_codes:!pricing?['PLUS_RENDER_NOT_ADMITTED']:!row.data.sale_enabled||row.data.admission_state!=='ADMITTED'?['VARIANT_NOT_FOR_SALE']:
      !cfg.paymentsEnabled||!cfg.codex.enabled?['SERVICE_NOT_ADMITTED']:[]}))};
}
interface RenderRow {id:string;draft_id:string;draft_revision:number;source_order_id:string;plan_id:string;binding:PlusRenderBinding;created_at:Date;plan:DTO<'Plan'>}
async function dto(db:Db,p:Principal,row:RenderRow):Promise<DTO<'PlusRenderPlan'>> {
  const order=(await db.query<{data:DTO<'Order'>;delivery_expires_at:Date|null}>(`SELECT o.data,o.delivery_expires_at FROM orders o JOIN quotes q ON q.tenant_id=o.tenant_id AND q.id=o.quote_id
    WHERE o.tenant_id=$1 AND o.owner_id=$2 AND q.plan_id=$3 ORDER BY o.created_at DESC,o.id DESC LIMIT 1`,[p.tenantId,p.userId,row.plan_id])).rows[0];
  return {request_id:row.id,draft_id:row.draft_id,draft_revision:row.draft_revision,source_order_id:row.source_order_id,created_at:row.created_at.toISOString(),
    settings:row.binding.settings,price_fen:row.binding.pricing.amount_fen,pricing_version:row.binding.pricing.version,plan:row.plan,
    order:order?{...order.data,...(order.delivery_expires_at?{delivery_expires_at:order.delivery_expires_at.toISOString()}:{})}:null};
}
const visible=`SELECT r.*,v.data plan FROM plus_render_plans r JOIN plan_versions v ON v.tenant_id=r.tenant_id AND v.id=r.plan_id
 JOIN product_drafts p ON p.tenant_id=r.tenant_id AND p.id=r.product_id
 WHERE r.tenant_id=$1 AND r.owner_id=$2 AND p.deleted_at IS NULL AND p.expires_at>now()`;
export async function getPlusRenderPlan(db:Db,p:Principal,requestId:string):Promise<DTO<'PlusRenderPlan'>> {
  const row=(await db.query<RenderRow>(visible+' AND r.id=$3',[p.tenantId,p.userId,requestId])).rows[0]??notFound();return dto(db,p,row);
}
export async function listPlusRenderPlans(db:Db,cfg:Config,p:Principal,q:PageQuery):Promise<DTO<'PlusRenderPlanList'>> {
  const scope=`plus-render:${p.tenantId}:${p.userId}`,size=limit(q.limit),point=cursor.decode(cfg,q.cursor,scope);
  const rows=(await db.query<RenderRow>(visible+` AND ($3::timestamptz IS NULL OR (r.created_at,r.id)<($3,$4)) ORDER BY r.created_at DESC,r.id DESC LIMIT $5`,
    [p.tenantId,p.userId,point?.createdAt??null,point?.id??null,size+1])).rows;
  const selected=rows.slice(0,size),last=selected.at(-1);return {items:await Promise.all(selected.map(row=>dto(db,p,row))),
    next_cursor:rows.length>size&&last?cursor.encode(cfg,{createdAt:last.created_at.toISOString(),id:last.id},scope):null};
}
export async function createPlusRenderPlan(db:Db,cfg:Config,p:Principal,draftId:string,request:DTO<'PlusRenderCreateRequest'>):Promise<DTO<'PlusRenderPlan'>> {
  await lockMediaOwner(db,p.tenantId,p.userId);await assertPlusRenderGrant(db,p);const pricing=plusRenderPricing(cfg);
  requireThat(cfg.paymentsEnabled&&cfg.codex.enabled,'SERVICE_NOT_ADMITTED','正式制作与交易服务尚未开放',503);
  const draft=await getPlusEditDraft(db,p,draftId);
  requireThat(draft.revision===request.expected_revision,'PLUS_DRAFT_CONFLICT','编辑草稿已更新，请读取后确认新的制作版本',409);
  const variant=await getVariant(db,request.variant_id,request.variant_version);
  requireThat(variant.data.engine==='PHOTO_LAYOUT'&&variant.data.sale_enabled&&variant.data.admission_state==='ADMITTED',
    'VARIANT_NOT_FOR_SALE','所选图片风格尚未开放制作',422);
  const rows=(await db.query<{private:{contract:FrozenContract;contract_hash:string};object_key:string;data:DTO<'Deliverables'>;expires_at:Date}>(
    `SELECT o.private,a.object_key,m.data,m.expires_at FROM orders o JOIN delivery_manifests m ON m.tenant_id=o.tenant_id AND m.order_id=o.id
     JOIN artifacts a ON a.tenant_id=o.tenant_id AND a.order_id=o.id WHERE o.tenant_id=$1 AND o.owner_id=$2 AND o.id=$3 AND m.id=$4 AND a.id=$5`,
    [p.tenantId,p.userId,draft.order_id,draft.manifest_id,draft.deliverable_id])).rows[0]??notFound();
  const original=rows.private.contract,item=rows.data.items.find(x=>x.deliverable_id===draft.deliverable_id);
  requireThat(original&&hash(original)===rows.private.contract_hash&&item?.width&&item.height&&Number.isSafeInteger(item.size_bytes)&&item.size_bytes!>0,'PLUS_SOURCE_CONTRACT_CHANGED','原素材缺少完整制作合同或尺寸证明',503);
  const b:PlusRenderBinding={version:PLUS_RENDER_VERSION,draft_id:draftId,draft_revision:draft.revision,settings:structuredClone(draft.settings),settings_hash:hash(draft.settings),
    source_order_id:draft.order_id,source_product_id:draft.product_id,source_manifest_id:draft.manifest_id,source_manifest_revision:draft.manifest_revision,source_manifest_hash:hash(rows.data),
    source_artifact_id:draft.deliverable_id,source_sha256:draft.source_sha256,source_bytes:item!.size_bytes!,source_width:item!.width!,source_height:item!.height!,source_object_key:rows.object_key,
    source_contract_hash:rows.private.contract_hash,source_expires_at:rows.expires_at.toISOString(),inherits_ai:!!frozenAiDisclosure(original),base_source_hash:hash(variant.private.source),pricing};
  await verifyPlusRenderSource(db,p.tenantId,p.userId,b,true,1200);
  const inputHash=hash({binding:b,variant_id:variant.id}),prior=(await db.query<{id:string}>('SELECT id FROM plus_render_plans WHERE tenant_id=$1 AND owner_id=$2 AND input_hash=$3',[p.tenantId,p.userId,inputHash])).rows[0];
  if(prior)return getPlusRenderPlan(db,p,prior.id);
  const preset=(await db.query<{preset_id:string;version:string}>('SELECT preset_id,version FROM preset_versions WHERE id=$1',[variant.preset_version_id])).rows[0]??notFound();
  const plan=await createPlan(db,cfg,p,{product_id:draft.product_id,profile_id:original.profile.profile_id,photo_version:original.profile.photo_version,
    identity_lock_id:original.profile.identity_lock_id,preset_id:preset.preset_id,preset_version:preset.version,variant_id:request.variant_id,variant_version:request.variant_version},b);
  const requestId=id('plusrender');plan.plus_render_request_id=requestId;
  await db.query('UPDATE plan_versions SET data=$1 WHERE tenant_id=$2 AND id=$3',[JSON.stringify(plan),p.tenantId,plan.plan_id]);
  await db.query(`INSERT INTO plus_render_plans(id,tenant_id,owner_id,product_id,draft_id,draft_revision,source_order_id,plan_id,input_hash,binding)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,[requestId,p.tenantId,p.userId,draft.product_id,draftId,draft.revision,draft.order_id,plan.plan_id,inputHash,JSON.stringify(b)]);
  return getPlusRenderPlan(db,p,requestId);
}
