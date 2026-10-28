import type { Db } from '../db/pool.js';
import type { Config } from '../config.js';
import type { DTO } from '../../shared/contracts/types.js';
import type { PageQuery } from '../db/store.js';
import { sha256 } from '../lib/crypto.js';
import { notFound, requireThat } from '../lib/errors.js';
import { cursor, limit } from '../lib/pagination.js';
import { validate } from '../lib/validation.js';

export async function license(db: Db, licenseId: string, lock = false): Promise<DTO<'PresetLicense'>> {
  const row = (await db.query<{ data: DTO<'PresetLicense'> }>(`SELECT data FROM community_licenses WHERE id=$1${lock ? ' FOR SHARE' : ''}`, [licenseId])).rows[0] ?? notFound();
  validate('PresetLicense', row.data, true);
  requireThat(sha256(row.data.full_text) === row.data.content_hash, 'LICENSE_INTEGRITY_FAILED', '许可内容暂不可用，请稍后重试', 503);
  return row.data;
}
export async function licenses(db: Db, cfg: Config, query: PageQuery): Promise<DTO<'PresetLicenseList'>> {
  const scope = 'preset-license-catalog'; const size = limit(query.limit); const point = cursor.decode(cfg, query.cursor, scope);
  const rows = (await db.query<{ id: string; created_at: Date; data: DTO<'PresetLicense'> }>(`SELECT id,created_at,data FROM community_licenses
    WHERE state<>'RETIRED' AND ($1::timestamptz IS NULL OR (created_at,id)<($1,$2)) ORDER BY created_at DESC,id DESC LIMIT $3`,
  [point?.createdAt ?? null, point?.id ?? null, size + 1])).rows;
  const selected = rows.slice(0, size); const last = selected.at(-1);
  return { items: selected.map(({ data: { full_text: _text, ...summary } }) => summary), next_cursor: rows.length > size && last ? cursor.encode(cfg, { createdAt: last.created_at.toISOString(), id: last.id }, scope) : null };
}
export async function registerLicense(db: Db, body: DTO<'PresetLicenseRegistration'>): Promise<DTO<'PresetLicense'>> {
  const data: DTO<'PresetLicense'> = { ...body, state: 'DRAFT', content_hash: sha256(body.full_text) };
  const created = await db.query('INSERT INTO community_licenses(id,version,state,content_hash,data) VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO NOTHING RETURNING id', [data.license_id, data.version, data.state, data.content_hash, JSON.stringify(data)]);
  requireThat(created.rowCount === 1, 'LICENSE_VERSION_EXISTS', '许可版本已存在，请登记新版本', 409);
  return data;
}
export async function decideLicense(db: Db, licenseId: string, body: DTO<'PresetLicenseDecision'>): Promise<DTO<'PresetLicense'>> {
  const row = (await db.query<{ data: DTO<'PresetLicense'> }>('SELECT data FROM community_licenses WHERE id=$1 FOR UPDATE', [licenseId])).rows[0] ?? notFound();
  requireThat(row.data.state === body.expected_state && row.data.content_hash === body.expected_content_hash, 'LICENSE_VERSION_CHANGED', '许可版本或状态已更新，请重新核对', 409);
  const state = body.decision === 'APPROVE' ? 'ACTIVE' : 'RETIRED';
  requireThat(state !== 'ACTIVE' || row.data.state === 'DRAFT', 'LICENSE_STATE_INVALID', '该许可版本不能执行此操作', 422);
  const data: DTO<'PresetLicense'> = { ...row.data, state };
  await db.query('UPDATE community_licenses SET state=$2,data=$3,review_reference=$4,updated_at=now() WHERE id=$1', [licenseId, state, JSON.stringify(data), body.review_reference]);
  if (state === 'RETIRED') {
    // Stop new sales; immutable existing order contracts remain separate.
    await db.query(`UPDATE execution_variants x SET sale_enabled=false,revision=x.revision+1,
      data=x.data||'{"sale_enabled":false,"reason_codes":["LICENSE_RETIRED"]}'::jsonb
      FROM preset_versions v WHERE x.preset_version_id=v.id AND v.license_version=$1`, [licenseId]);
    await db.query(`UPDATE publications SET admission_state='SUSPENDED',revision=revision+1,updated_at=now(),
      data=data||'{"sale_enabled":false,"admission_state":"SUSPENDED","reason_codes":["LICENSE_RETIRED"]}'::jsonb||jsonb_build_object('revision',revision+1)
      WHERE private->'request'->>'license_version'=$1`, [licenseId]);
  }
  return data;
}
