import {PLUS_VIDEO_QC,plusVideoBinding} from '../../shared/domain/plus-video.js';
import type {Db} from '../../api/db/pool.js';
import type {DTO} from '../../shared/contracts/types.js';
import {hash,id} from '../../api/lib/crypto.js';
import {requireThat} from '../../api/lib/errors.js';
import type {FrozenContract,Snapshot} from '../compiler/snapshot.js';
import {GENERATED_QC_POLICY,NATIVE_AUDIO_QC_POLICY} from '../generation/contracts.js';

/** These operations preserve all image/video/audio bytes. Native orders must
 * additionally prove their frozen audio and original paid listening contract. */
export function limitedRevisionRoute(snapshot:Snapshot):boolean {
  if(snapshot.audio_policy.speech_mode==='NATIVE_ZH')return ['PER_SHOT_AI','REFERENCE_FILM'].includes(snapshot.engine)
    &&snapshot.codex_contract.qc_policy_version===NATIVE_AUDIO_QC_POLICY&&Boolean(snapshot.native_audio_contract_hash&&snapshot.listening_contract_hash);
  return snapshot.audio_policy.speech_mode==='NONE'&&snapshot.audio_policy.music_license_ids.length===0
    &&(snapshot.engine==='PHOTO_LAYOUT'?['YPCC-QC-PHOTO-1.0.0',PLUS_VIDEO_QC].includes(snapshot.codex_contract.qc_policy_version):
      ['PER_SHOT_AI','REFERENCE_FILM'].includes(snapshot.engine)&&snapshot.codex_contract.qc_policy_version===GENERATED_QC_POLICY);
}
import type {CodexAdmission} from '../codex/admission.js';
import type {InferenceLimits} from '../codex/inference.js';
import {STYLES} from '../media/layout.js';
import {FONT_BINDING} from '../media/font.js';
import {validateImageTextPolicy,type ImageTextPolicy} from './image-text.js';

export const REVISION_POLICY_VERSION='YPCC-LIMITED-REVISION-1';
export const REVISION_STAGES=['REVISION','REVISION_QC','REVISION_REVIEW_FACTS','REVISION_REVIEW_STYLE','REVISION_COMPLETE'] as const;
export interface RevisionPolicy {
  version:typeof REVISION_POLICY_VERSION;window_hours:48;deadline_seconds:300;max_successes:1;
  budget_micro:number;bundle_hash:string;skill_variant_id:string;
  admission:CodexAdmission;limits:InferenceLimits;image_text?:ImageTextPolicy;
}
export interface RevisionInput {
  revision_id:string;tenant_id:string;owner_id:string;order_id:string;product_id:string;
  request:DTO<'RevisionRequest'>;parent_manifest_id:string;parent_manifest_revision:number;parent_manifest_hash:string;
  original_snapshot_hash:string;original_contract_hash:string;policy_hash:string;deadline_at:string;delivery_expires_at:string;
  platform_error?:{ticket_id:string;ticket_revision:number;actor:string;evidence_hash:string};
}
/** Freeze before sale. No later configuration can increase a paid order's
 * aftercare limits; its actual price must be admitted with this cost included. */
export function freezeRevisionPolicy(contract:FrozenContract,skillVariantId=contract.source.variant_id):RevisionPolicy {
  const binding=contract.runtime_binding;const c=contract.codex_contract;
  requireThat(binding && Number.isSafeInteger(c.agent_cost_ceiling_micro) && c.agent_cost_ceiling_micro>0,
    'REVISION_CONTRACT_UNAVAILABLE','制作合同缺少受限修改的执行与费用能力',503);
  const policy:RevisionPolicy={version:REVISION_POLICY_VERSION,window_hours:48,deadline_seconds:300,max_successes:1,
    budget_micro:c.agent_cost_ceiling_micro,bundle_hash:c.skill_bundle_hash,skill_variant_id:skillVariantId,
    admission:structuredClone(binding.admission),limits:{...structuredClone(binding.limits),max_requests:c.max_turns_per_role*3,
      max_requests_per_role:c.max_turns_per_role,ceiling_micro:c.agent_cost_ceiling_micro,daily_ceiling_micro:c.agent_cost_ceiling_micro}};
  const styleId=contract.source.creative_components.platform_style_id;
  const style=STYLES[typeof styleId==='string'?styleId:contract.request.preset_id];
  const plus=contract.source.creative_components.plus_render;
  const imageTextSupported=!plusVideoBinding(contract.source)&&(!plus||contract.source.output_slots.filter(s=>s.kind==='image').every(s=>s.width>=640&&s.height>=640&&s.width<=1920&&s.height<=1920&&s.width*s.height<=4000000));
  if(imageTextSupported&&style&&contract.resource_versions.some(r=>hash(r)===hash(FONT_BINDING)))policy.image_text={version:'YPCC-IMAGE-TEXT-1',max_chars:28,
    max_lines:2,panel_fraction:0.22,font:{...FONT_BINDING},background:style.bg,ink:style.ink,accent:style.accent};
  validateRevisionPolicy(policy);return policy;
}
export function validateRevisionPolicy(policy:RevisionPolicy):void {
  if(policy?.image_text)validateImageTextPolicy(policy.image_text);
  requireThat(policy?.version===REVISION_POLICY_VERSION && policy.window_hours===48 && policy.deadline_seconds===300 && policy.max_successes===1
    && Number.isSafeInteger(policy.budget_micro) && policy.budget_micro>0 && policy.limits?.ceiling_micro===policy.budget_micro
    && policy.limits.daily_ceiling_micro===policy.budget_micro && typeof policy.limits.owner_id==='string' && policy.limits.owner_id.length>0
    && Number.isSafeInteger(policy.limits.max_requests_per_role) && policy.limits.max_requests_per_role!>0
    && Number.isSafeInteger(policy.limits.max_requests) && policy.limits.max_requests===policy.limits.max_requests_per_role!*3
    && /^[a-f0-9]{64}$/.test(policy.bundle_hash)
    && policy.admission && typeof policy.skill_variant_id==='string','REVISION_CONTRACT_UNAVAILABLE','原订单的受限修改合同缺失或不一致',503);
}
export async function ensureRevisionBudget(db:Db,scope:{tenantId:string;ownerId:string;orderId:string},policy:RevisionPolicy):Promise<void> {
  validateRevisionPolicy(policy);requireThat(policy.limits.owner_id===scope.ownerId,'REVISION_CONTRACT_UNAVAILABLE','受限修改费用归属不一致',503);
  await db.query(`INSERT INTO revision_budgets(id,tenant_id,owner_id,order_id,policy_hash,ceiling_micro)
    VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(tenant_id,order_id) DO NOTHING`,[id('revision-budget'),scope.tenantId,scope.ownerId,scope.orderId,hash(policy),policy.budget_micro]);
  requireThat((await db.query(`SELECT id FROM revision_budgets WHERE tenant_id=$1 AND owner_id=$2 AND order_id=$3 AND policy_hash=$4 AND ceiling_micro=$5`,
    [scope.tenantId,scope.ownerId,scope.orderId,hash(policy),policy.budget_micro])).rowCount===1,'REVISION_BUDGET_CHANGED','原订单受限修改费用快照不一致',503);
}
