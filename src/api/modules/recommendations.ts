import type { Db } from '../db/pool.js';
import type { Config } from '../config.js';
import type { DTO, Principal } from '../../shared/contracts/types.js';
import { owned, type PageQuery } from '../db/store.js';
import { hash } from '../lib/crypto.js';
import { cursor, limit } from '../lib/pagination.js';
import { AppError, requireThat } from '../lib/errors.js';
import { matchProductStyles, RECOMMENDATION_POLICY } from '../../shared/domain/recommendations.js';
import type { VariantSource } from './catalog.js';
import { codexAdmission } from '../../worker/codex/admission.js';
import { bundleForSource } from '../../worker/codex/skills.js';
import { bindProductionFont, verifyResourceLicenses } from '../../worker/media/font.js';
import type { ResourceBinding } from '../../worker/compiler/snapshot.js';
import { recommendationMeasurement } from './recommendation-events.js';

interface CandidateVariant { data: DTO<'Variant'>; private: { source: VariantSource; resource_versions?: ResourceBinding[] } }
interface Candidate { id: string; data: DTO<'PresetSummary'>; score: number; variants: CandidateVariant[] }
const marker = '2026-10-30T00:00:00.000Z';

/** Read-only shortlist. The immutable plan, quote and payment gates still revalidate the exact selected version. */
export async function recommendPresets(db: Db, cfg: Config, p: Principal, productId: string, query: PageQuery): Promise<DTO<'RecommendationList'>> {
  const size = limit(query.limit);
  const product = await owned<DTO<'Product'>>(db, 'product_drafts', productId, p);
  requireThat(product.data.profile_id && product.data.photo_version, 'PROFILE_REQUIRED', '请先完成照片识别', 422);
  const row = await owned<DTO<'Profile'>>(db, 'profile_versions', product.data.profile_id, p);
  const profile = row.data;
  requireThat(profile.product_id === productId && profile.photo_version === product.data.photo_version
    && row.product_id === productId && row.profile_hash === profile.profile_hash, 'INPUT_VERSION_CHANGED', '商品照片或档案已更新，请刷新');
  const photo = (await db.query<{ id: string; data: { asset_id: string; sha256: string }[]; photo_set_hash: string }>(
    'SELECT id,data,photo_set_hash FROM product_photo_versions WHERE tenant_id=$1 AND product_id=$2 AND revision=$3',
    [p.tenantId, productId, profile.photo_version])).rows[0];
  requireThat(photo && Array.isArray(photo.data) && photo.data.length >= 3 && photo.data.length <= 5
    && photo.photo_set_hash === hash({ photos: photo.data, revision: profile.photo_version, normalization: 'sharp-auto-orient-strip-png-v1' })
    && row.photo_version_id === photo.id, 'PHOTO_SET_CHANGED', '当前照片绑定不完整，请重新拍照', 422);
  const assetIds = photo.data.map(a => a.asset_id);
  const assets = await db.query<{ id: string; sha256: string }>(`SELECT a.id,a.sha256 FROM product_photo_items i JOIN assets a ON a.id=i.asset_id AND a.tenant_id=i.tenant_id
    WHERE i.tenant_id=$1 AND i.photo_version_id=$2 AND a.owner_id=$3 AND a.product_id=$4 AND a.state='READY' AND a.expires_at>clock_timestamp()`,
  [p.tenantId, photo.id, p.userId, productId]);
  requireThat(assets.rows.length === assetIds.length && new Set(assetIds).size === assetIds.length
    && new Set(photo.data.map(a => a.sha256)).size === assetIds.length
    && photo.data.every(a => assets.rows.some(b => b.id === a.asset_id && b.sha256 === a.sha256)),
  'PHOTO_SET_CHANGED', '部分照片已失效，请重新拍照', 422);
  const lock = await db.query('SELECT id FROM identity_locks WHERE tenant_id=$1 AND profile_id=$2 AND id=$3', [p.tenantId, profile.profile_id, profile.identity_lock_id]);
  requireThat(lock.rows.length === 1, 'IDENTITY_LOCK_CHANGED', '商品身份版本已更新，请重新识别', 422);
  const matches = matchProductStyles(profile, assetIds);
  const scope = hash({ kind: RECOMMENDATION_POLICY, tenant: p.tenantId, owner: p.userId, productId,
    profile: profile.profile_id, profileHash: profile.profile_hash, photos: photo.photo_set_hash });
  const point = cursor.decode(cfg, query.cursor, scope);
  let afterScore = 2147483647, afterId = '';
  if (point) {
    const decoded: unknown = (() => { try { return JSON.parse(point.id); } catch { return null; } })();
    requireThat(Array.isArray(decoded) && decoded.length === 2 && Number.isInteger(decoded[0]) && typeof decoded[1] === 'string'
      && point.createdAt === marker, 'INVALID_CURSOR', '分页已失效，请刷新列表', 400);
    [afterScore, afterId] = decoded as [number, string];
  }
  const roles = profile.photo_roles.filter(r => assetIds.includes(r.asset_id));
  if (profile.conflicts.length || !roles.some(r => r.role === 'WHOLE') || !cfg.paymentsEnabled || !cfg.codex.enabled)
    return { items: [], next_cursor: null };
  try { await codexAdmission(cfg); } catch (error) { if (error instanceof AppError && error.status === 503) return { items: [], next_cursor: null }; throw error; }
  const hasDetail = roles.some(r => r.role === 'DETAIL' || r.role === 'LABEL');
  const scores = Object.fromEntries(Object.entries(matches).map(([id, match]) => [id, match.score]));
  const items: DTO<'Recommendation'>[] = [];
  const readiness = new Map<string, boolean>();
  // Bounded scanning with a signed keyset cursor; no hidden 100-preset ceiling or full-catalog materialization.
  let scanned = 0, more = false;
  while (items.length < size && scanned < 500) {
    const candidates = await db.query<Candidate>(`WITH eligible AS (
      SELECT p.id,p.data,x.data AS variant,x.private,COALESCE(($1::jsonb->>(CASE WHEN p.source='OFFICIAL' THEN p.id ELSE x.private->'source'->'creative_components'->>'platform_style_id' END))::int,0) AS score
      FROM presets p JOIN preset_versions v ON v.preset_id=p.id AND v.version=p.current_version
      JOIN execution_variants x ON x.preset_version_id=v.id
      WHERE p.visibility='PUBLIC' AND x.sale_enabled AND x.admission_state='ADMITTED' AND x.price_fen IS NOT NULL
        AND x.data->>'sale_enabled'='true' AND x.data->>'admission_state'='ADMITTED' AND x.data->>'price_fen'=x.price_fen::text
        AND (x.engine='PHOTO_LAYOUT' OR ($4::boolean AND $5::boolean))
        AND EXISTS(SELECT 1 FROM skill_bundles s WHERE s.state='ADMITTED' AND s.bundle_hash=x.private->'source'->'skill_bundle'->>'hash')
        AND jsonb_typeof(x.private->'model_version_ids')='array' AND jsonb_array_length(x.private->'model_version_ids')>0
        AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements_text(x.private->'model_version_ids') mid
          WHERE NOT EXISTS(SELECT 1 FROM provider_model_versions m WHERE m.id=mid AND m.status='ADMITTED'))
    ), grouped AS (SELECT id,data,max(score) AS score,jsonb_agg(jsonb_build_object('data',variant,'private',private) ORDER BY variant->>'variant_id') AS variants FROM eligible GROUP BY id,data)
    SELECT * FROM grouped WHERE score<$2 OR (score=$2 AND id>$3) ORDER BY score DESC,id ASC LIMIT 50`,
    [JSON.stringify(scores), afterScore, afterId, hasDetail, cfg.generationEnabled]);
    if (!candidates.rows.length) { more = false; break; }
    for (const candidate of candidates.rows) {
      afterScore = candidate.score; afterId = candidate.id; scanned++;
      const accepted: CandidateVariant[] = [];
      for (const variant of candidate.variants) {
        const source = variant.private.source, key = hash({ source, resources: variant.private.resource_versions ?? [] });
        let ready = readiness.get(key);
        if (ready === undefined) {
          try { await bundleForSource(cfg, source); await verifyResourceLicenses(db, bindProductionFont(variant.private.resource_versions ?? [])); ready = true; }
          catch (error) { if (error instanceof AppError && (error.status < 500 || error.status === 503)) ready = false; else throw error; }
          readiness.set(key, ready);
        }
        if (ready) accepted.push(variant);
      }
      if (accepted.length) {
        const style = accepted.map(v => candidate.data.source === 'OFFICIAL' ? candidate.id : String(v.private.source.creative_components.platform_style_id ?? ''))
          .sort((a, b) => (matches[b]?.score ?? 0) - (matches[a]?.score ?? 0))[0]!;
        items.push({ preset: { ...candidate.data, sale_enabled: true }, variant_ids: accepted.map(v => v.data.variant_id),
          reason: matches[style]?.reason ?? '当前照片满足该方案的输入要求，你可以按喜欢的风格选择。', missing_inputs: [],
          measurement: recommendationMeasurement(cfg, p, profile, photo.photo_set_hash, candidate.data) });
      }
      if (items.length === size || scanned === 500) { more = true; break; }
    }
    if (items.length === size || scanned === 500) break;
    if (candidates.rows.length < 50) { more = false; break; }
  }
  return { items, next_cursor: more ? cursor.encode(cfg, { createdAt: marker, id: JSON.stringify([afterScore, afterId]) }, scope) : null };
}
