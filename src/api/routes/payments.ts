import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import type { Config } from '../config.js';
import { AlipayClient } from '../adapters/alipay.js';
import { DouyinClient, verifyDouyin } from '../adapters/douyin.js';
import { object } from '../../shared/domain/json.js';
import { requireThat } from '../lib/errors.js';
import { hash, id } from '../lib/crypto.js';
import { transaction } from '../db/pool.js';
import { outbox } from '../db/store.js';
export function moneyFen(value: unknown): number {
  requireThat(typeof value === 'string' && /^\d{1,10}(?:\.\d{1,2})?$/.test(value), 'PAYMENT_AMOUNT_INVALID', '支付金额格式无效', 422);
  const [whole, decimals = ''] = value.split('.'); const result = Number(whole) * 100 + Number(decimals.padEnd(2, '0'));
  requireThat(Number.isSafeInteger(result), 'PAYMENT_AMOUNT_INVALID', '支付金额超出范围', 422); return result;
}
export async function registerPayments(app: FastifyInstance, cfg: Config, pool: pg.Pool): Promise<void> {
  // Raw bytes are required for Byte-* signatures. Scope the parser to this plugin.
  await app.register(async webhooks => {
    webhooks.removeContentTypeParser('application/json');
    webhooks.addContentTypeParser('application/json', { parseAs: 'string', bodyLimit: 1_000_000 }, (_req, body, done) => done(null, body));
    webhooks.post<{ Params: { provider: string } }>('/v1/p01/payment-events/:provider', async (request, reply) => {
      requireThat(cfg.paymentsEnabled, 'PAYMENTS_DISABLED', '交易通知入口尚未启用', 503);
      const provider = request.params.provider; requireThat(['alipay', 'douyin'].includes(provider), 'PAYMENT_PROVIDER_INVALID', '不支持的支付通道', 400);
      let orderId: string;
      if (provider === 'alipay') {
        const body = object(request.body); const fields: Record<string, string> = {};
        for (const [k, v] of Object.entries(body)) { requireThat(typeof v === 'string', 'PAYMENT_BODY_INVALID', '支付宝通知格式无效', 400); fields[k] = v; }
        new AlipayClient(cfg).verifyNotification(fields);
        requireThat(fields.out_trade_no, 'PAYMENT_ORDER_MISSING', '支付通知缺少原订单号', 400); orderId = fields.out_trade_no;
      } else {
        requireThat(typeof request.body === 'string', 'PAYMENT_BODY_INVALID', '抖音通知格式无效', 400);
        verifyDouyin(cfg.douyin.paymentKey, request.body, request.headers);
        const body = object(JSON.parse(request.body) as unknown); requireThat(body.type === 'payment' || body.type === 'refund', 'PAYMENT_EVENT_INVALID', '当前通知类型不受支持', 400);
        const msg = object(typeof body.msg === 'string' ? JSON.parse(body.msg) as unknown : body.msg); const wire = await new DouyinClient(cfg).contract();
        const candidate = msg[wire.notification.orderField]; requireThat(typeof candidate === 'string', 'PAYMENT_ORDER_MISSING', '支付通知缺少原订单号', 400); orderId = candidate;
      }
      // Notifications only wake an original-order query. Entitlement is granted
      // from the signed server query, never from arbitrary callback fields.
      await transaction(pool, async db => {
        const order = (await db.query<{ tenant_id: string }>('SELECT tenant_id FROM orders WHERE id=$1 AND channel=$2', [orderId, provider])).rows[0];
        requireThat(order, 'PAYMENT_ORDER_MISSING', '无法匹配原订单', 404);
        await outbox(db, order.tenant_id, 'PaymentQueryRequested', orderId, `payment-notify:${provider}:${orderId}:${hash(request.body)}`, { order_id: orderId, provider, notification_hash: hash(request.body) });
      });
      return provider === 'alipay' ? reply.type('text/plain').send('success') : reply.send({ err_no: 0, err_tips: 'success' });
    });
  });
}
