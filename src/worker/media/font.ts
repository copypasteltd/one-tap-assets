import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Db } from '../../api/db/pool.js';
import { sha256 } from '../../api/lib/crypto.js';
import { requireThat } from '../../api/lib/errors.js';
import type { ResourceBinding } from '../compiler/snapshot.js';

export const FONT_BINDING: ResourceBinding = Object.freeze({
  resource_version_id: 'font-noto-sans-sc-a85815a42757630c',
  license_record_id: 'license-noto-sans-sc-ofl-a85815a4',
  hash: 'a3041811a78c361b1de50f953c805e0244951c21c5bd412f7232ef0d899af0da',
});
export const FONT_LICENSE_SHA = '1c05c68c34f9708415aada51f17e1b0092d2cea709bf4a94cd38114f9e73d7d9';
export const FONT_LICENSE = Object.freeze({ resource_version_id: FONT_BINDING.resource_version_id, resource_hash: FONT_BINDING.hash,
  license: 'OFL-1.1', license_sha256: FONT_LICENSE_SHA, source_commit: 'a85815a42757630ce188fdad368c2dfc444d4773' });
export interface ProductionFont { path: string; binding: ResourceBinding; supports: (codepoint: number) => boolean }

function coverage(bytes: Buffer): (cp: number) => boolean {
  let cmap = 0;
  for (let i = 0; i < bytes.readUInt16BE(4); i++) {
    const at = 12 + i * 16;
    if (bytes.toString('ascii', at, at + 4) === 'cmap') cmap = bytes.readUInt32BE(at + 8);
  }
  requireThat(cmap > 0, 'FONT_INVALID', '固定字体缺少字符映射', 503);
  const tables: number[] = [];
  for (let i = 0; i < bytes.readUInt16BE(cmap + 2); i++) tables.push(cmap + bytes.readUInt32BE(cmap + 8 + i * 8));
  const table = tables.find(t => bytes.readUInt16BE(t) === 12);
  requireThat(table !== undefined, 'FONT_INVALID', '固定字体缺少完整 Unicode 映射', 503);
  const count = bytes.readUInt32BE(table + 12);
  return cp => {
    let lo = 0; let hi = count - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >>> 1; const at = table + 16 + mid * 12;
      const start = bytes.readUInt32BE(at); const end = bytes.readUInt32BE(at + 4);
      if (cp < start) hi = mid - 1; else if (cp > end) lo = mid + 1;
      else return bytes.readUInt32BE(at + 8) + cp - start !== 0;
    }
    return false;
  };
}
export async function loadProductionFont(projectRoot: string): Promise<ProductionFont> {
  const directory = resolve(projectRoot, 'assets/resources/fonts/noto-sans-sc');
  const path = resolve(directory, 'NotoSansSC[wght].ttf');
  const bytes = await readFile(path); const license = await readFile(resolve(directory, 'OFL.txt'));
  requireThat(sha256(bytes) === FONT_BINDING.hash && sha256(license) === FONT_LICENSE_SHA,
    'FONT_RESOURCE_CHANGED', '固定字体或许可文件与发布版本不一致', 503);
  return { path, binding: FONT_BINDING, supports: coverage(bytes) };
}
export function bindProductionFont(resources: ResourceBinding[]): ResourceBinding[] {
  requireThat(resources.every(r => r.resource_version_id !== FONT_BINDING.resource_version_id ||
    (r.hash === FONT_BINDING.hash && r.license_record_id === FONT_BINDING.license_record_id)),
  'RESOURCE_BINDING_CHANGED', '字体资源绑定不一致', 503);
  return [...resources.filter(r => r.resource_version_id !== FONT_BINDING.resource_version_id), { ...FONT_BINDING }];
}
export async function verifyResourceLicenses(db: Db, resources: ResourceBinding[], lock = false): Promise<void> {
  requireThat(resources.some(r => r.resource_version_id === FONT_BINDING.resource_version_id && r.hash === FONT_BINDING.hash
    && r.license_record_id === FONT_BINDING.license_record_id), 'FONT_NOT_FROZEN', '订单缺少固定字体及许可绑定', 503);
  requireThat(new Set(resources.map(r => r.resource_version_id)).size === resources.length, 'RESOURCE_BINDING_CHANGED', '资源版本重复', 503);
  for (const resource of resources) {
    const result = await db.query<{ data: { resource_hash?: string; resource_version_id?: string; license_sha256?: string } }>(
      `SELECT data FROM resource_licenses WHERE id=$1 AND resource_id=$2 AND revoked_at IS NULL
       AND (expires_at IS NULL OR expires_at>clock_timestamp())${lock ? ' FOR SHARE' : ''}`, [resource.license_record_id, resource.resource_version_id]);
    const record = result.rows[0]?.data;
    requireThat(record?.resource_hash === resource.hash && record.resource_version_id === resource.resource_version_id
      && (resource.resource_version_id !== FONT_BINDING.resource_version_id || record.license_sha256 === FONT_LICENSE_SHA),
    'RESOURCE_LICENSE_UNAVAILABLE', '订单资源许可缺失、已撤销或版本不一致', 503);
  }
}
