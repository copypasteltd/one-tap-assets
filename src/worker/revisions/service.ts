import type pg from 'pg';
import {transaction} from '../../api/db/pool.js';
import type {Config} from '../../api/config.js';
import type {ObjectStorage} from '../../api/storage/storage.js';
import {hash,iso} from '../../api/lib/crypto.js';
import {requireThat} from '../../api/lib/errors.js';
import {insert,outbox} from '../../api/db/store.js';
import {validate} from '../../api/lib/validation.js';
import {verifyResourceLicenses} from '../media/font.js';
import {assertLease,PendingExternal,type StageLease} from '../queue/leases.js';
import type {StageCommit} from '../runtime.js';
import {CodexRuntimeAdapter,type RoleRequest,type RoleResult} from '../codex/runtime.js';
import type {RoleExecutor} from '../codex/planning.js';
import {REVISION_STAGES} from './contract.js';
import {revisionContext,revisionAdmission,type RevisionContext} from './context.js';
import {buildRevisionPacket,revisionPacket,revisionImages,candidateBytes,revisionMediaSchema,validateRevisionMedia,type RevisionMediaResult} from './media.js';
import {revisionReviewSchema,validateRevisionReview,validateRevisionCompletion} from './review.js';

export class RevisionService {
  private executor:RoleExecutor;
  constructor(private pool:pg.Pool,private cfg:Config,private store:ObjectStorage,executor?:RoleExecutor){
    requireThat(!executor || cfg.env==='test','TEST_PORT_FORBIDDEN','修改角色替身只允许显式测试环境',500);
    this.executor=executor??new CodexRuntimeAdapter(pool,cfg);
  }
  private async execute(request:RoleRequest,signal:AbortSignal):Promise<RoleResult>{
    const prior=(await this.pool.query<{id:string;instance_id:string;state:string;input_hash:string;output_hash:string;private:{stage_result?:unknown}}>(
      `SELECT * FROM agent_runs WHERE tenant_id=$1 AND private->>'stage_run_id'=$2 AND role=$3 ORDER BY created_at DESC LIMIT 1`,[request.lease.tenant_id,request.lease.id,request.role])).rows[0];
    if(!prior)return this.executor.execute(request,signal);
    requireThat(prior.input_hash===request.lease.input_hash,'REVISION_ROLE_CHECKPOINT_CHANGED','修改原角色输入摘要不一致',503);
    if(['RUNNING','UNKNOWN','LOADING_SKILLS'].includes(prior.state))throw new PendingExternal(5,'REVISION_PREVIOUS_ROLE_UNRESOLVED');
    requireThat(prior.state==='SUCCEEDED' && prior.output_hash && hash(prior.private.stage_result)===prior.output_hash,
      'REVISION_ROLE_FAILED','原修改角色未成功完成，不能重新购买未知推理',422);
    return {runId:prior.id,instanceId:prior.instance_id,result:prior.private.stage_result,resultHash:prior.output_hash};
  }
  async handle(lease:StageLease,signal:AbortSignal):Promise<StageCommit>{
    requireThat(lease.scope_type==='REVISION' && REVISION_STAGES.includes(lease.stage_name as typeof REVISION_STAGES[number]),'REVISION_STAGE_INVALID','修改阶段无效',500);
    const c=await transaction(this.pool,async db=>{await assertLease(db,lease);const current=await revisionContext(db,lease.tenant_id,lease.scope_id,lease.input_hash,true);
      await db.query(`UPDATE revision_requests SET state='PROCESSING',data=data||'{"state":"PROCESSING"}'::jsonb,updated_at=now() WHERE tenant_id=$1 AND id=$2`,[lease.tenant_id,lease.scope_id]);return current;});
    const admission=revisionAdmission(this.cfg,c);
    if(lease.stage_name==='REVISION_QC'){
      const packet=await buildRevisionPacket(this.pool,this.cfg,this.store,c,signal);
      return async db=>{await revisionContext(db,lease.tenant_id,lease.scope_id,lease.input_hash,true);
        await db.query(`UPDATE revision_requests SET private=private||jsonb_build_object('qc_packet',$3::jsonb),updated_at=now() WHERE tenant_id=$1 AND id=$2`,[lease.tenant_id,lease.scope_id,JSON.stringify(packet)]);};
    }
    if(lease.stage_name==='REVISION_COMPLETE')return this.finalize(lease,c,signal);
    const role=lease.stage_name==='REVISION'?'POST':lease.stage_name.slice(9) as 'REVIEW_FACTS'|'REVIEW_STYLE';
    const common={lease,role:role as RoleRequest['role'],admission,variantId:c.policy.skill_variant_id,bundleHash:c.policy.bundle_hash,limits:c.policy.limits,
      maxToolCalls:c.contract.codex_contract.max_tool_calls,maxScopeToolCalls:c.contract.codex_contract.max_tool_calls*3};
    const request:RoleRequest=role==='POST'?{...common,allowedTools:['execute_post_plan','inspect_actual_media','persist_stage_result'],outputSchema:revisionMediaSchema,
      input:{phase:'POST',snapshot_hash:c.inputHash,request:c.input.request,parent_manifest:c.parent,
        task:'仅执行冻结的小修改。调用execute_post_plan取得完整候选，inspect_actual_media检查全部artifact_ids，将回执加入tool_receipt_ids，经persist_stage_result保存并原样返回。禁止新增镜头、人物、商品事实、对白或修改预算。'}}:
      {...common,allowedTools:['extract_review_evidence','persist_stage_result'],outputSchema:revisionReviewSchema,
        review:{packetHash:revisionPacket(c).packet_hash,images:await revisionImages(this.pool,this.cfg,this.store,c),
          ...(revisionPacket(c).native_audio?{retained_native_audio_hash:hash(revisionPacket(c).native_audio)}:{})},
        input:{phase:role,packet_hash:revisionPacket(c).packet_hash,request:c.input.request,profile:c.contract.profile,source:c.contract.source,
          original_plan:c.contract.creative,parent_manifest:c.parent,packet:revisionPacket(c),
          ...(revisionPacket(c).native_audio?{retained_native_audio:revisionPacket(c).native_audio}:{}),
          task:`独立复核本次修改的${role==='REVIEW_FACTS'?'商品事实、原意、身份和交付规格':'风格、可读性、封面及展示顺序'}。调用extract_review_evidence并检查全部原图及实际视频画面。有声单读取完整原听音观察、实际转写、字幕、时间码及声音检测，对照新文案确认不改变原声语义，不把脚本文字当实际听音。配套文案不得新增事实；图片、字幕、音轨与视频内容必须保持原版。报告覆盖完整素材、画面及全部声音证据，问题绑定实际asset_id。只有全部符合才PASS，persist_stage_result后原样返回。`}};
    const result=await this.execute(request,signal);
    requireThat(hash(result.result)===result.resultHash,'REVISION_ROLE_CHECKPOINT_CHANGED','修改角色结果摘要不一致',503);
    return async db=>{const current=await revisionContext(db,lease.tenant_id,lease.scope_id,lease.input_hash,true);
      const run=(await db.query<{state:string;input_hash:string;output_hash:string}>('SELECT state,input_hash,output_hash FROM agent_runs WHERE tenant_id=$1 AND id=$2',[lease.tenant_id,result.runId])).rows[0];
      requireThat(run?.state==='SUCCEEDED' && run.input_hash===lease.input_hash && run.output_hash===result.resultHash,'REVISION_ROLE_CHECKPOINT_CHANGED','修改缺少已完成角色的持久证据',503);
      if(role==='POST'){
        await validateRevisionMedia(db,current,result.runId,result.result as RevisionMediaResult);
        const saved=current.row.private.post_result as {run_id:string;hash:string}|undefined;
        requireThat(saved?.run_id===result.runId && saved.hash===result.resultHash,'REVISION_POST_UNVERIFIED','修改制作结果未持久化',503);
      } else {const report=await validateRevisionReview(db,this.cfg,current,result.runId,result.result,true);
        requireThat(report.verdict==='PASS','REVISION_REVIEW_NOT_PASSED','修改复核存在未解决的问题',422);}
      await db.query(`UPDATE stage_runs SET private=private||jsonb_build_object('role_run_id',$3::text,'result_hash',$4::text) WHERE tenant_id=$1 AND id=$2`,[lease.tenant_id,lease.id,result.runId,result.resultHash]);};
  }
  private async finalize(lease:StageLease,c:RevisionContext,signal:AbortSignal):Promise<StageCommit>{
    await validateRevisionCompletion(this.pool,this.cfg,c);const packet=revisionPacket(c);
    await revisionImages(this.pool,this.cfg,this.store,c);for(const item of packet.candidate.items)await candidateBytes(this.pool,this.store,c,item);
    return async db=>{let current=await revisionContext(db,lease.tenant_id,lease.scope_id,lease.input_hash,true);
      await validateRevisionCompletion(db,this.cfg,current);
      requireThat(revisionPacket(current).packet_hash===packet.packet_hash,'REVISION_PACKET_CHANGED','修改发布时封存包已变更',503);
      await revisionImages(db,this.cfg,this.store,current);for(const item of packet.candidate.items)await candidateBytes(db,this.store,current,item);
      await verifyResourceLicenses(db,current.contract.resource_versions,true);await assertLease(db,lease);
      current=await revisionContext(db,lease.tenant_id,lease.scope_id,lease.input_hash,true);
      requireThat(!signal.aborted,'REVISION_ABORTED','修改发布已经中断',409);
      const manifest=validate('Deliverables',{order_id:current.row.order_id,manifest_id:`manifest_${hash({revision:current.row.id,packet:packet.packet_hash}).slice(0,40)}`,
        manifest_revision:current.parent.manifest_revision+1,expires_at:current.parent.expires_at,items:packet.candidate.items,
        parent_manifest_id:current.parent.manifest_id,revision_id:current.row.id,cover_deliverable_id:packet.candidate.cover_deliverable_id},true);
      await insert(db,'delivery_manifests',{id:manifest.manifest_id,tenant_id:current.row.tenant_id,owner_id:current.row.owner_id,order_id:current.row.order_id,
        revision:manifest.manifest_revision,hash:hash(manifest),data:manifest,expires_at:manifest.expires_at,delivered_at:iso(),
        private:{revision_id:current.row.id,parent_manifest_hash:current.input.parent_manifest_hash,packet_hash:packet.packet_hash,review_hash:hash(current.row.private.review_reports)}});
      const consumes=!current.input.platform_error;
      await db.query(`UPDATE revision_requests SET state='COMPLETED',result_manifest_id=$3,consumes_user_allowance=$5,
        data=data||jsonb_build_object('state','COMPLETED','result_manifest_revision',$4::int,'consumes_user_allowance',$5::boolean),updated_at=now()
        WHERE tenant_id=$1 AND id=$2 AND state='PROCESSING'`,[lease.tenant_id,current.row.id,manifest.manifest_id,manifest.manifest_revision,consumes]);
      await outbox(db,lease.tenant_id,'RevisionDelivered',current.row.order_id,`revision-delivered:${current.row.id}`,{revision_id:current.row.id,manifest_id:manifest.manifest_id});
      await outbox(db,lease.tenant_id,'ReleaseRequested',current.row.id,`release:revision:${current.row.id}`,{scope_type:'REVISION',reason:'DELIVERED'});
    };
  }
}
