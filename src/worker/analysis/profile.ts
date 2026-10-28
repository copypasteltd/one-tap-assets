import type { DTO } from '../../shared/contracts/types.js';
import { id, hash } from '../../api/lib/crypto.js';
import { requireThat } from '../../api/lib/errors.js';
import { validate, validateInternal } from '../../api/lib/validation.js';
export interface IdentityLock {
  schema_version: '1.0.0'; identity_lock_id: string; tenant_id: string; profile_id: string; photo_version: number;
  source_asset_ids: string[]; features: { kind: 'SHAPE' | 'PACKAGING' | 'QUANTITY' | 'COLOR' | 'TEXT_LOGO' | 'STRUCTURE' | 'ACCESSORY'; value: string; evidence_ids: string[] }[];
  unknowns: string[]; canonicalization: 'RFC8785'; content_hash: string;
}
export function makeIdentityLock(tenantId: string, profile: DTO<'Profile'>): IdentityLock {
  const features: IdentityLock['features'] = profile.observations.filter(o => o.status === 'OBSERVED').map(o => ({
    kind: /颜色|color/i.test(o.feature) ? 'COLOR' : /数量|quantity|count/i.test(o.feature) ? 'QUANTITY' : /包装|packag/i.test(o.feature) ? 'PACKAGING' : /配件|accessor/i.test(o.feature) ? 'ACCESSORY' : /形状|shape/i.test(o.feature) ? 'SHAPE' : 'STRUCTURE',
    value: `${o.feature}：${o.value}`, evidence_ids: o.evidence_ids,
  }));
  // OCR records what the label says; it does not certify the underlying claim.
  features.push(...profile.label_texts.filter(o => o.status === 'OCR').map(o => ({ kind: 'TEXT_LOGO' as const, value: `标签可见文字：${o.value}`, evidence_ids: o.evidence_ids })));
  requireThat(features.length > 0, 'IDENTITY_EVIDENCE_INSUFFICIENT', '照片未提供可核对的商品特征，请重新拍摄', 422);
  const body = { schema_version: '1.0.0' as const, identity_lock_id: profile.identity_lock_id, tenant_id: tenantId,
    profile_id: profile.profile_id, photo_version: profile.photo_version, source_asset_ids: profile.photo_roles.map(p => p.asset_id),
    features, unknowns: profile.unknowns, canonicalization: 'RFC8785' as const };
  const result: IdentityLock = { ...body, content_hash: hash(body) }; validateInternal('product-identity-lock', result); return result;
}
export function normalizeVision(raw: unknown, scope: { tenantId: string; productId: string; photoVersion: number; revision: number; assetIds: string[] }): { profile: DTO<'Profile'>; identityLock: IdentityLock } {
  const candidate = validate('Profile', raw);
  const ids = new Set(scope.assetIds); const evidence = new Map(candidate.evidence.map(e => [e.evidence_id, e]));
  requireThat(evidence.size === candidate.evidence.length && candidate.evidence.length > 0, 'VISION_EVIDENCE_INVALID', '识别结果缺少唯一的照片证据', 422);
  requireThat(candidate.evidence.every(e => ids.has(e.asset_id) && e.kind !== 'USER_CORRECTION'
    && (!e.region || (e.region[2]! > 0 && e.region[3]! > 0 && e.region[0]! + e.region[2]! <= 1.000001 && e.region[1]! + e.region[3]! <= 1.000001))), 'VISION_EVIDENCE_INVALID', '识别结果引用了错误照片或越界证据区域', 422);
  requireThat(candidate.photo_roles.length === ids.size && new Set(candidate.photo_roles.map(p => p.asset_id)).size === ids.size
    && candidate.photo_roles.every(p => ids.has(p.asset_id)), 'VISION_PHOTO_SCOPE_INVALID', '识别结果未覆盖当前全部照片', 422);
  for (const observation of [...candidate.observations, ...candidate.label_texts]) {
    requireThat(observation.status !== 'USER_CORRECTED' && observation.source_asset_ids.every(a => ids.has(a))
      && observation.evidence_ids.every(e => evidence.has(e) && observation.source_asset_ids.includes(evidence.get(e)!.asset_id)), 'VISION_EVIDENCE_INVALID', '识别特征与照片证据不一致', 422);
  }
  requireThat(candidate.observations.every(o => o.status !== 'OCR') && candidate.label_texts.every(o => o.status === 'OCR' || o.status === 'CONFLICTED'), 'VISION_FACT_CLASS_INVALID', '标签文字须与可见观察分开记录', 422);
  requireThat(candidate.hypotheses.every(h => h.evidence_ids.every(e => evidence.has(e))), 'VISION_EVIDENCE_INVALID', '推测引用了不存在的照片证据', 422);
  requireThat(candidate.name || candidate.category, 'VISION_UNIDENTIFIED', '未能识别照片中的商品，请补拍清晰整体', 422);
  const remap = new Map(candidate.evidence.map(e => [e.evidence_id, id('evidence')]));
  const profile: DTO<'Profile'> = { ...candidate, profile_id: id('profile'), product_id: scope.productId, photo_version: scope.photoVersion,
    identity_lock_id: id('lock'), revision: scope.revision, evidence: candidate.evidence.map(e => ({ ...e, evidence_id: remap.get(e.evidence_id)! })),
    observations: candidate.observations.map(o => ({ ...o, evidence_ids: o.evidence_ids.map(e => remap.get(e)!) })),
    label_texts: candidate.label_texts.map(o => ({ ...o, evidence_ids: o.evidence_ids.map(e => remap.get(e)!) })),
    hypotheses: candidate.hypotheses.map(h => ({ ...h, evidence_ids: h.evidence_ids.map(e => remap.get(e)!) })), profile_hash: '0'.repeat(64) };
  const { profile_hash: _hash, ...body } = profile; profile.profile_hash = hash(body);
  validate('Profile', profile, true); return { profile, identityLock: makeIdentityLock(scope.tenantId, profile) };
}
