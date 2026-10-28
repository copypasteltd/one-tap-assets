import type pg from 'pg';
import type { Config } from '../../api/config.js';
import { transaction } from '../../api/db/pool.js';
import { insert, outbox, update } from '../../api/db/store.js';
import { AlipayClient, AlipayBusinessError } from '../../api/adapters/alipay.js';
import { DouyinClient, pointer } from '../../api/adapters/douyin.js';
import { confirmPayment } from '../../api/modules/commerce.js';
import { moneyFen } from '../../api/routes/payments.js';
import { hash, id, iso } from '../../api/lib/crypto.js';
import { requireThat, notFound } from '../../api/lib/errors.js';
import { object } from '../../shared/domain/json.js';
import type { DTO } from '../../shared/contracts/types.js';

interface PaymentRow { id: string; tenant_id: string; order_id: string; provider: DTO<'Platform'>; state: string; merchant_id: string; provider_order_id: string | null; data: DTO<'PaymentAction'>; private: Record<string, unknown> }
interface OrderRow { id: string; tenant_id: string; subject_id: string; app_id: string; data: DTO<'Order'> }
const amountText = (fen: number): string => `${Math.floor(fen / 100)}.${String(fen % 100).padStart(2, '0')}`;
export class PaymentReconciler {
  readonly alipay: AlipayClient; readonly douyin: DouyinClient;
  constructor(private pool: pg.Pool, private cfg: Config, adapters: { alipay?: AlipayClient; douyin?: DouyinClient } = {}) {
    this.alipay = adapters.alipay ?? new AlipayClient(cfg); this.douyin = adapters.douyin ?? new DouyinClient(cfg);
  }
  private async load(tenantId: string, orderId: string): Promise<{ payment: PaymentRow; order: OrderRow }> {
    const payment = (await this.pool.query<PaymentRow>('SELECT * FROM payments WHERE tenant_id=$1 AND order_id=$2', [tenantId, orderId])).rows[0] ?? notFound();
    const order = (await this.pool.query<OrderRow>('SELECT * FROM orders WHERE tenant_id=$1 AND id=$2', [tenantId, orderId])).rows[0] ?? notFound();
    const config = payment.provider === 'alipay' ? this.cfg.alipay : this.cfg.douyin;
    requireThat(this.cfg.paymentsEnabled && order.app_id === config.appId && payment.merchant_id === config.merchantId, 'PAYMENT_CONFIGURATION_MISMATCH', '原订单对应的应用或商户配置不可用', 503);
    return { payment, order };
  }
  async create(tenantId: string, orderId: string): Promise<void> {
    const { payment, order } = await this.load(tenantId, orderId);
    if (payment.state === 'CONFIRMED') return;
    if (payment.state !== 'CREATED') { await this.query(tenantId, orderId); return; }
    if (Date.parse(order.data.payable_until) <= Date.now() || order.data.fulfillment_state === 'CANCELLED') { await this.query(tenantId, orderId); return; }
    // The durable marker commits before external submission. Recovery only
    // queries the original out_trade_no; it never blindly buys a second order.
    const won = await this.pool.query(`UPDATE payments SET state='PENDING',private=private||jsonb_build_object('submitted_at',$3::text),
      data=data||'{"state":"PENDING"}'::jsonb,updated_at=now() WHERE id=$1 AND tenant_id=$2 AND state='CREATED' RETURNING id`, [payment.id, tenantId, iso()]);
    if (!won.rowCount) { await this.query(tenantId, orderId); return; }
    try {
      let serialized: string; let adapterVersion: string;
      if (payment.provider === 'alipay') {
        const response = await this.alipay.call('alipay.trade.create', { notify_url: `${this.cfg.publicBaseUrl}/v1/p01/payment-events/alipay`,
          biz_content: JSON.stringify({ out_trade_no: orderId, total_amount: amountText(order.data.amount_fen), subject: '一品成片商品素材整包制作', buyer_id: order.subject_id,
            product_code: 'JSAPI_PAY', timeout_express: `${Math.max(1, Math.floor((Date.parse(order.data.payable_until) - Date.now()) / 60000))}m` }) });
        requireThat(typeof response.trade_no === 'string' && response.out_trade_no === orderId, 'PAYMENT_RESPONSE_SCOPE_INVALID', '支付服务返回的原订单不匹配', 503);
        serialized = JSON.stringify({ kind: 'ALIPAY_TRADE_PAY', tradeNO: response.trade_no }); adapterVersion = 'YPCC-ALIPAY-JSAPI-1';
        await this.pool.query('UPDATE payments SET provider_order_id=$1 WHERE id=$2 AND tenant_id=$3', [response.trade_no, payment.id, tenantId]);
      } else {
        serialized = await this.douyin.createAction(order.data); adapterVersion = (await this.douyin.contract()).version;
      }
      await transaction(this.pool, async db => {
        const current = (await db.query<PaymentRow>('SELECT * FROM payments WHERE id=$1 AND tenant_id=$2 FOR UPDATE', [payment.id, tenantId])).rows[0]!;
        if (current.state === 'CONFIRMED') return;
        const action: DTO<'PaymentAction'> = { ...current.data, state: 'PENDING', action: { kind: 'INVOKE_PLATFORM_PAYMENT', adapter_contract_version: adapterVersion, serialized_platform_payload: serialized } };
        await update(db, 'payments', payment.id, { data: action, state: 'PENDING', updated_at: iso() }, tenantId);
      });
    } catch (error) {
      await this.pool.query(`UPDATE payments SET state='UNKNOWN',updated_at=now(),data=data||'{"state":"UNKNOWN","action":{"kind":"QUERY_ORIGINAL_ORDER"}}'::jsonb WHERE id=$1 AND tenant_id=$2 AND state<>'CONFIRMED'`, [payment.id, tenantId]);
      throw error;
    }
    await transaction(this.pool, db => outbox(db, tenantId, 'PaymentQueryRequested', orderId, `payment-first-query:${payment.id}`, {}));
  }
  async query(tenantId: string, orderId: string): Promise<void> {
    const { payment, order } = await this.load(tenantId, orderId);
    if (payment.state === 'CONFIRMED') return;
    let paid = false; let subjectId: string; let providerOrderId: string; let amountFen: number; let closed = false; let raw: unknown;
    if (payment.provider === 'alipay') {
      let result: Record<string, unknown>;
      try { result = await this.alipay.call('alipay.trade.query', { biz_content: JSON.stringify({ out_trade_no: orderId }) }); }
      catch (e) {
        if (e instanceof AlipayBusinessError && e.subCode === 'ACQ.TRADE_NOT_EXIST') {
          // A signed not-found is still not a license to resubmit an uncertain
          // create. Keep reconciling until the original payment window closes.
          if (Date.parse(order.data.payable_until) < Date.now()) await this.markClosed(payment, 'CANCELLED');
          return;
        }
        throw e;
      }
      requireThat(result.out_trade_no === orderId && typeof result.trade_no === 'string' && typeof result.buyer_user_id === 'string', 'PAYMENT_RESPONSE_SCOPE_INVALID', '原交易查询结果不匹配', 503);
      if (result.seller_id) requireThat(result.seller_id === payment.merchant_id, 'PAYMENT_RESPONSE_SCOPE_INVALID', '原交易商户不匹配', 503);
      raw = result; subjectId = result.buyer_user_id; providerOrderId = result.trade_no; amountFen = moneyFen(result.total_amount);
      paid = ['TRADE_SUCCESS', 'TRADE_FINISHED'].includes(String(result.trade_status)); closed = result.trade_status === 'TRADE_CLOSED';
      if (!paid && !closed) {
        const action = { ...payment.data, state: 'PENDING' as const, action: { kind: 'INVOKE_PLATFORM_PAYMENT' as const, adapter_contract_version: 'YPCC-ALIPAY-JSAPI-1', serialized_platform_payload: JSON.stringify({ kind: 'ALIPAY_TRADE_PAY', tradeNO: providerOrderId }) } };
        await this.pool.query("UPDATE payments SET state='PENDING',provider_order_id=$3,data=$4,updated_at=now() WHERE id=$1 AND tenant_id=$2 AND state<>'CONFIRMED'", [payment.id, tenantId, providerOrderId, action]);
      }
    } else {
      const wire = await this.douyin.contract(); const response = await this.douyin.call(wire.query.path, { [wire.query.requestOrderField]: orderId });
      const result = object(pointer(response, wire.query.dataPointer)); raw = response;
      requireThat(result[wire.query.outOrderField] === orderId && typeof result[wire.query.orderIdField] === 'string' && typeof result[wire.query.subjectField] === 'string', 'PAYMENT_RESPONSE_SCOPE_INVALID', '抖音原交易查询结果不匹配', 503);
      amountFen = Number(result[wire.query.amountField]); subjectId = String(result[wire.query.subjectField]); providerOrderId = String(result[wire.query.orderIdField]);
      requireThat(Number.isSafeInteger(amountFen) && amountFen >= 0, 'PAYMENT_AMOUNT_INVALID', '抖音原交易金额格式无效', 503);
      paid = wire.query.paidStatuses.includes(String(result[wire.query.statusField]));
    }
    if (paid) await transaction(this.pool, db => confirmPayment(db, { channel: payment.provider, appId: order.app_id, merchantId: payment.merchant_id,
      subjectId, orderId, providerOrderId, eventKey: `query-paid:${payment.provider}:${providerOrderId}`, amountFen, rawHash: hash(raw) }));
    else if (closed) await this.markClosed(payment, 'CANCELLED');
  }
  private async markClosed(payment: PaymentRow, state: 'CANCELLED' | 'FAILED'): Promise<void> {
    await transaction(this.pool, async db => {
      await db.query(`UPDATE payments SET state=$3,data=data||jsonb_build_object('state',$3::text,'action',jsonb_build_object('kind','QUERY_ORIGINAL_ORDER')),updated_at=now()
        WHERE id=$1 AND tenant_id=$2 AND state<>'CONFIRMED'`, [payment.id, payment.tenant_id, state]);
      await db.query(`UPDATE orders SET payment_state=$3,data=data||jsonb_build_object('payment_state',$3::text),updated_at=now()
        WHERE id=$1 AND tenant_id=$2 AND payment_state<>'CONFIRMED'`, [payment.order_id, payment.tenant_id, state]);
    });
  }
  async refund(tenantId: string, orderId: string): Promise<void> {
    const { payment, order } = await this.load(tenantId, orderId);
    const row = (await this.pool.query<{ id: string; state: string; amount_fen: number; data: DTO<'Refund'> }>('SELECT * FROM refunds WHERE tenant_id=$1 AND order_id=$2', [tenantId, orderId])).rows[0] ?? notFound();
    if (row.state === 'REFUNDED') return;
    requireThat(payment.state === 'CONFIRMED' && row.amount_fen <= order.data.amount_fen, 'REFUND_NOT_ALLOWED', '原支付或退款金额不符合要求', 409);
    const submit = row.state === 'REQUESTED' && (await this.pool.query(`UPDATE refunds SET state='PROCESSING',data=data||'{"state":"PROCESSING"}'::jsonb,
      private=private||jsonb_build_object('submitted_at',$3::text),updated_at=now() WHERE id=$1 AND tenant_id=$2 AND state='REQUESTED' RETURNING id`, [row.id, tenantId, iso()])).rowCount === 1;
    let confirmed = false;
    try {
      if (payment.provider === 'alipay') {
        const response = await this.alipay.call(submit ? 'alipay.trade.refund' : 'alipay.trade.fastpay.refund.query', { biz_content: JSON.stringify({ out_trade_no: orderId, out_request_no: row.id,
          ...(submit ? { refund_amount: amountText(row.amount_fen), refund_reason: '一品成片订单原路退款' } : {}) }) });
        requireThat(response.out_trade_no === orderId && response.trade_no === payment.provider_order_id, 'REFUND_SCOPE_INVALID', '退款查询与原支付不匹配', 503);
        const amount = response.refund_amount ?? response.refund_fee;
        requireThat(moneyFen(amount) === row.amount_fen, 'REFUND_AMOUNT_INVALID', '退款金额与原申请不匹配', 503);
        confirmed = response.refund_status === 'REFUND_SUCCESS' || (submit && response.fund_change === 'Y');
      } else {
        const wire = await this.douyin.contract(); const response = await this.douyin.call(submit ? wire.refund.createPath : wire.refund.queryPath,
          { [wire.refund.originalOrderField]: orderId, [wire.refund.refundIntentField]: row.id, ...(submit ? { [wire.refund.amountField]: row.amount_fen } : {}) });
        confirmed = wire.refund.successValues.includes(pointer(response, wire.refund.successPointer) as string | number);
      }
    } catch (error) {
      await this.pool.query(`UPDATE refunds SET state='UNKNOWN',data=data||'{"state":"UNKNOWN"}'::jsonb,updated_at=now() WHERE id=$1 AND tenant_id=$2 AND state<>'REFUNDED'`, [row.id, tenantId]); throw error;
    }
    if (confirmed) await transaction(this.pool, async db => {
      await db.query('SELECT id FROM orders WHERE id=$1 AND tenant_id=$2 FOR UPDATE', [orderId, tenantId]);
      const current = (await db.query<{ state: string }>('SELECT state FROM refunds WHERE id=$1 AND tenant_id=$2 FOR UPDATE', [row.id, tenantId])).rows[0]!;
      if (current.state === 'REFUNDED') return;
      const total = (await db.query<{ n: string }>("SELECT COALESCE(sum(amount_fen),0) AS n FROM ledger_entries WHERE tenant_id=$1 AND order_id=$2 AND entry_type='REFUND'", [tenantId, orderId])).rows[0]!;
      requireThat(Number(total.n) + row.amount_fen <= order.data.amount_fen, 'REFUND_LIMIT_EXCEEDED', '退款累计金额超过原支付', 409);
      await insert(db, 'ledger_entries', { id: id('ledger'), tenant_id: tenantId, order_id: orderId, event_key: `refunded:${row.id}`, entry_type: 'REFUND', amount_fen: row.amount_fen, currency: 'CNY' });
      await update(db, 'refunds', row.id, { state: 'REFUNDED', data: { ...row.data, state: 'REFUNDED', updated_at: iso() }, updated_at: iso() }, tenantId);
    });
  }
  async scheduleReconciliation(): Promise<void> {
    if (!this.cfg.paymentsEnabled) return;
    const window = Math.floor(Date.now() / 30000);
    await transaction(this.pool, async db => {
      const payments = await db.query<{ tenant_id: string; order_id: string }>("SELECT tenant_id,order_id FROM payments WHERE state IN ('CREATED','PENDING','UNKNOWN') AND created_at>now()-interval '2 days' ORDER BY created_at LIMIT 100");
      for (const p of payments.rows) await outbox(db, p.tenant_id, 'PaymentQueryRequested', p.order_id, `pay-reconcile:${p.order_id}:${window}`, {});
      const refunds = await db.query<{ tenant_id: string; order_id: string }>("SELECT tenant_id,order_id FROM refunds WHERE state IN ('REQUESTED','PROCESSING','UNKNOWN') ORDER BY created_at LIMIT 100");
      for (const r of refunds.rows) await outbox(db, r.tenant_id, 'RefundRequested', r.order_id, `refund-reconcile:${r.order_id}:${window}`, {});
    });
  }
}
