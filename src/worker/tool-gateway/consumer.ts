import { setTimeout as delay } from 'node:timers/promises';
import type pg from 'pg';
import { transaction } from '../../api/db/pool.js';
import { AppError, requireThat } from '../../api/lib/errors.js';
import { hash } from '../../api/lib/crypto.js';
import { toolScopeById, checkScopedTool, type ToolScope } from './http.js';
import { errorCode, type WorkerLog } from '../runtime.js';
import { emitWorkerLog, failureMetadata, type WorkerFailurePhase } from '../observability.js';
import { PendingExternal } from '../queue/leases.js';

export interface ToolLease {
  id: string; tenant_id: string; run_id: string; stage_run_id: string; tool_name: string;
  request_hash: string; fencing_token: string; lease_owner: string;
  data: { tool: string; arguments: Record<string, unknown> };
  private: { capability_id: string; snapshot_hash: string; packet_hash: string | null; stage_fencing_token: string; instance_fencing_token: string };
}
export interface ToolResult { result: unknown; commit?: (db: pg.PoolClient) => Promise<void> }
export type ToolHandler = (scope: ToolScope, args: Record<string, unknown>, intent: ToolLease, signal: AbortSignal) => Promise<ToolResult>;
export async function claimToolIntent(pool: pg.Pool, workerId: string, toolNames: readonly string[]): Promise<ToolLease | null> {
  // The candidate lock and ownership update share one statement/transaction.
  // Empty polls no longer pay for explicit BEGIN/COMMIT round trips.
  return (await pool.query<ToolLease>(`WITH ready AS (
    SELECT id FROM agent_tool_intents WHERE available_at<=now() AND tool_name=ANY($1)
      AND (state IN ('QUEUED','UNKNOWN') OR (state='RUNNING' AND lease_expires_at<now()))
    ORDER BY available_at,created_at,id FOR UPDATE SKIP LOCKED LIMIT 1
  ) UPDATE agent_tool_intents AS intent SET state='RUNNING',lease_owner=$2,
    lease_expires_at=now()+interval '45 seconds',fencing_token=intent.fencing_token+1,updated_at=now()
    FROM ready WHERE intent.id=ready.id RETURNING intent.*`, [toolNames, workerId])).rows[0] ?? null;
}
export class ToolConsumer {
  constructor(private pool: pg.Pool, private workerId: string, private handlers: Readonly<Record<string, ToolHandler>>, private log?: WorkerLog, private admissionGuard?: () => Promise<void>) {}
  private async scope(db: pg.Pool | pg.PoolClient, intent: ToolLease, lock = false): Promise<ToolScope> {
    const scope = await toolScopeById(db, intent.private.capability_id, lock);
    requireThat(scope.tenant_id === intent.tenant_id && scope.run_id === intent.run_id && scope.stage_run_id === intent.stage_run_id
      && scope.snapshot_hash === intent.private.snapshot_hash && scope.packet_hash === intent.private.packet_hash
      && BigInt(scope.stage_fencing_token) === BigInt(intent.private.stage_fencing_token)
      && BigInt(scope.instance_fencing_token) === BigInt(intent.private.instance_fencing_token), 'TOOL_BINDING_CHANGED', '工具调用已不属于当前运行代次', 409);
    requireThat(intent.data.tool === intent.tool_name && hash({ tool: intent.tool_name, arguments: intent.data.arguments }) === intent.request_hash,
      'TOOL_REQUEST_HASH_MISMATCH', '持久工具参数校验失败', 409);
    checkScopedTool(scope, intent.tool_name, intent.data.arguments); return scope;
  }
  async process(signal: AbortSignal): Promise<boolean> {
    if (signal.aborted) return false;
    await this.admissionGuard?.();
    const intent = await claimToolIntent(this.pool, this.workerId, Object.keys(this.handlers)); if (!intent) return false;
    const controller = new AbortController(); const abort = (): void => controller.abort(); signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
    let heartbeat: Promise<void> | null = null;
    const pulse = setInterval(() => {
      if (heartbeat || controller.signal.aborted) return;
      heartbeat = (async () => {
        await this.scope(this.pool, intent);
        const row = await this.pool.query(`UPDATE agent_tool_intents SET lease_expires_at=now()+interval '45 seconds'
          WHERE id=$1 AND fencing_token=$2 AND lease_owner=$3 AND state='RUNNING' AND lease_expires_at>now() RETURNING id`, [intent.id, intent.fencing_token, intent.lease_owner]);
        if (!row.rowCount) controller.abort();
      })().catch(() => controller.abort()).finally(() => { heartbeat = null; });
    }, 10000); pulse.unref();
    let phase: WorkerFailurePhase = 'AUTHORIZE';
    try {
      await this.admissionGuard?.();
      const scope = await this.scope(this.pool, intent);
      phase = 'HANDLER';
      const output = await this.handlers[intent.tool_name]!(scope, intent.data.arguments, intent, controller.signal);
      requireThat(!controller.signal.aborted, 'TOOL_EXECUTION_INTERRUPTED', '工具执行已停止', 409);
      phase = 'RESULT';
      const encoded = JSON.stringify(output.result);
      requireThat(typeof encoded === 'string' && Buffer.byteLength(encoded) <= 128000, 'TOOL_RESULT_LIMIT', '工具结果超过允许大小', 422);
      phase = 'COMMIT';
      await transaction(this.pool, async db => {
        await this.scope(db, intent, true);
        const current = await db.query(`SELECT id FROM agent_tool_intents WHERE id=$1 AND fencing_token=$2 AND lease_owner=$3
          AND state='RUNNING' AND lease_expires_at>now() FOR UPDATE`, [intent.id, intent.fencing_token, intent.lease_owner]);
        requireThat(current.rowCount === 1, 'TOOL_LEASE_LOST', '工具执行租约已失效', 409);
        if (output.commit) await output.commit(db);
        await db.query(`UPDATE agent_tool_intents SET state='SUCCEEDED',lease_owner=NULL,lease_expires_at=NULL,updated_at=now(),
          data=data||jsonb_build_object('result',$2::jsonb,'result_hash',$3::text) WHERE id=$1`, [intent.id, encoded, hash(output.result)]);
      });
    } catch (error) {
      const code = errorCode(error); const pending = error instanceof PendingExternal;
      const cancelled = controller.signal.aborted || ['TOOL_CAPABILITY_REVOKED', 'TOOL_SCOPE_ENDED', 'TOOL_BINDING_CHANGED', 'TOOL_EXECUTION_INTERRUPTED'].includes(code);
      try { await this.pool.query(`UPDATE agent_tool_intents SET state=$4,lease_owner=NULL,lease_expires_at=NULL,updated_at=now(),
        available_at=now()+$5::int*interval '1 second',data=data||jsonb_build_object('error_code',$6::text)
        WHERE id=$1 AND fencing_token=$2 AND lease_owner=$3 AND lease_expires_at>now() AND state='RUNNING'`,
      [intent.id, intent.fencing_token, intent.lease_owner, pending ? 'UNKNOWN' : cancelled ? 'CANCELLED' : 'FAILED', pending ? Math.min(60, Math.max(1, error.delaySeconds)) : 1, code]);
      } catch (settleError) {
        emitWorkerLog(this.log, { event: 'tool_settlement_deferred', code: errorCode(settleError), resource_id: intent.id,
          failure: failureMetadata(settleError), failure_phase: 'SETTLEMENT' });
        throw settleError;
      } finally {
        emitWorkerLog(this.log, { event: 'tool_execution_deferred', code, resource_id: intent.id,
          failure: failureMetadata(error), failure_phase: phase });
      }
    } finally { clearInterval(pulse); if (heartbeat) await heartbeat; signal.removeEventListener('abort', abort); }
    return true;
  }
  async run(signal: AbortSignal): Promise<void> {
    while (!signal.aborted) {
      try { if (await this.process(signal)) continue; } catch (error) { emitWorkerLog(this.log, { event: 'tool_consumer_failed', code: errorCode(error), failure: failureMetadata(error) }); }
      try { await delay(250, undefined, { signal }); } catch { if (!signal.aborted) throw new Error('Tool queue wait failed'); }
    }
  }
}
