import { beforeAll, afterAll, afterEach, it, expect } from 'vitest';
import { build } from 'esbuild';
import { createServer, type Server } from 'node:https';
import type { IncomingMessage as HttpRequest, ServerResponse as HttpResponse } from 'node:http';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createInterface } from 'node:readline';
import { loadEnvFile } from 'node:process';
import { mkdir, readFile, rm } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { setTimeout as pause } from 'node:timers/promises';
import { config, inside } from '../../src/api/config.js';
import { id } from '../../src/api/lib/crypto.js';

// Real TLS/stdio and compiled bridge, synthetic platform responses only.
// This verifies transport recovery, not a database, provider or isolation claim.
let root: string, bridgePath: string, certPath: string, cert: Buffer, key: Buffer;
const active: { child: ChildProcessWithoutNullStreams; closed: Promise<void>; server: Server }[] = [];
beforeAll(async () => {
  loadEnvFile('.env.local'); const cfg = config({ env: 'test', devMode: true, paymentsEnabled: false, generationEnabled: false, publishingEnabled: false });
  root = inside(cfg.runtimeRoot, `tests/mcp-observation/${id('case')}`); await mkdir(root, { recursive: true });
  bridgePath = join(root, 'bridge.mjs'); certPath = resolve(cfg.tlsCert);
  [cert, key] = await Promise.all([readFile(certPath), readFile(resolve(cfg.tlsKey))]);
  await build({ entryPoints: ['src/worker/tool-gateway/mcp-main.ts'], outfile: bridgePath, bundle: true, platform: 'node', target: 'node24', format: 'esm', packages: 'external' });
});
afterEach(async () => {
  for (const item of active.splice(0)) {
    item.child.stdin.end();
    const timer = setTimeout(() => item.child.kill(), 5000);
    try { await item.closed; } finally { clearTimeout(timer); }
    item.server.closeAllConnections();
    await new Promise<void>((done, fail) => item.server.close(error => error ? fail(error) : done()));
  }
});
afterAll(async () => { if (root) await rm(inside(config().runtimeRoot, root), { recursive: true, force: true }); });

type Reply = { id: number; result?: { isError?: boolean; content: { type: string; text: string }[] }; error?: { code: number; message: string } };
type Observed = { method: string; url: string; body: Record<string, unknown> | null };
function json(res: HttpResponse, value: unknown, status = 200): void { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(value)); }
async function fixture(handler: (req: HttpRequest, res: HttpResponse, trace: Observed[]) => Promise<void> | void, options: { deadlineMs?: number; trusted?: boolean } = {}) {
  const trace: Observed[] = [];
  const server = createServer({ cert, key }, (req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      trace.push({ method: req.method ?? '', url: req.url ?? '', body: chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown> : null });
      void Promise.resolve(handler(req, res, trace)).catch(() => res.destroy());
    });
  });
  await new Promise<void>(done => server.listen(0, '127.0.0.1', done));
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('Missing synthetic HTTPS endpoint');
  const deadline = Date.now() + (options.deadlineMs ?? 60000);
  const child = spawn(process.execPath, [bridgePath], { cwd: root, windowsHide: true, shell: false, stdio: ['pipe', 'pipe', 'pipe'],
    env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, WINDIR: process.env.WINDIR, TEMP: root, TMP: root,
      YPCC_TOOL_ENDPOINT: `https://localhost:${address.port}`, YPCC_TOOL_CAPABILITY: 'synthetic-observation-capability-only',
      YPCC_ROLE_DEADLINE_MS: String(deadline), ...(options.trusted === false ? {} : { YPCC_TOOL_CA_FILE: certPath }) } });
  let sequence = 0; const pending = new Map<number, { resolve: (value: Reply) => void; reject: (error: Error) => void }>();
  const closed = new Promise<void>(done => child.once('close', () => { for (const p of pending.values()) p.reject(new Error('Synthetic bridge closed')); pending.clear(); done(); }));
  child.stderr.resume();
  child.once('error', error => { for (const p of pending.values()) p.reject(error); });
  createInterface({ input: child.stdout }).on('line', line => {
    const reply = JSON.parse(line) as Reply; const p = pending.get(reply.id); if (!p) return; pending.delete(reply.id); p.resolve(reply);
  });
  active.push({ child, closed, server });
  return { trace, child, closed, deadline, call: (name = 'synthetic_tool') => {
    const callId = ++sequence;
    return new Promise<Reply>((resolve, reject) => { pending.set(callId, { resolve, reject }); child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: callId, method: 'tools/call', params: { name, arguments: {} } }) + '\n'); });
  } };
}
const intent = 'synthetic-original-intent';
function acknowledge(res: HttpResponse): void { json(res, { intent_id: intent, state: 'QUEUED' }, 202); }
function success(res: HttpResponse, original = intent): void { json(res, { intent_id: original, state: 'SUCCEEDED', result: { synthetic: true, original } }); }

it('continues observing the acknowledged original after reset and 503 without another POST', async () => {
  let reads = 0;
  const f = await fixture((req, res) => {
    if (req.method === 'POST') return acknowledge(res);
    reads++;
    if (reads === 1) { req.socket.destroy(); return; }
    if (reads === 2) return json(res, { message: 'synthetic transient service unavailable' }, 503);
    if (reads === 3) return json(res, { intent_id: intent, state: 'UNKNOWN' });
    success(res);
  });
  expect((await f.call()).result?.content[0]?.text).toBe(JSON.stringify({ synthetic: true, original: intent }));
  expect(f.trace.filter(t => t.method === 'POST')).toHaveLength(1);
  expect(f.trace.filter(t => t.method === 'GET').map(t => t.url)).toEqual(Array(4).fill(`/v1/internal/p01/agent-tools/calls/${intent}`));
});

it('retains the original 20-second HTTP cap and recovers that same pending intent', async () => {
  let reads = 0;
  const f = await fixture((req, res) => {
    if (req.method === 'POST') return acknowledge(res);
    if (++reads > 1) success(res); // The first response intentionally never finishes.
  });
  const started = Date.now(), reply = await f.call();
  expect(reply.result?.isError).not.toBe(true); expect(reply.result?.content[0]?.text).toContain(intent);
  expect(Date.now() - started).toBeGreaterThanOrEqual(19000);
  expect(f.trace.filter(t => t.method === 'POST')).toHaveLength(1); expect(reads).toBe(2);
});

it.each([401, 403, 404, 409, 429])('stops on HTTP %s instead of retrying revoked, invalid or rate-limited authority', async status => {
  const f = await fixture((req, res) => req.method === 'POST' ? acknowledge(res) : json(res, { code: 'SYNTHETIC_REJECTED' }, status));
  expect((await f.call()).error?.code).toBe(-32000);
  expect(f.trace.filter(t => t.method === 'POST')).toHaveLength(1); expect(f.trace.filter(t => t.method === 'GET')).toHaveLength(1);
});

it('stops after three consecutive transient observations and preserves the sole original creation', async () => {
  const f = await fixture((req, res) => req.method === 'POST' ? acknowledge(res) : json(res, {}, 503));
  expect((await f.call()).error?.code).toBe(-32000);
  expect(f.trace.filter(t => t.method === 'POST')).toHaveLength(1); expect(f.trace.filter(t => t.method === 'GET')).toHaveLength(3);
});

it.each(['different-intent', 'invalid-state', 'invalid-json'])('rejects %s instead of silently replacing or inventing the original result', async invalid => {
  const f = await fixture((req, res) => {
    if (req.method === 'POST') return acknowledge(res);
    if (invalid === 'different-intent') return success(res, 'synthetic-other-intent');
    if (invalid === 'invalid-state') return json(res, { intent_id: intent, state: 'INVENTED' });
    res.writeHead(200); res.end('{invalid');
  });
  expect((await f.call()).error?.code).toBe(-32000);
  expect(f.trace.filter(t => t.method === 'GET')).toHaveLength(1); expect(f.trace.filter(t => t.method === 'POST')).toHaveLength(1);
});

it('does not repeat an uncertain creation POST when its acknowledgement is lost', async () => {
  const f = await fixture((req, res) => { if (req.method === 'POST') req.socket.destroy(); else success(res); });
  expect((await f.call()).error?.code).toBe(-32000); expect(f.trace).toHaveLength(1);
  expect(f.trace[0]?.method).toBe('POST'); expect(f.trace[0]?.body?.idempotency_key).toMatch(/^mcp:/);
});

it('stops a hanging observation at the original role deadline without extending or recreating the task', async () => {
  const f = await fixture((req, res) => { if (req.method === 'POST') acknowledge(res); }, { deadlineMs: 3000 });
  const reply = await f.call();
  expect(reply.result?.isError).toBe(true); expect(reply.result?.content[0]?.text).toContain('DEADLINE_REACHED');
  expect(f.trace.filter(t => t.method === 'POST')).toHaveLength(1); expect(f.trace.filter(t => t.method === 'GET')).toHaveLength(1);
});

it('aborts its own in-flight observation and exits on stdin close without cancelling the durable task', async () => {
  const f = await fixture((req, res) => { if (req.method === 'POST') acknowledge(res); });
  const call = f.call(); void call.catch(() => {});
  const until = Date.now() + 10000;
  while (!f.trace.some(t => t.method === 'GET') && Date.now() < until) await pause(25);
  expect(f.trace.some(t => t.method === 'GET')).toBe(true); f.child.stdin.end();
  const exited = await Promise.race([f.closed.then(() => true), pause(3000).then(() => false)]);
  expect(exited, 'The bridge must close its own HTTP request without waiting for the role deadline').toBe(true);
  expect(f.trace.map(t => t.method)).toEqual(['POST', 'GET']);
});

it('keeps TLS verification enabled and never retries a certificate rejection', async () => {
  const f = await fixture((_req, res) => acknowledge(res), { trusted: false });
  expect((await f.call()).error?.code).toBe(-32000); expect(f.trace).toHaveLength(0);
});
