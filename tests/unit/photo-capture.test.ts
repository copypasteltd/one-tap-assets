import {beforeEach,it,expect,vi} from 'vitest';
import type {LocalPhoto} from '../../src/shared/platform/ports';
import type {ClientSession} from '../../src/shared/client/session';
import {digest} from '../../src/shared/client/sha256';
import {selectPhotos,validatePhotos,photoSelectionKey} from '../../src/shared/client/photo-selection';
import {analyzePhotos} from '../../src/shared/client/photos';
const native=vi.hoisted(()=>({chooseImage:vi.fn(),getImageInfo:vi.fn(),readFile:vi.fn()}));
vi.mock('@tarojs/taro',()=>({default:{...native,getFileSystemManager:()=>({readFile:native.readFile})}}));
import {taroHost} from '../../src/shared/platform/taro-host';

// Native picker protocol is synthetic; original JPEG bytes are validated by the API integration case.
const photo=(n:number):LocalPhoto=>{
  const bytes=new Uint8Array([255,216,255,n]).buffer;
  return {path:`photo-${n}.jpg`,bytes,width:640,height:800,mime:'image/jpeg',sha256:digest(new Uint8Array(bytes))};
};
const host=()=>taroHost({platform:'alipay',login:async()=>'',pay:async()=>'UNKNOWN',save:async()=>'UNKNOWN'});
beforeEach(()=>{
  vi.resetAllMocks();native.getImageInfo.mockResolvedValue({width:640,height:800});
  native.readFile.mockImplementation((options:{success:(r:{data:ArrayBuffer})=>void})=>options.success({data:photo(1).bytes}));
});
it('accepts one native camera photo and requests only the camera with count one',async()=>{
  native.chooseImage.mockResolvedValue({tempFilePaths:['camera.jpg']});
  const photos=await host().choosePhotos({source:'camera',count:1});
  expect(photos).toHaveLength(1);expect(photos[0]!.sha256).toBe(photo(1).sha256);
  expect(native.chooseImage).toHaveBeenCalledWith({count:1,sizeType:['original'],sourceType:['camera']});
});
it('limits an album addition to the remaining slots and preserves a cancellation',async()=>{
  native.chooseImage.mockRejectedValue({errMsg:'chooseImage:fail cancel'});
  const picked=await host().choosePhotos({source:'album',count:2});
  expect(native.chooseImage).toHaveBeenCalledWith({count:2,sizeType:['original'],sourceType:['album']});
  const current=[photo(1),photo(2),photo(3)];expect(selectPhotos(current,picked)).toBe(current);
  expect(native.readFile).not.toHaveBeenCalled();
});
it('keeps selected photos after denied camera access without exposing native errors',async()=>{
  native.chooseImage.mockRejectedValue({errMsg:'chooseImage:fail auth denied',private_data:'not-for-display'});
  await expect(host().choosePhotos({source:'camera',count:1})).rejects.toMatchObject({code:'PHOTO_PICKER_FAILED',message:'未能打开相机或相册，请检查授权后重试'});
  expect(native.readFile).not.toHaveBeenCalled();
});
it('builds a complete set one photo at a time and retakes only the selected position',()=>{
  let photos:LocalPhoto[]=[];for(let i=1;i<=3;i++)photos=selectPhotos(photos,[photo(i)]);
  expect(()=>validatePhotos(photos)).not.toThrow();const key=photoSelectionKey(photos),original=[...photos];
  photos=selectPhotos(photos,[photo(4)],1);
  expect(photos.map(p=>p.sha256)).toEqual([original[0]!.sha256,photo(4).sha256,original[2]!.sha256]);
  expect(photoSelectionKey(photos)).not.toBe(key);expect(original[1]!.sha256).toBe(photo(2).sha256);
});
it('rejects duplicate additions, duplicate retakes and a sixth photo while preserving the current set',()=>{
  const photos=[1,2,3,4,5].map(photo),key=photoSelectionKey(photos);
  expect(()=>selectPhotos(photos,[photo(6)])).toThrow(expect.objectContaining({code:'PHOTO_COUNT'}));
  expect(()=>selectPhotos(photos,[photo(3)],0)).toThrow(expect.objectContaining({code:'DUPLICATE_PHOTO'}));
  expect(()=>selectPhotos(photos.slice(0,2),[photo(1)])).toThrow(expect.objectContaining({code:'DUPLICATE_PHOTO'}));
  expect(photoSelectionKey(photos)).toBe(key);
});
it('blocks an incomplete or invalid set before login, draft creation or upload',async()=>{
  const login=vi.fn(),client={login} as unknown as ClientSession;
  await expect(analyzePhotos(client,[photo(1)],'batch')).rejects.toMatchObject({code:'PHOTO_COUNT'});
  const bad={...photo(3),width:639};
  await expect(analyzePhotos(client,[photo(1),photo(2),bad],'batch')).rejects.toMatchObject({code:'PHOTO_SIZE'});
  expect(login).not.toHaveBeenCalled();
});
