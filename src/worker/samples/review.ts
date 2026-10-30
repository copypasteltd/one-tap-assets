import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import type { Db } from '../../api/db/pool.js';
import { inside, type Config } from '../../api/config.js';
import { hash, sha256 } from '../../api/lib/crypto.js';
import { requireThat } from '../../api/lib/errors.js';
import type { ObjectStorage } from '../../api/storage/storage.js';
import { writePrivateObject } from '../../api/storage/private-objects.js';
import { extractEvidenceFrames, FRAME_SAMPLING_POLICY } from '../review/evidence.js';
import { FONT_BINDING, verifyResourceLicenses } from '../media/font.js';
import { inspectImage } from '../media/photo-pipeline.js';
import { checkReviewImages, type ReviewImage, type ReviewImageBinding, type ReviewInput } from '../codex/review-images.js';
import { bundleForHash } from '../codex/skills.js';
import { admissionHash } from '../codex/admission.js';
import { sampleAdmission, samplePlan, type SampleContext } from './context.js';
import { artifactBytes, storedMedia, verifyMedia, sampleGeneratedMaterial, type SampleArtifact } from './media.js';

interface PacketImage extends ReviewImageBinding { object_key: string; source_artifact_id: string; frame_index: number | null; time_ms: number | null }
export interface SamplePacket {
  sample_id: string; input_hash: string; output_set_hash: string; plan_hash: string; font_binding_hash: string;
  sampling_policy: string; artifacts: SampleArtifact[]; images: PacketImage[]; copy: string; packet_hash: string;
}
export interface SampleReview {
  packet_hash: string; role: 'REVIEW_FACTS' | 'REVIEW_STYLE'; verdict: 'PASS' | 'FAIL'; checked_asset_ids: string[];
  issues: { asset_id: string; code: string; message: string }[];
}
export const sampleReviewSchema = { type: 'object', additionalProperties: false, required: ['packet_hash','role','verdict','checked_asset_ids','issues'], properties: {
  packet_hash: { type: 'string', pattern: '^[a-f0-9]{64}$' }, role: { enum: ['REVIEW_FACTS','REVIEW_STYLE'] }, verdict: { enum: ['PASS','FAIL'] },
  checked_asset_ids: { type: 'array', minItems: 1, maxItems: 1100, uniqueItems: true, items: { type: 'string', maxLength: 128 } },
  issues: { type: 'array', maxItems: 100, items: { type: 'object', additionalProperties: false, required: ['asset_id','code','message'], properties: {
    asset_id: { type: 'string', maxLength: 128 }, code: { enum: ['FACT_MISMATCH','IDENTITY_DRIFT','TEXT','STYLE','QUALITY','SPEC','MISSING'] }, message: { type: 'string', minLength: 1, maxLength: 2000 } } } },
} };
const validReview = new Ajv2020({ strict: false }).compile<SampleReview>(sampleReviewSchema);
export function samplePacket(context: SampleContext): SamplePacket {
  const packet = context.private.qc_packet as SamplePacket | undefined;
  requireThat(packet, 'SAMPLE_QC_NOT_SEALED', '样例尚未完成实际文件验收', 503);
  const { packet_hash, ...body } = packet; const receipt = storedMedia(context, 'POST');
  requireThat(hash(body) === packet_hash && packet.input_hash === context.inputHash && packet.sample_id === context.input.sample_id
    && packet.output_set_hash === hash(receipt.artifacts) && packet.plan_hash === hash(samplePlan(context))
    && packet.font_binding_hash === hash(FONT_BINDING) && hash(packet.artifacts) === hash(receipt.artifacts),
  'SAMPLE_PACKET_CHANGED', '样例封存包与实际制作记录不一致', 503); return packet;
}
export const packetAssetIds = (packet: SamplePacket): string[] => [...new Set([...packet.artifacts.map(a => a.artifact_id), ...packet.images.map(i => i.asset_id)])];
export async function packetImages(db: Db, cfg: Config, store: ObjectStorage, context: SampleContext, packet: SamplePacket): Promise<ReviewImage[]> {
  const images: ReviewImage[] = [];
  for (const item of packet.images) {
    const registered = await db.query(`SELECT id FROM private_object_writes WHERE tenant_id=$1 AND owner_id=$2 AND product_id=$3 AND object_key=$4
      AND sha256=$5 AND kind IN ('QC','MEDIA') AND state='STORED' AND NOT delete_requested AND expires_at>now()`,
    [context.input.tenant_id, context.input.owner_id, context.input.request.product_id, item.object_key, item.sha256]);
    requireThat(registered.rowCount === 1 && item.object_key.startsWith(`${context.input.tenant_id}/samples/${context.input.sample_id}/`), 'SAMPLE_EVIDENCE_UNAVAILABLE', '样例复核画面不可用', 503);
    const bytes = await store.get(item.object_key, 30_000_000); images.push({ asset_id: item.asset_id, sha256: item.sha256, width: item.width, height: item.height, bytes });
  }
  await checkReviewImages(images, sampleAdmission(cfg, context)); return images;
}
export async function buildSamplePacket(db: import('pg').Pool, cfg: Config, store: ObjectStorage, context: SampleContext, signal: AbortSignal): Promise<SamplePacket> {
  const receipt = storedMedia(context, 'POST'); const plan = samplePlan(context);
  const directory = inside(cfg.runtimeRoot, `sample-qc/${context.input.sample_id}/${receipt.operation_id}`); await mkdir(directory, { recursive: true });
  try {
    await verifyResourceLicenses(db, [FONT_BINDING]); await verifyMedia(db, cfg, store, context, receipt, directory, signal);
    const images: PacketImage[] = [];
    if(context.input.generation){
      const material=await sampleGeneratedMaterial(db,cfg,store,context);
      for(const input of material.referenceMaterial.images){
        const key=`${context.input.tenant_id}/samples/${context.input.sample_id}/qc/${receipt.operation_id}/${input.asset_id}-reference.png`;
        await writePrivateObject(db,store,{tenantId:context.input.tenant_id,ownerId:context.input.owner_id,productId:context.input.request.product_id,kind:'QC'},key,input.bytes,'image/png');
        images.push({asset_id:input.asset_id,object_key:key,sha256:input.sha256,width:input.width,height:input.height,source_artifact_id:input.asset_id,frame_index:null,time_ms:null});
      }
    }
    for (const a of receipt.artifacts) {
      if (a.kind === 'copy') continue;
      const bytes = await artifactBytes(db, store, context, a);
      if (a.kind === 'image') images.push({ asset_id: a.artifact_id, object_key: a.object_key, sha256: a.sha256,
        width: a.inspection!.width!, height: a.inspection!.height!, source_artifact_id: a.artifact_id, frame_index: null, time_ms: null });
      else {
        const path = join(directory, `${a.artifact_id}.mp4`); await writeFile(path, bytes);
        const frames = await extractEvidenceFrames(cfg, path, join(directory, a.artifact_id), a.inspection!.frames!, plan.shots.flatMap(s => [s.start_frame,s.end_frame]), context.input.deadline_at, signal);
        for (const frame of frames) {
          const inspected = await inspectImage(frame.bytes); const frameId = `sampleframe_${sha256(`${a.artifact_id}:${frame.index}`).slice(0,32)}`;
          const key = `${context.input.tenant_id}/samples/${context.input.sample_id}/qc/${receipt.operation_id}/${frameId}.png`;
          await writePrivateObject(db, store, { tenantId: context.input.tenant_id, ownerId: context.input.owner_id, productId: context.input.request.product_id, kind: 'QC' }, key, frame.bytes, 'image/png');
          images.push({ asset_id: frameId, object_key: key, sha256: sha256(frame.bytes), width: inspected.width!, height: inspected.height!, source_artifact_id: a.artifact_id, frame_index: frame.index, time_ms: frame.timeMs });
        }
      }
    }
    const body = { sample_id: context.input.sample_id, input_hash: context.inputHash, output_set_hash: hash(receipt.artifacts), plan_hash: hash(plan),
      font_binding_hash: hash(FONT_BINDING), sampling_policy: FRAME_SAMPLING_POLICY, artifacts: receipt.artifacts, images, copy: plan.copy };
    const packet: SamplePacket = { ...body, packet_hash: hash(body) }; await packetImages(db, cfg, store, context, packet); return packet;
  } finally { await rm(inside(cfg.runtimeRoot, directory), { recursive: true, force: true }); }
}

export async function validateSampleReview(db: Db, cfg: Config, context: SampleContext, runId: string, raw: unknown, persisted = false): Promise<SampleReview> {
  requireThat(validReview(raw), 'SAMPLE_REVIEW_INVALID', '样例复核未返回完整结构', 422); const report = raw;
  const packet = samplePacket(context); const ids = packetAssetIds(packet);
  requireThat(report.packet_hash === packet.packet_hash && report.checked_asset_ids.length === ids.length && ids.every(i => report.checked_asset_ids.includes(i))
    && report.issues.every(i => ids.includes(i.asset_id)) && (report.verdict === 'PASS' ? report.issues.length === 0 : report.issues.length > 0),
  'SAMPLE_REVIEW_INCOMPLETE', '复核没有覆盖全部实际文件、画面或明确问题', 422);
  const run = (await db.query<{ instance_id: string; role: string; state: string; input_hash: string; output_hash: string | null; thread_id: string; runtime_process_ref: string; role_identity_ref: string;
    private: { stage_run_id: string; review_input: ReviewInput; runtime_admission: unknown; stage_result?: unknown };
    data: { loaded_skill_hashes: string[]; runtime_process_ref: string; role_identity_ref: string } }>('SELECT * FROM agent_runs WHERE tenant_id=$1 AND id=$2', [context.input.tenant_id, runId])).rows[0];
  requireThat(run && ['RUNNING','SUCCEEDED'].includes(run.state) && (!persisted || run.state === 'SUCCEEDED') && run.role === report.role
    && run.input_hash === context.inputHash && run.thread_id && run.runtime_process_ref && run.role_identity_ref
    && run.private.review_input?.packet_hash === packet.packet_hash && hash(run.private.review_input.images) === hash(packet.images.map(({ asset_id,sha256,width,height }) => ({ asset_id,sha256,width,height })))
    && hash(run.private.runtime_admission) === hash(context.input.admission), 'SAMPLE_REVIEW_IDENTITY_INVALID', '复核进程、上下文或封存输入不一致', 503);
  const stage = await db.query(`SELECT id FROM stage_runs WHERE tenant_id=$1 AND id=$2 AND scope_type='SAMPLE' AND scope_id=$3 AND stage_name=$4
    AND input_hash=$5`, [context.input.tenant_id, run.private.stage_run_id, context.input.sample_id, `SAMPLE_${report.role}`, context.inputHash]);
  const bundle = await bundleForHash(cfg, context.input.bundle_hash);
  requireThat(stage.rowCount === 1 && hash(run.data.loaded_skill_hashes) === hash(bundle.payload.roles[report.role].map(s => s.sha256)), 'SAMPLE_REVIEW_IDENTITY_INVALID', '复核缺少本阶段 Skill 与作用域证据', 503);
  const isolation = (await db.query<{ admission_hash: string; data: { mode: string; packet_hash: string; stage_run_id: string; isolation: string; virtualization: string; process_tree_bound: boolean; runtime_process_ref: string; role_identity_ref: string } }>(
    'SELECT admission_hash,data FROM agent_isolation_evidence WHERE tenant_id=$1 AND run_id=$2 AND instance_id=$3', [context.input.tenant_id, runId, run.instance_id])).rows[0];
  requireThat(isolation && isolation.admission_hash === admissionHash(context.input.admission) && isolation.data.packet_hash === packet.packet_hash
    && isolation.data.stage_run_id === run.private.stage_run_id && isolation.data.isolation === 'NATIVE_RESTRICTED_IDENTITY'
    && isolation.data.virtualization === 'FORBIDDEN' && isolation.data.process_tree_bound === true
    && isolation.data.runtime_process_ref === `process-${sha256(run.runtime_process_ref)}` && isolation.data.runtime_process_ref === run.data.runtime_process_ref
    && isolation.data.role_identity_ref === `identity-${sha256(run.role_identity_ref)}` && isolation.data.role_identity_ref === run.data.role_identity_ref
    && (isolation.data.mode === 'ADMITTED_NATIVE' || (cfg.env === 'test' && isolation.data.mode === 'SYNTHETIC_PROTOCOL')),
  'SAMPLE_REVIEW_IDENTITY_INVALID', '样例复核缺少受控原生运行证据', 503);
  const read = await db.query(`SELECT id FROM agent_tool_intents WHERE tenant_id=$1 AND run_id=$2 AND tool_name='extract_review_evidence'
    AND state='SUCCEEDED' AND data->'result'->>'packet_hash'=$3`, [context.input.tenant_id, runId, packet.packet_hash]);
  const inference = (await db.query<{ state: string; data: { review_packet_hash: string; review_image_binding_hash: string; review_image_hashes: string[] } }>(
    'SELECT state,data FROM inference_requests WHERE tenant_id=$1 AND run_id=$2', [context.input.tenant_id, runId])).rows;
  requireThat(read.rowCount! > 0 && inference.length > 0 && inference.every(i => i.state === 'SUCCEEDED' && i.data.review_packet_hash === packet.packet_hash
    && i.data.review_image_binding_hash === hash(run.private.review_input) && hash(i.data.review_image_hashes) === hash(packet.images.map(i => i.sha256))),
  'SAMPLE_REVIEW_EVIDENCE_MISSING', '复核没有完整读取封存材料或实际图片推理回执', 503);
  if (persisted) {
    const saved = (context.private.review_reports as Record<string, { run_id: string; report: SampleReview; hash: string }> | undefined)?.[report.role];
    requireThat(saved?.run_id === runId && saved.hash === hash(report) && hash(saved.report) === saved.hash
      && run.output_hash === saved.hash && hash(run.private.stage_result) === saved.hash, 'SAMPLE_REVIEW_NOT_PERSISTED', '样例复核报告与原运行检查点不一致', 503);
  }
  return report;
}
export async function validateSampleCompletion(db: Db, cfg: Config, context: SampleContext): Promise<void> {
  const reports = context.private.review_reports as Record<string, { run_id: string; report: SampleReview }> | undefined;
  requireThat(reports?.REVIEW_FACTS && reports.REVIEW_STYLE, 'SAMPLE_REVIEW_NOT_PASSED', '样例尚未完成独立双复核', 422);
  for (const role of ['REVIEW_FACTS','REVIEW_STYLE']) {
    const saved = reports[role]!; const report = await validateSampleReview(db, cfg, context, saved.run_id, saved.report, true);
    requireThat(report.verdict === 'PASS', 'SAMPLE_REVIEW_NOT_PASSED', '样例独立复核存在未解决问题', 422);
  }
  const runs = (await db.query<{ id: string; instance_id: string; thread_id: string; runtime_process_ref: string; role_identity_ref: string; state: string; role: string; input_hash: string; output_hash: string; private: { stage_result?: unknown;review_input?:{purpose?:string} } }>(`SELECT r.* FROM agent_runs r JOIN stage_runs s ON s.tenant_id=r.tenant_id AND s.id=(r.private->>'stage_run_id')
    WHERE s.tenant_id=$1 AND s.scope_type='SAMPLE' AND s.scope_id=$2`, [context.input.tenant_id, context.input.sample_id])).rows;
  const expected=context.input.generation?6:5;
  requireThat(runs.length === expected && ['CONTENT','PRODUCTION','POST','REVIEW_FACTS','REVIEW_STYLE'].every(role => runs.some(r => r.role === role && r.state === 'SUCCEEDED'))
    && runs.every(r => r.input_hash === context.inputHash && r.output_hash && hash(r.private.stage_result) === r.output_hash)
    && ['instance_id','thread_id','runtime_process_ref','role_identity_ref'].every(field => new Set(runs.map(r => r[field as keyof typeof r])).size === expected),
  'SAMPLE_ROLE_EVIDENCE_INCOMPLETE', '样例缺少完整独立且已完成的角色运行', 503);
  requireThat(runs.filter(r=>r.private.review_input?.purpose==='REFERENCE_IDENTITY').length===(context.input.generation?1:0),'SAMPLE_ROLE_EVIDENCE_INCOMPLETE','样例的独立参考核验数量不一致',503);
  const pending = await db.query(`SELECT id FROM inference_requests WHERE tenant_id=$1 AND run_id=ANY($2) AND state<>'SUCCEEDED'
    UNION ALL SELECT id FROM agent_tool_intents WHERE tenant_id=$1 AND run_id=ANY($2) AND state<>'SUCCEEDED'
    UNION ALL SELECT id FROM agent_instances WHERE tenant_id=$1 AND id=ANY($3) AND state<>'RELEASED'`,
  [context.input.tenant_id, runs.map(r => r.id), runs.map(r => r.instance_id)]);
  requireThat(pending.rowCount === 0, 'SAMPLE_SIDE_EFFECTS_UNRESOLVED', '样例仍有未决调用或未释放角色', 503);
}
