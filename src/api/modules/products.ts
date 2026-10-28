import type { Db } from '../db/pool.js';
import type { Config } from '../config.js';
import type { Principal, DTO } from '../../shared/contracts/types.js';
import { owned, insert, update } from '../db/store.js';
import { id, iso, hash, addSeconds } from '../lib/crypto.js';
import { requireThat, notFound } from '../lib/errors.js';
import { enqueueStage } from '../../worker/queue/enqueue.js';
import { POLICIES } from '../../shared/domain/policies.js';
import { makeIdentityLock } from '../../worker/analysis/profile.js';
import { visionContract } from '../../worker/providers/vision.js';
import { lockMediaOwner } from './media-access.js';

export async function createProduct(db: Db, p: Principal): Promise<DTO<'Product'>> {
  await lockMediaOwner(db, p.tenantId, p.userId);
  const data: DTO<'Product'> = { product_id: id('product'), revision: 0, photo_version: null, profile_id: null, created_at: iso() };
  await insert(db, 'product_drafts', { id: data.product_id, tenant_id: p.tenantId, owner_id: p.userId, expires_at: addSeconds(86400), data });
  return data;
}
export async function bindPhotos(db: Db, p: Principal, productId: string, request: DTO<'PhotoBindingRequest'>): Promise<DTO<'Product'>> {
  const product = await owned<DTO<'Product'>>(db, 'product_drafts', productId, p, true);
  requireThat(!product.deleted_at && new Date(String(product.expires_at)).getTime() > Date.now(), 'INPUT_EXPIRED', '草稿已过期，请重新拍照', 410);
  requireThat(product.revision === request.expected_revision, 'REVISION_CONFLICT', '草稿已更新，请刷新后重试');
  const rows = await db.query<{ id: string; sha256: string; size_bytes: number }>('SELECT id,sha256,size_bytes FROM assets WHERE tenant_id=$1 AND owner_id=$2 AND product_id=$3 AND id=ANY($4) AND state=$5 AND expires_at>now() FOR SHARE', [p.tenantId, p.userId, productId, request.asset_ids, 'READY']);
  requireThat(rows.rows.length === request.asset_ids.length, 'PHOTO_NOT_READY', '请先完成所有照片上传', 422);
  requireThat(new Set(rows.rows.map(a => a.sha256)).size === request.asset_ids.length, 'DUPLICATE_PHOTO', '请拍摄不同角度，避免使用重复照片', 422);
  requireThat(rows.rows.reduce((sum, a) => sum + a.size_bytes, 0) <= POLICIES.maxTotalBytes, 'PHOTO_SET_TOO_LARGE', '照片总大小超过限制', 413);
  const revision = (product.data.photo_version ?? 0) + 1; const versionId = id('photos');
  const photos = request.asset_ids.map(assetId => ({ asset_id: assetId, sha256: rows.rows.find(r => r.id === assetId)!.sha256 }));
  await insert(db, 'product_photo_versions', { id: versionId, tenant_id: p.tenantId, product_id: productId, revision, photo_set_hash: hash({ photos, revision, normalization: 'sharp-auto-orient-strip-png-v1' }), data: photos });
  for (const [position, assetId] of request.asset_ids.entries()) await insert(db, 'product_photo_items', { id: id('photo'), tenant_id: p.tenantId, photo_version_id: versionId, asset_id: assetId, position });
  const data: DTO<'Product'> = { ...product.data, revision: request.expected_revision + 1, photo_version: revision, profile_id: null };
  await update(db, 'product_drafts', productId, { data, revision: data.revision, current_photo_version: revision, current_profile_id: null, updated_at: iso() }, p.tenantId);
  return data;
}
export async function createAnalysis(db: Db, cfg: Config, p: Principal, productId: string, request: DTO<'AnalysisRequest'>): Promise<DTO<'Analysis'>> {
  const product = await owned<DTO<'Product'>>(db, 'product_drafts', productId, p, true);
  requireThat(!product.deleted_at && product.data.photo_version === request.photo_version, 'INPUT_VERSION_CHANGED', '照片已更新，请使用当前照片');
  requireThat(cfg.generationEnabled && cfg.provider.visionModel && cfg.provider.apiKey, 'VISION_NOT_CONFIGURED', '商品识别服务尚未配置，请联系平台', 503);
  const contract = await visionContract(cfg);
  requireThat(cfg.provider.visionDailyBudgetMicro >= contract.per_request_ceiling_micro, 'PLATFORM_BUDGET_NOT_CONFIGURED', '平台识别成本额度尚未配置', 503);
  const photo = (await db.query<{ id: string; photo_set_hash: string }>('SELECT id,photo_set_hash FROM product_photo_versions WHERE tenant_id=$1 AND product_id=$2 AND revision=$3', [p.tenantId, productId, request.photo_version])).rows[0] ?? notFound();
  const inputHash = hash({ tenant_id: p.tenantId, photo_set_hash: photo.photo_set_hash, model: cfg.provider.visionModel, contract_hash: hash(contract), codex: cfg.codex.model, prompt: 'vision-evidence-1.1', policy: 'facts-v3.1' });
  const existing = await db.query<{ data: DTO<'Analysis'> }>('SELECT data FROM analysis_jobs WHERE tenant_id=$1 AND product_id=$2 AND input_hash=$3', [p.tenantId, productId, inputHash]);
  if (existing.rows[0]) return existing.rows[0].data;
  const data: DTO<'Analysis'> = { analysis_id: id('analysis'), product_id: productId, photo_version: request.photo_version, state: 'QUEUED', profile_id: null, reason_codes: [], updated_at: iso() };
  const deadlineAt = addSeconds(180);
  await insert(db, 'analysis_jobs', { id: data.analysis_id, tenant_id: p.tenantId, owner_id: p.userId, product_id: productId, photo_version_id: photo.id, input_hash: inputHash, state: data.state, model_version: cfg.provider.visionModel, deadline_at: deadlineAt, data, private: { vision_contract: contract, vision_contract_hash: hash(contract) } });
  await enqueueStage(db, { tenantId: p.tenantId, scopeType: 'ANALYSIS', scopeId: data.analysis_id, name: 'ANALYZE', inputHash, deadlineAt });
  return data;
}
export async function getProfile(db: Db, p: Principal, productId: string): Promise<DTO<'Profile'>> {
  const product = await owned<DTO<'Product'>>(db, 'product_drafts', productId, p);
  requireThat(!product.deleted_at, 'INPUT_DELETED', '商品素材已删除', 410);
  if (!product.data.profile_id) notFound();
  return (await owned<DTO<'Profile'>>(db, 'profile_versions', product.data.profile_id, p)).data;
}
export async function correctProfile(db: Db, p: Principal, productId: string, request: DTO<'CorrectionRequest'>): Promise<DTO<'Profile'>> {
  const product = await owned<DTO<'Product'>>(db, 'product_drafts', productId, p, true);
  requireThat(!product.deleted_at && product.revision === request.expected_revision && product.data.profile_id === request.profile_id, 'REVISION_CONFLICT', '商品档案已更新，请刷新');
  const original = await owned<DTO<'Profile'>>(db, 'profile_versions', request.profile_id, p);
  const photos = original.data.photo_roles.map(r => r.asset_id);
  const evidenceIds = request.evidence_asset_ids ?? [];
  requireThat(evidenceIds.every(a => photos.includes(a)), 'EVIDENCE_SCOPE_INVALID', '纠错依据必须属于当前商品照片', 422);
  requireThat(['category', 'name'].includes(request.field) || evidenceIds.length > 0, 'EVIDENCE_REQUIRED', '请关联相应的商品照片', 422);
  const profileId = id('profile'); const lockId = id('lock'); const data = structuredClone(original.data);
  data.profile_id = profileId; data.identity_lock_id = lockId; data.revision++;
  if (request.field === 'category' || request.field === 'name') data[request.field] = request.value;
  else if (request.field === 'photo_role') {
    requireThat(['WHOLE', 'SIDE', 'DETAIL', 'LABEL', 'OTHER'].includes(request.value), 'INVALID_PHOTO_ROLE', '照片用途无效', 400);
    for (const role of data.photo_roles) if (evidenceIds.includes(role.asset_id)) role.role = request.value as DTO<'Profile'>['photo_roles'][number]['role'];
  } else {
    const evidence = evidenceIds.map(assetId => ({ evidence_id: id('evidence'), asset_id: assetId, kind: 'USER_CORRECTION' as const, text: request.value, region: null }));
    data.evidence.push(...evidence);
    const observation: DTO<'Observation'> = { feature: '用户纠错', value: request.value, status: 'USER_CORRECTED', source_asset_ids: evidenceIds, evidence_ids: evidence.map(e => e.evidence_id), note: '用户提供的纠错，未转为模型观察事实', model_reported_confidence: null };
    (request.field === 'label_text' ? data.label_texts : data.observations).push(observation);
  }
  const { profile_hash: _oldHash, ...body } = data; data.profile_hash = hash(body);
  await insert(db, 'profile_versions', { id: profileId, tenant_id: p.tenantId, owner_id: p.userId, product_id: productId, photo_version_id: original.photo_version_id, revision: data.revision, profile_hash: data.profile_hash, data });
  const lock = makeIdentityLock(p.tenantId, data);
  await insert(db, 'identity_locks', { id: lockId, tenant_id: p.tenantId, profile_id: profileId, hash: lock.content_hash, data: lock });
  await insert(db, 'correction_versions', { id: id('correction'), tenant_id: p.tenantId, product_id: productId, parent_profile_id: original.id, new_profile_id: profileId, data: request });
  await update(db, 'product_drafts', productId, { current_profile_id: profileId, revision: request.expected_revision + 1, data: { ...product.data, profile_id: profileId, revision: request.expected_revision + 1 }, updated_at: iso() }, p.tenantId);
  return data;
}
