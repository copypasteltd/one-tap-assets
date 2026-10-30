import type {Db} from '../db/pool.js';
import type {PlusWorkBinding} from '../../shared/domain/plus-work.js';
import {PLUS_VIDEO_VERSION} from '../../shared/domain/plus-video.js';
import type {MediaInspection} from '../../worker/media/native.js';
import type {FrozenContract} from '../../worker/compiler/snapshot.js';
import type {DTO} from '../../shared/contracts/types.js';
import {hash} from '../lib/crypto.js';
import {requireThat} from '../lib/errors.js';
import {frozenAiDisclosure} from '../../worker/compiler/disclosure.js';

/** The same owner lock used by payment/privacy/commit must surround mutations.
 * Paid work keeps its frozen source revision; pre-purchase must still be current. */
export async function verifyPlusRenderSource(db:Db,tenantId:string,ownerId:string,b:PlusWorkBinding,current=false,minRemainingSeconds=0):Promise<void> {
  const row=(await db.query<{payment_state:string;fulfillment_state:string;private:{contract:FrozenContract;contract_hash:string;media_revoked?:boolean};
    artifact_hash:string;object_key:string;artifact_expiry:Date;spec:{inspection:MediaInspection};manifest:DTO<'Deliverables'>;manifest_expiry:Date;product_id:string;current_profile_id:string}>(
    `SELECT o.payment_state,o.fulfillment_state,o.private,a.sha256 artifact_hash,a.object_key,a.expires_at artifact_expiry,a.spec_json AS spec,
      m.data manifest,m.expires_at manifest_expiry,s.product_id,p.current_profile_id FROM orders o
      JOIN privacy_order_scope s ON s.tenant_id=o.tenant_id AND s.id=o.id
      JOIN product_drafts p ON p.tenant_id=s.tenant_id AND p.id=s.product_id AND p.owner_id=o.owner_id
      JOIN delivery_manifests m ON m.tenant_id=o.tenant_id AND m.order_id=o.id AND m.owner_id=o.owner_id AND m.id=$4
      JOIN artifacts a ON a.tenant_id=o.tenant_id AND a.order_id=o.id AND a.id=$5
      WHERE o.tenant_id=$1 AND o.owner_id=$2 AND o.id=$3 AND p.deleted_at IS NULL AND p.expires_at>now()`,
    [tenantId,ownerId,b.source_order_id,b.source_manifest_id,b.source_artifact_id])).rows[0];
  const item=row?.manifest.items.find(x=>x.deliverable_id===b.source_artifact_id);
  requireThat(row&&row.payment_state==='CONFIRMED'&&row.fulfillment_state==='DELIVERED'&&!row.private.media_revoked
    &&row.product_id===b.source_product_id&&row.manifest.manifest_revision===b.source_manifest_revision&&hash(row.manifest)===b.source_manifest_hash
    &&item?.kind===(b.version===PLUS_VIDEO_VERSION?'video':'image')&&item.sha256===b.source_sha256&&item.width===b.source_width&&item.height===b.source_height&&item.size_bytes===b.source_bytes
    &&row.artifact_hash===b.source_sha256&&row.object_key===b.source_object_key&&row.manifest_expiry.toISOString()===b.source_expires_at
    &&row.manifest_expiry.getTime()>Date.now()+minRemainingSeconds*1000&&row.artifact_expiry.getTime()>Date.now()+minRemainingSeconds*1000,
    'PLUS_SOURCE_UNAVAILABLE','原素材已失效、撤销或剩余有效期不足，请重新选择本人有效素材',410);
  if(b.version===PLUS_VIDEO_VERSION)requireThat(row.spec.inspection&&hash(row.spec.inspection)===b.source_inspection_hash
    &&row.spec.inspection.frames===b.source_frames&&row.spec.inspection.fps===b.source_fps&&row.spec.inspection.hasAudio===b.source_has_audio,
    'PLUS_VIDEO_SOURCE_CHANGED','原视频的实际帧数、音轨或检测证明已变化',503);
  requireThat(row.private.contract&&hash(row.private.contract)===row.private.contract_hash&&row.private.contract_hash===b.source_contract_hash,
    'PLUS_SOURCE_CONTRACT_CHANGED','原素材的制作合同证明不完整或发生变化',503);
  requireThat(!!frozenAiDisclosure(row.private.contract)===b.inherits_ai,
    'PLUS_SOURCE_DISCLOSURE_CHANGED','原素材的AI来源标识与冻结记录不一致',503);
  if(current){requireThat(row.current_profile_id===row.private.contract.profile.profile_id,'INPUT_VERSION_CHANGED','商品档案已变化，请从当前制作版本重新选择图片',409);
    const later=await db.query('SELECT id FROM delivery_manifests WHERE tenant_id=$1 AND order_id=$2 AND revision>$3 LIMIT 1',
    [tenantId,b.source_order_id,b.source_manifest_revision]);
    requireThat(!later.rowCount,'PLUS_SOURCE_CHANGED','原素材已有新版本，请从新素材建立编辑草稿',409);}
}
