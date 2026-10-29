import { taroHost } from '../shared/platform/taro-host';
import { ClientError } from '../shared/client/api';
import {saveNativeAlbum,type NativeAlbumApi} from '../shared/platform/album-save';
interface Result { authCode?: string; resultCode?: string; error?: number }
declare const my: NativeAlbumApi & { getAuthCode(options: { scopes: string; success(r: Result): void; fail(e: unknown): void }): void;
  tradePay(options: { tradeNO: string; success(r: Result): void; fail(e: unknown): void }): void };
export const host = taroHost({ platform: 'alipay',
  login: () => new Promise((resolve, reject) => my.getAuthCode({ scopes: 'auth_base', success: result => result.authCode ? resolve(result.authCode) : reject(new ClientError('LOGIN_FAILED', '未取得登录凭证，请重试')), fail: reject })),
  async pay(action) {
    if (action.channel !== 'alipay' || action.action.kind !== 'INVOKE_PLATFORM_PAYMENT' || action.action.adapter_contract_version !== 'YPCC-ALIPAY-JSAPI-1') return 'UNKNOWN';
    const payload: unknown = JSON.parse(action.action.serialized_platform_payload);
    if (!payload || typeof payload !== 'object' || !('kind' in payload) || payload.kind !== 'ALIPAY_TRADE_PAY' || !('tradeNO' in payload) || typeof payload.tradeNO !== 'string') throw new ClientError('PAYMENT_ACTION_INVALID', '付款信息未准备好，请查询原订单');
    const tradeNO = payload.tradeNO;
    return new Promise(resolve => my.tradePay({ tradeNO, success: result => resolve(result.resultCode === '6001' ? 'CANCELLED' : 'RETURNED'), fail: () => resolve('UNKNOWN') }));
  },
  save:(path,kind)=>saveNativeAlbum(my,'alipay',path,kind),
});
