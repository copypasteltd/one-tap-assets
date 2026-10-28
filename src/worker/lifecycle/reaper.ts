import { mkdir, readdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import type pg from 'pg';
import type { Config } from '../../api/config.js';
import { transaction } from '../../api/db/pool.js';
import { id, hash, iso } from '../../api/lib/crypto.js';
import { AppError, requireThat } from '../../api/lib/errors.js';
import { validateInternal } from '../../api/lib/validation.js';
import { NativeDetachedCleaner, checkedProjectPath, type CleanupBinding, type DetachedCleaner, type NativeCleanupReceipt } from '../codex/launcher.js';
import type { OutboxLease } from '../queue/outbox.js';
import { absent, removeInstanceTree } from './cleanup-files.js';
import { requestInstanceRelease, type InstanceRow, type ReleaseReason } from './instance-release.js';

const CLEANUP_LEASE_SECONDS = 60;
interface CleanupLease extends InstanceRow {
  cleanup_owner: string; cleanup_generation: string; cleanup_attempts: number;
  run_id: string; runtime_process_ref: string | null;
  run_private: { runtime_admission?: { launcher_sha256: string } };
  private: { cleanup_protocol?: string; cleanup_binding?: CleanupBinding; release_reason?: ReleaseReason; [key: string]: unknown };
}
export class InstanceReaper {
  private cleaner: DetachedCleaner;
  constructor(private pool: pg.Pool, private cfg: Config, private workerId: string, cleaner?: DetachedCleaner) {
    requireThat(/^[A-Za-z0-9._-]{1,100}$/.test(workerId), 'CLEANUP_OWNER_INVALID', '清理器身份无效', 500);
    requireThat(!cleaner || cfg.env === 'test', 'TEST_PORT_FORBIDDEN', '清理替身只能用于显式测试环境', 500);
    this.cleaner = cleaner ?? new NativeDetachedCleaner(cfg);
  }
  async requestEvent(event: OutboxLease): Promise<void> {
    const instanceId = typeof event.payload.instance_id === 'string' ? event.payload.instance_id : null;
    const scopeId = typeof event.payload.scope_id === 'string' ? event.payload.scope_id : event.aggregate_id;
    const rows = (await this.pool.query<{ id: string }>(`SELECT id FROM agent_instances WHERE tenant_id=$1 AND state<>'RELEASED'
      AND (($2::text IS NOT NULL AND id=$2) OR ($2::text IS NULL AND (order_id=$3 OR preview_session_id=$3)))`, [event.tenant_id, instanceId, scopeId])).rows;
    for (const row of rows) {
      try { await transaction(this.pool, db => requestInstanceRelease(db, event.tenant_id, row.id, this.reason(event.payload.reason))); }
      catch (error) { if (!(error instanceof AppError && error.code === 'INSTANCE_STILL_ACTIVE')) throw error; }
    }
  }
  private reason(value: unknown): ReleaseReason {
    return ['DELIVERED','FAILED','CANCELLED','SUSPEND','PREQUOTE_COMPLETE','EXPIRED'].includes(String(value)) ? value as ReleaseReason : 'EXPIRED';
  }
  async scanOrphans(limit = 50): Promise<number> {
    requireThat(Number.isInteger(limit) && limit > 0 && limit <= 500, 'CLEANUP_BATCH_INVALID', '孤儿扫描批次无效', 500);
    const rows = (await this.pool.query<{ id: string; tenant_id: string }>(`SELECT i.id,i.tenant_id FROM agent_instances i
      WHERE i.state NOT IN ('RELEASED','DRAINING','RELEASING','CLEANUP_FAILED') AND
      (i.lease_expires_at<=clock_timestamp() OR NOT EXISTS(SELECT 1 FROM agent_runs r JOIN stage_runs s
       ON s.tenant_id=r.tenant_id AND s.id=r.private->>'stage_run_id' WHERE r.tenant_id=i.tenant_id AND r.instance_id=i.id
       AND r.state NOT IN ('SUCCEEDED','FAILED','CANCELLED','UNKNOWN') AND s.state='RUNNING'
       AND s.fencing_token::text=r.private->>'stage_fencing_token' AND s.lease_expires_at>clock_timestamp() AND s.deadline_at>clock_timestamp()
       AND (s.scope_type<>'ORDER' OR EXISTS(SELECT 1 FROM orders o WHERE o.tenant_id=s.tenant_id AND o.id=s.scope_id
        AND o.fulfillment_state IN ('QUEUED','IN_PROGRESS') AND o.deadline_at>clock_timestamp() AND NOT(o.private ? 'media_revoked')))))
      ORDER BY i.lease_expires_at,i.id LIMIT $1`, [limit])).rows;
    let requested = 0;
    for (const row of rows) {
      try { if (await transaction(this.pool, db => requestInstanceRelease(db, row.tenant_id, row.id, 'EXPIRED'))) requested++; }
      catch (error) { if (!(error instanceof AppError && error.code === 'INSTANCE_STILL_ACTIVE')) throw error; }
    }
    return requested;
  }
  private async claim(tenantId?: string, instanceId?: string): Promise<CleanupLease | null> {
    return transaction(this.pool, async db => {
      const row = (await db.query<CleanupLease>(`SELECT i.*,r.id AS run_id,r.runtime_process_ref,r.private AS run_private
        FROM agent_instances i LEFT JOIN LATERAL(SELECT * FROM agent_runs WHERE tenant_id=i.tenant_id AND instance_id=i.id
          ORDER BY created_at DESC LIMIT 1) r ON true WHERE i.state IN ('DRAINING','RELEASING','CLEANUP_FAILED')
        AND i.cleanup_available_at<=clock_timestamp() AND (i.cleanup_lease_expires_at IS NULL OR i.cleanup_lease_expires_at<clock_timestamp())
        AND ($1::text IS NULL OR i.tenant_id=$1) AND ($2::text IS NULL OR i.id=$2)
        ORDER BY i.cleanup_available_at,i.created_at FOR UPDATE OF i SKIP LOCKED LIMIT 1`, [tenantId ?? null, instanceId ?? null])).rows[0];
      if (!row) return null;
      const updated = (await db.query<CleanupLease>(`UPDATE agent_instances SET state='RELEASING',fencing_token=fencing_token+1,
        cleanup_generation=cleanup_generation+1,cleanup_attempts=cleanup_attempts+1,cleanup_owner=$3,
        cleanup_lease_expires_at=clock_timestamp()+$4::int*interval '1 second',updated_at=now(),
        data=data||jsonb_build_object('state','RELEASING','fencing_token',fencing_token+1)
        WHERE tenant_id=$1 AND id=$2 RETURNING *`, [row.tenant_id, row.id, this.workerId, CLEANUP_LEASE_SECONDS])).rows[0]!;
      await db.query('UPDATE agent_capabilities SET revoked_at=COALESCE(revoked_at,now()) WHERE tenant_id=$1 AND instance_id=$2', [row.tenant_id, row.id]);
      return { ...row, ...updated };
    });
  }
  private async owns(lease: CleanupLease): Promise<void> {
    const result = await this.pool.query(`SELECT id FROM agent_instances WHERE tenant_id=$1 AND id=$2 AND state='RELEASING'
      AND fencing_token=$3 AND cleanup_generation=$4 AND cleanup_owner=$5 AND cleanup_lease_expires_at>clock_timestamp()`,
    [lease.tenant_id, lease.id, lease.fencing_token, lease.cleanup_generation, this.workerId]);
    requireThat(result.rowCount === 1, 'CLEANUP_LEASE_LOST', '清理代次已过期或被接管', 409);
  }
  async releaseOne(signal: AbortSignal, tenantId?: string, instanceId?: string): Promise<boolean> {
    const lease = await this.claim(tenantId, instanceId); if (!lease) return false;
    let native: NativeCleanupReceipt | null = null; let errorCode: string | null = null; let complete = false;
    const binding = lease.private.cleanup_binding; const root = join(this.cfg.runtimeRoot, 'agent-instances', lease.id, lease.run_id ?? 'missing-run');
    const control = join(this.cfg.runtimeRoot, 'agent-control', lease.id);
    try {
      requireThat(!signal.aborted && lease.run_id && resolve(lease.workspace_ref) === resolve(root)
        && lease.private.cleanup_protocol === 'YPCC-CLEANUP-1', 'CODEX_CLEANUP_BINDING_MISSING', '实例缺少可独立恢复的清理登记', 503);
      await this.owns(lease);
      if (binding) {
        requireThat(binding.version === 'YPCC-CLEANUP-1' && hash(binding.manifest) === binding.manifest_hash
          && Object.keys(binding.manifest.environment).length === 0 && binding.manifest.instance_id === lease.id && binding.manifest.run_id === lease.run_id
          && binding.manifest.virtualization === 'FORBIDDEN' && binding.manifest.shell_tools === 'DISABLED'
          && binding.launcher_sha256 === lease.run_private.runtime_admission?.launcher_sha256
          && (binding.mode === 'ADMITTED_NATIVE' || this.cfg.env === 'test' && binding.mode === 'SYNTHETIC_PROTOCOL')
          && hash(binding.manifest.writable_paths.map(p => resolve(p))) === hash(['home','work','tmp'].map(p => join(root, p)))
          && resolve(binding.manifest.cwd) === join(root, 'work')
          && resolve(binding.manifest.launch_receipt_path) === join(control, 'launch-receipt.json')
          && resolve(binding.manifest.cleanup_receipt_path) === join(control, 'native-cleanup.json'),
        'CODEX_CLEANUP_BINDING_INVALID', '实例清理登记、原生构建或目录不一致', 503);
        if (!await absent(control)) await checkedProjectPath(this.cfg, control);
        else { await checkedProjectPath(this.cfg, dirname(control)); await mkdir(control); await checkedProjectPath(this.cfg, control); }
        native = await this.cleaner.release(binding, lease.runtime_process_ref, signal);
        requireThat(native.nonce === binding.manifest.nonce && native.run_id === lease.run_id
          && typeof native.process_ref === 'string' && native.process_ref.length > 0 && native.process_ref.length <= 200
          && (!lease.runtime_process_ref || native.process_ref === lease.runtime_process_ref) && native.no_active_processes === true
          && native.credentials_removed === true && native.temporary_files_removed === true, 'CODEX_CLEANUP_UNVERIFIED', '清理回执不属于当前实例', 503);
        for (const name of ['home','work','tmp']) requireThat(await absent(join(root, name)), 'CODEX_CLEANUP_UNVERIFIED', '实例临时目录仍然存在', 503);
        requireThat(await absent(root) || (await readdir(root)).length === 0, 'CODEX_CLEANUP_UNVERIFIED', '实例工作根仍有未核验文件', 503);
      } else {
        requireThat(!lease.runtime_process_ref && !(await this.pool.query('SELECT id FROM agent_isolation_evidence WHERE tenant_id=$1 AND instance_id=$2', [lease.tenant_id, lease.id])).rowCount,
          'CODEX_CLEANUP_BINDING_MISSING', '已有进程登记但缺少清理绑定', 503);
      }
      await this.owns(lease);
      const tools = await this.pool.query("SELECT id FROM agent_tool_intents WHERE tenant_id=$1 AND run_id=$2 AND state IN ('RUNNING','QUEUED')", [lease.tenant_id, lease.run_id]);
      requireThat(tools.rowCount === 0, 'CLEANUP_TOOLS_UNRESOLVED', '后台工具尚未停止，不能确认完整释放', 503);
      await removeInstanceTree(this.cfg, root, join(this.cfg.runtimeRoot, 'agent-instances', lease.id, lease.run_id));
      await this.owns(lease); await removeInstanceTree(this.cfg, control, join(this.cfg.runtimeRoot, 'agent-control', lease.id));
      complete = await absent(root) && await absent(control) && !signal.aborted;
      requireThat(complete, 'CODEX_CLEANUP_UNVERIFIED', '实例清理未得到确认', 503);
    } catch (error) {
      errorCode = error instanceof AppError ? error.code : 'CODEX_CLEANUP_UNVERIFIED';
      if (errorCode === 'CLEANUP_LEASE_LOST') return true;
    }
    await transaction(this.pool, async db => {
      const owned = (await db.query<InstanceRow>(`SELECT * FROM agent_instances WHERE tenant_id=$1 AND id=$2 AND state='RELEASING'
        AND fencing_token=$3 AND cleanup_generation=$4 AND cleanup_owner=$5 AND cleanup_lease_expires_at>clock_timestamp() FOR UPDATE`,
      [lease.tenant_id, lease.id, lease.fencing_token, lease.cleanup_generation, this.workerId])).rows[0];
      if (!owned) return;
      const providers = (await db.query<{ id: string }>(`SELECT DISTINCT p.id FROM provider_submissions p JOIN stage_runs s ON s.id=p.stage_run_id AND s.tenant_id=p.tenant_id
        JOIN agent_runs r ON r.tenant_id=s.tenant_id AND r.private->>'stage_run_id'=s.id WHERE r.tenant_id=$1 AND r.instance_id=$2
        AND p.state IN ('SUBMITTING','UNKNOWN') ORDER BY p.id`, [lease.tenant_id, lease.id])).rows.map(r => r.id);
      const inference = (await db.query<{ id: string }>("SELECT id FROM inference_requests WHERE tenant_id=$1 AND run_id=$2 AND state IN ('SUBMITTING','UNKNOWN') ORDER BY id", [lease.tenant_id, lease.run_id])).rows.map(r => r.id);
      const revoked = !(await db.query('SELECT id FROM agent_capabilities WHERE tenant_id=$1 AND instance_id=$2 AND revoked_at IS NULL', [lease.tenant_id, lease.id])).rowCount;
      const passed = complete && revoked; const receiptId = id('cleanup'); const state = passed ? 'RELEASED' : 'CLEANUP_FAILED';
      const evidence = hash({ native, binding: binding?.manifest_hash ?? null, run_id: lease.run_id, files_absent: complete, providers, inference, revoked });
      const data = { tenant_id: lease.tenant_id, order_id: lease.order_id, preview_session_id: lease.preview_session_id,
        cleanup_receipt_id: receiptId, instance_id: lease.id, fencing_token: Number(lease.fencing_token), state,
        release_reason: this.reason(lease.private.release_reason ?? lease.data.release_reason), processes_stopped: complete,
        capabilities_revoked: revoked, temporary_files_removed: complete, runtime_history_removed: complete,
        durable_artifacts_preserved: true, pending_submissions_detached: true, pending_provider_submission_ids: providers,
        verified_at: passed ? iso() : null, evidence_hash: evidence, error_codes: passed ? [] : [errorCode ?? 'CODEX_CLEANUP_UNVERIFIED'] };
      validateInternal('cleanup-receipt', data);
      await db.query(`INSERT INTO cleanup_receipts(id,tenant_id,instance_id,fencing_token,state,evidence_hash,data,private,verified_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,now())`, [receiptId, lease.tenant_id, lease.id, lease.fencing_token, state, evidence,
        JSON.stringify(data), JSON.stringify({ native, pending_inference_ids: inference, mode: binding?.mode ?? 'NOT_LAUNCHED', cleanup_generation: lease.cleanup_generation })]);
      await db.query(`UPDATE agent_instances SET state=$3,cleanup_owner=NULL,cleanup_lease_expires_at=NULL,
        cleanup_available_at=clock_timestamp()+interval '60 seconds',updated_at=now(),data=data||jsonb_build_object('state',$3::text)
        WHERE tenant_id=$1 AND id=$2`, [lease.tenant_id, lease.id, state]);
      if (passed) await db.query(`UPDATE agent_runs SET state=CASE WHEN EXISTS(SELECT 1 FROM inference_requests q WHERE q.tenant_id=$1 AND q.run_id=agent_runs.id
        AND q.state IN ('SUBMITTING','UNKNOWN')) THEN 'UNKNOWN' ELSE 'FAILED' END,updated_at=now(),data=data||jsonb_build_object('state',
        CASE WHEN EXISTS(SELECT 1 FROM inference_requests q WHERE q.tenant_id=$1 AND q.run_id=agent_runs.id AND q.state IN ('SUBMITTING','UNKNOWN'))
        THEN 'UNKNOWN' ELSE 'FAILED' END) WHERE tenant_id=$1 AND instance_id=$2 AND state NOT IN ('SUCCEEDED','FAILED','CANCELLED','UNKNOWN')`, [lease.tenant_id, lease.id]);
    });
    return true;
  }
}
