import type { ClientSession } from './session';
import type { LocalPhoto } from '../platform/ports';
import { ClientError } from './api';
import {photoSelectionKey,validatePhotos} from './photo-selection';

/** Retrying a photo batch uses the same draft, asset intents and original binding revision. */
export async function analyzePhotos(client: ClientSession, photos: LocalPhoto[], batchId: string): Promise<string> {
  validatePhotos(photos);
  if(!batchId||batchId.length>128)throw new ClientError('PHOTO_BATCH_INVALID','请重新选择当前照片');
  await client.login();
  const buyer = client.api.userId; const scope = (): void => { if (client.api.userId !== buyer) throw new ClientError('ACCOUNT_CHANGED', '账户已变化，请重新选择当前账户的照片'); };
  const photoSetHash=photoSelectionKey(photos),previous=client.recover();
  if(previous.batchId===batchId&&previous.productId&&previous.photoSetHash!==photoSetHash)
    throw new ClientError('PHOTO_BATCH_CHANGED','照片已变化，请作为新一组提交；原上传记录已保留');
  const product = await client.api.call('createProduct', { body: {}, key: client.intent('draft', { batchId }) });
  scope();
  client.remember({ productId: product.product_id, batchId,photoSetHash,
    ...(previous.batchId!==batchId?{analysisId:undefined,planId:undefined,previewId:undefined,quoteId:undefined,orderId:undefined}:{}) }); const ids: string[] = [];
  for (const [index, photo] of photos.entries()) {
    scope();
    const request = { product_id: product.product_id, purpose: 'PRODUCT_PHOTO' as const, file_name: `商品照片-${index + 1}.${photo.mime === 'image/png' ? 'png' : 'jpg'}`, mime_type: photo.mime, size_bytes: photo.bytes.byteLength, sha256: photo.sha256 };
    const grant = await client.api.call('createUploadGrant', { body: request, key: client.intent('photo-grant', request) });
    const complete = (): ReturnType<typeof client.api.call<'completeAssetUpload'>> => client.api.call('completeAssetUpload', { params: { asset_id: grant.asset_id }, body: { sha256: photo.sha256 }, key: client.intent('photo-complete', { id: grant.asset_id, sha256: photo.sha256 }) });
    try { await complete(); }
    catch (error) {
      // Only a known absence of uploaded bytes permits the PUT; auth, integrity or network ambiguity must not overwrite an asset.
      if (!(error instanceof Error) || !('code' in error) || !['UPLOAD_NOT_COMPLETE', 'UPLOAD_PENDING', 'ASSET_NOT_UPLOADED'].includes(String(error.code))) throw error;
      scope(); await client.host.upload(grant, photo); scope(); await complete();
    }
    ids.push(grant.asset_id);
  }
  const bound = await client.api.call('bindProductPhotos', { params: { product_id: product.product_id }, body: { asset_ids: ids, expected_revision: product.revision }, key: client.intent('photo-binding', { product: product.product_id, ids }) });
  scope();
  const analysis = await client.api.call('createAnalysis', { params: { product_id: product.product_id }, body: { photo_version: bound.photo_version! }, key: client.intent('analysis', { product: product.product_id, version: bound.photo_version }) });
  scope();client.remember({ analysisId: analysis.analysis_id }); return analysis.analysis_id;
}
