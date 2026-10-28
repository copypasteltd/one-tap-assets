import type { DTO } from '../../shared/contracts/types.js';
import type { CreativePlan } from './plan.js';
import type { VariantSource } from '../../api/modules/catalog.js';
import { validateInternal } from '../../api/lib/validation.js';
import { requireThat } from '../../api/lib/errors.js';
import { hash } from '../../api/lib/crypto.js';
import type { CodexAdmission } from '../codex/admission.js';
import type { InferenceLimits } from '../codex/inference.js';
import type {RevisionPolicy} from '../revisions/contract.js';
import type {ArkContract} from '../providers/ark.js';

export interface ModelBinding { provider: string; actual_model: string; registry_version: string; roles: ('VISION_ANALYSIS' | 'IMAGE' | 'VIDEO' | 'SPEECH' | 'QC')[]; capability_hash: string; rate_snapshot_id: string }
export interface ResourceBinding { resource_version_id: string; license_record_id: string; hash: string }
export interface Snapshot {
  revision_policy_hash?:string;
  schema_version: '1.1.0'; order_id: string; tenant_id: string; product_id: string; photo_version: number; photo_set_hash: string;
  profile_id: string; profile_hash: string; identity_lock_id: string; identity_lock_hash: string; preset_id: string; preset_version: string;
  variant_id: string; variant_version: string; engine: DTO<'Engine'>; plan_hash: string; canonicalization: 'RFC8785';
  model_versions: ModelBinding[]; resource_versions: ResourceBinding[];
  reference_policy: { max_images: number; max_total_pixels: number; mapping_hash: string | null };
  audio_policy: { speech_mode: 'NONE' | 'NATIVE_ZH'; language: 'zh-CN' | null; native_voice_id: string | null; preserve_native_speech: boolean; caption_alignment: 'ACTUAL_AUDIO' | 'NO_SPEECH'; music_license_ids: string[]; ducking_enabled: boolean };
  timeline: { fps: 30; target_frames: number; shots: { shot_id: string; start_frame: number; end_frame: number; overlap_frames: number; evidence_ids: string[]; spoken_text: string }[] };
  outputs: (DTO<'OutputSlot'> & { format: 'png' | 'mp4-h264-yuv420p' | 'text' })[];
  pricing: { currency: 'CNY'; amount_fen: number; terms_version: string };
  budget: { currency: 'CNY'; ceiling_micro: number; repair_ceiling_micro: number; extra_calls_limit: number; max_repair_rounds: 1; retry_extends_deadline: false };
  fulfillable_at: string; deadline_at: string; policy_version: string; codex_contract: DTO<'CodexContract'>;
}
export interface FrozenContract {
  speech_contract?:import('../providers/dashscope-asr.js').SpeechContract;
  generation_contracts?:ArkContract[];
  revision_policy?:RevisionPolicy;
  product: DTO<'Product'>; profile: DTO<'Profile'>; photo_set_hash: string; identity_lock_hash: string;
  request: DTO<'PlanRequest'>; creative: CreativePlan; source: VariantSource; plan_hash: string;
  model_versions: ModelBinding[]; resource_versions: ResourceBinding[]; codex_contract: DTO<'CodexContract'>;
  budget_micro: number; repair_ceiling_micro: number;
  runtime_binding?: { admission: CodexAdmission; limits: InferenceLimits };
}
export function bindSnapshot(order: DTO<'Order'>, tenantId: string, contract: FrozenContract, now: string): Snapshot {
  const speech = contract.source.audio_policy.speech !== 'none';
  const deadline = new Date(Date.parse(now) + Number(contract.source.slo_policy && (contract.source.slo_policy as { hard_deadline_seconds: number }).hard_deadline_seconds) * 1000).toISOString();
  const snapshot: Snapshot = {
    schema_version: '1.1.0', order_id: order.order_id, tenant_id: tenantId, product_id: contract.product.product_id,
    photo_version: contract.profile.photo_version, photo_set_hash: contract.photo_set_hash, profile_id: contract.profile.profile_id,
    profile_hash: contract.profile.profile_hash, identity_lock_id: contract.profile.identity_lock_id, identity_lock_hash: contract.identity_lock_hash,
    preset_id: contract.request.preset_id, preset_version: contract.request.preset_version, variant_id: contract.request.variant_id, variant_version: contract.request.variant_version,
    engine: contract.source.engine, plan_hash: contract.plan_hash, canonicalization: 'RFC8785', model_versions: contract.model_versions,
    resource_versions: contract.resource_versions, reference_policy: { max_images: 5, max_total_pixels: 150_000_000, mapping_hash: null },
    audio_policy: { speech_mode: speech ? 'NATIVE_ZH' : 'NONE', language: speech ? 'zh-CN' : null,
      native_voice_id: contract.creative.native_voice_id, preserve_native_speech: speech, caption_alignment: speech ? 'ACTUAL_AUDIO' : 'NO_SPEECH', music_license_ids: [], ducking_enabled: false },
    timeline: { fps: 30, target_frames: contract.creative.target_frames, shots: contract.creative.shots.map(({ shot_id, start_frame, end_frame, overlap_frames, evidence_ids, spoken_text }) => ({ shot_id, start_frame, end_frame, overlap_frames, evidence_ids, spoken_text })) },
    outputs: order ? contract.source.output_slots.map(s => ({ slot_id: s.slot_id, kind: s.kind, count: 1, width: s.width, height: s.height, fps: s.kind === 'video' ? 30 : null, duration_frames: s.kind === 'video' ? contract.creative.target_frames : null, format: s.kind === 'video' ? 'mp4-h264-yuv420p' : 'png' })) : [],
    pricing: { currency: 'CNY', amount_fen: order.amount_fen, terms_version: 'YPCC-TERMS-3.1' },
    budget: { currency: 'CNY', ceiling_micro: contract.budget_micro, repair_ceiling_micro: contract.repair_ceiling_micro, extra_calls_limit: 20, max_repair_rounds: 1, retry_extends_deadline: false },
    fulfillable_at: now, deadline_at: deadline, policy_version: 'YPCC-EXECUTION-3.1', codex_contract: contract.codex_contract,
  };
  snapshot.outputs.push({ slot_id: 'copy', kind: 'copy', count: 1, width: null, height: null, fps: null, duration_frames: null, format: 'text' });
  if(contract.revision_policy)snapshot.revision_policy_hash=hash(contract.revision_policy);
  validateInternal('execution-snapshot', snapshot);
  requireThat(snapshot.codex_contract.agent_cost_ceiling_micro <= snapshot.budget.ceiling_micro, 'BUDGET_INVALID', 'Agent预算不能超过订单总成本上限', 500);
  return snapshot;
}
export function contractHash(contract: FrozenContract): string { return hash(contract); }
