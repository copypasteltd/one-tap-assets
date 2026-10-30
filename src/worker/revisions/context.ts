import type {Db} from '../../api/db/pool.js';
import type {DTO,Principal} from '../../shared/contracts/types.js';
import {hash,id,iso} from '../../api/lib/crypto.js';
import {requireThat,notFound} from '../../api/lib/errors.js';
import {insert,owned} from '../../api/db/store.js';
import {lockMediaOwner} from '../../api/modules/media-access.js';
import {validate,validateInternal} from '../../api/lib/validation.js';
import {verifyResourceLicenses} from '../media/font.js';
import {validateCreativePlan} from '../compiler/plan.js';
import type {FrozenContract,Snapshot} from '../compiler/snapshot.js';
import {enqueueStage} from '../queue/enqueue.js';
import {ensureRevisionBudget,validateRevisionPolicy,limitedRevisionRoute,REVISION_STAGES,type RevisionInput,type RevisionPolicy} from './contract.js';
import {checkAdmission,type CodexAdmission} from '../codex/admission.js';
import type {Config} from '../../api/config.js';
import {validateGenerationExecution} from '../generation/contracts.js';
import {verifyNativeAudioLive} from '../audio/contract.js';
import {frozenOrderListening} from '../audio/listening-contract.js';

export interface RevisionRow {
  id:string;tenant_id:string;owner_id:string;order_id:string;state:DTO<'Revision'>['state'];deadline_at:Date;input_hash:string;
  parent_manifest_revision:number;kind:DTO<'RevisionRequest'>['kind']|'PLATFORM_REPAIR';consumes_user_allowance:boolean;result_manifest_id:string|null;
  data:DTO<'Revision'>;private:{input?:RevisionInput;request?:DTO<'RevisionRequest'>;[key:string]:unknown};
}
export interface RevisionContext {
  row:RevisionRow;input:RevisionInput;contract:FrozenContract;policy:RevisionPolicy;snapshot:Snapshot;
  parent:DTO<'Deliverables'>;inputHash:string;
}
export function checkedRevisionChange(pack:DTO<'Deliverables'>,request:DTO<'RevisionRequest'>,contract:FrozenContract):DTO<'RevisionRequest'> {
  validate('RevisionRequest',request);
  requireThat(pack.manifest_revision===request.manifest_revision,'MANIFEST_CHANGED','素材已更新，请刷新后修改',409);
  const fields=request.kind==='COVER'?['cover_deliverable_id']:request.kind==='ALLOWED_ORDER'?['ordered_deliverable_ids']:['display_text'];
  requireThat(Object.keys(request).every(key=>['kind','manifest_revision',...fields].includes(key)),
    'REVISION_FIELDS_CONFLICT','一次小修改只能提交对应类型的内容',422);
  if(request.kind==='COVER')requireThat(pack.items.some(i=>i.deliverable_id===request.cover_deliverable_id && i.kind==='image'),'INVALID_COVER','请选择本单交付的图片作为封面',422);
  if(request.kind==='COVER')requireThat(request.cover_deliverable_id!==(pack.cover_deliverable_id??pack.items.find(i=>i.kind==='image')?.deliverable_id),
    'REVISION_NO_CHANGE','请选择不同的素材包封面',422);
  if(request.kind==='ALLOWED_ORDER')requireThat(request.ordered_deliverable_ids?.length===pack.items.length
    && new Set(request.ordered_deliverable_ids).size===pack.items.length && request.ordered_deliverable_ids.every(i=>pack.items.some(x=>x.deliverable_id===i)),
  'INVALID_DELIVERY_ORDER','排序必须包含完整且不重复的素材列表',422);
  if(request.kind==='ALLOWED_ORDER')requireThat(hash(request.ordered_deliverable_ids)!==hash(pack.items.map(i=>i.deliverable_id)),'REVISION_NO_CHANGE','素材展示顺序尚未改变',422);
  if(request.kind==='DISPLAY_TEXT'){
    requireThat(request.display_text?.trim() && request.display_text===request.display_text.trim(),'REVISION_TEXT_INVALID','请输入完整的展示文字并去除首尾空白',422);
    requireThat(pack.items.filter(i=>i.kind==='copy').length===1,'REVISION_TEXT_UNAVAILABLE','本单缺少唯一可修改的配套展示文案',422);
    requireThat(request.display_text!==pack.items.find(i=>i.kind==='copy')?.text,'REVISION_NO_CHANGE','配套文案尚未改变',422);
    validateCreativePlan({...contract.creative,copy:request.display_text},contract.profile,contract.source);
  }
  return structuredClone(request);
}
export async function deliveredSource(db:Db,tenantId:string,orderId:string,ownerId:string):Promise<{
  contract:FrozenContract;policy:RevisionPolicy;snapshot:Snapshot;snapshotHash:string;contractHash:string;expiry:string;
}> {
  const order=(await db.query<{deadline_at:Date;private:{contract:FrozenContract;contract_hash:string};data:DTO<'Order'>}>(`SELECT deadline_at,private,data FROM orders
    WHERE tenant_id=$1 AND owner_id=$2 AND id=$3 AND payment_state='CONFIRMED' AND fulfillment_state='DELIVERED'
    AND NOT(private ? 'media_revoked')`,[tenantId,ownerId,orderId])).rows[0];
  requireThat(order && order.data.delivery_expires_at && Date.parse(order.data.delivery_expires_at)>Date.now(),'REVISION_ORDER_UNAVAILABLE','该订单未交付、已撤权或已过领取期',410);
  const contract=order.private.contract;requireThat(contract && hash(contract)===order.private.contract_hash,'EXECUTION_CONTRACT_MISMATCH','原订单合同摘要不一致',503);
  const policy=contract.revision_policy;requireThat(policy,'REVISION_CONTRACT_UNAVAILABLE','原订单缺少冻结的受限修改合同，请通过素材问题反馈处理',503);validateRevisionPolicy(policy);
  requireThat(policy.limits.owner_id===ownerId && policy.bundle_hash===contract.codex_contract.skill_bundle_hash
    && policy.budget_micro===contract.codex_contract.agent_cost_ceiling_micro && hash(policy.admission)===hash(contract.runtime_binding?.admission),
  'REVISION_CONTRACT_UNAVAILABLE','受限修改执行能力与原合同不一致',503);
  const snapshot=(await db.query<{hash:string;data:Snapshot}>('SELECT hash,data FROM execution_snapshots WHERE tenant_id=$1 AND order_id=$2',[tenantId,orderId])).rows[0] ?? notFound();
  validateInternal('execution-snapshot',snapshot.data);
  requireThat(hash(snapshot.data)===snapshot.hash && snapshot.data.tenant_id===tenantId && snapshot.data.order_id===orderId && snapshot.data.plan_hash===contract.plan_hash
    && snapshot.data.deadline_at===order.deadline_at.toISOString() && snapshot.data.product_id===contract.product.product_id
    && snapshot.data.profile_hash===contract.profile.profile_hash && snapshot.data.identity_lock_hash===contract.identity_lock_hash
    && snapshot.data.photo_set_hash===contract.photo_set_hash && snapshot.data.engine===contract.source.engine && snapshot.data.variant_id===contract.source.variant_id
    && hash(snapshot.data.codex_contract)===hash(contract.codex_contract) && hash(snapshot.data.resource_versions)===hash(contract.resource_versions)
    && hash(snapshot.data.model_versions)===hash(contract.model_versions)
    && snapshot.data.revision_policy_hash===hash(policy),'EXECUTION_SNAPSHOT_MISMATCH','原订单执行快照与修改合同不一致',503);
  const product=await db.query(`SELECT id FROM product_drafts WHERE tenant_id=$1 AND owner_id=$2 AND id=$3 AND deleted_at IS NULL AND expires_at>clock_timestamp()`,
    [tenantId,ownerId,contract.product.product_id]);requireThat(product.rowCount===1,'MEDIA_REVOKED','原商品输入已删除或过期',410);
  const refund=await db.query("SELECT id FROM refunds WHERE tenant_id=$1 AND order_id=$2 AND state NOT IN ('FAILED','CANCELLED')",[tenantId,orderId]);
  requireThat(!refund.rowCount,'REVISION_REFUND_PENDING','该订单已退款或正在处理退款',409);
  await verifyResourceLicenses(db,contract.resource_versions);
  return {contract,policy,snapshot:snapshot.data,snapshotHash:snapshot.hash,contractHash:order.private.contract_hash,expiry:order.data.delivery_expires_at};
}
export async function createRevision(db:Db,p:Pick<Principal,'tenantId'|'userId'>,orderId:string,pack:DTO<'Deliverables'>,raw:DTO<'RevisionRequest'>,
  platformError?:RevisionInput['platform_error']):Promise<DTO<'Revision'>> {
  await lockMediaOwner(db,p.tenantId,p.userId);await owned<DTO<'Order'>>(db,'orders',orderId,p,true);
  const source=await deliveredSource(db,p.tenantId,orderId,p.userId);const request=checkedRevisionChange(pack,raw,source.contract);
  requireThat(limitedRevisionRoute(source.snapshot),'REVISION_POLICY_UNAVAILABLE','该路线的修改验收尚未开放',503);
  if(source.snapshot.engine!=='PHOTO_LAYOUT')validateGenerationExecution(source.contract,source.snapshot.audio_policy.speech_mode==='NATIVE_ZH');
  if(source.snapshot.audio_policy.speech_mode==='NATIVE_ZH'){
    requireThat(frozenOrderListening(source.contract),'INDEPENDENT_AUDIO_REVIEW_REQUIRED','原有声订单缺少冻结听音能力',503);
    await verifyNativeAudioLive(db,source.contract,true);
  }
  const parent=(await db.query<{hash:string;data:DTO<'Deliverables'>}>(`SELECT hash,data FROM delivery_manifests WHERE tenant_id=$1 AND owner_id=$2 AND order_id=$3 ORDER BY revision DESC LIMIT 1`,[p.tenantId,p.userId,orderId])).rows[0] ?? notFound();
  requireThat(hash(parent.data)===parent.hash && hash(parent.data)===hash(pack),'MANIFEST_CHANGED','原素材清单摘要已变更',409);
  const first=(await db.query<{delivered_at:Date}>('SELECT delivered_at FROM delivery_manifests WHERE tenant_id=$1 AND order_id=$2 ORDER BY revision LIMIT 1',[p.tenantId,orderId])).rows[0] ?? notFound();
  const windowEnds=first.delivered_at.getTime()+source.policy.window_hours*3600000;
  requireThat(windowEnds>Date.now(),'REVISION_WINDOW_EXPIRED','48小时小修改时限已结束',422);
  // A platform correction never consumes the customer's one small change, but
  // all changes serialize against the same current manifest and sold account.
  const active=await db.query<{consumes_user_allowance:boolean}>("SELECT consumes_user_allowance FROM revision_requests WHERE tenant_id=$1 AND order_id=$2 AND state IN ('REQUESTED','PROCESSING')",[p.tenantId,orderId]);
  requireThat(!active.rowCount,active.rows.some(r=>r.consumes_user_allowance)?'REVISION_ALLOWANCE_USED':'REVISION_IN_PROGRESS','本单已有修改或纠错正在处理，请等待原请求',422);
  const used=platformError?{rowCount:0}:await db.query("SELECT id FROM revision_requests WHERE tenant_id=$1 AND order_id=$2 AND consumes_user_allowance AND state='COMPLETED'",[p.tenantId,orderId]);
  requireThat(!used.rowCount,'REVISION_ALLOWANCE_USED','本单已有一次成功修改或正在修改',422);
  await ensureRevisionBudget(db,{tenantId:p.tenantId,ownerId:p.userId,orderId},source.policy);
  const pending=await db.query(`SELECT r.id FROM revision_cost_reservations r JOIN revision_budgets b ON b.tenant_id=r.tenant_id AND b.id=r.budget_id
    WHERE b.tenant_id=$1 AND b.order_id=$2 AND r.state IN ('RESERVED','UNKNOWN')`,[p.tenantId,orderId]);
  requireThat(!pending.rowCount,'REVISION_COST_UNRESOLVED','上次修改仍有未核对的执行费用，请等待原回执恢复',409);
  const revisionId=id('revision');const deadline=iso(Math.min(Date.now()+source.policy.deadline_seconds*1000,windowEnds,Date.parse(source.expiry)));
  const input:RevisionInput={revision_id:revisionId,tenant_id:p.tenantId,owner_id:p.userId,order_id:orderId,product_id:source.contract.product.product_id,
    request,parent_manifest_id:pack.manifest_id,parent_manifest_revision:pack.manifest_revision,parent_manifest_hash:parent.hash,
    original_snapshot_hash:source.snapshotHash,original_contract_hash:source.contractHash,policy_hash:hash(source.policy),deadline_at:deadline,delivery_expires_at:source.expiry,
    ...(platformError?{platform_error:structuredClone(platformError)}:{})};
  const consumes=!platformError;
  const data:DTO<'Revision'>={revision_id:revisionId,order_id:orderId,state:'REQUESTED',consumes_user_allowance:consumes,result_manifest_revision:null};const inputHash=hash(input);
  await insert(db,'revision_requests',{id:revisionId,tenant_id:p.tenantId,owner_id:p.userId,order_id:orderId,parent_manifest_revision:pack.manifest_revision,
    kind:platformError?'PLATFORM_REPAIR':request.kind,state:'REQUESTED',consumes_user_allowance:consumes,deadline_at:deadline,input_hash:inputHash,data,private:{request,input,manifest_id:pack.manifest_id}});
  let dependencies:string[]=[];
  for(const name of REVISION_STAGES) dependencies=[await enqueueStage(db,{tenantId:p.tenantId,scopeType:'REVISION',scopeId:revisionId,name,inputHash,deadlineAt:deadline,dependencies})];
  return data;
}
export function revisionAdmission(cfg:Config,c:RevisionContext):CodexAdmission {
  const admitted=checkAdmission(cfg,c.policy.admission);
  requireThat(admitted.review_vision && c.policy.limits.owner_id===c.row.owner_id,'REVISION_POLICY_UNAVAILABLE','修改缺少冻结视觉复核或费用归属能力',503);
  return admitted;
}
export async function revisionContext(db:Db,tenantId:string,revisionId:string,inputHash?:string,lock=false):Promise<RevisionContext>{
  const hint=(await db.query<{owner_id:string;order_id:string}>('SELECT owner_id,order_id FROM revision_requests WHERE tenant_id=$1 AND id=$2',[tenantId,revisionId])).rows[0] ?? notFound();
  if(lock){await lockMediaOwner(db,tenantId,hint.owner_id);await db.query('SELECT id FROM orders WHERE tenant_id=$1 AND id=$2 FOR UPDATE',[tenantId,hint.order_id]);}
  const row=(await db.query<RevisionRow>(`SELECT * FROM revision_requests WHERE tenant_id=$1 AND id=$2${lock?' FOR UPDATE':''}`,[tenantId,revisionId])).rows[0]!;
  const input=row.private.input;
  requireThat(input && ['REQUESTED','PROCESSING'].includes(row.state) && row.deadline_at?.getTime()>Date.now(),'REVISION_NO_LONGER_EXECUTABLE','受限修改已结束、到期或缺少冻结输入',409);
  requireThat(hash(input)===row.input_hash && (!inputHash || row.input_hash===inputHash) && input.revision_id===row.id && input.tenant_id===tenantId
    && input.owner_id===row.owner_id && input.order_id===row.order_id && input.parent_manifest_revision===row.parent_manifest_revision
    && input.deadline_at===row.deadline_at.toISOString() && hash(input.request)===hash(row.private.request)
    && (input.platform_error?row.kind==='PLATFORM_REPAIR'&&!row.consumes_user_allowance:input.request.kind===row.kind&&row.consumes_user_allowance),
  'REVISION_INPUT_CHANGED','受限修改冻结输入不一致',503);
  const source=await deliveredSource(db,tenantId,row.order_id,row.owner_id);
  requireThat(limitedRevisionRoute(source.snapshot),'REVISION_POLICY_UNAVAILABLE','原订单没有冻结对应路线的修改验收能力',503);
  if(source.snapshot.engine!=='PHOTO_LAYOUT')validateGenerationExecution(source.contract,source.snapshot.audio_policy.speech_mode==='NATIVE_ZH');
  if(source.snapshot.audio_policy.speech_mode==='NATIVE_ZH'){
    requireThat(frozenOrderListening(source.contract),'INDEPENDENT_AUDIO_REVIEW_REQUIRED','原有声订单缺少冻结听音能力',503);
    await verifyNativeAudioLive(db,source.contract,true);
  }
  if(input.platform_error){
    const proof=input.platform_error;
    const ticket=(await db.query<{data:DTO<'Ticket'>;private:Record<string,unknown>}>(`SELECT data,private FROM support_tickets
      WHERE tenant_id=$1 AND owner_id=$2 AND order_id=$3 AND id=$4 AND NOT(private ? 'privacy_deleted')`,[tenantId,row.owner_id,row.order_id,proof.ticket_id])).rows[0];
    const binding=ticket?.private.platform_repair as {revision_id:string;actor:string;ticket_revision:number}|undefined;
    requireThat(ticket&&binding?.revision_id===row.id&&binding.actor===proof.actor&&binding.ticket_revision===proof.ticket_revision
      && hash({category:ticket.data.category,message:ticket.private.message,attachments:ticket.private.attachment_asset_ids??[]})===proof.evidence_hash,
      'PLATFORM_REPAIR_EVIDENCE_CHANGED','平台纠错缺少原工单或原问题证据已撤销',410);
  }
  requireThat(source.snapshotHash===input.original_snapshot_hash && source.contractHash===input.original_contract_hash
    && hash(source.policy)===input.policy_hash && source.expiry===input.delivery_expires_at,'REVISION_INPUT_CHANGED','原订单或受限修改合同已变更',503);
  const parent=(await db.query<{hash:string;data:DTO<'Deliverables'>}>('SELECT hash,data FROM delivery_manifests WHERE tenant_id=$1 AND order_id=$2 ORDER BY revision DESC LIMIT 1',[tenantId,row.order_id])).rows[0] ?? notFound();
  requireThat(hash(parent.data)===parent.hash && parent.hash===input.parent_manifest_hash && parent.data.manifest_id===input.parent_manifest_id,
    'MANIFEST_CHANGED','受限修改父清单已变更',409);
  checkedRevisionChange(parent.data,input.request,source.contract);
  return {row,input,contract:source.contract,policy:source.policy,snapshot:source.snapshot,parent:parent.data,inputHash:row.input_hash};
}
