import type { ClientSession } from './session';
import type { LocalPhoto } from '../platform/ports';
import type { DTO } from '../contracts/types';
import { ClientError } from './api';

/** A retry queries the original upload before writing. No photo bytes or short
 * links are put in navigation/storage, and an account switch stops the batch. */
export async function uploadEvidence(session: ClientSession, photos: LocalPhoto[], batchId: string,
  purpose: 'RIGHTS_EVIDENCE' | 'REPORT_EVIDENCE' | 'SUPPORT_EVIDENCE'): Promise<string[]> {
  if (!photos.length || photos.length > 5) throw new ClientError('EVIDENCE_REQUIRED', '请选择1至5张清晰的证明图片');
  await session.login(); const owner = session.api.userId;
  const check = (): void => { if (!owner || session.api.userId !== owner) throw new ClientError('ACCOUNT_CHANGED', '账户已变化，请重新选择证明图片'); };
  const ids: string[] = [];
  for (const [index, photo] of photos.entries()) {
    check();
    const body: DTO<'AssetRequest'> = { purpose, file_name: `证明图片-${index + 1}.${photo.mime === 'image/png' ? 'png' : 'jpg'}`,
      mime_type: photo.mime, size_bytes: photo.bytes.byteLength, sha256: photo.sha256 };
    const grant = await session.api.call('createUploadGrant', { body, key: session.intent('evidence-grant', { batchId, index, body }) });
    const complete = () => session.api.call('completeAssetUpload', { params: { asset_id: grant.asset_id }, body: { sha256: photo.sha256 },
      key: session.intent('evidence-complete', { assetId: grant.asset_id, sha256: photo.sha256 }) });
    try { await complete(); }
    catch (error) {
      if (!(error instanceof ClientError) || !['UPLOAD_NOT_COMPLETE', 'UPLOAD_PENDING', 'ASSET_NOT_UPLOADED'].includes(error.code)) throw error;
      check(); await session.host.upload(grant, photo); check(); await complete();
    }
    check(); ids.push(grant.asset_id);
  }
  return ids;
}
