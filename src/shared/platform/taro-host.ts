import Taro from '@tarojs/taro';
import type { HostPort, LocalPhoto } from './ports';
import { ClientError } from '../client/api';
import { digest } from '../client/sha256';
import {validatePhotos} from '../client/photo-selection';

export function taroHost(native: Pick<HostPort, 'platform' | 'login' | 'pay' | 'save'>): HostPort {
  const transport: HostPort['transport'] = async input => {
    const task = Taro.request<unknown>({ url: input.url, method: input.method as 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', header: input.headers,
      data: input.body, timeout: 30000, dataType: 'json' });
    const abort = (): void => task.abort(); if (input.signal?.aborted) { task.abort(); throw new ClientError('CANCELLED', '请求已取消'); }
    input.signal?.addEventListener('abort', abort, { once: true });
    try { const result = await task; return { status: result.statusCode, data: result.data,
      headers: Object.fromEntries(Object.entries(result.header ?? {}).map(([k, v]) => [k.toLowerCase(), String(v)])) }; }
    finally { input.signal?.removeEventListener('abort', abort); }
  };
  return { ...native, transport, storage: {
    get: <T,>(key: string): T | null => { const value: unknown = Taro.getStorageSync(key); return value === '' || value === undefined ? null : value as T; },
    set: <T,>(key: string, value: T): void => Taro.setStorageSync(key, value), remove: (key: string): void => Taro.removeStorageSync(key),
  },
  async choosePhotos(options) {
    const count=options?.source==='camera'?1:options?.count??5;
    if(!Number.isInteger(count)||count<1||count>5)throw new ClientError('PHOTO_COUNT','本次最多选择5张照片');
    let selected:Awaited<ReturnType<typeof Taro.chooseImage>>;
    try{selected=await Taro.chooseImage({count,sizeType:['original'],sourceType:options?[options.source]:['camera','album']});}
    catch(error){
      const message=error&&typeof error==='object'&&'errMsg' in error?String(error.errMsg):'';
      if(/\bcancel\b/i.test(message))return [];
      throw new ClientError('PHOTO_PICKER_FAILED','未能打开相机或相册，请检查授权后重试');
    }
    if(!selected.tempFilePaths.length||selected.tempFilePaths.length>count)throw new ClientError('PHOTO_COUNT','本次照片数量不符合选择范围，请重新选择');
    const photos: LocalPhoto[] = []; let total = 0;
    for (const path of selected.tempFilePaths) {
      const manager = Taro.getFileSystemManager();
      const bytes = await new Promise<ArrayBuffer>((resolve, reject) => manager.readFile({ filePath: path,
        success: result => typeof result.data === 'string' ? reject(new ClientError('PHOTO_READ_FAILED', '无法读取原始照片，请重新选择')) : resolve(result.data), fail: reject }));
      const u8 = new Uint8Array(bytes); const mime = u8[0] === 0xff && u8[1] === 0xd8 && u8[2] === 0xff ? 'image/jpeg' : u8[0] === 137 && u8[1] === 80 && u8[2] === 78 && u8[3] === 71 ? 'image/png' : null;
      if (!mime) throw new ClientError('PHOTO_FORMAT', '请选择JPG或PNG照片，其他格式请先转换');
      const info = await Taro.getImageInfo({ src: path }); total += bytes.byteLength;
      if (bytes.byteLength > 10000000 || total > 50000000 || Math.min(info.width, info.height) < 640 || info.width * info.height > 30000000)
        throw new ClientError('PHOTO_SIZE', '每张照片需小于10MB、短边至少640像素，总计不超过50MB');
      const sha256 = digest(u8); if (photos.some(p => p.sha256 === sha256)) throw new ClientError('DUPLICATE_PHOTO', '发现重复照片，请换一个角度拍摄');
      photos.push({ path, bytes, width: info.width, height: info.height, mime, sha256 });
    }
    validatePhotos(photos,1);return photos;
  },
  async upload(grant, photo) {
    if (!/^https:\/\//.test(grant.upload_url) || Date.parse(grant.expires_at) <= Date.now()) throw new ClientError('UPLOAD_EXPIRED', '上传授权已过期，请重试当前照片');
    if (grant.method === 'POST') {
      const result = await Taro.uploadFile({ url: grant.upload_url, filePath: photo.path, name: 'file', header: grant.headers, formData: grant.form_fields, timeout: 30000,
        ...(native.platform === 'alipay' ? { fileType: 'image' } : {}) });
      if (result.statusCode < 200 || result.statusCode >= 300) throw new ClientError('UPLOAD_FAILED', '照片尚未上传完成，请续传当前照片', result.statusCode, true); return;
    }
    // Grant credentials only; product Bearer tokens never accompany media URLs.
    const response = await transport({ url: grant.upload_url, method: 'PUT', headers: { ...grant.headers, 'Content-Type': 'application/octet-stream' }, body: photo.bytes });
    if (response.status < 200 || response.status >= 300) throw new ClientError('UPLOAD_FAILED', '照片尚未上传完成，请续传当前照片', response.status, true);
  },
  async download(link) {
    if (!/^https:\/\//.test(link.url) || Date.parse(link.expires_at) <= Date.now()) throw new ClientError('LINK_EXPIRED', '领取链接已过期，请重新领取');
    const result = await Taro.downloadFile({ url: link.url }); if (result.statusCode !== 200) throw new ClientError('DOWNLOAD_FAILED', '下载未完成，请重新领取', result.statusCode, true); return result.tempFilePath;
  },
  async copy(text) { await Taro.setClipboardData({ data: text }); },
  };
}
