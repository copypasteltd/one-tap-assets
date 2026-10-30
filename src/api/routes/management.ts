import { requestInstanceRelease } from '../../worker/lifecycle/instance-release.js';
import type { FastifyInstance, HTTPMethods } from 'fastify';
import type pg from 'pg';
import { readFile } from 'node:fs/promises';
import type { Config } from '../config.js';
import type { DTO, ManagementPrincipal, SchemaName } from '../../shared/contracts/types.js';
import { transaction, type Db } from '../db/pool.js';
import { authenticateManagement } from '../modules/identity.js';
import { validate, managementDocument } from '../lib/validation.js';
import { id, iso, hash, addSeconds } from '../lib/crypto.js';
import { insert, update, outbox, audit, type RecordRow, type Table } from '../db/store.js';
import { requireThat, notFound, AppError } from '../lib/errors.js';
import { requestRefundInternal } from '../modules/commerce.js';
import { getVariant, variantDto } from '../modules/catalog.js';
import { enqueueStage } from '../../worker/queue/enqueue.js';
import { cursor, limit } from '../lib/pagination.js';
import { publicationEvidence, compilePresetConfig, checkParentLicense } from '../modules/community.js';
import { license, registerLicense, decideLicense } from '../modules/licenses.js';
import { lockMediaOwner } from '../modules/media-access.js';
import { scheduleAuthorizedSamples, authorizedSample, verifyAuthorizedFiles } from '../modules/authorized-samples.js';
import {listManagedTickets,managedTicket,processTicket,supportEvidence} from '../modules/support-desk.js';
import {storage,type ObjectStorage} from '../storage/storage.js';

interface Endpoint { method: string; path: string; operation_id: string; permission: string; request_schema: SchemaName | null; response_schema: SchemaName }
interface Context { db: Db; cfg: Config; store:ObjectStorage; admin: ManagementPrincipal; params: Record<string, string>; body: unknown; traceId: string; query: { cursor?: string; limit?: string; state?:string } }
async function record<T>(db: Db, table: Table, resourceId: string, lock = false): Promise<RecordRow<T>> { return (await db.query<RecordRow<T>>(`SELECT * FROM ${table} WHERE id=$1${lock ? ' FOR UPDATE' : ''}`, [resourceId])).rows[0] ?? notFound(); }
async function action(c: Context, target: string, operation: string, state: DTO<'ManagementResult'>['state'] = 'ACCEPTED', reasons: string[] = []): Promise<DTO<'ManagementResult'>> {
  const data: DTO<'ManagementResult'> = { action_id: id('action'), resource_id: target, state, reason_codes: reasons, updated_at: iso() };
  await insert(c.db, 'management_actions', { id: data.action_id, actor: c.admin.actor, operation, target_id: target, data, private: { request_hash: hash(c.body) } }); return data;
}
function bundleDto(row: RecordRow<{ bundle_id: string; version: string; sha256: string; payload: { roles: Record<string, { sha256: string }[]> } }>): DTO<'SkillBundleResource'> {
  return { bundle_id: row.id, version: row.data.version, sha256: row.data.sha256, state: row.state as DTO<'SkillBundleState'>,
    signature_ref: typeof row.private?.signature_ref === 'string' ? row.private.signature_ref : null, evaluation_id: typeof row.private?.evaluation_id === 'string' ? row.private.evaluation_id : null,
    skill_hashes: [...new Set(Object.values(row.data.payload.roles).flatMap(s => s.map(x => x.sha256)))] };
}
async function lockActiveCommunityLicense(c: Context): Promise<void> {
  // License retirement takes this lock before variant locks as well.
  const source = (await c.db.query<{ license_version: string; source: string }>(`SELECT v.license_version,p.source
    FROM execution_variants x JOIN preset_versions v ON v.id=x.preset_version_id JOIN presets p ON p.id=v.preset_id
    WHERE x.variant_id=$1 AND x.version=$2`, [c.params.variant_id, c.params.version])).rows[0];
  if (source?.source === 'COMMUNITY') requireThat((await license(c.db, source.license_version, true)).state === 'ACTIVE', 'LICENSE_NOT_AVAILABLE', '当前许可已停止用于新交易', 422);
}
const handlers: Record<string, (c: Context) => Promise<unknown>> = {
  listManagedSupportTickets: async c => listManagedTickets(c.db,c.cfg,c.admin,c.query),
  getManagedSupportTicket: async c => managedTicket(c.db,c.admin,c.params.ticket_id!,c.traceId),
  processSupportTicket: async c => processTicket(c.db,c.admin,c.params.ticket_id!,validate('SupportProcessRequest',c.body)),
  readSupportEvidence: async c => supportEvidence(c.db,c.store,c.admin,c.params.ticket_id!,c.params.asset_id!,c.traceId),
  registerPresetLicense: async c => registerLicense(c.db, validate('PresetLicenseRegistration', c.body)),
  decidePresetLicense: async c => decideLicense(c.db, c.params.license_id!, validate('PresetLicenseDecision', c.body)),
  listReviewQueue: async c => {
    const size = limit(c.query.limit); const scope = 'management-publications'; const point = cursor.decode(c.cfg, c.query.cursor, scope);
    const rows = await c.db.query<{ id: string; created_at: Date; data: DTO<'Publication'> }>(`SELECT id,created_at,data FROM publications WHERE ($1::timestamptz IS NULL OR (created_at,id)<($1,$2)) ORDER BY created_at DESC,id DESC LIMIT $3`, [point?.createdAt ?? null, point?.id ?? null, size + 1]);
    const slice = rows.rows.slice(0, size); const last = slice.at(-1); return { items: slice.map(r => r.data), next_cursor: last && rows.rows.length > size ? cursor.encode(c.cfg, { createdAt: last.created_at.toISOString(), id: last.id }, scope) : null };
  },
  decidePublicationReview: async c => {
    const request = validate('ReviewDecisionRequest', c.body);
    const observed = await record<DTO<'Publication'>>(c.db, 'publications', c.params.publication_id!);
    await lockMediaOwner(c.db,observed.tenant_id,observed.owner_id!);
    if (request.decision === 'APPROVE') await license(c.db, (observed.private!.request as DTO<'PublicationRequest'>).license_version, true);
    const publication = await record<DTO<'Publication'>>(c.db, 'publications', c.params.publication_id!, true);
    requireThat(publication.data.revision === request.expected_revision && ['UNDER_REVIEW', 'CHANGES_REQUESTED'].includes(publication.data.state), 'REVIEW_STATE_CHANGED', '审核记录已更新');
    const original = publication.private!.request as DTO<'PublicationRequest'>;
    if (request.decision === 'APPROVE') {
      await publicationEvidence(c.db, c.cfg, { tenantId: publication.tenant_id, userId: publication.owner_id! }, publication.draft_id as string,
        Number(publication.draft_revision), publication.private!.config as DTO<'PresetConfig'>, original);
      requireThat(original.rights_record_ids.every(r => request.evidence_record_ids.includes(r)), 'RIGHTS_REVIEW_REQUIRED', '批准前必须逐项核对所有样例授权记录', 422);
      for (const rightsId of original.rights_record_ids) {
        const rights = await record<DTO<'RightsRecord'>>(c.db, 'rights_records', rightsId, true);
        requireThat(rights.tenant_id === publication.tenant_id && rights.owner_id === publication.owner_id && ['SUBMITTED', 'VERIFIED'].includes(rights.data.state), 'RIGHTS_SCOPE_INVALID', '授权记录归属或状态不匹配', 422);
        await update(c.db, 'rights_records', rightsId, { state: 'VERIFIED', revision: (rights.revision ?? 0) + 1, data: { ...rights.data, state: 'VERIFIED', updated_at: iso() }, private: { ...rights.private, decision_actor: c.admin.actor, decision_reason: request.reason }, updated_at: iso() }, rights.tenant_id);
      }
    }
    const state = { APPROVE: 'APPROVED', REQUEST_CHANGES: 'CHANGES_REQUESTED', REJECT: 'REJECTED' }[request.decision] as DTO<'Publication'>['state'];
    const data: DTO<'Publication'> = { ...publication.data, revision: publication.data.revision + 1, state, reason_codes: request.decision === 'APPROVE' ? [] : [request.decision], review_message: request.reason };
    const prepared = request.decision === 'APPROVE' ? await scheduleAuthorizedSamples(c.db,publication) : null;
    if (prepared) Object.assign(data,{ public_sample_state: 'PREPARING', public_sample_ids: prepared.ids, public_sample_expires_at: prepared.expiresAt });
    await update(c.db, 'publications', publication.id, { data, review_state: state, revision: data.revision,
      private: { ...publication.private, decision_actor: c.admin.actor, decision_reason: request.reason,
        ...(prepared ? { public_sample_preparation: { stage_id: prepared.stageId, input_hash: prepared.inputHash } } : {}) }, updated_at: iso() }, publication.tenant_id); return data;
  },
  publishApprovedPreset: async c => {
    requireThat(c.cfg.publishingEnabled, 'PUBLISHING_DISABLED', '社区发布尚未开放', 503);
    const request = validate('ManagementActionRequest', c.body);
    const observed = await record<DTO<'Publication'>>(c.db, 'publications', c.params.publication_id!);
    await lockMediaOwner(c.db,observed.tenant_id,observed.owner_id!);
    await license(c.db, (observed.private!.request as DTO<'PublicationRequest'>).license_version, true);
    const publication = await record<DTO<'Publication'>>(c.db, 'publications', c.params.publication_id!, true);
    if (publication.data.state === 'PUBLISHED') return publication.data;
    requireThat(publication.data.state === 'APPROVED', 'PUBLICATION_NOT_APPROVED', '当前预设尚未通过内容与权利审核', 422);
    const config = publication.private!.config as DTO<'PresetConfig'>; const sourceRequest = publication.private!.request as DTO<'PublicationRequest'>;
    requireThat(publication.data.public_sample_state === 'READY' && publication.data.public_sample_ids?.length === sourceRequest.sample_ids.length,
      'PUBLIC_SAMPLE_PREPARING', '独立公开样例尚未准备完整，请稍后查看', 422);
    const compiled = await compilePresetConfig(c.db,config); const terms = await license(c.db,sourceRequest.license_version);
    requireThat(terms.state === 'ACTIVE' && terms.content_hash === sourceRequest.license_content_hash, 'LICENSE_NOT_AVAILABLE', '当前许可已停止用于发布', 422);
    await checkParentLicense(c.db,config.parent_preset_version,terms.license_id);
    requireThat(hash(compiled) === hash(publication.private!.compiled_variants), 'PUBLICATION_SOURCE_CHANGED', '制作映射已变化，请重新生成样例并提交新版本', 422);
    const publicSamples = [];
    for (const sampleId of [...publication.data.public_sample_ids!].sort()) {
      const sample = await authorizedSample(c.db,sampleId,['READY'],true);
      requireThat(sample.publication_id === publication.id && sourceRequest.sample_ids.includes(sample.source_sample_id), 'PUBLIC_SAMPLE_BINDING_CHANGED', '公开样例来源与审核不一致', 422);
      await verifyAuthorizedFiles(c.db,c.cfg,sample); publicSamples.push(sample);
    }
    requireThat(new Set(publicSamples.map(s=>s.source_sample_id)).size === sourceRequest.sample_ids.length,
      'PUBLIC_SAMPLE_BINDING_CHANGED', '公开样例覆盖不完整', 422);
    const sources = compiled.map(x => x.source);
    const presetId = id('community'); const version = '1.0.0'; const versionId = `${presetId}.${version}`;
    const variants = sources.map((s, i) => ({ ...structuredClone(s), variant_id: `${presetId}.variant-${i + 1}`, version, name: `${config.name}·${s.name.split('·').at(-1)}` }));
    const summary: DTO<'PresetSummary'> = { preset_id: presetId, version, name: config.name, author_name: `创作者 ${publication.owner_id!.slice(-6)}`, source: 'COMMUNITY', style_tags: config.style_tags, sample_id: publicSamples[0]!.id, sample_label: 'AUTHORIZED_SAMPLE_NOT_YOUR_RESULT', sale_enabled: false };
    const detail: DTO<'PresetDetail'> = { preset: summary, description: config.description, variants: variants.map(variantDto), license_summary: `${terms.name}（${terms.version}）；${config.fork_allowed ? '允许在保留来源的条件下派生声明式方案' : '未开放派生'}。样例已单独审核。`, fork_allowed: config.fork_allowed, parent_version: config.parent_preset_version };
    await insert(c.db, 'presets', { id: presetId, author_id: publication.owner_id, source: 'COMMUNITY', current_version: version, data: summary });
    await insert(c.db, 'preset_versions', { id: versionId, preset_id: presetId, version, parent_version_id: publication.private!.parent_version_id ?? null, hash: hash(detail), license_version: sourceRequest.license_version, data: detail });
    for (const source of variants) await insert(c.db, 'execution_variants', { id: `${source.variant_id}.${version}`, preset_version_id: versionId, variant_id: source.variant_id, version, engine: source.engine, data: variantDto(source), private: { source, preset_id: presetId, community_config: config } });
    await c.db.query("UPDATE authorized_samples SET state='PUBLISHED',updated_at=now() WHERE tenant_id=$1 AND publication_id=$2 AND state='READY'", [publication.tenant_id,publication.id]);
    const data: DTO<'Publication'> = { ...publication.data, revision: publication.data.revision + 1, state: 'PUBLISHED', public_sample_state: 'PUBLISHED', preset_id: presetId, published_version: version, sale_enabled: false };
    await update(c.db, 'publications', publication.id, { data, review_state: 'PUBLISHED', published_version_id: versionId, revision: data.revision, updated_at: iso() }, publication.tenant_id); return data;
  },
  getManagedVariantVersion: async c => {
    const row = await getVariant(c.db, c.params.variant_id!, c.params.version!);
    return { resource_id: row.id, kind: 'VARIANT', revision: row.revision ?? 0, version: row.data.version, admission_state: row.data.admission_state, sale_enabled: row.data.sale_enabled,
      price_fen: row.data.price_fen, actual_model: null, model_version_ids: row.private.model_version_ids ?? [], evidence_set_id: typeof row.private.evidence_set_id === 'string' ? row.private.evidence_set_id : null, reason_codes: row.data.reason_codes } satisfies DTO<'ManagedVersion'>;
  },
  getManagedModelVersion: async c => {
    const row = (await c.db.query<{ id: string; actual_model: string; status: DTO<'AdmissionState'>; version: string; private: { revision?: number; evidence_set_id?: string } }>('SELECT * FROM provider_model_versions WHERE id=$1', [c.params.model_version_id])).rows[0] ?? notFound();
    return { resource_id: row.id, kind: 'MODEL', revision: row.private.revision ?? 0, version: row.version, admission_state: row.status, sale_enabled: row.status === 'ADMITTED', price_fen: null, actual_model: row.actual_model, model_version_ids: [row.id], evidence_set_id: row.private.evidence_set_id ?? null, reason_codes: [] } satisfies DTO<'ManagedVersion'>;
  },
  decideVariantAdmission: async c => {
    const request = validate('AdmissionDecisionRequest', c.body);
    if (request.action === 'ADMIT') await lockActiveCommunityLicense(c);
    const row = await getVariant(c.db, c.params.variant_id!, c.params.version!, true);
    requireThat(row.revision === request.expected_revision, 'REVISION_CONFLICT', '准入记录已更新');
    if (request.action === 'ADMIT') {
      const evidence = (await c.db.query<{ passed: boolean; variant_version_id: string; data: { full_pack_runs: number; includes_failures: boolean; critical_negative_misses: number; device_groups_passed: number; codex_fault_cases: number; signed_verified: boolean } }>('SELECT * FROM admission_evidence WHERE id=$1 AND kind=$2', [request.evidence_set_id, 'FULL_ADMISSION_SET'])).rows[0];
      requireThat(evidence?.variant_version_id === row.id && evidence.passed && evidence.data.signed_verified && evidence.data.full_pack_runs >= 30 && evidence.data.includes_failures && evidence.data.critical_negative_misses === 0 && evidence.data.device_groups_passed === 4 && evidence.data.codex_fault_cases >= 40, 'ADMISSION_EVIDENCE_INSUFFICIENT', '缺少完整实测、真机、隔离与成本准入证据', 422);
      requireThat(row.data.price_fen !== null && row.private.codex_contract && row.private.model_version_ids?.length, 'ADMISSION_CONFIGURATION_INCOMPLETE', '价格、模型和Codex合同尚未完成冻结', 422);
    }
    const data: DTO<'Variant'> = { ...row.data, admission_state: request.action === 'ADMIT' ? 'ADMITTED' : 'REJECTED', sale_enabled: false, reason_codes: request.action === 'ADMIT' ? [] : ['ADMISSION_REJECTED'] };
    await update(c.db, 'execution_variants', row.id, { data, admission_state: data.admission_state, sale_enabled: false, revision: request.expected_revision + 1, private: { ...row.private, evidence_set_id: request.evidence_set_id } }); return action(c, row.id, 'ADMISSION', 'COMPLETED');
  },
  changeVariantAvailability: async c => {
    const request = validate('AvailabilityRequest', c.body);
    if (request.action === 'RESUME') await lockActiveCommunityLicense(c);
    const row = await getVariant(c.db, c.params.variant_id!, c.params.version!, true);
    requireThat(row.revision === request.expected_revision, 'REVISION_CONFLICT', '销售记录已更新'); const sale = request.action === 'RESUME';
    requireThat(!sale || (row.data.admission_state === 'ADMITTED' && row.data.price_fen !== null && c.cfg.paymentsEnabled && c.cfg.codex.enabled), 'ADMISSION_REQUIRED', '当前规格不满足开售条件', 422);
    const data: DTO<'Variant'> = { ...row.data, sale_enabled: sale, reason_codes: sale ? [] : ['SALE_SUSPENDED'] };
    await update(c.db, 'execution_variants', row.id, { data, sale_enabled: sale, revision: request.expected_revision + 1 }); return action(c, row.id, 'SALE_STATUS', 'COMPLETED');
  },
  changeModelAvailability: async c => {
    const request = validate('AvailabilityRequest', c.body); const row = (await c.db.query<{ id: string; status: string; private: { revision?: number; admitted?: boolean } }>('SELECT * FROM provider_model_versions WHERE id=$1 FOR UPDATE', [c.params.model_version_id])).rows[0] ?? notFound();
    requireThat((row.private.revision ?? 0) === request.expected_revision, 'REVISION_CONFLICT', '模型记录已更新');
    requireThat(request.action !== 'RESUME' || row.private.admitted === true, 'ADMISSION_REQUIRED', '模型尚未通过能力与成本准入', 422);
    await update(c.db, 'provider_model_versions', row.id, { status: request.action === 'SUSPEND' ? 'SUSPENDED' : 'ADMITTED', private: { ...row.private, revision: request.expected_revision + 1 } });
    await c.db.query("UPDATE execution_variants SET sale_enabled=false,data=jsonb_set(data,'{sale_enabled}','false'),revision=revision+1 WHERE private->'model_version_ids' ? $1", [row.id]);
    return action(c, row.id, 'MODEL_AVAILABILITY', 'COMPLETED');
  },
  decideGovernanceReport: async c => {
    const request = validate('GovernanceDecisionRequest', c.body); const row = await record<DTO<'Report'>>(c.db, 'moderation_reports', c.params.report_id!, true);
    requireThat(row.data.revision === request.expected_revision, 'REVISION_CONFLICT', '举报已更新');
    const data: DTO<'Report'> = { ...row.data, state: request.decision === 'DISMISS' ? 'DISMISSED' : 'RESOLVED', revision: row.data.revision + 1, updated_at: iso() };
    await update(c.db, 'moderation_reports', row.id, { data, state: data.state, revision: data.revision, private: { ...row.private, decision: request, actor: c.admin.actor }, updated_at: iso() }, row.tenant_id);
    if (request.decision === 'SUSPEND_CONTENT') {
      await c.db.query("UPDATE presets SET visibility='SUSPENDED' WHERE id=$1", [data.preset_id]);
      await c.db.query("UPDATE execution_variants SET sale_enabled=false,data=jsonb_set(data,'{sale_enabled}','false'),revision=revision+1 WHERE preset_version_id IN (SELECT id FROM preset_versions WHERE preset_id=$1)", [data.preset_id]);
      await c.db.query("UPDATE public_samples SET visibility='PRIVATE',data=jsonb_set(data,'{visibility}','\"PRIVATE\"') WHERE private->>'publication_id' IN (SELECT id FROM publications WHERE data->>'preset_id'=$1)", [data.preset_id]);
    }
    return action(c, row.id, 'REPORT_DECISION', 'COMPLETED');
  },
  readRedactedOrderTrace: async c => {
    await record(c.db, 'orders', c.params.order_id!); const rows = await c.db.query<{ id: string; action: string; trace_id: string; occurred_at: Date }>('SELECT id,action,trace_id,occurred_at FROM audit_events WHERE target=$1 ORDER BY occurred_at DESC,id DESC LIMIT 100', [c.params.order_id]);
    return { order_id: c.params.order_id!, events: rows.rows.map(r => ({ event_id: r.id, kind: r.action, trace_id: r.trace_id, occurred_at: r.occurred_at.toISOString() })), next_cursor: null } satisfies DTO<'OrderTrace'>;
  },
  requestPlatformErrorRepair: async c => {
    const request = validate('ManagementActionRequest', c.body); const order = await record<DTO<'Order'>>(c.db, 'orders', c.params.order_id!, true);
    requireThat(order.data.fulfillment_state === 'DELIVERED' && order.data.delivery_expires_at && Date.parse(order.data.delivery_expires_at) > Date.now() && request.evidence_record_ids.length > 0, 'REPAIR_NOT_AVAILABLE', '平台纠错须有未过期的交付和问题证据', 422);
    const revision: DTO<'Revision'> = { revision_id: id('revision'), order_id: order.id, state: 'REQUESTED', consumes_user_allowance: false, result_manifest_revision: null };
    const manifest = (await c.db.query<{ revision: number; id: string }>('SELECT revision,id FROM delivery_manifests WHERE order_id=$1 ORDER BY revision DESC LIMIT 1', [order.id])).rows[0] ?? notFound();
    await insert(c.db, 'revision_requests', { id: revision.revision_id, tenant_id: order.tenant_id, owner_id: order.owner_id, order_id: order.id, parent_manifest_revision: manifest.revision, kind: 'PLATFORM_REPAIR', state: revision.state, consumes_user_allowance: false, data: revision, private: { request, manifest_id: manifest.id } });
    await enqueueStage(c.db, { tenantId: order.tenant_id, scopeType: 'REVISION', scopeId: revision.revision_id, name: 'REVISION', inputHash: hash(request), deadlineAt: addSeconds(600) }); return action(c, order.id, 'PLATFORM_REPAIR');
  },
  requestOriginalOrderCompensation: async c => {
    const request = validate('CompensationRequest', c.body); const order = await record<DTO<'Order'>>(c.db, 'orders', c.params.order_id!, true);
    if (request.action === 'REQUEST_ORIGINAL_REFUND') await requestRefundInternal(c.db, order.tenant_id, order.id, request.reason);
    else { requireThat(order.data.payment_state === 'CONFIRMED' && order.data.fulfillment_state !== 'DELIVERED', 'REPLAY_NOT_ALLOWED', '原订单当前无需重放', 422); await outbox(c.db, order.tenant_id, 'ReconcileOrder', order.id, `reconcile:${order.id}:${id('request')}`, { order_id: order.id }); }
    return action(c, order.id, request.action);
  },
  reconcileProviderSubmission: async c => { const row = await record(c.db, 'provider_submissions', c.params.submission_id!, true); await outbox(c.db, row.tenant_id, 'ProviderReconciliationRequested', row.id, `provider-query:${row.id}:${id('request')}`, { submission_id: row.id }); return action(c, row.id, 'QUERY_ORIGINAL_SUBMISSION'); },
  readOperationalSummary: async c => {
    const orders = (await c.db.query<{ paid: string; delivered: string; spent: string; p95: number | null }>("SELECT count(*) FILTER(WHERE payment_state='CONFIRMED') paid,count(*) FILTER(WHERE fulfillment_state='DELIVERED') delivered,coalesce(sum(spent_micro),0) spent,percentile_cont(.95) WITHIN GROUP(ORDER BY extract(epoch FROM updated_at-created_at)) FILTER(WHERE fulfillment_state='DELIVERED') p95 FROM orders WHERE created_at>now()-interval '30 days'")).rows[0]!;
    const counts = (await c.db.query<{ unknown: string; refunds: string; deadline: string }>("SELECT (SELECT count(*) FROM provider_submissions WHERE state='UNKNOWN') unknown,(SELECT count(*) FROM refunds WHERE state IN ('REQUESTED','PROCESSING','UNKNOWN')) refunds,(SELECT count(*) FROM stage_runs WHERE data->>'reason_code'='HARD_DEADLINE_EXCEEDED') deadline")).rows[0]!;
    const routes = await c.db.query<{ engine: string; p95: number }>("SELECT s.data->>'engine' engine,ceil(percentile_cont(.95) WITHIN GROUP(ORDER BY extract(epoch FROM m.delivered_at-(s.data->>'fulfillable_at')::timestamptz)))::integer p95 FROM delivery_manifests m JOIN execution_snapshots s ON s.order_id=m.order_id WHERE m.revision=1 GROUP BY s.data->>'engine'");
    const route = (engine: string): number | null => routes.rows.find(r => r.engine === engine)?.p95 ?? null;
    return { window_start: new Date(Date.now() - 30 * 86400000).toISOString(), window_end: iso(), paid_orders: Number(orders.paid), delivered_orders: Number(orders.delivered), unknown_submissions: Number(counts.unknown), refunds_pending: Number(counts.refunds), hard_deadline_failures: Number(counts.deadline), cost_currency: 'CNY', cost_micro_total: Number(orders.spent), automatic_pack_success_ratio: Number(orders.paid) ? Number(orders.delivered) / Number(orders.paid) : null, route_p95_seconds: { PHOTO_LAYOUT: route('PHOTO_LAYOUT'), PER_SHOT_AI: route('PER_SHOT_AI'), REFERENCE_FILM: route('REFERENCE_FILM') } } satisfies DTO<'MetricsSummary'>;
  },
  reconcilePrivacyDeletion: async c => { const row = await record(c.db, 'privacy_deletions', c.params.deletion_id!); await outbox(c.db, row.tenant_id, 'PrivacyDeletionRequested', row.id, `privacy-reconcile:${row.id}:${id('request')}`, { deletion_id: row.id }); return action(c, row.id, 'PRIVACY_RECONCILE'); },
  getManagementAction: async c => (await record<DTO<'ManagementResult'>>(c.db, 'management_actions', c.params.action_id!)).data,
  listAgentInstances: async c => { const rows = await c.db.query<{ data: DTO<'AgentInstance'> }>('SELECT data FROM agent_instances ORDER BY created_at DESC LIMIT 100'); return { items: rows.rows.map(r => r.data), next_cursor: null }; },
  getAgentInstance: async c => (await record<DTO<'AgentInstance'>>(c.db, 'agent_instances', c.params.instance_id!)).data,
  requestAgentRelease: async c => {
    const request = validate('AgentReleaseRequest', c.body); const row = await record<DTO<'AgentInstance'>>(c.db, 'agent_instances', c.params.instance_id!);
    requireThat(row.data.fencing_token === request.expected_fencing_token, 'FENCING_CONFLICT', '实例已更换执行代次');
    await requestInstanceRelease(c.db, row.tenant_id, row.id, 'SUSPEND', request.expected_fencing_token);
    return action(c, row.id, 'AGENT_RELEASE');
  },
  getAgentRun: async c => (await record<DTO<'AgentRun'>>(c.db, 'agent_runs', c.params.run_id!)).data,
  getReviewPacket: async c => (await record<DTO<'ReviewPacket'>>(c.db, 'review_packets', c.params.packet_id!)).data,
  listSkillBundles: async c => { const rows = await c.db.query<RecordRow<Parameters<typeof bundleDto>[0]['data']>>('SELECT * FROM skill_bundles ORDER BY id'); return { items: rows.rows.map(bundleDto), next_cursor: null }; },
  revokeSkillBundle: async c => {
    const request = validate('SkillBundleRevokeRequest', c.body); const row = await record<Parameters<typeof bundleDto>[0]['data']>(c.db, 'skill_bundles', c.params.bundle_id!, true);
    requireThat(row.data.sha256 === request.expected_bundle_hash, 'BUNDLE_HASH_CHANGED', 'Skill包摘要已变更'); await update(c.db, 'skill_bundles', row.id, { state: 'REVOKED' });
    await c.db.query("UPDATE execution_variants SET sale_enabled=false,data=jsonb_set(data,'{sale_enabled}','false'),revision=revision+1 WHERE private->'source'->'skill_bundle'->>'hash'=$1", [row.data.sha256]);
    const instances = await c.db.query<{ id: string; tenant_id: string }>("SELECT id,tenant_id FROM agent_instances WHERE data->>'skill_bundle_id'=$1 AND state<>'RELEASED'", [row.id]);
    for (const instance of instances.rows) await outbox(c.db, instance.tenant_id, 'ReleaseRequested', instance.id, `release:revoked:${instance.id}:${row.data.sha256}`, { instance_id: instance.id, reason: 'SUSPEND' }); return bundleDto({ ...row, state: 'REVOKED' });
  },
  getCleanupReceipt: async c => (await c.db.query<{ data: DTO<'CleanupReceipt'> }>('SELECT data FROM cleanup_receipts WHERE instance_id=$1 ORDER BY verified_at DESC LIMIT 1', [c.params.instance_id])).rows[0]?.data ?? notFound(),
};
export async function registerManagement(app: FastifyInstance, cfg: Config, pool: pg.Pool, store:ObjectStorage=storage(cfg)): Promise<void> {
  const catalog = JSON.parse(await readFile('assets/development/v1.1/contracts/management-endpoints.json', 'utf8')) as { endpoints: Endpoint[] };
  for (const e of catalog.endpoints) {
    const handler = handlers[e.operation_id]; if (!handler) throw new Error(`Missing management operation ${e.operation_id}`);
    app.route({ method: e.method as HTTPMethods, url: `/v1/internal/p01${e.path.replaceAll(/\{([^}]+)\}/g, ':$1')}`, handler: async (request, reply) => {
      reply.header('Cache-Control','no-store').header('Referrer-Policy','no-referrer');
      const admin = authenticateManagement(cfg, request.headers.authorization, e.permission); if (e.request_schema) validate(e.request_schema, request.body);
      const result = await transaction(pool, async db => {
        const params = request.params as Record<string, string>; const body = request.body ?? {}; const target = Object.values(params).join(':');
        const key = request.headers['idempotency-key']; const mutates = e.method !== 'GET';
        if (mutates) {
          requireThat(typeof key === 'string' && /^[A-Za-z0-9._:-]{8,128}$/.test(key), 'IDEMPOTENCY_REQUIRED', '管理操作需要幂等标识', 400);
          await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`${admin.actor}:${e.operation_id}:${target}:${key}`]);
          const prior = (await db.query<{ request_hash: string; response: unknown }>('SELECT request_hash,response FROM management_idempotency_records WHERE actor=$1 AND operation=$2 AND target_id=$3 AND key=$4', [admin.actor, e.operation_id, target, key])).rows[0];
          if (prior) { requireThat(prior.request_hash === hash(body), 'IDEMPOTENCY_CONFLICT', '相同管理请求标识不能用于不同内容'); return prior.response; }
        }
        const data = await handler({ db, cfg, store, admin, params, body, traceId: request.id, query: request.query as Context['query'] }); validate(e.response_schema, data, true);
        if (mutates) {
          await insert(db, 'management_idempotency_records', { actor: admin.actor, operation: e.operation_id, target_id: target, key, request_hash: hash(body), response: data });
          await audit(db, null, admin.actor, e.operation_id, target || 'global', body, request.id);
        }
        return data;
      });
      return reply.send({ data: result, trace_id: request.id });
    } });
  }
}
