import type {GenerationGateway} from '../generation/gateway.js';
import {sampleGenerationContext,sampleGenerationGateway} from './generation.js';
import {generatedOutputs,sourcesForSlot,type GenerationSource} from '../generation/outputs.js';
import {readReferenceApproval} from '../generation/reference-approval.js';
import {imageRequest,videoRequest} from '../generation/requests.js';
import {submitGenerationNode} from '../generation/execute.js';
import type {StageLease} from '../queue/leases.js';
import {frozenAiDisclosure} from '../compiler/disclosure.js';
import {disclosureRaster,markDisclosureImage,inspectDisclosure,type AiDisclosureProof} from '../media/disclosure.js';
import {assembleSilentGeneratedVideo} from '../generation/silent-video.js';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import type pg from 'pg';
import { transaction, type Db } from '../../api/db/pool.js';
import { inside, type Config } from '../../api/config.js';
import { hash, sha256, id } from '../../api/lib/crypto.js';
import { requireThat } from '../../api/lib/errors.js';
import { outputSlots } from '../../api/modules/catalog.js';
import type { ObjectStorage } from '../../api/storage/storage.js';
import { writePrivateObject } from '../../api/storage/private-objects.js';
import { toolScopeById, type ToolScope } from '../tool-gateway/http.js';
import { inspectImage } from '../media/photo-pipeline.js';
import { renderLayout } from '../media/layout.js';
import { renderPhotoVideo } from '../media/photo-video.js';
import { nativeCommand, inspectVideo, type MediaInspection } from '../media/native.js';
import { loadProductionFont, FONT_BINDING, verifyResourceLicenses } from '../media/font.js';
import { PendingExternal } from '../queue/leases.js';
import { sampleContext, samplePlan, type SampleContext } from './context.js';

export interface SampleArtifact {
  artifact_id: string; slot_id: string; kind: 'image' | 'video' | 'copy'; object_key: string;
  sha256: string; size_bytes: number; inspection: MediaInspection | null;
  generation_sources?:GenerationSource[];reference_approval_hash?:string;ai_disclosure?:AiDisclosureProof;
}
export interface SampleMediaReceipt { operation_id: string; phase: 'PRODUCTION' | 'POST'; snapshot_hash: string; artifacts: SampleArtifact[] }
const mime = (kind: SampleArtifact['kind']): string => kind === 'image' ? 'image/png' : kind === 'video' ? 'video/mp4' : 'text/plain; charset=utf-8';
export function storedMedia(context: SampleContext, phase: 'PRODUCTION' | 'POST'): SampleMediaReceipt {
  const value = context.private[phase.toLowerCase()] as SampleMediaReceipt | undefined;
  requireThat(value && context.private[`${phase.toLowerCase()}_hash`] === hash(value) && value.phase === phase && value.snapshot_hash === context.inputHash,
    'SAMPLE_MEDIA_MISSING', '样例缺少已完成且一致的实际媒体记录', 503);
  const expected = outputSlots(context.input.source).filter(s => phase === 'POST' || s.kind !== 'copy');
  requireThat(value.artifacts.length === expected.length && new Set(value.artifacts.map(a => a.slot_id)).size === expected.length
    && expected.every(s => value.artifacts.some(a => a.slot_id === s.slot_id && a.kind === s.kind)), 'SAMPLE_PACK_INCOMPLETE', '样例素材清单不完整', 422);
  return value;
}
export async function artifactBytes(db: Db, store: ObjectStorage, context: SampleContext, artifact: SampleArtifact): Promise<Buffer> {
  requireThat(artifact.object_key.startsWith(`${context.input.tenant_id}/samples/${context.input.sample_id}/`), 'SAMPLE_OBJECT_INVALID', '样例文件作用域不匹配', 503);
  const registered = await db.query(`SELECT id FROM private_object_writes WHERE tenant_id=$1 AND owner_id=$2 AND product_id=$3 AND object_key=$4
    AND sha256=$5 AND kind='MEDIA' AND state='STORED' AND NOT delete_requested AND expires_at>now()`,
  [context.input.tenant_id, context.input.owner_id, context.input.request.product_id, artifact.object_key, artifact.sha256]);
  requireThat(registered.rowCount === 1 && artifact.size_bytes > 0 && artifact.size_bytes <= 125_000_000, 'SAMPLE_OBJECT_INVALID', '样例文件登记不可用', 503);
  const bytes = await store.get(artifact.object_key, 125_000_000);
  requireThat(bytes.length === artifact.size_bytes && sha256(bytes) === artifact.sha256, 'SAMPLE_OBJECT_CHANGED', '样例实际文件已变化', 503); return bytes;
}
export async function sampleGeneratedMaterial(db:Db,cfg:Config,store:ObjectStorage,c:SampleContext){
  const stages=(await db.query<{id:string}>(`SELECT id FROM stage_runs WHERE tenant_id=$1 AND scope_type='SAMPLE' AND scope_id=$2
    AND stage_name='SAMPLE_PRODUCTION' AND input_hash=$3 AND state IN ('RUNNING','SUCCEEDED')`,[c.input.tenant_id,c.input.sample_id,c.inputHash])).rows;
  requireThat(stages.length===1,'SAMPLE_GENERATION_SCOPE_INVALID','样例缺少唯一原制作阶段',503);
  return generatedOutputs(db,cfg,store,sampleGenerationContext(c),stages[0]!.id);
}
export async function verifySampleGeneratedReceipt(db:Db,cfg:Config,store:ObjectStorage,c:SampleContext,receipt:SampleMediaReceipt){
  if(c.input.source.engine==='PHOTO_LAYOUT')return;
  const material=await sampleGeneratedMaterial(db,cfg,store,c),policy=frozenAiDisclosure(sampleGenerationContext(c).contract)!;
  for(const a of receipt.artifacts){
    if(a.kind==='copy'){requireThat(!a.generation_sources&&!a.reference_approval_hash&&!a.ai_disclosure,'GENERATED_PACK_SOURCE_INVALID','文案不能伪装成生成媒体',503);continue;}
    requireThat(a.generation_sources&&hash(a.generation_sources)===hash(sourcesForSlot(material,a.kind,a.slot_id))
      &&a.reference_approval_hash===hash(material.approval)&&a.ai_disclosure?.contract_hash===hash(policy)
      &&a.ai_disclosure.output_sha256===a.sha256,'GENERATED_PACK_SOURCE_INVALID','样例的原生成来源、参考核验或AI标识证明不一致',503);
    await artifactBytes(db,store,c,a);
  }
}
export async function verifyMedia(db: Db, cfg: Config, store: ObjectStorage, context: SampleContext, receipt: SampleMediaReceipt, directory: string, signal: AbortSignal): Promise<void> {
  await mkdir(directory, { recursive: true });
  await verifySampleGeneratedReceipt(db,cfg,store,context,receipt);
  const policy=context.input.generation?frozenAiDisclosure(sampleGenerationContext(context).contract):null;
  for (const artifact of receipt.artifacts) {
    requireThat(!signal.aborted, 'TOOL_EXECUTION_INTERRUPTED', '样例检测已停止', 409);
    const bytes = await artifactBytes(db, store, context, artifact);
    if (artifact.kind === 'copy') {
      requireThat(bytes.toString('utf8') === samplePlan(context).copy, 'SAMPLE_COPY_CHANGED', '实际文案与冻结计划不一致', 422); continue;
    }
    const slot = outputSlots(context.input.source).find(s => s.slot_id === artifact.slot_id)!;
    let actual: MediaInspection;
    if (artifact.kind === 'image') actual = await inspectImage(bytes);
    else { const path = join(directory, `${artifact.artifact_id}.mp4`); await writeFile(path, bytes); actual = await inspectVideo(cfg, path, signal); }
    requireThat(hash(actual) === hash(artifact.inspection) && actual.width === slot.width && actual.height === slot.height
      && (artifact.kind !== 'video' || (actual.codec === 'h264' && actual.pixelFormat === 'yuv420p' && actual.fps === slot.fps
        && actual.frames === slot.duration_frames && !actual.hasAudio)), 'SAMPLE_MEDIA_CONTRACT_FAILED', '实际样例文件不符合冻结规格', 422);
    if(policy){const proof=await inspectDisclosure(cfg,policy,bytes,{kind:artifact.kind,width:actual.width!,height:actual.height!,frames:samplePlan(context).target_frames,directory,deadline_at:context.input.deadline_at,signal});
      requireThat(hash(proof)===hash(artifact.ai_disclosure),'AI_DISCLOSURE_PROOF_INVALID','样例实际全部画面标识与原证明不一致',503);}
  }
}

/** Native deterministic work may recover original registered bytes. It never
 * retries a charged provider request or overwrites an uncertain object. */
export async function renderSample(pool: pg.Pool, cfg: Config, store: ObjectStorage, scope: ToolScope, phase: 'PRODUCTION' | 'POST', signal: AbortSignal, injected?:GenerationGateway): Promise<SampleMediaReceipt> {
  const operation = await transaction(pool, async db => {
    await toolScopeById(db, scope.capability_id, true); const c = await sampleContext(db, scope.tenant_id, scope.scope_id, scope.snapshot_hash, true);
    const operations = (c.private.native_operations ?? {}) as Record<string, { operation_id: string; input_hash: string }>;
    const inputHash = hash({ snapshot: c.inputHash, plan: samplePlan(c), phase }); const old = operations[phase];
    requireThat(!old || old.input_hash === inputHash, 'SAMPLE_OPERATION_CHANGED', '样例原制作意图不一致', 503);
    if (old) return { ...old, context: c };
    const value = { operation_id: id('sampleop'), input_hash: inputHash };
    await db.query(`UPDATE public_samples SET private=jsonb_set(private,'{native_operations}',$3::jsonb),updated_at=now() WHERE tenant_id=$1 AND id=$2`,
      [scope.tenant_id, scope.scope_id, JSON.stringify({ ...operations, [phase]: value })]); return { ...value, context: c };
  });
  const context = operation.context; const source = context.input.source; const plan = samplePlan(context);
  const directory = inside(cfg.runtimeRoot, `sample-work/${context.input.sample_id}/${operation.operation_id}/${scope.run_id}`);
  await mkdir(directory, { recursive: true });
  try {
    await verifyResourceLicenses(pool, [FONT_BINDING]); const font = await loadProductionFont(cfg.projectRoot);
    const saved = context.private[phase.toLowerCase()];
    if (saved) { const receipt = storedMedia(context, phase); await verifyMedia(pool, cfg, store, context, receipt, directory, signal); return receipt; }
    let material:Awaited<ReturnType<typeof generatedOutputs>>|undefined;
    const generated=context.input.source.engine!=='PHOTO_LAYOUT',gc=generated?sampleGenerationContext(context):null;
    const policy=gc?frozenAiDisclosure(gc.contract):null;
    if(generated&&phase==='PRODUCTION'){
      const lease=(await pool.query<StageLease>('SELECT * FROM stage_runs WHERE tenant_id=$1 AND id=$2',[scope.tenant_id,scope.stage_run_id])).rows[0]!;
      requireThat(String(lease.fencing_token)===String(scope.stage_fencing_token),'LEASE_LOST','样例原制作租约已变化',409);
      const {approval}=await readReferenceApproval(pool,cfg,store,gc!,lease.id);
      const requests=[...gc!.snapshot.outputs.filter(s=>s.kind==='image').map(s=>imageRequest(gc!,s.slot_id)),
        ...(gc!.snapshot.engine==='REFERENCE_FILM'?[videoRequest(gc!,approval,null)]:gc!.contract.creative.shots.map(s=>videoRequest(gc!,approval,s.shot_id)))];
      const gateway=injected??sampleGenerationGateway(pool,cfg,store);
      for(const request of requests){const result=await submitGenerationNode(pool,gateway,lease,request,signal);
        requireThat(result.state!=='FAILED','GENERATION_NODE_FAILED','样例原生成节点已失败，不能重新购买',503);
        if(result.state!=='SUCCEEDED')throw new PendingExternal(3,'GENERATION_PACK_PENDING');}
      material=await sampleGeneratedMaterial(pool,cfg,store,context);
    }
    const photos = new Map<string, Buffer>();
    if (phase === 'PRODUCTION'&&!generated) {
      const rows = (await pool.query<{ id: string; sha256: string; object_key: string }>(`SELECT a.id,a.sha256,a.object_key FROM product_photo_items p
        JOIN assets a ON a.tenant_id=p.tenant_id AND a.id=p.asset_id WHERE p.tenant_id=$1 AND p.photo_version_id=$2 AND a.product_id=$3
        AND a.owner_id=$4 AND a.state='READY' AND a.expires_at>now() ORDER BY p.position`,
      [scope.tenant_id, context.input.photo_version_id, context.input.request.product_id, context.input.owner_id])).rows;
      requireThat(rows.length >= 3 && rows.length <= 5 && hash({ photos: rows.map(a => ({ asset_id: a.id, sha256: a.sha256 })), revision: context.input.profile.photo_version,
        normalization: 'sharp-auto-orient-strip-png-v1' }) === context.input.photo_set_hash, 'SAMPLE_INPUT_CHANGED', '样例原照片集不完整或摘要不一致', 503);
      for (const row of rows) { const bytes = await store.get(row.object_key, 125_000_000); requireThat(sha256(bytes) === row.sha256, 'SAMPLE_INPUT_CHANGED', '原照片字节已变化', 503); photos.set(row.id, bytes); }
    }
    const prior = phase === 'POST' ? storedMedia(context, 'PRODUCTION') : null;
    const artifacts: SampleArtifact[] = []; let generatedVideo: Buffer | undefined;
    for (const slot of outputSlots(source).filter(s => phase === 'POST' || s.kind !== 'copy')) {
      requireThat(!signal.aborted && Date.parse(context.input.deadline_at) > Date.now(), 'SAMPLE_NO_LONGER_EXECUTABLE', '样例执行已停止或到期', 409);
      requireThat(slot.count === 1, 'SAMPLE_SLOT_UNSUPPORTED', '样例槽位尚不支持此数量', 503);
      const kind = slot.kind as SampleArtifact['kind']; const extension = kind === 'image' ? 'png' : kind === 'video' ? 'mp4' : 'txt';
      const artifactId = `sampleasset_${sha256(`${operation.operation_id}:${slot.slot_id}`).slice(0, 32)}`;
      const key = `${scope.tenant_id}/samples/${context.input.sample_id}/${operation.operation_id}/${artifactId}.${extension}`;
      const original = (await pool.query<{ state: string; sha256: string; delete_requested: boolean }>('SELECT state,sha256,delete_requested FROM private_object_writes WHERE tenant_id=$1 AND object_key=$2', [scope.tenant_id, key])).rows[0];
      let bytes: Buffer;
      if (original) {
        requireThat(!original.delete_requested && original.state !== 'ERASED', 'SAMPLE_OBJECT_INVALID', '样例原文件已撤销', 409);
        if (original.state !== 'STORED') throw new PendingExternal(5, 'SAMPLE_ORIGINAL_WRITE_UNRESOLVED');
        bytes = await store.get(key, 125_000_000); requireThat(sha256(bytes) === original.sha256, 'SAMPLE_OBJECT_CHANGED', '原样例写入字节不一致', 503);
      } else if (phase === 'PRODUCTION') {
        const style = source.creative_components.platform_style_id;
        requireThat(typeof style === 'string', 'SAMPLE_STYLE_UNAVAILABLE', '样例风格映射缺失', 503);
        if (kind === 'image') {
          const index = artifacts.filter(a => a.kind === 'image').length; const planned = plan.image_slots.find(s => s.slot_id === slot.slot_id)!;
          const photo = material?.outputs.get(`image:${slot.slot_id}`)?.bytes??photos.get(planned.asset_id); requireThat(photo && slot.width && slot.height, 'PHOTO_MISSING', '缺少样例原照片', 422);
          bytes = await renderLayout(photo, { presetId: style, width: slot.width, height: slot.height, title: planned.title, subtitle: plan.copy, sequence: index + 1, total: plan.image_slots.length, font,...(policy?{aiLabel:true,disclosure:policy}:{}) });
          if(policy)bytes=await markDisclosureImage(bytes,await disclosureRaster(cfg,policy,slot.width,slot.height));
        } else {
          requireThat(kind === 'video' && slot.width === 1080 && slot.height === 1920 && slot.fps === 30, 'SAMPLE_SLOT_UNSUPPORTED', '样例短片规格尚未接入', 503);
          generatedVideo ??= material?await assembleSilentGeneratedVideo(cfg,gc!,material,directory,signal):(await renderPhotoVideo(cfg, { directory: join(directory, 'shots'), plan, presetId: style, photos, deadlineAt: context.input.deadline_at, signal, font })).bytes;
          bytes = generatedVideo;
        }
      } else if (kind === 'copy') bytes = Buffer.from(plan.copy, 'utf8');
      else {
        const input = prior!.artifacts.find(a => a.slot_id === slot.slot_id && a.kind === kind); requireThat(input, 'SAMPLE_PACK_INCOMPLETE', '后期缺少原制作文件', 422);
        const raw = await artifactBytes(pool, store, context, input);
        if (kind === 'image') bytes = await sharp(raw, { limitInputPixels: 4_000_000, failOn: 'warning' }).png({ compressionLevel: 9 }).toBuffer();
        else {
          const inputPath = join(directory, `${artifactId}-input.mp4`); const outputPath = join(directory, `${artifactId}-post.mp4`); await writeFile(inputPath, raw);
          await nativeCommand(cfg, process.env.FFMPEG_PATH?.trim() || 'ffmpeg', ['-hide_banner','-loglevel','error','-nostdin','-y','-threads','2','-filter_threads','1','-protocol_whitelist','file,pipe','-i',inputPath,
            '-map','0:v:0','-an','-c:v','libx264','-threads','2','-preset','veryfast','-crf','21','-pix_fmt','yuv420p','-r','30','-map_metadata','-1','-movflags','+faststart',outputPath],
          { cwd: directory, timeoutMs: Math.max(1, Math.min(180000, Date.parse(context.input.deadline_at) - Date.now())), signal });
          bytes = await (await import('node:fs/promises')).readFile(outputPath);
        }
      }
      if (!original) await writePrivateObject(pool, store, { tenantId: scope.tenant_id, ownerId: context.input.owner_id, productId: context.input.request.product_id, kind: 'MEDIA' }, key, bytes, mime(kind));
      let inspection: MediaInspection | null = null;
      if (kind === 'image') inspection = await inspectImage(bytes);
      if (kind === 'video') { const path = join(directory, `${artifactId}-inspect.mp4`); await writeFile(path, bytes); inspection = await inspectVideo(cfg, path, signal); }
      const artifact:SampleArtifact={artifact_id:artifactId,slot_id:slot.slot_id,kind,object_key:key,sha256:sha256(bytes),size_bytes:bytes.length,inspection};
      if(generated&&kind!=='copy'){
        const original=prior?.artifacts.find(a=>a.slot_id===slot.slot_id)!;
        artifact.generation_sources=material?sourcesForSlot(material,kind,slot.slot_id):original.generation_sources!;
        artifact.reference_approval_hash=material?hash(material.approval):original.reference_approval_hash!;
        artifact.ai_disclosure=await inspectDisclosure(cfg,policy!,bytes,{kind,width:inspection!.width!,height:inspection!.height!,frames:plan.target_frames,directory,deadline_at:context.input.deadline_at,signal});
      }
      artifacts.push(artifact);
    }
    const receipt: SampleMediaReceipt = { operation_id: operation.operation_id, phase, snapshot_hash: context.inputHash, artifacts };
    await verifyMedia(pool, cfg, store, context, receipt, directory, signal); await verifyResourceLicenses(pool, [FONT_BINDING]); return receipt;
  } finally { await rm(inside(cfg.runtimeRoot, directory), { recursive: true, force: true }); }
}
