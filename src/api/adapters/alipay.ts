import { sign, verify } from 'node:crypto';
import type { Config } from '../config.js';
import { safeHttp } from '../lib/http.js';
import { object } from '../../shared/domain/json.js';
import { AppError, requireThat } from '../lib/errors.js';

export function alipayCanonical(fields: Record<string, string>): string {
  return Object.keys(fields).filter(k => k !== 'sign' && k !== 'sign_type' && fields[k] !== '').sort().map(k => `${k}=${fields[k]}`).join('&');
}
function pem(value: string, kind: 'PRIVATE' | 'PUBLIC'): string {
  return value.includes('-----BEGIN') ? value.replaceAll('\\n', '\n') : `-----BEGIN ${kind} KEY-----\n${value.match(/.{1,64}/g)?.join('\n')}\n-----END ${kind} KEY-----`;
}
/** Return the exact raw JSON value, preserving provider signature bytes. */
export function rawField(raw: string, key: string): string {
  let i = 0;
  const whitespace = (): void => { while (i < raw.length && /\s/.test(raw[i]!)) i++; };
  const valueEnd = (start: number): number => {
    let depth = 0; let quoted = false; let escaped = false;
    for (let p = start; p < raw.length; p++) {
      const c = raw[p]!;
      if (quoted) { if (escaped) escaped = false; else if (c === '\\') escaped = true; else if (c === '"') { quoted = false; if (depth === 0) return p + 1; } continue; }
      if (c === '"') quoted = true;
      else if (c === '{' || c === '[') depth++;
      else if (c === '}' || c === ']') { if (depth === 0) return p; depth--; if (depth === 0) return p + 1; }
      else if (depth === 0 && (c === ',' || /\s/.test(c))) return p;
    }
    return raw.length;
  };
  whitespace(); if (raw[i++] !== '{') throw new AppError('PAYMENT_RESPONSE_INVALID', '支付响应格式不正确', 503);
  while (i < raw.length) {
    whitespace(); if (raw[i] === '}') break;
    const keyStart = i; if (raw[i] !== '"') break;
    i = valueEnd(i); const field: unknown = JSON.parse(raw.slice(keyStart, i)); whitespace(); if (raw[i++] !== ':') break; whitespace();
    const start = i; i = valueEnd(i); if (field === key) return raw.slice(start, i);
    whitespace(); if (raw[i++] !== ',') break;
  }
  throw new AppError('PAYMENT_RESPONSE_INVALID', '支付响应格式不正确', 503);
}
export class AlipayBusinessError extends AppError {
  constructor(public readonly providerCode: string, public readonly subCode: string) { super('ALIPAY_REJECTED', '支付宝未接受该操作，请检查原交易状态', 422); }
}
export class AlipayClient {
  constructor(private cfg: Config) {}
  async call(method: string, values: Record<string, string>): Promise<Record<string, unknown>> {
    const c = this.cfg.alipay;
    requireThat(c.appId && c.privateKey && c.publicKey, 'ALIPAY_NOT_CONFIGURED', '支付宝服务尚未配置', 503);
    const fields: Record<string, string> = { app_id: c.appId, method, format: 'JSON', charset: 'utf-8', sign_type: 'RSA2', version: '1.0', timestamp: new Date().toISOString().slice(0, 19).replace('T', ' '), ...values };
    // Request signing includes sign_type; response notification verification excludes it.
    const toSign = Object.keys(fields).filter(k => fields[k] !== '').sort().map(k => `${k}=${fields[k]}`).join('&');
    fields.sign = sign('RSA-SHA256', Buffer.from(toSign), pem(c.privateKey, 'PRIVATE')).toString('base64');
    const response = await safeHttp(c.gateway, ['openapi.alipay.com', 'openapi-sandbox.dl.alipaydev.com'], { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' }, body: new URLSearchParams(fields).toString() });
    const raw = response.bytes.toString('utf8'); const body = object(JSON.parse(raw) as unknown);
    const key = `${method.replaceAll('.', '_')}_response`; const content = object(body[key] ?? body.error_response);
    requireThat(typeof body.sign === 'string' && verify('RSA-SHA256', Buffer.from(rawField(raw, body[key] ? key : 'error_response')), pem(c.publicKey, 'PUBLIC'), Buffer.from(body.sign, 'base64')), 'PAYMENT_SIGNATURE_INVALID', '支付服务响应未通过验签', 503);
    if (content.code && content.code !== '10000') throw new AlipayBusinessError(String(content.code), String(content.sub_code ?? ''));
    return content;
  }
  verifyNotification(fields: Record<string, string>): void {
    requireThat(fields.sign_type === 'RSA2' && typeof fields.sign === 'string' && verify('RSA-SHA256', Buffer.from(alipayCanonical(fields)), pem(this.cfg.alipay.publicKey, 'PUBLIC'), Buffer.from(fields.sign, 'base64')), 'PAYMENT_SIGNATURE_INVALID', '支付通知验签失败', 401);
    requireThat(fields.app_id === this.cfg.alipay.appId && fields.seller_id === this.cfg.alipay.merchantId, 'PAYMENT_SCOPE_INVALID', '支付应用或商户不匹配', 403);
  }
}
