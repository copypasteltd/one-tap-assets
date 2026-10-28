import { beforeAll, afterAll, afterEach, it, expect } from 'vitest';
import type { FastifyInstance } from 'fastify';
import sharp from 'sharp';
import { testDatabase, type TestDatabase } from '../helpers/database.js';
import { mediaFixture } from '../helpers/media.js';
import { syntheticSse } from '../helpers/codex.js';
import { FixtureLauncher } from '../helpers/role-launcher.js';
import { buildApp } from '../../src/api/app.js';
import { storage, type ObjectStorage } from '../../src/api/storage/storage.js';
import { insert } from '../../src/api/db/store.js';
import { hash, id, sha256, addSeconds } from '../../src/api/lib/crypto.js';
import { CodexRuntimeAdapter } from '../../src/worker/codex/runtime.js';
import { MediaStageService } from '../../src/worker/codex/media-stage.js';
import { ToolConsumer } from '../../src/worker/tool-gateway/consumer.js';
import { productionTools } from '../../src/worker/tool-gateway/production-tools.js';
import { claimStage, completeStage, heartbeatStage, type StageLease } from '../../src/worker/queue/leases.js';
import { executionContext } from '../../src/worker/compiler/order-context.js';
import { enqueueStage } from '../../src/worker/queue/enqueue.js';

let db: TestDatabase; let app: FastifyInstance | undefined; const running: { controller: AbortController; task: Promise<void> }[] = [];
beforeAll(async () => { db = await testDatabase(); });
afterEach(async () => {
  for (const item of running.splice(0)) { item.controller.abort(); await item.task; }
  await app?.close(); app = undefined;
  await db.pool.query("UPDATE stage_runs SET state='CANCELLED' WHERE state NOT IN ('SUCCEEDED','FAILED')");
  await db.pool.query("UPDATE agent_tool_intents SET state='CANCELLED' WHERE state IN ('QUEUED','UNKNOWN','RUNNING')");
  await db.pool.query('UPDATE agent_capabilities SET revoked_at=COALESCE(revoked_at,now())');
});
afterAll(async () => { await db?.close(); });
async function setup(mode = 'NORMAL') {
  const f = await mediaFixture(db); let inferences = 0;
  app = await buildApp({ cfg: f.cfg, pool: db.pool, inferenceHttp: async () => {
    inferences++; return { status: 200, headers: { 'content-type': 'text/event-stream' }, bytes: syntheticSse(f.admission), json: () => null };
  } });
  await app.listen({ host: '127.0.0.1', port: 0 }); const address = app.server.address();
  if (!address || typeof address === 'string') throw new Error('Missing synthetic HTTPS listener');
  f.cfg.publicBaseUrl = `https://localhost:${address.port}`;
  const controller = new AbortController(); const consumer = new ToolConsumer(db.pool, id('tools'), productionTools(db.pool, f.cfg, f.store));
  running.push({ controller, task: consumer.run(controller.signal) });
  const launcher = new FixtureLauncher(mode); const runtime = new CodexRuntimeAdapter(db.pool, f.cfg, launcher);
  const service = new MediaStageService(db.pool, f.cfg, runtime);
  const handle = async (lease: StageLease) => {
    const role = new AbortController(); let pending: Promise<void> | null = null; let failure: unknown;
    const pulse = setInterval(() => {
      if (pending || role.signal.aborted) return;
      pending = heartbeatStage(db.pool, lease).then(ok => { if (!ok) throw new Error('Fixture lease was lost'); })
        .catch(error => { failure = error; role.abort(); }).finally(() => { pending = null; });
    }, 5000);
    try {
      const result = await service.handle(lease, role.signal); clearInterval(pulse); if (pending) await pending;
      if (failure) throw failure; return result;
    } catch (error) {
      const tools = (await db.pool.query("SELECT tool_name,state,data->>'error_code' AS error_code FROM agent_tool_intents WHERE stage_run_id=$1 ORDER BY created_at", [lease.id])).rows;
      if (error instanceof Error) error.message += `; synthetic media tool states: ${JSON.stringify({ tools })}`;
      throw error;
    } finally { clearInterval(pulse); if (pending) await pending; }
  };
  return { ...f, launcher, service, handle, inferences: () => inferences };
}
it('executes two fresh protocol roles through HTTPS/MCP, preserves original photos and explicitly posts the whole private pack', async () => {
  const f = await setup(); expect(await claimStage(db.pool, id('early'), ['POST'])).toBeNull();
  // Editing the current draft cannot alter an already sold immutable version.
  await db.pool.query('UPDATE product_drafts SET current_profile_id=NULL WHERE id=$1', [f.product.product_id]);
  await completeStage(db.pool, f.lease, await f.handle(f.lease));
  const post = (await claimStage(db.pool, id('post'), ['POST']))!;
  await completeStage(db.pool, post, await f.handle(post));
  expect(f.launcher.launches).toBe(2); expect(f.inferences()).toBe(2);
  const rows = (await db.pool.query('SELECT * FROM artifacts WHERE order_id=$1 ORDER BY slot_id', [f.orderId])).rows;
  const production = rows.filter(r => r.spec_json.phase === 'PRODUCTION'); const final = rows.filter(r => r.spec_json.phase === 'POST');
  expect(final).toHaveLength(f.snapshot.outputs.length); expect(production).toHaveLength(final.length - 1);
  for (const row of final) {
    const bytes = await f.store.get(row.object_key); expect(sha256(bytes)).toBe(row.sha256);
    if (row.spec_json.kind === 'image') {
      const slot = f.snapshot.outputs.find(s => s.slot_id === row.slot_id)!; const meta = await sharp(bytes).metadata();
      expect(meta).toMatchObject({ format: 'png', width: slot.width, height: slot.height }); expect(meta.exif).toBeUndefined();
      const pixel = await sharp(bytes).extract({ left: Math.floor(meta.width! / 2), top: Math.floor(meta.height! / 2), width: 1, height: 1 }).removeAlpha().raw().toBuffer();
      expect([...pixel]).toEqual([38, 117, 164]);
    } else if (row.spec_json.kind === 'video') {
      expect(row.spec_json.inspection).toMatchObject({ width: 1080, height: 1920, codec: 'h264', pixelFormat: 'yuv420p', fps: 30, frames: 30, hasAudio: false });
    } else expect(bytes.toString('utf8')).toBe(f.contract.creative.copy);
    if (row.spec_json.kind !== 'copy') expect(row.spec_json.source_artifact_ids).toEqual([production.find(a => a.slot_id === row.slot_id).id]);
  }
  expect((await db.pool.query('SELECT spent_micro,reserved_micro FROM orders WHERE id=$1', [f.orderId])).rows[0]).toEqual({ spent_micro: '260', reserved_micro: '0' });
  expect((await db.pool.query('SELECT id FROM delivery_manifests WHERE order_id=$1', [f.orderId])).rowCount).toBe(0);
  expect((await db.pool.query("SELECT state FROM agent_instances WHERE order_id=$1", [f.orderId])).rows.every(r => r.state === 'RELEASED')).toBe(true);
  await expect(db.pool.query("UPDATE artifacts SET sha256=$2 WHERE id=$1", [final[0].id, '0'.repeat(64)])).rejects.toThrow('artifact content is immutable');
});
it('blocks post-production if a previously checked private artifact changes', async () => {
  const f = await setup(); await completeStage(db.pool, f.lease, await f.handle(f.lease));
  const artifact = (await db.pool.query("SELECT object_key FROM artifacts WHERE order_id=$1 AND spec_json->>'kind'='image' LIMIT 1", [f.orderId])).rows[0];
  await f.store.put(artifact.object_key, Buffer.from('Synthetic storage corruption'), 'image/png');
  const post = (await claimStage(db.pool, id('post'), ['POST']))!;
  await expect(f.handle(post)).rejects.toThrow();
  const result = (await db.pool.query("SELECT data FROM agent_tool_intents WHERE order_id=$1 AND tool_name='execute_post_plan'", [f.orderId])).rows[0];
  expect(result.data.error_code).toBe('ARTIFACT_HASH_MISMATCH');
  expect((await db.pool.query("SELECT id FROM artifacts WHERE order_id=$1 AND spec_json->>'phase'='POST'", [f.orderId])).rowCount).toBe(0);
});
it('restores a succeeded media role after parent takeover without a second model turn or render', async () => {
  const f = await setup(); await f.handle(f.lease);
  const before = (await db.pool.query('SELECT id,sha256 FROM artifacts WHERE order_id=$1 ORDER BY id', [f.orderId])).rows;
  await db.pool.query("UPDATE stage_runs SET lease_expires_at=now()-interval '1 second' WHERE id=$1", [f.lease.id]);
  const next = (await claimStage(db.pool, id('recovered'), ['PRODUCTION']))!;
  await expect(completeStage(db.pool, f.lease, async () => {})).rejects.toMatchObject({ code: 'LEASE_LOST' });
  await completeStage(db.pool, next, await f.handle(next));
  expect(f.launcher.launches).toBe(1); expect(f.inferences()).toBe(1);
  expect((await db.pool.query('SELECT id,sha256 FROM artifacts WHERE order_id=$1 ORDER BY id', [f.orderId])).rows).toEqual(before);
});
it.each(['MEDIA_MISSING_SLOT', 'MEDIA_WRONG_PROOF', 'MEDIA_SKIP_INSPECT'])('rejects a plausible agent result with incomplete outputs or invented proof: %s', async mode => {
  const f = await setup(mode); await expect(f.handle(f.lease)).rejects.toThrow();
  const failure = (await db.pool.query("SELECT data FROM agent_tool_intents WHERE order_id=$1 AND tool_name='persist_stage_result'", [f.orderId])).rows[0];
  expect(failure.data.error_code).toBe(mode === 'MEDIA_MISSING_SLOT' ? 'MEDIA_OUTPUT_INCOMPLETE' : 'MEDIA_TOOL_PROOF_MISSING');
  expect((await db.pool.query('SELECT id FROM delivery_manifests WHERE order_id=$1', [f.orderId])).rowCount).toBe(0);
});
it('rejects a mutated sold plan before starting a process or buying inference', async () => {
  const f = await setup();
  await db.pool.query("UPDATE orders SET private=jsonb_set(private,'{contract,creative,title}','\"未经冻结的新标题\"') WHERE id=$1", [f.orderId]);
  await expect(f.handle(f.lease)).rejects.toMatchObject({ code: 'EXECUTION_CONTRACT_MISMATCH' });
  expect(f.launcher.launches).toBe(0); expect(f.inferences()).toBe(0);
});
async function scopedRun(f: Awaited<ReturnType<typeof mediaFixture>>, maxScope = 24) {
  const instanceId = id('synthetic-instance'); const runId = id('synthetic-run'); const capability = id('synthetic-cap');
  await insert(db.pool, 'agent_instances', { id: instanceId, tenant_id: f.p.tenantId, order_id: f.orderId, state: 'ACTIVE',
    workspace_ref: 'SYNTHETIC-NO-PROCESS', lease_expires_at: addSeconds(120), data: {} });
  await insert(db.pool, 'agent_runs', { id: runId, tenant_id: f.p.tenantId, instance_id: instanceId, role: 'PRODUCTION', state: 'RUNNING',
    role_workspace_ref: 'SYNTHETIC-NO-PROCESS', input_hash: f.snapshotHash, data: { skill_bundle_hash: f.snapshot.codex_contract.skill_bundle_hash },
    private: { stage_run_id: f.lease.id, stage_fencing_token: f.lease.fencing_token, max_tool_calls: 24, max_scope_tool_calls: maxScope,
      allowed_tools: ['render_photo_pack', 'inspect_actual_media', 'persist_stage_result'] } });
  await insert(db.pool, 'agent_capabilities', { id: id('cap'), token_hash: sha256(capability), tenant_id: f.p.tenantId, instance_id: instanceId, run_id: runId,
    stage_run_id: f.lease.id, stage_fencing_token: f.lease.fencing_token, instance_fencing_token: 1, snapshot_hash: f.snapshotHash, expires_at: addSeconds(120) });
  return { runId, capability };
}
async function submit(capability: string, snapshotHash: string) {
  return app!.inject({ method: 'POST', url: '/v1/internal/p01/agent-tools/calls', headers: { authorization: `Bearer ${capability}` },
    payload: { tool: 'render_photo_pack', arguments: { snapshot_hash: snapshotHash }, idempotency_key: id('call') } });
}
it('recovers the original private receipt after storage succeeded but the tool transaction did not', async () => {
  const f = await mediaFixture(db); const run = await scopedRun(f); app = await buildApp({ cfg: f.cfg, pool: db.pool });
  let failOnce = true; let videoWrites = 0;
  const wrapped: ObjectStorage = { get: (...a) => f.store.get(...a), exists: key => f.store.exists(key), delete: key => f.store.delete(key),
    put: async (key, bytes, mime) => { await f.store.put(key, bytes, mime); if (key.endsWith('.mp4')) videoWrites++;
      if (key.endsWith('.json') && failOnce) { failOnce = false; throw new Error('Synthetic crash after durable receipt'); } } };
  const consumer = new ToolConsumer(db.pool, id('tools'), productionTools(db.pool, f.cfg, wrapped));
  const first = await submit(run.capability, f.snapshotHash); expect(first.statusCode).toBe(202);
  await consumer.process(new AbortController().signal);
  expect((await db.pool.query('SELECT state FROM agent_tool_intents WHERE id=$1', [first.json().intent_id])).rows[0].state).toBe('FAILED');
  expect((await db.pool.query('SELECT id FROM artifacts WHERE order_id=$1', [f.orderId])).rowCount).toBe(0);
  const second = await submit(run.capability, f.snapshotHash); expect(second.statusCode).toBe(202);
  await consumer.process(new AbortController().signal);
  expect((await db.pool.query('SELECT state FROM agent_tool_intents WHERE id=$1', [second.json().intent_id])).rows[0].state).toBe('SUCCEEDED');
  expect(videoWrites).toBe(1);
  expect((await db.pool.query('SELECT state,generation FROM media_operations WHERE order_id=$1', [f.orderId])).rows[0]).toEqual({ state: 'READY', generation: 1 });
});
it('does not expose artifacts if the parent lease expires after the media receipt was stored', async () => {
  const f = await mediaFixture(db); const run = await scopedRun(f); app = await buildApp({ cfg: f.cfg, pool: db.pool });
  const wrapped: ObjectStorage = { get: (...a) => f.store.get(...a), exists: key => f.store.exists(key), delete: key => f.store.delete(key),
    put: async (key, bytes, mime) => { await f.store.put(key, bytes, mime);
      if (key.endsWith('.json')) await db.pool.query("UPDATE stage_runs SET lease_expires_at=now()-interval '1 second' WHERE id=$1", [f.lease.id]); } };
  const consumer = new ToolConsumer(db.pool, id('tools'), productionTools(db.pool, f.cfg, wrapped));
  const first = await submit(run.capability, f.snapshotHash); await consumer.process(new AbortController().signal);
  expect((await db.pool.query('SELECT state FROM agent_tool_intents WHERE id=$1', [first.json().intent_id])).rows[0].state).toBe('CANCELLED');
  expect((await db.pool.query('SELECT id FROM artifacts WHERE order_id=$1', [f.orderId])).rowCount).toBe(0);
});
it('shares the original tool-call allowance across separate role runs', async () => {
  const f = await mediaFixture(db); const firstRun = await scopedRun(f, 1);
  await enqueueStage(db.pool, { tenantId: f.p.tenantId, scopeType: 'ORDER', scopeId: f.orderId, name: 'PRODUCTION', attempt: 2,
    inputHash: f.snapshotHash, deadlineAt: f.snapshot.deadline_at, jobId: f.lease.job_id! });
  const retry = (await claimStage(db.pool, id('retry'), ['PRODUCTION']))!;
  const secondRun = await scopedRun({ ...f, lease: retry }, 1);
  app = await buildApp({ cfg: f.cfg, pool: db.pool });
  expect((await submit(firstRun.capability, f.snapshotHash)).statusCode).toBe(202);
  const refused = await submit(secondRun.capability, f.snapshotHash); expect(refused.statusCode).toBe(422);
  expect(refused.json().code).toBe('TOOL_SCOPE_LIMIT_EXCEEDED');
});
it('checks original photo bytes rather than trusting the asset record', async () => {
  const f = await mediaFixture(db); const run = await scopedRun(f); app = await buildApp({ cfg: f.cfg, pool: db.pool });
  const asset = (await db.pool.query('SELECT object_key FROM assets WHERE id=$1', [f.assetIds[0]])).rows[0];
  await f.store.put(asset.object_key, Buffer.from('corrupt original'), 'image/png');
  const request = await submit(run.capability, f.snapshotHash);
  await new ToolConsumer(db.pool, id('tools'), productionTools(db.pool, f.cfg, storage(f.cfg))).process(new AbortController().signal);
  expect((await db.pool.query('SELECT data FROM agent_tool_intents WHERE id=$1', [request.json().intent_id])).rows[0].data.error_code).toBe('INPUT_HASH_MISMATCH');
  expect((await db.pool.query('SELECT id FROM artifacts WHERE order_id=$1', [f.orderId])).rowCount).toBe(0);
  expect((await executionContext(db.pool, f.p.tenantId, f.orderId, f.snapshotHash)).snapshotHash).toBe(hash(f.snapshot));
});
