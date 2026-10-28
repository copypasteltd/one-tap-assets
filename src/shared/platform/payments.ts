import type { DTO } from '../contracts/types';
import type { LocalStore } from './ports';
import { ClientError } from '../client/api';
type Outcome = 'RETURNED' | 'CANCELLED' | 'UNKNOWN';
interface NativeOrderJournal { state: 'CREATING' | 'UNKNOWN' | 'READY'; nativeOrderId: string | null }
export async function douyinPayment(action: DTO<'PaymentAction'>, contractVersion: string, store: LocalStore,
  create: (data: string, authorization: string) => Promise<string | null>, pay: (id: string) => Promise<Outcome>): Promise<Outcome> {
  if (action.channel !== 'douyin' || action.action.kind !== 'INVOKE_PLATFORM_PAYMENT' || !contractVersion || action.action.adapter_contract_version !== contractVersion || Date.parse(action.expires_at) <= Date.now())
    throw new ClientError('PAYMENT_NOT_ADMITTED', '当前交易方式尚未开放或付款授权已过期，请查询原订单');
  let payload: Record<string, unknown>; let orderData: Record<string, unknown>;
  try { payload = JSON.parse(action.action.serialized_platform_payload) as Record<string, unknown>; orderData = JSON.parse(String(payload.data)) as Record<string, unknown>; }
  catch { throw new ClientError('PAYMENT_ACTION_INVALID', '付款信息未准备好，请查询原订单'); }
  if (payload.kind !== 'DOUYIN_REQUEST_ORDER' || payload.currency !== 'CNY' || typeof payload.data !== 'string' || typeof payload.byteAuthorization !== 'string' || orderData.outOrderNo !== action.order_id)
    throw new ClientError('PAYMENT_ACTION_INVALID', '付款信息与当前订单不一致，请查询原订单');
  const key = `ypcc:douyin:native-order:${action.order_id}`; const old = store.get<NativeOrderJournal>(key);
  if (old && old.state !== 'READY') return 'UNKNOWN';
  let nativeId = old?.nativeOrderId ?? null;
  if (!nativeId) {
    // A crash between requestOrder and its callback must not cause another platform order submission.
    store.set<NativeOrderJournal>(key, { state: 'CREATING', nativeOrderId: null });
    try { nativeId = await create(payload.data, payload.byteAuthorization); } catch { nativeId = null; }
    store.set<NativeOrderJournal>(key, { state: nativeId ? 'READY' : 'UNKNOWN', nativeOrderId: nativeId });
  }
  return nativeId ? pay(nativeId) : 'UNKNOWN';
}
