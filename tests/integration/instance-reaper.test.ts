import { afterAll, afterEach, beforeAll, expect, it } from 'vitest';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { mkdir, readFile, rmdir, symlink, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { testDatabase, orderFixture, type TestDatabase } from '../helpers/database.js';
import { insert } from '../../src/api/db/store.js';
import { transaction } from '../../src/api/db/pool.js';
import { id, hash, sha256, addSeconds } from '../../src/api/lib/crypto.js';
import { enqueueStage } from '../../src/worker/queue/enqueue.js';
import { claimStage, type StageLease } from '../../src/worker/queue/leases.js';
import type { Principal } from '../../src/shared/contracts/types.js';
import { InstanceReaper } from '../../src/worker/lifecycle/reaper.js';
import { requestInstanceRelease } from '../../src/worker/lifecycle/instance-release.js';
import { absent, removeInstanceTree } from '../../src/worker/lifecycle/cleanup-files.js';
import type { CleanupBinding, DetachedCleaner, NativeCleanupReceipt } from '../../src/worker/codex/launcher.js';

let db: TestDatabase;
interface ReaperFixture {
  p: Principal; orderId: string; stageId: string; lease: StageLease; instanceId: string; runId: string;
  root: string; control: string; durable: string; child: ChildProcessWithoutNullStreams | null;
  binding: CleanupBinding; cleaner: DetachedCleaner; links: string[];
}
const fixtures: ReaperFixture[] = [];
const signal = (): AbortSignal => AbortSignal.timeout(15000);
const latch = () => { let resolve!: () => void; const promise = new Promise<void>(r => { resolve = r; }); return { promise, resolve }; };
beforeAll(async () => { db = await testDatabase(); });
afterEach(async () => {
  for (const f of fixtures.splice(0)) {
    await stop(f.child);
    for (const path of f.links) await unlink(path);
    await removeInstanceTree(db.cfg, f.root, f.root); await removeInstanceTree(db.cfg, f.control, f.control);
    await removeInstanceTree(db.cfg, f.durable, f.durable);
    await db.pool.query("UPDATE agent_instances SET state='RELEASED' WHERE id=$1", [f.instanceId]);
  }
  await db.pool.query("UPDATE stage_runs SET state='CANCELLED' WHERE state='RUNNING'");
});
afterAll(async () => { await db?.close(); });
async function stop(child: ChildProcessWithoutNullStreams | null): Promise<void> {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => { child.kill(); reject(new Error('Registered synthetic child did not exit')); }, 5000);
    child.once('error', reject); child.once('close', () => { clearTimeout(timer); resolve(); }); child.stdin.end();
  });
}
async function fixture(launch = true, legacy = false): Promise<ReaperFixture> {
  const { principal: p, orderId } = await orderFixture(db, 10000);
  const stageId = await enqueueStage(db.pool, { tenantId: p.tenantId, scopeType: 'ORDER', scopeId: orderId,
    name: 'PRODUCTION', inputHash: 'a'.repeat(64), deadlineAt: addSeconds(600) });
  const lease = (await claimStage(db.pool, id('worker'), ['PRODUCTION']))!; expect(lease.id).toBe(stageId);
  const instanceId = id('instance'); const runId = id('run');
  const root = join(db.cfg.runtimeRoot, 'agent-instances', instanceId, runId);
  const control = join(db.cfg.runtimeRoot, 'agent-control', instanceId);
  const durable = join(db.cfg.runtimeRoot, 'tests/reaper-durable', instanceId);
  const writable = ['home', 'work', 'tmp'].map(name => join(root, name));
  for (const path of [...writable, control, durable]) await mkdir(path, { recursive: true });
  await writeFile(join(writable[0]!, 'credential.txt'), 'synthetic-not-a-real-credential');
  await writeFile(join(durable, 'delivery.txt'), 'must-survive-instance-release');
  const child = launch ? spawn(process.execPath, ['-e', 'process.stdin.resume()'], { cwd: writable[1],
    shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] }) : null;
  if (child) await new Promise<void>((resolve, reject) => { child.once('spawn', resolve); child.once('error', reject); });
  const processRef = child ? `SYNTHETIC-REGISTERED:${child.pid}` : null;
  const manifest: CleanupBinding['manifest'] = { version: 'YPCC-NATIVE-LAUNCH-1', nonce: id('nonce'), instance_id: instanceId, run_id: runId,
    executable: process.execPath, executable_sha256: '2'.repeat(64), args: [], cwd: writable[1]!, environment: {}, read_only_paths: [],
    writable_paths: writable, virtualization: 'FORBIDDEN', shell_tools: 'DISABLED', network_origins: [], deadline_at: addSeconds(-60),
    launch_receipt_path: join(control, 'launch-receipt.json'), cleanup_receipt_path: join(control, 'native-cleanup.json') };
  const binding: CleanupBinding = { version: 'YPCC-CLEANUP-1', manifest, manifest_hash: hash(manifest),
    launcher_path: join(db.cfg.runtimeRoot, 'synthetic-not-a-native-launcher.exe'), launcher_sha256: '3'.repeat(64), mode: 'SYNTHETIC_PROTOCOL' };
  await insert(db.pool, 'agent_instances', { id: instanceId, tenant_id: p.tenantId, order_id: orderId, state: 'ACTIVE',
    workspace_ref: root, lease_expires_at: addSeconds(120), data: { state: 'ACTIVE' },
    private: legacy ? {} : { cleanup_protocol: 'YPCC-CLEANUP-1', ...(launch ? { cleanup_binding: binding } : {}) } });
  await insert(db.pool, 'agent_runs', { id: runId, tenant_id: p.tenantId, instance_id: instanceId, role: 'PRODUCTION', state: 'RUNNING',
    role_workspace_ref: writable[1], input_hash: lease.input_hash, runtime_process_ref: processRef, data: { state: 'RUNNING' },
    private: { stage_run_id: stageId, stage_fencing_token: lease.fencing_token,
      runtime_admission: { valid_until: addSeconds(-3600), launcher_sha256: binding.launcher_sha256 } } });
  await insert(db.pool, 'agent_capabilities', { id: id('cap'), token_hash: sha256(id('secret')), tenant_id: p.tenantId,
    instance_id: instanceId, run_id: runId, stage_run_id: stageId, stage_fencing_token: lease.fencing_token,
    instance_fencing_token: 1, snapshot_hash: lease.input_hash, expires_at: addSeconds(120) });
  const cleaner: DetachedCleaner = { release: async (frozen, registered): Promise<NativeCleanupReceipt> => {
    expect(registered).toBe(processRef); expect(frozen.manifest_hash).toBe(binding.manifest_hash);
    await stop(child);
    for (const path of writable) await removeInstanceTree(db.cfg, path, path);
    return { nonce: manifest.nonce, run_id: runId, process_ref: processRef ?? 'SYNTHETIC-NOT-STARTED',
      no_active_processes: true, credentials_removed: true, temporary_files_removed: true };
  } };
  const f = { p, orderId, stageId, lease, instanceId, runId, root, control, durable, child, binding, cleaner, links: [] as string[] };
  fixtures.push(f); return f;
}
async function expire(f: Awaited<ReturnType<typeof fixture>>): Promise<void> {
  await db.pool.query("UPDATE stage_runs SET lease_expires_at=now()-interval '1 second' WHERE id=$1", [f.stageId]);
}
async function request(f: Awaited<ReturnType<typeof fixture>>): Promise<void> {
  await expire(f); await transaction(db.pool, client => requestInstanceRelease(client, f.p.tenantId, f.instanceId, 'EXPIRED'));
}
it('reaps a registered orphan without its original Worker, revokes access and preserves unknown paid calls and durable delivery', async () => {
  const f = await fixture(); await expire(f);
  const submissionId = id('submission'); const inferenceId = id('inference');
  await insert(db.pool, 'provider_submissions', { id: submissionId, tenant_id: f.p.tenantId, stage_run_id: f.stageId,
    intent_key: id('intent'), input_hash: f.lease.input_hash, state: 'UNKNOWN', data: {} });
  await insert(db.pool, 'budget_reservations', { id: id('reserve'), tenant_id: f.p.tenantId, order_id: f.orderId,
    submission_id: submissionId, intent_key: id('intent'), amount_micro: 100, currency: 'CNY', rate_snapshot: {}, state: 'UNKNOWN' });
  await insert(db.pool, 'inference_requests', { id: inferenceId, tenant_id: f.p.tenantId, run_id: f.runId,
    intent_key: id('intent'), request_hash: f.lease.input_hash, state: 'UNKNOWN', reserved_micro: 50, scope_type: 'ORDER', scope_id: f.orderId, data: {} });
  const reaper = new InstanceReaper(db.pool, db.cfg, id('independent'), f.cleaner);
  expect(await reaper.scanOrphans()).toBe(1);
  expect((await db.pool.query('SELECT id FROM agent_capabilities WHERE instance_id=$1 AND revoked_at IS NULL', [f.instanceId])).rowCount).toBe(0);
  expect(await reaper.releaseOne(signal(), f.p.tenantId, f.instanceId)).toBe(true);
  expect(f.child?.exitCode).toBe(0); expect(await absent(f.root)).toBe(true); expect(await absent(f.control)).toBe(true);
  expect(await readFile(join(f.durable, 'delivery.txt'), 'utf8')).toBe('must-survive-instance-release');
  const receipt = (await db.pool.query('SELECT data,private FROM cleanup_receipts WHERE instance_id=$1', [f.instanceId])).rows[0];
  expect(receipt.data).toMatchObject({ state: 'RELEASED', processes_stopped: true, pending_provider_submission_ids: [submissionId] });
  expect(receipt.private.pending_inference_ids).toEqual([inferenceId]);
  expect((await db.pool.query('SELECT state,reserved_micro FROM inference_requests WHERE id=$1', [inferenceId])).rows[0]).toEqual({ state: 'UNKNOWN', reserved_micro: '50' });
  expect((await db.pool.query('SELECT state,amount_micro FROM budget_reservations WHERE submission_id=$1', [submissionId])).rows[0]).toEqual({ state: 'UNKNOWN', amount_micro: '100' });
  expect((await db.pool.query('SELECT state FROM agent_runs WHERE id=$1', [f.runId])).rows[0].state).toBe('UNKNOWN');
  expect(await reaper.releaseOne(signal(), f.p.tenantId, f.instanceId)).toBe(false);
});
it('refuses admin release and stale release events while the current role has a valid lease', async () => {
  const f = await fixture(); const reaper = new InstanceReaper(db.pool, db.cfg, id('reaper'), f.cleaner);
  await expect(transaction(db.pool, client => requestInstanceRelease(client, f.p.tenantId, f.instanceId, 'SUSPEND', 1)))
    .rejects.toMatchObject({ code: 'INSTANCE_STILL_ACTIVE' });
  await expect(transaction(db.pool, client => requestInstanceRelease(client, f.p.tenantId, f.instanceId, 'SUSPEND', 99)))
    .rejects.toMatchObject({ code: 'FENCING_CONFLICT' });
  await reaper.requestEvent({ id: id('event'), tenant_id: f.p.tenantId, aggregate_type: 'ReleaseRequested', aggregate_id: f.orderId,
    event_key: id('event'), payload: { instance_id: f.instanceId, reason: 'DELIVERED' }, attempts: 1, fencing_token: '1', lease_owner: 'test' });
  expect(await reaper.scanOrphans()).toBe(0); expect(await reaper.releaseOne(signal(), f.p.tenantId, f.instanceId)).toBe(false);
  expect(f.child?.exitCode).toBeNull();
  expect((await db.pool.query('SELECT revoked_at FROM agent_capabilities WHERE instance_id=$1', [f.instanceId])).rows[0].revoked_at).toBeNull();
});
it('lets only one live cleanup owner claim the same instance', async () => {
  const f = await fixture(); await request(f); const entered = latch(); const proceed = latch();
  const first = new InstanceReaper(db.pool, db.cfg, 'first', { release: async (...args) => { entered.resolve(); await proceed.promise; return f.cleaner.release(...args); } });
  const task = first.releaseOne(signal(), f.p.tenantId, f.instanceId); await entered.promise;
  try { expect(await new InstanceReaper(db.pool, db.cfg, 'second', f.cleaner).releaseOne(signal(), f.p.tenantId, f.instanceId)).toBe(false); }
  finally { proceed.resolve(); await task; }
  expect((await db.pool.query('SELECT count(*) AS n FROM cleanup_receipts WHERE instance_id=$1', [f.instanceId])).rows[0].n).toBe('1');
});
it('ignores an old cleanup completion after its lease expires and a new owner finishes', async () => {
  const f = await fixture(); await request(f); const entered = latch(); const proceed = latch();
  const first = new InstanceReaper(db.pool, db.cfg, 'old', { release: async (...args) => { entered.resolve(); await proceed.promise; return f.cleaner.release(...args); } });
  const task = first.releaseOne(signal(), f.p.tenantId, f.instanceId); await entered.promise;
  try {
    await db.pool.query("UPDATE agent_instances SET cleanup_lease_expires_at=now()-interval '1 second' WHERE id=$1", [f.instanceId]);
    expect(await new InstanceReaper(db.pool, db.cfg, 'new', f.cleaner).releaseOne(signal(), f.p.tenantId, f.instanceId)).toBe(true);
  } finally { proceed.resolve(); await task; }
  const rows = (await db.pool.query('SELECT fencing_token,private FROM cleanup_receipts WHERE instance_id=$1', [f.instanceId])).rows;
  expect(rows).toHaveLength(1); expect(rows[0]).toMatchObject({ fencing_token: '3', private: { cleanup_generation: '2' } });
});
it('records failed evidence immutably and retries under a new generation without changing the frozen binding', async () => {
  const f = await fixture(); await request(f);
  const forged: DetachedCleaner = { release: async (...args) => ({ ...await f.cleaner.release(...args), nonce: 'forged-nonce' }) };
  await new InstanceReaper(db.pool, db.cfg, 'bad-receipt', forged).releaseOne(signal(), f.p.tenantId, f.instanceId);
  expect((await db.pool.query('SELECT state FROM agent_instances WHERE id=$1', [f.instanceId])).rows[0].state).toBe('CLEANUP_FAILED');
  await expect(db.pool.query("UPDATE agent_instances SET private=private-'cleanup_binding' WHERE id=$1", [f.instanceId])).rejects.toThrow('cleanup binding is immutable');
  await expect(db.pool.query("UPDATE cleanup_receipts SET data='{}' WHERE instance_id=$1", [f.instanceId])).rejects.toThrow('immutable');
  await db.pool.query('UPDATE agent_instances SET cleanup_available_at=now() WHERE id=$1', [f.instanceId]);
  await new InstanceReaper(db.pool, db.cfg, 'retry', f.cleaner).releaseOne(signal(), f.p.tenantId, f.instanceId);
  expect((await db.pool.query('SELECT state FROM cleanup_receipts WHERE instance_id=$1 ORDER BY fencing_token', [f.instanceId])).rows)
    .toEqual([{ state: 'CLEANUP_FAILED' }, { state: 'RELEASED' }]);
});
it('fails closed for a legacy instance without a durable launch binding and leaves its process and files alone', async () => {
  const f = await fixture(true, true); await request(f);
  await new InstanceReaper(db.pool, db.cfg, 'legacy', f.cleaner).releaseOne(signal(), f.p.tenantId, f.instanceId);
  expect(await absent(f.root)).toBe(false);
  expect(f.child?.exitCode).toBeNull();
  expect((await db.pool.query('SELECT data FROM cleanup_receipts WHERE instance_id=$1', [f.instanceId])).rows[0].data.error_codes).toEqual(['CODEX_CLEANUP_BINDING_MISSING']);
});
it('rejects junction traversal and preserves data outside the registered run', async () => {
  const f = await fixture(false); await request(f);
  const link = join(f.root, 'work', 'escape'); await symlink(f.durable, link, 'junction'); f.links.push(link);
  await new InstanceReaper(db.pool, db.cfg, 'link-guard', f.cleaner).releaseOne(signal(), f.p.tenantId, f.instanceId);
  expect(await readFile(join(f.durable, 'delivery.txt'), 'utf8')).toBe('must-survive-instance-release');
  expect((await db.pool.query('SELECT data FROM cleanup_receipts WHERE instance_id=$1', [f.instanceId])).rows[0].data.error_codes).toEqual(['CODEX_PATH_REPARSE']);
});
it('reclaims a prepared but never launched run without requiring model credentials or admission renewal', async () => {
  const f = await fixture(false); await request(f);
  await new InstanceReaper(db.pool, db.cfg, 'never-launched').releaseOne(signal(), f.p.tenantId, f.instanceId);
  expect(await absent(f.root)).toBe(true);
  expect((await db.pool.query('SELECT state,private FROM cleanup_receipts WHERE instance_id=$1', [f.instanceId])).rows[0])
    .toMatchObject({ state: 'RELEASED', private: { mode: 'NOT_LAUNCHED' } });
});
it('does not certify full cleanup while a registered background tool is still running', async () => {
  const f = await fixture(); await request(f);
  await insert(db.pool, 'agent_tool_intents', { id: id('tool'), tenant_id: f.p.tenantId, order_id: f.orderId,
    subject_ref: f.p.userId, run_id: f.runId, stage_run_id: f.stageId, idempotency_key: id('intent'),
    request_hash: f.lease.input_hash, state: 'RUNNING', data: {} });
  await new InstanceReaper(db.pool, db.cfg, 'unfinished-tool', f.cleaner).releaseOne(signal(), f.p.tenantId, f.instanceId);
  expect((await db.pool.query('SELECT data FROM cleanup_receipts WHERE instance_id=$1', [f.instanceId])).rows[0].data)
    .toMatchObject({ state: 'CLEANUP_FAILED', error_codes: ['CLEANUP_TOOLS_UNRESOLVED'] });
});
it('refuses a mismatched workspace before invoking any process cleaner', async () => {
  const f = await fixture(); await request(f); let calls = 0;
  await db.pool.query('UPDATE agent_instances SET workspace_ref=$2 WHERE id=$1', [f.instanceId, f.durable]);
  const cleaner: DetachedCleaner = { release: async (...args) => { calls++; return f.cleaner.release(...args); } };
  await new InstanceReaper(db.pool, db.cfg, 'wrong-workspace', cleaner).releaseOne(signal(), f.p.tenantId, f.instanceId);
  expect(calls).toBe(0); expect(f.child?.exitCode).toBeNull();
  expect(await readFile(join(f.durable, 'delivery.txt'), 'utf8')).toBe('must-survive-instance-release');
});
it('rejects a control-directory junction before writing a release request or invoking the cleaner', async () => {
  const f = await fixture(); await request(f); let calls = 0;
  await rmdir(f.control); await symlink(f.durable, f.control, 'junction'); f.links.push(f.control);
  const cleaner: DetachedCleaner = { release: async (...args) => { calls++; return f.cleaner.release(...args); } };
  await new InstanceReaper(db.pool, db.cfg, 'control-junction', cleaner).releaseOne(signal(), f.p.tenantId, f.instanceId);
  expect(calls).toBe(0); expect(await absent(join(f.durable, 'release-request.json'))).toBe(true);
  expect(await readFile(join(f.durable, 'delivery.txt'), 'utf8')).toBe('must-survive-instance-release');
  expect((await db.pool.query('SELECT data FROM cleanup_receipts WHERE instance_id=$1', [f.instanceId])).rows[0].data.error_codes).toEqual(['CODEX_PATH_REPARSE']);
});
