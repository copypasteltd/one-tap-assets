import type { DTO } from '../../shared/contracts/types.js';
import { canonicalize } from '../../shared/domain/json.js';
import { sha256 } from '../../api/lib/crypto.js';
import { requireThat } from '../../api/lib/errors.js';
import { validate } from '../../api/lib/validation.js';

export const REVIEW_HASH_ALGORITHM = 'sha256-utf8-json-sortkeys-v1';
export const SEALED_FIELDS = ['packet_id', 'tenant_id', 'order_id', 'snapshot_hash', 'identity_lock_hash', 'skill_bundle_hash', 'qc_policy_version',
  'original_assets', 'evidence_assets', 'required_slot_ids', 'outputs', 'output_set_hash',
  'production_run_ids', 'production_thread_ids', 'production_process_refs'] as const;

/** The sealed DTO contains strings/arrays/objects only. Explicitly reject
 * floating numbers rather than accidentally claiming Python/RFC8785 parity. */
export function reviewHash(value: unknown): string {
  canonicalize(value); // Reject malformed Unicode, non-JSON values and prototypes.
  const compare = (a: string, b: string): number => {
    const x = Array.from(a, c => c.codePointAt(0)!); const y = Array.from(b, c => c.codePointAt(0)!);
    for (let i = 0; i < Math.min(x.length, y.length); i++) if (x[i] !== y[i]) return x[i]! - y[i]!;
    return x.length - y.length;
  };
  const encode = (v: unknown): string => {
    if (Array.isArray(v)) return `[${v.map(encode).join(',')}]`;
    if (v !== null && typeof v === 'object') return `{${Object.keys(v).sort(compare).map(k => `${JSON.stringify(k)}:${encode((v as Record<string, unknown>)[k])}`).join(',')}}`;
    if (typeof v === 'number') requireThat(Number.isSafeInteger(v) && !Object.is(v, -0), 'REVIEW_HASH_NUMBER_UNSUPPORTED', '审查摘要不能包含未定义的数值表示', 500);
    return JSON.stringify(v);
  };
  return sha256(encode(value));
}
export function packetHash(packet: Pick<DTO<'ReviewPacket'>, typeof SEALED_FIELDS[number]>): string {
  return reviewHash(Object.fromEntries(SEALED_FIELDS.map(k => [k, packet[k]])));
}
export function assertSealedPacket(packet: DTO<'ReviewPacket'>): void {
  validate('ReviewPacket', packet, true);
  requireThat(packet.output_set_hash === reviewHash(packet.outputs) && packet.packet_hash === packetHash(packet),
    'REVIEW_PACKET_CHANGED', '封存审查包或输出集合摘要不一致', 503);
  requireThat(new Set(packet.outputs.map(o => o.slot_id)).size === packet.required_slot_ids.length
    && packet.outputs.length === packet.required_slot_ids.length && packet.outputs.every(o => packet.required_slot_ids.includes(o.slot_id))
    && new Set(packet.outputs.map(o => o.asset_id)).size === packet.outputs.length
    && new Set(packet.evidence_assets.map(e => e.asset_id)).size === packet.evidence_assets.length,
  'REVIEW_PACKET_INCOMPLETE', '审查包缺少槽位或存在重复素材', 503);
}
/** Necessary structural checks only; publication must also validate the live
 * database, independent run evidence and actual bytes in its transaction. */
export function assertReviewConsensus(packet: DTO<'ReviewPacket'>): void {
  assertSealedPacket(packet);
  requireThat(packet.deterministic_pass && packet.evidence_complete && packet.unknown_paid_calls === 0,
    'REVIEW_PACKET_INCOMPLETE', '文件检查、证据或付费调用尚未完成', 409);
  const reports = packet.reports;
  requireThat(reports.length === 2 && new Set(reports.map(r => r.role)).size === 2,
    'INDEPENDENT_REVIEWS_REQUIRED', '需要事实与风格两份独立复核', 409);
  for (const field of ['run_id', 'thread_id', 'report_id', 'runtime_process_ref', 'isolation_evidence_id'] as const) {
    requireThat(new Set(reports.map(r => r[field])).size === 2, 'REVIEW_IDENTITY_REUSED', '独立复核不能复用运行身份', 409);
  }
  for (const r of reports) {
    requireThat(!packet.production_run_ids.includes(r.run_id) && !packet.production_thread_ids.includes(r.thread_id)
      && !packet.production_process_refs.includes(r.runtime_process_ref), 'REVIEW_CREATOR_CONTEXT', '制作上下文不能签发独立复核', 409);
    requireThat(r.tenant_id === packet.tenant_id && r.order_id === packet.order_id && r.packet_hash === packet.packet_hash
      && r.snapshot_hash === packet.snapshot_hash && r.output_set_hash === packet.output_set_hash && r.policy_version === packet.qc_policy_version,
    'REVIEW_REPORT_STALE', '复核报告不属于当前封存材料或规则', 409);
    requireThat(r.verdict === 'PASS' && r.evidence_complete && r.findings.length === 0,
      'REVIEW_NOT_PASSED', '复核未通过、证据不足或存在未解决问题', 409);
  }
}
