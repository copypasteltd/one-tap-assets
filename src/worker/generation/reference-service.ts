import type pg from 'pg';
import type {Config} from '../../api/config.js';
import {transaction} from '../../api/db/pool.js';
import {hash} from '../../api/lib/crypto.js';
import {requireThat,AppError} from '../../api/lib/errors.js';
import type {ObjectStorage} from '../../api/storage/storage.js';
import {CodexRuntimeAdapter} from '../codex/runtime.js';
import type {RoleExecutor} from '../codex/planning.js';
import {checkAdmission} from '../codex/admission.js';
import {PendingExternal,type StageLease} from '../queue/leases.js';
import {generationContext} from './context.js';
import {referenceMaterial,referenceRoleInput} from './reference-material.js';
import {referenceReportSchema,validateReferenceReport,type ReferenceReport} from './reference-report.js';
import type {ReferenceApproval} from './reference-approval.js';
export type {ReferenceApproval} from './reference-approval.js';

export class ReferenceIdentityService {
  private executor:RoleExecutor;
  constructor(private pool:pg.Pool,private cfg:Config,private store:ObjectStorage,executor?:RoleExecutor){
    requireThat(!executor||cfg.env==='test','TEST_PORT_FORBIDDEN','参考核验替身只能用于显式测试环境',500);
    this.executor=executor??new CodexRuntimeAdapter(pool,cfg);
  }
  async review(lease:StageLease,signal:AbortSignal):Promise<ReferenceApproval>{
    requireThat(!signal.aborted,'REFERENCE_REVIEW_INTERRUPTED','参考核验已停止',409);
    const context=await transaction(this.pool,db=>generationContext(db,lease));
    const material=await referenceMaterial(this.pool,this.store,context,lease.id),cc=context.snapshot.codex_contract,binding=context.contract.runtime_binding;
    requireThat(binding&&binding.limits.owner_id===context.ownerId&&binding.limits.ceiling_micro===cc.agent_cost_ceiling_micro
      &&binding.limits.max_input_tokens===cc.max_input_tokens&&binding.limits.max_output_tokens===cc.max_output_tokens
      &&binding.limits.max_requests_per_role===cc.max_turns_per_role&&binding.limits.max_requests===cc.max_turns_per_role*4,
    'CODEX_SOLD_BINDING_INVALID','参考核验缺少原订单的冻结角色成本绑定',503);
    const admission=checkAdmission(this.cfg,binding.admission);
    requireThat(admission.runtime_sha256===cc.runtime_sha256&&admission.runtime_build_id===cc.runtime_build_id
      &&admission.protocol_version===cc.protocol_version&&admission.model_version_id===cc.model_version_id&&admission.rate_version_id===cc.rate_version_id,
    'CODEX_SOLD_BINDING_INVALID','参考核验的实际运行能力与已售合同不同',503);
    const prior=(await this.pool.query<{id:string;state:string;private:{stage_result?:ReferenceReport;review_input:{packet_hash:string}}}>(
      `SELECT id,state,private FROM agent_runs WHERE tenant_id=$1 AND private->>'stage_run_id'=$2
      AND private->'review_input'->>'purpose'='REFERENCE_IDENTITY' ORDER BY created_at`,[context.tenantId,lease.id])).rows;
    requireThat(prior.length<=1,'REFERENCE_REVIEW_DUPLICATE','原阶段存在多个参考核验，必须先恢复原运行',503);
    let runId:string,raw:unknown;
    if(prior[0]){
      requireThat(prior[0].private.review_input.packet_hash===material.packet.packet_hash,'REFERENCE_PACKET_CHANGED','原核验之后参考帧或商品证据已变化',409);
      if(prior[0].state==='FAILED'||prior[0].state==='CANCELLED')throw new AppError('REFERENCE_REVIEW_BLOCKED','原参考核验失败，不能通过重开会话绕过',503);
      if(prior[0].state!=='SUCCEEDED')throw new PendingExternal(5,'REFERENCE_REVIEW_UNRESOLVED');
      runId=prior[0].id;raw=prior[0].private.stage_result;
    }else{
      try{
        const completed=await this.executor.execute({lease,role:'REVIEW_FACTS',variantId:context.snapshot.variant_id,bundleHash:cc.skill_bundle_hash,
          admission,limits:binding.limits,maxToolCalls:cc.max_tool_calls,maxScopeToolCalls:cc.max_tool_calls,
          allowedTools:['extract_review_evidence','persist_stage_result'],input:referenceRoleInput(material.packet),outputSchema:referenceReportSchema,
          review:{purpose:'REFERENCE_IDENTITY',packetHash:material.packet.packet_hash,images:material.images}},signal);
        runId=completed.runId;raw=completed.result;
        requireThat(completed.resultHash===hash(raw),'REFERENCE_RESULT_CHANGED','参考角色返回摘要不一致',503);
      }catch(error){if(error instanceof AppError&&error.code==='REFERENCE_REVIEW_ALREADY_STARTED')throw new PendingExternal(2,error.code);throw error;}
    }
    const current=await transaction(this.pool,db=>generationContext(db,lease));
    const latest=await referenceMaterial(this.pool,this.store,current,lease.id);
    requireThat(latest.packet.packet_hash===material.packet.packet_hash,'REFERENCE_PACKET_CHANGED','核验期间商品或参考帧发生变化',409);
    const report=await validateReferenceReport(this.pool,this.cfg,current,latest,runId,raw);
    requireThat(report.verdict==='PASS'&&report.evidence_complete,'REFERENCE_IDENTITY_REJECTED','参考帧身份不符或证据不足，不得购买视频',422);
    return {run_id:runId,packet_hash:report.packet_hash,report_hash:hash(report),frames:latest.packet.frames.map(({asset_id,sha256,operation_key})=>({asset_id,sha256,operation_key}))};
  }
}
