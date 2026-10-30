import {mkdir,rm,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import type pg from 'pg';
import type {Db} from '../../api/db/pool.js';
import {transaction} from '../../api/db/pool.js';
import type {Config} from '../../api/config.js';
import {inside} from '../../api/config.js';
import {hash,sha256,id} from '../../api/lib/crypto.js';
import {requireThat,AppError} from '../../api/lib/errors.js';
import {validate} from '../../api/lib/validation.js';
import {insert} from '../../api/db/store.js';
import type {DTO} from '../../shared/contracts/types.js';
import type {ObjectStorage} from '../../api/storage/storage.js';
import {writePrivateObject} from '../../api/storage/private-objects.js';
import type {ExecutionContext} from '../compiler/order-context.js';
import {operationArtifacts} from '../media/artifacts.js';
import {inspectImage} from '../media/photo-pipeline.js';
import {inspectVideo,nativeCommand} from '../media/native.js';
import {currentReviewPacket,packetImages as originalImages} from '../review/context.js';
import {assertReviewConsensus} from '../review/packet.js';
import {checkReviewImages,type ReviewImage,type ReviewImageBinding} from '../codex/review-images.js';
import {PendingExternal} from '../queue/leases.js';
import {toolScopeById,type ToolScope} from '../tool-gateway/http.js';
import type {ToolLease} from '../tool-gateway/consumer.js';
import {revisionContext,revisionAdmission,type RevisionContext,type RevisionRow} from './context.js';
import {repairExecutionContext} from '../repair/context.js';
import {packetReports} from '../review/reports.js';
import {generatedOutputs,checkGeneratedSources} from '../generation/outputs.js';
import {frozenAiDisclosure} from '../compiler/disclosure.js';
import {inspectDisclosure} from '../media/disclosure.js';
import {audioAuthority,retainedNativeAudio,type RetainedNativeAudio} from './audio.js';

export interface RevisionCandidate {revision_id:string;input_hash:string;items:DTO<'Deliverable'>[];cover_deliverable_id:string;candidate_hash:string}
export interface RevisionPacket {revision_id:string;input_hash:string;parent_manifest_hash:string;source_packet_id:string;source_packet_hash:string;
  candidate:RevisionCandidate;images:ReviewImageBinding[];native_audio?:RetainedNativeAudio;packet_hash:string}
export interface RevisionMediaResult {revision_id:string;input_hash:string;candidate_hash:string;artifact_ids:string[];tool_receipt_ids:string[]}
const hs={type:'string',pattern:'^[a-f0-9]{64}$'};
const ids={type:'array',minItems:1,maxItems:100,uniqueItems:true,items:{type:'string',maxLength:128}};
export const revisionMediaSchema={type:'object',additionalProperties:false,required:['revision_id','input_hash','candidate_hash','artifact_ids','tool_receipt_ids'],
  properties:{revision_id:{type:'string'},input_hash:hs,candidate_hash:hs,artifact_ids:ids,tool_receipt_ids:ids}};
export function expectedCandidate(c:RevisionContext):RevisionCandidate {
  const request=c.input.request;let items=structuredClone(c.parent.items);
  if(request.kind==='ALLOWED_ORDER')items=request.ordered_deliverable_ids!.map(id=>items.find(i=>i.deliverable_id===id)!);
  if(request.kind==='DISPLAY_TEXT')items=items.map(item=>item.kind==='copy'?{...item,
    deliverable_id:`revisioncopy_${sha256(`${c.row.id}:${item.slot_id}`).slice(0,32)}`,text:request.display_text!,sha256:sha256(Buffer.from(request.display_text!,'utf8'))}:item);
  const cover=request.kind==='COVER'?request.cover_deliverable_id!:c.parent.cover_deliverable_id??items.find(i=>i.kind==='image')!.deliverable_id;
  const body={revision_id:c.row.id,input_hash:c.inputHash,items,cover_deliverable_id:cover};return {...body,candidate_hash:hash(body)};
}
export function candidate(c:RevisionContext):RevisionCandidate {
  const saved=c.row.private.candidate as RevisionCandidate|undefined;
  requireThat(saved && hash(saved)===hash(expectedCandidate(c)),'REVISION_CANDIDATE_CHANGED','修改候选与冻结请求不一致',503);return saved;
}
export async function assertRevisionTool(db:Db,scope:ToolScope,intent:ToolLease):Promise<RevisionContext> {
  const current=await toolScopeById(db,scope.capability_id,true);
  requireThat(current.scope_type==='REVISION' && current.run_id===scope.run_id && current.snapshot_hash===scope.snapshot_hash,
    'TOOL_BINDING_CHANGED','修改工具已不属于当前角色',409);
  requireThat((await db.query(`SELECT id FROM agent_tool_intents WHERE tenant_id=$1 AND id=$2 AND run_id=$3 AND state='RUNNING'
    AND fencing_token=$4 AND lease_owner=$5 AND lease_expires_at>now() FOR UPDATE`,[scope.tenant_id,intent.id,scope.run_id,intent.fencing_token,intent.lease_owner])).rowCount===1,
  'TOOL_LEASE_LOST','修改工具租约已失效',409);
  return revisionContext(db,scope.tenant_id,scope.scope_id,scope.snapshot_hash,true);
}
/** Read the original sold inputs without reopening its expired production
 * lease. Aftercare uses its own frozen authorization and absolute deadline. */
async function originalContext(db:Db,c:RevisionContext):Promise<ExecutionContext> {
  const photo=(await db.query<{id:string;photo_set_hash:string}>(`SELECT id,photo_set_hash FROM product_photo_versions
    WHERE tenant_id=$1 AND product_id=$2 AND revision=$3`,[c.row.tenant_id,c.input.product_id,c.snapshot.photo_version])).rows[0];
  requireThat(photo?.photo_set_hash===c.snapshot.photo_set_hash,'INPUT_HASH_MISMATCH','原商品照片版本已不一致',503);
  const base:ExecutionContext={tenantId:c.row.tenant_id,ownerId:c.row.owner_id,orderId:c.row.order_id,snapshotHash:c.input.original_snapshot_hash,
    snapshot:c.snapshot,contract:c.contract,photoVersionId:photo.id};
  const published=(await db.query<{qc_stage_id:string;data:DTO<'ReviewPacket'>;binding:{packet_id:string;packet_hash:string;snapshot_hash:string}}>(`SELECT p.qc_stage_id,p.data,m.private AS binding
    FROM delivery_manifests m JOIN review_packets p ON p.tenant_id=m.tenant_id AND p.order_id=m.order_id AND p.id=m.private->>'packet_id'
    WHERE m.tenant_id=$1 AND m.owner_id=$2 AND m.order_id=$3 AND m.revision=1 AND p.snapshot_hash=$4`,
    [c.row.tenant_id,c.row.owner_id,c.row.order_id,c.input.original_snapshot_hash])).rows;
  requireThat(published.length===1&&published[0]!.binding.packet_hash===published[0]!.data.packet_hash
    &&published[0]!.binding.snapshot_hash===c.input.original_snapshot_hash,'REVISION_PARENT_UNVERIFIED','原交付缺少唯一且一致的封存发布记录',503);
  return repairExecutionContext(db,base,published[0]!.qc_stage_id);
}
async function sourcePacket(db:Db,cfg:Config,store:ObjectStorage,c:RevisionContext):Promise<{context:ExecutionContext;packet:DTO<'ReviewPacket'>;native_audio:RetainedNativeAudio|null}> {
  const context=await originalContext(db,c);const packet=await currentReviewPacket(db,context);assertReviewConsensus(packet);
  requireThat(packet.publication_decision==='ALLOW','REVISION_PARENT_UNVERIFIED','原交付缺少已发布的封存证据',503);
  const binding=(await db.query<{private:{packet_id:string;packet_hash:string}}>(`SELECT private FROM delivery_manifests
    WHERE tenant_id=$1 AND owner_id=$2 AND order_id=$3 AND revision=1`,[c.row.tenant_id,c.row.owner_id,c.row.order_id])).rows[0]?.private;
  requireThat(binding?.packet_id===packet.packet_id&&binding.packet_hash===packet.packet_hash
    &&hash(await packetReports(db,cfg,context,packet,null,c.snapshot.audio_policy.speech_mode==='NATIVE_ZH'?audioAuthority(c):undefined))===hash(packet.reports),
    'REVISION_PARENT_UNVERIFIED','原发布版本与独立复核持久证据不一致',503);
  // A later correction may inherit copy from an earlier accepted revision.
  // Walk only immutable, completed links back to the original sealed media;
  // revalidate each prior packet/role proof instead of treating metadata as PASS.
  let parent=c.parent;let links=0;
  while(parent.manifest_revision>1){
    requireThat(++links<=c.policy.limits.max_requests,'REVISION_PARENT_UNVERIFIED','父清单链超出原售后调用边界',503);
    const prior=(await db.query<RevisionRow>(`SELECT * FROM revision_requests WHERE tenant_id=$1 AND owner_id=$2 AND order_id=$3
      AND id=$4 AND state='COMPLETED' AND result_manifest_id=$5`,[c.row.tenant_id,c.row.owner_id,c.row.order_id,parent.revision_id,parent.manifest_id])).rows[0];
    const input=prior?.private.input;
    requireThat(prior&&input,'REVISION_PARENT_LINK_MISSING','父版本缺少已完成的原修改记录',503);
    requireThat(hash(input)===prior.input_hash&&input.revision_id===prior.id&&input.tenant_id===c.row.tenant_id
      &&input.owner_id===c.row.owner_id&&input.order_id===c.row.order_id,
      'REVISION_PARENT_INPUT_CHANGED','父版本冻结输入或归属不一致',503);
    requireThat(input.original_snapshot_hash===c.input.original_snapshot_hash&&input.original_contract_hash===c.input.original_contract_hash&&input.policy_hash===c.input.policy_hash,
      'REVISION_PARENT_SOURCE_CHANGED','父版本原合同或执行快照不一致',503);
    requireThat(input.parent_manifest_revision===parent.manifest_revision-1&&prior.parent_manifest_revision===input.parent_manifest_revision,
      'REVISION_PARENT_VERSION_CHANGED','父版本序号与原修改绑定不一致',503);
    requireThat(hash(input.request)===hash(prior.private.request),'REVISION_PARENT_REQUEST_CHANGED','父版本原修改请求不一致',503);
    // PostgreSQL's original order JSON can use +00:00, while the manifest
    // retains ISO Z. Require the identical instant without extending either.
    requireThat(Number.isFinite(Date.parse(input.delivery_expires_at))&&Date.parse(input.delivery_expires_at)===Date.parse(parent.expires_at),
      'REVISION_PARENT_EXPIRY_CHANGED','父版本领取期不一致',503);
    const previous=(await db.query<{data:DTO<'Deliverables'>;hash:string}>('SELECT data,hash FROM delivery_manifests WHERE tenant_id=$1 AND owner_id=$2 AND order_id=$3 AND id=$4',
      [c.row.tenant_id,c.row.owner_id,c.row.order_id,input.parent_manifest_id])).rows[0];
    requireThat(previous&&hash(previous.data)===previous.hash&&previous.hash===input.parent_manifest_hash
      &&previous.data.manifest_revision===input.parent_manifest_revision&&parent.parent_manifest_id===previous.data.manifest_id,
      'REVISION_PARENT_UNVERIFIED','父清单链与原版本摘要不一致',503);
    const priorContext:RevisionContext={...c,row:prior,input,parent:previous.data,inputHash:prior.input_hash};
    const sealed=revisionPacket(priorContext);
    requireThat(hash(sealed.candidate.items)===hash(parent.items)&&sealed.candidate.cover_deliverable_id===parent.cover_deliverable_id,
      'REVISION_PARENT_UNVERIFIED','父清单与前次验收候选不一致',503);
    const {validateRevisionCompletion}=await import('./review.js');await validateRevisionCompletion(db,cfg,priorContext);
    parent=previous.data;
  }
  const post=await operationArtifacts(db,context,'POST');
  requireThat(post.receipt.artifacts.length===parent.items.length && parent.items.every(i=>post.receipt.artifacts.some(a=>
    a.id===i.deliverable_id && a.slot_id===i.slot_id && a.sha256===i.sha256 && a.spec.kind===i.kind)),
  'REVISION_PARENT_UNVERIFIED','父清单与原封存文件不一致',503);
  if(context.snapshot.engine!=='PHOTO_LAYOUT'){
    const production=await operationArtifacts(db,context,'PRODUCTION');
    checkGeneratedSources(post.receipt,await generatedOutputs(db,cfg,store,context,production.operation.stage_run_id));
    const disclosure=frozenAiDisclosure(context.contract)!;
    requireThat(post.receipt.artifacts.filter(a=>a.spec.kind!=='copy').every(a=>a.spec.ai_disclosure?.contract_hash===hash(disclosure)
      &&a.spec.ai_disclosure.output_sha256===a.sha256),'AI_DISCLOSURE_PROOF_INVALID','原生成素材缺少对应冻结标识与文件的验收证明',503);
  }
  return {context,packet,native_audio:await retainedNativeAudio(db,cfg,store,c,context,packet)};
}
export async function candidateBytes(db:Db,store:ObjectStorage,c:RevisionContext,item:DTO<'Deliverable'>):Promise<Buffer> {
  const row=(await db.query<{object_key:string;sha256:string;slot_id:string}>(`SELECT a.object_key,a.sha256,a.slot_id FROM artifacts a
    JOIN private_object_writes w ON w.tenant_id=a.tenant_id AND w.order_id=a.order_id AND w.object_key=a.object_key AND w.sha256=a.sha256
    WHERE a.tenant_id=$1 AND a.order_id=$2 AND a.id=$3 AND w.owner_id=$4 AND w.product_id=$5 AND w.kind='MEDIA'
    AND w.state='STORED' AND NOT w.delete_requested AND w.expires_at>clock_timestamp()`,[c.row.tenant_id,c.row.order_id,item.deliverable_id,c.row.owner_id,c.input.product_id])).rows[0];
  requireThat(row && row.sha256===item.sha256 && row.slot_id===item.slot_id,'REVISION_MEDIA_UNAVAILABLE','修改素材缺少有效的私有对象登记',503);
  const bytes=await store.get(row.object_key,item.kind==='video'?512_000_000:30_000_000);
  requireThat(sha256(bytes)===item.sha256,'ARTIFACT_HASH_MISMATCH','修改素材实际字节摘要不一致',503);return bytes;
}
export async function makeCandidate(pool:pg.Pool,store:ObjectStorage,scope:ToolScope,intent:ToolLease):Promise<RevisionCandidate> {
  let c=await transaction(pool,db=>assertRevisionTool(db,scope,intent));const output=expectedCandidate(c);
  if(c.input.request.kind==='DISPLAY_TEXT') {
    const item=output.items.find(i=>i.kind==='copy')!;const bytes=Buffer.from(item.text!,'utf8');
    const key=`${c.row.tenant_id}/revisions/${c.row.id}/${item.deliverable_id}.txt`;
    const binding={artifact_id:item.deliverable_id,object_key:key,sha256:item.sha256,size_bytes:bytes.length,slot_id:item.slot_id};
    await transaction(pool,async db=>{const current=await assertRevisionTool(db,scope,intent);
      requireThat(!current.row.private.output_intent || hash(current.row.private.output_intent)===hash(binding),'REVISION_OUTPUT_CHANGED','原修改文件意图不可替换',503);
      await db.query(`UPDATE revision_requests SET private=private||jsonb_build_object('output_intent',$3::jsonb) WHERE tenant_id=$1 AND id=$2`,[scope.tenant_id,c.row.id,JSON.stringify(binding)]);});
    try {await writePrivateObject(pool,store,{tenantId:c.row.tenant_id,ownerId:c.row.owner_id,orderId:c.row.order_id,productId:c.input.product_id,
      revisionId:c.row.id,kind:'MEDIA',expiresAt:c.input.delivery_expires_at},key,bytes,'text/plain; charset=utf-8');}
    catch(error){const pending=await pool.query("SELECT id FROM private_object_writes WHERE tenant_id=$1 AND object_key=$2 AND state IN ('WRITING','UNKNOWN')",[c.row.tenant_id,key]);
      if(pending.rowCount || error instanceof AppError && error.code==='PRIVATE_OBJECT_WRITE_PENDING')throw new PendingExternal(3,'REVISION_ORIGINAL_WRITE_UNRESOLVED');throw error;}
    await transaction(pool,async db=>{await assertRevisionTool(db,scope,intent);
      await db.query(`INSERT INTO artifacts(id,tenant_id,order_id,stage_run_id,slot_id,object_key,sha256,spec_json,data,expires_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10) ON CONFLICT(id) DO NOTHING`,[item.deliverable_id,c.row.tenant_id,c.row.order_id,scope.stage_run_id,item.slot_id,key,item.sha256,
        JSON.stringify({kind:'copy',phase:'REVISION',revision_id:c.row.id,input_hash:c.inputHash,parent_manifest_hash:c.input.parent_manifest_hash,inspection:{kind:'copy',bytes:bytes.length,encoding:'utf-8'}}),
        JSON.stringify({artifact_id:item.deliverable_id,slot_id:item.slot_id,revision_id:c.row.id}),c.input.delivery_expires_at]);});
  }
  await transaction(pool,async db=>{c=await assertRevisionTool(db,scope,intent);
    requireThat(hash(output)===hash(expectedCandidate(c)),'REVISION_CANDIDATE_CHANGED','修改请求发生变化',503);
    await db.query(`UPDATE revision_requests SET private=private||jsonb_build_object('candidate',$3::jsonb) WHERE tenant_id=$1 AND id=$2`,[scope.tenant_id,c.row.id,JSON.stringify(output)]);});
  return output;
}
export async function inspectCandidate(db:Db,cfg:Config,store:ObjectStorage,c:RevisionContext,signal:AbortSignal):Promise<void> {
  const output=candidate(c);const source=await sourcePacket(db,cfg,store,c);
  const disclosure=frozenAiDisclosure(source.context.contract);
  const directory=inside(cfg.runtimeRoot,`revision-qc/${c.row.id}/${id('attempt')}`);await mkdir(directory,{recursive:true});
  try {for(const item of output.items){
    requireThat(!signal.aborted && Date.parse(c.input.deadline_at)>Date.now(),'REVISION_DEADLINE_EXCEEDED','修改已中断或到期',409);
    const bytes=await candidateBytes(db,store,c,item);
    if(item.kind==='copy')requireThat(new TextDecoder('utf-8',{fatal:true}).decode(bytes)===item.text,'REVISION_COPY_CHANGED','配套文案与实际文件不一致',503);
    else if(item.kind==='image'){const actual=await inspectImage(bytes);requireThat(actual.width===item.width && actual.height===item.height && bytes.length===item.size_bytes,
      'REVISION_MEDIA_SPEC_INVALID','修改图片规格与原交付不一致',503);
      if(disclosure)await inspectDisclosure(cfg,disclosure,bytes,{kind:'image',width:actual.width,height:actual.height,frames:1,directory,deadline_at:c.input.deadline_at,signal});}
    else {const file=join(directory,`${item.deliverable_id}.mp4`);await writeFile(file,bytes);const actual=await inspectVideo(cfg,file,signal);
      requireThat(actual.width===item.width && actual.height===item.height && actual.fps===item.fps && actual.frames===item.duration_frames
        && actual.bytes===item.size_bytes && actual.hasAudio===(c.snapshot.audio_policy.speech_mode==='NATIVE_ZH') && actual.codec==='h264','REVISION_MEDIA_SPEC_INVALID','修改视频规格与原交付不一致',503);
      await nativeCommand(cfg,process.env.FFMPEG_PATH?.trim()||'ffmpeg',['-hide_banner','-loglevel','error','-xerror','-nostdin','-threads','2','-protocol_whitelist','file,pipe','-i',file,'-map','0:v:0',
        ...(actual.hasAudio?['-map','0:a:0']:['-an']),'-f','null','-'],
        {cwd:directory,timeoutMs:Math.max(1,Math.min(120000,Date.parse(c.input.deadline_at)-Date.now())),signal});}
    if(item.kind==='video'&&disclosure)await inspectDisclosure(cfg,disclosure,bytes,{kind:'video',width:item.width!,height:item.height!,frames:item.duration_frames!,directory,deadline_at:c.input.deadline_at,signal});
  }}finally{await rm(inside(cfg.runtimeRoot,directory),{recursive:true,force:true});}
}
export async function buildRevisionPacket(db:Db,cfg:Config,store:ObjectStorage,c:RevisionContext,signal:AbortSignal):Promise<RevisionPacket> {
  await inspectCandidate(db,cfg,store,c,signal);const source=await sourcePacket(db,cfg,store,c);
  const images=await originalImages(db,store,source.context,source.packet);await checkReviewImages(images,revisionAdmission(cfg,c));
  const body={revision_id:c.row.id,input_hash:c.inputHash,parent_manifest_hash:c.input.parent_manifest_hash,source_packet_id:source.packet.packet_id,
    source_packet_hash:source.packet.packet_hash,candidate:candidate(c),images:images.map(({bytes:_bytes,...binding})=>binding),
    ...(source.native_audio?{native_audio:source.native_audio}:{})};
  return {...body,packet_hash:hash(body)};
}
export function revisionPacket(c:RevisionContext):RevisionPacket {
  const packet=c.row.private.qc_packet as RevisionPacket|undefined;requireThat(packet,'REVISION_QC_NOT_SEALED','修改尚未完成实际文件验收',409);
  const {packet_hash,...body}=packet;requireThat(packet_hash===hash(body) && packet.revision_id===c.row.id && packet.input_hash===c.inputHash
    && packet.parent_manifest_hash===c.input.parent_manifest_hash && hash(packet.candidate)===hash(candidate(c)),'REVISION_PACKET_CHANGED','修改封存包不一致',503);return packet;
}
export async function revisionImages(db:Db,cfg:Config,store:ObjectStorage,c:RevisionContext):Promise<ReviewImage[]> {
  const packet=revisionPacket(c);const source=await sourcePacket(db,cfg,store,c);
  requireThat(source.packet.packet_id===packet.source_packet_id && source.packet.packet_hash===packet.source_packet_hash,'REVISION_PACKET_CHANGED','原画面证据封存不一致',503);
  requireThat(hash(packet.native_audio??null)===hash(source.native_audio),'REVISION_AUDIO_EVIDENCE_CHANGED','售后原音视频、完整听音或转写封存不一致',503);
  const images=await originalImages(db,store,source.context,source.packet);
  requireThat(hash(images.map(({bytes:_bytes,...binding})=>binding))===hash(packet.images),'REVISION_PACKET_CHANGED','复核画面绑定已变化',503);
  await checkReviewImages(images,revisionAdmission(cfg,c));return images;
}
export async function validateRevisionMedia(db:Db,c:RevisionContext,runId:string,raw:RevisionMediaResult):Promise<void> {
  const output=candidate(c);
  requireThat(raw.revision_id===c.row.id && raw.input_hash===c.inputHash && raw.candidate_hash===output.candidate_hash
    && hash(raw.artifact_ids)===hash(output.items.map(i=>i.deliverable_id)) && Array.isArray(raw.tool_receipt_ids) && new Set(raw.tool_receipt_ids).size===raw.tool_receipt_ids.length,
    'REVISION_MEDIA_RESULT_INVALID','修改结果未覆盖完整候选清单',422);
  const proofs=(await db.query<{id:string;tool_name:string;data:{result:Record<string,unknown>}}>(`SELECT id,tool_name,data FROM agent_tool_intents
    WHERE tenant_id=$1 AND run_id=$2 AND id=ANY($3) AND state='SUCCEEDED'`,[c.row.tenant_id,runId,raw.tool_receipt_ids])).rows;
  requireThat(proofs.length===raw.tool_receipt_ids.length && ['execute_post_plan','inspect_actual_media'].every(name=>proofs.some(p=>p.tool_name===name
    && (p.data.result.candidate_hash===output.candidate_hash || (p.data.result.stage_result as RevisionMediaResult|undefined)?.candidate_hash===output.candidate_hash))),
    'REVISION_MEDIA_PROOF_MISSING','修改缺少实际制作和检测工具回执',503);
}
