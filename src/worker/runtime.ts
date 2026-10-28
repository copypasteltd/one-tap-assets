import { setTimeout as delay } from 'node:timers/promises';
import type pg from 'pg';
import { AppError } from '../api/lib/errors.js';
import { iso } from '../api/lib/crypto.js';
import { expireWork } from './lifecycle/deadlines.js';
import { claimStage, heartbeatStage, completeStage, deferStage, failStage, PendingExternal, type StageLease } from './queue/leases.js';
import { claimEvent, heartbeatEvent, finishEvent, type OutboxLease } from './queue/outbox.js';

export type StageCommit = (db: pg.PoolClient) => Promise<void>;
export type StageHandler = (lease: StageLease, signal: AbortSignal) => Promise<StageCommit>;
export type EventHandler = (event: OutboxLease, signal: AbortSignal) => Promise<void>;
export type WorkerLog = (event: { event: string; code?: string; resource_id?: string }) => void;
export const errorCode = (error: unknown): string => error instanceof AppError && /^[A-Z][A-Z0-9_]{1,79}$/.test(error.code) ? error.code : 'WORKER_INTERNAL_ERROR';

interface RuntimeOptions {
  pool: pg.Pool; workerId: string; stages: Readonly<Record<string, StageHandler>>;
  events: Readonly<Record<string, EventHandler>>; log?: WorkerLog;
  scheduleReconciliation?: () => Promise<void>;
  admissionGuard?: () => Promise<void>;
  heartbeatMs?: number;
}
export class WorkerRuntime {
  private options: RuntimeOptions; private lastMaintenance = -Infinity;
  private lastReconciliation = -Infinity; private ticking = false;
  private maintenance: Promise<void> | null = null;
  constructor(options: RuntimeOptions) {
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(options.workerId)) throw new Error('Invalid worker identity');
    if (options.heartbeatMs !== undefined && (options.heartbeatMs < 10 || options.heartbeatMs > 15000)) throw new Error('Invalid heartbeat interval');
    this.options = options;
  }
  private emit(event: Parameters<WorkerLog>[0]): void { this.options.log?.(event); }
  private async withHeartbeat<T>(pulse: () => Promise<boolean>, signal: AbortSignal, action: (signal: AbortSignal) => Promise<T>): Promise<T> {
    const controller = new AbortController(); const abort = (): void => controller.abort(signal.reason);
    signal.addEventListener('abort', abort, { once: true }); if (signal.aborted) abort();
    let pending: Promise<void> | null = null; let alive = true;
    const timer = setInterval(() => {
      if (pending || controller.signal.aborted) return;
      pending = pulse().then(ok => { if (!ok) { alive = false; controller.abort(new AppError('LEASE_LOST', '执行租约已失效', 409)); } })
        .catch(() => { alive = false; controller.abort(new AppError('LEASE_HEARTBEAT_FAILED', '无法续期执行租约', 503)); })
        .finally(() => { pending = null; });
    }, this.options.heartbeatMs ?? 10000);
    timer.unref();
    try {
      const result = await action(controller.signal);
      if (!alive) throw new AppError('LEASE_LOST', '执行租约已失效', 409);
      if (controller.signal.aborted) throw new AppError('WORKER_INTERRUPTED', 'Worker 已停止当前执行', 409);
      return result;
    } finally { clearInterval(timer); if (pending) await pending; signal.removeEventListener('abort', abort); }
  }
  async maintain(): Promise<void> {
    if (this.maintenance) return this.maintenance;
    this.maintenance = this.doMaintain().finally(() => { this.maintenance = null; });
    return this.maintenance;
  }
  private async doMaintain(): Promise<void> {
    const now = Date.now();
    if (now - this.lastMaintenance >= 5000) {
      await expireWork(this.options.pool);
      await this.options.pool.query(`INSERT INTO worker_heartbeats(id,last_seen_at,data) VALUES($1,now(),$2)
        ON CONFLICT(id) DO UPDATE SET last_seen_at=now(),data=EXCLUDED.data`, [this.options.workerId,
        JSON.stringify({ state: 'ACTIVE', stage_handlers: Object.keys(this.options.stages), event_handlers: Object.keys(this.options.events), updated_at: iso() })]);
      this.lastMaintenance = now;
    }
    if (now - this.lastReconciliation >= 30000 && this.options.scheduleReconciliation) {
      await this.options.scheduleReconciliation(); this.lastReconciliation = now;
    }
  }
  async processEvent(signal: AbortSignal): Promise<boolean> {
    if (signal.aborted) return false;
    await this.options.admissionGuard?.();
    const event = await claimEvent(this.options.pool, this.options.workerId, Object.keys(this.options.events));
    if (!event) return false;
    const handler = this.options.events[event.aggregate_type]!;
    try {
      await this.withHeartbeat(() => heartbeatEvent(this.options.pool, event), signal, s => handler(event, s));
      await finishEvent(this.options.pool, event);
    } catch (error) {
      const code = errorCode(error); await finishEvent(this.options.pool, event, code);
      this.emit({ event: 'outbox_deferred', code, resource_id: event.id });
    }
    return true;
  }
  async processStage(signal: AbortSignal): Promise<boolean> {
    await this.options.admissionGuard?.();
    if (signal.aborted) return false;
    const lease = await claimStage(this.options.pool, this.options.workerId, Object.keys(this.options.stages));
    if (!lease) return false;
    const handler = this.options.stages[lease.stage_name]!;
    try {
      const commit = await this.withHeartbeat(() => heartbeatStage(this.options.pool, lease), signal, s => handler(lease, s));
      if (signal.aborted) throw new AppError('WORKER_INTERRUPTED', '执行已停止，将从持久检查点恢复', 409);
      await completeStage(this.options.pool, lease, commit);
      this.emit({ event: 'stage_succeeded', resource_id: lease.id });
    } catch (error) {
      const code = errorCode(error);
      if (signal.aborted || ['LEASE_LOST', 'LEASE_HEARTBEAT_FAILED', 'WORKER_INTERRUPTED', 'ORDER_NO_LONGER_EXECUTABLE'].includes(code)) {
        this.emit({ event: 'stage_interrupted', code, resource_id: lease.id }); return true;
      }
      try {
        if (error instanceof PendingExternal) await deferStage(this.options.pool, lease, code, error.delaySeconds);
        else await failStage(this.options.pool, lease, code);
      } catch (settleError) {
        // A deadline sweep/takeover can legitimately win this race. The stale
        // handler must not force any terminal state or release unknown costs.
        this.emit({ event: 'stage_settlement_deferred', code: errorCode(settleError), resource_id: lease.id });
      }
      this.emit({ event: error instanceof PendingExternal ? 'stage_deferred' : 'stage_failed', code, resource_id: lease.id });
    }
    return true;
  }
  async tick(signal: AbortSignal): Promise<boolean> {
    if (this.ticking || signal.aborted) return false;
    this.ticking = true;
    try { await this.maintain(); const event = await this.processEvent(signal); const stage = await this.processStage(signal); return event || stage; }
    finally { this.ticking = false; }
  }
  async run(signal: AbortSignal): Promise<void> {
    const maintenanceTimer = setInterval(() => { void this.maintain().catch(error => this.emit({ event: 'maintenance_failed', code: errorCode(error) })); }, 5000);
    maintenanceTimer.unref();
    try {
      while (!signal.aborted) {
        try { if (await this.tick(signal)) continue; }
        catch (error) { this.emit({ event: 'worker_tick_failed', code: errorCode(error) }); }
        try { await delay(750, undefined, { signal }); } catch { if (!signal.aborted) throw new Error('Worker wait failed'); }
      }
    } finally {
      clearInterval(maintenanceTimer); if (this.maintenance) await this.maintenance.catch(() => {});
      await this.options.pool.query(`UPDATE worker_heartbeats SET last_seen_at=now(),data=data||'{"state":"STOPPED"}'::jsonb WHERE id=$1`, [this.options.workerId]);
    }
  }
}
