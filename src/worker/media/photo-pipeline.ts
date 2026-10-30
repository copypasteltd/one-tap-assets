import { isUtf8 } from 'node:buffer';
import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { writePrivateObject } from '../../api/storage/private-objects.js';
import type pg from 'pg';
import { inside, type Config } from '../../api/config.js';
import { hash, id, sha256 } from '../../api/lib/crypto.js';
import { requireThat } from '../../api/lib/errors.js';
import type { ObjectStorage } from '../../api/storage/storage.js';
import { executionContext, type ExecutionContext } from '../compiler/order-context.js';
import type { ToolScope } from '../tool-gateway/http.js';
import type { ToolLease, ToolResult } from '../tool-gateway/consumer.js';
import { inspectVideo, nativeCommand, type MediaInspection } from './native.js';
import { renderLayout } from './layout.js';
import { renderPhotoVideo } from './photo-video.js';
import { loadProductionFont, verifyResourceLicenses } from './font.js';
import {validatePlanLayout} from './plan-layout.js';
import {communityCaptionStyle} from '../compiler/community-direction.js';
import { artifactSetHash, claimMediaGeneration, commitMediaOperation, operationArtifacts, operationFor, originalMediaReceipt,
  type ArtifactSpec, type MediaOperation, type MediaPhase, type MediaReceipt, type PrivateArtifact } from './artifacts.js';

export const PHOTO_PIPELINE_VERSION = 'YPCC-PHOTO-PIPELINE-1.2.0';
export function assertMediaAlive(context: ExecutionContext, signal: AbortSignal): void {
  requireThat(!signal.aborted, 'TOOL_EXECUTION_INTERRUPTED', '媒体执行已停止', 409);
  requireThat(Date.parse(context.snapshot.deadline_at) > Date.now(), 'ORDER_DEADLINE_EXCEEDED', '原订单制作期限已结束', 409);
}
export async function inspectImage(bytes: Buffer): Promise<MediaInspection> {
  const image = sharp(bytes, { limitInputPixels: 4_000_000, failOn: 'warning' }); const meta = await image.metadata();
  requireThat(meta.format === 'png' && meta.width && meta.height && !meta.exif && !meta.xmp && (!meta.pages || meta.pages === 1),
    'MEDIA_IMAGE_INVALID', '图片编码、元数据或页数不符合规格', 422);
  await image.raw().toBuffer();
  return { kind: 'image', width: meta.width, height: meta.height, codec: 'png', pixelFormat: null,
    fps: null, frames: null, durationSeconds: null, hasAudio: false, audioCodec: null, bytes: bytes.length };
}
export function requiredSlots(context: ExecutionContext, phase: MediaPhase) {
  return context.snapshot.outputs.filter(slot => phase === 'POST' || slot.kind !== 'copy');
}
export function checkReceiptSlots(context: ExecutionContext, receipt: MediaReceipt): void {
  const slots = requiredSlots(context, receipt.phase);
  requireThat(slots.length === receipt.artifacts.length && new Set(receipt.artifacts.map(a => a.slot_id)).size === slots.length
    && slots.every(slot => slot.count === 1 && receipt.artifacts.some(a => a.slot_id === slot.slot_id && a.spec.kind === slot.kind)),
    'MEDIA_OUTPUT_INCOMPLETE', '媒体阶段缺少合同槽位或包含额外产物', 422);
}
export class PhotoMediaPipeline {
  protected readonly rendererVersion:string=PHOTO_PIPELINE_VERSION;
  constructor(protected pool: pg.Pool, protected cfg: Config, protected store: ObjectStorage) {}
  protected assertRoute(context:ExecutionContext):void{
    requireThat(context.snapshot.engine==='PHOTO_LAYOUT'&&context.snapshot.audio_policy.speech_mode==='NONE',
      'MEDIA_ROUTE_UNAVAILABLE','此执行器只承担原图无声路线',503);
  }
  async photos(context: ExecutionContext): Promise<Map<string, Buffer>> {
    const rows = (await this.pool.query<{ id: string; object_key: string; sha256: string }>(`SELECT a.id,a.object_key,a.sha256 FROM product_photo_items p
      JOIN assets a ON a.tenant_id=p.tenant_id AND a.id=p.asset_id WHERE p.tenant_id=$1 AND p.photo_version_id=$2
      AND a.owner_id=$3 AND a.product_id=$4 AND a.state='READY' AND a.expires_at>now() ORDER BY p.position`,
    [context.tenantId, context.photoVersionId, context.ownerId, context.snapshot.product_id])).rows;
    requireThat(rows.length >= 3 && rows.length <= 5 && hash({ photos: rows.map(a => ({ asset_id: a.id, sha256: a.sha256 })),
      revision: context.snapshot.photo_version, normalization: 'sharp-auto-orient-strip-png-v1' }) === context.snapshot.photo_set_hash,
      'INPUT_HASH_MISMATCH', '原订单照片集不完整或摘要不一致', 503);
    const photos = new Map<string, Buffer>();
    for (const row of rows) {
      const bytes = await this.store.get(row.object_key, 125_000_000);
      requireThat(sha256(bytes) === row.sha256, 'INPUT_HASH_MISMATCH', '原订单照片字节摘要不一致', 503); photos.set(row.id, bytes);
    }
    return photos;
  }
  protected async artifact(context: ExecutionContext, operation: MediaOperation, slotId: string, bytes: Buffer, spec: ArtifactSpec, _signal?:AbortSignal): Promise<PrivateArtifact> {
    const artifactId = id('artifact'); const extension = spec.kind === 'image' ? 'png' : spec.kind === 'video' ? 'mp4' : 'txt';
    const objectKey = `${context.tenantId}/media/${context.orderId}/${operation.id}/generation-${operation.generation}/${artifactId}.${extension}`;
    await writePrivateObject(this.pool, this.store, { tenantId: context.tenantId, ownerId: context.ownerId,
      productId: context.snapshot.product_id, orderId: context.orderId, kind: 'MEDIA' }, objectKey, bytes,
      spec.kind === 'image' ? 'image/png' : spec.kind === 'video' ? 'video/mp4' : 'text/plain; charset=utf-8');
    return { id: artifactId, slot_id: slotId, object_key: objectKey, sha256: sha256(bytes), spec };
  }
  protected spec(context: ExecutionContext, phase: MediaPhase, kind: ArtifactSpec['kind'], inspection: ArtifactSpec['inspection'], sourceAssets: string[], sourceArtifacts: string[] = []): ArtifactSpec {
    return { phase, kind, snapshot_hash: context.snapshotHash, plan_hash: context.snapshot.plan_hash,
      ...(context.repair?.plan_hash?{repair_plan_hash:context.repair.plan_hash}:{}),
      identity_lock_hash: context.snapshot.identity_lock_hash, renderer_version: this.rendererVersion,
      source_asset_ids: [...new Set(sourceAssets)].sort(), source_artifact_ids: [...new Set(sourceArtifacts)].sort(),
      resource_bindings: context.snapshot.resource_versions, inspection };
  }
  protected async videoInspection(context: ExecutionContext, path: string, signal: AbortSignal): Promise<MediaInspection> {
    assertMediaAlive(context, signal); const actual = await inspectVideo(this.cfg, path, signal);
    requireThat(actual.codec === 'h264' && actual.pixelFormat === 'yuv420p' && actual.width === 1080 && actual.height === 1920
      && actual.fps === 30 && actual.frames !== null && Math.abs(actual.frames - context.snapshot.timeline.target_frames) <= 1
      && !actual.hasAudio, 'MEDIA_CONTRACT_FAILED', '原图短片实际编码、帧数或音轨不符合原合同', 422);
    await nativeCommand(this.cfg, process.env.FFMPEG_PATH?.trim() || 'ffmpeg', ['-hide_banner', '-loglevel', 'error', '-xerror', '-nostdin',
      '-threads', '2', '-protocol_whitelist', 'file,pipe', '-i', path, '-map', '0:v:0', '-an', '-f', 'null', '-'],
    { cwd: this.cfg.runtimeRoot, timeoutMs: Math.max(1, Math.min(120000, Date.parse(context.snapshot.deadline_at) - Date.now())), signal });
    return actual;
  }
  async verify(context: ExecutionContext, receipt: MediaReceipt, directory: string, signal: AbortSignal, selected?: ReadonlySet<string>): Promise<void> {
    checkReceiptSlots(context, receipt);
    for (const artifact of receipt.artifacts) {
      if (selected && !selected.has(artifact.id)) continue;
      assertMediaAlive(context, signal);
      const bytes = await this.store.get(artifact.object_key, artifact.spec.kind === 'video' ? 512_000_000 : 30_000_000);
      requireThat(sha256(bytes) === artifact.sha256, 'ARTIFACT_HASH_MISMATCH', '私有产物字节与检查点不一致', 503);
      const slot = context.snapshot.outputs.find(s => s.slot_id === artifact.slot_id)!;
      requireThat(artifact.spec.snapshot_hash === context.snapshotHash && artifact.spec.plan_hash === context.snapshot.plan_hash
        && artifact.spec.repair_plan_hash === (context.repair?.plan_hash??undefined)
        && artifact.spec.identity_lock_hash === context.snapshot.identity_lock_hash && artifact.spec.renderer_version === this.rendererVersion
        && hash(artifact.spec.resource_bindings) === hash(context.snapshot.resource_versions),
        'MEDIA_RECEIPT_MISMATCH', '产物来源不属于冻结合同或执行器版本', 503);
      let actual: ArtifactSpec['inspection'];
      if (slot.kind === 'image') {
        actual = await inspectImage(bytes);
        requireThat(actual.width === slot.width && actual.height === slot.height, 'MEDIA_CONTRACT_FAILED', '图片实际尺寸不符合合同', 422);
      } else if (slot.kind === 'video') {
        const path = join(directory, `${artifact.id}.mp4`); await writeFile(path, bytes, { flag: 'wx' });
        actual = await this.videoInspection(context, path, signal);
      } else {
        requireThat(isUtf8(bytes) && bytes.toString('utf8') === context.contract.creative.copy, 'MEDIA_COPY_MISMATCH', '文案产物与已售计划不一致', 422);
        actual = { kind: 'copy', bytes: bytes.length, encoding: 'utf-8' };
      }
      requireThat(hash(actual) === hash(artifact.spec.inspection), 'MEDIA_INSPECTION_MISMATCH', '实际文件与原媒体检测记录不一致', 503);
    }
  }
  protected async produce(context: ExecutionContext, operation: MediaOperation, directory: string, signal: AbortSignal, _scope:ToolScope): Promise<PrivateArtifact[]> {
    const font = await loadProductionFont(this.cfg.projectRoot);
    const photos = await this.photos(context); const creative = context.contract.creative; const artifacts: PrivateArtifact[] = [];
    const configuredStyle = context.contract.source.creative_components.platform_style_id;
    const styleId = typeof configuredStyle === 'string' ? configuredStyle : context.snapshot.preset_id;
    for (const [index, slot] of context.snapshot.outputs.filter(s => s.kind === 'image').entries()) {
      assertMediaAlive(context, signal); const planned = creative.image_slots.find(s => s.slot_id === slot.slot_id)!;
      const photo = photos.get(planned.asset_id); requireThat(photo && slot.width && slot.height, 'PHOTO_MISSING', '缺少本单原始商品照片', 422);
      const bytes = await renderLayout(photo, { presetId: styleId, width: slot.width, height: slot.height,
        title: planned.title, subtitle: creative.copy, sequence: index + 1, total: creative.image_slots.length, font,...(communityCaptionStyle(context.contract.source)?{captionStyle:communityCaptionStyle(context.contract.source)!}:{}) });
      artifacts.push(await this.artifact(context, operation, slot.slot_id, bytes, this.spec(context, 'PRODUCTION', 'image', await inspectImage(bytes), [planned.asset_id])));
    }
    const video = await renderPhotoVideo(this.cfg, { directory: join(directory, 'shots'), plan: creative, presetId: styleId,
      photos, deadlineAt: context.snapshot.deadline_at, signal, font,...(communityCaptionStyle(context.contract.source)?{captionStyle:communityCaptionStyle(context.contract.source)!}:{}) });
    const inspection = await this.videoInspection(context, video.path, signal);
    for (const slot of context.snapshot.outputs.filter(s => s.kind === 'video')) {
      artifacts.push(await this.artifact(context, operation, slot.slot_id, video.bytes,
        this.spec(context, 'PRODUCTION', 'video', inspection, creative.shots.map(s => s.asset_id))));
    }
    return artifacts;
  }
  protected async post(context: ExecutionContext, operation: MediaOperation, source: MediaReceipt, directory: string, signal: AbortSignal, _scope:ToolScope): Promise<PrivateArtifact[]> {
    const artifacts: PrivateArtifact[] = [];
    for (const slot of requiredSlots(context, 'POST')) {
      assertMediaAlive(context, signal);
      if (slot.kind === 'copy') {
        const bytes = Buffer.from(context.contract.creative.copy, 'utf8');
        artifacts.push(await this.artifact(context, operation, slot.slot_id, bytes, this.spec(context, 'POST', 'copy',
          { kind: 'copy', bytes: bytes.length, encoding: 'utf-8' }, []),signal)); continue;
      }
      const original = source.artifacts.find(a => a.slot_id === slot.slot_id)!;
      const input = await this.store.get(original.object_key, slot.kind === 'video' ? 512_000_000 : 30_000_000);
      requireThat(sha256(input) === original.sha256, 'ARTIFACT_HASH_MISMATCH', '原制作产物已发生变化', 503);
      let bytes: Buffer; let inspection: MediaInspection;
      if (slot.kind === 'image') {
        bytes = await sharp(input, { limitInputPixels: 4_000_000, failOn: 'warning' }).png({ compressionLevel: 9 }).toBuffer();
        inspection = await inspectImage(bytes);
      } else {
        const inputPath = join(directory, `${id('input')}.mp4`); const outputPath = join(directory, `${id('final')}.mp4`);
        await writeFile(inputPath, input, { flag: 'wx' });
        await nativeCommand(this.cfg, process.env.FFMPEG_PATH?.trim() || 'ffmpeg', ['-hide_banner', '-loglevel', 'error', '-nostdin', '-y',
          '-threads', '2', '-filter_threads', '1', '-protocol_whitelist', 'file,pipe', '-i', inputPath, '-map', '0:v:0', '-map_metadata', '-1', '-map_chapters', '-1',
          '-an', '-c:v', 'libx264', '-threads', '2', '-preset', 'veryfast', '-crf', '20', '-r', '30', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', outputPath],
        { cwd: directory, timeoutMs: Math.max(1, Math.min(180000, Date.parse(context.snapshot.deadline_at) - Date.now())), signal });
        inspection = await this.videoInspection(context, outputPath, signal); bytes = await readFile(outputPath);
      }
      artifacts.push(await this.artifact(context, operation, slot.slot_id, bytes,
        this.spec(context, 'POST', slot.kind, inspection, original.spec.source_asset_ids, [original.id]),signal));
    }
    return artifacts;
  }
  async execute(scope: ToolScope, intent: ToolLease, phase: MediaPhase, signal: AbortSignal): Promise<ToolResult & { receipt: MediaReceipt; commit: (db: pg.PoolClient) => Promise<void> }> {
    requireThat(scope.order_id && scope.scope_type === 'ORDER' && scope.scope_id === scope.order_id && scope.role === phase && scope.stage_name === phase,
      'MEDIA_SCOPE_INVALID', '媒体工具只接受本单对应的制作阶段', 409);
    const context = await executionContext(this.pool, scope.tenant_id, scope.order_id, scope.snapshot_hash,scope.stage_run_id);
    await verifyResourceLicenses(this.pool, context.snapshot.resource_versions);
    this.assertRoute(context);
    assertMediaAlive(context, signal);
    await validatePlanLayout(context.contract.creative,context.contract.source,context.snapshot.preset_id,await loadProductionFont(this.cfg.projectRoot),context.contract.ai_disclosure_contract);
    const previous = phase === 'POST' ? await operationArtifacts(this.pool, context, 'PRODUCTION') : null;
    const inputHash = hash({ renderer_version: this.rendererVersion, phase, snapshot_hash: context.snapshotHash,
      creative: context.contract.creative, production_set_hash: previous ? artifactSetHash(previous.receipt.artifacts) : null });
    let operation = await operationFor(this.pool, scope, intent, phase, inputHash);
    const directory = inside(this.cfg.runtimeRoot, `media-work/${operation.id}/${id('attempt')}`); await mkdir(directory, { recursive: true });
    try {
      let receipt = await originalMediaReceipt(this.store, operation, context);
      if (!receipt) {
        operation = await claimMediaGeneration(this.pool, scope, intent, operation);
        if (previous) { const verifyDir = join(directory, 'verify-source'); await mkdir(verifyDir); await this.verify(context, previous.receipt, verifyDir, signal); }
        const artifacts = phase === 'PRODUCTION' ? await this.produce(context, operation, directory, signal, scope)
          : await this.post(context, operation, previous!.receipt, directory, signal, scope);
        receipt = { version: 'YPCC-MEDIA-1', operation_id: operation.id, phase, snapshot_hash: context.snapshotHash, input_hash: inputHash,
          artifacts: artifacts.sort((a, b) => a.slot_id.localeCompare(b.slot_id)) };
        checkReceiptSlots(context, receipt); assertMediaAlive(context, signal);
        await writePrivateObject(this.pool, this.store, { tenantId: context.tenantId, ownerId: context.ownerId,
          productId: context.snapshot.product_id, orderId: context.orderId, kind: 'MEDIA' },
          operation.manifest_key!, Buffer.from(JSON.stringify(receipt)), 'application/json');
      }
      const verifyDir = join(directory, 'verify-result'); await mkdir(verifyDir); await this.verify(context, receipt, verifyDir, signal);
      return { result: { operation_id: operation.id, output_set_hash: artifactSetHash(receipt.artifacts),
        outputs: receipt.artifacts.map(a => ({ artifact_id: a.id, slot_id: a.slot_id, kind: a.spec.kind, sha256: a.sha256 })) }, receipt,
      commit: db => commitMediaOperation(db, context, operation, receipt) };
    } finally { await rm(directory, { recursive: true, force: true }); }
  }
}
