import type { Db } from '../db/pool.js';
import type { Config } from '../config.js';
import type { Principal, DTO } from '../../shared/contracts/types.js';
import { owned, insert, update } from '../db/store.js';
import { id, iso, hash, addSeconds } from '../lib/crypto.js';
import { requireThat, notFound } from '../lib/errors.js';
import { getVariant, presetVersion } from './catalog.js';
import { basePlan } from '../../worker/compiler/plan.js';
import { enqueueStage } from '../../worker/queue/enqueue.js';
import { DEADLINES, POLICIES } from '../../shared/domain/policies.js';
import { codexAdmission } from '../../worker/codex/admission.js';
import { bundleForSource } from '../../worker/codex/skills.js';
import { lockMediaOwner } from './media-access.js';
import { previewPlan, PREVIEW_RENDERER_VERSION, type PreviewInput } from './previews.js';
import { bindProductionFont, loadProductionFont, verifyResourceLicenses } from '../../worker/media/font.js';
import type { ResourceBinding } from '../../worker/compiler/snapshot.js';
import { STYLES } from '../../worker/media/layout.js';
import {communityNativeBinding,verifyCommunityNativeRegistration,applyCommunityNativeVoice} from './community-native.js';
import {derivePlusSource,plusRenderBinding,type PlusRenderBinding} from '../../shared/domain/plus-render.js';
import {verifyPlusRenderSource} from './plus-render-source.js';
import {assertPlusRenderGrant} from './plus-access.js';
import {outputSlots} from './catalog.js';

export async function checkInput(db: Db, p: Principal, request: DTO<'InputCheckRequest'>): Promise<DTO<'InputCheck'>> {
  const product = await owned<DTO<'Product'>>(db, 'product_drafts', request.product_id, p);
  const profile = await owned<DTO<'Profile'>>(db, 'profile_versions', request.profile_id, p);
  const variant = await getVariant(db, request.variant_id, request.variant_version);
  const reasons: string[] = []; const guidance: string[] = [];
  if (product.deleted_at || product.data.profile_id !== profile.id || product.data.photo_version !== profile.data.photo_version) reasons.push('INPUT_VERSION_CHANGED');
  if (profile.data.conflicts.length) { reasons.push('CONFLICTING_PRODUCT_IDENTITY'); guidance.push('请补拍同一件商品，保持包装和数量一致。'); }
  if (!profile.data.photo_roles.some(r => r.role === 'WHOLE')) { reasons.push('WHOLE_PRODUCT_PHOTO_REQUIRED'); guidance.push('请补拍一张商品整体照片。'); }
  if (variant.data.engine !== 'PHOTO_LAYOUT' && !profile.data.photo_roles.some(r => ['DETAIL', 'LABEL'].includes(r.role))) { reasons.push('DETAIL_PHOTO_REQUIRED'); guidance.push('该方案需要清晰细节，请靠近商品补拍。'); }
  return { eligible: reasons.length === 0, reason_codes: reasons, capture_guidance: guidance };
}
export async function createPlan(db: Db, cfg: Config, p: Principal, request: DTO<'PlanRequest'>,plus?:PlusRenderBinding): Promise<DTO<'Plan'>> {
  const product = await owned<DTO<'Product'>>(db, 'product_drafts', request.product_id, p, true);
  requireThat(product.data.photo_version === request.photo_version && product.data.profile_id === request.profile_id && !product.deleted_at, 'INPUT_VERSION_CHANGED', '商品照片或档案已更新');
  const profile = await owned<DTO<'Profile'>>(db, 'profile_versions', request.profile_id, p);
  requireThat(profile.data.identity_lock_id === request.identity_lock_id, 'IDENTITY_LOCK_CHANGED', '商品身份版本已更新');
  const preset = await presetVersion(db, request.preset_id, request.preset_version);
  requireThat(preset.variants.some(v => v.variant_id === request.variant_id && v.version === request.variant_version), 'VARIANT_SCOPE_INVALID', '制作规格不属于该方案', 422);
  const variant = await getVariant(db, request.variant_id, request.variant_version);
  if(plus){requireThat(request.product_id===plus.source_product_id,'PLUS_SOURCE_CHANGED','进阶制作必须保留原商品身份',403);
    await assertPlusRenderGrant(db,p);await verifyPlusRenderSource(db,p.tenantId,p.userId,plus,true,1200);}
  const source=plus?derivePlusSource(variant.private.source,plus):variant.private.source;
  const native=communityNativeBinding(variant.private.source,(variant.private.commercial_binding as {native_audio?:unknown}|undefined)?.native_audio);
  if(native)await verifyCommunityNativeRegistration(db,variant.private.source,native);
  const input = await checkInput(db, p, { product_id: request.product_id, profile_id: request.profile_id, variant_id: request.variant_id, variant_version: request.variant_version });
  requireThat(input.eligible, 'INPUT_INSUFFICIENT', input.capture_guidance.join(' ') || '当前输入不满足该方案', 422);
  requireThat(cfg.codex.enabled, 'CODEX_NOT_CONFIGURED', '内容规划服务尚未配置', 503);
  const runtimeAdmission = await codexAdmission(cfg); const bundle = await bundleForSource(cfg, variant.private.source);
  const inferenceLimits = { max_requests: cfg.codex.maxTurns, max_input_tokens: cfg.codex.maxInputTokens,
    max_output_tokens: cfg.codex.maxOutputTokens, ceiling_micro: cfg.codex.costCeilingMicro,
    daily_ceiling_micro: cfg.codex.dailyBudgetMicro, owner_id: p.userId };
  requireThat(inferenceLimits.daily_ceiling_micro >= inferenceLimits.ceiling_micro, 'CODEX_LIMITS_INVALID', '平台内容规划费用额度尚未配置', 503);
  const photo = (await db.query<{ id: string }>('SELECT id FROM product_photo_versions WHERE tenant_id=$1 AND product_id=$2 AND revision=$3', [p.tenantId, request.product_id, request.photo_version])).rows[0] ?? notFound();
  const planId = id('plan'); const creative = basePlan(profile.data, source);
  if(native)applyCommunityNativeVoice(creative,native);
  const data: DTO<'Plan'> = { plan_id: planId, state: 'PLANNING', plan_hash: null, product_id: request.product_id, profile_id: request.profile_id,
    variant_id: request.variant_id, engine: variant.data.engine, summary: '', output_slots: outputSlots(source), reason_codes: [],
    estimated_seconds_min: variant.data.engine === 'PHOTO_LAYOUT' ? 30 : 180, estimated_seconds_max: DEADLINES[variant.data.engine] };
  const inputHash = hash({ request, suggested_plan: creative, profile_hash: profile.data.profile_hash, source,
    bundle_hash: bundle.sha256, runtime_admission: runtimeAdmission, inference_limits: inferenceLimits,
    ...(native?{native_commercial_hash:hash(native)}:{}) });
  await insert(db, 'plan_versions', { id: planId, tenant_id: p.tenantId, owner_id: p.userId, product_id: request.product_id,
    photo_version_id: photo.id, profile_id: request.profile_id, identity_lock_id: request.identity_lock_id, variant_version_id: variant.id,
    state: data.state, data, private: { request, creative, source, runtime_admission: runtimeAdmission,
      inference_limits: inferenceLimits, bundle_hash: bundle.sha256, plan_input_hash: inputHash,...(native?{native_commercial:native}:{}) } });
  await enqueueStage(db, { tenantId: p.tenantId, scopeType: 'PLAN', scopeId: planId, name: 'PLAN', inputHash, deadlineAt: addSeconds(300) });
  return data;
}
export async function createPreview(db: Db, cfg:Config, p: Principal, productId: string, request: DTO<'PreviewRequest'>): Promise<DTO<'Preview'>> {
  await lockMediaOwner(db,p.tenantId,p.userId);
  const current=await previewPlan(db,p,request.plan_id); const {plan}=current;
  requireThat(!plusRenderBinding(plan.private.source),'PLUS_PREVIEW_NOT_AVAILABLE','进阶图片以独立规格清单确认，本人预览通道正在扩展',503);
  requireThat(plan.product_id === productId && plan.plan_hash === request.plan_hash, 'PLAN_CHANGED', '方案已更新或尚未就绪');
  const old = (await db.query<{ data: DTO<'Preview'> }>('SELECT data FROM optional_previews WHERE tenant_id=$1 AND owner_id=$2 AND plan_id=$3 AND expires_at>now() ORDER BY created_at DESC LIMIT 1', [p.tenantId, p.userId, plan.id])).rows[0];
  if (old) return old.data;
  requireThat(cfg.generationEnabled,'PREVIEW_NOT_CONFIGURED','本人预览服务尚未开放，可继续查看清单和报价',503);
  requireThat(plan.data.engine==='PHOTO_LAYOUT','PREVIEW_ENGINE_NOT_AVAILABLE','该生成式方案的本人效果预览尚未开放，可查看清单和方案样例',503);
  const configuredStyle=plan.private.source.creative_components.platform_style_id;
  const styleId=typeof configuredStyle==='string'?configuredStyle:plan.private.request.preset_id;
  requireThat(Object.hasOwn(STYLES,styleId),'PREVIEW_STYLE_UNAVAILABLE','该方案版式的本人预览尚未开放',503);
  await loadProductionFont(cfg.projectRoot);
  const variant=(await db.query<{private:{resource_versions?:ResourceBinding[]}}>('SELECT private FROM execution_variants WHERE id=$1',[plan.variant_version_id])).rows[0] ?? notFound();
  requireThat(Array.isArray(variant.private.resource_versions??[]),'PREVIEW_RESOURCES_NOT_AVAILABLE','该方案资源的本人预览尚未开放',503);
  const resources=bindProductionFont(variant.private.resource_versions??[]);
  requireThat(resources.length===1,'PREVIEW_RESOURCES_NOT_AVAILABLE','该方案额外资源的本人预览尚未开放',503);
  await verifyResourceLicenses(db,resources,true);
  const quota = await db.query('INSERT INTO quota_buckets(id,tenant_id,owner_id,kind,window_start,used_count,limit_count) VALUES($1,$2,$3,$4,(now() AT TIME ZONE $5)::date,1,$6) ON CONFLICT(tenant_id,owner_id,kind,window_start) DO UPDATE SET used_count=quota_buckets.used_count+1 WHERE quota_buckets.used_count<quota_buckets.limit_count RETURNING id', [id('quota'), p.tenantId, p.userId, 'PREVIEW', 'Asia/Shanghai', POLICIES.previewsPerDay]);
  requireThat(quota.rowCount === 1, 'PREVIEW_QUOTA_EXCEEDED', '今日预览次数已用完，可直接查看方案清单', 429);
  const data: DTO<'Preview'> = { preview_id: id('preview'), product_id: productId, plan_id: plan.id, plan_hash: request.plan_hash, state: 'QUEUED', label: 'YOUR_OPTIONAL_PREVIEW_NOT_FINAL_PACK', expires_at: iso(Math.min(Date.now()+86400000,current.productExpiry.getTime())) };
  const input:PreviewInput={renderer_version:PREVIEW_RENDERER_VERSION,product_id:productId,plan_id:plan.id,plan_hash:plan.plan_hash,
    photo_version_id:plan.photo_version_id,photo_version:current.photo.revision,photo_set_hash:current.photo.photo_set_hash,
    profile_id:plan.profile_id,profile_hash:current.profile.profile_hash,identity_lock_id:plan.identity_lock_id,identity_lock_hash:current.identityHash,
    source_hash:hash(plan.private.source),style_id:styleId,resource_versions:resources,expires_at:data.expires_at};
  const inputHash=hash(input);
  await insert(db, 'optional_previews', { id: data.preview_id, tenant_id: p.tenantId, owner_id: p.userId, product_id: productId, plan_id: plan.id, plan_hash: request.plan_hash, state: data.state, expires_at: data.expires_at, data,private:{input,input_hash:inputHash} });
  await enqueueStage(db, { tenantId: p.tenantId, scopeType: 'PREVIEW', scopeId: data.preview_id, name: 'PREVIEW', inputHash, deadlineAt: iso(Math.min(Date.now()+120000,Date.parse(data.expires_at))) });
  return data;
}
