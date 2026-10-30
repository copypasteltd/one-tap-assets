import type { Db } from '../db/pool.js';
import type { Config } from '../config.js';
import type { DTO, Principal } from '../../shared/contracts/types.js';
import { owned } from '../db/store.js';
import { hmac, equalSecret } from '../lib/crypto.js';
import { requireThat } from '../lib/errors.js';
import { lockMediaOwner } from './media-access.js';
import { MEASUREMENT_TTL_MS, RECOMMENDATION_MEASUREMENT } from '../../shared/domain/recommendation-events.js';

interface Claims {
  policy: string; tenant: string; owner: string; product: string; profile: string; profile_hash: string;
  photo_version: number; photo_hash: string; preset: string; version: string; issued: number; expires: number;
}
const domain = 'ypcc:recommendation-measurement:v1:';
export function recommendationMeasurement(cfg: Config, p: Principal, profile: DTO<'Profile'>, photoHash: string, preset: DTO<'PresetSummary'>): DTO<'RecommendationMeasurement'> {
  const issued = Date.now();
  const payload: Claims = { policy: RECOMMENDATION_MEASUREMENT, tenant: p.tenantId, owner: p.userId, product: profile.product_id,
    profile: profile.profile_id, profile_hash: profile.profile_hash, photo_version: profile.photo_version, photo_hash: photoHash,
    preset: preset.preset_id, version: preset.version, issued, expires: issued + MEASUREMENT_TTL_MS };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return { token: `${encoded}.${hmac(cfg.signingKey, domain + encoded)}`, expires_at: new Date(payload.expires).toISOString() };
}
function claims(cfg: Config, token: string): Claims {
  const segments = token.split('.'), encoded = segments[0] ?? '', signature = segments[1] ?? '';
  requireThat(token.length <= 4096 && segments.length === 2 && /^[A-Za-z0-9_-]+$/.test(encoded)
    && equalSecret(signature, hmac(cfg.signingKey, domain + encoded)), 'MEASUREMENT_INVALID', '推荐记录已失效，请刷新', 400);
  let value: unknown; try { value = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')); } catch { value = null; }
  const c = value as Claims | null;
  const strings = ['policy','tenant','owner','product','profile','profile_hash','photo_hash','preset','version'] as const;
  requireThat(!!c && typeof c === 'object' && Object.keys(c).length === 12 && strings.every(k => typeof c[k] === 'string' && c[k].length > 0 && c[k].length <= 128)
    && c.policy === RECOMMENDATION_MEASUREMENT && [c.photo_version,c.issued,c.expires].every(Number.isSafeInteger)
    && c.photo_version > 0 && c.expires - c.issued === MEASUREMENT_TTL_MS && c.issued <= Date.now() + 5000,
  'MEASUREMENT_INVALID', '推荐记录已失效，请刷新', 400);
  requireThat(c!.expires > Date.now(), 'MEASUREMENT_EXPIRED', '推荐记录已过期，请刷新', 410);
  return c!;
}
/** Naturally idempotent telemetry. It never changes eligibility, costs or an order. */
export async function recordRecommendationEvent(db: Db, cfg: Config, p: Principal, productId: string, request: DTO<'RecommendationEventRequest'>): Promise<DTO<'RecommendationEventReceipt'>> {
  const c = claims(cfg, request.measurement_token);
  requireThat(c.tenant === p.tenantId && c.owner === p.userId && c.product === productId, 'MEASUREMENT_SCOPE_CHANGED', '推荐不属于当前商品或账户', 404);
  await lockMediaOwner(db, p.tenantId, p.userId);
  const product = await owned<DTO<'Product'>>(db, 'product_drafts', productId, p, true);
  requireThat(product.data.profile_id === c.profile && product.data.photo_version === c.photo_version, 'INPUT_VERSION_CHANGED', '商品已更新，请刷新推荐', 409);
  const profile = await owned<DTO<'Profile'>>(db, 'profile_versions', c.profile, p);
  const photo = (await db.query<{ photo_set_hash: string }>('SELECT photo_set_hash FROM product_photo_versions WHERE tenant_id=$1 AND id=$2 AND product_id=$3 AND revision=$4', [p.tenantId, profile.photo_version_id, productId, c.photo_version])).rows[0];
  requireThat(profile.product_id === productId && profile.profile_hash === c.profile_hash && photo?.photo_set_hash === c.photo_hash, 'INPUT_VERSION_CHANGED', '商品已更新，请刷新推荐', 409);
  const version = (await db.query<{id:string}>(`SELECT v.id FROM preset_versions v JOIN presets p ON p.id=v.preset_id
    WHERE p.id=$1 AND p.visibility='PUBLIC' AND p.current_version=$2 AND v.version=$2`, [c.preset, c.version])).rows[0];
  requireThat(!!version, 'PRESET_VERSION_CHANGED', '方案版本已更新，请刷新推荐', 409);
  const result = await db.query(`INSERT INTO recommendation_events(tenant_id,owner_id,product_id,profile_id,preset_version_id,policy,kind)
    VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING`, [p.tenantId,p.userId,productId,c.profile,version!.id,c.policy,request.kind]);
  return { accepted: true, duplicate: result.rowCount === 0 };
}
