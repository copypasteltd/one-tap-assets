import { it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
import { ApiClient, apiBase, ClientError, type Transport } from '../../src/shared/client/api';
import { digest, fingerprint } from '../../src/shared/client/sha256';

it('hashes byte-boundaries and Unicode without requiring browser or Node globals in a mini-program', () => {
  for (const length of [0,1,55,56,63,64,65,100000]) {
    const input = Uint8Array.from({ length }, (_, i) => i % 251);
    expect(digest(input)).toBe(createHash('sha256').update(input).digest('hex'));
  }
  for (const text of ['abc', '一品成片🍊', '\ud800', '照片\n版本2']) expect(fingerprint(text)).toBe(createHash('sha256').update(text).digest('hex'));
});
it('rejects unsafe service URLs, requires the original intent and clears an expired identity', async () => {
  for (const base of ['http://example.test', 'https://user:secret@example.test', 'https://example.test/?token=1', 'https://example.test/path']) expect(() => apiBase(base)).toThrow();
  expect(apiBase('http://127.0.0.1:3456', true)).toBe('http://127.0.0.1:3456');
  let calls = 0; let expired = 0;
  const transport: Transport = async input => { calls++; expect(input.url).toBe('https://api.example.test/v1/p01/products'); expect(input.headers['Idempotency-Key']).toBe('same-intent-key'); return { status: 401, data: { code: 'SESSION_INVALID', message: '请重新登录' }, headers: {} }; };
  const client = new ApiClient('https://api.example.test', transport, () => expired++);
  client.setSession({ access_token: 'fixture-token', token_type: 'Bearer', user_id: 'fixture-user', expires_at: '2099-01-01T00:00:00Z' });
  await expect(client.call('createProduct', { body: {} })).rejects.toMatchObject({ code: 'INTENT_KEY_REQUIRED' }); expect(calls).toBe(0);
  await expect(client.call('createProduct', { body: {}, key: 'same-intent-key' })).rejects.toMatchObject({ status: 401 }); expect(expired).toBe(1); expect(client.userId).toBeNull();
});
it('does not retry unknown payment mutations and retains backpressure from the server', async () => {
  let calls = 0; const client = new ApiClient('https://api.example.test', async () => { calls++; throw new Error('connection lost'); });
  client.setSession({ access_token: 'fixture-token', token_type: 'Bearer', user_id: 'fixture-user', expires_at: '2099-01-01T00:00:00Z' });
  await expect(client.call('createOrder', { body: { quote_id: 'quote-1', channel: 'alipay' }, key: 'original-order-intent' })).rejects.toMatchObject({ code: 'NETWORK_UNKNOWN' }); expect(calls).toBe(1);
  const limited = new ApiClient('https://api.example.test', async () => ({ status: 429, data: { code: 'RATE_LIMITED', message: '请稍后再试', retryable: true }, headers: { 'retry-after': '7' } }));
  await expect(limited.call('listPresets')).rejects.toMatchObject({ retryAfterMs: 7000 });
});
it('rejects an in-flight private response after an account switch instead of caching it for the next buyer', async () => {
  let finish!: (response: { status: number; data: unknown; headers: Record<string, string> }) => void;
  const client = new ApiClient('https://api.example.test', () => new Promise(resolve => { finish = resolve; }));
  const session = (user: string) => ({ access_token: `fixture-${user}`, token_type: 'Bearer' as const, user_id: user, expires_at: '2099-01-01T00:00:00Z' });
  client.setSession(session('buyer-1')); const request = client.call('getOrder', { params: { order_id: 'order-1' } });
  client.setSession(session('buyer-2')); finish({ status: 200, data: { data: { order_id: 'private-buyer-1-order' } }, headers: {} });
  await expect(request).rejects.toMatchObject({ code: 'ACCOUNT_CHANGED' }); expect(client.userId).toBe('buyer-2');
});
it('uses the same intent-key boundaries as both published API domains before sending a mutation', async () => {
  const schemas = ['openapi', 'management-openapi'].map(name => {
    const document = JSON.parse(readFileSync(`assets/development/v1.1/contracts/${name}.json`, 'utf8'));
    return new Ajv2020().compile(document.components.parameters.IdempotencyKey.schema);
  });
  const sent: string[] = [];
  const client = new ApiClient('https://api.example.test', async request => {
    sent.push(request.headers['Idempotency-Key']!); return { status: 201, data: { data: {} }, headers: {} };
  });
  client.setSession({ access_token: 'fixture-token', token_type: 'Bearer', user_id: 'fixture-user', expires_at: '2099-01-01T00:00:00Z' });
  const valid = ['ui:k._-0', `ui:${'k'.repeat(125)}`];
  for (const key of valid) {
    for (const validate of schemas) expect(validate(key), key).toBe(true);
    await client.call('createProduct', { body: {}, key });
  }
  for (const key of ['short-7', 'k'.repeat(129), 'ui:key/0', 'ui:中key0', 'ui:key 0']) {
    for (const validate of schemas) expect(validate(key), key).toBe(false);
    await expect(client.call('createProduct', { body: {}, key })).rejects.toMatchObject({ code: 'INTENT_KEY_REQUIRED' });
  }
  expect(sent).toEqual(valid);
});
