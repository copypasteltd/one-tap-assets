import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { account, type TestDatabase } from './database.js';
import { rawProfile, variant } from './fixtures.js';
import { createProduct } from '../../src/api/modules/products.js';
import { createPlan } from '../../src/api/modules/plans.js';
import { normalizeVision } from '../../src/worker/analysis/profile.js';
import { insert } from '../../src/api/db/store.js';
import { id, sha256, addSeconds } from '../../src/api/lib/crypto.js';
import { claimStage } from '../../src/worker/queue/leases.js';
import type { CodexAdmission } from '../../src/worker/codex/admission.js';
import type { Config } from '../../src/api/config.js';
import type { Principal } from '../../src/shared/contracts/types.js';

/** Synthetic contract for failure-injection tests; never a real G0 admission. */
export const syntheticAdmission = (): CodexAdmission => ({
  schema_version: '1.0.0', state: 'ADMITTED', valid_until: addSeconds(3600), evidence_sha256: '1'.repeat(64),
  runtime_build_id: 'SYNTHETIC-NOT-PRODUCTION', runtime_sha256: '2'.repeat(64), protocol_version: 'SYNTHETIC-STDIO-1',
  actual_model: 'synthetic-codex-fixture', model_version_id: 'synthetic-model', rate_version_id: 'synthetic-rate', service_tier: 'default',
  launcher_sha256: '3'.repeat(64), launcher_evidence_sha256: '4'.repeat(64), isolation: 'NATIVE_RESTRICTED_IDENTITY',
  virtualization: 'FORBIDDEN', shell_tools: 'DISABLED', process_tree_cleanup: 'VERIFIED', inference_base_url: 'https://fixture.ypcc.invalid/v1',
  tokenizer_bound: 'UTF8_BYTES_PLUS_CERTIFIED_OVERHEAD', input_overhead_tokens: 2048, max_request_bytes: 100000,
  max_response_bytes: 1000000, max_request_output_tokens: 2000, input_micro_per_million: 1000000,
  cached_input_micro_per_million: 500000, output_micro_per_million: 2000000, no_charge_http_statuses: [400, 401, 403, 429],
});
export function syntheticConfig(base: Config, admission = syntheticAdmission()): Config {
  return { ...base, codex: { ...base.codex, enabled: true, binary: 'runtime/test-not-a-codex.exe', isolationCommand: 'runtime/test-not-a-launcher.exe',
    sha256: admission.runtime_sha256, protocol: admission.protocol_version, model: admission.actual_model, rateVersion: admission.rate_version_id,
    apiKey: 'synthetic-never-a-real-api-key', admissionPath: '', maxTurns: 8, maxInputTokens: 40000, maxOutputTokens: 8000,
    costCeilingMicro: 1000000, dailyBudgetMicro: 2000000 },
    provider: { ...base.provider, allowedHosts: ['fixture.ypcc.invalid'] } };
}
export const syntheticSse = (admission: CodexAdmission, input = 100, output = 20): Buffer => Buffer.from([
  `event: response.created\ndata: ${JSON.stringify({ type: 'response.created', response: { id: 'synthetic-response', model: admission.actual_model, status: 'in_progress' } })}\n\n`,
  `event: response.completed\ndata: ${JSON.stringify({ type: 'response.completed', response: { id: 'synthetic-response', model: admission.actual_model, service_tier: admission.service_tier, status: 'completed', usage: { input_tokens: input, output_tokens: output, input_tokens_details: { cached_tokens: 20 } } } })}\n\n`,
].join(''));
export async function planningFixture(db: TestDatabase, assetIds = ['asset-a', 'asset-b', 'asset-c'], principal?: Principal) {
  const p = principal ?? (await account(db)).principal; const product = await createProduct(db.pool, p); const photoId = id('photos');
  const raw = rawProfile(); const remap = (value: string): string => assetIds[['asset-a', 'asset-b', 'asset-c'].indexOf(value)] ?? value;
  raw.evidence = raw.evidence.map(e => ({ ...e, asset_id: remap(e.asset_id) }));
  raw.photo_roles = raw.photo_roles.map(r => ({ ...r, asset_id: remap(r.asset_id) }));
  raw.observations = raw.observations.map(o => ({ ...o, source_asset_ids: o.source_asset_ids.map(remap) }));
  const { profile, identityLock } = normalizeVision(raw, { tenantId: p.tenantId, productId: product.product_id,
    photoVersion: 1, revision: 1, assetIds });
  await insert(db.pool, 'product_photo_versions', { id: photoId, tenant_id: p.tenantId, product_id: product.product_id, revision: 1, photo_set_hash: 'a'.repeat(64), data: [] });
  await insert(db.pool, 'profile_versions', { id: profile.profile_id, tenant_id: p.tenantId, owner_id: p.userId, product_id: product.product_id,
    photo_version_id: photoId, revision: 1, profile_hash: profile.profile_hash, data: profile });
  await insert(db.pool, 'identity_locks', { id: identityLock.identity_lock_id, tenant_id: p.tenantId, profile_id: profile.profile_id, hash: identityLock.content_hash, data: identityLock });
  await db.pool.query(`UPDATE product_drafts SET current_profile_id=$1,current_photo_version=1,data=data||jsonb_build_object('profile_id',$1::text,'photo_version',1) WHERE id=$2`, [profile.profile_id, product.product_id]);
  const admission = syntheticAdmission(); const cfg = syntheticConfig(db.cfg, admission); const dir = resolve('runtime/codex-test-inputs', id('case'));
  await mkdir(dir, { recursive: true }); cfg.codex.admissionPath = resolve(dir, 'admission.json'); await writeFile(cfg.codex.admissionPath, JSON.stringify(admission));
  const request = { product_id: product.product_id, photo_version: 1, profile_id: profile.profile_id, identity_lock_id: profile.identity_lock_id,
    preset_id: 'minimal-clean', preset_version: '3.1.0', variant_id: 'minimal-clean.photo-layout', variant_version: '3.1.0' };
  const plan = await createPlan(db.pool, cfg, p, request);
  const lease = (await claimStage(db.pool, id('worker'), ['PLAN']))!;
  if (lease.scope_id !== plan.plan_id) throw new Error('A previous test left an executable PLAN stage');
  return { p, product, profile, identityLock, source: variant(), cfg, admission, plan, lease, dir };
}
export async function runningContentFixture(db: TestDatabase) {
  const f = await planningFixture(db); const instanceId = id('instance'); const runId = id('run'); const capability = id('capability');
  const plan = (await db.pool.query('SELECT private FROM plan_versions WHERE id=$1', [f.plan.plan_id])).rows[0];
  await insert(db.pool, 'agent_instances', { id: instanceId, tenant_id: f.p.tenantId, preview_session_id: f.plan.plan_id, state: 'ACTIVE',
    workspace_ref: 'SYNTHETIC-NO-PROCESS', lease_expires_at: addSeconds(120), data: {} });
  await insert(db.pool, 'agent_runs', { id: runId, tenant_id: f.p.tenantId, instance_id: instanceId, role: 'CONTENT', state: 'RUNNING',
    role_workspace_ref: 'SYNTHETIC-NO-PROCESS', input_hash: f.lease.input_hash, data: {}, private: { runtime_admission: f.admission,
      inference_limits: plan.private.inference_limits, allowed_tools: ['analyze_photos', 'validate_content_plan', 'persist_stage_result'] } });
  await insert(db.pool, 'agent_capabilities', { id: id('cap'), token_hash: sha256(capability), tenant_id: f.p.tenantId, instance_id: instanceId,
    run_id: runId, stage_run_id: f.lease.id, stage_fencing_token: f.lease.fencing_token, instance_fencing_token: 1,
    snapshot_hash: f.lease.input_hash, expires_at: addSeconds(120) });
  const body = { model: f.admission.actual_model, store: false, stream: true, input: [{ role: 'user', content: 'Synthetic text-only fixture, no real model.' }], tools: [] };
  return { ...f, instanceId, runId, capability, body };
}
