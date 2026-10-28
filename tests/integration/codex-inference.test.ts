import { beforeAll, afterAll, afterEach, it, expect } from 'vitest';
import { testDatabase, type TestDatabase } from '../helpers/database.js';
import { runningContentFixture, syntheticSse } from '../helpers/codex.js';
import { InferenceGateway, type InferenceHttp } from '../../src/worker/codex/inference.js';
import { storage, type ObjectStorage } from '../../src/api/storage/storage.js';
import { AppError } from '../../src/api/lib/errors.js';
import { reconcileUncertainObjectWrites } from '../../src/api/storage/private-objects.js';

let db: TestDatabase;
beforeAll(async () => { db = await testDatabase(); });
afterEach(async () => { await db.pool.query("UPDATE stage_runs SET state='CANCELLED' WHERE state NOT IN ('SUCCEEDED','FAILED')"); });
afterAll(async () => { await db?.close(); });
it('enforces the original per-role request allowance as well as the whole scope allowance', async () => {
  const f = await runningContentFixture(db); let calls = 0;
  await db.pool.query(`UPDATE agent_runs SET private=jsonb_set(private,'{inference_limits,max_requests_per_role}','1') WHERE id=$1`, [f.runId]);
  const gateway = new InferenceGateway(db.pool, f.cfg, storage(f.cfg), async () => {
    calls++; return { status: 200, headers: { 'content-type': 'text/event-stream' }, bytes: syntheticSse(f.admission), json: () => null };
  });
  await gateway.respond(`Bearer ${f.capability}`, f.body);
  await expect(gateway.respond(`Bearer ${f.capability}`, { ...f.body, instructions: 'A distinct synthetic request.' })).rejects.toMatchObject({ code: 'CODEX_ROLE_INFERENCE_LIMIT' });
  expect(calls).toBe(1);
});
it('meters a scoped response once and replays its original receipt without purchasing inference again', async () => {
  const f = await runningContentFixture(db); let calls = 0;
  const bytes = syntheticSse(f.admission);
  const http: InferenceHttp = async (_url, _hosts, options) => {
    calls++; expect(options!.headers!.Authorization).toBe(`Bearer ${f.cfg.codex.apiKey}`);
    expect(JSON.parse(String(options!.body)).max_output_tokens).toBe(2000);
    return { status: 200, headers: { 'content-type': 'text/event-stream' }, bytes, json: () => { throw new Error('Not a JSON response'); } };
  };
  const gateway = new InferenceGateway(db.pool, f.cfg, storage(f.cfg), http);
  expect(await gateway.respond(`Bearer ${f.capability}`, f.body)).toEqual(bytes);
  expect(await gateway.respond(`Bearer ${f.capability}`, f.body)).toEqual(bytes); expect(calls).toBe(1);
  const cost = (await db.pool.query('SELECT spent_micro,reserved_micro FROM platform_cost_accounts WHERE tenant_id=$1', [f.p.tenantId])).rows[0];
  expect(cost).toMatchObject({ spent_micro: '130', reserved_micro: '0' });
  expect((await db.pool.query('SELECT spent_micro FROM agent_runs WHERE id=$1', [f.runId])).rows[0].spent_micro).toBe('130');
});
it('holds an UNKNOWN request and blocks both exact replay and a changed request from repurchasing', async () => {
  const f = await runningContentFixture(db); let calls = 0;
  const gateway = new InferenceGateway(db.pool, f.cfg, storage(f.cfg), async () => { calls++; throw new AppError('REMOTE_UNKNOWN', 'Synthetic connection loss', 503); });
  await expect(gateway.respond(`Bearer ${f.capability}`, f.body)).rejects.toMatchObject({ code: 'REMOTE_UNKNOWN' });
  await expect(gateway.respond(`Bearer ${f.capability}`, f.body)).rejects.toMatchObject({ code: 'CODEX_INFERENCE_UNKNOWN' });
  await expect(gateway.respond(`Bearer ${f.capability}`, { ...f.body, input: ['changed context'] })).rejects.toMatchObject({ code: 'CODEX_INFERENCE_UNKNOWN' });
  expect(calls).toBe(1);
  expect((await db.pool.query('SELECT state FROM inference_requests WHERE run_id=$1', [f.runId])).rows[0].state).toBe('UNKNOWN');
  expect(Number((await db.pool.query('SELECT reserved_micro FROM platform_cost_accounts WHERE tenant_id=$1', [f.p.tenantId])).rows[0].reserved_micro)).toBeGreaterThan(0);
});
it('recovers the original private receipt after an object-write/database gap', async () => {
  const f = await runningContentFixture(db); const original = storage(f.cfg); let crash = true; let calls = 0;
  const store: ObjectStorage = { get: (...args) => original.get(...args), exists: key => original.exists(key), delete: key => original.delete(key),
    put: async (...args) => { await original.put(...args); if (crash) { crash = false; throw new Error('Synthetic crash after durable receipt'); } } };
  const bytes = syntheticSse(f.admission);
  const gateway = new InferenceGateway(db.pool, f.cfg, store, async () => { calls++; return { status: 200, headers: { 'content-type': 'text/event-stream' }, bytes, json: () => null }; });
  await expect(gateway.respond(`Bearer ${f.capability}`, f.body)).rejects.toThrow('Synthetic crash');
  expect(await gateway.respond(`Bearer ${f.capability}`, f.body)).toEqual(bytes); expect(calls).toBe(1);
  const row = (await db.pool.query('SELECT state,actual_micro,data FROM inference_requests WHERE run_id=$1', [f.runId])).rows[0];
  expect(row).toMatchObject({ state: 'SUCCEEDED', actual_micro: '130' }); expect(row.data.receipt_sha256).toMatch(/^[a-f0-9]{64}$/);
});
it('reconciles a durable receipt after retirement without credentials, a capability, or another purchase', async () => {
  const f = await runningContentFixture(db); let calls = 0; const store = storage(f.cfg);
  await db.pool.query(`CREATE FUNCTION fixture_reject_settlement() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN RAISE EXCEPTION 'synthetic settlement crash'; END $$;
    CREATE TRIGGER fixture_reject_settlement BEFORE UPDATE ON inference_requests
    FOR EACH ROW WHEN (NEW.state='SUCCEEDED') EXECUTE FUNCTION fixture_reject_settlement()`);
  try {
    const gateway = new InferenceGateway(db.pool, f.cfg, store, async () => {
      calls++; return { status: 200, headers: { 'content-type': 'text/event-stream' }, bytes: syntheticSse(f.admission), json: () => null };
    });
    await expect(gateway.respond(`Bearer ${f.capability}`, f.body)).rejects.toThrow('synthetic settlement crash');
  } finally { await db.pool.query('DROP TRIGGER fixture_reject_settlement ON inference_requests; DROP FUNCTION fixture_reject_settlement()'); }
  await db.pool.query('UPDATE agent_capabilities SET revoked_at=now() WHERE run_id=$1', [f.runId]);
  await db.pool.query("UPDATE agent_instances SET state='RELEASED' WHERE id=$1", [f.instanceId]);
  const cfg = { ...f.cfg, codex: { ...f.cfg.codex, enabled: false, apiKey: '', model: 'changed-current-model' } };
  const maintenance = new InferenceGateway(db.pool, cfg, store, async () => { throw new Error('Maintenance must not purchase inference'); });
  expect(await maintenance.reconcileReceipts()).toEqual({ settled: 1, blocked: 0 });
  expect(await maintenance.reconcileReceipts()).toEqual({ settled: 0, blocked: 0 });
  expect(calls).toBe(1);
  expect((await db.pool.query('SELECT state,actual_micro FROM inference_requests WHERE run_id=$1', [f.runId])).rows[0]).toEqual({ state: 'SUCCEEDED', actual_micro: '130' });
  expect((await db.pool.query('SELECT spent_micro,reserved_micro FROM platform_cost_accounts WHERE tenant_id=$1', [f.p.tenantId])).rows[0]).toEqual({ spent_micro: '130', reserved_micro: '0' });
});
it('recovers the original uncertain receipt and settles it after the producing role is retired', async () => {
  const f = await runningContentFixture(db); const original = storage(f.cfg); let calls = 0;
  const store: ObjectStorage = { get: original.get.bind(original), exists: original.exists.bind(original), delete: original.delete.bind(original),
    put: async (...args) => { await original.put(...args); throw new Error('synthetic crash after receipt publication'); } };
  const gateway = new InferenceGateway(db.pool, f.cfg, store, async () => {
    calls++; return { status: 200, headers: { 'content-type': 'text/event-stream' }, bytes: syntheticSse(f.admission), json: () => null };
  });
  await expect(gateway.respond(`Bearer ${f.capability}`, f.body)).rejects.toThrow('after receipt publication');
  await db.pool.query('UPDATE agent_capabilities SET revoked_at=now() WHERE run_id=$1', [f.runId]);
  await db.pool.query("UPDATE agent_instances SET state='RELEASED' WHERE id=$1", [f.instanceId]);
  expect((await reconcileUncertainObjectWrites(db.pool, original)).recovered).toBeGreaterThanOrEqual(1);
  expect(await gateway.reconcileReceipts()).toEqual({ settled: 1, blocked: 0 }); expect(calls).toBe(1);
  expect((await db.pool.query('SELECT spent_micro,reserved_micro FROM platform_cost_accounts WHERE tenant_id=$1', [f.p.tenantId])).rows[0]).toEqual({ spent_micro: '130', reserved_micro: '0' });
});
it('preserves an unsettled reservation when a stored receipt no longer matches its registered bytes', async () => {
  const f = await runningContentFixture(db); const store = storage(f.cfg);
  await db.pool.query(`CREATE FUNCTION fixture_reject_settlement() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN RAISE EXCEPTION 'synthetic settlement crash'; END $$;
    CREATE TRIGGER fixture_reject_settlement BEFORE UPDATE ON inference_requests
    FOR EACH ROW WHEN (NEW.state='SUCCEEDED') EXECUTE FUNCTION fixture_reject_settlement()`);
  try {
    const gateway = new InferenceGateway(db.pool, f.cfg, store, async () => ({ status: 200, headers: { 'content-type': 'text/event-stream' }, bytes: syntheticSse(f.admission), json: () => null }));
    await expect(gateway.respond(`Bearer ${f.capability}`, f.body)).rejects.toThrow('synthetic settlement crash');
  } finally { await db.pool.query('DROP TRIGGER fixture_reject_settlement ON inference_requests; DROP FUNCTION fixture_reject_settlement()'); }
  const row = (await db.pool.query('SELECT response_key,reserved_micro FROM inference_requests WHERE run_id=$1', [f.runId])).rows[0];
  await store.put(row.response_key, syntheticSse(f.admission, 101), 'text/event-stream');
  const maintenance = new InferenceGateway(db.pool, f.cfg, store);
  expect(await maintenance.reconcileReceipts()).toEqual({ settled: 0, blocked: 1 });
  expect((await db.pool.query('SELECT state,actual_micro,private FROM inference_requests WHERE run_id=$1', [f.runId])).rows[0]).toMatchObject({
    state: 'UNKNOWN', actual_micro: null, private: { reconciliation_error: 'CODEX_RECEIPT_HASH_MISMATCH' } });
  expect((await db.pool.query('SELECT reserved_micro FROM platform_cost_accounts WHERE tenant_id=$1', [f.p.tenantId])).rows[0].reserved_micro).toBe(row.reserved_micro);
});
it('serializes one in-flight purchase for a scope, then enforces its original turn and binding limits', async () => {
  const f = await runningContentFixture(db);
  await db.pool.query(`UPDATE agent_runs SET private=jsonb_set(private,'{inference_limits,max_requests}','1') WHERE id=$1`, [f.runId]);
  let release!: () => void; let began!: () => void; let calls = 0;
  const gate = new Promise<void>(r => { release = r; }); const started = new Promise<void>(r => { began = r; });
  const gateway = new InferenceGateway(db.pool, f.cfg, storage(f.cfg), async () => {
    calls++; began(); await gate; return { status: 200, headers: { 'content-type': 'text/event-stream' }, bytes: syntheticSse(f.admission), json: () => null };
  });
  const first = gateway.respond(`Bearer ${f.capability}`, f.body); await started;
  try { await expect(gateway.respond(`Bearer ${f.capability}`, { ...f.body, input: ['concurrent changed request'] })).rejects.toMatchObject({ code: 'CODEX_INFERENCE_UNKNOWN' }); }
  finally { release(); }
  await first;
  await expect(gateway.respond(`Bearer ${f.capability}`, { ...f.body, input: ['new turn'] })).rejects.toMatchObject({ code: 'CODEX_INFERENCE_LIMIT' });
  await db.pool.query(`UPDATE agent_runs SET private=jsonb_set(private,'{inference_limits,max_requests}','100') WHERE id=$1`, [f.runId]);
  await expect(gateway.respond(`Bearer ${f.capability}`, { ...f.body, input: ['changed scope'] })).rejects.toMatchObject({ code: 'CODEX_SCOPE_BINDING_CHANGED' });
  expect(calls).toBe(1);
});
it('settles a valid receipt after revocation but does not disclose it to the revoked capability', async () => {
  const f = await runningContentFixture(db); let calls = 0;
  const gateway = new InferenceGateway(db.pool, f.cfg, storage(f.cfg), async () => {
    calls++; await db.pool.query('UPDATE agent_capabilities SET revoked_at=now() WHERE run_id=$1', [f.runId]);
    return { status: 200, headers: { 'content-type': 'text/event-stream' }, bytes: syntheticSse(f.admission), json: () => null };
  });
  await expect(gateway.respond(`Bearer ${f.capability}`, f.body)).rejects.toMatchObject({ code: 'TOOL_CAPABILITY_REVOKED' });
  await expect(gateway.respond(`Bearer ${f.capability}`, f.body)).rejects.toMatchObject({ code: 'TOOL_CAPABILITY_REVOKED' });
  expect(calls).toBe(1); expect((await db.pool.query('SELECT state,actual_micro FROM inference_requests WHERE run_id=$1', [f.runId])).rows[0]).toMatchObject({ state: 'SUCCEEDED', actual_micro: '130' });
});
it('releases only certified no-charge errors and preserves reservation on an unverified usage receipt', async () => {
  const f = await runningContentFixture(db); let calls = 0;
  const gateway = new InferenceGateway(db.pool, f.cfg, storage(f.cfg), async () => { calls++; return { status: 429, headers: {}, bytes: Buffer.from('synthetic'), json: () => null }; });
  await expect(gateway.respond(`Bearer ${f.capability}`, f.body)).rejects.toMatchObject({ code: 'CODEX_INFERENCE_REJECTED' });
  await expect(gateway.respond(`Bearer ${f.capability}`, f.body)).rejects.toMatchObject({ code: 'CODEX_INFERENCE_REJECTED' });
  expect(calls).toBe(1); expect((await db.pool.query('SELECT reserved_micro,spent_micro FROM platform_cost_accounts WHERE tenant_id=$1', [f.p.tenantId])).rows[0]).toMatchObject({ reserved_micro: '0', spent_micro: '0' });
  const invalid = new InferenceGateway(db.pool, f.cfg, storage(f.cfg), async () => ({ status: 200, headers: { 'content-type': 'text/event-stream' }, bytes: syntheticSse(f.admission, 999999), json: () => null }));
  await expect(invalid.respond(`Bearer ${f.capability}`, { ...f.body, input: ['known new request after no-charge error'] })).rejects.toMatchObject({ code: 'CODEX_USAGE_INVALID' });
  expect((await db.pool.query('SELECT state FROM inference_requests WHERE run_id=$1 ORDER BY created_at DESC LIMIT 1', [f.runId])).rows[0].state).toBe('UNKNOWN');
  await expect(invalid.respond(`Bearer ${f.capability}`, { ...f.body, input: ['new request after capability violation'] })).rejects.toMatchObject({ code: 'CODEX_ADMISSION_QUARANTINED' });
});
it('rechecks authorization after reading a persisted replay, including revocation during storage access', async () => {
  const f = await runningContentFixture(db); const store = storage(f.cfg); let revoke = false; let calls = 0;
  const guarded: ObjectStorage = { put: (...args) => store.put(...args), exists: key => store.exists(key), delete: key => store.delete(key),
    get: async (...args) => { const bytes = await store.get(...args); if (revoke) await db.pool.query('UPDATE agent_capabilities SET revoked_at=now() WHERE run_id=$1', [f.runId]); return bytes; } };
  const gateway = new InferenceGateway(db.pool, f.cfg, guarded, async () => { calls++; return { status: 200, headers: { 'content-type': 'text/event-stream' }, bytes: syntheticSse(f.admission), json: () => null }; });
  await gateway.respond(`Bearer ${f.capability}`, f.body); revoke = true;
  await expect(gateway.respond(`Bearer ${f.capability}`, f.body)).rejects.toMatchObject({ code: 'TOOL_CAPABILITY_REVOKED' });
  expect(calls).toBe(1);
});
