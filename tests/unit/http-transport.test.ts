import { afterEach, expect, it, vi } from 'vitest';
import { config } from '../../src/api/config';
import { requestKey } from '../../src/shared/client/request-key';

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

it('accepts the HTTP LAN origin without enabling an API TLS listener', () => {
  vi.stubEnv('APP_ENV', 'test');
  const cfg = config({ databaseUrl: 'postgresql://synthetic.invalid/test', signingKey: 'x'.repeat(32), publicBaseUrl: 'http://192.168.31.20:38480', tlsCert: '', tlsKey: '' });
  expect(cfg.publicBaseUrl).toBe('http://192.168.31.20:38480');
  expect(cfg.tlsCert).toBe('');
  expect(cfg.tlsKey).toBe('');
});

it('rejects non-HTTP base addresses and credentials in the public origin', () => {
  vi.stubEnv('APP_ENV', 'test');
  for (const publicBaseUrl of ['ftp://synthetic.invalid', 'http://user:secret@synthetic.invalid', 'http://synthetic.invalid/?key=secret', 'not a URL']) {
    expect(() => config({ databaseUrl: 'postgresql://synthetic.invalid/test', signingKey: 'x'.repeat(32), publicBaseUrl })).toThrow('PUBLIC_BASE_URL');
  }
});

it('cannot accidentally enable API HTTPS for an HTTP deployment', () => {
  vi.stubEnv('APP_ENV', 'test');
  expect(() => config({ databaseUrl: 'postgresql://synthetic.invalid/test', signingKey: 'x'.repeat(32), publicBaseUrl: 'http://192.168.31.20:38480', tlsCert: 'synthetic.crt', tlsKey: 'synthetic.key' })).toThrow('HTTP service');
});

it('keeps distinct valid UUID request keys when HTTP provides getRandomValues but no randomUUID', () => {
  const getRandomValues = globalThis.crypto.getRandomValues.bind(globalThis.crypto);
  vi.stubGlobal('crypto', { getRandomValues });
  const keys = Array.from({ length: 128 }, () => requestKey());
  expect(new Set(keys).size).toBe(keys.length);
  for (const key of keys) expect(key).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});

it('requires a cryptographic generator when the browser cannot provide either API', () => {
  vi.stubGlobal('crypto', undefined);
  expect(() => requestKey()).toThrow('随机数');
});
