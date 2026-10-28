import { it, expect } from 'vitest';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { AppServerRpc } from '../../src/worker/codex/rpc.js';
import type { RpcNotification } from '../../src/worker/codex/rpc.js';
it('handles real stdio framing, early completion and denies server-initiated shell approval', async () => {
  const child = spawn(process.execPath, [resolve('tests/fixtures/app-server.cjs')], { cwd: process.cwd(), windowsHide: true, shell: false, stdio: ['pipe', 'pipe', 'pipe'], env: {} });
  const rpc = new AppServerRpc(child);
  try {
    await rpc.initialize(); await rpc.request('thread/start', {});
    const result = await rpc.turn('fixture-thread', [{ type: 'text', text: 'synthetic protocol fixture only' }], { type: 'object' }, Date.now() + 5000);
    expect(result).toMatchObject({ turnId: 'fixture-turn', text: '{"accepted":true}' });
    const answer = new Promise<unknown>(resolveAnswer => { const listen = (n: RpcNotification): void => { if (n.method === 'test/approval-answer') { rpc.off('notification', listen); resolveAnswer(n.params); } }; rpc.on('notification', listen); });
    await rpc.request('test/request-approval', {}); expect(await answer).toEqual({ decision: 'decline' });
  } finally { await rpc.stop(); }
  expect(child.exitCode !== null || child.signalCode !== null).toBe(true);
});
it('rejects a protocol line before an unbounded missing-newline buffer can grow', async () => {
  const child = spawn(process.execPath, [resolve('tests/fixtures/app-server.cjs'), '--oversized-line'], { cwd: process.cwd(), windowsHide: true, shell: false, stdio: ['pipe', 'pipe', 'pipe'], env: {} });
  const rpc = new AppServerRpc(child);
  try { await expect(rpc.initialize()).rejects.toMatchObject({ code: 'CODEX_PROTOCOL_LIMIT' }); }
  finally { await rpc.stop(); }
});
it('does not submit a model turn after its signal has already been aborted', async () => {
  const child = spawn(process.execPath, [resolve('tests/fixtures/app-server.cjs')], { cwd: process.cwd(), windowsHide: true, shell: false, stdio: ['pipe', 'pipe', 'pipe'], env: {} });
  const rpc = new AppServerRpc(child);
  try {
    await rpc.initialize(); const controller = new AbortController(); controller.abort();
    await expect(rpc.turn('fixture-thread', [], {}, Date.now() + 5000, controller.signal)).rejects.toMatchObject({ code: 'CODEX_TURN_INTERRUPTED' });
  } finally { await rpc.stop(); }
});
