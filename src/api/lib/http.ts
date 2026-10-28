import https from 'node:https';
import type { IncomingHttpHeaders } from 'node:http';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { AppError } from './errors.js';

export function publicIp(ip: string): boolean {
  if (isIP(ip) === 4) {
    const n = ip.split('.').map(Number); const a = n[0] ?? 0; const b = n[1] ?? 0;
    return !(a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 168 || b === 0)) || (a === 198 && (b === 18 || b === 19 || (b === 51 && n[2] === 100))) || (a === 203 && b === 0 && n[2] === 113));
  }
  if (isIP(ip) === 6) {
    const p = ip.toLowerCase();
    // Only global unicast. Reject translation/tunnel ranges that can smuggle an
    // IPv4 private destination, as well as local, multicast and documentation.
    return /^[23][0-9a-f]{3}:/.test(p) && !p.startsWith('2002:') && !p.startsWith('2001:0:') && !p.startsWith('2001:db8:');
  }
  return false;
}
export interface HttpResponse { status: number; headers: IncomingHttpHeaders; bytes: Buffer; json(): unknown }
export async function safeHttp(urlValue: string, allowedHosts: readonly string[], options: { method?: string; headers?: Record<string, string>; body?: Buffer | string; maxBytes?: number; timeoutMs?: number; signal?: AbortSignal } = {}): Promise<HttpResponse> {
  const url = new URL(urlValue);
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443') || !allowedHosts.includes(url.hostname) || isIP(url.hostname)) throw new AppError('REMOTE_NOT_ALLOWED', '远端地址未获得平台授权', 503);
  const addresses = await lookup(url.hostname, { all: true });
  if (!addresses.length || addresses.some(a => !publicIp(a.address))) throw new AppError('REMOTE_NOT_ALLOWED', '远端地址解析不符合访问规则', 503);
  const address = addresses[0]!;
  return new Promise((resolve, reject) => {
    const req = https.request(url, { method: options.method ?? 'GET', headers: options.headers ?? {},
      lookup: (_hostname, opts, cb) => opts.all ? cb(null, addresses) : cb(null, address.address, address.family),
      signal: options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(options.timeoutMs ?? 20000)]) : AbortSignal.timeout(options.timeoutMs ?? 20000), rejectUnauthorized: true }, response => {
      const pieces: Buffer[] = []; let size = 0; const maximum = options.maxBytes ?? 2_000_000;
      response.on('data', (part: Buffer) => { size += part.length; if (size > maximum) { req.destroy(new AppError('REMOTE_TOO_LARGE', '供应商返回超过大小限制', 503)); return; } pieces.push(part); });
      response.on('error', reject);
      response.on('end', () => {
        const bytes = Buffer.concat(pieces);
        resolve({ status: response.statusCode ?? 502, headers: response.headers, bytes, json: () => JSON.parse(bytes.toString('utf8')) as unknown });
      });
    });
    req.on('error', () => reject(new AppError('REMOTE_UNKNOWN', '远端结果尚未确认，系统将查询原请求', 503, true)));
    if (options.body) req.write(options.body); req.end();
  });
}
export async function remoteJson(url: string, hosts: readonly string[], body: unknown, headers: Record<string, string> = {}): Promise<unknown> {
  const result = await safeHttp(url, hosts, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
  if (result.status < 200 || result.status >= 300) throw new AppError('REMOTE_ERROR', '供应商暂时无法处理该请求', 503, true);
  return result.json();
}
