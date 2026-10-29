import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { testDatabase, account, type TestDatabase } from '../helpers/database.js';
import { rawProfile, variant } from '../helpers/fixtures.js';
import { buildApp } from '../../src/api/app.js';
import { insert } from '../../src/api/db/store.js';
import { id, hash, sha256, addSeconds } from '../../src/api/lib/crypto.js';
import { createProduct } from '../../src/api/modules/products.js';
import { normalizeVision } from '../../src/worker/analysis/profile.js';
import { enqueueStage } from '../../src/worker/queue/enqueue.js';
import { claimStage } from '../../src/worker/queue/leases.js';
import { basePlan, creativePlanHash } from '../../src/worker/compiler/plan.js';
import { claimToolIntent, ToolConsumer } from '../../src/worker/tool-gateway/consumer.js';
import { contentTools } from '../../src/worker/tool-gateway/content-tools.js';

let db: TestDatabase; let app: FastifyInstance;
beforeAll(async () => { db = await testDatabase(); app = await buildApp({ cfg: db.cfg, pool: db.pool, tls: false }); await app.ready(); });
afterAll(async () => { await app?.close(); await db?.close(); });
async function fixture(maxCalls = 8) {
  const { principal: p } = await account(db); const product = await createProduct(db.pool, p); const photoId = id('photos');
  const { profile, identityLock } = normalizeVision(rawProfile(), { tenantId: p.tenantId, productId: product.product_id, photoVersion: 1, revision: 1, assetIds: ['asset-a', 'asset-b', 'asset-c'] });
  await insert(db.pool, 'product_photo_versions', { id: photoId, tenant_id: p.tenantId, product_id: product.product_id, revision: 1, photo_set_hash: 'a'.repeat(64), data: [] });
  await insert(db.pool, 'profile_versions', { id: profile.profile_id, tenant_id: p.tenantId, owner_id: p.userId, product_id: product.product_id, photo_version_id: photoId, revision: 1, profile_hash: profile.profile_hash, data: profile });
  await insert(db.pool, 'identity_locks', { id: identityLock.identity_lock_id, tenant_id: p.tenantId, profile_id: profile.profile_id, hash: identityLock.content_hash, data: identityLock });
  await db.pool.query('UPDATE product_drafts SET current_profile_id=$1,current_photo_version=1 WHERE id=$2', [profile.profile_id, product.product_id]);
  const planId = id('plan'); const source = variant();
  const request = { product_id: product.product_id, photo_version: 1, profile_id: profile.profile_id,
    identity_lock_id: identityLock.identity_lock_id, preset_id: 'minimal-clean', preset_version: '3.1.0',
    variant_id: source.variant_id, variant_version: source.version };
  await insert(db.pool, 'plan_versions', { id: planId, tenant_id: p.tenantId, owner_id: p.userId, product_id: product.product_id,
    photo_version_id: photoId, profile_id: profile.profile_id, identity_lock_id: identityLock.identity_lock_id, variant_version_id: 'minimal-clean.photo-layout.3.1.0', state: 'PLANNING', data: {}, private: { source, request } });
  const inputHash = hash({ profile: profile.profile_hash, source: source.variant_id, request });
  const stageId = await enqueueStage(db.pool, { tenantId: p.tenantId, scopeType: 'PLAN', scopeId: planId, name: 'PLAN', inputHash, deadlineAt: addSeconds(300) });
  const lease = (await claimStage(db.pool, id('parent'), ['PLAN']))!; expect(lease.id).toBe(stageId);
  const instanceId = id('instance'); const runId = id('run');
  await insert(db.pool, 'agent_instances', { id: instanceId, tenant_id: p.tenantId, preview_session_id: planId, state: 'ACTIVE', workspace_ref: 'synthetic-not-a-live-process', lease_expires_at: addSeconds(120), data: {} });
  await insert(db.pool, 'agent_runs', { id: runId, tenant_id: p.tenantId, instance_id: instanceId, role: 'CONTENT', state: 'RUNNING', role_workspace_ref: 'synthetic-not-a-live-process', input_hash: inputHash, data: {}, private: { max_tool_calls: maxCalls } });
  const capability = id('capability'); const capabilityId = id('cap');
  await insert(db.pool, 'agent_capabilities', { id: capabilityId, token_hash: sha256(capability), tenant_id: p.tenantId, instance_id: instanceId, run_id: runId, stage_run_id: stageId,
    stage_fencing_token: lease.fencing_token, instance_fencing_token: 1, snapshot_hash: inputHash, packet_hash: null, expires_at: addSeconds(120) });
  return { p, profile, source, planId, stageId, runId, capability, capabilityId, instanceId, lease, inputHash };
}
function call(capability: string, tool: string, args: unknown, key = id('request')) {
  return app.inject({ method: 'POST', url: '/v1/internal/p01/agent-tools/calls', headers: { authorization: `Bearer ${capability}` },
    payload: { tool, arguments: args, idempotency_key: key } });
}
async function stop(stageId: string) { await db.pool.query("UPDATE stage_runs SET state='CANCELLED' WHERE id=$1", [stageId]); }
describe('durable scoped tool execution', () => {
  it('claims once concurrently, skips locked work and preserves availability, handler and lease fences', async () => {
    const f = await fixture(); const calls: string[] = [];
    for (let i = 0; i < 3; i++) {
      const response = await call(f.capability, 'analyze_photos', {}); expect(response.statusCode).toBe(202);
      calls.push(response.json().intent_id as string);
    }
    const unsupported = await call(f.capability, 'validate_content_plan', { plan: basePlan(f.profile, f.source) });
    expect(unsupported.statusCode).toBe(202); const otherId = unsupported.json().intent_id as string;
    await db.pool.query(`UPDATE agent_tool_intents SET available_at=now()-interval '4 seconds' WHERE id=$1`, [calls[0]]);
    await db.pool.query(`UPDATE agent_tool_intents SET available_at=now()+interval '1 hour',state='UNKNOWN' WHERE id=$1`, [calls[1]]);
    await db.pool.query(`UPDATE agent_tool_intents SET available_at=now()-interval '3 seconds' WHERE id=$1`, [calls[2]]);
    await db.pool.query(`UPDATE agent_tool_intents SET available_at=now()-interval '5 seconds' WHERE id=$1`, [otherId]);
    const locked = await db.pool.connect();
    try {
      await locked.query('BEGIN');
      await locked.query('SELECT id FROM agent_tool_intents WHERE id=$1 FOR UPDATE', [calls[0]]);
      const owners = Array.from({ length: 6 }, () => id('tools'));
      const concurrent = await Promise.all(owners.map(owner => claimToolIntent(db.pool, owner, ['analyze_photos'])));
      const claimed = concurrent.filter(value => value !== null); expect(claimed).toHaveLength(1);
      expect(claimed[0]!.id).toBe(calls[2]); expect(BigInt(claimed[0]!.fencing_token)).toBe(1n);
      expect(claimed[0]!.lease_owner).toBe(owners[concurrent.findIndex(value => value !== null)]);
      expect(await claimToolIntent(db.pool, id('tools'), ['analyze_photos'])).toBeNull();
    } finally { await locked.query('ROLLBACK'); locked.release(); }
    const first = await claimToolIntent(db.pool, id('tools'), ['analyze_photos']); expect(first?.id).toBe(calls[0]);
    expect(await claimToolIntent(db.pool, id('tools'), ['analyze_photos'])).toBeNull();
    const preserved = (await db.pool.query('SELECT id,state,fencing_token FROM agent_tool_intents WHERE id=ANY($1) ORDER BY id', [[calls[1], otherId]])).rows;
    expect(preserved.find(row => row.id === calls[1])?.state).toBe('UNKNOWN');
    expect(preserved.find(row => row.id === otherId)?.state).toBe('QUEUED');
    expect(preserved.every(row => BigInt(row.fencing_token) === 0n)).toBe(true);
    await db.pool.query(`UPDATE agent_tool_intents SET lease_expires_at=now()-interval '1 second' WHERE id=$1`, [first!.id]);
    const replacement = await claimToolIntent(db.pool, id('replacement'), ['analyze_photos']); expect(replacement?.id).toBe(first!.id);
    expect(BigInt(replacement!.fencing_token)).toBe(2n); expect(replacement!.lease_owner).not.toBe(first!.lease_owner);
    const lease = (await db.pool.query(`SELECT state,extract(epoch FROM lease_expires_at-updated_at)::int AS duration
      FROM agent_tool_intents WHERE id=$1`, [replacement!.id])).rows[0];
    expect(lease).toEqual({ state: 'RUNNING', duration: 45 });
    await db.pool.query(`UPDATE agent_tool_intents SET available_at=now()-interval '1 second' WHERE id=$1`, [calls[1]]);
    expect((await claimToolIntent(db.pool, id('tools'), ['analyze_photos']))?.id).toBe(calls[1]);
    expect((await claimToolIntent(db.pool, id('tools'), ['validate_content_plan']))?.id).toBe(otherId);
    expect(await claimToolIntent(db.pool, id('tools'), [])).toBeNull();
    await db.pool.query("UPDATE agent_tool_intents SET state='CANCELLED',lease_owner=NULL,lease_expires_at=NULL WHERE run_id=$1", [f.runId]);
    await stop(f.stageId);
  });
  it('validates and persists a real structured plan without advancing the parent stage', async () => {
    const f = await fixture(); const consumer = new ToolConsumer(db.pool, id('tools'), contentTools(db.pool));
    const plan = basePlan(f.profile, f.source);
    for (const [tool, args] of [['analyze_photos', {}], ['validate_content_plan', { plan }], ['persist_stage_result', { result: plan }]] as const) {
      const submitted = await call(f.capability, tool, args); expect(submitted.statusCode).toBe(202);
      expect(await consumer.process(new AbortController().signal)).toBe(true);
      const row = (await db.pool.query('SELECT state,data FROM agent_tool_intents WHERE id=$1', [submitted.json().intent_id])).rows[0]; expect(row.state,`tool ${tool}: ${JSON.stringify(row.data)}`).toBe('SUCCEEDED');
    }
    const run = (await db.pool.query('SELECT output_hash,private FROM agent_runs WHERE id=$1', [f.runId])).rows[0];
    expect(run.output_hash).toBe(creativePlanHash(plan)); expect(run.private.stage_result).toEqual(plan);
    expect((await db.pool.query('SELECT state FROM stage_runs WHERE id=$1', [f.stageId])).rows[0].state).toBe('RUNNING');
    // Historical incomplete inputs must fail explicitly without replacing the
    // original plan or guessing a style from a variant identifier.
    await db.pool.query("UPDATE plan_versions SET private=private-'request' WHERE id=$1", [f.planId]);
    const missingInput = await call(f.capability, 'analyze_photos', {}); expect(missingInput.statusCode).toBe(202);
    expect(await consumer.process(new AbortController().signal)).toBe(true);
    const rejected = (await db.pool.query('SELECT state,data FROM agent_tool_intents WHERE id=$1', [missingInput.json().intent_id])).rows[0];
    expect(rejected.state).toBe('FAILED'); expect(rejected.data.error_code).toBe('PLAN_INPUT_CHANGED');
    expect((await db.pool.query('SELECT output_hash,private FROM agent_runs WHERE id=$1', [f.runId])).rows[0]).toEqual(run);
    expect((await db.pool.query('SELECT state FROM stage_runs WHERE id=$1', [f.stageId])).rows[0].state).toBe('RUNNING');
    await stop(f.stageId);
  });
  it('rechecks revocation before invoking a queued tool', async () => {
    const f = await fixture(); const submitted = await call(f.capability, 'analyze_photos', {}); expect(submitted.statusCode).toBe(202);
    await db.pool.query('UPDATE agent_capabilities SET revoked_at=now() WHERE id=$1', [f.capabilityId]);
    let executed = false;
    await new ToolConsumer(db.pool, id('tools'), { analyze_photos: async () => { executed = true; return { result: {} }; } }).process(new AbortController().signal);
    expect(executed).toBe(false); expect((await db.pool.query('SELECT state FROM agent_tool_intents WHERE id=$1', [submitted.json().intent_id])).rows[0].state).toBe('CANCELLED');
    await stop(f.stageId);
  });
  it('rejects completion after the stage fence changes while a tool is executing', async () => {
    const f = await fixture(); const submitted = await call(f.capability, 'analyze_photos', {}); let committed = false;
    await new ToolConsumer(db.pool, id('tools'), { analyze_photos: async () => {
      await db.pool.query('UPDATE stage_runs SET fencing_token=fencing_token+1 WHERE id=$1', [f.stageId]);
      return { result: { stale: true }, commit: async () => { committed = true; } };
    } }).process(new AbortController().signal);
    expect(committed).toBe(false); expect((await db.pool.query('SELECT state FROM agent_tool_intents WHERE id=$1', [submitted.json().intent_id])).rows[0].state).toBe('CANCELLED');
    await stop(f.stageId);
  });
  it('enforces one run-wide call quota across concurrent capabilities', async () => {
    const f = await fixture(2); const second = id('capability');
    await insert(db.pool, 'agent_capabilities', { id: id('cap'), token_hash: sha256(second), tenant_id: f.p.tenantId, instance_id: f.instanceId, run_id: f.runId, stage_run_id: f.stageId,
      stage_fencing_token: f.lease.fencing_token, instance_fencing_token: 1, snapshot_hash: f.inputHash, packet_hash: null, expires_at: addSeconds(120) });
    const results = await Promise.all(Array.from({ length: 4 }, (_, i) => call(i % 2 ? second : f.capability, 'analyze_photos', {})));
    expect(results.map(r => r.statusCode).sort()).toEqual([202, 202, 422, 422]);
    expect((await db.pool.query('SELECT id FROM agent_tool_intents WHERE run_id=$1', [f.runId])).rows).toHaveLength(2);
    // These requests are deliberately unexecuted; the revocation test above
    // proves queued calls cannot retain authority after the parent ends.
    await db.pool.query("UPDATE agent_tool_intents SET state='CANCELLED' WHERE run_id=$1", [f.runId]); await stop(f.stageId);
  });
});
