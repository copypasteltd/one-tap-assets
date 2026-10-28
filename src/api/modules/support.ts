import type { Db } from '../db/pool.js';
import type { DTO, Principal } from '../../shared/contracts/types.js';
import { owned, insert, update, outbox } from '../db/store.js';
import { id, iso } from '../lib/crypto.js';
import { requireThat, AppError } from '../lib/errors.js';
import { lockMediaOwner } from './media-access.js';
import { stopScope } from '../../worker/lifecycle/termination.js';
import { endAuthorizedPublications } from './authorized-samples.js';
export async function validateEvidenceAssets(db: Db, p: Principal, ids: string[], purpose?: 'RIGHTS_EVIDENCE' | 'REPORT_EVIDENCE' | 'SUPPORT_EVIDENCE'): Promise<void> {
  if (!ids.length) return;
  const rows = await db.query('SELECT id FROM assets WHERE id=ANY($1) AND tenant_id=$2 AND owner_id=$3 AND state=$4 AND expires_at>now() AND ($5::text IS NULL OR purpose=$5)', [ids, p.tenantId, p.userId, 'READY', purpose ?? null]);
  requireThat(rows.rowCount === new Set(ids).size, 'EVIDENCE_SCOPE_INVALID', '附件不属于当前用户或已失效', 422);
}
export async function createTicket(db: Db, p: Principal, orderId: string, request: DTO<'TicketRequest'>): Promise<DTO<'Ticket'>> {
  await owned(db, 'orders', orderId, p); await validateEvidenceAssets(db, p, request.attachment_asset_ids ?? []);
  const data: DTO<'Ticket'> = { ticket_id: id('ticket'), order_id: orderId, state: 'OPEN', category: request.category, updated_at: iso() };
  await insert(db, 'support_tickets', { id: data.ticket_id, tenant_id: p.tenantId, owner_id: p.userId, order_id: orderId, category: request.category, state: data.state, data, private: request }); return data;
}
export interface FrozenDeletionScope { product_ids: string[]; order_ids: string[]; asset_ids: string[]; created_at: string; origin?: 'USER'|'RETENTION'; authorized_sample_ids?: string[] }
export interface DeletionOptions { journal?: import('../privacy/journal.js').DeletionJournal | undefined; replay?: FrozenDeletionScope; origin?: 'USER'|'RETENTION' }
export async function requestDeletion(db: Db, p: Pick<Principal, 'tenantId' | 'userId'>, request: DTO<'PrivacyDeletionRequest'>, options: DeletionOptions = {}): Promise<DTO<'PrivacyDeletion'>> {
  await lockMediaOwner(db, p.tenantId, p.userId);
  const origin = options.replay?.origin ?? options.origin ?? 'USER';
  requireThat(origin!=='RETENTION' || request.scope==='PRODUCT','DELETION_ORIGIN_INVALID','自然保留到期只适用于商品私有素材',500);
  if (request.scope === 'PRODUCT') requireThat((await db.query('SELECT id FROM product_drafts WHERE tenant_id=$1 AND owner_id=$2 AND id=$3',
    [p.tenantId, p.userId, request.product_id])).rowCount === 1, 'NOT_FOUND', '未找到该商品', 404);
  // Quote/plan columns remain valid even after private content is redacted.
  const orders = (await db.query<{ id: string; fulfillment_state: string }>(`SELECT o.id,o.fulfillment_state FROM orders o
    JOIN quotes q ON q.tenant_id=o.tenant_id AND q.id=o.quote_id JOIN plan_versions v ON v.tenant_id=q.tenant_id AND v.id=q.plan_id
    WHERE o.tenant_id=$1 AND o.owner_id=$2 AND ($3::text IS NULL OR v.product_id=$3) AND ($4::text[] IS NULL OR o.id=ANY($4)) ORDER BY o.id FOR UPDATE OF o`,
    [p.tenantId, p.userId, request.product_id ?? null, options.replay?.order_ids ?? null])).rows;
  const products = (await db.query<{ id: string }>(`SELECT id FROM product_drafts WHERE tenant_id=$1 AND owner_id=$2
    AND ($3::text IS NULL OR id=$3) AND ($4::text[] IS NULL OR id=ANY($4)) ORDER BY id FOR UPDATE`, [p.tenantId, p.userId, request.product_id ?? null, options.replay?.product_ids ?? null])).rows.map(r => r.id);
  requireThat(!orders.some(o => ['QUEUED','IN_PROGRESS'].includes(o.fulfillment_state)) || request.acknowledge_inflight_contract,
    'PRIVACY_INFLIGHT_ACK_REQUIRED', '仍有制作中的订单，删除将停止制作，请先确认', 422);
  const data: DTO<'PrivacyDeletion'> = { deletion_id: id('deletion'), state: 'REQUESTED', created_at: iso(), retained_categories: ['必要的交易、退款与授权审计凭据'], limitations: ['已保存到手机相册的文件由用户自行删除', '供应商副本和滚动备份按其已约定的删除边界处理'] };
  const cutoff = options.replay?.created_at ?? data.created_at;
  const publicCopies = origin==='RETENTION' ? [] : options.replay?.authorized_sample_ids ?? (await db.query<{id:string}>(`SELECT a.id FROM authorized_samples a
    WHERE a.tenant_id=$1 AND a.owner_id=$2 AND a.created_at<=$4 AND a.publication_id IN (SELECT publication_id FROM authorized_samples
      WHERE tenant_id=$1 AND owner_id=$2 AND ($5::boolean OR source_product_id=ANY($3::text[])) AND created_at<=$4) ORDER BY a.id`,
  [p.tenantId,p.userId,products,cutoff,request.scope==='ACCOUNT_MEDIA'])).rows.map(r=>r.id);
  await insert(db, 'privacy_deletions', { id: data.deletion_id, tenant_id: p.tenantId, owner_id: p.userId, state: data.state, data,
    private: { request, origin, product_ids: products, order_ids: orders.map(o => o.id), authorized_sample_ids: publicCopies, object_receipts: [] }, ...(options.replay ? { created_at: options.replay.created_at } : {}) });
  if (publicCopies.length) {
    const ids = (await db.query<{publication_id:string}>('SELECT DISTINCT publication_id FROM authorized_samples WHERE tenant_id=$1 AND owner_id=$2 AND id=ANY($3)',[p.tenantId,p.userId,publicCopies])).rows.map(r=>r.publication_id);
    await endAuthorizedPublications(db,p,{publicationIds:ids},'PRIVACY_DELETED');
  }
  // Stop access immediately; deletion of binaries and provider copies is durable work.
  await db.query('UPDATE product_drafts SET deleted_at=now() WHERE tenant_id=$1 AND owner_id=$2 AND id=ANY($3::text[])', [p.tenantId, p.userId, products]);
  const orderIds = orders.map(o => o.id);
  const revisions=(await db.query<{id:string}>('SELECT id FROM revision_requests WHERE tenant_id=$1 AND owner_id=$2 AND order_id=ANY($3::text[]) ORDER BY id',[p.tenantId,p.userId,orderIds])).rows;
  for(const revision of revisions)await stopScope(db,{tenantId:p.tenantId,type:'REVISION',id:revision.id},'PRIVACY_DELETED','CANCELLED');
  await db.query("UPDATE orders SET private=jsonb_set(private,'{media_revoked}','true') WHERE tenant_id=$1 AND id=ANY($2::text[])", [p.tenantId, orderIds]);
  for (const order of orders) if (!['DELIVERED','EXPIRED'].includes(order.fulfillment_state))
    await stopScope(db, { tenantId: p.tenantId, type: 'ORDER', id: order.id }, 'PRIVACY_DELETED', 'CANCELLED');
  for (const [table, type] of [['analysis_jobs','ANALYSIS'], ['plan_versions','PLAN'], ['optional_previews','PREVIEW']] as const) {
    const rows = (await db.query<{ id: string }>(`SELECT id FROM ${table} WHERE tenant_id=$1 AND product_id=ANY($2::text[])`, [p.tenantId, products])).rows;
    for (const row of rows) await stopScope(db, { tenantId: p.tenantId, type, id: row.id }, 'PRIVACY_DELETED', 'CANCELLED');
  }
  const samples = (await db.query<{id:string}>(`SELECT id FROM public_samples WHERE tenant_id=$1 AND owner_id=$2 AND product_id=ANY($3::text[]) ORDER BY id FOR UPDATE`,[p.tenantId,p.userId,products])).rows;
  const previews=(await db.query<{id:string}>('SELECT id FROM optional_previews WHERE tenant_id=$1 AND owner_id=$2 AND product_id=ANY($3::text[]) ORDER BY id FOR UPDATE',[p.tenantId,p.userId,products])).rows;
  for(const preview of previews) await stopScope(db,{tenantId:p.tenantId,type:'PREVIEW',id:preview.id},'PRIVACY_DELETED','CANCELLED');
  for (const sample of samples) await stopScope(db,{tenantId:p.tenantId,type:'SAMPLE',id:sample.id},'PRIVACY_DELETED','CANCELLED');
  await db.query(`UPDATE public_samples s SET state='FAILED',data=data||'{"state":"FAILED"}'::jsonb,
    private=private||'{"media_revoked":true,"termination_reason":"PRIVACY_DELETED"}'::jsonb,updated_at=now()
    WHERE tenant_id=$1 AND owner_id=$2 AND product_id=ANY($3::text[]) AND NOT EXISTS(SELECT 1 FROM privacy_redactions r WHERE r.tenant_id=s.tenant_id AND r.target_table='public_samples' AND r.target_id=s.id)`,[p.tenantId,p.userId,products]);
  await db.query(`UPDATE agent_capabilities c SET revoked_at=COALESCE(c.revoked_at,now()) FROM stage_runs s
    WHERE c.tenant_id=$1 AND s.tenant_id=c.tenant_id AND s.id=c.stage_run_id AND s.scope_type='ORDER' AND s.scope_id=ANY($2::text[])`, [p.tenantId, orderIds]);
  const assets = (await db.query<{ id: string }>(`UPDATE assets SET state='DELETED',updated_at=now()
    WHERE tenant_id=$1 AND owner_id=$2 AND ($3::boolean OR product_id=ANY($4::text[])) AND ($5::text[] IS NULL OR id=ANY($5)) RETURNING id`,
    [p.tenantId, p.userId, request.scope === 'ACCOUNT_MEDIA', products, options.replay?.asset_ids ?? null])).rows.map(r => r.id);
  await db.query("UPDATE privacy_deletions SET private=private||jsonb_build_object('asset_ids',$2::jsonb) WHERE id=$1", [data.deletion_id, JSON.stringify(assets)]);
  for (const [type, ids] of [['PRODUCT', products], ['ORDER', orderIds], ['ASSET', assets]] as const) for (const target of ids)
    await db.query(`INSERT INTO deletion_markers(id,tenant_id,owner_id,target_type,target_id,request_id,data)
      VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(tenant_id,target_type,target_id) DO NOTHING`,
      [id('marker'), p.tenantId, p.userId, type, target, data.deletion_id, JSON.stringify({ reason: 'PRIVACY_DELETED' })]);
  await db.query(`UPDATE private_object_writes SET delete_requested=true,erase_available_at=now(),updated_at=now()
    WHERE tenant_id=$1 AND owner_id=$2 AND (($3::boolean AND ($6::timestamptz IS NULL OR created_at<=$6)) OR product_id=ANY($4::text[]) OR order_id=ANY($5::text[]) OR authorized_sample_id=ANY($7::text[]))`,
    [p.tenantId, p.userId, request.scope === 'ACCOUNT_MEDIA', products, orderIds, options.replay?.created_at ?? null, publicCopies]);
  const related = (await db.query<{ id: string }>(`SELECT id FROM plan_versions WHERE tenant_id=$1 AND product_id=ANY($2::text[])
    UNION SELECT id FROM optional_previews WHERE tenant_id=$1 AND product_id=ANY($2::text[])
    UNION SELECT id FROM artifacts WHERE tenant_id=$1 AND order_id=ANY($3::text[])
    UNION SELECT q.id FROM quotes q JOIN plan_versions v ON v.tenant_id=q.tenant_id AND v.id=q.plan_id WHERE v.tenant_id=$1 AND v.product_id=ANY($2::text[])`, [p.tenantId, products, orderIds])).rows.map(r => r.id);
  const contentIds = [...products, ...assets, ...orderIds, ...related, ...samples.map(s=>s.id)];
  await db.query(`UPDATE idempotency_records SET revoked_at=now(),response='{}' WHERE tenant_id=$1 AND subject_id=$2
    AND operation=ANY($3::text[]) AND ($4::boolean OR target_id=ANY($5::text[])
      OR response->>'product_id'=ANY($5::text[]) OR response->>'asset_id'=ANY($5::text[])
      OR response->>'order_id'=ANY($5::text[]) OR response->>'quote_id'=ANY($5::text[]) OR response->>'sample_id'=ANY($5::text[]))`,
    [p.tenantId, p.userId, ['createProduct','createUploadGrant','completeAssetUpload','bindProductPhotos','createAnalysis','correctProfile',
      'createPlan','createOptionalPreview','createPreviewLink','createQuote','createDownloadLink','createSaveSession','requestLimitedRevision','createPresetSample','createPrivateSampleMediaLinks'],
    request.scope === 'ACCOUNT_MEDIA' && !options.replay, contentIds]);
  await outbox(db, p.tenantId, 'PrivacyDeletionRequested', data.deletion_id, `privacy:${data.deletion_id}`, { deletion_id: data.deletion_id });
  if (options.journal) {
    try { await options.journal.append(db, { schema_version: '1.0.0', source_id: options.journal.sourceId,
      request_id: data.deletion_id, tenant_id: p.tenantId, owner_id: p.userId, created_at: data.created_at, scope: request.scope,
      product_ids: products, order_ids: orderIds, asset_ids: assets, origin, authorized_sample_ids: publicCopies }); }
    catch (error) { throw new AppError(error instanceof AppError ? error.code : 'PRIVACY_JOURNAL_UNAVAILABLE', '删除请求暂未完成，请稍后重试', 503, true); }
  }
  return data;
}
export const HELP_ARTICLES: DTO<'HelpArticle'>[] = [
  { article_id: 'taking-photos', title: '怎样拍出可用的商品照片', body: '拍3至5张同一件商品：正面整体、斜侧角度、真实细节。保持包装和数量一致，不用填写商品表。模糊或看不清的内容会提示补拍。' },
  { article_id: 'payment-and-delivery', title: '付款后怎样领取素材', body: '以订单页面的服务端付款状态为准。整包制作和验收完成后可保存到相册。领取期为7天；关闭小程序不会中断云端制作。' },
  { article_id: 'save-permission', title: '相册授权被拒绝怎么办', body: '打开小程序设置并允许相册权限，再回到素材页面重试失败项。下载完成不代表已保存到相册。' },
  { article_id: 'revision', title: '一次小修改包含什么', body: '交付后48小时内，可成功修改一次封面、素材展示顺序或允许的展示文字。重新生成声音不在范围内。平台制作错误请通过订单售后处理。' },
];
