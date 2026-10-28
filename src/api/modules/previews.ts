import type { Db } from '../db/pool.js';
import type { DTO, Principal } from '../../shared/contracts/types.js';
import type { VariantSource } from './catalog.js';
import { hash, sha256 } from '../lib/crypto.js';
import { requireThat, notFound } from '../lib/errors.js';
import { validate } from '../lib/validation.js';
import { owned } from '../db/store.js';
import { lockMediaOwner } from './media-access.js';
import { validateCreativePlan, type CreativePlan } from '../../worker/compiler/plan.js';
import { verifyResourceLicenses } from '../../worker/media/font.js';
import type { ResourceBinding } from '../../worker/compiler/snapshot.js';

export const PREVIEW_RENDERER_VERSION = 'YPCC-OPTIONAL-PHOTO-PREVIEW-1.0';
export interface PreviewInput {
  renderer_version: typeof PREVIEW_RENDERER_VERSION; product_id: string; plan_id: string; plan_hash: string;
  photo_version_id: string; photo_version: number; photo_set_hash: string; profile_id: string; profile_hash: string;
  identity_lock_id: string; identity_lock_hash: string; source_hash: string; style_id: string;
  resource_versions: ResourceBinding[]; expires_at: string;
}
export interface PreviewOutput {
  object_key: string; sha256: string; size_bytes: number; width: number; height: number; input_hash: string;
  renderer_version: typeof PREVIEW_RENDERER_VERSION; source_asset_id: string; slot_id: string;
}
export interface PreviewRow {
  id: string; tenant_id: string; owner_id: string; product_id: string; plan_id: string; plan_hash: string;
  state: DTO<'Preview'>['state']; object_key: string | null; expires_at: Date; data: DTO<'Preview'>;
  private: { input?: PreviewInput; input_hash?: string; output?: PreviewOutput; privacy_deleted?: boolean };
}
export interface PreviewPlan {
  id: string; product_id: string; photo_version_id: string; profile_id: string; identity_lock_id: string;
  variant_version_id: string; plan_hash: string; data: DTO<'Plan'>;
  private: { source: VariantSource; creative: CreativePlan; request: DTO<'PlanRequest'> };
}
/** Re-read the evidence and current product version on every use. No input TTL
 * extension, new inference, or dependency on an order is permitted here. */
export async function previewPlan(db: Db, p: Pick<Principal, 'tenantId' | 'userId'>, planId: string): Promise<{
  plan: PreviewPlan; profile: DTO<'Profile'>; photo: { revision: number; photo_set_hash: string };
  identityHash: string; productExpiry: Date;
}> {
  const plan = (await db.query<PreviewPlan>(`SELECT * FROM plan_versions WHERE tenant_id=$1 AND owner_id=$2 AND id=$3 AND state='READY'`,
    [p.tenantId,p.userId,planId])).rows[0] ?? notFound();
  validate('Plan',plan.data,true);
  requireThat(plan.private.creative && plan.private.source && hash(plan.private.creative) === plan.plan_hash
    && plan.data.plan_hash === plan.plan_hash && plan.data.plan_id===plan.id && plan.data.product_id===plan.product_id
    && plan.data.profile_id===plan.profile_id && plan.data.engine===plan.private.source.engine
    && plan.data.variant_id===plan.private.source.variant_id, 'PLAN_CHANGED','原预览计划缺少有效内容证据',409);
  const product = (await db.query<{data:DTO<'Product'>;expires_at:Date}>(`SELECT data,expires_at FROM product_drafts
    WHERE tenant_id=$1 AND owner_id=$2 AND id=$3 AND deleted_at IS NULL AND expires_at>clock_timestamp()`,
    [p.tenantId,p.userId,plan.product_id])).rows[0];
  requireThat(product && product.data.profile_id === plan.profile_id,'INPUT_VERSION_CHANGED','商品照片或档案已更新、删除或过期',410);
  const photo = (await db.query<{revision:number;photo_set_hash:string}>(`SELECT revision,photo_set_hash FROM product_photo_versions
    WHERE tenant_id=$1 AND product_id=$2 AND id=$3`,[p.tenantId,plan.product_id,plan.photo_version_id])).rows[0] ?? notFound();
  requireThat(product.data.photo_version === photo.revision,'INPUT_VERSION_CHANGED','商品照片已更新，请重新生成方案',410);
  const profile = (await db.query<{data:DTO<'Profile'>}>(`SELECT data FROM profile_versions WHERE tenant_id=$1 AND owner_id=$2 AND id=$3
    AND product_id=$4 AND photo_version_id=$5`,[p.tenantId,p.userId,plan.profile_id,plan.product_id,plan.photo_version_id])).rows[0]?.data ?? notFound();
  validate('Profile',profile,true); const {profile_hash,...body}=profile;
  requireThat(hash(body)===profile_hash && profile.identity_lock_id===plan.identity_lock_id,'PROFILE_HASH_MISMATCH','商品证据摘要不一致',503);
  const identity = (await db.query<{hash:string}>(`SELECT hash FROM identity_locks WHERE tenant_id=$1 AND id=$2 AND profile_id=$3`,
    [p.tenantId,plan.identity_lock_id,plan.profile_id])).rows[0] ?? notFound();
  validateCreativePlan(plan.private.creative,profile,plan.private.source);
  return {plan,profile,photo,identityHash:identity.hash,productExpiry:product.expires_at};
}
export async function previewContext(db: Db, tenantId: string, previewId: string, ownerId?: string, lock=false): Promise<{
  row:PreviewRow; input:PreviewInput; plan:PreviewPlan;
}> {
  if (lock) {
    const hint=(await db.query<{owner_id:string}>('SELECT owner_id FROM optional_previews WHERE tenant_id=$1 AND id=$2',[tenantId,previewId])).rows[0] ?? notFound();
    requireThat(!ownerId || hint.owner_id===ownerId,'NOT_FOUND','未找到该预览',404); await lockMediaOwner(db,tenantId,hint.owner_id);
  }
  const row=(await db.query<PreviewRow>(`SELECT * FROM optional_previews WHERE tenant_id=$1 AND id=$2${lock?' FOR UPDATE':''}`,[tenantId,previewId])).rows[0] ?? notFound();
  requireThat(!ownerId || row.owner_id===ownerId,'NOT_FOUND','未找到该预览',404);
  requireThat(!row.private.privacy_deleted && row.expires_at.getTime()>Date.now(),'PREVIEW_EXPIRED','本人预览已过期或撤回',410);
  const input=row.private.input;
  requireThat(input && row.private.input_hash===hash(input) && input.renderer_version===PREVIEW_RENDERER_VERSION
    && input.product_id===row.product_id && input.plan_id===row.plan_id && input.plan_hash===row.plan_hash
    && input.expires_at===row.expires_at.toISOString(),'PREVIEW_INPUT_CHANGED','预览冻结输入缺失或不一致',503);
  const current=await previewPlan(db,{tenantId,userId:row.owner_id},row.plan_id);
  requireThat(current.plan.plan_hash===input.plan_hash && current.plan.photo_version_id===input.photo_version_id
    && current.photo.revision===input.photo_version && current.photo.photo_set_hash===input.photo_set_hash
    && current.plan.profile_id===input.profile_id && current.profile.profile_hash===input.profile_hash
    && current.plan.identity_lock_id===input.identity_lock_id && current.identityHash===input.identity_lock_hash
    && hash(current.plan.private.source)===input.source_hash,'PREVIEW_INPUT_CHANGED','预览与当前商品或方案版本不一致',409);
  await verifyResourceLicenses(db,input.resource_versions,lock);
  return {row,input,plan:current.plan};
}
export async function getPreview(db: Db,p:Principal,previewId:string):Promise<DTO<'Preview'>> {
  const row=await owned<DTO<'Preview'>>(db,'optional_previews',previewId,p);
  // A terminal failure remains observable without exposing any recovery payload.
  if(row.state==='FAILED') return row.data;
  await previewContext(db,p.tenantId,previewId,p.userId); return row.data;
}
export async function previewMedia(db:Db,tenantId:string,previewId:string,ownerId:string):Promise<{output:PreviewOutput;row:PreviewRow}> {
  const {row}=await previewContext(db,tenantId,previewId,ownerId); const output=row.private.output;
  requireThat(row.state==='READY' && output && output.object_key===row.object_key && output.input_hash===row.private.input_hash
    && output.object_key===`${tenantId}/previews/${previewId}/preview.png` && output.width>0 && output.width<=720 && output.height>96 && output.height<=2300
    && output.renderer_version===PREVIEW_RENDERER_VERSION && /^[a-f0-9]{64}$/.test(output.sha256)
    && Number.isSafeInteger(output.size_bytes) && output.size_bytes>0 && output.size_bytes<=12_000_000,
  'PREVIEW_NOT_READY','本人预览尚未生成或已失效',422);
  const file=await db.query(`SELECT id FROM private_object_writes WHERE tenant_id=$1 AND owner_id=$2 AND preview_id=$3
    AND product_id=$4 AND object_key=$5 AND sha256=$6 AND state='STORED' AND NOT delete_requested AND expires_at>clock_timestamp()`,
    [tenantId,ownerId,previewId,row.product_id,output.object_key,output.sha256]);
  requireThat(file.rowCount===1,'PREVIEW_FILE_UNAVAILABLE','预览文件尚未核对或已撤回',410); return {output,row};
}
export function checkPreviewBytes(output:PreviewOutput,bytes:Buffer):void {
  requireThat(bytes.length===output.size_bytes && sha256(bytes)===output.sha256,'PREVIEW_FILE_CHANGED','实际预览文件与生成记录不一致',503);
}
