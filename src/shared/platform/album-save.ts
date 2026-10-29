import {ClientError} from '../client/api';

export interface AlbumCallbacks {
  filePath:string; success(result?:unknown):void; fail(error:unknown):void; complete(result?:unknown):void;
}
export interface NativeAlbumApi {
  saveImageToPhotosAlbum?(options:AlbumCallbacks):void;
  saveVideoToPhotosAlbum?(options:AlbumCallbacks):void;
}
const pending=new WeakSet<NativeAlbumApi>();
export const ALBUM_CALLBACK_TIMEOUT_MS=60000;
/** Serialize through complete, including across queues. A missing callback never authorizes a second native write. */
export async function saveNativeAlbum(api:NativeAlbumApi,platform:'alipay'|'douyin',path:string,kind:'image'|'video'):Promise<'SAVED'|'UNKNOWN'>{
  const method=kind==='image'?api.saveImageToPhotosAlbum:api.saveVideoToPhotosAlbum;
  if(typeof method!=='function')throw new ClientError('HOST_ALBUM_UNAVAILABLE','当前应用版本不支持保存这类素材，请升级后从原素材包继续');
  if(pending.has(api))throw new ClientError('ALBUM_CALLBACK_PENDING','上一项相册保存结果仍待核对，请先查看相册并稍后从原素材包继续');
  pending.add(api);
  return new Promise((resolve,reject)=>{
    let outcome:'SAVED'|'FAILED'|undefined,failure:ClientError|undefined,settled=false;
    const finish=(completed:boolean)=>{
      if(completed)pending.delete(api);
      if(settled)return;settled=true;clearTimeout(timer);
      if(outcome==='FAILED')reject(failure);
      else resolve(completed&&outcome==='SAVED'?'SAVED':'UNKNOWN');
    };
    const timer=setTimeout(()=>finish(false),ALBUM_CALLBACK_TIMEOUT_MS);
    try{method.call(api,{filePath:path,
      success:()=>{if(!outcome)outcome='SAVED';},
      fail:error=>{
        if(outcome)return;outcome='FAILED';
        const code=platform==='alipay'&&error&&typeof error==='object'&&'error' in error?Number(error.error):null;
        failure=code===15?new ClientError('ALBUM_PERMISSION_DENIED','未获相册权限，请在系统设置中允许后仅重试未完成项'):
          code===16?new ClientError('ALBUM_STORAGE_FULL','手机空间不足，请清理空间后仅重试未完成项'):
          new ClientError('ALBUM_SAVE_FAILED','这份素材未保存成功，可从原素材包重试');
      },
      complete:()=>finish(true)});
    }catch{finish(false);}
  });
}
