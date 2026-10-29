import { createInterface } from 'node:readline';
import https from 'node:https';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { setTimeout as pause } from 'node:timers/promises';
import { object } from '../../shared/domain/json.js';

// This subprocess has only a short-lived platform capability, never a provider,
// database, payment or service-account secret. Its endpoint is operator supplied.
const base = new URL(process.env.YPCC_TOOL_ENDPOINT ?? 'https://localhost:3100');
if (base.protocol !== 'https:' || base.username || base.password || base.pathname !== '/') throw new Error('Invalid tool endpoint');
const secret = process.env.YPCC_TOOL_CAPABILITY;
if (!secret) throw new Error('Missing scoped capability');
const ca = process.env.YPCC_TOOL_CA_FILE ? readFileSync(process.env.YPCC_TOOL_CA_FILE) : undefined;
const deadline = Number(process.env.YPCC_ROLE_DEADLINE_MS);
if (!Number.isSafeInteger(deadline) || deadline <= Date.now()) throw new Error('Invalid role deadline');
const lifetime = new AbortController();
const output = (value: unknown): void => { if (!lifetime.signal.aborted) process.stdout.write(`${JSON.stringify(value)}\n`); };
class ObservationUnavailable extends Error {}
const transientTransportCodes = new Set(['ECONNABORTED', 'ECONNREFUSED', 'ECONNRESET', 'EHOSTUNREACH', 'ENETUNREACH', 'EPIPE', 'ETIMEDOUT', 'EAI_AGAIN']);
function transientTransport(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const code = Object.getOwnPropertyDescriptor(error, 'code');
  return !!code && 'value' in code && typeof code.value === 'string' && transientTransportCodes.has(code.value);
}
async function call(path: string, method: 'GET' | 'POST', body?: unknown): Promise<Record<string, unknown>> {
  if (lifetime.signal.aborted || Date.now() >= deadline) throw new Error('Role ended');
  const bytes = body === undefined ? undefined : Buffer.from(JSON.stringify(body));
  const timeout = AbortSignal.timeout(Math.max(1, Math.min(20000, deadline - Date.now())));
  return new Promise((resolve, reject) => {
    const transportFailure = (error: unknown): void => {
      reject(method === 'GET' && !lifetime.signal.aborted && (timeout.aborted || transientTransport(error))
        ? new ObservationUnavailable('Original tool observation unavailable') : new Error('Platform tool unavailable'));
    };
    const req = https.request(new URL(path, base), { method, ...(ca ? { ca } : {}), rejectUnauthorized: true,
      headers: { Authorization: `Bearer ${secret}`, ...(bytes ? { 'Content-Type': 'application/json', 'Content-Length': String(bytes.length) } : {}) },
      signal: AbortSignal.any([lifetime.signal, timeout]) }, res => {
      const parts: Buffer[] = []; let size = 0;
      res.on('data', (chunk: Buffer) => { size += chunk.length; if (size > 1_000_000) req.destroy(new Error('Tool response too large')); else parts.push(chunk); });
      res.on('error', transportFailure); res.on('end', () => {
        if (method === 'GET' && [500, 502, 503, 504].includes(res.statusCode ?? 0)) { reject(new ObservationUnavailable('Original tool observation unavailable')); return; }
        if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) { reject(new Error('Platform tool rejected the request')); return; }
        try { resolve(object(JSON.parse(Buffer.concat(parts).toString('utf8')) as unknown)); } catch { reject(new Error('Invalid platform response')); }
      });
    }); req.on('error', transportFailure); if (bytes) req.write(bytes); req.end();
  });
}
async function dispatch(method: string, params: Record<string, unknown>): Promise<unknown> {
  if (method === 'initialize') return { protocolVersion: '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'ypcc-scoped-tools', version: '1.0.0' } };
  if (method === 'ping') return {};
  if (method === 'tools/list') return { tools: (await call('/v1/internal/p01/agent-tools', 'GET')).tools };
  if (method === 'tools/call') {
    const created = await call('/v1/internal/p01/agent-tools/calls', 'POST', { tool: params.name, arguments: params.arguments ?? {}, idempotency_key: `mcp:${randomUUID()}` });
    if (typeof created.intent_id !== 'string' || !/^[A-Za-z0-9._:-]{1,128}$/.test(created.intent_id)) throw new Error('Invalid original tool receipt');
    const path = `/v1/internal/p01/agent-tools/calls/${encodeURIComponent(created.intent_id)}`;
    let failures = 0;
    while (Date.now() < deadline && !lifetime.signal.aborted) {
      try {
        const result = await call(path, 'GET');
        if (Date.now() >= deadline || lifetime.signal.aborted) break;
        if (result.intent_id !== created.intent_id || !['QUEUED', 'RUNNING', 'UNKNOWN', 'SUCCEEDED', 'FAILED', 'CANCELLED'].includes(String(result.state))) throw new Error('Invalid original tool observation');
        failures = 0;
        if (result.state === 'SUCCEEDED') return { content: [{ type: 'text', text: JSON.stringify(result.result) }] };
        if (result.state === 'FAILED' || result.state === 'CANCELLED') return { isError: true, content: [{ type: 'text', text: String(result.error_code ?? 'TOOL_FAILED') }] };
      } catch (error) {
        // Only observe the acknowledged original intent. An uncertain POST is
        // never repeated, nor can a read failure authorize another purchase.
        if (Date.now() >= deadline) break;
        if (!(error instanceof ObservationUnavailable) || ++failures >= 3) throw error;
      }
      await pause(Math.max(1, Math.min(750, deadline - Date.now())), undefined, { signal: lifetime.signal });
    }
    return { isError: true, content: [{ type: 'text', text: 'DEADLINE_REACHED: inspect the durable checkpoint; do not resubmit a purchase.' }] };
  }
  throw new Error('Method not available');
}
const lines = createInterface({ input: process.stdin, crlfDelay: Infinity });
lines.once('close', () => lifetime.abort());
process.stdout.on('error', () => lifetime.abort());
lines.on('line', line => {
  if (line.length > 256000) { output({ jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Request too large' } }); return; }
  void (async () => {
    let message: Record<string, unknown>;
    try { message = object(JSON.parse(line) as unknown); } catch { output({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Invalid JSON' } }); return; }
    if (message.id === undefined) return;
    try { const result = await dispatch(String(message.method), object(message.params ?? {})); output({ jsonrpc: '2.0', id: message.id, result }); }
    catch { output({ jsonrpc: '2.0', id: message.id, error: { code: -32000, message: 'Platform tool unavailable; no authority to retry purchases outside the original intent.' } }); }
  })();
});
