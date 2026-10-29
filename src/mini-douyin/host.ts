import { taroHost } from '../shared/platform/taro-host';
import { ClientError } from '../shared/client/api';
import { douyinPayment } from '../shared/platform/payments';
import {saveNativeAlbum,type NativeAlbumApi} from '../shared/platform/album-save';
declare const tt: NativeAlbumApi & { canIUse(name: string): boolean; login(options: { success(r: { code?: string }): void; fail(e: unknown): void }): void;
  requestOrder(options: { data: string; byteAuthorization: string; success(r: { orderId?: string }): void; fail(e: unknown): void }): void;
  getOrderPayment(options: { orderId: string; success(): void; fail(e: unknown): void }): void };
declare const __YPCC_DOUYIN_TRADE_CONTRACT__: string;
export const host = taroHost({ platform: 'douyin',
  login: () => new Promise((resolve, reject) => tt.login({ success: result => result.code ? resolve(result.code) : reject(new ClientError('LOGIN_FAILED', '未取得登录凭证，请重试')), fail: reject })),
  async pay(action) {
    if (!tt.canIUse('requestOrder') || !tt.canIUse('getOrderPayment')) throw new ClientError('HOST_PAYMENT_UNAVAILABLE', '当前抖音版本不支持这项交易，请升级后查询原订单');
    return douyinPayment(action, __YPCC_DOUYIN_TRADE_CONTRACT__, host.storage,
      (data, byteAuthorization) => new Promise(resolve => tt.requestOrder({ data, byteAuthorization, success: r => resolve(r.orderId ?? null), fail: () => resolve(null) })),
      orderId => new Promise(resolve => tt.getOrderPayment({ orderId, success: () => resolve('RETURNED'), fail: () => resolve('UNKNOWN') })));
  },
  save:(path,kind)=>saveNativeAlbum(tt,'douyin',path,kind),
});
