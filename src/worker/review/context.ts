import sharp from 'sharp';
import type { Db } from '../../api/db/pool.js';
import { hash, sha256 } from '../../api/lib/crypto.js';
import { requireThat } from '../../api/lib/errors.js';
import type { ObjectStorage } from '../../api/storage/storage.js';
import type { DTO } from '../../shared/contracts/types.js';
import type { ExecutionContext } from '../compiler/order-context.js';
import { operationArtifacts } from '../media/artifacts.js';
import type { ReviewImage } from '../codex/review-images.js';
import { assertSealedPacket, reviewHash } from './packet.js';
import { verifySealedEvidence } from './qc.js';

export async function currentReviewPacket(db: Db, context: ExecutionContext): Promise<DTO<'ReviewPacket'>> {
  const row = (await db.query<{ data: DTO<'ReviewPacket'> }>(`SELECT p.data FROM review_packets p JOIN stage_runs s
    ON s.id=p.qc_stage_id AND s.tenant_id=p.tenant_id WHERE p.tenant_id=$1 AND p.order_id=$2 AND p.snapshot_hash=$3
    AND s.stage_name='QC' AND s.state='SUCCEEDED' AND ($4::int IS NULL OR s.attempt=$4) ORDER BY s.attempt DESC,p.created_at DESC LIMIT 1`,
  [context.tenantId, context.orderId, context.snapshotHash,context.repair?2:null])).rows[0];
  requireThat(row, 'REVIEW_PACKET_MISSING', '缺少已完成文件验收的封存材料', 409);
  const packet = row.data; assertSealedPacket(packet);
  requireThat(packet.tenant_id === context.tenantId && packet.order_id === context.orderId && packet.snapshot_hash === context.snapshotHash
    && packet.identity_lock_hash === context.snapshot.identity_lock_hash && packet.skill_bundle_hash === context.snapshot.codex_contract.skill_bundle_hash
    && packet.qc_policy_version === context.snapshot.codex_contract.qc_policy_version
    && hash(packet.required_slot_ids) === hash(context.snapshot.outputs.map(o => o.slot_id)),
  'REVIEW_PACKET_STALE', '审查材料不属于当前已售合同', 409);
  const post = await operationArtifacts(db, context, 'POST');
  const outputs = post.receipt.artifacts.map(a => ({ slot_id: a.slot_id, asset_id: a.id, sha256: a.sha256 }));
  requireThat(reviewHash(outputs) === packet.output_set_hash, 'REVIEW_OUTPUTS_CHANGED', '候选媒体已经更新，不能沿用旧审查包', 409);
  return packet;
}
export async function packetImageRefs(db: Db, packet: DTO<'ReviewPacket'>): Promise<{ asset_id: string; sha256: string }[]> {
  const evidence = (await db.query<{ id: string; kind: string; sha256: string }>(
    'SELECT id,kind,sha256 FROM review_evidence WHERE tenant_id=$1 AND packet_id=$2', [packet.tenant_id, packet.packet_id])).rows;
  requireThat(evidence.length === packet.evidence_assets.length
    && evidence.every(e => packet.evidence_assets.some(a => a.asset_id === e.id && a.sha256 === e.sha256)),
    'REVIEW_EVIDENCE_INCOMPLETE', '封存证据索引不完整', 503);
  const visual = new Map(evidence.filter(e => e.kind === 'CANDIDATE_IMAGE' || e.kind === 'VIDEO_FRAME').map(e => [e.id, e]));
  return [...packet.original_assets, ...packet.evidence_assets.filter(e => visual.has(e.asset_id))];
}
export async function packetImages(db: Db, store: ObjectStorage, context: ExecutionContext, packet: DTO<'ReviewPacket'>): Promise<ReviewImage[]> {
  const evidence = await verifySealedEvidence(db, store, packet); const byId = new Map(evidence.map(e => [e.id, e]));
  const refs = await packetImageRefs(db, packet); const images: ReviewImage[] = [];
  for (const ref of refs) {
    let key: string;
    const original = packet.original_assets.some(a => a.asset_id === ref.asset_id);
    if (original) {
      const row = (await db.query<{ object_key: string }>(`SELECT a.object_key FROM product_photo_items p JOIN assets a ON a.tenant_id=p.tenant_id AND a.id=p.asset_id
        WHERE p.tenant_id=$1 AND p.photo_version_id=$2 AND a.id=$3 AND a.owner_id=$4 AND a.product_id=$5 AND a.state='READY'
        AND a.expires_at>now() AND a.sha256=$6`, [context.tenantId, context.photoVersionId, ref.asset_id, context.ownerId, context.snapshot.product_id, ref.sha256])).rows[0];
      requireThat(row, 'REVIEW_ORIGINAL_UNAVAILABLE', '已售原图不可用或归属不一致', 503); key = row.object_key;
    } else key = byId.get(ref.asset_id)!.object_key;
    const bytes = await store.get(key, 30_000_000);
    requireThat(sha256(bytes) === ref.sha256, 'REVIEW_EVIDENCE_CHANGED', '复核实际图片与封存字节不一致', 503);
    const meta = await sharp(bytes, { limitInputPixels: 30_000_000, failOn: 'warning' }).metadata();
    requireThat(meta.width && meta.height, 'REVIEW_IMAGE_INVALID', '复核图片缺少实际尺寸', 503);
    images.push({ ...ref, width: meta.width, height: meta.height, bytes });
  }
  return images;
}
export async function packetMaterial(db: Db, store: ObjectStorage, packet: DTO<'ReviewPacket'>): Promise<unknown> {
  const rows = await verifySealedEvidence(db, store, packet);
  const texts: { asset_id: string; sha256: string; kind: string; content: string }[] = [];
  for (const row of rows.filter(r => ['CONTRACT','COPY','TRANSCRIPT','CAPTION_SCRIPT','AUDIO_QC'].includes(r.kind))) {
    const bytes = await store.get(row.object_key, 1_000_000);
    requireThat(sha256(bytes) === row.sha256, 'REVIEW_EVIDENCE_CHANGED', '复核文本与封存内容不一致', 503);
    texts.push({ asset_id: row.id, sha256: row.sha256, kind: row.kind, content: new TextDecoder('utf-8', { fatal: true }).decode(bytes) });
  }
  requireThat(texts.filter(t => t.kind === 'CONTRACT').length === 1, 'REVIEW_CONTRACT_MISSING', '复核需要唯一的封存合同', 503);
  return { packet, text_evidence: texts,
    audio_evidence:rows.filter(r=>r.kind==='NATIVE_AUDIO'||r.kind==='FINAL_AUDIO').map(r=>({asset_id:r.id,sha256:r.sha256,kind:r.kind,
      artifact_id:r.artifact_id,mime_type:r.mime_type,semantic_review:'PENDING'})),
    visual_evidence: rows.filter(r => r.kind === 'CANDIDATE_IMAGE' || r.kind === 'VIDEO_FRAME')
    .map(r => ({ asset_id: r.id, sha256: r.sha256, kind: r.kind, artifact_id: r.artifact_id, frame_index: r.frame_index, time_ms: r.time_ms })) };
}
