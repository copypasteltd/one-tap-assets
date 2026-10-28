import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import type pg from 'pg';
import type { Config } from '../../api/config.js';
import type { Db } from '../../api/db/pool.js';
import { insert, outbox } from '../../api/db/store.js';
import { hash, id, iso, sha256 } from '../../api/lib/crypto.js';
import { requireThat } from '../../api/lib/errors.js';
import { validate } from '../../api/lib/validation.js';
import type { ObjectStorage } from '../../api/storage/storage.js';
import type { DTO } from '../../shared/contracts/types.js';
import { POLICIES } from '../../shared/domain/policies.js';
import { extendFrozenInputRetention } from '../../api/modules/retention.js';
import { executionContext, type ExecutionContext } from '../compiler/order-context.js';
import { operationArtifacts, type MediaReceipt } from '../media/artifacts.js';
import { loadProductionFont, verifyResourceLicenses } from '../media/font.js';
import { PhotoMediaPipeline } from '../media/photo-pipeline.js';
import {GeneratedMediaPipeline} from '../media/generated-pipeline.js';
import {generatedOutputs} from '../generation/outputs.js';
import { assertLease, PendingExternal, type StageLease } from '../queue/leases.js';
import type { StageCommit } from '../runtime.js';
import { currentReviewPacket, packetImages } from './context.js';
import { assertReviewConsensus } from './packet.js';
import { packetReports } from './reports.js';
import { mediaQcPolicy, unsettledOrderCalls, verifySealedEvidence } from './qc.js';

export class PublicationService {
  constructor(private pool: pg.Pool, private cfg: Config, private store: ObjectStorage) {}
  private async ready(db: Db, context: ExecutionContext, lockResources = false): Promise<DTO<'ReviewPacket'>> {
    const packet = await currentReviewPacket(db, context);
    requireThat(packet.qc_policy_version===mediaQcPolicy(context),'PUBLICATION_ROUTE_UNAVAILABLE','原订单验收与发布规则不一致',503);
    if(context.snapshot.engine!=='PHOTO_LAYOUT'){
      const production=await operationArtifacts(db,context,'PRODUCTION');
      await generatedOutputs(db,this.cfg,this.store,context,production.operation.stage_run_id);
    }
    requireThat(packet.state === 'PASSED' && packet.publication_decision === 'PENDING', 'PUBLICATION_NOT_READY', '当前封存包尚未通过独立复核', 409);
    const reports = await packetReports(db, this.cfg, context, packet);
    requireThat(hash(reports) === hash(packet.reports), 'REVIEW_REPORT_STALE', '封存包报告与已完成阶段不一致', 409);
    assertReviewConsensus(packet);
    if (await unsettledOrderCalls(db, context)) throw new PendingExternal(5, 'PUBLICATION_PAID_CALL_UNRESOLVED');
    const refunds = await db.query("SELECT id FROM refunds WHERE tenant_id=$1 AND order_id=$2 AND state NOT IN ('FAILED','CANCELLED')", [context.tenantId, context.orderId]);
    requireThat(refunds.rowCount === 0, 'PUBLICATION_REFUND_PENDING', '订单已进入退款处置，不能发布', 409);
    await loadProductionFont(this.cfg.projectRoot); await verifyResourceLicenses(db, context.snapshot.resource_versions, lockResources);
    return packet;
  }
  private async bytes(receipt: MediaReceipt): Promise<Map<string, Buffer>> {
    const copies = new Map<string, Buffer>();
    for (const item of receipt.artifacts) {
      const bytes = await this.store.get(item.object_key, item.spec.kind === 'video' ? 512_000_000 : 30_000_000);
      requireThat(sha256(bytes) === item.sha256, 'ARTIFACT_HASH_MISMATCH', '交付文件与已复核候选字节不一致', 503);
      if (item.spec.kind === 'copy') copies.set(item.id, bytes);
    }
    return copies;
  }
  async handle(lease: StageLease, signal: AbortSignal): Promise<StageCommit> {
    requireThat(lease.scope_type === 'ORDER' && lease.stage_name === 'DELIVER', 'PUBLICATION_STAGE_INVALID', '交付阶段无效', 500);
    const context = await executionContext(this.pool, lease.tenant_id, lease.scope_id, lease.input_hash);
    const packet = await this.ready(this.pool, context); const post = await operationArtifacts(this.pool, context, 'POST');
    const directory = join(this.cfg.runtimeRoot, 'publication-work', id('attempt')); await mkdir(directory, { recursive: true });
    try {
      const pipeline = context.snapshot.engine==='PHOTO_LAYOUT'?new PhotoMediaPipeline(this.pool,this.cfg,this.store):new GeneratedMediaPipeline(this.pool,this.cfg,this.store);
      await pipeline.photos(context); await pipeline.verify(context, post.receipt, directory, signal);
      await packetImages(this.pool, this.store, context, packet);
    } finally { await rm(directory, { recursive: true, force: true }); }
    const copies = await this.bytes(post.receipt);
    const items: DTO<'Deliverable'>[] = context.snapshot.outputs.map((slot, index) => {
      const artifact = post.receipt.artifacts.find(a => a.slot_id === slot.slot_id)!; const inspection = artifact.spec.inspection;
      const copy = artifact.spec.kind === 'copy';
      return validate('Deliverable', { deliverable_id: artifact.id, slot_id: slot.slot_id, kind: artifact.spec.kind,
        file_name: copy ? null : `一品成片-${String(index + 1).padStart(2, '0')}.${artifact.spec.kind === 'video' ? 'mp4' : 'png'}`,
        mime_type: copy ? null : artifact.spec.kind === 'video' ? 'video/mp4' : 'image/png', size_bytes: copy ? null : inspection.bytes,
        width: 'width' in inspection ? inspection.width : null, height: 'height' in inspection ? inspection.height : null,
        fps: 'fps' in inspection ? inspection.fps : null, duration_frames: 'frames' in inspection ? inspection.frames : null,
        text: copy ? new TextDecoder('utf-8', { fatal: true }).decode(copies.get(artifact.id)!) : null, sha256: artifact.sha256 }, true);
    });
    return async db => {
      const current = await executionContext(db, lease.tenant_id, lease.scope_id, lease.input_hash); const latest = await this.ready(db, current, true);
      requireThat(latest.packet_hash === packet.packet_hash, 'REVIEW_PACKET_STALE', '发布时封存材料已经变化', 409);
      const actual = await operationArtifacts(db, current, 'POST');
      requireThat(hash(actual.receipt) === hash(post.receipt), 'REVIEW_OUTPUTS_CHANGED', '发布时候选媒体已变化', 409);
      await verifySealedEvidence(db, this.store, latest); await packetImages(db, this.store, current, latest); await this.bytes(actual.receipt);
      // Recheck wall-clock time after object I/O, before changing public state.
      await verifyResourceLicenses(db, current.snapshot.resource_versions, true);
      await assertLease(db, lease);
      requireThat(!signal.aborted, 'PUBLICATION_ABORTED', '当前发布任务已中断', 409);
      const existing = await db.query('SELECT id FROM delivery_manifests WHERE tenant_id=$1 AND order_id=$2', [context.tenantId, context.orderId]);
      requireThat(existing.rowCount === 0, 'MANIFEST_ALREADY_PUBLISHED', '订单已经发布，不能以新执行覆盖', 409);
      const deliveredAt = iso(); const expiresAt = iso(Date.now() + POLICIES.deliveryDays * 86400000);
      requireThat(await extendFrozenInputRetention(db, context.tenantId, context.ownerId, context.snapshot, expiresAt),
        'INPUT_HASH_MISMATCH', '发布时原订单照片已失效，不能延长其他照片的保留期', 409);
      const manifest = validate('Deliverables', { order_id: context.orderId,
        manifest_id: `manifest_${hash({ packet: packet.packet_id, outputs: packet.output_set_hash }).slice(0, 40)}`,
        manifest_revision: 1, expires_at: expiresAt, items }, true);
      await insert(db, 'delivery_manifests', { id: manifest.manifest_id, tenant_id: context.tenantId, owner_id: context.ownerId,
        order_id: context.orderId, revision: 1, hash: hash(manifest), data: manifest, expires_at: expiresAt, delivered_at: deliveredAt,
        private: { packet_id: packet.packet_id, packet_hash: packet.packet_hash, snapshot_hash: context.snapshotHash, report_ids: latest.reports.map(r => r.report_id) } });
      await db.query('UPDATE artifacts SET expires_at=$3 WHERE tenant_id=$1 AND order_id=$2 AND media_operation_id=$4',
        [context.tenantId, context.orderId, expiresAt, post.operation.id]);
      await db.query(`UPDATE private_object_writes SET expires_at=GREATEST(expires_at,$3::timestamptz)
        WHERE tenant_id=$1 AND order_id=$2 AND NOT delete_requested AND state<>'DELETED'`, [context.tenantId, context.orderId, expiresAt]);
      await db.query(`UPDATE orders SET fulfillment_state='DELIVERED',delivery_expires_at=$3::timestamptz,updated_at=now(),
        data=data||jsonb_build_object('fulfillment_state','DELIVERED','delivery_expires_at',$3::text) WHERE tenant_id=$1 AND id=$2`, [context.tenantId, context.orderId, expiresAt]);
      await db.query(`UPDATE render_jobs SET state='DELIVERED',updated_at=now(),data=data||jsonb_build_object('state','DELIVERED','current_stage','DELIVER','updated_at',$3::text)
        WHERE tenant_id=$1 AND order_id=$2`, [context.tenantId, context.orderId, deliveredAt]);
      latest.publication_decision = 'ALLOW';
      await db.query('UPDATE review_packets SET data=$3 WHERE tenant_id=$1 AND id=$2', [context.tenantId, packet.packet_id, JSON.stringify(latest)]);
      await db.query(`UPDATE agent_capabilities c SET revoked_at=COALESCE(c.revoked_at,now()) FROM stage_runs s
        WHERE c.tenant_id=$1 AND s.tenant_id=c.tenant_id AND s.id=c.stage_run_id AND s.scope_type='ORDER' AND s.scope_id=$2`, [context.tenantId, context.orderId]);
      await db.query(`UPDATE agent_instances SET state='DRAINING',fencing_token=fencing_token+1,updated_at=now(),
        data=data||jsonb_build_object('state','DRAINING','fencing_token',fencing_token+1,'release_reason','DELIVERED')
        WHERE tenant_id=$1 AND order_id=$2 AND state NOT IN ('DRAINING','RELEASING','RELEASED','CLEANUP_FAILED')`, [context.tenantId, context.orderId]);
      await outbox(db, context.tenantId, 'ReleaseRequested', context.orderId, `release:delivered:${context.orderId}`,
        { scope_type: 'ORDER', scope_id: context.orderId, reason: 'DELIVERED' });
      await db.query(`UPDATE stage_runs SET private=private||jsonb_build_object('manifest_id',$3::text,'review_packet_id',$4::text)
        WHERE tenant_id=$1 AND id=$2`, [context.tenantId, lease.id, manifest.manifest_id, packet.packet_id]);
    };
  }
}
