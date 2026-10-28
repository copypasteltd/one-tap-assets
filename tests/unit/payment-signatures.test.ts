import { describe, it, expect } from 'vitest';
import { generateKeyPairSync, sign, verify } from 'node:crypto';
import { rawField, alipayCanonical } from '../../src/api/adapters/alipay.js';
import { douyinSignature, verifyDouyin } from '../../src/api/adapters/douyin.js';
import { moneyFen } from '../../src/api/routes/payments.js';
const keys = generateKeyPairSync('rsa', { modulusLength: 2048, publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } });
describe('payment wire verification', () => {
  it('extracts only the top-level signed value without reserializing whitespace or escaped text', () => {
    const payload = '{ "code" : "10000", "x":"a\\\"b}","n":[1,{"x":2}]}';
    const raw = `{"nested":{"alipay_trade_query_response":{"code":"bad"}},"alipay_trade_query_response": ${payload},"sign":"abc"}`;
    expect(rawField(raw, 'alipay_trade_query_response')).toBe(payload);
    expect(alipayCanonical({ z: '末尾', a: '1', sign: 'ignored', sign_type: 'RSA2', empty: '' })).toBe('a=1&z=末尾');
  });
  it('uses exact fixed-point CNY amounts', () => {
    expect(moneyFen('0.01')).toBe(1); expect(moneyFen('10.2')).toBe(1020);
    for (const value of [0.01, '1e2', '-1', '1.001', '1,000', ' 1']) expect(() => moneyFen(value)).toThrow();
  });
  it('binds Douyin outbound signatures to the native request path and raw payload', () => {
    const body = '{"outOrderNo":"order-a","totalAmount":100}'; const now = Math.floor(Date.now() / 1000);
    const signed = douyinSignature(keys.privateKey, 'app-a', '1', '/requestOrder', body, now, 'nonce-a');
    const signature = /signature="([^"]+)"/.exec(signed)![1]!;
    expect(verify('RSA-SHA256', Buffer.from(`POST\n/requestOrder\n${now}\nnonce-a\n${body}\n`), keys.publicKey, Buffer.from(signature, 'base64'))).toBe(true);
    expect(verify('RSA-SHA256', Buffer.from(`POST\n/other\n${now}\nnonce-a\n${body}\n`), keys.publicKey, Buffer.from(signature, 'base64'))).toBe(false);
  });
  it('rejects changed and stale signed callback bodies', () => {
    const timestamp = String(Math.floor(Date.now() / 1000)); const raw = '{"type":"payment","msg":"original"}';
    const signature = sign('RSA-SHA256', Buffer.from(`${timestamp}\nnonce\n${raw}\n`), keys.privateKey).toString('base64');
    const headers = { 'byte-timestamp': timestamp, 'byte-nonce-str': 'nonce', 'byte-signature': signature };
    expect(() => verifyDouyin(keys.publicKey, raw, headers)).not.toThrow();
    expect(() => verifyDouyin(keys.publicKey, raw + ' ', headers)).toThrow();
    expect(() => verifyDouyin(keys.publicKey, raw, headers, Date.now() + 7200000)).toThrow();
  });
});
