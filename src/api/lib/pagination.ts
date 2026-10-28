import type { Config } from '../config.js';
import { hmac, equalSecret } from './crypto.js';
import { AppError } from './errors.js';
interface Cursor { createdAt: string; id: string }
export const limit = (value: string | undefined): number => {
  const n = value === undefined ? 20 : Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 100) throw new AppError('INVALID_LIMIT', '每页数量需为1至100', 400);
  return n;
};
export const cursor = {
  encode(cfg: Config, point: Cursor, scope: string): string {
    const data = Buffer.from(JSON.stringify({ ...point, scope })).toString('base64url');
    return `${data}.${hmac(cfg.signingKey, data)}`;
  },
  decode(cfg: Config, value: string | undefined, scope: string): Cursor | null {
    if (!value) return null;
    try {
      if (value.length > 2048 || value.split('.').length !== 2) throw new Error('format');
      const [data, sig] = value.split('.');
      if (!data || !sig || !equalSecret(hmac(cfg.signingKey, data), sig)) throw new Error('signature');
      const item: unknown = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
      if (!item || typeof item !== 'object') throw new Error('type');
      const p = item as Record<string, unknown>;
      if (p.scope !== scope || typeof p.id !== 'string' || typeof p.createdAt !== 'string' || !Number.isFinite(Date.parse(p.createdAt))) throw new Error('scope');
      return { id: p.id, createdAt: p.createdAt };
    } catch { throw new AppError('INVALID_CURSOR', '分页已失效，请刷新列表', 400); }
  },
};
