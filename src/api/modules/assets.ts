import sharp from 'sharp';
import type pg from 'pg';
import type { Db } from '../db/pool.js';
import { transaction } from '../db/pool.js';
import type { Config } from '../config.js';
import type { ObjectStorage } from '../storage/storage.js';
import type { Principal, DTO } from '../../shared/contracts/types.js';
import { owned, insert, update } from '../db/store.js';
import { id, token, sha256, addSeconds, iso, equalSecret } from '../lib/crypto.js';
import { requireThat, AppError } from '../lib/errors.js';
import { POLICIES } from '../../shared/domain/policies.js';
import { lockMediaOwner } from './media-access.js';
import { writePrivateObject } from '../storage/private-objects.js';

export async function createUploadGrant(db: Db, cfg: Config, p: Principal, request: DTO<'AssetRequest'>): Promise<DTO<'UploadGrant'>> {
  await lockMediaOwner(db, p.tenantId, p.userId);
  if (request.product_id) {
    const product = await owned(db, 'product_drafts', request.product_id, p);
    requireThat(!product.deleted_at, 'INPUT_DELETED', '该商品已删除', 410);
  }
  const assetId = id('asset'); const secret = token(); const expiresAt = addSeconds(900);
  await insert(db, 'assets', { id: assetId, tenant_id: p.tenantId, owner_id: p.userId, product_id: request.product_id ?? null,
    purpose: request.purpose, state: 'UPLOADING', object_key: `${p.tenantId}/inputs/${assetId}.png`, upload_token_hash: sha256(secret),
    expected_bytes: request.size_bytes, declared_mime: request.mime_type, expected_sha256: request.sha256 ?? null,
    expires_at: addSeconds(86400), grant_expires_at: expiresAt });
  const multipart = p.platform === 'alipay';
  return { asset_id: assetId, method: multipart ? 'POST' : 'PUT', upload_url: `${cfg.publicBaseUrl}/storage/uploads/${assetId}`,
    headers: multipart ? { 'x-upload-token': secret } : { 'x-upload-token': secret, 'Content-Type': 'application/octet-stream' }, form_fields: {}, expires_at: expiresAt };
}
export async function normalizePhoto(bytes: Buffer, mime: string): Promise<{ bytes: Buffer; width: number; height: number; sha256: string }> {
  requireThat(bytes.length <= POLICIES.maxPhotoBytes, 'PHOTO_TOO_LARGE', '单张照片不能超过10MB', 413);
  try {
    const image = sharp(bytes, { limitInputPixels: POLICIES.maxPhotoPixels, failOn: 'warning', animated: false });
    const metadata = await image.metadata();
    requireThat((mime === 'image/jpeg' && metadata.format === 'jpeg') || (mime === 'image/png' && metadata.format === 'png'), 'PHOTO_TYPE_MISMATCH', '照片格式与文件内容不一致', 422);
    requireThat((metadata.pages ?? 1) === 1 && !!metadata.width && !!metadata.height, 'PHOTO_DECODE_FAILED', '无法读取该照片，请重新拍摄', 422);
    requireThat(Math.min(metadata.width, metadata.height) >= POLICIES.minShortEdge, 'PHOTO_RESOLUTION_LOW', '请使用短边至少640像素的清晰照片', 422);
    const output = await image.rotate().png({ compressionLevel: 6 }).toBuffer({ resolveWithObject: true });
    return { bytes: output.data, width: output.info.width, height: output.info.height, sha256: sha256(output.data) };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('PHOTO_DECODE_FAILED', '照片损坏、像素过大或格式不受支持，请重新拍摄', 422);
  }
}
export async function authorizeUpload(pool: pg.Pool, assetId: string, secret: string) {
  const row = (await pool.query<{ tenant_id: string; owner_id: string; product_id: string | null; upload_token_hash: string; state: string; expected_bytes: number; expected_sha256: string | null; declared_mime: string; object_key: string; grant_expires_at: Date }>('SELECT * FROM assets WHERE id=$1', [assetId])).rows[0];
  requireThat(row && equalSecret(row.upload_token_hash, sha256(secret)), 'UPLOAD_NOT_AUTHORIZED', '上传授权无效', 401);
  requireThat(row.grant_expires_at.getTime() > Date.now() && row.state === 'UPLOADING', 'UPLOAD_EXPIRED', '上传已完成或授权过期，请刷新', 410);
  return row;
}
export async function uploadAsset(pool: pg.Pool, store: ObjectStorage, assetId: string, secret: string, bytes: Buffer): Promise<void> {
  const row = await authorizeUpload(pool, assetId, secret);
  const rawHash = sha256(bytes);
  requireThat(bytes.length === row.expected_bytes && (!row.expected_sha256 || row.expected_sha256 === rawHash), 'UPLOAD_HASH_MISMATCH', '照片上传不完整，请重新上传', 422);
  const normalized = await normalizePhoto(bytes, row.declared_mime);
  // Reserve upload ownership before object write; one capability cannot race two writers.
  const claimed = await pool.query('UPDATE assets SET state=$1 WHERE id=$2 AND state=$3 AND grant_expires_at>now() RETURNING id', ['VERIFYING', assetId, 'UPLOADING']);
  requireThat(claimed.rowCount === 1, 'UPLOAD_ALREADY_USED', '该上传授权已使用');
  try {
    await writePrivateObject(pool, store, { tenantId: row.tenant_id, ownerId: row.owner_id, productId: row.product_id,
      assetId, kind: 'INPUT' }, row.object_key, normalized.bytes, 'image/png');
    await pool.query('UPDATE assets SET raw_sha256=$1,sha256=$2,size_bytes=$3,width=$4,height=$5,updated_at=now() WHERE id=$6 AND state=$7', [rawHash, normalized.sha256, bytes.length, normalized.width, normalized.height, assetId, 'VERIFYING']);
  } catch (error) { await pool.query('UPDATE assets SET state=$1 WHERE id=$2 AND state=$3', ['REJECTED', assetId, 'VERIFYING']); throw error; }
}
export async function completeAsset(db: Db, p: Principal, assetId: string, request: DTO<'AssetCompleteRequest'>): Promise<DTO<'Asset'>> {
  const row = await owned<DTO<'Asset'>>(db, 'assets', assetId, p, true);
  requireThat(row.state !== 'UPLOADING', 'UPLOAD_NOT_COMPLETE', '照片尚未上传，请继续上传当前照片', 409);
  requireThat(row.raw_sha256 === request.sha256 && row.sha256 && row.width && row.height, 'UPLOAD_HASH_MISMATCH', '照片尚未上传完整，请重试', 422);
  requireThat(row.state === 'VERIFYING' || row.state === 'READY', 'UPLOAD_STATE_INVALID', '照片上传状态不可用', 422);
  requireThat(new Date(String(row.expires_at)).getTime() > Date.now(), 'INPUT_EXPIRED', '照片已过期', 410);
  const data: DTO<'Asset'> = { asset_id: assetId, product_id: row.product_id as string | null, state: 'READY', mime_type: 'image/png',
    size_bytes: Number(row.size_bytes), width: Number(row.width), height: Number(row.height), sha256: String(row.sha256) };
  await update(db, 'assets', assetId, { state: data.state, data, updated_at: iso() }, p.tenantId); return data;
}
