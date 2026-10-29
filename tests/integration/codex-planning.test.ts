import { beforeAll, afterAll, afterEach, it, expect } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { testDatabase, type TestDatabase } from '../helpers/database.js';
import { planningFixture, syntheticSse } from '../helpers/codex.js';
import { buildApp } from '../../src/api/app.js';
import { CodexRuntimeAdapter, refreshRoleInstanceLease } from '../../src/worker/codex/runtime.js';
import { ContentPlanningService } from '../../src/worker/codex/planning.js';
import { FixtureLauncher } from '../helpers/role-launcher.js';
import { ToolConsumer } from '../../src/worker/tool-gateway/consumer.js';
import { contentTools,validatePlanningResult } from '../../src/worker/tool-gateway/content-tools.js';
import {basePlan} from '../../src/worker/compiler/plan.js';
import { claimStage, completeStage } from '../../src/worker/queue/leases.js';
import { validate } from '../../src/api/lib/validation.js';
import { id } from '../../src/api/lib/crypto.js';
import { insert } from '../../src/api/db/store.js';

let db: TestDatabase; let app: FastifyInstance | undefined; const running: { controller: AbortController; task: Promise<void> }[] = [];
beforeAll(async () => { db = await testDatabase(); });
afterEach(async () => {
  for (const item of running.splice(0)) { item.controller.abort(); await item.task; }
  await app?.close(); app = undefined;
  await db.pool.query("UPDATE stage_runs SET state='CANCELLED' WHERE state NOT IN ('SUCCEEDED','FAILED')");
});
afterAll(async () => { await db?.close(); });

it('rejects overlong painted copy before READY without creating a quote, role or paid submission',async()=>{
  const f=await planningFixture(db),plan=basePlan(f.profile,f.source);
  const rejected=[structuredClone(plan),structuredClone(plan),structuredClone(plan)];
  rejected[0]!.copy='蓝色带盖杯'.repeat(30);rejected[1]!.shots[0]!.intent='蓝色带盖杯'.repeat(30);
  rejected[2]!.shots[0]!.intent='治疗失眠';
  for(const [i,value] of rejected.entries()){
    await expect(validatePlanningResult(db.pool,f.p.tenantId,f.plan.plan_id,value)).rejects
      .toMatchObject({code:i===2?'UNSUPPORTED_CLAIM':'LAYOUT_TEXT_OVERFLOW'});
  }
  expect((await db.pool.query('SELECT state FROM plan_versions WHERE id=$1',[f.plan.plan_id])).rows[0].state).toBe('PLANNING');
  expect((await db.pool.query('SELECT id FROM quotes WHERE plan_id=$1',[f.plan.plan_id])).rowCount).toBe(0);
  expect((await db.pool.query('SELECT r.id FROM agent_runs r JOIN agent_instances i ON i.id=r.instance_id WHERE i.preview_session_id=$1',[f.plan.plan_id])).rowCount).toBe(0);
  expect((await db.pool.query('SELECT id FROM provider_submissions WHERE stage_run_id=$1',[f.lease.id])).rowCount).toBe(0);
});

it('renews the actual native instance lease within its bound parent and rejects takeover, expiry or release', async () => {
  const f = await planningFixture(db), instanceId = id('instance');
  await insert(db.pool, 'agent_instances', { id: instanceId, tenant_id: f.p.tenantId, preview_session_id: f.plan.plan_id,
    state: 'ACTIVE', workspace_ref: 'synthetic-heartbeat-no-process', lease_expires_at: new Date(Date.now() + 30000),
    data: { retained: 'original-instance' }, private: { stage_run_id: f.lease.id } });
  expect(await refreshRoleInstanceLease(db.pool, f.lease, instanceId)).toBe(true);
  const state = async () => (await db.pool.query<{lease_expires_at:Date;data:{lease_expires_at:string;retained:string}}>(
    'SELECT lease_expires_at,data FROM agent_instances WHERE id=$1', [instanceId])).rows[0]!;
  const renewed = await state(); const parent = (await db.pool.query<{lease_expires_at:Date}>(
    'SELECT lease_expires_at FROM stage_runs WHERE id=$1', [f.lease.id])).rows[0]!;
  expect(renewed.lease_expires_at).toEqual(parent.lease_expires_at);
  expect(renewed.data).toEqual({ retained: 'original-instance', lease_expires_at: renewed.lease_expires_at.toISOString() });
  expect(await refreshRoleInstanceLease(db.pool, {...f.lease,scope_id:id('different_plan')}, instanceId)).toBe(false);
  await db.pool.query('UPDATE stage_runs SET fencing_token=fencing_token+1 WHERE id=$1', [f.lease.id]);
  expect(await refreshRoleInstanceLease(db.pool, f.lease, instanceId)).toBe(false); expect(await state()).toEqual(renewed);
  const takeover = {...f.lease,fencing_token:String(Number(f.lease.fencing_token)+1)};
  await db.pool.query("UPDATE stage_runs SET lease_expires_at=now()-interval '1 second' WHERE id=$1", [f.lease.id]);
  expect(await refreshRoleInstanceLease(db.pool, takeover, instanceId)).toBe(false); expect(await state()).toEqual(renewed);
  await db.pool.query("UPDATE stage_runs SET lease_expires_at=now()+interval '30 seconds' WHERE id=$1", [f.lease.id]);
  await db.pool.query("UPDATE agent_instances SET state='RELEASED' WHERE id=$1", [instanceId]);
  expect(await refreshRoleInstanceLease(db.pool, takeover, instanceId)).toBe(false);
  await db.pool.query("UPDATE agent_instances SET state='ACTIVE',lease_expires_at=now()-interval '1 second' WHERE id=$1", [instanceId]);
  expect(await refreshRoleInstanceLease(db.pool, takeover, instanceId)).toBe(false);
});

async function setup(mode = 'NORMAL', failCleanup = false) {
  const f = await planningFixture(db); let inferences = 0;
  app = await buildApp({ cfg: f.cfg, pool: db.pool, inferenceHttp: async () => {
    inferences++; return { status: 200, headers: { 'content-type': 'text/event-stream' }, bytes: syntheticSse(f.admission), json: () => null };
  } });
  await app.listen({ host: '127.0.0.1', port: 0 }); const address = app.server.address();
  if (!address || typeof address === 'string') throw new Error('Missing synthetic HTTPS listener');
  f.cfg.publicBaseUrl = `https://localhost:${address.port}`;
  const controller = new AbortController(); const consumer = new ToolConsumer(db.pool, id('tools'), contentTools(db.pool));
  running.push({ controller, task: consumer.run(controller.signal) });
  const launcher = new FixtureLauncher(mode, failCleanup);
  const runtime = new CodexRuntimeAdapter(db.pool, f.cfg, launcher);
  const service = new ContentPlanningService(db.pool, f.cfg, runtime);
  return { ...f, launcher, service, inferences: () => inferences };
}
it('runs fresh stdio + real HTTPS MCP tools, commits a verified plan, and records separate cleanup proof', async () => {
  const f = await setup(); const commit = await f.service.handle(f.lease, new AbortController().signal);
  await completeStage(db.pool, f.lease, commit);
  const plan = (await db.pool.query('SELECT data,private FROM plan_versions WHERE id=$1', [f.plan.plan_id])).rows[0];
  expect(validate('Plan', plan.data, true).state).toBe('READY'); expect(plan.private.content_run_id).toBeTruthy();
  const run = (await db.pool.query('SELECT * FROM agent_runs WHERE id=$1', [plan.private.content_run_id])).rows[0];
  expect(validate('AgentRun', run.data, true)).toMatchObject({ state: 'SUCCEEDED', spend_confirmed_micro: 130, spend_reserved_micro: 0 });
  expect(run).toMatchObject({ state: 'SUCCEEDED', role: 'CONTENT', thread_id: expect.stringMatching(/^synthetic-fresh-thread-/), spent_micro: '130' });
  expect((await db.pool.query('SELECT state FROM agent_instances WHERE id=$1', [run.instance_id])).rows[0].state).toBe('RELEASED');
  const instance = (await db.pool.query('SELECT data FROM agent_instances WHERE id=$1', [run.instance_id])).rows[0];
  expect(validate('AgentInstance', instance.data, true).state).toBe('RELEASED');
  expect((await db.pool.query('SELECT data FROM cleanup_receipts WHERE instance_id=$1', [run.instance_id])).rows[0].data).toMatchObject({ processes_stopped: true, runtime_history_removed: true, capabilities_revoked: true });
  expect((await db.pool.query('SELECT id FROM agent_capabilities WHERE run_id=$1 AND revoked_at IS NULL', [run.id])).rowCount).toBe(0);
  expect((await db.pool.query('SELECT id FROM agent_tool_intents WHERE run_id=$1 AND state=\'SUCCEEDED\'', [run.id])).rowCount).toBe(3);
  expect(f.inferences()).toBe(1); expect(f.launcher.launches).toBe(1);
});
it('restores the persisted plan after a worker takeover without launching or buying another turn', async () => {
  const f = await setup(); await f.service.handle(f.lease, new AbortController().signal);
  await db.pool.query("UPDATE stage_runs SET lease_expires_at=now()-interval '1 second' WHERE id=$1", [f.lease.id]);
  const next = (await claimStage(db.pool, id('recovery'), ['PLAN']))!;
  expect(next.id).toBe(f.lease.id); expect(next.fencing_token).not.toBe(f.lease.fencing_token);
  const commit = await f.service.handle(next, new AbortController().signal); await completeStage(db.pool, next, commit);
  expect(f.inferences()).toBe(1); expect(f.launcher.launches).toBe(1);
  expect((await db.pool.query('SELECT state FROM plan_versions WHERE id=$1', [f.plan.plan_id])).rows[0].state).toBe('READY');
});
it.each(['SKIP_PERSIST', 'CHANGED_FINAL'])('blocks a completed RPC with an unpersisted or changed result: %s', async mode => {
  const f = await setup(mode);
  await expect(f.service.handle(f.lease, new AbortController().signal)).rejects.toMatchObject({ code: 'CODEX_RESULT_NOT_PERSISTED' });
  expect((await db.pool.query('SELECT state FROM plan_versions WHERE id=$1', [f.plan.plan_id])).rows[0].state).toBe('PLANNING');
  expect((await db.pool.query('SELECT state FROM agent_instances WHERE preview_session_id=$1', [f.plan.plan_id])).rows[0].state).toBe('RELEASED');
});
it.each(['EXTRA_SKILL', 'EXTRA_TOOL'])('rejects an unexpected runtime extension before inference: %s', async mode => {
  const f = await setup(mode);
  await expect(f.service.handle(f.lease, new AbortController().signal)).rejects.toMatchObject({ code: mode === 'EXTRA_SKILL' ? 'CODEX_SKILL_DISCOVERY_INVALID' : 'CODEX_MCP_DISCOVERY_INVALID' });
  expect(f.inferences()).toBe(0);
});
it('does not accept a protocol-only model claim without a settled inference receipt', async () => {
  const f = await setup('NO_INFERENCE');
  await expect(f.service.handle(f.lease, new AbortController().signal)).rejects.toMatchObject({ code: 'CODEX_INFERENCE_UNVERIFIED' });
  expect(f.inferences()).toBe(0);
});
it('keeps cleanup failure distinct from a completed content run', async () => {
  const f = await setup('NORMAL', true); const commit = await f.service.handle(f.lease, new AbortController().signal); await completeStage(db.pool, f.lease, commit);
  expect((await db.pool.query('SELECT state FROM plan_versions WHERE id=$1', [f.plan.plan_id])).rows[0].state).toBe('READY');
  expect((await db.pool.query('SELECT state FROM agent_instances WHERE preview_session_id=$1', [f.plan.plan_id])).rows[0].state).toBe('CLEANUP_FAILED');
  expect((await db.pool.query('SELECT data FROM cleanup_receipts WHERE tenant_id=$1', [f.p.tenantId])).rows[0].data).toMatchObject({ state: 'CLEANUP_FAILED', processes_stopped: false });
});
it('denies a new shell approval and stops before purchasing a model turn', async () => {
  const f = await setup('ASK_SHELL');
  await expect(f.service.handle(f.lease, new AbortController().signal)).rejects.toMatchObject({ code: 'CODEX_PERMISSION_VIOLATION' });
  expect(f.inferences()).toBe(0);
});
it('does not publish a plan if its product changes after the role completed', async () => {
  const f = await setup(); const commit = await f.service.handle(f.lease, new AbortController().signal);
  await db.pool.query('UPDATE product_drafts SET current_profile_id=NULL WHERE id=$1', [f.product.product_id]);
  await expect(completeStage(db.pool, f.lease, commit)).rejects.toMatchObject({ code: 'INPUT_VERSION_CHANGED' });
  expect((await db.pool.query('SELECT state FROM plan_versions WHERE id=$1', [f.plan.plan_id])).rows[0].state).toBe('PLANNING');
});
