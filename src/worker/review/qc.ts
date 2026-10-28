import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type pg from 'pg';
import { writePrivateObject } from '../../api/storage/private-objects.js';
import { inside, type Config } from '../../api/config.js';
import type { Db } from '../../api/db/pool.js';
import { insert } from '../../api/db/store.js';
import { hash, id, sha256 } from '../../api/lib/crypto.js';
import { requireThat } from '../../api/lib/errors.js';
import type { ObjectStorage } from '../../api/storage/storage.js';
import type { DTO } from '../../shared/contracts/types.js';
import { executionContext, type ExecutionContext } from '../compiler/order-context.js';
import { operationArtifacts, type MediaOperation, type MediaReceipt } from '../media/artifacts.js';
import { loadProductionFont, verifyResourceLicenses } from '../media/font.js';
import { PhotoMediaPipeline, assertMediaAlive, inspectImage } from '../media/photo-pipeline.js';
import { assertLease, PendingExternal, type StageLease } from '../queue/leases.js';
import type { StageCommit } from '../runtime.js';
import { validateMediaStageResult } from '../tool-gateway/production-tools.js';
import { extractEvidenceFrames, FRAME_SAMPLING_POLICY } from './evidence.js';
import { assertSealedPacket, packetHash, reviewHash, REVIEW_HASH_ALGORITHM } from './packet.js';

export const PHOTO_QC_POLICY = 'YPCC-QC-PHOTO-1.0.0';
export interface ReviewEvidence {
  id: string; kind: 'CANDIDATE_IMAGE' | 'VIDEO_FRAME' | 'CONTRACT' | 'COPY'; artifact_id: string | null;
  object_key: string; sha256: string; mime_type: string; frame_index: number | null; time_ms: number | null; data: Record<string, unknown>;
}
interface ProductionIdentity { run_id: string; thread_id: string; process_ref: string }
async function productionIdentity(db: Db, context: ExecutionContext, operation: MediaOperation): Promise<ProductionIdentity> {
  const r = (await db.query<{ id: string; thread_id: string; output_hash: string; data: { runtime_process_ref: string }; private: { stage_result: unknown } }>(
    `SELECT r.id,r.thread_id,r.output_hash,r.data,r.private FROM stage_runs s JOIN agent_runs r ON r.tenant_id=s.tenant_id
     AND r.id=s.private->>'role_run_id' WHERE s.tenant_id=$1 AND s.id=$2 AND s.state='SUCCEEDED' AND r.state='SUCCEEDED'`,
  [context.tenantId, operation.stage_run_id])).rows[0];
  requireThat(r && r.thread_id && r.data.runtime_process_ref && r.output_hash === hash(r.private.stage_result),
    'REVIEW_PROVENANCE_MISSING', '缺少制作阶段的实际运行身份与持久结果', 503);
  await validateMediaStageResult(db, context, operation.stage_run_id, r.id, operation.phase, r.private.stage_result);
  return { run_id: r.id, thread_id: r.thread_id, process_ref: r.data.runtime_process_ref };
}
export async function unsettledOrderCalls(db: Db, context: ExecutionContext): Promise<number> {
  const r = (await db.query<{ n: string }>(`SELECT (
    (SELECT count(*) FROM budget_reservations WHERE tenant_id=$1 AND order_id=$2 AND state IN ('RESERVED','UNKNOWN')) +
    (SELECT count(*) FROM inference_requests q WHERE q.tenant_id=$1 AND q.scope_type='ORDER' AND q.scope_id=$2
     AND q.state NOT IN ('SUCCEEDED','FAILED','CANCELLED')) +
    (SELECT count(*) FROM provider_submissions p JOIN stage_runs s ON s.tenant_id=p.tenant_id AND s.id=p.stage_run_id
     WHERE p.tenant_id=$1 AND s.scope_type='ORDER' AND s.scope_id=$2 AND p.state IN ('SUBMITTING','UNKNOWN'))
    )::text AS n`, [context.tenantId, context.orderId])).rows[0]!;
  return Number(r.n);
}
export async function verifySealedEvidence(db: Db, store: ObjectStorage, packet: DTO<'ReviewPacket'>): Promise<ReviewEvidence[]> {
  assertSealedPacket(packet);
  const rows = (await db.query<ReviewEvidence>('SELECT * FROM review_evidence WHERE tenant_id=$1 AND packet_id=$2 ORDER BY id',
    [packet.tenant_id, packet.packet_id])).rows;
  requireThat(rows.length === packet.evidence_assets.length && rows.every(row => packet.evidence_assets.some(e => e.asset_id === row.id && e.sha256 === row.sha256)
    && row.object_key.startsWith(`${packet.tenant_id}/review/${packet.order_id}/${packet.packet_id}/`)),
  'REVIEW_EVIDENCE_INCOMPLETE', '持久审查证据与封存清单不一致', 503);
  for (const row of rows) requireThat(sha256(await store.get(row.object_key, 30_000_000)) === row.sha256,
    'REVIEW_EVIDENCE_CHANGED', '封存审查证据字节已变化', 503);
  return rows;
}
export class QualityControlService {
  constructor(private pool: pg.Pool, private cfg: Config, private store: ObjectStorage) {}
  async handle(lease: StageLease, signal: AbortSignal): Promise<StageCommit> {
    requireThat(lease.stage_name === 'QC' && lease.scope_type === 'ORDER', 'QC_STAGE_INVALID', '文件验收阶段无效', 500);
    await assertLease(this.pool, lease, false);
    const context = await executionContext(this.pool, lease.tenant_id, lease.scope_id, lease.input_hash);
    requireThat(context.snapshot.engine === 'PHOTO_LAYOUT' && context.snapshot.audio_policy.speech_mode === 'NONE'
      && context.snapshot.codex_contract.qc_policy_version === PHOTO_QC_POLICY,
    'QC_POLICY_UNAVAILABLE', '此验收规则只承担已冻结的原图无声路线', 503);
    await loadProductionFont(this.cfg.projectRoot); await verifyResourceLicenses(this.pool, context.snapshot.resource_versions);
    if (await unsettledOrderCalls(this.pool, context)) throw new PendingExternal(5, 'QC_PAID_CALL_UNRESOLVED');
    const production = await operationArtifacts(this.pool, context, 'PRODUCTION');
    const post = await operationArtifacts(this.pool, context, 'POST');
    const identities = await Promise.all([productionIdentity(this.pool, context, production.operation), productionIdentity(this.pool, context, post.operation)]);
    requireThat(['run_id', 'thread_id', 'process_ref'].every(key => new Set(identities.map(i => i[key as keyof ProductionIdentity])).size === 2),
      'REVIEW_PROVENANCE_REUSED', '制作与后期缺少不同的运行身份', 503);
    const packetId = `review_${hash({ stage: lease.id, production: production.operation.manifest_hash, post: post.operation.manifest_hash, policy: PHOTO_QC_POLICY }).slice(0, 40)}`;
    const directory = inside(this.cfg.runtimeRoot, `review-work/${packetId}/${id('attempt')}`); await mkdir(directory, { recursive: true });
    try {
      const pipeline = new PhotoMediaPipeline(this.pool, this.cfg, this.store);
      const photos = await pipeline.photos(context);
      for (const [phase, receipt] of [['production', production.receipt], ['post', post.receipt]] as const) {
        const verify = join(directory, phase); await mkdir(verify); await pipeline.verify(context, receipt, verify, signal);
      }
      this.checkSources(context, production.receipt, post.receipt);
      const evidence: ReviewEvidence[] = [];
      const save = async (kind: ReviewEvidence['kind'], bytes: Buffer, artifactId: string | null, data: Record<string, unknown>, frame: number | null = null): Promise<void> => {
        assertMediaAlive(context, signal);
        requireThat(evidence.length < 1000, 'REVIEW_EVIDENCE_LIMIT', '完整审查材料超过容量', 422);
        const digest = sha256(bytes); const evidenceId = `evidence_${hash({ packetId, kind, artifactId, frame, digest }).slice(0, 40)}`;
        const mime = kind === 'CONTRACT' ? 'application/json' : kind === 'COPY' ? 'text/plain; charset=utf-8' : 'image/png';
        const key = `${context.tenantId}/review/${context.orderId}/${packetId}/${evidenceId}`;
        if (await this.store.exists(key)) requireThat(sha256(await this.store.get(key, 30_000_000)) === digest,
          'REVIEW_EVIDENCE_CHANGED', '已有封存证据不能覆盖重建', 503);
        else await writePrivateObject(this.pool, this.store, { tenantId: context.tenantId, ownerId: context.ownerId,
          productId: context.snapshot.product_id, orderId: context.orderId, kind: 'QC' }, key, bytes, mime);
        evidence.push({ id: evidenceId, kind, artifact_id: artifactId, object_key: key, sha256: digest, mime_type: mime,
          frame_index: frame, time_ms: frame === null ? null : Math.round(frame * 1000 / 30), data });
      };
      for (const artifact of post.receipt.artifacts) {
        const bytes = await this.store.get(artifact.object_key, artifact.spec.kind === 'video' ? 512_000_000 : 30_000_000);
        requireThat(sha256(bytes) === artifact.sha256, 'ARTIFACT_HASH_MISMATCH', '审查前候选文件已变化', 503);
        if (artifact.spec.kind === 'video') {
          const path = join(directory, `${artifact.id}.mp4`); await writeFile(path, bytes, { flag: 'wx' });
          const inspection = artifact.spec.inspection;
          requireThat('frames' in inspection && inspection.frames, 'REVIEW_VIDEO_INVALID', '缺少实际视频帧数', 503);
          const boundaries = context.snapshot.timeline.shots.flatMap(s => [s.start_frame, s.end_frame - 1]);
          const frames = await extractEvidenceFrames(this.cfg, path, join(directory, artifact.id), inspection.frames, boundaries, context.snapshot.deadline_at, signal);
          for (const frame of frames) {
            await inspectImage(frame.bytes);
            await save('VIDEO_FRAME', frame.bytes, artifact.id, { sampling_policy: FRAME_SAMPLING_POLICY, actual_frames: inspection.frames }, frame.index);
          }
        } else await save(artifact.spec.kind === 'image' ? 'CANDIDATE_IMAGE' : 'COPY', bytes, artifact.id, { slot_id: artifact.slot_id });
      }
      await save('CONTRACT', Buffer.from(JSON.stringify({ version: PHOTO_QC_POLICY, snapshot: context.snapshot, profile: context.contract.profile,
        creative_plan: context.contract.creative, resources: context.snapshot.resource_versions, sampling_policy: FRAME_SAMPLING_POLICY,
        outputs: post.receipt.artifacts.map(a => ({ artifact_id: a.id, slot_id: a.slot_id, sha256: a.sha256, spec: a.spec })) })), null, { snapshot_hash: context.snapshotHash });
      const outputs = post.receipt.artifacts.map(a => ({ slot_id: a.slot_id, asset_id: a.id, sha256: a.sha256 }));
      const packet: DTO<'ReviewPacket'> = { packet_id: packetId, tenant_id: context.tenantId, order_id: context.orderId,
        state: 'SEALED', packet_hash: '', snapshot_hash: context.snapshotHash, identity_lock_hash: context.snapshot.identity_lock_hash,
        skill_bundle_hash: context.snapshot.codex_contract.skill_bundle_hash, qc_policy_version: PHOTO_QC_POLICY,
        original_assets: [...photos].map(([asset_id, bytes]) => ({ asset_id, sha256: sha256(bytes) })),
        evidence_assets: evidence.map(e => ({ asset_id: e.id, sha256: e.sha256 })), required_slot_ids: context.snapshot.outputs.map(s => s.slot_id),
        outputs, output_set_hash: reviewHash(outputs), production_run_ids: identities.map(i => i.run_id),
        production_thread_ids: identities.map(i => i.thread_id), production_process_refs: identities.map(i => i.process_ref),
        reports: [], deterministic_pass: true, evidence_complete: true, unknown_paid_calls: 0, publication_decision: 'PENDING' };
      packet.packet_hash = packetHash(packet); assertSealedPacket(packet); assertMediaAlive(context, signal);
      return async db => {
        await executionContext(db, context.tenantId, context.orderId, context.snapshotHash);
        await verifyResourceLicenses(db, context.snapshot.resource_versions);
        requireThat(await unsettledOrderCalls(db, context) === 0, 'QC_PAID_CALL_UNRESOLVED', '提交时仍有未决付费调用', 409);
        for (const old of [production, post]) {
          const current = await operationArtifacts(db, context, old.operation.phase);
          requireThat(current.operation.id === old.operation.id && current.operation.manifest_hash === old.operation.manifest_hash,
            'REVIEW_OUTPUTS_CHANGED', '候选媒体阶段已更新，需重新封存审查包', 409);
          await productionIdentity(db, context, current.operation);
        }
        const existing = (await db.query<{ data: DTO<'ReviewPacket'> }>('SELECT data FROM review_packets WHERE tenant_id=$1 AND qc_stage_id=$2', [context.tenantId, lease.id])).rows[0];
        if (existing) requireThat(existing.data.packet_hash === packet.packet_hash, 'REVIEW_PACKET_CHANGED', '当前阶段已有不同封存包', 503);
        else {
          await insert(db, 'review_packets', { id: packetId, tenant_id: context.tenantId, order_id: context.orderId, qc_stage_id: lease.id,
            snapshot_hash: context.snapshotHash, output_set_hash: packet.output_set_hash, packet_hash: packet.packet_hash,
            state: 'SEALED', data: packet, private: { hash_algorithm: REVIEW_HASH_ALGORITHM, production_operation_id: production.operation.id, post_operation_id: post.operation.id } });
          for (const row of evidence) await insert(db, 'review_evidence', { ...row, tenant_id: context.tenantId, packet_id: packetId, order_id: context.orderId });
          for (const artifact of post.receipt.artifacts) await insert(db, 'qc_decisions', { id: id('qc'), tenant_id: context.tenantId,
            order_id: context.orderId, artifact_id: artifact.id, ruleset_version: PHOTO_QC_POLICY, decision: 'PASS',
            data: { packet_id: packetId, packet_hash: packet.packet_hash, sha256: artifact.sha256, inspection: artifact.spec.inspection,
              checked: ['FULL_DECODE', 'EXACT_SLOTS', 'SPEC', 'SOLD_PROVENANCE', 'RESOURCE_LICENSE', 'FULL_TIMELINE_EVIDENCE'], semantic_review: 'PENDING' } });
        }
        await db.query(`UPDATE stage_runs SET private=private||jsonb_build_object('review_packet_id',$3::text,'packet_hash',$4::text)
          WHERE tenant_id=$1 AND id=$2`, [context.tenantId, lease.id, packetId, packet.packet_hash]);
      };
    } finally { await rm(directory, { recursive: true, force: true }); }
  }
  private checkSources(context: ExecutionContext, production: MediaReceipt, post: MediaReceipt): void {
    const creative = context.contract.creative;
    for (const p of production.artifacts) {
      const expected = p.spec.kind === 'image' ? [creative.image_slots.find(s => s.slot_id === p.slot_id)!.asset_id]
        : [...new Set(creative.shots.map(s => s.asset_id))].sort();
      requireThat(hash(p.spec.source_asset_ids) === hash(expected) && p.spec.source_artifact_ids.length === 0,
        'REVIEW_PROVENANCE_MISSING', '制作产物未绑定原订单商品照片', 503);
    }
    for (const p of post.artifacts) {
      const original = production.artifacts.find(s => s.slot_id === p.slot_id);
      requireThat(p.spec.kind === 'copy' ? p.spec.source_asset_ids.length === 0 && p.spec.source_artifact_ids.length === 0
        : original && hash(p.spec.source_asset_ids) === hash(original.spec.source_asset_ids) && hash(p.spec.source_artifact_ids) === hash([original.id]),
      'REVIEW_PROVENANCE_MISSING', '后期产物来源不属于完整原制作检查点', 503);
    }
  }
}
