import { it, expect } from 'vitest';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { resolve } from 'node:path';

// Actual HTTP/stdio, synthetic business replies. No model, DB or isolation claim.
it('uses loopback HTTP and observes the same acknowledged intent without repeating an uncertain purchase', async () => {
  const trace: string[] = []; let observations = 0;
  const server = createServer((req, res) => {
    trace.push(`${req.method} ${req.url}`);
    expect(req.headers.authorization).toBe('Bearer synthetic-scoped-capability');
    req.resume();
    res.setHeader('content-type', 'application/json');
    if (req.method === 'POST') { res.statusCode = 202; res.end(JSON.stringify({ intent_id: 'synthetic-original', state: 'QUEUED' })); }
    else if (++observations === 1) { res.statusCode = 503; res.end('{}'); }
    else res.end(JSON.stringify({ intent_id: 'synthetic-original', state: 'SUCCEEDED', result: { okay: true } }));
  });
  await new Promise<void>(done => server.listen(0, '127.0.0.1', done));
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('No loopback port');
  const child = spawn(process.execPath, [resolve('runtime/build/worker/tool-gateway/mcp-main.js')], { shell: false, windowsHide: true,
    env: { SystemRoot: process.env.SystemRoot, YPCC_TOOL_ENDPOINT: `http://127.0.0.1:${address.port}`,
      YPCC_TOOL_CAPABILITY: 'synthetic-scoped-capability', YPCC_ROLE_DEADLINE_MS: String(Date.now() + 10000) }, stdio: ['pipe', 'pipe', 'pipe'] });
  const closed = new Promise<void>(done => child.once('close', () => done())); child.stderr.resume();
  try {
    const result = new Promise<Record<string, unknown>>((done, fail) => {
      const timer = setTimeout(() => fail(new Error('MCP loopback response timeout')), 8000);
      createInterface({ input: child.stdout }).once('line', line => { clearTimeout(timer); done(JSON.parse(line) as Record<string, unknown>); });
      child.once('error', fail);
    });
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'synthetic_tool', arguments: {} } }) + '\n');
    expect(await result).toMatchObject({ id: 1, result: { content: [{ text: '{"okay":true}' }] } });
    expect(trace).toEqual(['POST /v1/internal/p01/agent-tools/calls', 'GET /v1/internal/p01/agent-tools/calls/synthetic-original', 'GET /v1/internal/p01/agent-tools/calls/synthetic-original']);
  } finally {
    child.stdin.end(); const timer = setTimeout(() => child.kill(), 2000);
    await closed; clearTimeout(timer); server.closeAllConnections();
    await new Promise<void>((done, fail) => server.close(error => error ? fail(error) : done()));
  }
});
