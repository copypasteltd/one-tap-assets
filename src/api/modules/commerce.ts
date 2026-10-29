import type { Db } from '../db/pool.js';
import type { Config } from '../config.js';
import type { DTO, Principal } from '../../shared/contracts/types.js';
import { owned, scoped, insert, update, outbox } from '../db/store.js';
import { id, hash, iso, addSeconds } from '../lib/crypto.js';
import { AppError, requireThat, notFound } from '../lib/errors.js';
import { getVariant } from './catalog.js';
import { validateInternal } from '../lib/validation.js';
import {validateCreativePlan,creativePlanHash,type CreativePlan} from '../../worker/compiler/plan.js';
import {validatePlanLayout} from '../../worker/media/plan-layout.js';
import { bindSnapshot, type FrozenContract, type ModelBinding, type ResourceBinding } from '../../worker/compiler/snapshot.js';
import { enqueueStage } from '../../worker/queue/enqueue.js';
import {freezeGenerationContracts,validateGenerationExecution,type GenerationModelRow} from '../../worker/generation/contracts.js';
import { stopScope } from '../../worker/lifecycle/termination.js';
import { requestRefundInternal } from './refunds.js';
import { checkAdmission, type CodexAdmission } from '../../worker/codex/admission.js';
import { bindProductionFont, loadProductionFont, verifyResourceLicenses } from '../../worker/media/font.js';
import { extendFrozenInputRetention } from './retention.js';
import { POLICIES } from '../../shared/domain/policies.js';
import { lockMediaOwner } from './media-access.js';
import {freezeRevisionPolicy,ensureRevisionBudget} from '../../worker/revisions/contract.js';
import {freezeNativeAudio,verifyNativeAudioLive} from '../../worker/audio/contract.js';
import {freezeAiDisclosure,frozenAiDisclosure} from '../../worker/compiler/disclosure.js';
export { requestRefundInternal } from './refunds.js';

export async function createQuote(db: Db, cfg: Config, p: Principal, request: DTO<'QuoteRequest'>): Promise<DTO<'Quote'>> {
  await lockMediaOwner(db, p.tenantId, p.userId);
  const plan = await owned<DTO<'Plan'>>(db, 'plan_versions', request.plan_id, p, true);
  requireThat(plan.data.state === 'READY' && plan.data.plan_hash === request.plan_hash, 'PLAN_CHANGED', '方案未就绪或版本已更新');
  const product = await owned<DTO<'Product'>>(db, 'product_drafts', plan.data.product_id, p);
  requireThat(!product.deleted_at && new Date(String(product.expires_at)).getTime() > Date.now()
    && product.data.profile_id === plan.profile_id, 'INPUT_VERSION_CHANGED', '商品输入已变更或过期，请重新生成方案');
  const variant = (await db.query<{ variant_id: string; version: string }>('SELECT variant_id,version FROM execution_variants WHERE id=$1', [plan.variant_version_id])).rows[0] ?? notFound();
  const current = await getVariant(db, variant.variant_id, variant.version, true);
  requireThat(current.data.sale_enabled && current.data.admission_state === 'ADMITTED' && current.data.price_fen !== null, 'VARIANT_NOT_FOR_SALE', '该制作规格尚未开放购买', 422);
  requireThat(cfg.paymentsEnabled && cfg.codex.enabled, 'SERVICE_NOT_ADMITTED', '制作或交易服务尚未开放', 503);
  const privateData = current.private as typeof current.private & { resource_versions?: ResourceBinding[]; repair_ceiling_micro?: number };
  const codexContract = privateData.codex_contract as DTO<'CodexContract'>;
  validateInternal('codex-contract', codexContract);
  const planned = plan.private?.runtime_admission as CodexAdmission | undefined;
  requireThat(planned && plan.private?.content_run_id && codexContract.runtime_sha256 === planned.runtime_sha256
    && codexContract.runtime_build_id === planned.runtime_build_id && codexContract.protocol_version === planned.protocol_version
    && codexContract.model_version_id === planned.model_version_id && codexContract.rate_version_id === planned.rate_version_id
    && codexContract.skill_bundle_hash === plan.private?.bundle_hash, 'PLAN_RUNTIME_BINDING_CHANGED', '报价执行能力与已完成内容规划不一致', 409);
  const admission = checkAdmission(cfg, planned);
  requireThat(admission.review_vision, 'REVIEW_VISION_NOT_ADMITTED', '独立复核的实际图片与费用能力尚未准入', 503);
  const bundle = (await db.query<{ state: string }>('SELECT state FROM skill_bundles WHERE bundle_hash=$1', [codexContract.skill_bundle_hash])).rows[0];
  requireThat(bundle?.state === 'ADMITTED', 'SKILL_BUNDLE_NOT_ADMITTED', '当前方案的制作能力尚未准入', 422);
  const models = await db.query<GenerationModelRow>('SELECT id,status,data,private FROM provider_model_versions WHERE id=ANY($1)', [privateData.model_version_ids ?? []]);
  requireThat(models.rows.length > 0 && models.rows.length === privateData.model_version_ids?.length && models.rows.every(m => m.status === 'ADMITTED'), 'MODEL_NOT_ADMITTED', '当前方案的模型能力尚未准入', 422);
  const profile = await owned<DTO<'Profile'>>(db, 'profile_versions', String(plan.profile_id), p);
  const lock = await scoped(db, 'identity_locks', profile.data.identity_lock_id, p.tenantId);
  const photo = (await db.query<{ photo_set_hash: string }>('SELECT photo_set_hash FROM product_photo_versions WHERE id=$1 AND tenant_id=$2', [plan.photo_version_id, p.tenantId])).rows[0] ?? notFound();
  const font=await loadProductionFont(cfg.projectRoot);
  const resources = bindProductionFont(privateData.resource_versions ?? []);
  await verifyResourceLicenses(db, resources);
  const contract: FrozenContract = { product: product.data, profile: profile.data, photo_set_hash: photo.photo_set_hash, identity_lock_hash: String(lock.hash),
    request: plan.private!.request as DTO<'PlanRequest'>, creative: plan.private!.creative as CreativePlan, source: privateData.source, plan_hash: request.plan_hash,
    model_versions: models.rows.map(m => m.data), resource_versions: resources, codex_contract: codexContract,
    budget_micro: privateData.budget_micro ?? 0, repair_ceiling_micro: privateData.repair_ceiling_micro ?? 0,
    runtime_binding: { admission, limits: { owner_id: p.userId, max_requests: codexContract.max_turns_per_role * 4,
      max_requests_per_role: codexContract.max_turns_per_role, max_input_tokens: codexContract.max_input_tokens,
      max_output_tokens: codexContract.max_output_tokens, ceiling_micro: codexContract.agent_cost_ceiling_micro,
      daily_ceiling_micro: codexContract.agent_cost_ceiling_micro } } };
  contract.revision_policy=freezeRevisionPolicy(contract);
  freezeAiDisclosure(contract);
  requireThat(creativePlanHash(contract.creative)===contract.plan_hash,'PLAN_CHANGED','报价的完整文案与原规划摘要不一致',409);
  validateCreativePlan(contract.creative,contract.profile,contract.source);
  await validatePlanLayout(contract.creative,contract.source,contract.request.preset_id,font,contract.ai_disclosure_contract);
  if(contract.source.engine!=='PHOTO_LAYOUT'){
    contract.generation_contracts=freezeGenerationContracts(cfg,models.rows);
  }
  await freezeNativeAudio(db,cfg,contract,models.rows);
  if(contract.source.engine!=='PHOTO_LAYOUT')validateGenerationExecution(contract);
  requireThat(contract.budget_micro >= codexContract.agent_cost_ceiling_micro + contract.revision_policy.budget_micro,
    'BUDGET_INVALID', '原订单总预算必须同时覆盖制作与受限修改', 503);
  const data: DTO<'Quote'> = { quote_id: id('quote'), plan_id: plan.id, plan_hash: request.plan_hash, state: 'OPEN', currency: 'CNY', amount_fen: current.data.price_fen,
    expires_at: addSeconds(900), output_slots: plan.data.output_slots, terms_version: 'YPCC-TERMS-3.1', hard_deadline_seconds: Number((privateData.source.slo_policy as { hard_deadline_seconds: number }).hard_deadline_seconds) };
  const binding = { tenant_id: p.tenantId, quote_id: data.quote_id, preview_session_id: plan.id, plan_hash: request.plan_hash, codex_contract: codexContract, codex_contract_hash: hash(codexContract), skill_bundle_hash: codexContract.skill_bundle_hash, expires_at: data.expires_at };
  validateInternal('codex-quote-binding', binding);
  await insert(db, 'quotes', { id: data.quote_id, tenant_id: p.tenantId, owner_id: p.userId, plan_id: plan.id, plan_hash: request.plan_hash, amount_fen: data.amount_fen, expires_at: data.expires_at, state: data.state, data, private: { contract, binding, contract_hash: hash(contract) } });
  return data;
}
export async function createOrder(db: Db, cfg: Config, p: Principal, request: DTO<'OrderRequest'>): Promise<DTO<'Order'>> {
  await lockMediaOwner(db, p.tenantId, p.userId);
  requireThat(request.channel === p.platform, 'PAYMENT_CHANNEL_MISMATCH', '请在当前小程序使用对应的支付方式', 403);
  const quote = await owned<DTO<'Quote'>>(db, 'quotes', request.quote_id, p, true);
  if (quote.state === 'CONSUMED') {
    const prior = await owned<DTO<'Order'>>(db, 'orders', String(quote.consumed_order_id), p); return prior.data;
  }
  requireThat(quote.state === 'OPEN' && Date.parse(quote.data.expires_at) > Date.now(), 'QUOTE_EXPIRED', '报价已过期，请重新确认清单和费用', 410);
  const contract = quote.private!.contract as FrozenContract;
  frozenAiDisclosure(contract);
  requireThat(hash(contract)===quote.private!.contract_hash,'QUOTE_CONTRACT_MISMATCH','原报价合同摘要不一致',503);
  requireThat(contract.source.audio_policy.speech==='none','NATIVE_AUDIO_NOT_ADMITTED','有声订单的独立听音、QC和交付尚未准入',503);
  await verifyNativeAudioLive(db,contract,true);
  const product = await owned<DTO<'Product'>>(db, 'product_drafts', contract.product.product_id, p);
  requireThat(!product.deleted_at && new Date(String(product.expires_at)).getTime() > Date.now()
    && product.data.profile_id === contract.profile.profile_id, 'INPUT_VERSION_CHANGED', '商品输入已更新或过期，请重新获取报价');
  const variant = await getVariant(db, contract.source.variant_id, contract.source.version, true);
  requireThat(variant.data.sale_enabled && variant.data.admission_state === 'ADMITTED', 'VARIANT_NOT_FOR_SALE', '当前方案已暂停销售', 422);
  const data: DTO<'Order'> = { order_id: id('order'), quote_id: quote.id, channel: p.platform, currency: 'CNY', amount_fen: quote.data.amount_fen,
    payment_state: 'CREATED', fulfillment_state: 'NOT_STARTED', refund_id: null, job_id: null, payable_until: quote.data.expires_at, delivery_expires_at: null, created_at: iso() };
  await insert(db, 'orders', { id: data.order_id, tenant_id: p.tenantId, owner_id: p.userId, quote_id: quote.id, channel: p.platform, app_id: p.appId, subject_id: p.subjectId,
    amount_fen: data.amount_fen, payment_state: data.payment_state, fulfillment_state: data.fulfillment_state, payable_until: data.payable_until, budget_micro: contract.budget_micro, data, private: { contract, contract_hash: hash(contract) } });
  await update(db, 'quotes', quote.id, { consumed_order_id: data.order_id, state: 'CONSUMED', data: { ...quote.data, state: 'CONSUMED' } }, p.tenantId);
  const paymentId = id('payment');
  await insert(db, 'payments', { id: paymentId, tenant_id: p.tenantId, order_id: data.order_id, provider: p.platform,
    merchant_id: p.platform === 'alipay' ? cfg.alipay.merchantId : cfg.douyin.merchantId, state: 'CREATED', amount_fen: data.amount_fen,
    intent_key: `payment:${data.order_id}`, data: { payment_id: paymentId, order_id: data.order_id, state: 'CREATED', channel: p.platform, expires_at: data.payable_until, action: { kind: 'QUERY_ORIGINAL_ORDER' } } satisfies DTO<'PaymentAction'> });
  await outbox(db, p.tenantId, 'PaymentRequested', data.order_id, `payment-request:${data.order_id}`, { payment_id: paymentId });
  return data;
}
export interface VerifiedPayment { channel: DTO<'Platform'>; appId: string; merchantId: string; subjectId: string; orderId: string; providerOrderId: string; eventKey: string; amountFen: number; rawHash: string }
export async function confirmPayment(db: Db, event: VerifiedPayment): Promise<DTO<'Order'>> {
  const owner = (await db.query<{ tenant_id: string; owner_id: string }>('SELECT tenant_id,owner_id FROM orders WHERE id=$1', [event.orderId])).rows[0] ?? notFound();
  await lockMediaOwner(db, owner.tenant_id, owner.owner_id);
  const result = await db.query<{ tenant_id: string; owner_id: string; data: DTO<'Order'>; private: { contract: FrozenContract; media_revoked?: boolean }; app_id: string; subject_id: string }>('SELECT * FROM orders WHERE id=$1 FOR UPDATE', [event.orderId]);
  const order = result.rows[0] ?? notFound(); const tenant = order.tenant_id;
  const payment = (await db.query<{ id: string; merchant_id: string; state: string; data: DTO<'PaymentAction'> }>('SELECT * FROM payments WHERE order_id=$1 AND tenant_id=$2 FOR UPDATE', [event.orderId, tenant])).rows[0] ?? notFound();
  requireThat(order.app_id === event.appId && order.subject_id === event.subjectId && order.data.channel === event.channel && payment.merchant_id === event.merchantId && order.data.amount_fen === event.amountFen && Number.isInteger(event.amountFen), 'PAYMENT_SCOPE_INVALID', '支付金额、应用、买家或商户不匹配', 403);
  await db.query('INSERT INTO payment_events(id,provider,merchant_id,event_key,payment_id,raw_hash) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(provider,merchant_id,event_key) DO NOTHING', [id('payevt'), event.channel, event.merchantId, event.eventKey, payment.id, event.rawHash]);
  if (payment.state === 'CONFIRMED') return order.data;
  await insert(db, 'ledger_entries', { id: id('ledger'), tenant_id: tenant, order_id: event.orderId, event_key: `paid:${payment.id}`, entry_type: 'PAYMENT', amount_fen: event.amountFen, currency: 'CNY' });
  await update(db, 'payments', payment.id, { state: 'CONFIRMED', provider_order_id: event.providerOrderId, data: { ...payment.data, state: 'CONFIRMED', action: { kind: 'QUERY_ORIGINAL_ORDER' } }, updated_at: iso() }, tenant);
  const canExecute=order.data.fulfillment_state==='NOT_STARTED'&&Date.parse(order.data.payable_until)>=Date.now()&&!('media_revoked' in order.private);
  let audioEligible=true;
  try{if(canExecute)await verifyNativeAudioLive(db,order.private.contract,true);}catch(e){
    if(e instanceof AppError&&['AUDIO_LICENSE_UNAVAILABLE','CHARACTER_VOICE_NOT_ADMITTED','AUDIO_CHARACTER_CHANGED','AUDIO_LICENSE_CHANGED','RESOURCE_LICENSE_UNAVAILABLE'].includes(e.code))audioEligible=false;
    else throw e;
  }
  const eligible = canExecute && audioEligible && await extendFrozenInputRetention(db, tenant, order.owner_id,
      { product_id: order.private.contract.product.product_id, photo_version: order.private.contract.profile.photo_version,
        photo_set_hash: order.private.contract.photo_set_hash }, addSeconds(POLICIES.deliveryDays * 86400));
  const data: DTO<'Order'> = { ...order.data, payment_state: 'CONFIRMED', fulfillment_state: eligible ? 'QUEUED' : 'CANCELLED' };
  if (eligible) {
    if(order.private.contract.revision_policy) await ensureRevisionBudget(db,
      {tenantId:tenant,ownerId:order.owner_id,orderId:data.order_id},order.private.contract.revision_policy);
    const snapshot = bindSnapshot(data, tenant, order.private.contract, iso()); const snapshotId = id('snapshot'); const jobId = id('job');
    await insert(db, 'execution_snapshots', { id: snapshotId, tenant_id: tenant, order_id: data.order_id, hash: hash(snapshot), data: snapshot });
    const job: DTO<'Job'> = { job_id: jobId, order_id: data.order_id, state: 'QUEUED', current_stage: 'PRODUCTION', completed_stage_count: 0, total_stage_count: 6, repair_rounds: 0, deadline_at: snapshot.deadline_at, updated_at: iso() };
    await insert(db, 'render_jobs', { id: jobId, tenant_id: tenant, owner_id: order.owner_id, order_id: data.order_id, execution_snapshot_id: snapshotId, state: job.state, deadline_at: snapshot.deadline_at, data: job });
    const stageNames = ['PRODUCTION', 'POST', 'QC', 'REVIEW_FACTS', 'REVIEW_STYLE', 'DELIVER']; let dependency: string[] = [];
    for (const name of stageNames) {
      const stage = await enqueueStage(db, { tenantId: tenant, scopeType: 'ORDER', scopeId: data.order_id, name, inputHash: hash(snapshot), deadlineAt: snapshot.deadline_at, jobId, dependencies: dependency });
      dependency = [stage];
    }
    data.job_id = jobId;
    await db.query('UPDATE orders SET deadline_at=$1 WHERE id=$2', [snapshot.deadline_at, data.order_id]);
    await outbox(db, tenant, 'RenderRequested', data.order_id, `render:${data.order_id}`, { job_id: jobId });
  }
  await update(db, 'orders', data.order_id, { data, payment_state: data.payment_state, fulfillment_state: data.fulfillment_state, updated_at: iso() }, tenant);
  if (!eligible) data.refund_id = (await requestRefundInternal(db, tenant, data.order_id, audioEligible?'LATE_OR_CANCELLED_PAYMENT':'AUDIO_RIGHTS_UNAVAILABLE')).refund_id;
  return data;
}
export async function cancelOrder(db: Db, p: Principal, orderId: string, reason: string): Promise<DTO<'Order'>> {
  const row = await owned<DTO<'Order'>>(db, 'orders', orderId, p, true);
  requireThat(['NOT_STARTED', 'QUEUED', 'CANCELLED'].includes(row.data.fulfillment_state), 'CANCELLATION_NOT_ALLOWED', '制作已开始，请通过订单售后处理');
  await stopScope(db, { tenantId: p.tenantId, type: 'ORDER', id: orderId }, reason, 'CANCELLED');
  return (await owned<DTO<'Order'>>(db, 'orders', orderId, p)).data;
}
