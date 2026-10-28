import type { ChildProcessWithoutNullStreams } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { object } from '../../shared/domain/json.js';
import { AppError, requireThat } from '../../api/lib/errors.js';
export interface RpcNotification { method: string; params: Record<string, unknown> }
export class AppServerRpc extends EventEmitter {
  private sequence = 0; private closed = false;
  private pending = new Map<number, { resolve(value: unknown): void; reject(error: Error): void; timer: ReturnType<typeof setTimeout> }>();
  constructor(readonly child: ChildProcessWithoutNullStreams) {
    super();
    let buffered = Buffer.alloc(0);
    const lineReceived = (line: string): void => {
      let message: Record<string, unknown>;
      try { message = object(JSON.parse(line) as unknown); } catch { this.closeWith(new AppError('CODEX_PROTOCOL_INVALID', 'Codex 协议消息无效', 503)); return; }
      if ('method' in message && 'id' in message) {
        // Approval requests are never escalated to a human or auto-approved.
        // No shell/file/network grant can widen an order capability.
        const method = String(message.method);
        const result = method.includes('commandExecution') || method.includes('fileChange') ? { decision: 'decline' }
          : method.includes('requestApproval') ? { decision: 'denied' } : null;
        this.send(result ? { jsonrpc: '2.0', id: message.id, result } : { jsonrpc: '2.0', id: message.id, error: { code: -32601, message: 'Server-initiated operation is not allowed by the service policy' } });
        this.emit('denied-request', { method }); return;
      }
      if (typeof message.id === 'number') {
        const pending = this.pending.get(message.id); if (!pending) return;
        this.pending.delete(message.id); clearTimeout(pending.timer);
        if (message.error) pending.reject(new AppError('CODEX_RPC_REJECTED', 'Codex 拒绝了当前协议请求', 503)); else pending.resolve(message.result);
      } else if (typeof message.method === 'string') {
        try { this.emit('notification', { method: message.method, params: object(message.params ?? {}) } satisfies RpcNotification); }
        catch { this.closeWith(new AppError('CODEX_PROTOCOL_INVALID', 'Codex 通知字段无效', 503)); }
      }
    };
    child.stdout.on('data', (part: Buffer) => {
      if (this.closed) return;
      let offset = 0;
      while (offset < part.length && !this.closed) {
        const end = part.indexOf(10, offset); const stop = end < 0 ? part.length : end;
        if (buffered.length + stop - offset > 4000000) { buffered = Buffer.alloc(0); this.closeWith(new AppError('CODEX_PROTOCOL_LIMIT', 'Codex 协议消息超出限制', 503)); return; }
        buffered = Buffer.concat([buffered, part.subarray(offset, stop)]);
        if (end < 0) break;
        const line = buffered.toString('utf8').replace(/\r$/, ''); buffered = Buffer.alloc(0); offset = end + 1;
        lineReceived(line);
      }
    });
    child.stdin.on('error', () => this.closeWith(new AppError('CODEX_PROCESS_CLOSED', 'Codex 输入通道已关闭', 503)));
    child.once('error', () => this.closeWith(new AppError('CODEX_PROCESS_UNAVAILABLE', 'Codex 运行程序无法启动', 503)));
    child.once('close', () => this.closeWith(new AppError('CODEX_PROCESS_CLOSED', 'Codex 进程已结束，执行状态将从持久记录恢复', 503)));
    child.stderr.on('data', () => { /* Provider messages can contain private input. Never mirror raw stderr. */ });
  }
  private send(message: unknown): void { if (!this.closed && !this.child.stdin.destroyed) this.child.stdin.write(`${JSON.stringify(message)}\n`); }
  request(method: string, params: unknown, timeoutMs = 30000): Promise<unknown> {
    requireThat(!this.closed, 'CODEX_PROCESS_CLOSED', 'Codex 进程已结束', 503);
    const id = ++this.sequence;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new AppError('CODEX_RPC_TIMEOUT', 'Codex 协议请求超时', 503, true)); }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer }); this.send({ jsonrpc: '2.0', id, method, params });
    });
  }
  notify(method: string, params: unknown = {}): void { this.send({ jsonrpc: '2.0', method, params }); }
  async initialize(): Promise<void> {
    await this.request('initialize', { clientInfo: { name: 'ypcc-cloud-worker', title: '一品成片订单执行服务', version: '0.1.0' }, capabilities: { experimentalApi: true } });
    this.notify('initialized');
  }
  async turn(threadId: string, input: unknown[], outputSchema: unknown, deadline: number, signal?: AbortSignal): Promise<{ turnId: string; text: string; usage: Record<string, unknown> | null }> {
    requireThat(!signal?.aborted && deadline > Date.now(), 'CODEX_TURN_INTERRUPTED', 'Codex 阶段已中断或到期', 409);
    let turnId: string | null = null; let text = ''; let usage: Record<string, unknown> | null = null;
    let completeResolve: (() => void) | undefined; let completeReject: ((e: Error) => void) | undefined;
    const complete = new Promise<void>((resolve, reject) => { completeResolve = resolve; completeReject = reject; });
    void complete.catch(() => { /* handled below even if an early notification rejects before turn/start replies */ });
    // Register before turn/start: fast turns can finish before its reply arrives.
    const notifications: RpcNotification[] = [];
    const processNotification = (note: RpcNotification): void => {
      const p = note.params;
      if (p.threadId !== threadId) return;
      if (note.method === 'thread/tokenUsage/updated') usage = object(p.tokenUsage ?? {});
      if (note.method === 'item/completed') { const item = object(p.item); if (item.type === 'agentMessage' && typeof item.text === 'string') text = item.text; }
      if (note.method === 'turn/completed') {
        const turn = object(p.turn); if (turnId && turn.id !== turnId) return;
        if (turn.status === 'completed') completeResolve?.(); else completeReject?.(new AppError('CODEX_TURN_FAILED', 'Codex 阶段未正常完成', 503));
      }
      if (note.method === 'error' && p.willRetry !== true) completeReject?.(new AppError('CODEX_TURN_FAILED', 'Codex 阶段返回错误', 503));
    };
    let noteCount = 0;
    const listener = (note: RpcNotification): void => {
      if (++noteCount > 100000 || turnId === null && notifications.length >= 1000) { completeReject?.(new AppError('CODEX_PROTOCOL_LIMIT', 'Codex 协议事件超过限制', 503)); return; }
      if (turnId === null) notifications.push(note); else processNotification(note);
    };
    this.on('notification', listener);
    const abort = (): void => { if (turnId) void this.request('turn/interrupt', { threadId, turnId }, 5000).catch(() => {}); completeReject?.(new AppError('CODEX_TURN_INTERRUPTED', 'Codex 阶段已中断', 409)); };
    const timeout = setTimeout(abort, Math.max(1, deadline - Date.now())); timeout.unref(); signal?.addEventListener('abort', abort, { once: true });
    const closed = (): void => completeReject?.(new AppError('CODEX_PROCESS_CLOSED', 'Codex 阶段进程已结束', 503)); this.once('closed', closed);
    try {
      const started = object(await this.request('turn/start', { threadId, input, outputSchema }, Math.max(1, Math.min(30000, deadline - Date.now()))));
      turnId = String(object(started.turn).id); requireThat(turnId && turnId !== 'undefined', 'CODEX_PROTOCOL_INVALID', 'Codex 未返回阶段标识', 503);
      for (const note of notifications) processNotification(note);
      if (signal?.aborted) abort(); await complete;
      requireThat(text.trim(), 'CODEX_OUTPUT_MISSING', 'Codex 阶段缺少结构化结果', 503); return { turnId, text, usage };
    } finally { clearTimeout(timeout); signal?.removeEventListener('abort', abort); this.off('notification', listener); this.off('closed', closed); }
  }
  private closeWith(error: Error): void {
    if (this.closed) return; this.closed = true;
    for (const request of this.pending.values()) { clearTimeout(request.timer); request.reject(error); } this.pending.clear(); this.emit('closed');
  }
  async stop(): Promise<void> {
    if (this.child.exitCode !== null || this.child.signalCode !== null) return;
    this.child.stdin.end();
    await new Promise<void>((resolve, reject) => {
      const kill = setTimeout(() => this.child.kill('SIGKILL'), 3000);
      const timeout = setTimeout(() => reject(new AppError('CODEX_PROCESS_STOP_UNVERIFIED', '角色进程退出尚未确认', 503)), 6000);
      this.child.once('close', () => { clearTimeout(kill); clearTimeout(timeout); resolve(); });
    });
  }
}
