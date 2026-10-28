import type { Db } from '../db/pool.js';
import type { Config } from '../config.js';
import type { DTO, Principal } from '../../shared/contracts/types.js';
import { owned, insert, update, type RecordRow, type PageQuery } from '../db/store.js';
import { id, iso, hash, addSeconds } from '../lib/crypto.js';
import { notFound, requireThat } from '../lib/errors.js';
import { validateEvidenceAssets } from './support.js';
import { presetVersion, type VariantSource } from './catalog.js';
import { license } from './licenses.js';
import { verifySampleFiles } from './sample-evidence.js';
import { enqueueStage } from '../../worker/queue/enqueue.js';
import { freezeSample, SAMPLE_STAGES } from '../../worker/samples/context.js';
import { verifyCompletedSample } from '../../worker/samples/completion.js';
import { getProfile } from './products.js';
import { signDownload } from './delivery.js';
import { cursor, limit } from '../lib/pagination.js';

export async function listSamples(db: Db, cfg: Config, p: Principal, draftId: string, query: PageQuery): Promise<DTO<'SampleList'>> {
  await owned(db, 'preset_drafts', draftId, p);
  const scope = `draft-samples:${p.tenantId}:${p.userId}:${draftId}`; const size = limit(query.limit); const point = cursor.decode(cfg, query.cursor, scope);
  const rows = (await db.query<{ id: string; created_at: Date; data: DTO<'Sample'> }>(`SELECT id,created_at,data FROM public_samples
    WHERE tenant_id=$1 AND owner_id=$2 AND draft_id=$3 AND ($4::timestamptz IS NULL OR (created_at,id)<($4,$5))
    ORDER BY created_at DESC,id DESC LIMIT $6`, [p.tenantId, p.userId, draftId, point?.createdAt ?? null, point?.id ?? null, size + 1])).rows;
  const slice = rows.slice(0, size); const last = slice.at(-1);
  return { items: slice.map(r => r.data), next_cursor: rows.length > size && last ? cursor.encode(cfg, { createdAt: last.created_at.toISOString(), id: last.id }, scope) : null };
}
export async function listFavorites(db: Db, cfg: Config, p: Principal, query: PageQuery): Promise<DTO<'PresetSummaryList'>> {
  const scope = `favorites:${p.tenantId}:${p.userId}`; const size = limit(query.limit); const point = cursor.decode(cfg, query.cursor, scope);
  const rows = (await db.query<{ id: string; created_at: Date; data: DTO<'PresetSummary'>; sale_enabled: boolean }>(`SELECT f.id,f.created_at,p.data,
    EXISTS(SELECT 1 FROM preset_versions v JOIN execution_variants x ON x.preset_version_id=v.id WHERE v.preset_id=p.id AND v.version=p.current_version AND x.sale_enabled) AS sale_enabled
    FROM favorites f JOIN presets p ON p.id=f.preset_id WHERE f.tenant_id=$1 AND f.owner_id=$2 AND p.visibility='PUBLIC'
    AND ($3::timestamptz IS NULL OR (f.created_at,f.id)<($3,$4)) ORDER BY f.created_at DESC,f.id DESC LIMIT $5`,
  [p.tenantId, p.userId, point?.createdAt ?? null, point?.id ?? null, size + 1])).rows;
  const slice = rows.slice(0, size); const last = slice.at(-1);
  return { items: slice.map(r => ({ ...r.data, sale_enabled: r.sale_enabled })), next_cursor: rows.length > size && last ? cursor.encode(cfg, { createdAt: last.created_at.toISOString(), id: last.id }, scope) : null };
}
export async function listAuthorReports(db: Db, cfg: Config, p: Principal, query: PageQuery): Promise<DTO<'ReportList'>> {
  const scope = `author-reports:${p.tenantId}:${p.userId}`; const size = limit(query.limit); const point = cursor.decode(cfg, query.cursor, scope);
  const rows = (await db.query<{ id: string; created_at: Date; data: DTO<'Report'> }>(`SELECT r.id,r.created_at,r.data FROM moderation_reports r
    JOIN preset_versions v ON v.id=r.preset_version_id JOIN presets p ON p.id=v.preset_id WHERE p.author_id=$1
    AND ($2::timestamptz IS NULL OR (r.created_at,r.id)<($2,$3)) ORDER BY r.created_at DESC,r.id DESC LIMIT $4`,
  [p.userId, point?.createdAt ?? null, point?.id ?? null, size + 1])).rows;
  const slice = rows.slice(0, size); const last = slice.at(-1);
  return { items: slice.map(r => r.data), next_cursor: rows.length > size && last ? cursor.encode(cfg, { createdAt: last.created_at.toISOString(), id: last.id }, scope) : null };
}

export async function components(db: Db): Promise<DTO<'ComponentOptionList'>> {
  const rows = await db.query<{ data: DTO<'ComponentOption'> }>('SELECT data FROM component_versions ORDER BY type,id');
  return { items: rows.rows.map(r => r.data), next_cursor: null };
}
export async function blueprints(db: Db): Promise<DTO<'VariantBlueprintList'>> {
  const allowed = (await components(db)).items.map(c => c.component_version_id);
  const rows = await db.query<{ variant_id: string; engine: DTO<'Engine'>; data: DTO<'Variant'> }>('SELECT variant_id,engine,data FROM execution_variants WHERE preset_version_id IN (SELECT id FROM preset_versions WHERE preset_id IN (SELECT id FROM presets WHERE source=$1)) ORDER BY variant_id', ['OFFICIAL']);
  return { items: rows.rows.map(r => ({ blueprint_id: `blueprint.${r.variant_id}`, name: r.data.name, engine: r.engine, allowed_component_version_ids: allowed, admission_required: true })), next_cursor: null };
}
export async function resources(db: Db): Promise<DTO<'ResourceOptionList'>> {
  const rows = await db.query<{ data: DTO<'ResourceOption'> }>("SELECT data FROM resource_licenses WHERE revoked_at IS NULL AND (expires_at IS NULL OR expires_at>now()) AND data->>'usable'='true' ORDER BY id LIMIT 100");
  return { items: rows.rows.map(r => r.data), next_cursor: null };
}
export async function validatePresetConfig(db: Db, config: DTO<'PresetConfig'>): Promise<void> {
  const componentRows = (await components(db)).items; const blueprintRows = (await blueprints(db)).items; const resourceRows = (await resources(db)).items;
  requireThat(new Set(config.component_versions).size === config.component_versions.length && config.component_versions.every(c => componentRows.some(x => x.component_version_id === c)), 'COMPONENT_NOT_ALLOWED', '方案只能选择平台已审核的组件', 422);
  requireThat(config.variant_blueprint_ids.every(b => blueprintRows.some(x => x.blueprint_id === b)), 'BLUEPRINT_NOT_ALLOWED', '执行蓝本不可用', 422);
  requireThat(new Set(config.variant_blueprint_ids).size === config.variant_blueprint_ids.length && new Set(config.resource_version_ids).size === config.resource_version_ids.length,
    'DUPLICATE_COMPONENT', '制作规格和资源不能重复选择', 422);
  requireThat(config.resource_version_ids.every(r => resourceRows.some(x => x.resource_version_id === r && x.usable)), 'RESOURCE_NOT_ALLOWED', '方案包含未授权或已停用的资源', 422);
  requireThat(!/(?:https?:\/\/|file:\/\/|powershell|cmd\.exe|<script|ignore\s+previous|忽略.*(?:指令|规则))/i.test(`${config.name} ${config.description}`), 'COMMUNITY_CONTENT_REJECTED', '方案描述仅用于展示创意，不接受外部链接或执行指令', 422);
  const selected = componentRows.filter(c => config.component_versions.includes(c.component_version_id));
  requireThat(selected.filter(c => c.type === 'STYLE').length === 1, 'STYLE_REQUIRED', '请选择且只选择一种主风格', 422);
  requireThat(config.variant_blueprint_ids.every(b => {
    const blueprint = blueprintRows.find(x => x.blueprint_id === b)!;
    return selected.every(c => c.supported_engines.includes(blueprint.engine) && blueprint.allowed_component_version_ids.includes(c.component_version_id));
  }), 'COMPONENT_ENGINE_MISMATCH', '所选组件不支持全部制作规格，请调整组合', 422);
}
export async function submitRights(db: Db, p: Principal, request: DTO<'RightsRecordRequest'>): Promise<DTO<'RightsRecord'>> {
  requireThat(new Set(request.evidence_asset_ids).size === request.evidence_asset_ids.length, 'DUPLICATE_EVIDENCE', '证明图片不能重复选择', 422);
  await validateEvidenceAssets(db, p, request.evidence_asset_ids, 'RIGHTS_EVIDENCE');
  let productRef: { product_id: string; photo_version: number | null } | null = null;
  if (request.product_id) {
    requireThat(request.scope !== 'THIRD_PARTY_RESOURCE', 'RIGHTS_SCOPE_INVALID', '商品授权和第三方资源许可需分别提交', 422);
    const product = await owned<DTO<'Product'>>(db, 'product_drafts', request.product_id, p);
    requireThat(product.data.photo_version !== null, 'PRODUCT_PHOTOS_REQUIRED', '请先上传本次授权商品的照片', 422);
    productRef = { product_id: request.product_id, photo_version: product.data.photo_version };
  }
  const data: DTO<'RightsRecord'> = { rights_record_id: id('rights'), state: 'SUBMITTED', scope: request.scope, updated_at: iso(),
    product_id: request.product_id ?? null, photo_version: productRef?.photo_version ?? null, resource_version_ids: request.resource_version_ids ?? [] };
  await insert(db, 'rights_records', { id: data.rights_record_id, tenant_id: p.tenantId, owner_id: p.userId, scope: request.scope, state: data.state, data, private: { ...request, product_ref: productRef } }); return data;
}

/** Compile registered declarations into a frozen source. Names/descriptions
 * remain display data; they never become executable instructions or endpoints. */
export async function compilePresetConfig(db: Db, config: DTO<'PresetConfig'>): Promise<{ blueprint_id: string; source: VariantSource; source_hash: string }[]> {
  await validatePresetConfig(db, config);
  const componentBindings = (await db.query<{ id: string; version: string; data: unknown }>('SELECT id,version,data FROM component_versions WHERE id=ANY($1) ORDER BY id FOR SHARE', [config.component_versions])).rows.map(row => ({ id: row.id, version: row.version, hash: hash(row.data) }));
  const resourceBindings = (await db.query<{ id: string; version: string; data: unknown }>(`SELECT id,version,data FROM resource_licenses
    WHERE data->>'resource_version_id'=ANY($1) ORDER BY id FOR SHARE`, [config.resource_version_ids])).rows.map(row => ({ id: row.id, version: row.version, hash: hash(row.data) }));
  const style = (await db.query<{ id: string; data: DTO<'ComponentOption'>; preset_id: string }>(`SELECT c.id,c.data,p.id AS preset_id
    FROM component_versions c JOIN presets p ON c.id='style.'||p.id||'.1' AND p.source='OFFICIAL'
    WHERE c.type='STYLE' AND c.id=ANY($1)`, [config.component_versions])).rows;
  requireThat(style.length === 1, 'STYLE_COMPILER_UNAVAILABLE', '所选风格尚未配置可执行的制作映射', 422);
  const compiled = [];
  for (const blueprint of config.variant_blueprint_ids) {
    const base = (await db.query<{ id: string; private: { source: VariantSource } }>(`SELECT x.id,x.private FROM execution_variants x
      JOIN preset_versions v ON v.id=x.preset_version_id JOIN presets p ON p.id=v.preset_id
      WHERE x.variant_id=$1 AND p.source='OFFICIAL' AND p.current_version=v.version`, [blueprint.slice('blueprint.'.length)])).rows[0] ?? notFound();
    const look = (await db.query<{ private: { source: VariantSource } }>(`SELECT x.private FROM execution_variants x
      JOIN preset_versions v ON v.id=x.preset_version_id JOIN presets p ON p.id=v.preset_id
      WHERE p.id=$1 AND p.current_version=v.version AND x.engine=$2 ORDER BY x.variant_id LIMIT 1`, [style[0]!.preset_id, base.private.source.engine])).rows[0];
    requireThat(look, 'STYLE_ENGINE_UNAVAILABLE', '所选风格暂不支持该制作规格', 422);
    const source: VariantSource = { ...structuredClone(base.private.source),
      creative_components: { ...structuredClone(look.private.source.creative_components), platform_style_id: style[0]!.preset_id },
      skill_bundle: structuredClone(look.private.source.skill_bundle),
      community_binding: { config_hash: hash(config), blueprint_version_id: base.id, blueprint_source_hash: hash(base.private.source),
        style_component_id: style[0]!.id, style_component_hash: hash(style[0]!.data), component_versions: config.component_versions,
        resource_version_ids: config.resource_version_ids, component_bindings: componentBindings, resource_bindings: resourceBindings } };
    compiled.push({ blueprint_id: blueprint, source, source_hash: hash(source) });
  }
  return compiled;
}

async function rightsForProduct(db: Db, p: Pick<Principal, 'tenantId' | 'userId'>, rightsIds: string[], productId: string, photoVersion: number, verified = false): Promise<void> {
  const scopes = new Set<string>();
  for (const rightsId of [...rightsIds].sort()) {
    const r = await owned<DTO<'RightsRecord'>>(db, 'rights_records', rightsId, p, true);
    requireThat((verified ? r.data.state === 'VERIFIED' : ['SUBMITTED', 'VERIFIED'].includes(r.data.state)), 'RIGHTS_NOT_AVAILABLE', '授权资料尚未通过或已撤回', 422);
    const binding = r.private?.product_ref as { product_id?: string; photo_version?: number } | null;
    if (binding?.product_id === productId && binding.photo_version === photoVersion) scopes.add(r.data.scope);
  }
  requireThat(scopes.has('OWNED_PRODUCT') && scopes.has('SAMPLE_PUBLICATION'), 'SAMPLE_RIGHTS_INCOMPLETE', '请为这组商品照片分别提供商品使用权与样例公开授权', 422);
}
export async function createDraft(db: Db, p: Principal, config: DTO<'PresetConfig'>, parentId: string | null = null): Promise<DTO<'PresetDraft'>> {
  await validatePresetConfig(db, config);
  requireThat(parentId !== null || config.parent_preset_version === null, 'PARENT_REQUIRES_FORK', '请从原方案的派生入口保留来源和许可', 422);
  const data: DTO<'PresetDraft'> = { draft_id: id('draft'), revision: 0, config, publication_id: null, updated_at: iso() };
  await insert(db, 'preset_drafts', { id: data.draft_id, tenant_id: p.tenantId, owner_id: p.userId, parent_version_id: parentId, data }); return data;
}
export async function patchDraft(db: Db, p: Principal, draftId: string, request: DTO<'PresetDraftPatch'>): Promise<DTO<'PresetDraft'>> {
  const draft = await owned<DTO<'PresetDraft'>>(db, 'preset_drafts', draftId, p, true);
  requireThat(draft.data.revision === request.expected_revision, 'REVISION_CONFLICT', '草稿已更新，请刷新');
  requireThat(request.config.parent_preset_version === draft.data.config.parent_preset_version, 'PARENT_VERSION_IMMUTABLE', '派生来源已固定，不能在修改草稿时替换', 422);
  await validatePresetConfig(db, request.config);
  const data: DTO<'PresetDraft'> = { ...draft.data, revision: draft.data.revision + 1, config: request.config, publication_id: null, updated_at: iso() };
  await update(db, 'preset_drafts', draftId, { data, revision: data.revision, updated_at: data.updated_at }, p.tenantId); return data;
}
export async function sampleDraft(db: Db, cfg: Config, p: Principal, draftId: string, request: DTO<'SampleRequest'>): Promise<DTO<'Sample'>> {
  const draft = await owned<DTO<'PresetDraft'>>(db, 'preset_drafts', draftId, p, true);
  requireThat(draft.data.revision === request.draft_revision && draft.data.config.variant_blueprint_ids.includes(request.variant_blueprint_id), 'DRAFT_CHANGED', '草稿或执行蓝本已更新');
  const profile = await getProfile(db, p, request.product_id);
  requireThat(profile.profile_id === request.profile_id, 'PROFILE_CHANGED', '商品档案已更新');
  requireThat(new Set(request.rights_record_ids).size === request.rights_record_ids.length, 'DUPLICATE_EVIDENCE', '授权记录不能重复选择', 422);
  await rightsForProduct(db, p, request.rights_record_ids, request.product_id, profile.photo_version);
  const compiled = (await compilePresetConfig(db, draft.data.config)).find(x => x.blueprint_id === request.variant_blueprint_id)!;
  const worker = await db.query(`SELECT id FROM worker_heartbeats WHERE last_seen_at>now()-interval '60 seconds'
    AND data->>'state' IS DISTINCT FROM 'STOPPED' AND data->'stage_handlers' ?& $1::text[] LIMIT 1`, [SAMPLE_STAGES]);
  requireThat(cfg.generationEnabled && cfg.codex.enabled && worker.rowCount === 1, 'SAMPLE_SERVICE_UNAVAILABLE', '样例制作暂未开放，可以先保存方案并准备授权资料', 503);
  const data: DTO<'Sample'> = { sample_id: id('sample'), draft_id: draftId, state: 'QUEUED', visibility: 'PRIVATE', rights_verified: false,
    product_id: request.product_id, variant_blueprint_id: request.variant_blueprint_id, draft_revision: request.draft_revision };
  const input = { request, config: draft.data.config, config_hash: hash(draft.data.config), compiled_source_hash: compiled.source_hash,
    compiled_source: compiled.source, input_ref: { product_id: request.product_id, profile_id: profile.profile_id, photo_version: profile.photo_version, profile_hash: profile.profile_hash } };
  const execution = await freezeSample(db, cfg, p, data.sample_id, draft.data, request, profile, compiled);
  const inputHash = hash(execution);
  await insert(db, 'public_samples', { id: data.sample_id, tenant_id: p.tenantId, owner_id: p.userId, product_id: request.product_id, draft_id: draftId, visibility: data.visibility, state: data.state, data,
    private: { ...input, execution: { input: execution, hash: inputHash }, media: [], qc_passed: false } });
  let dependencies: string[] = [];
  for (const name of SAMPLE_STAGES) dependencies = [await enqueueStage(db, { tenantId: p.tenantId, scopeType: 'SAMPLE', scopeId: data.sample_id,
    name, inputHash, deadlineAt: execution.deadline_at, dependencies })];
  return data;
}
export async function sampleMedia(db: Db, cfg: Config, sampleId: string, p: Principal): Promise<DTO<'SampleMedia'>> {
  const row = await owned<DTO<'Sample'>>(db, 'public_samples', sampleId, p);
  requireThat(row.data.state === 'READY' && !row.private?.media_revoked, 'SAMPLE_NOT_READY', '样例尚未就绪或已撤回', 422);
  await verifyCompletedSample(db, cfg, row.tenant_id, sampleId, row.private ?? {});
  const media = row.private?.media as { item_id: string; kind: 'image' | 'video'; object_key: string }[];
  requireThat(Array.isArray(media) && media.length > 0, 'SAMPLE_NOT_READY', '样例尚未生成', 422);
  return { sample_id: sampleId, label: 'PRIVATE_CREATOR_SAMPLE',
    items: media.map(m => ({ kind: m.kind, ...signDownload(cfg, { purpose: 'SAMPLE', tenantId: row.tenant_id, ownerId: row.owner_id!, resourceId: sampleId, itemId: m.item_id }) })) };
}
export async function submitPublication(db: Db, cfg: Config, p: Principal, draftId: string, request: DTO<'PublicationRequest'>): Promise<DTO<'Publication'>> {
  const draft = await owned<DTO<'PresetDraft'>>(db, 'preset_drafts', draftId, p, true);
  requireThat(draft.data.revision === request.expected_revision, 'REVISION_CONFLICT', '草稿已更新，请重新检查样例与许可');
  const existing = (await db.query<{ data: DTO<'Publication'>; private: { request: DTO<'PublicationRequest'> } }>('SELECT data,private FROM publications WHERE draft_id=$1 AND draft_revision=$2', [draftId, draft.data.revision])).rows[0];
  if (existing) { requireThat(hash(existing.private.request) === hash(request), 'PUBLICATION_ALREADY_SUBMITTED', '这版草稿已提交，请查看原记录；修改后再提交新版本', 409); return existing.data; }
  const evidence = await publicationEvidence(db, cfg, p, draftId, draft.data.revision, draft.data.config, request);
  const data: DTO<'Publication'> = { publication_id: id('publication'), draft_id: draftId, revision: 0, state: 'UNDER_REVIEW', admission_state: 'NOT_EVALUATED', sale_enabled: false, reason_codes: [], preset_id: null, published_version: null, public_sample_state: 'NONE', public_sample_ids: [], public_sample_expires_at: null };
  await insert(db, 'publications', { id: data.publication_id, tenant_id: p.tenantId, owner_id: p.userId, draft_id: draftId, draft_revision: draft.data.revision, review_state: data.state, admission_state: data.admission_state, data,
    private: { request, config: draft.data.config, parent_version_id: draft.parent_version_id, compiled_variants: evidence.compiled,
      license_acceptance: { license_id: evidence.license.license_id, content_hash: evidence.license.content_hash, subject_id: p.userId, accepted_at: iso() } } });
  await update(db, 'preset_drafts', draftId, { data: { ...draft.data, publication_id: data.publication_id }, updated_at: iso() }, p.tenantId); return data;
}

/** Called at submission, review and publication. Approval does not freeze a
 * revoked license or silently replace the sample's original declarations. */
export async function publicationEvidence(db: Db, cfg: Config, p: Pick<Principal, 'tenantId' | 'userId'>, draftId: string, revision: number,
  config: DTO<'PresetConfig'>, request: DTO<'PublicationRequest'>, verified = false) {
  requireThat(new Set(request.sample_ids).size === request.sample_ids.length && new Set(request.rights_record_ids).size === request.rights_record_ids.length,
    'DUPLICATE_EVIDENCE', '样例和授权记录不能重复选择', 422);
  requireThat(request.accept_sample_publication === true && request.public_sample_retention_days === 30,
    'PUBLIC_SAMPLE_CONSENT_REQUIRED', '请确认审核后公开样例最多保留30天，可随时撤回', 422);
  const terms = await license(db, request.license_version, true);
  requireThat(request.accept_license === true && terms.state === 'ACTIVE' && terms.content_hash === request.license_content_hash,
    'LICENSE_NOT_AVAILABLE', '请选择当前有效的许可并重新阅读确认全文', 422);
  requireThat(terms.fork_allowed === config.fork_allowed, 'LICENSE_FORK_MISMATCH', '所选许可的派生规则与方案设置不一致', 422);
  await checkParentLicense(db, config.parent_preset_version, terms.license_id);
  const compiled = await compilePresetConfig(db, config); const covered = new Set<string>();
  for (const sampleId of [...request.sample_ids].sort()) {
    const sample = await owned<DTO<'Sample'>>(db, 'public_samples', sampleId, p, true);
    const original = sample.private?.request as DTO<'SampleRequest'> | undefined;
    const source = compiled.find(x => x.blueprint_id === original?.variant_blueprint_id);
    const input = sample.private?.input_ref as { product_id: string; photo_version: number } | undefined;
    requireThat(sample.data.draft_id === draftId && sample.data.state === 'READY' && sample.private?.qc_passed === true
      && original?.draft_revision === revision && input?.product_id === original.product_id && source
      && sample.private.config_hash === hash(config) && sample.private.compiled_source_hash === source.source_hash
      && Array.isArray(sample.private.media) && sample.private.media.length > 0, 'SAMPLE_NOT_READY', '请为当前草稿的每种制作规格提供一致且通过检查的自有样例', 422);
    requireThat(original.rights_record_ids.every(r => request.rights_record_ids.includes(r)), 'SAMPLE_RIGHTS_INCOMPLETE', '发布申请需包含样例使用的全部原授权记录', 422);
    await rightsForProduct(db, p, request.rights_record_ids, original.product_id, input.photo_version, verified);
    await verifyCompletedSample(db, cfg, sample.tenant_id, sampleId, sample.private);
    await verifySampleFiles(db, cfg, p, sampleId, sample.private.media);
    covered.add(original.variant_blueprint_id);
  }
  requireThat(compiled.every(x => covered.has(x.blueprint_id)), 'SAMPLE_COVERAGE_INCOMPLETE', '每种制作规格都需要对应样例，不能用单一样例证明其他效果', 422);
  const resources = new Set<string>();
  for (const rightsId of request.rights_record_ids) {
    const r = await owned<DTO<'RightsRecord'>>(db, 'rights_records', rightsId, p, true);
    requireThat(verified ? r.data.state === 'VERIFIED' : ['SUBMITTED', 'VERIFIED'].includes(r.data.state), 'RIGHTS_NOT_AVAILABLE', '授权资料尚未通过或已撤回', 422);
    if (r.data.scope === 'THIRD_PARTY_RESOURCE') for (const resource of (r.private?.resource_version_ids as string[] | undefined) ?? []) resources.add(resource);
  }
  requireThat(config.resource_version_ids.every(r => resources.has(r)), 'RESOURCE_RIGHTS_INCOMPLETE', '请为使用的全部第三方资源提供对应许可记录', 422);
  return { license: terms, compiled };
}
export async function favorite(db: Db, p: Principal, presetId: string, value: boolean): Promise<DTO<'Favorite'>> {
  if (value) {
    const preset = (await db.query<{ current_version: string }>('SELECT current_version FROM presets WHERE id=$1 AND visibility=$2', [presetId, 'PUBLIC'])).rows[0] ?? notFound();
    await presetVersion(db, presetId, preset.current_version);
  }
  if (value) await db.query('INSERT INTO favorites(id,tenant_id,owner_id,preset_id,data) VALUES($1,$2,$3,$4,$5) ON CONFLICT(tenant_id,owner_id,preset_id) DO NOTHING', [id('fav'), p.tenantId, p.userId, presetId, { preset_id: presetId, favorited: true }]);
  else await db.query('DELETE FROM favorites WHERE tenant_id=$1 AND owner_id=$2 AND preset_id=$3', [p.tenantId, p.userId, presetId]);
  return { preset_id: presetId, favorited: value };
}
export async function fork(db: Db, p: Principal, presetId: string, request: DTO<'ForkRequest'>): Promise<DTO<'PresetDraft'>> {
  const parent = await presetVersion(db, presetId, request.parent_version);
  requireThat(parent.fork_allowed, 'FORK_NOT_ALLOWED', '作者未开放此版本的复刻权限', 422);
  await checkParentLicense(db, `${presetId}@${request.parent_version}`);
  const v = (await db.query<{ id: string; data: DTO<'PresetDetail'> }>('SELECT id,data FROM preset_versions WHERE preset_id=$1 AND version=$2', [presetId, request.parent_version])).rows[0] ?? notFound();
  const config: DTO<'PresetConfig'> = { name: request.name, description: parent.description, style_tags: parent.preset.style_tags.slice(0, 10), parent_preset_version: `${presetId}@${request.parent_version}`,
    component_versions: [`style.${presetId}.1`], variant_blueprint_ids: parent.variants.map(x => `blueprint.${x.variant_id}`).slice(0, 10), resource_version_ids: [], fork_allowed: true };
  // Community versions retain their declarative source; don't invent a style ID.
  if (parent.preset.source === 'COMMUNITY') {
    const publication = (await db.query<{ private: { config: DTO<'PresetConfig'> } }>('SELECT private FROM publications WHERE published_version_id=$1', [v.id])).rows[0] ?? notFound();
    Object.assign(config, publication.private.config, { name: request.name, parent_preset_version: `${presetId}@${request.parent_version}` });
  }
  const draft = await createDraft(db, p, config, v.id);
  await insert(db, 'forks', { id: id('fork'), tenant_id: p.tenantId, owner_id: p.userId, parent_version_id: v.id, draft_id: draft.draft_id, data: { parent_version: `${presetId}@${request.parent_version}`, license_snapshot: parent.license_summary } }); return draft;
}
export async function checkParentLicense(db: Db, parentVersion: string | null, selectedLicense?: string): Promise<void> {
  if (parentVersion === null) return;
  const split = parentVersion.lastIndexOf('@');
  requireThat(split > 0, 'PARENT_VERSION_INVALID', '派生来源版本无效', 422);
  const parent = (await db.query<{ license_version: string; source: string; data: DTO<'PresetDetail'> }>(`SELECT v.license_version,p.source,v.data
    FROM preset_versions v JOIN presets p ON p.id=v.preset_id WHERE v.preset_id=$1 AND v.version=$2`, [parentVersion.slice(0, split), parentVersion.slice(split + 1)])).rows[0] ?? notFound();
  requireThat(parent.data.fork_allowed, 'FORK_NOT_ALLOWED', '原方案未开放派生', 422);
  if (parent.source === 'COMMUNITY') {
    requireThat(selectedLicense === undefined || selectedLicense === parent.license_version, 'LICENSE_INHERITANCE_REQUIRED', '派生方案需沿用原方案的许可版本', 422);
    const terms = await license(db, parent.license_version, true);
    requireThat(terms.state === 'ACTIVE' && terms.fork_allowed, 'FORK_NOT_ALLOWED', '原方案许可已退役或不允许派生', 422);
  }
}
export async function report(db: Db, p: Principal, presetId: string, request: DTO<'ReportRequest'>): Promise<DTO<'Report'>> {
  await presetVersion(db, presetId, request.preset_version); await validateEvidenceAssets(db, p, request.evidence_asset_ids ?? []);
  const version = (await db.query<{ id: string }>('SELECT id FROM preset_versions WHERE preset_id=$1 AND version=$2', [presetId, request.preset_version])).rows[0] ?? notFound();
  const data: DTO<'Report'> = { report_id: id('report'), preset_id: presetId, revision: 0, state: 'OPEN', updated_at: iso() };
  await insert(db, 'moderation_reports', { id: data.report_id, tenant_id: p.tenantId, owner_id: p.userId, preset_version_id: version.id, state: data.state, data, private: request }); return data;
}
export async function appeal(db: Db, p: Principal, reportId: string, request: DTO<'AppealRequest'>): Promise<DTO<'Appeal'>> {
  const reportRow = (await db.query<{ tenant_id: string; owner_id: string; data: DTO<'Report'>; author_id: string | null }>('SELECT r.*,p.author_id FROM moderation_reports r JOIN preset_versions v ON v.id=r.preset_version_id JOIN presets p ON p.id=v.preset_id WHERE r.id=$1 FOR UPDATE OF r', [reportId])).rows[0] ?? notFound();
  requireThat((reportRow.tenant_id === p.tenantId && reportRow.owner_id === p.userId) || reportRow.author_id === p.userId, 'REPORT_NOT_ACCESSIBLE', '无权申诉该记录', 404);
  requireThat(['RESOLVED', 'DISMISSED'].includes(reportRow.data.state), 'APPEAL_NOT_AVAILABLE', '该记录尚未形成可申诉的处理决定', 422);
  await validateEvidenceAssets(db, p, request.evidence_asset_ids ?? []);
  const data: DTO<'Appeal'> = { appeal_id: id('appeal'), report_id: reportId, state: 'OPEN' };
  await insert(db, 'moderation_appeals', { id: data.appeal_id, tenant_id: p.tenantId, owner_id: p.userId, report_id: reportId, state: data.state, data, private: request });
  await update(db, 'moderation_reports', reportId, { state: 'APPEALED', data: { ...reportRow.data, state: 'APPEALED', revision: reportRow.data.revision + 1, updated_at: iso() } }, reportRow.tenant_id); return data;
}
