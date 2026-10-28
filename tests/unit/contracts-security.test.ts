import { describe, it, expect } from 'vitest';
import { canonicalize } from '../../src/shared/domain/json.js';
import { hash } from '../../src/api/lib/crypto.js';
import { publicIp } from '../../src/api/lib/http.js';
import { cursor } from '../../src/api/lib/pagination.js';
import { checkTool, toolsForRole } from '../../src/worker/tool-gateway/policy.js';
import type { Config } from '../../src/api/config.js';
const cfg = { signingKey: 'unit-test-key-32-characters-long-only' } as Config;
describe('canonical contracts and trust boundaries', () => {
  it('matches ECMAScript number/string serialization and UTF-16 ordering', () => {
    expect(canonicalize({ z: -0, a: [1e30, 1e-7, '中文\n"'], b: true })).toBe('{"a":[1e+30,1e-7,"中文\\n\\\""],"b":true,"z":0}');
    expect(hash({ b: 2, a: 1 })).toBe(hash({ a: 1, b: 2 }));
    expect(hash({ a: '蓝杯' })).not.toBe(hash({ a: '红杯' }));
  });
  it('rejects values that cannot be signed as I-JSON', () => {
    const cyclic: Record<string, unknown> = {}; cyclic.self = cyclic;
    for (const value of [NaN, Infinity, undefined, 1n, new Date(), cyclic, '\ud800', { '\udfff': 1 }, new Array(2), { a: undefined }]) expect(() => canonicalize(value)).toThrow();
  });
  it('binds pagination to principal and filter and rejects malformed signatures', () => {
    const encoded = cursor.encode(cfg, { id: 'order-a', createdAt: '2026-10-27T00:00:00Z' }, 'tenant-a:orders');
    expect(cursor.decode(cfg, encoded, 'tenant-a:orders')?.id).toBe('order-a');
    expect(() => cursor.decode(cfg, encoded, 'tenant-b:orders')).toThrow();
    expect(() => cursor.decode(cfg, `${encoded}.ignored`, 'tenant-a:orders')).toThrow();
    expect(() => cursor.decode(cfg, encoded.slice(0, -3) + '123', 'tenant-a:orders')).toThrow();
  });
  it('denies local, metadata, translated and documentation destinations', () => {
    for (const ip of ['127.0.0.1', '10.0.0.1', '172.16.0.1', '192.168.1.2', '169.254.169.254', '100.64.1.1', '::1', '::2', 'fd00::1', 'fe80::1', '::ffff:127.0.0.1', '64:ff9b::7f00:1', '2002:7f00:1::', '2001:db8::1', '198.51.100.1', '203.0.113.1']) expect(publicIp(ip), ip).toBe(false);
    expect(publicIp('8.8.8.8')).toBe(true); expect(publicIp('2606:4700:4700::1111')).toBe(true);
  });
  it('does not let instructions expand a role or inject arbitrary execution arguments', () => {
    expect(toolsForRole('REVIEW_FACTS').every(t => !['submit_video', 'render_photo_pack', 'execute_post_plan'].includes(t.name))).toBe(true);
    expect(() => checkTool('REVIEW_FACTS', 'submit_video', { shot_id: 'shot-1' })).toThrow();
    expect(() => checkTool('PRODUCTION', 'arbitrary_shell', { command: 'anything' })).toThrow();
    expect(() => checkTool('PRODUCTION', 'generate_reference_frames', { shot_id: 'shot-1', url: 'https://example.com' })).toThrow();
    expect(checkTool('PRODUCTION', 'generate_reference_frames', { shot_id: 'shot-1' })).toEqual({ shot_id: 'shot-1' });
  });
});
