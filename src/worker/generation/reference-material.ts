import sharp from 'sharp';
import type {Db} from '../../api/db/pool.js';
import {hash,sha256} from '../../api/lib/crypto.js';
import {requireThat} from '../../api/lib/errors.js';
import {validateInternal} from '../../api/lib/validation.js';
import type {ObjectStorage} from '../../api/storage/storage.js';
import type {IdentityLock} from '../analysis/profile.js';
import {generationScope,generationCostConfirmed,generationSource,orderGenerationContext,type GenerationContext} from './scope.js';
import {checkReviewImages,type ReviewImage,type ReviewImageBinding} from '../codex/review-images.js';
import {generationContract} from './contracts.js';


export const REFERENCE_IDENTITY_POLICY='YPCC-REFERENCE-IDENTITY-1.0.0';
export interface ReferenceFrame extends ReviewImageBinding {operation_key:string}
export interface ReferencePacket {
  version:'1.0.0';purpose:'REFERENCE_IDENTITY';policy_version:typeof REFERENCE_IDENTITY_POLICY;
  tenant_id:string;order_id:string|null;sample_id?:string;stage_run_id:string;snapshot_hash:string;identity_lock_hash:string;photo_set_hash:string;
  skill_bundle_hash:string;originals:ReviewImageBinding[];frames:ReferenceFrame[];identity:IdentityLock;
  anchors:{anchor_id:string;kind:IdentityLock['features'][number]['kind'];value:string;evidence_ids:string[]}[];
  packet_hash:string;
}
export interface ReferenceMaterial {packet:ReferencePacket;images:ReviewImage[]}
export function referenceOperations(context:GenerationContext):string[]{
  requireThat(context.snapshot.engine!=='PHOTO_LAYOUT','REFERENCE_ROUTE_INVALID','原图路线不需要生成参考帧',422);
  return context.snapshot.engine==='PER_SHOT_AI'?context.contract.creative.shots.map(shot=>`reference:${shot.shot_id}`):['reference:film'];
}
/** Rebuild from original versions and registered bytes; caller/model declarations
 * never become evidence that a generated frame still depicts this product. */
export async function referenceMaterial(db:Db,store:ObjectStorage,context:GenerationContext,stageId:string):Promise<ReferenceMaterial>{
  const scoped=generationScope(context);
  const admission=context.contract.runtime_binding?.admission,policy=admission?.review_vision;
  requireThat(admission&&policy,'REFERENCE_VISION_NOT_ADMITTED','原订单未冻结参考帧视觉核验能力',503);
  const stage=(await db.query(`SELECT id FROM stage_runs WHERE tenant_id=$1 AND id=$2 AND scope_type=$6
    AND scope_id=$3 AND stage_name=$7 AND input_hash=$4 AND deadline_at=$5`,
  [context.tenantId,stageId,scoped.id,context.snapshotHash,context.snapshot.deadline_at,scoped.type,scoped.stage])).rowCount;
  requireThat(stage===1,'REFERENCE_SCOPE_INVALID','参考帧不属于原订单制作阶段',403);
  const locked=(await db.query<{hash:string;data:IdentityLock}>(`SELECT hash,data FROM identity_locks WHERE tenant_id=$1 AND id=$2 AND profile_id=$3`,
    [context.tenantId,context.snapshot.identity_lock_id,context.snapshot.profile_id])).rows[0];
  validateInternal('product-identity-lock',locked?.data);const identity=locked!.data;
  const {content_hash,...identityBody}=identity;
  requireThat(locked?.hash===context.snapshot.identity_lock_hash&&content_hash===locked.hash&&hash(identityBody)===content_hash
    &&identity.tenant_id===context.tenantId&&identity.profile_id===context.snapshot.profile_id&&identity.photo_version===context.snapshot.photo_version,
  'REFERENCE_IDENTITY_CHANGED','原商品身份锁内容或摘要不一致',503);
  const originals=(await db.query<{id:string;object_key:string;sha256:string;width:number;height:number}>(`SELECT a.id,a.object_key,a.sha256,a.width,a.height
    FROM product_photo_items p JOIN assets a ON a.tenant_id=p.tenant_id AND a.id=p.asset_id
    WHERE p.tenant_id=$1 AND p.photo_version_id=$2 AND a.owner_id=$3 AND a.product_id=$4 AND a.state='READY' AND a.expires_at>now() ORDER BY p.position`,
  [context.tenantId,context.photoVersionId,context.ownerId,context.snapshot.product_id])).rows;
  requireThat(originals.length>=3&&originals.length<=5&&hash({photos:originals.map(a=>({asset_id:a.id,sha256:a.sha256})),revision:context.snapshot.photo_version,
    normalization:'sharp-auto-orient-strip-png-v1'})===context.snapshot.photo_set_hash
    &&hash([...identity.source_asset_ids].sort())===hash(originals.map(a=>a.id).sort()),
  'REFERENCE_ORIGINALS_CHANGED','原商品照片集或身份依据不完整',503);
  const operations=referenceOperations(context),model=generationContract(context.contract,'IMAGE');
  const frames=(await db.query<{id:string;stage_run_id:string;operation_key:string;model_version_id:string;state:string;input_hash:string;cost_confirmed:boolean;
    private:{billing_valid?:boolean;provider_terminal?:boolean;prepared:{contract_hash:string};output?:{
    object_key:string;sha256:string;inspection:{kind:string;width:number;height:number;codec:string}}}}>(`SELECT id,stage_run_id,operation_key,model_version_id,state,input_hash,private,
    ${generationCostConfirmed(context)} AS cost_confirmed
    FROM provider_submissions s WHERE tenant_id=$1 AND ${scoped.column}=$2 AND stage_run_id=ANY($3::text[]) AND generation_kind='IMAGE' AND operation_key=ANY($4)`,
  [context.tenantId,scoped.id,[stageId,...(context.repair?[context.repair.source_production_stage_id]:[])],operations])).rows
    .filter(row=>row.stage_run_id===generationSource(context,stageId,'IMAGE',row.operation_key));
  requireThat(frames.length===operations.length&&new Set(frames.map(f=>f.operation_key)).size===operations.length,
    'REFERENCE_FRAMES_INCOMPLETE','完整参考帧尚未持久生成，不得购买视频',409);
  requireThat(originals.length+frames.length<=policy.max_images,'REFERENCE_VISION_NOT_ADMITTED','完整原图和参考帧超出冻结视觉能力',503);
  const images:ReviewImage[]=[],referenceFrames:ReferenceFrame[]=[];let total=0;
  const load=async(assetId:string,key:string,digest:string,width:number,height:number):Promise<ReviewImage>=>{
    const bytes=await store.get(key,policy.max_image_bytes);total+=bytes.length;
    requireThat(total<=policy.max_total_image_bytes&&sha256(bytes)===digest,'REFERENCE_BYTES_CHANGED','原图或参考帧实际字节不一致或超出核验上限',503);
    const meta=await sharp(bytes,{limitInputPixels:policy.max_image_pixels,failOn:'warning'}).metadata();
    requireThat(meta.format==='png'&&meta.width===width&&meta.height===height,'REFERENCE_BYTES_CHANGED','实际图片与冻结像素或编码不一致',503);
    return {asset_id:assetId,sha256:digest,width,height,bytes};
  };
  for(const photo of originals)images.push(await load(photo.id,photo.object_key,photo.sha256,photo.width,photo.height));
  for(const operation of operations){
    const frame=frames.find(row=>row.operation_key===operation)!,output=frame.private.output;
    requireThat(frame.state==='SUCCEEDED'&&frame.cost_confirmed&&frame.private.billing_valid&&frame.private.provider_terminal
      &&frame.model_version_id===model.model_version_id&&frame.private.prepared.contract_hash===hash(model)
      &&output?.inspection.kind==='image'&&output.inspection.codec==='png','REFERENCE_FRAMES_INCOMPLETE','参考帧未成功或生成模型与原合同不同',409);
    requireThat((await db.query(`SELECT id FROM private_object_writes WHERE tenant_id=$1 AND owner_id=$2 AND order_id IS NOT DISTINCT FROM $3::text AND product_id=$4
      AND object_key=$5 AND kind='MEDIA' AND state='STORED' AND sha256=$6 AND NOT delete_requested AND expires_at>now()`,
    [context.tenantId,context.ownerId,context.orderId,context.snapshot.product_id,output.object_key,output.sha256])).rowCount===1,
    'REFERENCE_MEDIA_REVOKED','参考帧未登记、过期或已撤权',410);
    const image=await load(frame.id,output.object_key,output.sha256,output.inspection.width,output.inspection.height);images.push(image);
    const {bytes:_,...binding}=image;referenceFrames.push({...binding,operation_key:operation});
  }
  await checkReviewImages(images,admission);
  const body:Omit<ReferencePacket,'packet_hash'>={version:'1.0.0',purpose:'REFERENCE_IDENTITY',policy_version:REFERENCE_IDENTITY_POLICY,
    tenant_id:context.tenantId,order_id:context.orderId,...(context.sampleId?{sample_id:context.sampleId}:{}),stage_run_id:stageId,snapshot_hash:context.snapshotHash,
    identity_lock_hash:context.snapshot.identity_lock_hash,photo_set_hash:context.snapshot.photo_set_hash,
    skill_bundle_hash:context.snapshot.codex_contract.skill_bundle_hash,
    originals:images.slice(0,originals.length).map(({bytes:_,...binding})=>binding),frames:referenceFrames,identity,
    anchors:identity.features.map((feature,index)=>({anchor_id:`anchor_${hash({index,feature}).slice(0,32)}`,...feature}))};
  return {packet:{...body,packet_hash:hash(body)},images};
}
export function referenceRoleInput(packet:ReferencePacket):Record<string,unknown>{
  return {phase:'REFERENCE_IDENTITY',packet_hash:packet.packet_hash,reference_packet:packet,
    task:'逐一对照全部商品原图与生成参考帧，检查每个已观察身份锚点的形态、包装、数量、颜色、结构、配件与标识。不可把未知特征或OCR标签当功效事实；遮挡、模糊或无法确认必须标为UNCERTAIN，不能猜测PASS。先调用extract_review_evidence获得本运行模板，再为每帧每个锚点填写实际观察及原图依据；通过persist_stage_result保存完整报告并原样返回。参考帧未全部通过不得提交视频。本报告只许可这些帧继续制作，不授权最终交付。'};
}
