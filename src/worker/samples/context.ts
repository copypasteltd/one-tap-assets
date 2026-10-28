import type { Db } from '../../api/db/pool.js';
import type { Config } from '../../api/config.js';
import type { DTO } from '../../shared/contracts/types.js';
import type { VariantSource } from '../../api/modules/catalog.js';
import { hash, addSeconds } from '../../api/lib/crypto.js';
import { requireThat, notFound } from '../../api/lib/errors.js';
import { validate } from '../../api/lib/validation.js';
import { codexAdmission, checkAdmission, type CodexAdmission } from '../codex/admission.js';
import { bundleForHash } from '../codex/skills.js';
import type { InferenceLimits } from '../codex/inference.js';
import { basePlan, validateCreativePlan, type CreativePlan } from '../compiler/plan.js';
import { FONT_BINDING, verifyResourceLicenses } from '../media/font.js';

export const SAMPLE_STAGES = ['SAMPLE', 'SAMPLE_PRODUCTION', 'SAMPLE_POST', 'SAMPLE_QC', 'SAMPLE_REVIEW_FACTS', 'SAMPLE_REVIEW_STYLE', 'SAMPLE_COMPLETE'] as const;
export interface SampleInput {
  sample_id: string; tenant_id: string; owner_id: string; draft_id: string; draft_revision: number;
  request: DTO<'SampleRequest'>; profile: DTO<'Profile'>; source: VariantSource; config_hash: string;
  source_hash: string; photo_version_id: string; photo_set_hash: string; identity_lock_hash: string;
  deadline_at: string; skill_variant_id: string; bundle_hash: string;
  admission: CodexAdmission; limits: InferenceLimits;
}
export interface SampleContext { input: SampleInput; inputHash: string; state: string; private: Record<string, unknown> }

export async function freezeSample(db: Db, cfg: Config, subject: { tenantId: string; userId: string }, sampleId: string,
  draft: DTO<'PresetDraft'>, request: DTO<'SampleRequest'>, profile: DTO<'Profile'>, compiled: { source: VariantSource; source_hash: string }): Promise<SampleInput> {
  const budget = cfg.samples;
  requireThat(budget.costCeilingMicro > 0 && budget.dailyBudgetMicro >= budget.costCeilingMicro && budget.maxConcurrent > 0
    && budget.maxConcurrent <= 20 && budget.deadlineSeconds >= 60 && budget.deadlineSeconds <= 86400, 'SAMPLE_LIMITS_NOT_CONFIGURED', '样例制作额度尚未配置', 503);
  requireThat(compiled.source.engine === 'PHOTO_LAYOUT' && compiled.source.audio_policy.speech === 'none'
    && ['none','approved_licensed_or_contract_silent'].includes(compiled.source.audio_policy.music) && draft.config.resource_version_ids.length === 0,
  'SAMPLE_ROUTE_UNAVAILABLE', '所选样例路线或资源尚未接入，不能替换为其他效果', 503);
  await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`sample-quota:${subject.tenantId}:${subject.userId}`]);
  const active = (await db.query<{ n: string }>(`SELECT count(*) AS n FROM public_samples WHERE tenant_id=$1 AND owner_id=$2 AND state IN ('QUEUED','GENERATING')`, [subject.tenantId, subject.userId])).rows[0]!;
  requireThat(Number(active.n) < budget.maxConcurrent, 'SAMPLE_CONCURRENCY_LIMIT', '当前样例仍在制作，请完成后再申请', 429);
  const admission = await codexAdmission(cfg); const bundle = await bundleForHash(cfg, compiled.source.skill_bundle.hash);
  const registered = (await db.query<{ state: string }>('SELECT state FROM skill_bundles WHERE bundle_hash=$1', [bundle.sha256])).rows[0];
  requireThat(registered?.state === 'ADMITTED' || (cfg.devMode && cfg.env !== 'production'), 'SKILL_BUNDLE_NOT_ADMITTED', '样例风格 Skill 尚未完成准入', 503);
  requireThat(admission.review_vision, 'REVIEW_VISION_NOT_ADMITTED', '样例独立视觉复核尚未配置', 503);
  const photo = (await db.query<{ id: string; photo_set_hash: string }>('SELECT id,photo_set_hash FROM product_photo_versions WHERE tenant_id=$1 AND product_id=$2 AND revision=$3',
    [subject.tenantId, request.product_id, profile.photo_version])).rows[0] ?? notFound();
  const lock = (await db.query<{ hash: string }>('SELECT hash FROM identity_locks WHERE tenant_id=$1 AND id=$2 AND profile_id=$3', [subject.tenantId, profile.identity_lock_id, profile.profile_id])).rows[0] ?? notFound();
  await verifyResourceLicenses(db, [FONT_BINDING], true);
  validateCreativePlan(basePlan(profile, compiled.source), profile, compiled.source);
  return { sample_id: sampleId, tenant_id: subject.tenantId, owner_id: subject.userId, draft_id: draft.draft_id, draft_revision: draft.revision,
    request, profile: structuredClone(profile), source: structuredClone(compiled.source), config_hash: hash(draft.config), source_hash: compiled.source_hash,
    photo_version_id: photo.id, photo_set_hash: photo.photo_set_hash, identity_lock_hash: lock.hash, deadline_at: addSeconds(budget.deadlineSeconds),
    skill_variant_id: bundle.payload.variant_id, bundle_hash: bundle.sha256, admission,
    limits: { max_requests: cfg.codex.maxTurns * 5, max_requests_per_role: cfg.codex.maxTurns, max_input_tokens: cfg.codex.maxInputTokens,
      max_output_tokens: cfg.codex.maxOutputTokens, ceiling_micro: budget.costCeilingMicro, daily_ceiling_micro: budget.dailyBudgetMicro, owner_id: subject.userId } };
}

/** A sample has its own frozen context and cost scope, never a fabricated payment. */
export async function sampleContext(db: Db, tenantId: string, sampleId: string, inputHash?: string, lock = false, completed = false): Promise<SampleContext> {
  const row = (await db.query<{ owner_id: string; state: string; private: Record<string, unknown> }>(`SELECT owner_id,state,private FROM public_samples WHERE tenant_id=$1 AND id=$2${lock ? ' FOR UPDATE' : ''}`, [tenantId, sampleId])).rows[0] ?? notFound();
  const frozen = row.private.execution as { input: SampleInput; hash: string } | undefined;
  requireThat(frozen && frozen.hash === hash(frozen.input) && (!inputHash || inputHash === frozen.hash), 'SAMPLE_SNAPSHOT_CHANGED', '样例冻结输入摘要不一致', 503);
  const input = frozen.input;
  requireThat(input.sample_id === sampleId && input.tenant_id === tenantId && input.owner_id === row.owner_id
    && input.limits.owner_id === row.owner_id && hash(input.source) === input.source_hash,
  'SAMPLE_SNAPSHOT_CHANGED', '样例作用域或制作来源不一致', 503);
  requireThat((completed ? row.state === 'READY' : ['QUEUED', 'GENERATING'].includes(row.state) && Date.parse(input.deadline_at) > Date.now()) && !row.private.media_revoked,
    'SAMPLE_NO_LONGER_EXECUTABLE', '样例制作已结束、到期或被撤销', 409);
  validate('Profile', input.profile, true);
  const { profile_hash, ...body } = input.profile;
  requireThat(hash(body) === profile_hash, 'PROFILE_HASH_MISMATCH', '样例商品档案摘要不一致', 503);
  const product = await db.query(`SELECT p.id FROM product_drafts p JOIN profile_versions v ON v.tenant_id=p.tenant_id AND v.product_id=p.id
    JOIN product_photo_versions ph ON ph.tenant_id=v.tenant_id AND ph.id=v.photo_version_id
    JOIN identity_locks l ON l.tenant_id=v.tenant_id AND l.profile_id=v.id
    WHERE p.tenant_id=$1 AND p.id=$2 AND p.owner_id=$3 AND p.deleted_at IS NULL AND p.expires_at>now()
    AND v.id=$4 AND v.profile_hash=$5 AND ph.id=$6 AND ph.photo_set_hash=$7 AND l.id=$8 AND l.hash=$9`,
  [tenantId, input.request.product_id, input.owner_id, input.profile.profile_id, input.profile.profile_hash, input.photo_version_id, input.photo_set_hash, input.profile.identity_lock_id, input.identity_lock_hash]);
  requireThat(product.rowCount === 1, 'SAMPLE_INPUT_UNAVAILABLE', '样例的原照片或商品证据已撤销', 409);
  const grants = (await db.query<{ scope: string }>(`SELECT scope FROM rights_records WHERE tenant_id=$1 AND owner_id=$2 AND id=ANY($3)
    AND state IN ('SUBMITTED','VERIFIED') AND private->'product_ref'->>'product_id'=$4
    AND (private->'product_ref'->>'photo_version')::int=$5`, [tenantId, input.owner_id, input.request.rights_record_ids, input.request.product_id, input.profile.photo_version])).rows;
  requireThat(['OWNED_PRODUCT','SAMPLE_PUBLICATION'].every(scope => grants.some(g => g.scope === scope)), 'SAMPLE_RIGHTS_REVOKED', '样例使用或公开授权已撤销', 409);
  return { input, inputHash: frozen.hash, state: row.state, private: row.private };
}
export function samplePlan(context: SampleContext): CreativePlan {
  const plan = context.private.creative as CreativePlan | undefined;
  requireThat(plan && context.private.creative_hash === hash(plan), 'SAMPLE_PLAN_MISSING', '样例缺少已冻结的内容计划', 503);
  validateCreativePlan(plan, context.input.profile, context.input.source); return plan;
}
export function sampleAdmission(cfg: Config, context: SampleContext): CodexAdmission { return checkAdmission(cfg, context.input.admission); }
