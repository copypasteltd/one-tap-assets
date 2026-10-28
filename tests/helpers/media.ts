import { readFileSync } from 'node:fs';
import sharp from 'sharp';
import { planningFixture } from './codex.js';
import type { TestDatabase } from './database.js';
import type { DTO, Principal } from '../../src/shared/contracts/types.js';
import { insert } from '../../src/api/db/store.js';
import { id, iso, hash, sha256, addSeconds } from '../../src/api/lib/crypto.js';
import { storage } from '../../src/api/storage/storage.js';
import { basePlan } from '../../src/worker/compiler/plan.js';
import { bindSnapshot, type FrozenContract } from '../../src/worker/compiler/snapshot.js';
import { enqueueStage } from '../../src/worker/queue/enqueue.js';
import { claimStage } from '../../src/worker/queue/leases.js';
import { FONT_BINDING } from '../../src/worker/media/font.js';
import { PHOTO_QC_POLICY } from '../../src/worker/review/qc.js';
import {GENERATED_QC_POLICY} from '../../src/worker/generation/contracts.js';
import {freezeRevisionPolicy,ensureRevisionBudget} from '../../src/worker/revisions/contract.js';
import type {ArkContract} from '../../src/worker/providers/ark.js';
import {bundleForVariant} from '../../src/worker/codex/skills.js';

/** Actual private files, PostgreSQL and native media; a one-second synthetic
 * contract keeps fault tests bounded. This is not an official-variant run. */
export async function mediaFixture(db: TestDatabase,options:{principal?:Principal;revisions?:boolean;speech?:import('../../src/worker/providers/dashscope-asr.js').SpeechContract;generation?:{engine:'PER_SHOT_AI'|'REFERENCE_FILM';contracts:ArkContract[];variantId?:string;twoShots?:boolean}}={}) {
  const assetIds = [id('photo'), id('photo'), id('photo')]; const f = await planningFixture(db, assetIds, options.principal);
  // Synthetic receipt accounting only, not a certified real-model image bound.
  f.admission.review_vision = { evidence_sha256: 'f'.repeat(64), detail: 'original', max_images: 100,
    max_image_bytes: 2000000, max_image_pixels: 30000000, max_total_image_bytes: 6000000, tokens_per_image_bound: 100 };
  f.admission.max_request_bytes = 2_000_000;
  await db.pool.query("UPDATE stage_runs SET state='CANCELLED' WHERE id=$1", [f.lease.id]);
  const store = storage(f.cfg); const photoId = (await db.pool.query('SELECT photo_version_id FROM plan_versions WHERE id=$1', [f.plan.plan_id])).rows[0].photo_version_id as string;
  const bytes = await sharp({ create: { width: 800, height: 1000, channels: 3, background: '#2675A4' } }).png().toBuffer();
  for (const [position, assetId] of assetIds.entries()) {
    const key = `${f.p.tenantId}/source/${assetId}.png`; await store.put(key, bytes, 'image/png');
    await insert(db.pool, 'assets', { id: assetId, tenant_id: f.p.tenantId, owner_id: f.p.userId, product_id: f.product.product_id,
      purpose: 'PRODUCT_PHOTO', state: 'READY', object_key: key, upload_token_hash: sha256(id('unused')),
      expected_bytes: bytes.length, declared_mime: 'image/png', sha256: sha256(bytes), expected_sha256: sha256(bytes),
      size_bytes: bytes.length, width: 800, height: 1000, expires_at: addSeconds(86400), grant_expires_at: addSeconds(300), data: {} });
    await insert(db.pool, 'product_photo_items', { id: id('item'), tenant_id: f.p.tenantId, photo_version_id: photoId, asset_id: assetId, position });
  }
  const photoHash = hash({ photos: assetIds.map(asset_id => ({ asset_id, sha256: sha256(bytes) })), revision: 1, normalization: 'sharp-auto-orient-strip-png-v1' });
  await db.pool.query('UPDATE product_photo_versions SET photo_set_hash=$2 WHERE id=$1', [photoId, photoHash]);
  const source = structuredClone(f.source); source.timeline_policy = { ...source.timeline_policy, target_frames: 30,
    base_segments: [{ role: '商品实拍', start_seconds: 0, end_seconds: 1 }] };
  if(options.generation?.twoShots)source.timeline_policy={...source.timeline_policy,target_frames:60,
    base_segments:[{role:'商品实拍',start_seconds:0,end_seconds:1},{role:'细节展示',start_seconds:1,end_seconds:2}]};
  if(options.generation){source.engine=options.generation.engine;source.variant_id=options.generation.variantId??`synthetic-${options.generation.engine.toLowerCase()}`;}
  const creative = basePlan(f.profile, source);
  const base = (JSON.parse(readFileSync('assets/development/v1.1/contracts/codex-fixtures.json', 'utf8')) as { cases: { name: string; value: DTO<'CodexContract'> }[] }).cases.find(c => c.name === 'frozen_codex_contract')!.value;
  const bundleHash = options.generation?.variantId?(await bundleForVariant(f.cfg,options.generation.variantId)).sha256
    :(await db.pool.query('SELECT private FROM plan_versions WHERE id=$1', [f.plan.plan_id])).rows[0].private.bundle_hash as string;
  const cc: DTO<'CodexContract'> = { ...base, runtime_build_id: f.admission.runtime_build_id, runtime_sha256: f.admission.runtime_sha256,
    protocol_version: f.admission.protocol_version, model_version_id: f.admission.model_version_id, rate_version_id: f.admission.rate_version_id,
    skill_bundle_hash: bundleHash, qc_policy_version: options.generation?GENERATED_QC_POLICY:PHOTO_QC_POLICY, max_turns_per_role: 2, max_input_tokens: 80000, max_output_tokens: 8000, max_tool_calls: 24, agent_cost_ceiling_micro: 1000000 };
  const contract: FrozenContract = { product: f.product, profile: f.profile, photo_set_hash: photoHash, identity_lock_hash: f.identityLock.content_hash,
    request: { product_id: f.product.product_id, photo_version: 1, profile_id: f.profile.profile_id, identity_lock_id: f.profile.identity_lock_id,
      preset_id: 'minimal-clean', preset_version: '3.1.0', variant_id: source.variant_id, variant_version: source.version },
    creative, source, plan_hash: hash(creative), model_versions: [{ provider: 'synthetic-fixture', actual_model: 'synthetic-vision',
      registry_version: 'SYNTHETIC-NOT-PRODUCTION', roles: ['VISION_ANALYSIS'], capability_hash: 'a'.repeat(64), rate_snapshot_id: 'synthetic-vision-rate' }],
    resource_versions: [{ ...FONT_BINDING }], codex_contract: cc,
    budget_micro: 10000000, repair_ceiling_micro: 0, runtime_binding: { admission: f.admission,
      limits: { max_requests: 8, max_requests_per_role: 2, max_input_tokens: 80000, max_output_tokens: 8000,
        ceiling_micro: 1000000, daily_ceiling_micro: 1000000, owner_id: f.p.userId } } };
  if(options.revisions)contract.revision_policy=freezeRevisionPolicy(contract);
  if(options.speech){
    if(db.cfg.env!=='test')throw new Error('Synthetic speech admission requires APP_ENV=test');
    const c=options.speech;contract.speech_contract=structuredClone(c);
    const binding={provider:c.provider,actual_model:c.actual_model,registry_version:c.registry_version,roles:['SPEECH' as const],capability_hash:hash(c),rate_snapshot_id:c.rate_snapshot_id};
    contract.model_versions.push(binding);
    await insert(db.pool,'provider_model_versions',{id:c.model_version_id,provider:c.provider,actual_model:c.actual_model,status:'ADMITTED',version:c.registry_version,data:binding,private:{speech_contract:c}});
  }
  if(options.generation){
    contract.generation_contracts=structuredClone(options.generation.contracts);
    for(const c of contract.generation_contracts){
      const binding={provider:c.provider,actual_model:c.actual_model,registry_version:c.registry_version,
        roles:[c.wire==='ARK_IMAGE'?'IMAGE' as const:'VIDEO' as const],capability_hash:hash(c),rate_snapshot_id:c.rate_snapshot_id};
      contract.model_versions.push(binding);
      await insert(db.pool,'provider_model_versions',{id:c.model_version_id,provider:c.provider,actual_model:c.actual_model,
        status:'ADMITTED',version:c.registry_version,data:binding,private:{ark_contract:c}});
    }
  }
  const quoteId = id('quote'); const orderId = id('order'); const jobId = id('job'); const snapshotId = id('snapshot');
  await insert(db.pool, 'quotes', { id: quoteId, tenant_id: f.p.tenantId, owner_id: f.p.userId, plan_id: f.plan.plan_id,
    plan_hash: contract.plan_hash, amount_fen: 100, expires_at: addSeconds(900), state: 'CONSUMED', data: {}, private: {} });
  const order: DTO<'Order'> = { order_id: orderId, quote_id: quoteId, channel: 'alipay', currency: 'CNY', amount_fen: 100, payment_state: 'CONFIRMED',
    fulfillment_state: 'QUEUED', payable_until: addSeconds(900), job_id: jobId, refund_id: null, delivery_expires_at: null, created_at: iso() };
  const snapshot = bindSnapshot(order, f.p.tenantId, contract, iso()); const snapshotHash = hash(snapshot);
  await insert(db.pool, 'orders', { id: orderId, tenant_id: f.p.tenantId, owner_id: f.p.userId, quote_id: quoteId, channel: 'alipay', app_id: f.p.appId,
    subject_id: f.p.subjectId, amount_fen: 100, payment_state: 'CONFIRMED', fulfillment_state: 'QUEUED', payable_until: order.payable_until,
    budget_micro: contract.budget_micro, deadline_at: snapshot.deadline_at, data: order, private: { contract, contract_hash: hash(contract) } });
  await insert(db.pool, 'execution_snapshots', { id: snapshotId, tenant_id: f.p.tenantId, order_id: orderId, hash: snapshotHash, data: snapshot });
  if(contract.revision_policy)await ensureRevisionBudget(db.pool,{tenantId:f.p.tenantId,ownerId:f.p.userId,orderId},contract.revision_policy);
  await insert(db.pool, 'render_jobs', { id: jobId, tenant_id: f.p.tenantId, owner_id: f.p.userId, order_id: orderId,
    execution_snapshot_id: snapshotId, state: 'QUEUED', deadline_at: snapshot.deadline_at,
    data: { job_id: jobId, order_id: orderId, state: 'QUEUED', current_stage: 'PRODUCTION', completed_stage_count: 0, total_stage_count: 6, repair_rounds: 0, deadline_at: snapshot.deadline_at, updated_at: iso() } });
  const productionId = await enqueueStage(db.pool, { tenantId: f.p.tenantId, scopeType: 'ORDER', scopeId: orderId, name: 'PRODUCTION', inputHash: snapshotHash, deadlineAt: snapshot.deadline_at, jobId });
  await enqueueStage(db.pool, { tenantId: f.p.tenantId, scopeType: 'ORDER', scopeId: orderId, name: 'POST', inputHash: snapshotHash, deadlineAt: snapshot.deadline_at, jobId, dependencies: [productionId] });
  const lease = (await claimStage(db.pool, id('worker'), ['PRODUCTION']))!;
  if (lease.id !== productionId) throw new Error('Previous media test left a production stage');
  return { ...f, lease, contract, snapshot, snapshotHash, orderId, store, assetIds };
}
