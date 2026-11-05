import { readFile, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { config, inside } from '../api/config.js';
import { createPool } from '../api/db/pool.js';
import { checkAdmission } from '../worker/codex/admission.js';
import { checkedNativeExecutable } from '../worker/codex/launcher.js';
import { configuredRoleGateway } from '../shared/domain/role-gateway.js';
import type pg from 'pg';

type Row = { id: string; status: 'PASS' | 'MISSING_CONFIG' | 'DISABLED' | 'UNVERIFIED'; detail: string };
const rows: Row[] = [];
const add = (id: string, status: Row['status'], detail: string): void => { rows.push({ id, status, detail }); };
async function sha(path: string): Promise<string> {
  const digest = createHash('sha256');
  for await (const bytes of createReadStream(path)) digest.update(bytes);
  return digest.digest('hex');
}
try {
  const cfg = config();
  try { add('private_gateway', 'PASS', configuredRoleGateway(cfg).origin); }
  catch { add('private_gateway', 'MISSING_CONFIG', 'Set CODEX_GATEWAY_ORIGIN to the private loopback API origin'); }
  for (const [id, value] of [['codex_service', cfg.codex.enabled], ['generation', cfg.generationEnabled], ['payments', cfg.paymentsEnabled]] as const)
    add(id, value ? 'PASS' : 'DISABLED', value ? 'Enabled; actual service evidence remains separate' : 'Explicitly disabled');
  for (const [id, value] of [['service_key', cfg.codex.apiKey], ['model_id', cfg.codex.model], ['runtime_hash', cfg.codex.sha256],
    ['protocol_pin', cfg.codex.protocol], ['rate_version', cfg.codex.rateVersion], ['provider_url', cfg.provider.baseUrl],
    ['provider_key', cfg.provider.apiKey], ['vision_model', cfg.provider.visionModel], ['image_model', cfg.provider.imageModel],
    ['video_model', cfg.provider.videoModel], ['vision_contract', cfg.provider.visionContractPath]] as const)
    add(id, value ? 'PASS' : 'MISSING_CONFIG', value ? 'Configured; private value omitted' : 'Required service setting is absent');
  for (const [id, path, kind] of [['native_runtime', cfg.codex.binary, 'runtime'], ['native_launcher', cfg.codex.isolationCommand, 'launcher']] as const) {
    try {
      if (!path) throw new Error();
      const absolute = inside(cfg.projectRoot, path); await checkedNativeExecutable(absolute, kind);
      if (kind === 'runtime' && await sha(absolute) !== cfg.codex.sha256) throw new Error();
      add(id, 'PASS', 'Native executable exists and passes the platform check; runtime hash checked');
    } catch { add(id, 'MISSING_CONFIG', 'Provide the platform-native executable and matching pin'); }
  }
  for (const [id, value] of [['order_cost_ceiling', cfg.codex.costCeilingMicro], ['planning_daily_budget', cfg.codex.dailyBudgetMicro],
    ['vision_daily_budget', cfg.provider.visionDailyBudgetMicro]] as const)
    add(id, value > 0 ? 'PASS' : 'MISSING_CONFIG', value > 0 ? 'Positive budget configured; amount omitted' : 'Budget remains zero');
  try {
    if (!cfg.codex.admissionPath) throw new Error();
    const admission = checkAdmission(cfg, JSON.parse(await readFile(inside(cfg.projectRoot, cfg.codex.admissionPath), 'utf8')) as unknown);
    if (await sha(inside(cfg.projectRoot, cfg.codex.isolationCommand)) !== admission.launcher_sha256) throw new Error();
    add('runtime_admission', 'PASS', 'Admission structure, expiry, configuration and launcher digest match; evidence authenticity is operator-owned');
  } catch { add('runtime_admission', 'MISSING_CONFIG', 'Genuine runtime/model/rate/isolation admission is absent or does not match'); }
  if (process.platform === 'linux') {
    try { await access('/run/one-tap-assets-agent/launcher.sock'); add('native_broker_socket', 'PASS', 'Private socket exists; run the operator OS probe for actual isolation'); }
    catch { add('native_broker_socket', 'MISSING_CONFIG', 'Install/start the project native Agent broker'); }
  }
  const pool = createPool(cfg);
  let db: pg.PoolClient | undefined;
  try {
    db = await pool.connect(); await db.query('BEGIN READ ONLY');
    const models = (await db.query<{ n: number }>('SELECT count(*)::int AS n FROM provider_model_versions')).rows[0]!.n;
    const bundles = (await db.query<{ state: string; n: number }>('SELECT state,count(*)::int AS n FROM skill_bundles GROUP BY state')).rows;
    const admitted = bundles.filter(row => row.state === 'ADMITTED').reduce((sum, row) => sum + row.n, 0);
    add('registered_models', models > 0 ? 'PASS' : 'MISSING_CONFIG', `${models} registered model versions; compatibility still requires actual receipts`);
    add('admitted_skill_bundles', admitted > 0 ? 'PASS' : 'MISSING_CONFIG', `${admitted} admitted; ${bundles.reduce((sum, row) => sum + row.n, 0)} total`);
    const runs = (await db.query<{ n: number }>("SELECT count(*)::int AS n FROM agent_runs WHERE state='SUCCEEDED'")).rows[0]!.n;
    add('real_order_verification', 'UNVERIFIED', `${runs} successful run records; this diagnostic never certifies real model or end-to-end acceptance`);
  } catch { add('database_readiness', 'UNVERIFIED', 'Database readiness could not be inspected; private error omitted'); }
  finally { if (db) { await db.query('ROLLBACK').catch(() => {}); db.release(); } await pool.end(); }
} catch { add('configuration', 'MISSING_CONFIG', 'Load the private application environment; configuration error omitted'); }
console.log(JSON.stringify({ checked_at: new Date().toISOString(), scope: 'READ_ONLY_CONFIGURATION_DIAGNOSTIC', rows,
  configuration_complete: rows.every(row => row.status === 'PASS' || row.id === 'real_order_verification'),
  real_end_to_end_verified: false, production_admitted: false, secrets_included: false }, null, 2));
if (rows.some(row => row.id !== 'real_order_verification' && row.status !== 'PASS')) process.exitCode = 1;
