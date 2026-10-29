import type {LocalPhoto} from '../platform/ports';
import {ClientError} from './api';
import {fingerprint} from './sha256';

/** Picking may return one image; only a complete, distinct set may be uploaded. */
export function validatePhotos(photos:readonly LocalPhoto[],minimum=3):void{
  if(photos.length<minimum||photos.length>5)throw new ClientError('PHOTO_COUNT',minimum===3?'请准备3–5张不同角度的商品照片':'最多添加5张商品照片');
  let total=0;const seen=new Set<string>();
  for(const photo of photos){
    if(!photo.path||!['image/jpeg','image/png'].includes(photo.mime)||!/^[a-f0-9]{64}$/.test(photo.sha256))
      throw new ClientError('PHOTO_FORMAT','照片信息不完整，请重新拍摄或选择JPG/PNG照片');
    total+=photo.bytes.byteLength;
    if(!photo.bytes.byteLength||photo.bytes.byteLength>10000000||total>50000000
      ||!Number.isInteger(photo.width)||!Number.isInteger(photo.height)||Math.min(photo.width,photo.height)<640||photo.width*photo.height>30000000)
      throw new ClientError('PHOTO_SIZE','每张照片需小于10MB、短边至少640像素，总计不超过50MB');
    if(seen.has(photo.sha256))throw new ClientError('DUPLICATE_PHOTO','这张照片已经添加，请换一个角度拍摄');
    seen.add(photo.sha256);
  }
}
export function photoSelectionKey(photos:readonly LocalPhoto[]):string{
  return fingerprint(JSON.stringify(photos.map(p=>({sha256:p.sha256,bytes:p.bytes.byteLength,mime:p.mime,width:p.width,height:p.height}))));
}
export function selectPhotos(current:LocalPhoto[],picked:LocalPhoto[],replace?:number):LocalPhoto[]{
  if(!picked.length)return current; // Cancellation does not discard existing photos or retry identity.
  if(replace!==undefined&&(!Number.isInteger(replace)||replace<0||replace>=current.length||picked.length!==1))
    throw new ClientError('PHOTO_REPLACEMENT_INVALID','请重新选择要重拍的照片');
  const next=replace===undefined?[...current,...picked]:current.map((photo,i)=>i===replace?picked[0]!:photo);
  validatePhotos(next,1);return next;
}
