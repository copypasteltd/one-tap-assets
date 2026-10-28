import { createInterface } from 'node:readline';
import https from 'node:https';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
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
const output = (value: unknown): void => { process.stdout.write(`${JSON.stringify(value)}\n`); };
async function call(path: string, method: 'GET' | 'POST', body?: unknown): Promise<Record<string, unknown>> {
  const bytes = body === undefined ? undefined : Buffer.from(JSON.stringify(body));
  return new Promise((resolve, reject) => {
    const req = https.request(new URL(path, base), { method, ...(ca ? { ca } : {}), rejectUnauthorized: true,
      headers: { Authorization: `Bearer ${secret}`, ...(bytes ? { 'Content-Type': 'application/json', 'Content-Length': String(bytes.length) } : {}) },
      signal: AbortSignal.timeout(Math.max(1, Math.min(20000, deadline - Date.now()))) }, res => {
      const parts: Buffer[] = []; let size = 0;
      res.on('data', (chunk: Buffer) => { size += chunk.length; if (size > 1_000_000) req.destroy(new Error('Tool response too large')); else parts.push(chunk); });
      res.on('error', reject); res.on('end', () => {
        if (!res.statusCode || res.statusCode >= 400) { reject(new Error('Platform tool rejected the request')); return; }
        try { resolve(object(JSON.parse(Buffer.concat(parts).toString('utf8')) as unknown)); } catch { reject(new Error('Invalid platform response')); }
      });
    }); req.on('error', reject); if (bytes) req.write(bytes); req.end();
  });
}
async function dispatch(method: string, params: Record<string, unknown>): Promise<unknown> {
  if (method === 'initialize') return { protocolVersion: '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'ypcc-scoped-tools', version: '1.0.0' } };
  if (method === 'ping') return {};
  if (method === 'tools/list') return { tools: (await call('/v1/internal/p01/agent-tools', 'GET')).tools };
  if (method === 'tools/call') {
    const created = await call('/v1/internal/p01/agent-tools/calls', 'POST', { tool: params.name, arguments: params.arguments ?? {}, idempotency_key: `mcp:${randomUUID()}` });
    while (Date.now() < deadline) {
      const result = await call(`/v1/internal/p01/agent-tools/calls/${encodeURIComponent(String(created.intent_id))}`, 'GET');
      if (result.state === 'SUCCEEDED') return { content: [{ type: 'text', text: JSON.stringify(result.result) }] };
      if (result.state === 'FAILED' || result.state === 'CANCELLED') return { isError: true, content: [{ type: 'text', text: String(result.error_code ?? 'TOOL_FAILED') }] };
      await new Promise<void>(r => setTimeout(r, 750));
    }
    return { isError: true, content: [{ type: 'text', text: 'DEADLINE_REACHED: inspect the durable checkpoint; do not resubmit a purchase.' }] };
  }
  throw new Error('Method not available');
}
const lines = createInterface({ input: process.stdin, crlfDelay: Infinity });
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
