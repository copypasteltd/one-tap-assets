import type {Db} from '../db/pool.js';
import type {Config} from '../config.js';
import type {DTO,Principal} from '../../shared/contracts/types.js';
import {owned,type PageQuery} from '../db/store.js';
import {hash,id,iso} from '../lib/crypto.js';
import {requireThat,notFound} from '../lib/errors.js';
import {cursor,limit} from '../lib/pagination.js';
import {getDeliverables} from './delivery.js';
import {lockMediaOwner} from './media-access.js';

function plus(p:Principal){requireThat(!!p.plusSessionId,'PLUS_SESSION_REQUIRED','请先在小程序确认当前电脑连接',403);}
export function validatePlusSettings(s:DTO<'PlusEditSettings'>):void{
  const c=s.crop;
  requireThat([c.x,c.y,c.width,c.height].every(Number.isFinite)&&c.x>=0&&c.y>=0&&c.width>=.01&&c.height>=.01
    &&c.x+c.width<=1+1e-9&&c.y+c.height<=1+1e-9,'PLUS_CROP_INVALID','裁切区域需完整位于图片内',422);
  requireThat(Number.isInteger(s.canvas.width)&&Number.isInteger(s.canvas.height)&&s.canvas.width>=256&&s.canvas.height>=256
    &&s.canvas.width<=3840&&s.canvas.height<=3840&&s.canvas.width*s.canvas.height<=8294400,'PLUS_CANVAS_INVALID','规格需在256至3840像素内，且总像素不超过4K画面',422);
}
async function source(db:Db,p:Principal,orderId:string,deliverableId:string){
  plus(p);await lockMediaOwner(db,p.tenantId,p.userId);
  const order=await owned<DTO<'Order'>>(db,'orders',orderId,p);
  requireThat(order.payment_state==='CONFIRMED','PLUS_SOURCE_UNAVAILABLE','原素材包暂不可用于进阶编辑',410);
  const product=(await db.query<{product_id:string}>('SELECT product_id FROM privacy_order_scope WHERE tenant_id=$1 AND owner_id=$2 AND id=$3',[p.tenantId,p.userId,orderId])).rows[0]??notFound();
  await owned(db,'product_drafts',product.product_id,p);
  const pack=await getDeliverables(db,p,orderId),item=pack.items.find(i=>i.deliverable_id===deliverableId);
  requireThat(item?.kind==='image','PLUS_IMAGE_REQUIRED','请从本人当前素材包中选择一张图片',422);
  return{pack,item:item!,productId:product.product_id};
}
export async function createPlusEditDraft(db:Db,p:Principal,request:DTO<'PlusEditCreateRequest'>):Promise<DTO<'PlusEditDraft'>>{
  const s=await source(db,p,request.order_id,request.deliverable_id);
  const old=(await db.query<{data:DTO<'PlusEditDraft'>}>('SELECT data FROM plus_edit_drafts WHERE tenant_id=$1 AND owner_id=$2 AND manifest_id=$3 AND deliverable_id=$4',[p.tenantId,p.userId,s.pack.manifest_id,request.deliverable_id])).rows[0];
  if(old)return old.data;
  const count=(await db.query('SELECT id FROM plus_edit_drafts WHERE tenant_id=$1 AND owner_id=$2',[p.tenantId,p.userId]));
  requireThat(count.rows.length<100,'PLUS_DRAFT_LIMIT','当前最多保存100份编辑草稿',422);
  let width=Math.max(256,Math.min(3840,s.item.width??1080)),height=Math.max(256,Math.min(3840,s.item.height??1080));
  if(width*height>8294400){const ratio=Math.sqrt(8294400/(width*height));width=Math.floor(width*ratio);height=Math.floor(height*ratio);}
  const now=iso(),draft:DTO<'PlusEditDraft'>={draft_id:id('plusdraft'),order_id:request.order_id,product_id:s.productId,manifest_id:s.pack.manifest_id,
    manifest_revision:s.pack.manifest_revision,deliverable_id:request.deliverable_id,source_sha256:s.item.sha256,revision:1,
    settings:{crop:{x:0,y:0,width:1,height:1},canvas:{width,height},title:'',brand:'',facts:[]},fact_status:'USER_PROVIDED_UNVERIFIED',state:'DRAFT',created_at:now,updated_at:now};
  await db.query(`INSERT INTO plus_edit_drafts(id,tenant_id,owner_id,order_id,product_id,manifest_id,deliverable_id,revision,data)
    VALUES($1,$2,$3,$4,$5,$6,$7,1,$8)`,[draft.draft_id,p.tenantId,p.userId,draft.order_id,draft.product_id,draft.manifest_id,draft.deliverable_id,JSON.stringify(draft)]);
  await db.query('INSERT INTO plus_edit_versions(draft_id,revision,settings_hash,settings) VALUES($1,1,$2,$3)',[draft.draft_id,hash(draft.settings),JSON.stringify(draft.settings)]);
  return draft;
}
export async function getPlusEditDraft(db:Db,p:Principal,draftId:string):Promise<DTO<'PlusEditDraft'>>{
  plus(p);await lockMediaOwner(db,p.tenantId,p.userId);
  const row=(await db.query<{data:DTO<'PlusEditDraft'>}>('SELECT data FROM plus_edit_drafts WHERE tenant_id=$1 AND owner_id=$2 AND id=$3',[p.tenantId,p.userId,draftId])).rows[0]??notFound();
  const s=await source(db,p,row.data.order_id,row.data.deliverable_id);
  requireThat(row.data.manifest_id===s.pack.manifest_id&&row.data.source_sha256===s.item.sha256,'PLUS_SOURCE_CHANGED','原素材已有新版本，请从新素材重新建立编辑草稿',409);
  return row.data;
}
export async function savePlusEditDraft(db:Db,p:Principal,draftId:string,request:DTO<'PlusEditSaveRequest'>):Promise<DTO<'PlusEditDraft'>>{
  validatePlusSettings(request.settings);const current=await getPlusEditDraft(db,p,draftId);
  if(hash(request.settings)===hash(current.settings))return current;
  requireThat(current.revision===request.expected_revision,'PLUS_DRAFT_CONFLICT','草稿已在另一处更新，请读取后重新编辑',409);
  const draft={...current,revision:current.revision+1,settings:request.settings,updated_at:iso()};
  await db.query('INSERT INTO plus_edit_versions(draft_id,revision,settings_hash,settings) VALUES($1,$2,$3,$4)',[draftId,draft.revision,hash(draft.settings),JSON.stringify(draft.settings)]);
  await db.query('UPDATE plus_edit_drafts SET revision=$1,data=$2,updated_at=now() WHERE tenant_id=$3 AND owner_id=$4 AND id=$5',[draft.revision,JSON.stringify(draft),p.tenantId,p.userId,draftId]);
  return draft;
}
export async function listPlusEditDrafts(db:Db,cfg:Config,p:Principal,query:PageQuery):Promise<DTO<'PlusEditList'>>{
  plus(p);const scope=`plus-drafts:${p.tenantId}:${p.userId}`,size=limit(query.limit),point=cursor.decode(cfg,query.cursor,scope);
  const rows=(await db.query<{id:string;created_at:Date;data:DTO<'PlusEditDraft'>}>(`SELECT d.id,d.created_at,d.data FROM plus_edit_drafts d
    JOIN product_drafts p ON p.tenant_id=d.tenant_id AND p.id=d.product_id JOIN orders o ON o.tenant_id=d.tenant_id AND o.id=d.order_id
    JOIN delivery_manifests m ON m.tenant_id=d.tenant_id AND m.id=d.manifest_id
    WHERE d.tenant_id=$1 AND d.owner_id=$2 AND p.deleted_at IS NULL AND p.expires_at>now() AND o.payment_state='CONFIRMED'
      AND o.fulfillment_state='DELIVERED' AND o.private->>'media_revoked' IS DISTINCT FROM 'true' AND m.expires_at>now()
      AND NOT EXISTS(SELECT 1 FROM delivery_manifests later WHERE later.tenant_id=d.tenant_id AND later.order_id=d.order_id AND later.revision>m.revision)
      AND ($3::timestamptz IS NULL OR (d.created_at,d.id)<($3,$4)) ORDER BY d.created_at DESC,d.id DESC LIMIT $5`,[p.tenantId,p.userId,point?.createdAt??null,point?.id??null,size+1])).rows;
  const slice=rows.slice(0,size),last=slice.at(-1);return{items:slice.map(r=>r.data),next_cursor:rows.length>size&&last?cursor.encode(cfg,{createdAt:last.created_at.toISOString(),id:last.id},scope):null};
}
