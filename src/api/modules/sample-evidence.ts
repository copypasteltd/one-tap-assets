import type { Db } from '../db/pool.js';
import type { Config } from '../config.js';
import type { Principal } from '../../shared/contracts/types.js';
import { sha256 } from '../lib/crypto.js';
import { requireThat } from '../lib/errors.js';
import { storage } from '../storage/storage.js';

export interface SampleObject { item_id: string; kind: 'image' | 'video'; object_key: string; sha256: string; size_bytes: number }
/** Publication reads independently owned sample copies, never buyer input
 * objects. File integrity is additional to the production/QC receipt. */
export async function verifySampleFiles(db: Db, cfg: Config, owner: Pick<Principal, 'tenantId' | 'userId'>, sampleId: string, value: unknown): Promise<SampleObject[]> {
  requireThat(Array.isArray(value) && value.length > 0 && value.length <= 100, 'SAMPLE_MEDIA_INVALID', '样例文件不完整，请重新制作', 422);
  const seen = new Set<string>(); const store = storage(cfg); let total = 0;
  for (const raw of value as SampleObject[]) {
    requireThat(raw && typeof raw.item_id === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(raw.item_id) && !seen.has(raw.item_id)
      && ['image', 'video'].includes(raw.kind) && typeof raw.object_key === 'string' && raw.object_key.startsWith(`${owner.tenantId}/samples/${sampleId}/`)
      && /^[a-f0-9]{64}$/.test(raw.sha256) && Number.isSafeInteger(raw.size_bytes) && raw.size_bytes > 0 && raw.size_bytes <= 125_000_000,
    'SAMPLE_MEDIA_INVALID', '样例文件归属或检查记录不完整，请重新制作', 422);
    seen.add(raw.item_id); total += raw.size_bytes;
    requireThat(total <= 250_000_000, 'SAMPLE_MEDIA_TOO_LARGE', '样例文件超出本次核验上限', 422);
    const registered = await db.query(`SELECT id FROM private_object_writes WHERE tenant_id=$1 AND owner_id=$2 AND object_key=$3 AND sha256=$4
      AND kind='MEDIA' AND state='STORED' AND NOT delete_requested AND expires_at>now() FOR SHARE`, [owner.tenantId, owner.userId, raw.object_key, raw.sha256]);
    requireThat(registered.rowCount === 1, 'SAMPLE_MEDIA_UNAVAILABLE', '样例文件已过期、撤回或尚未完成保存', 422);
    requireThat(await store.exists(raw.object_key), 'SAMPLE_MEDIA_UNAVAILABLE', '样例文件暂不可用，请重新检查制作结果', 422);
    const bytes = await store.get(raw.object_key, raw.size_bytes);
    requireThat(bytes.length === raw.size_bytes && sha256(bytes) === raw.sha256, 'SAMPLE_MEDIA_CHANGED', '样例文件与原检查记录不一致，请重新制作', 422);
  }
  return value as SampleObject[];
}
