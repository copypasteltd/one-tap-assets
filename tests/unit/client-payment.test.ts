import { it, expect } from 'vitest';
import { douyinPayment } from '../../src/shared/platform/payments';
import type { DTO } from '../../src/shared/contracts/types';
import type { LocalStore } from '../../src/shared/platform/ports';
function fixture() {
  const records = new Map<string, unknown>(); const store: LocalStore = { get: <T,>(key: string) => records.get(key) as T ?? null, set: (key, value) => { records.set(key, value); }, remove: key => { records.delete(key); } };
  const action: DTO<'PaymentAction'> = { payment_id: 'payment-1', order_id: 'order-1', state: 'PENDING', channel: 'douyin', expires_at: '2099-01-01T00:00:00Z', action: { kind: 'INVOKE_PLATFORM_PAYMENT', adapter_contract_version: 'fixture-adapter-1', serialized_platform_payload: JSON.stringify({ kind: 'DOUYIN_REQUEST_ORDER', currency: 'CNY', data: JSON.stringify({ outOrderNo: 'order-1' }), byteAuthorization: 'fixture-not-a-signature' }) } };
  return { store, action };
}
it('reopens a returned native order without calling requestOrder again or declaring payment confirmed', async () => {
  const f = fixture(); let created = 0; let paid = 0;
  const create = async () => { created++; return 'native-order-1'; }; const pay = async (id: string) => { expect(id).toBe('native-order-1'); paid++; return 'RETURNED' as const; };
  for (let i = 0; i < 2; i++) expect(await douyinPayment(f.action, 'fixture-adapter-1', f.store, create, pay)).toBe('RETURNED');
  expect(created).toBe(1); expect(paid).toBe(2);
});
it('keeps an ambiguous native creation durable across a restart without resubmitting', async () => {
  const f = fixture(); let created = 0; const create = async () => { created++; throw new Error('callback lost'); };
  for (let i = 0; i < 2; i++) expect(await douyinPayment(f.action, 'fixture-adapter-1', f.store, create, async () => 'RETURNED')).toBe('UNKNOWN'); expect(created).toBe(1);
});
it('blocks an unadmitted protocol and a signed payload for a different original order', async () => {
  const f = fixture(); let created = 0; const create = async () => { created++; return 'native'; };
  await expect(douyinPayment(f.action, '', f.store, create, async () => 'RETURNED')).rejects.toMatchObject({ code: 'PAYMENT_NOT_ADMITTED' });
  f.action.order_id = 'other-order'; await expect(douyinPayment(f.action, 'fixture-adapter-1', f.store, create, async () => 'RETURNED')).rejects.toMatchObject({ code: 'PAYMENT_ACTION_INVALID' }); expect(created).toBe(0);
});
