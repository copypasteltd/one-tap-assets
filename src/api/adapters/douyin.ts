import { readFile } from 'node:fs/promises';
import { sign, verify, randomBytes } from 'node:crypto';
import type { Config } from '../config.js';
import { inside } from '../config.js';
import { safeHttp } from '../lib/http.js';
import { object } from '../../shared/domain/json.js';
import { AppError, requireThat } from '../lib/errors.js';
import type { DTO } from '../../shared/contracts/types.js';

export interface DouyinTradeContract {
  version: string; official_document_url: string; verified_evidence_id: string; admitted: boolean;
  sku: { type: number; tagGroupId: string; imageUrl: string };
  query: { path: string; requestOrderField: string; dataPointer: string; orderIdField: string; outOrderField: string; amountField: string; subjectField: string; statusField: string; paidStatuses: string[] };
  refund: { createPath: string; queryPath: string; originalOrderField: string; refundIntentField: string; amountField: string; successPointer: string; successValues: (string | number)[] };
  notification: { subjectField: string; orderField: string; amountField: string; providerOrderField: string; statusField: string; paidStatuses: (string | number)[] };
}
function key(value: string, kind: 'PRIVATE' | 'PUBLIC'): string { return value.includes('-----BEGIN') ? value.replaceAll('\\n', '\n') : `-----BEGIN ${kind} KEY-----\n${value.match(/.{1,64}/g)?.join('\n')}\n-----END ${kind} KEY-----`; }
export function douyinSignature(privateKey: string, appId: string, keyVersion: string, path: string, rawBody: string, now = Math.floor(Date.now() / 1000), nonce = randomBytes(16).toString('hex')): string {
  const message = `POST\n${path}\n${now}\n${nonce}\n${rawBody}\n`;
  const signature = sign('RSA-SHA256', Buffer.from(message), key(privateKey, 'PRIVATE')).toString('base64');
  return `SHA256-RSA2048 appid="${appId}",nonce_str="${nonce}",timestamp="${now}",key_version="${keyVersion}",signature="${signature}"`;
}
export function verifyDouyin(publicKey: string, raw: string, headers: Record<string, string | string[] | undefined>, now = Date.now()): void {
  const timestamp = headers['byte-timestamp']; const nonce = headers['byte-nonce-str']; const signature = headers['byte-signature'];
  requireThat(typeof timestamp === 'string' && typeof nonce === 'string' && typeof signature === 'string' && /^\d{10}$/.test(timestamp) && Math.abs(now - Number(timestamp) * 1000) <= 3600000, 'PAYMENT_SIGNATURE_INVALID', '支付通知缺少有效签名或已过期', 401);
  requireThat(verify('RSA-SHA256', Buffer.from(`${timestamp}\n${nonce}\n${raw}\n`), key(publicKey, 'PUBLIC'), Buffer.from(signature, 'base64')), 'PAYMENT_SIGNATURE_INVALID', '抖音支付通知验签失败', 401);
}
export function pointer(value: unknown, path: string): unknown {
  let current: unknown = value;
  for (const part of path.split('/').filter(Boolean)) current = object(current)[part.replaceAll('~1', '/').replaceAll('~0', '~')];
  return current;
}
export class DouyinClient {
  private clientToken: { value: string; expiresAt: number } | null = null;
  constructor(private cfg: Config) {}
  async contract(): Promise<DouyinTradeContract> {
    requireThat(this.cfg.douyin.tradeContractPath, 'DOUYIN_TRADE_NOT_CONFIGURED', '抖音交易类目与原生协议尚未准入', 503);
    const data = JSON.parse(await readFile(inside(this.cfg.projectRoot, this.cfg.douyin.tradeContractPath), 'utf8')) as DouyinTradeContract;
    requireThat(data.admitted === true && data.verified_evidence_id && data.official_document_url.startsWith('https://developer.open-douyin.com/'), 'DOUYIN_TRADE_NOT_ADMITTED', '抖音交易协议尚未完成真实验证', 503);
    for (const path of [data.query.path, data.refund.createPath, data.refund.queryPath]) requireThat(/^\/api\/[A-Za-z0-9/_-]+$/.test(path), 'DOUYIN_TRADE_INVALID', '抖音交易协议路径无效', 503);
    requireThat(data.sku.type > 0 && data.sku.tagGroupId && data.sku.imageUrl.startsWith('https://'), 'DOUYIN_SKU_NOT_ADMITTED', '抖音商品类目与标签尚未准入', 503);
    return data;
  }
  async createAction(order: DTO<'Order'>): Promise<string> {
    const contract = await this.contract(); const c = this.cfg.douyin;
    requireThat(c.privateKey && c.keyVersion && c.appId, 'DOUYIN_NOT_CONFIGURED', '抖音交易密钥尚未配置', 503);
    const data = JSON.stringify({ outOrderNo: order.order_id, totalAmount: order.amount_fen, currency: 'CNY', payExpireSeconds: Math.max(1, Math.floor((Date.parse(order.payable_until) - Date.now()) / 1000)),
      payNotifyUrl: `${this.cfg.publicBaseUrl}/v1/p01/payment-events/douyin`, merchantUid: c.merchantId,
      orderEntrySchema: { path: 'pages/order/index', params: JSON.stringify({ order_id: order.order_id }) },
      skuList: [{ skuId: order.order_id, title: '一品成片商品素材整包制作', price: order.amount_fen, quantity: 1, imageList: [contract.sku.imageUrl], type: contract.sku.type, tagGroupId: contract.sku.tagGroupId }] });
    return JSON.stringify({ kind: 'DOUYIN_REQUEST_ORDER', data, byteAuthorization: douyinSignature(c.privateKey, c.appId, c.keyVersion, '/requestOrder', data), currency: 'CNY' });
  }
  private async token(): Promise<string> {
    if (this.clientToken && this.clientToken.expiresAt > Date.now() + 60000) return this.clientToken.value;
    const result = await safeHttp('https://open.douyin.com/oauth/client_token/', ['open.douyin.com'], { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ client_key: this.cfg.douyin.appId, client_secret: this.cfg.douyin.secret, grant_type: 'client_credential' }) });
    const data = object(object(result.json()).data); requireThat(data.error_code === 0 && typeof data.access_token === 'string', 'DOUYIN_TOKEN_REJECTED', '抖音交易授权失败', 503);
    this.clientToken = { value: data.access_token, expiresAt: Date.now() + Number(data.expires_in) * 1000 }; return data.access_token;
  }
  async call(path: string, body: unknown): Promise<unknown> {
    const c = this.cfg.douyin; const raw = JSON.stringify(body); const token = await this.token();
    const response = await safeHttp(`${c.gateway}${path}`, ['open.douyin.com', 'open-sandbox.douyin.com'], { method: 'POST', headers: { 'Content-Type': 'application/json', 'access-token': token, 'Byte-Authorization': douyinSignature(c.privateKey, c.appId, c.keyVersion, path, raw) }, body: raw });
    requireThat(response.status >= 200 && response.status < 300, 'DOUYIN_REMOTE_UNKNOWN', '抖音交易结果尚未确认', 503);
    verifyDouyin(c.paymentKey, response.bytes.toString('utf8'), response.headers);
    const parsed = object(response.json()); requireThat(parsed.err_no === 0, 'DOUYIN_REJECTED', '抖音未接受该交易操作，请查询原交易', 422); return parsed;
  }
}
