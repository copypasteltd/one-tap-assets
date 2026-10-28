import type { Db } from '../db/pool.js';
import { hash } from '../lib/crypto.js';
import { POLICIES } from '../../shared/domain/policies.js';

export interface FrozenInput { product_id: string; photo_version: number; photo_set_hash: string }
/** Called within the order transaction. An unpaid order grants no extension.
 * Never revive deleted/expired input or retain another revision of a product. */
export async function extendFrozenInputRetention(db: Db, tenantId: string, ownerId: string,
  frozen: FrozenInput, expiresAt: string): Promise<boolean> {
  const product = await db.query(`SELECT id FROM product_drafts WHERE tenant_id=$1 AND owner_id=$2 AND id=$3
    AND deleted_at IS NULL AND expires_at>clock_timestamp() FOR UPDATE`, [tenantId, ownerId, frozen.product_id]);
  if (!product.rowCount) return false;
  const rows = (await db.query<{ id: string; sha256: string }>(`SELECT a.id,a.sha256 FROM product_photo_versions v
    JOIN product_photo_items p ON p.tenant_id=v.tenant_id AND p.photo_version_id=v.id
    JOIN assets a ON a.tenant_id=p.tenant_id AND a.id=p.asset_id
    WHERE v.tenant_id=$1 AND v.product_id=$3 AND v.revision=$4 AND v.photo_set_hash=$5
    AND a.owner_id=$2 AND a.product_id=$3 AND a.state='READY' AND a.expires_at>clock_timestamp()
    ORDER BY p.position FOR UPDATE OF a`, [tenantId, ownerId, frozen.product_id, frozen.photo_version, frozen.photo_set_hash])).rows;
  if (rows.length < POLICIES.minPhotos || rows.length > POLICIES.maxPhotos
    || hash({ photos: rows.map(a => ({ asset_id: a.id, sha256: a.sha256 })), revision: frozen.photo_version,
      normalization: 'sharp-auto-orient-strip-png-v1' }) !== frozen.photo_set_hash) return false;
  await db.query('UPDATE assets SET expires_at=GREATEST(expires_at,$3::timestamptz) WHERE tenant_id=$1 AND id=ANY($2::text[])',
    [tenantId, rows.map(a => a.id), expiresAt]);
  await db.query('UPDATE product_drafts SET expires_at=GREATEST(expires_at,$3::timestamptz) WHERE tenant_id=$1 AND id=$2',
    [tenantId, frozen.product_id, expiresAt]);
  await db.query(`UPDATE private_object_writes SET expires_at=GREATEST(expires_at,$3::timestamptz)
    WHERE tenant_id=$1 AND asset_id=ANY($2::text[]) AND state<>'DELETED' AND NOT delete_requested`, [tenantId, rows.map(a => a.id), expiresAt]);
  await db.query(`UPDATE private_object_writes SET expires_at=GREATEST(expires_at,$3::timestamptz)
    WHERE tenant_id=$1 AND product_id=$2 AND kind='RECEIPT' AND state<>'DELETED' AND NOT delete_requested`, [tenantId, frozen.product_id, expiresAt]);
  return true;
}
