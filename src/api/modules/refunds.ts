import type { Db } from '../db/pool.js';
import type { DTO } from '../../shared/contracts/types.js';
import { scoped, insert, update, outbox } from '../db/store.js';
import { id, iso } from '../lib/crypto.js';
import { requireThat, notFound } from '../lib/errors.js';

export async function requestRefundInternal(db: Db, tenantId: string, orderId: string, reason: string): Promise<DTO<'Refund'>> {
  const order = await scoped<DTO<'Order'>>(db, 'orders', orderId, tenantId, true);
  const existing = (await db.query<{ data: DTO<'Refund'> }>('SELECT data FROM refunds WHERE order_id=$1 AND tenant_id=$2', [orderId, tenantId])).rows[0];
  if (existing) return existing.data;
  requireThat(order.data.payment_state === 'CONFIRMED', 'PAYMENT_NOT_CONFIRMED', '付款状态尚未确认，系统会先核对原交易');
  const payment = (await db.query<{ id: string; provider: string; merchant_id: string }>('SELECT id,provider,merchant_id FROM payments WHERE order_id=$1 AND tenant_id=$2', [orderId, tenantId])).rows[0] ?? notFound();
  const data: DTO<'Refund'> = { refund_id: id('refund'), order_id: orderId, state: 'REQUESTED', amount_fen: order.data.amount_fen, updated_at: iso() };
  await insert(db, 'refunds', { id: data.refund_id, tenant_id: tenantId, order_id: orderId, payment_id: payment.id, refund_intent_key: `refund:${orderId}`,
    state: data.state, amount_fen: data.amount_fen, provider: payment.provider, merchant_id: payment.merchant_id, data, private: { reason } });
  await update(db, 'orders', orderId, { data: { ...order.data, refund_id: data.refund_id }, updated_at: iso() }, tenantId);
  await outbox(db, tenantId, 'RefundRequested', orderId, `refund:${orderId}`, { refund_id: data.refund_id }); return data;
}
