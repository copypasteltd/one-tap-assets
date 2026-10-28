import { endpoints } from '../contracts/endpoints.generated.js';
import type { DTO, SchemaName } from '../contracts/types.js';

export interface WireRequest { url: string; method: string; headers: Record<string, string>; body?: string | ArrayBuffer; signal?: AbortSignal }
export interface WireResponse { status: number; data: unknown; headers: Record<string, string> }
export type Transport = (request: WireRequest) => Promise<WireResponse>;
type Operation = keyof typeof endpoints;
type Response<K extends Operation> = (typeof endpoints)[K]['response'] extends SchemaName ? DTO<(typeof endpoints)[K]['response'] & SchemaName> : unknown;
type Body<K extends Operation> = (typeof endpoints)[K]['request'] extends SchemaName ? DTO<(typeof endpoints)[K]['request'] & SchemaName> : never;
export interface CallOptions<K extends Operation> { params?: Record<string, string>; query?: Record<string, string | number | undefined>; body?: Body<K>; key?: string; signal?: AbortSignal }
export class ClientError extends Error {
  constructor(readonly code: string, message: string, readonly status = 0, readonly retryable = false, readonly retryAfterMs = 0) { super(message); this.name = 'ClientError'; }
}
export function apiBase(value: string, allowLocal = false): string {
  if (!value) throw new ClientError('SERVICE_NOT_CONFIGURED', '服务地址尚未配置，请稍后再试');
  // Mini-program JS engines do not consistently expose the WHATWG URL constructor.
  const match = /^(https?):\/\/(\[[a-f0-9:]+\]|[a-z0-9.-]+)(?::([0-9]{1,5}))?\/?$/i.exec(value);
  const local = allowLocal && match && ['localhost', '127.0.0.1', '[::1]'].includes(match[2]!.toLowerCase()) && match[1] === 'http';
  if (!match || (!local && match[1] !== 'https') || (match[3] && (Number(match[3]) < 1 || Number(match[3]) > 65535)))
    throw new ClientError('SERVICE_ADDRESS_INVALID', '服务地址不符合当前环境要求');
  return value.replace(/\/$/, '');
}
export class ApiClient {
  private session: DTO<'Session'> | null = null;
  constructor(private readonly base: string, private readonly transport: Transport, private readonly onExpired: () => void = () => {}, private readonly allowLocal = false) {}
  get userId(): string | null { return this.session && Date.parse(this.session.expires_at) > Date.now() ? this.session.user_id : null; }
  setSession(session: DTO<'Session'> | null): void { this.session = session; }
  async call<K extends Operation>(operation: K, options: CallOptions<K> = {}): Promise<Response<K>> {
    const endpoint = endpoints[operation]; const headers: Record<string, string> = { Accept: 'application/json' };
    const wireBody = options.body !== undefined ? JSON.stringify(options.body) : endpoint.method !== 'GET' ? '{}' : undefined;
    if (wireBody !== undefined) headers['Content-Type'] = 'application/json';
    const buyer = this.userId;
    if (endpoint.authenticated) {
      if (!this.session || Date.parse(this.session.expires_at) <= Date.now()) { this.setSession(null); this.onExpired(); throw new ClientError('SESSION_REQUIRED', '请重新登录后继续，原订单会为你保留', 401); }
      headers.Authorization = `Bearer ${this.session.access_token}`;
    }
    if (endpoint.idempotency) {
      if (!options.key || !/^[A-Za-z0-9._:-]{8,128}$/.test(options.key)) throw new ClientError('INTENT_KEY_REQUIRED', '请从原操作继续，避免重复提交');
      headers['Idempotency-Key'] = options.key;
    }
    const path = endpoint.path.replace(/\{([^}]+)\}/g, (_match, name: string) => {
      const value = options.params?.[name]; if (!value || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/.test(value)) throw new ClientError('RESOURCE_ID_INVALID', '资源标识无效，请返回后重试');
      return encodeURIComponent(value);
    });
    const query = Object.entries(options.query ?? {}).filter(([, v]) => v !== undefined).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&');
    let response: WireResponse;
    try { response = await this.transport({ url: `${apiBase(this.base, this.allowLocal)}/v1/p01${path}${query ? `?${query}` : ''}`, method: endpoint.method, headers,
      ...(wireBody !== undefined ? { body: wireBody } : {}), ...(options.signal ? { signal: options.signal } : {}) }); }
    catch (error) { if (error instanceof ClientError) throw error; throw new ClientError('NETWORK_UNKNOWN', '网络连接中断，请从当前记录继续；付款请查询原订单', 0, true); }
    if (endpoint.authenticated && this.userId !== buyer) throw new ClientError('ACCOUNT_CHANGED', '账户已变化，请查询当前账户自己的记录', 409);
    const body: unknown = typeof response.data === 'string' ? parse(response.data) : response.data;
    const data = record(body);
    if (response.status < 200 || response.status >= 300) {
      if (response.status === 401) { this.setSession(null); this.onExpired(); }
      const retry = response.headers['retry-after']; const seconds = retry && /^\d+$/.test(retry) ? Number(retry) : 0;
      throw new ClientError(typeof data.code === 'string' ? data.code : 'REQUEST_FAILED', typeof data.message === 'string' ? data.message : '暂时无法完成，请保留当前记录后重试', response.status, data.retryable === true, Math.min(seconds, 300) * 1000);
    }
    if (!Object.prototype.hasOwnProperty.call(data, 'data')) throw new ClientError('RESPONSE_INVALID', '服务返回不完整，请稍后查询当前记录', 502, true);
    return data.data as Response<K>;
  }
}
function parse(value: string): unknown { try { return JSON.parse(value); } catch { return null; } }
function record(value: unknown): Record<string, unknown> { return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
