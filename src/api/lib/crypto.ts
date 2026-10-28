import { createHash, createHmac, randomBytes, timingSafeEqual, randomUUID } from 'node:crypto';
import { canonicalize } from '../../shared/domain/json.js';
export const id = (prefix: string): string => `${prefix}_${randomUUID().replaceAll('-', '')}`;
export const token = (): string => randomBytes(32).toString('base64url');
export const sha256 = (value: string | Buffer): string => createHash('sha256').update(value).digest('hex');
export const hash = (value: unknown): string => sha256(canonicalize(value));
export const hmac = (key: string, value: string): string => createHmac('sha256', key).update(value).digest('base64url');
export function equalSecret(a: string, b: string): boolean {
  const x = Buffer.from(a); const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
export const iso = (now = Date.now()): string => new Date(now).toISOString();
export const addSeconds = (seconds: number, now = Date.now()): string => iso(now + seconds * 1000);
