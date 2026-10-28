import type pg from 'pg';
import type { Db } from '../db/pool.js';
import { transaction } from '../db/pool.js';
import type { Config } from '../config.js';
import type { DTO, Principal } from '../../shared/contracts/types.js';
import { insert, owned, type RecordRow } from '../db/store.js';
import { id, hash, sha256, addSeconds, iso } from '../lib/crypto.js';
import { requireThat, notFound, AppError } from '../lib/errors.js';
import { storage } from '../storage/storage.js';
import { license } from './licenses.js';
import { lockMediaOwner } from './media-access.js';
import { signDownload } from './delivery.js';
import { enqueueStage } from '../../worker/queue/enqueue.js';
import type { SampleObject } from './sample-evidence.js';

export const PUBLIC_SAMPLE_RETENTION_DAYS = 30;
export interface AuthorizedInput {
  tenant_id: string; owner_id: string; publication_id: string; public_sample_id: string; source_sample_id: string; source_product_id: string;
  photo_version: number; license_id: string; license_hash: string; rights_record_ids: string[];
  source_media: SampleObject[]; source_completion_hash: string; config_hash: string; compiled_hash: string;
  accepted_at: string; retention_days: 30; expires_at: string;
}
export interface AuthorizedRow extends RecordRow<Record<string, unknown>> {
  state: string;
  publication_id: string; source_sample_id: string; source_product_id: string; input_hash: string; expires_at: Date;
  private: { input: AuthorizedInput; media?: SampleObject[]; media_hash?: string; [key: string]: unknown };
}

/** Called in the approval transaction. No object I/O occurs before commit. */
export async function scheduleAuthorizedSamples(db: Db, publication: RecordRow<DTO<'Publication'>>) {
  const request = publication.private!.request as DTO<'PublicationRequest'>;
  requireThat(request.accept_sample_publication === true && request.public_sample_retention_days === PUBLIC_SAMPLE_RETENTION_DAYS,
    'PUBLIC_SAMPLE_CONSENT_REQUIRED', '请确认公开样例最长30天及可撤回的独立授权', 422);
  const expiresAt = addSeconds(PUBLIC_SAMPLE_RETENTION_DAYS * 86400); const ids: string[] = [];
  for (const sourceId of [...request.sample_ids].sort()) {
    const source = await owned<DTO<'Sample'>>(db, 'public_samples', sourceId, { tenantId: publication.tenant_id, userId: publication.owner_id! }, true);
    const productId = source.product_id as string | null;
    const original = source.private!.request as DTO<'SampleRequest'>;
    const photo = source.private!.input_ref as { photo_version: number };
    requireThat(productId && productId === original.product_id && source.data.state === 'READY' && !source.private!.media_revoked,
      'SAMPLE_NOT_READY', '公开副本需要当前有效的自有私有样例', 422);
    const sampleId = id('publicsample'); const terms = publication.private!.license_acceptance as { accepted_at: string; content_hash: string };
    const input: AuthorizedInput = { tenant_id: publication.tenant_id, owner_id: publication.owner_id!, publication_id: publication.id,
      public_sample_id: sampleId, source_sample_id: sourceId, source_product_id: productId, photo_version: photo.photo_version,
      license_id: request.license_version, license_hash: request.license_content_hash, rights_record_ids: [...request.rights_record_ids],
      source_media: source.private!.media as SampleObject[], source_completion_hash: hash(source.private!.completion ?? { explicit_test_fixture: source.private!.test_fixture === true }),
      config_hash: hash(publication.private!.config), compiled_hash: hash(publication.private!.compiled_variants),
      accepted_at: terms.accepted_at, retention_days: 30, expires_at: expiresAt };
    await insert(db, 'authorized_samples', { id: sampleId, tenant_id: publication.tenant_id, owner_id: publication.owner_id,
      publication_id: publication.id, source_sample_id: sourceId, source_product_id: productId, input_hash: hash(input), state: 'PREPARING',
      expires_at: expiresAt, data: {}, private: { input } }); ids.push(sampleId);
  }
  const inputHash = hash({ publication_id: publication.id, public_sample_ids: ids });
  const stageId = await enqueueStage(db, { tenantId: publication.tenant_id, scopeType: 'PUBLICATION', scopeId: publication.id,
    name: 'PUBLIC_SAMPLE_PREPARE', inputHash, deadlineAt: addSeconds(3600), private: { public_sample_ids: ids } });
  return { ids, expiresAt, stageId, inputHash };
}

/** Public reads depend on the separately approved consent, never the expired
 * source's photos/profile. Every issued URL still checks withdrawal/expiry. */
export async function authorizedSample(db: Db, sampleId: string, states: string[] = ['PUBLISHED'], lock = false): Promise<AuthorizedRow> {
  const row = (await db.query<AuthorizedRow>(`SELECT * FROM authorized_samples WHERE id=$1${lock ? ' FOR UPDATE' : ''}`, [sampleId])).rows[0] ?? notFound();
  const input = row.private.input;
  requireThat(input && hash(input) === row.input_hash && input.public_sample_id === row.id && input.tenant_id === row.tenant_id
    && input.owner_id === row.owner_id && input.publication_id === row.publication_id && input.source_sample_id === row.source_sample_id
    && input.source_product_id === row.source_product_id && input.expires_at === row.expires_at.toISOString() && input.retention_days === 30,
  'PUBLIC_SAMPLE_BINDING_CHANGED', '公开样例的冻结授权或来源不一致', 503);
  requireThat(states.includes(row.state) && row.expires_at.getTime() > Date.now(), 'PUBLIC_SAMPLE_UNAVAILABLE', '公开样例已撤回、到期或尚未发布', 410);
  const terms = await license(db, input.license_id);
  requireThat(terms.state === 'ACTIVE' && terms.content_hash === input.license_hash, 'PUBLIC_SAMPLE_LICENSE_REVOKED', '公开样例许可已失效', 410);
  const publication = (await db.query<{ review_state: string; data: DTO<'Publication'>; private: Record<string, unknown> }>('SELECT review_state,data,private FROM publications WHERE tenant_id=$1 AND owner_id=$2 AND id=$3',
    [row.tenant_id, row.owner_id, row.publication_id])).rows[0];
  requireThat(publication && ['APPROVED','PUBLISHED'].includes(publication.review_state)
    && (row.state !== 'PUBLISHED' || publication.review_state === 'PUBLISHED') && hash(publication.private.config) === input.config_hash
    && hash(publication.private.compiled_variants) === input.compiled_hash,
  'PUBLIC_SAMPLE_UNAVAILABLE', '所属发布已暂停或冻结版本不一致', 410);
  if (row.state === 'PUBLISHED') requireThat((await db.query("SELECT id FROM presets WHERE id=$1 AND visibility='PUBLIC'", [publication.data.preset_id])).rowCount === 1,
    'PUBLIC_SAMPLE_UNAVAILABLE', '所属方案已下架', 410);
  const grants = (await db.query<{ id: string; scope: string; private: { product_ref?: { product_id: string; photo_version: number } } }>(`SELECT id,scope,private FROM rights_records
    WHERE tenant_id=$1 AND owner_id=$2 AND id=ANY($3) AND state='VERIFIED'`, [row.tenant_id, row.owner_id, input.rights_record_ids])).rows;
  requireThat(grants.length === input.rights_record_ids.length && ['OWNED_PRODUCT','SAMPLE_PUBLICATION'].every(scope => grants.some(g => g.scope === scope
    && g.private.product_ref?.product_id === input.source_product_id && g.private.product_ref.photo_version === input.photo_version)),
  'PUBLIC_SAMPLE_RIGHTS_REVOKED', '公开样例授权已撤回', 410);
  const variants = publication.private.compiled_variants as {source:{community_binding?:{
    component_bindings:{id:string;version:string;hash:string}[];resource_bindings:{id:string;version:string;hash:string}[]}}}[];
  for (const [table,bindings] of [['component_versions',variants.flatMap(v=>v.source.community_binding?.component_bindings??[])],
    ['resource_licenses',variants.flatMap(v=>v.source.community_binding?.resource_bindings??[])]] as const) {
    if (!bindings.length) continue;
    const rows = (await db.query<{id:string;version:string;data:unknown;revoked_at?:Date|null;expires_at?:Date|null}>(`SELECT * FROM ${table} WHERE id=ANY($1)`,[[...new Set(bindings.map(b=>b.id))]])).rows;
    requireThat(bindings.every(b=>rows.some(r=>r.id===b.id && r.version===b.version && hash(r.data)===b.hash
      && !r.revoked_at && (!r.expires_at || r.expires_at.getTime()>Date.now()))),
    'PUBLIC_SAMPLE_RESOURCE_REVOKED','公开样例使用的组件或资源许可已变化',410);
  }
  return row;
}
export function authorizedManifest(row: AuthorizedRow): SampleObject[] {
  const media = row.private.media;
  requireThat(Array.isArray(media) && media.length > 0 && media.length <= 100 && hash(media) === row.private.media_hash
    && media.length === row.private.input.source_media.length && new Set(media.map(m => m.item_id)).size === media.length
    && media.every(m => ['image','video'].includes(m.kind) && m.object_key.startsWith(`${row.tenant_id}/authorized-samples/${row.id}/`)
      && Number.isSafeInteger(m.size_bytes) && m.size_bytes > 0 && m.size_bytes <= 125_000_000
      && row.private.input.source_media.some(s => s.item_id === m.item_id && s.kind === m.kind && s.sha256 === m.sha256 && s.size_bytes === m.size_bytes))
    && media.reduce((n,m) => n + m.size_bytes,0) <= 250_000_000,
  'PUBLIC_SAMPLE_MANIFEST_CHANGED', '公开样例的完整文件清单不一致', 503); return media;
}
export async function authorizedFile(db: Db, cfg: Config, row: AuthorizedRow, itemId: string): Promise<{ item: SampleObject; bytes: Buffer }> {
  const item = authorizedManifest(row).find(m => m.item_id === itemId) ?? notFound();
  const stored = await db.query(`SELECT id FROM private_object_writes WHERE tenant_id=$1 AND owner_id=$2 AND authorized_sample_id=$3
    AND object_key=$4 AND sha256=$5 AND kind='MEDIA' AND product_id IS NULL AND state='STORED' AND NOT delete_requested AND expires_at>now()`,
  [row.tenant_id,row.owner_id,row.id,item.object_key,item.sha256]);
  requireThat(stored.rowCount === 1, 'PUBLIC_SAMPLE_FILE_UNAVAILABLE', '公开样例文件已撤回或到期', 410);
  const bytes = await storage(cfg).get(item.object_key, item.size_bytes);
  requireThat(bytes.length === item.size_bytes && sha256(bytes) === item.sha256, 'PUBLIC_SAMPLE_FILE_CHANGED', '公开样例实际文件摘要不一致', 503);
  return { item, bytes };
}
export async function verifyAuthorizedFiles(db: Db, cfg: Config, row: AuthorizedRow): Promise<void> {
  for (const item of authorizedManifest(row)) await authorizedFile(db,cfg,row,item.item_id);
}
export async function publicSampleMedia(db: Db, cfg: Config, sampleId: string): Promise<DTO<'SampleMedia'>> {
  const row = await authorizedSample(db,sampleId); await verifyAuthorizedFiles(db,cfg,row);
  return { sample_id: row.id, label: 'AUTHORIZED_SAMPLE_NOT_YOUR_RESULT', items: authorizedManifest(row).map(item => ({ kind: item.kind,
    ...signDownload(cfg,{ purpose: 'PUBLIC_SAMPLE', tenantId: row.tenant_id, ownerId: row.owner_id!, resourceId: row.id, itemId: item.item_id }) })) };
}

/** Caller owns the media-owner lock. Revoke first; actual bytes are removed by
 * the independent media maintenance process, including a late original PUT. */
export async function endAuthorizedPublications(db: Db, owner: Pick<Principal,'tenantId'|'userId'>,
  selection: { publicationIds?: string[]; productIds?: string[]; beforeAt?: string }, reason: string, state: 'WITHDRAWN'|'EXPIRED'|'FAILED' = 'WITHDRAWN'): Promise<number> {
  const ids = (await db.query<{ publication_id: string }>(`SELECT DISTINCT publication_id FROM authorized_samples
    WHERE tenant_id=$1 AND owner_id=$2 AND ($3::text[] IS NULL OR publication_id=ANY($3))
    AND ($4::text[] IS NULL OR source_product_id=ANY($4)) AND ($5::timestamptz IS NULL OR created_at<=$5)
    AND state IN ('PREPARING','READY','PUBLISHED') ORDER BY publication_id`, [owner.tenantId,owner.userId,selection.publicationIds??null,selection.productIds??null,selection.beforeAt??null])).rows.map(r=>r.publication_id);
  if (!ids.length) return 0;
  const publications = (await db.query<{ id: string; data: DTO<'Publication'> }>('SELECT id,data FROM publications WHERE tenant_id=$1 AND id=ANY($2) ORDER BY id FOR UPDATE', [owner.tenantId,ids])).rows;
  const ended = await db.query(`UPDATE authorized_samples SET state=$3,private=private||jsonb_build_object('ended_reason',$4::text,'ended_at',$5::text),updated_at=now()
    WHERE tenant_id=$1 AND publication_id=ANY($2) AND state IN ('PREPARING','READY','PUBLISHED')`, [owner.tenantId,ids,state,reason,iso()]);
  await db.query(`UPDATE private_object_writes SET delete_requested=true,erase_available_at=LEAST(erase_available_at,now()),updated_at=now()
    WHERE tenant_id=$1 AND authorized_sample_id IN (SELECT id FROM authorized_samples WHERE tenant_id=$1 AND publication_id=ANY($2)) AND state<>'DELETED'`, [owner.tenantId,ids]);
  await db.query(`UPDATE stage_runs SET state='CANCELLED',fencing_token=fencing_token+1,lease_owner=NULL,lease_expires_at=NULL,
    data=data||jsonb_build_object('state','CANCELLED','reason_code',$3::text),updated_at=now()
    WHERE tenant_id=$1 AND scope_type='PUBLICATION' AND scope_id=ANY($2) AND state IN ('READY','RUNNING','UNKNOWN','CLAIMED')`, [owner.tenantId,ids,reason]);
  for (const publication of publications) {
    const data: DTO<'Publication'> = { ...publication.data, revision: publication.data.revision+1, state: 'SUSPENDED', sale_enabled: false,
      public_sample_state: state, reason_codes: [reason], review_message: state==='EXPIRED'?'公开样例授权已到期':'公开样例已停止分发，可在新版本重新申请' };
    await db.query(`UPDATE publications SET data=$3,review_state='SUSPENDED',revision=$4,updated_at=now() WHERE tenant_id=$1 AND id=$2`, [owner.tenantId,publication.id,data,data.revision]);
    if (data.preset_id) {
      await db.query("UPDATE presets SET visibility='PRIVATE' WHERE id=$1", [data.preset_id]);
      await db.query(`UPDATE execution_variants SET sale_enabled=false,revision=revision+1,data=data||jsonb_build_object('sale_enabled',false,'reason_codes',jsonb_build_array($2::text))
        WHERE preset_version_id IN (SELECT id FROM preset_versions WHERE preset_id=$1)`, [data.preset_id,reason]);
    }
  } return ended.rowCount??0;
}
export async function withdrawPublicSamples(db: Db, p: Principal, publicationId: string, request: DTO<'PublicSampleWithdrawalRequest'>): Promise<DTO<'Publication'>> {
  await owned(db,'publications',publicationId,p); await lockMediaOwner(db,p.tenantId,p.userId);
  const publication = await owned<DTO<'Publication'>>(db,'publications',publicationId,p,true);
  if (['WITHDRAWN','EXPIRED'].includes(publication.data.public_sample_state??'')) return publication.data;
  requireThat(publication.data.revision===request.expected_revision, 'REVISION_CONFLICT','发布状态已更新，请刷新后撤回',409);
  requireThat(['PREPARING','READY','PUBLISHED'].includes(publication.data.public_sample_state??''), 'PUBLIC_SAMPLE_NOT_AVAILABLE','当前没有可撤回的公开样例',422);
  await endAuthorizedPublications(db,p,{publicationIds:[publicationId]},'PUBLIC_SAMPLE_WITHDRAWN');
  await db.query(`UPDATE publications SET private=private||jsonb_build_object('sample_withdrawal',$3::jsonb) WHERE tenant_id=$1 AND id=$2`, [p.tenantId,publicationId,JSON.stringify({reason:request.reason,at:iso(),actor:p.userId})]);
  return (await owned<DTO<'Publication'>>(db,'publications',publicationId,p)).data;
}
export async function expireAuthorizedSamples(pool: pg.Pool): Promise<number> {
  const rows = (await pool.query<{ id: string; tenant_id: string; owner_id: string; publication_id: string; expires_at: Date }>(`SELECT * FROM authorized_samples
    WHERE state IN ('PREPARING','READY','PUBLISHED') ORDER BY updated_at,id LIMIT 20`)).rows;
  let n=0;
  for (const row of rows) n+=await transaction(pool,async db=>{
    await lockMediaOwner(db,row.tenant_id,row.owner_id);
    const current = (await db.query<{state:string}>('SELECT state FROM authorized_samples WHERE tenant_id=$1 AND id=$2',[row.tenant_id,row.id])).rows[0];
    if (!current || !['PREPARING','READY','PUBLISHED'].includes(current.state)) return 0;
    try { await authorizedSample(db,row.id,['PREPARING','READY','PUBLISHED']); }
    catch (error) {
      if (!(error instanceof AppError)) throw error;
      const expired = row.expires_at.getTime()<=Date.now();
      return endAuthorizedPublications(db,{tenantId:row.tenant_id,userId:row.owner_id},{publicationIds:[row.publication_id]},expired?'PUBLIC_SAMPLE_EXPIRED':'PUBLIC_SAMPLE_AUTHORIZATION_REVOKED',expired?'EXPIRED':'WITHDRAWN');
    }
    await db.query('UPDATE authorized_samples SET updated_at=now() WHERE tenant_id=$1 AND id=$2',[row.tenant_id,row.id]); return 0;
  });
  return n;
}
