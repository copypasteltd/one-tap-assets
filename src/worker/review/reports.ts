import { readFileSync } from 'node:fs';
import type { Config } from '../../api/config.js';
import type { Db } from '../../api/db/pool.js';
import { hash } from '../../api/lib/crypto.js';
import { requireThat } from '../../api/lib/errors.js';
import { validate } from '../../api/lib/validation.js';
import type { DTO } from '../../shared/contracts/types.js';
import type { ExecutionContext } from '../compiler/order-context.js';
import { admissionHash, checkAdmission, type CodexAdmission } from '../codex/admission.js';
import type { ReviewInput } from '../codex/review-images.js';
import { packetImageRefs } from './context.js';
import { assertSealedPacket } from './packet.js';

const packetSchema = JSON.parse(readFileSync('assets/development/v1.1/contracts/review-packet.schema.json', 'utf8')) as {
  properties: { reports: { items: object } };
};
export const reviewReportSchema = packetSchema.properties.reports.items;
interface ReviewRun {
  id: string; instance_id: string; thread_id: string; role: DTO<'ReviewReport'>['role']; state: string; input_hash: string; output_hash: string | null;
  data: { runtime_process_ref: string; role_identity_ref: string; skill_bundle_hash: string; loaded_skill_hashes: string[] };
  private: { stage_run_id: string; review_input: ReviewInput; runtime_admission: CodexAdmission; inference_limits: unknown; stage_result?: unknown };
}
export async function reviewIdentity(db: Db, cfg: Config, context: ExecutionContext, packet: DTO<'ReviewPacket'>, runId: string): Promise<{
  run: ReviewRun; template: Omit<DTO<'ReviewReport'>, 'verdict' | 'evidence_complete' | 'findings'>;
}> {
  assertSealedPacket(packet);
  const run = (await db.query<ReviewRun>(`SELECT r.* FROM agent_runs r JOIN agent_instances i ON i.id=r.instance_id AND i.tenant_id=r.tenant_id
    JOIN stage_runs s ON s.id=r.private->>'stage_run_id' AND s.tenant_id=r.tenant_id WHERE r.id=$1 AND r.tenant_id=$2
    AND i.order_id=$3 AND r.role IN ('REVIEW_FACTS','REVIEW_STYLE') AND s.stage_name=r.role AND s.scope_type='ORDER'
    AND s.scope_id=$3 AND s.input_hash=$4`, [runId, context.tenantId, context.orderId, context.snapshotHash])).rows[0];
  requireThat(run && ['RUNNING', 'SUCCEEDED'].includes(run.state) && run.thread_id && run.data.runtime_process_ref
    && run.input_hash === context.snapshotHash && run.data.skill_bundle_hash === packet.skill_bundle_hash
    && !packet.production_run_ids.includes(run.id) && !packet.production_thread_ids.includes(run.thread_id)
    && !packet.production_process_refs.includes(run.data.runtime_process_ref), 'REVIEW_RUN_INVALID', '独立复核缺少本单全新执行身份', 409);
  const admission = checkAdmission(cfg, run.private.runtime_admission);
  requireThat(admission.review_vision && context.contract.runtime_binding
    && hash(admission) === hash(context.contract.runtime_binding.admission)
    && hash(run.private.inference_limits) === hash(context.contract.runtime_binding.limits),
  'REVIEW_RUNTIME_CHANGED', '复核运行和费用绑定与已售合同不一致', 503);
  const isolation = (await db.query<{ id: string; admission_hash: string; data: {
    mode: string; runtime_process_ref: string; role_identity_ref: string; packet_hash: string; stage_run_id: string;
    isolation: string; virtualization: string; process_tree_bound: boolean; launcher_sha256: string;
  } }>('SELECT * FROM agent_isolation_evidence WHERE tenant_id=$1 AND run_id=$2 AND instance_id=$3', [context.tenantId, runId, run.instance_id])).rows[0];
  requireThat(isolation && isolation.admission_hash === admissionHash(admission) && isolation.data.packet_hash === packet.packet_hash
    && isolation.data.runtime_process_ref === run.data.runtime_process_ref && isolation.data.role_identity_ref === run.data.role_identity_ref
    && isolation.data.stage_run_id === run.private.stage_run_id && isolation.data.launcher_sha256 === admission.launcher_sha256
    && isolation.data.isolation === 'NATIVE_RESTRICTED_IDENTITY' && isolation.data.virtualization === 'FORBIDDEN' && isolation.data.process_tree_bound
    && (isolation.data.mode === 'ADMITTED_NATIVE' || cfg.env === 'test' && isolation.data.mode === 'SYNTHETIC_PROTOCOL'),
  'REVIEW_ISOLATION_UNVERIFIED', '独立复核没有对应的受限运行证据', 503);
  const skills = (await db.query<{ bundle_hash: string; data: { loaded_skills: { sha256: string }[] } }>(
    'SELECT bundle_hash,data FROM skill_load_evidence WHERE tenant_id=$1 AND run_id=$2', [context.tenantId, runId])).rows;
  requireThat(skills.length === 1 && skills[0]!.bundle_hash === packet.skill_bundle_hash && run.data.loaded_skill_hashes.length > 0
    && hash(skills[0]!.data.loaded_skills.map(s => s.sha256)) === hash(run.data.loaded_skill_hashes),
  'REVIEW_SKILLS_UNVERIFIED', '独立复核没有固定Skill实际加载证据', 503);
  const refs = await packetImageRefs(db, packet); const input = run.private.review_input;
  requireThat(input?.packet_hash === packet.packet_hash
    && hash(input.images.map(({ asset_id, sha256 }) => ({ asset_id, sha256 }))) === hash(refs),
  'REVIEW_IMAGE_INPUT_INCOMPLETE', '复核未绑定原图和全部候选画面', 503);
  return { run, template: { report_id: `report_${hash({ runId, packet: packet.packet_hash }).slice(0, 40)}`,
    tenant_id: context.tenantId, order_id: context.orderId, run_id: runId, thread_id: run.thread_id,
    runtime_process_ref: run.data.runtime_process_ref, isolation_evidence_id: isolation.id, role: run.role,
    packet_hash: packet.packet_hash, snapshot_hash: packet.snapshot_hash, output_set_hash: packet.output_set_hash, policy_version: packet.qc_policy_version } };
}
export async function validateReviewReport(db: Db, cfg: Config, context: ExecutionContext, packet: DTO<'ReviewPacket'>,
  runId: string, raw: unknown, allowRunning = false): Promise<DTO<'ReviewReport'>> {
  const report = validate('ReviewReport', raw, true); const { run, template } = await reviewIdentity(db, cfg, context, packet, runId);
  requireThat((run.state === 'SUCCEEDED' || allowRunning && run.state === 'RUNNING')
    && Object.entries(template).every(([key, value]) => report[key as keyof DTO<'ReviewReport'>] === value),
  'REVIEW_REPORT_BINDING_INVALID', '复核报告身份、摘要或规则不符合实际运行', 422);
  const allowed = new Set([...packet.original_assets, ...packet.evidence_assets, ...packet.outputs.map(o => ({ asset_id: o.asset_id }))].map(e => e.asset_id));
  requireThat(report.findings.every(f => f.evidence_ids.every(e => allowed.has(e))
    && (f.time_ms === null || f.time_ms <= Math.ceil(context.snapshot.timeline.target_frames * 1000 / 30)))
    && (report.verdict !== 'PASS' || report.evidence_complete), 'REVIEW_FINDING_INVALID', '问题引用了包外证据、无效时间码或不完整PASS', 422);
  const proof = (await db.query(`SELECT id FROM agent_tool_intents WHERE tenant_id=$1 AND run_id=$2 AND state='SUCCEEDED'
    AND tool_name='extract_review_evidence' AND data->'result'->>'packet_hash'=$3 AND data->'result'->>'output_set_hash'=$4`,
  [context.tenantId, runId, packet.packet_hash, packet.output_set_hash])).rows;
  requireThat(proof.length > 0, 'REVIEW_TOOL_PROOF_MISSING', '复核没有读取本包原始封存证据', 422);
  const requests = (await db.query<{ state: string; data: { review_packet_hash: string; review_image_binding_hash: string; review_image_hashes: string[] } }>(
    'SELECT state,data FROM inference_requests WHERE tenant_id=$1 AND run_id=$2', [context.tenantId, runId])).rows;
  requireThat(requests.length > 0 && requests.every(q => q.state === 'SUCCEEDED' && q.data.review_packet_hash === packet.packet_hash
    && q.data.review_image_binding_hash === hash(run.private.review_input)
    && hash(q.data.review_image_hashes) === hash(run.private.review_input.images.map(i => i.sha256))),
  'REVIEW_VISUAL_INFERENCE_UNVERIFIED', '复核没有全部实际画面的已结算推理回执', 503);
  if (!allowRunning) {
    const saved = (await db.query<{ data: DTO<'ReviewReport'>; evidence_hash: string }>(
      'SELECT data,evidence_hash FROM review_reports WHERE tenant_id=$1 AND id=$2 AND packet_id=$3 AND run_id=$4',
    [context.tenantId, report.report_id, packet.packet_id, runId])).rows[0];
    requireThat(saved && hash(saved.data) === hash(report) && run.output_hash === hash(report) && hash(run.private.stage_result) === hash(report)
      && saved.evidence_hash === hash(run.private.review_input), 'REVIEW_REPORT_NOT_PERSISTED', '复核结果缺少不可变持久报告', 503);
  }
  return report;
}
/** Only reports attached to successfully committed parent stages may authorize
 * publication. A current review can include its own pending stage commit. */
export async function packetReports(db: Db, cfg: Config, context: ExecutionContext, packet: DTO<'ReviewPacket'>,
  currentStageId: string | null = null): Promise<DTO<'ReviewReport'>[]> {
  const rows = (await db.query<{ run_id: string; data: DTO<'ReviewReport'> }>(`SELECT p.run_id,p.data FROM review_reports p
    JOIN agent_runs r ON r.tenant_id=p.tenant_id AND r.id=p.run_id AND r.state='SUCCEEDED'
    JOIN stage_runs s ON s.tenant_id=r.tenant_id AND s.id=r.private->>'stage_run_id'
    WHERE p.tenant_id=$1 AND p.packet_id=$2 AND s.scope_type='ORDER' AND s.scope_id=$3
    AND s.stage_name=p.role AND (s.state='SUCCEEDED' OR s.id=$4) AND s.private->>'role_run_id'=r.id
    ORDER BY p.role`, [context.tenantId, packet.packet_id, context.orderId, currentStageId])).rows;
  requireThat(rows.length <= 2 && new Set(rows.map(r => r.data.role)).size === rows.length,
    'REVIEW_IDENTITY_REUSED', '同一封存包存在重复的复核角色', 409);
  const reports: DTO<'ReviewReport'>[] = [];
  for (const row of rows) reports.push(await validateReviewReport(db, cfg, context, packet, row.run_id, row.data));
  return reports;
}
