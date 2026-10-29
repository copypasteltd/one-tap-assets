import {it,expect,vi,afterEach} from 'vitest';
import {saveNativeAlbum,ALBUM_CALLBACK_TIMEOUT_MS,type NativeAlbumApi,type AlbumCallbacks} from '../../src/shared/platform/album-save';
afterEach(()=>vi.useRealTimers());
it('selects the actual video API and waits for complete after success before another native save',async()=>{
  const calls:{kind:string;options:AlbumCallbacks}[]=[];const api:NativeAlbumApi={saveImageToPhotosAlbum:o=>{calls.push({kind:'image',options:o});},saveVideoToPhotosAlbum:o=>{calls.push({kind:'video',options:o});}};
  let finished=false;const first=saveNativeAlbum(api,'alipay','local-original.mp4','video').then(r=>{finished=true;return r;});
  expect(calls[0]!.kind).toBe('video');expect(calls[0]!.options.filePath).toBe('local-original.mp4');calls[0]!.options.success();await Promise.resolve();expect(finished).toBe(false);
  await expect(saveNativeAlbum(api,'alipay','local-original.png','image')).rejects.toMatchObject({code:'ALBUM_CALLBACK_PENDING'});expect(calls).toHaveLength(1);
  calls[0]!.options.complete();expect(await first).toBe('SAVED');const second=saveNativeAlbum(api,'alipay','local-original.png','image');
  calls[1]!.options.success();calls[1]!.options.complete();expect(await second).toBe('SAVED');expect(calls[1]!.kind).toBe('image');
});
it('reports complete without a success callback as UNKNOWN, never as a saved file',async()=>{
  const api:NativeAlbumApi={saveImageToPhotosAlbum:o=>o.complete({})};expect(await saveNativeAlbum(api,'alipay','local.png','image')).toBe('UNKNOWN');
});
it('keeps a timed-out native invocation pending and ignores late success until complete releases serialization',async()=>{
  vi.useFakeTimers();let callbacks!:AlbumCallbacks;const api:NativeAlbumApi={saveVideoToPhotosAlbum:o=>{callbacks=o;}};
  const first=saveNativeAlbum(api,'douyin','local.mp4','video');await vi.advanceTimersByTimeAsync(ALBUM_CALLBACK_TIMEOUT_MS);expect(await first).toBe('UNKNOWN');
  callbacks.success();await expect(saveNativeAlbum(api,'douyin','another.mp4','video')).rejects.toMatchObject({code:'ALBUM_CALLBACK_PENDING'});
  callbacks.complete();const next=saveNativeAlbum(api,'douyin','another.mp4','video');callbacks.success();callbacks.complete();expect(await next).toBe('SAVED');
});
it('uses fixed Alipay permission and storage errors and settles failure only after complete',async()=>{
  for(const [error,code] of [[15,'ALBUM_PERMISSION_DENIED'],[16,'ALBUM_STORAGE_FULL'],[17,'ALBUM_SAVE_FAILED']] as const){
    let callbacks!:AlbumCallbacks;const api:NativeAlbumApi={saveImageToPhotosAlbum:o=>{callbacks=o;}};let settled=false;
    const promise=saveNativeAlbum(api,'alipay','local.png','image').catch(e=>{settled=true;throw e;});callbacks.fail({error,private:'not exposed'});await Promise.resolve();expect(settled).toBe(false);
    const assertion=expect(promise).rejects.toMatchObject({code});callbacks.complete();await assertion;
  }
});
it('rejects unavailable APIs before invocation and never treats a synchronous bridge throw as safe to retry',async()=>{
  await expect(saveNativeAlbum({},'alipay','local.mp4','video')).rejects.toMatchObject({code:'HOST_ALBUM_UNAVAILABLE'});
  const api:NativeAlbumApi={saveVideoToPhotosAlbum:()=>{throw new Error('Synthetic unknown bridge send');}};
  expect(await saveNativeAlbum(api,'alipay','local.mp4','video')).toBe('UNKNOWN');await expect(saveNativeAlbum(api,'alipay','local.mp4','video')).rejects.toMatchObject({code:'ALBUM_CALLBACK_PENDING'});
});
it('uses the same filePath contract for Douyin and does not expose raw callback errors',async()=>{
  const api:NativeAlbumApi={saveVideoToPhotosAlbum:o=>{expect(o.filePath).toBe('local-original.mp4');o.fail({errNo:123,errMsg:'synthetic private payload'});o.complete();}};
  await expect(saveNativeAlbum(api,'douyin','local-original.mp4','video')).rejects.toMatchObject({code:'ALBUM_SAVE_FAILED',message:'这份素材未保存成功，可从原素材包重试'});
});
