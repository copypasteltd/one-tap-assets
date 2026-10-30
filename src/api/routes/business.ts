import type { PoolClient } from 'pg';
import type { Config } from '../config.js';
import type { DTO, Principal } from '../../shared/contracts/types.js';
import { owned, scoped, listOwned, type PageQuery } from '../db/store.js';
import { validate } from '../lib/validation.js';
import { requireThat, notFound } from '../lib/errors.js';
import { createProduct, bindPhotos, createAnalysis, getProfile, correctProfile } from '../modules/products.js';
import { createUploadGrant, completeAsset } from '../modules/assets.js';
import { listPresets, presetVersion } from '../modules/catalog.js';
import { createPlan, checkInput, createPreview } from '../modules/plans.js';
import { createQuote, createOrder, cancelOrder, requestRefundInternal } from '../modules/commerce.js';
import { getDeliverables, createDownloadLink, createSaveSession, recordSaveReceipt, requestRevision, previewLink,listRevisions } from '../modules/delivery.js';
import { HELP_ARTICLES, createTicket, requestDeletion } from '../modules/support.js';
import {listBuyerTickets,getBuyerTicket} from '../modules/support-desk.js';
import * as community from '../modules/community.js';
import { license, licenses } from '../modules/licenses.js';
import { deletionJournal } from '../privacy/journal.js';
import {originalPaymentAction} from '../modules/payment-actions.js';
import { publicSampleMedia, withdrawPublicSamples } from '../modules/authorized-samples.js';
import { getPreview } from '../modules/previews.js';
import {recommendPresets} from '../modules/recommendations.js';
import {recordRecommendationEvent} from '../modules/recommendation-events.js';
import {getUsageFeedback,setUsageFeedback} from '../modules/usage-feedback.js';

export interface BusinessContext { db: PoolClient; cfg: Config; principal: Principal | null; params: Record<string, string>; query: PageQuery; body: unknown }
export type BusinessHandler = (ctx: BusinessContext) => Promise<unknown>;
const principal = (ctx: BusinessContext): Principal => { if (!ctx.principal) throw new Error('Authenticated route missing principal'); return ctx.principal; };
const param = (ctx: BusinessContext, name: string): string => ctx.params[name] ?? notFound();

export const businessHandlers: Record<string, BusinessHandler> = {
  getUsageFeedback:async c=>getUsageFeedback(c.db,principal(c),param(c,'order_id')),
  setUsageFeedback:async c=>setUsageFeedback(c.db,principal(c),param(c,'order_id'),validate('UsageFeedbackRequest',c.body)),
  listPresetLicenses: async c => licenses(c.db, c.cfg, c.query),
  getPresetLicense: async c => license(c.db, param(c, 'license_id')),
  createProduct: async c => createProduct(c.db, principal(c)),
  listProducts: async c => listOwned(c.db, c.cfg, 'product_drafts', principal(c), c.query),
  getProduct: async c => (await owned<DTO<'Product'>>(c.db, 'product_drafts', param(c, 'product_id'), principal(c))).data,
  createUploadGrant: async c => createUploadGrant(c.db, c.cfg, principal(c), validate('AssetRequest', c.body)),
  completeAssetUpload: async c => completeAsset(c.db, principal(c), param(c, 'asset_id'), validate('AssetCompleteRequest', c.body)),
  bindProductPhotos: async c => bindPhotos(c.db, principal(c), param(c, 'product_id'), validate('PhotoBindingRequest', c.body)),
  createAnalysis: async c => createAnalysis(c.db, c.cfg, principal(c), param(c, 'product_id'), validate('AnalysisRequest', c.body)),
  getAnalysis: async c => (await owned<DTO<'Analysis'>>(c.db, 'analysis_jobs', param(c, 'analysis_id'), principal(c))).data,
  getProductProfile: async c => getProfile(c.db, principal(c), param(c, 'product_id')),
  correctProfile: async c => correctProfile(c.db, principal(c), param(c, 'product_id'), validate('CorrectionRequest', c.body)),
  listPresets: async c => listPresets(c.db, c.cfg, c.query),
  getPresetVersion: async c => presetVersion(c.db, param(c, 'preset_id'), param(c, 'version')),
  listPresetVariants: async c => ({ items: (await presetVersion(c.db, param(c, 'preset_id'), param(c, 'version'))).variants, next_cursor: null }),
  recordRecommendationEvent: async c => recordRecommendationEvent(c.db,c.cfg,principal(c),param(c,'product_id'),validate('RecommendationEventRequest',c.body)),
  recommendPresets: async c => recommendPresets(c.db,c.cfg,principal(c),param(c,'product_id'),c.query),
  checkVariantInput: async c => checkInput(c.db, principal(c), validate('InputCheckRequest', c.body)),
  createPlan: async c => createPlan(c.db, c.cfg, principal(c), validate('PlanRequest', c.body)),
  getPlan: async c => (await owned<DTO<'Plan'>>(c.db, 'plan_versions', param(c, 'plan_id'), principal(c))).data,
  createOptionalPreview: async c => createPreview(c.db, c.cfg, principal(c), param(c, 'product_id'), validate('PreviewRequest', c.body)),
  getOptionalPreview: async c => getPreview(c.db,principal(c),param(c,'preview_id')),
  createPreviewLink: async c => previewLink(c.db, c.cfg, principal(c), param(c, 'preview_id')),
  createQuote: async c => createQuote(c.db, c.cfg, principal(c), validate('QuoteRequest', c.body)),
  createOrder: async c => createOrder(c.db, c.cfg, principal(c), validate('OrderRequest', c.body)),
  listOrders: async c => listOwned(c.db, c.cfg, 'orders', principal(c), c.query),
  getOrder: async c => (await owned<DTO<'Order'>>(c.db, 'orders', param(c, 'order_id'), principal(c))).data,
  getOrCreatePaymentAction: async c => originalPaymentAction(c.db,c.cfg,principal(c),param(c,'order_id')),
  getJob: async c => (await owned<DTO<'Job'>>(c.db, 'render_jobs', param(c, 'job_id'), principal(c))).data,
  listJobStages: async c => { const job = await owned(c.db, 'render_jobs', param(c, 'job_id'), principal(c)); const rows = await c.db.query<{ data: DTO<'Stage'> }>('SELECT data FROM stage_runs WHERE tenant_id=$1 AND job_id=$2 ORDER BY created_at,id', [principal(c).tenantId, job.id]); return { items: rows.rows.map(r => r.data), next_cursor: null }; },
  getDeliverables: async c => getDeliverables(c.db, principal(c), param(c, 'order_id')),
  createDownloadLink: async c => createDownloadLink(c.db, c.cfg, principal(c), param(c, 'deliverable_id')),
  createSaveSession: async c => createSaveSession(c.db, principal(c), validate('SaveSessionRequest', c.body)),
  recordSaveReceipt: async c => recordSaveReceipt(c.db, principal(c), validate('SaveReceiptRequest', c.body)),
  cancelOrder: async c => cancelOrder(c.db, principal(c), param(c, 'order_id'), validate('ReasonRequest', c.body).reason_code),
  requestRefund: async c => {
    const p = principal(c); const order = await owned<DTO<'Order'>>(c.db, 'orders', param(c, 'order_id'), p, true);
    requireThat(['FAILED', 'CANCELLED', 'NOT_STARTED', 'QUEUED'].includes(order.data.fulfillment_state), 'REFUND_REQUIRES_SUPPORT', '制作中或已交付订单请通过问题反馈申请处理', 422);
    if (['NOT_STARTED', 'QUEUED'].includes(order.data.fulfillment_state)) await cancelOrder(c.db, p, order.id, validate('ReasonRequest', c.body).reason_code);
    return requestRefundInternal(c.db, p.tenantId, order.id, validate('ReasonRequest', c.body).reason_code);
  },
  getRefund: async c => { const row = await scoped<DTO<'Refund'>>(c.db, 'refunds', param(c, 'refund_id'), principal(c).tenantId); await owned(c.db, 'orders', row.data.order_id, principal(c)); return row.data; },
  requestLimitedRevision: async c => requestRevision(c.db, principal(c), param(c, 'order_id'), validate('RevisionRequest', c.body)),
  getRevision: async c => (await owned<DTO<'Revision'>>(c.db, 'revision_requests', param(c, 'revision_id'), principal(c))).data,
  listRevisions:async c=>listRevisions(c.db,c.cfg,principal(c),param(c,'order_id'),c.query),
  createSupportTicket: async c => createTicket(c.db, principal(c), param(c, 'order_id'), validate('TicketRequest', c.body)),
  listSupportTickets: async c => listBuyerTickets(c.db,c.cfg,principal(c),c.query),
  getSupportTicket: async c => getBuyerTicket(c.db,principal(c),param(c,'ticket_id')),
  listHelpArticles: async () => ({ items: HELP_ARTICLES, next_cursor: null }),
  requestPrivacyDeletion: async c => requestDeletion(c.db, principal(c), validate('PrivacyDeletionRequest', c.body), { journal: deletionJournal(c.cfg) }),
  getPrivacyDeletion: async c => (await owned<DTO<'PrivacyDeletion'>>(c.db, 'privacy_deletions', param(c, 'deletion_id'), principal(c))).data,
  listCommunityComponents: async c => community.components(c.db),
  listVariantBlueprints: async c => community.blueprints(c.db),
  listCommunityResources: async c => community.resources(c.db),
  submitRightsRecord: async c => community.submitRights(c.db, principal(c), validate('RightsRecordRequest', c.body)),
  getRightsRecord: async c => (await owned<DTO<'RightsRecord'>>(c.db, 'rights_records', param(c, 'rights_record_id'), principal(c))).data,
  listRightsRecords: async c => listOwned(c.db, c.cfg, 'rights_records', principal(c), c.query),
  createPresetDraft: async c => community.createDraft(c.db, principal(c), validate('PresetDraftRequest', c.body).config),
  listPresetDrafts: async c => listOwned(c.db, c.cfg, 'preset_drafts', principal(c), c.query),
  getPresetDraft: async c => (await owned<DTO<'PresetDraft'>>(c.db, 'preset_drafts', param(c, 'draft_id'), principal(c))).data,
  updatePresetDraft: async c => community.patchDraft(c.db, principal(c), param(c, 'draft_id'), validate('PresetDraftPatch', c.body)),
  createPresetSample: async c => community.sampleDraft(c.db, c.cfg, principal(c), param(c, 'draft_id'), validate('SampleRequest', c.body)),
  getPresetSample: async c => (await owned<DTO<'Sample'>>(c.db, 'public_samples', param(c, 'sample_id'), principal(c))).data,
  listPresetSamples: async c => community.listSamples(c.db, c.cfg, principal(c), param(c, 'draft_id'), c.query),
  createPrivateSampleMediaLinks: async c => community.sampleMedia(c.db, c.cfg, param(c, 'sample_id'), principal(c)),
  getPublicSampleMedia: async c => publicSampleMedia(c.db, c.cfg, param(c, 'sample_id')),
  withdrawPublicSamples: async c => withdrawPublicSamples(c.db, principal(c), param(c, 'publication_id'), validate('PublicSampleWithdrawalRequest', c.body)),
  getAppeal: async c => (await owned<DTO<'Appeal'>>(c.db, 'moderation_appeals', param(c, 'appeal_id'), principal(c))).data,
  submitPresetPublication: async c => community.submitPublication(c.db, c.cfg, principal(c), param(c, 'draft_id'), validate('PublicationRequest', c.body)),
  getPresetPublication: async c => (await owned<DTO<'Publication'>>(c.db, 'publications', param(c, 'publication_id'), principal(c))).data,
  listPresetPublications: async c => listOwned(c.db, c.cfg, 'publications', principal(c), c.query),
  listAppeals: async c => listOwned(c.db, c.cfg, 'moderation_appeals', principal(c), c.query),
  listAuthorReports: async c => community.listAuthorReports(c.db, c.cfg, principal(c), c.query),
  setFavorite: async c => community.favorite(c.db, principal(c), param(c, 'preset_id'), true),
  deleteFavorite: async c => community.favorite(c.db, principal(c), param(c, 'preset_id'), false),
  listFavorites: async c => community.listFavorites(c.db, c.cfg, principal(c), c.query),
  forkPreset: async c => community.fork(c.db, principal(c), param(c, 'preset_id'), validate('ForkRequest', c.body)),
  reportPreset: async c => community.report(c.db, principal(c), param(c, 'preset_id'), validate('ReportRequest', c.body)),
  listReports: async c => listOwned(c.db, c.cfg, 'moderation_reports', principal(c), c.query),
  getReport: async c => (await owned<DTO<'Report'>>(c.db, 'moderation_reports', param(c, 'report_id'), principal(c))).data,
  appealReportDecision: async c => community.appeal(c.db, principal(c), param(c, 'report_id'), validate('AppealRequest', c.body)),
};
