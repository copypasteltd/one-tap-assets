import Ajv2020 from 'ajv/dist/2020.js';
import type {Db} from '../../api/db/pool.js';
import type {Config} from '../../api/config.js';
import {hash,sha256} from '../../api/lib/crypto.js';
import {requireThat} from '../../api/lib/errors.js';
import {bundleForHash} from '../codex/skills.js';
import {admissionHash} from '../codex/admission.js';
import type {ReviewInput} from '../codex/review-images.js';
import {sampleReviewSchema,type SampleReview} from '../samples/review.js';
import type {RevisionContext} from './context.js';
import {revisionPacket,validateRevisionMedia,type RevisionMediaResult} from './media.js';

export const revisionReviewSchema=sampleReviewSchema;
const valid=new Ajv2020({strict:false}).compile<SampleReview>(revisionReviewSchema);
export interface SavedRevisionReview {run_id:string;report:SampleReview;hash:string}
interface RoleRun {id:string;instance_id:string;role:'POST'|'REVIEW_FACTS'|'REVIEW_STYLE';state:string;input_hash:string;output_hash:string;
  thread_id:string;runtime_process_ref:string;role_identity_ref:string;
  private:{stage_run_id:string;runtime_admission:unknown;review_input?:ReviewInput;stage_result?:unknown};
  data:{loaded_skill_hashes:string[];runtime_process_ref:string;role_identity_ref:string}}
export function revisionAssetIds(c:RevisionContext):string[]{const packet=revisionPacket(c);return [...new Set([...packet.candidate.items.map(i=>i.deliverable_id),...packet.images.map(i=>i.asset_id)])];}
async function roleProof(db:Db,cfg:Config,c:RevisionContext,runId:string,role:RoleRun['role'],persisted:boolean):Promise<RoleRun> {
  const run=(await db.query<RoleRun>('SELECT * FROM agent_runs WHERE tenant_id=$1 AND id=$2',[c.row.tenant_id,runId])).rows[0];
  requireThat(run && ['RUNNING','SUCCEEDED'].includes(run.state) && (!persisted || run.state==='SUCCEEDED') && run.role===role
    && run.input_hash===c.inputHash && run.thread_id && run.runtime_process_ref && run.role_identity_ref
    && hash(run.private.runtime_admission)===hash(c.policy.admission),'REVISION_ROLE_UNVERIFIED','修改角色缺少原冻结运行绑定',503);
  const stage=await db.query(`SELECT id FROM stage_runs WHERE tenant_id=$1 AND id=$2 AND scope_type='REVISION' AND scope_id=$3 AND stage_name=$4 AND input_hash=$5`,
    [c.row.tenant_id,run.private.stage_run_id,c.row.id,role==='POST'?'REVISION':`REVISION_${role}`,c.inputHash]);
  const bundle=await bundleForHash(cfg,c.policy.bundle_hash);
  requireThat(stage.rowCount===1 && hash(run.data.loaded_skill_hashes)===hash(bundle.payload.roles[role].map(s=>s.sha256)),
    'REVISION_ROLE_UNVERIFIED','修改角色缺少对应阶段和Skill注入证据',503);
  const isolation=(await db.query<{admission_hash:string;data:{mode:string;packet_hash?:string;stage_run_id:string;isolation:string;virtualization:string;
    process_tree_bound:boolean;runtime_process_ref:string;role_identity_ref:string}}>('SELECT admission_hash,data FROM agent_isolation_evidence WHERE tenant_id=$1 AND run_id=$2 AND instance_id=$3',
      [c.row.tenant_id,runId,run.instance_id])).rows[0];
  requireThat(isolation && isolation.admission_hash===admissionHash(c.policy.admission) && isolation.data.stage_run_id===run.private.stage_run_id
    && isolation.data.isolation==='NATIVE_RESTRICTED_IDENTITY' && isolation.data.virtualization==='FORBIDDEN' && isolation.data.process_tree_bound===true
    && isolation.data.runtime_process_ref===`process-${sha256(run.runtime_process_ref)}` && isolation.data.runtime_process_ref===run.data.runtime_process_ref
    && isolation.data.role_identity_ref===`identity-${sha256(run.role_identity_ref)}` && isolation.data.role_identity_ref===run.data.role_identity_ref
    && (isolation.data.mode==='ADMITTED_NATIVE' || cfg.env==='test' && isolation.data.mode==='SYNTHETIC_PROTOCOL')
    && (role==='POST' || isolation.data.packet_hash===revisionPacket(c).packet_hash),
    'REVISION_ROLE_UNVERIFIED','修改角色缺少可核对的原生隔离回执',503);
  const calls=(await db.query<{state:string;data:Record<string,unknown>}>('SELECT state,data FROM inference_requests WHERE tenant_id=$1 AND run_id=$2 AND scope_type=\'REVISION\' AND scope_id=$3',
    [c.row.tenant_id,runId,c.row.id])).rows;
  requireThat(calls.length>0 && calls.every(i=>i.state==='SUCCEEDED'),'REVISION_INFERENCE_UNVERIFIED','修改缺少已结算的实际推理回执',503);
  if(role!=='POST'){
    const packet=revisionPacket(c);const input=run.private.review_input;
    requireThat(input?.packet_hash===packet.packet_hash && hash(input.images)===hash(packet.images)
      && calls.every(i=>i.data.review_packet_hash===packet.packet_hash && i.data.review_image_binding_hash===hash(input)
        && hash(i.data.review_image_hashes)===hash(packet.images.map(i=>i.sha256))),
      'REVISION_REVIEW_INPUT_INCOMPLETE','修改复核没有完整读取封存画面和文案',503);
  }
  if(persisted)requireThat(run.output_hash && hash(run.private.stage_result)===run.output_hash,'REVISION_ROLE_CHECKPOINT_CHANGED','修改角色的最终结果与检查点不一致',503);
  return run;
}
export async function validateRevisionReview(db:Db,cfg:Config,c:RevisionContext,runId:string,raw:unknown,persisted=false):Promise<SampleReview> {
  requireThat(valid(raw),'REVISION_REVIEW_INVALID','修改复核报告结构不完整',422);const report=raw;const packet=revisionPacket(c);const ids=revisionAssetIds(c);
  requireThat(report.packet_hash===packet.packet_hash && report.checked_asset_ids.length===ids.length && ids.every(id=>report.checked_asset_ids.includes(id))
    && report.issues.every(issue=>ids.includes(issue.asset_id)) && (report.verdict==='PASS'?report.issues.length===0:report.issues.length>0),
    'REVISION_REVIEW_INCOMPLETE','修改复核未覆盖完整清单、实际画面或问题定位',422);
  const run=await roleProof(db,cfg,c,runId,report.role,persisted);
  requireThat((await db.query(`SELECT id FROM agent_tool_intents WHERE tenant_id=$1 AND run_id=$2 AND tool_name='extract_review_evidence'
    AND state='SUCCEEDED' AND data->'result'->>'packet_hash'=$3`,[c.row.tenant_id,runId,packet.packet_hash])).rowCount!>0,
    'REVISION_REVIEW_EVIDENCE_MISSING','修改复核未读取实际封存材料',503);
  if(persisted){const saved=(c.row.private.review_reports as Record<string,SavedRevisionReview>|undefined)?.[report.role];
    requireThat(saved?.run_id===runId && saved.hash===hash(report) && hash(saved.report)===saved.hash && run.output_hash===saved.hash,
      'REVISION_REVIEW_NOT_PERSISTED','修改复核报告与最终角色结果不一致',503);}
  return report;
}
export async function validateRevisionCompletion(db:Db,cfg:Config,c:RevisionContext):Promise<void> {
  const reports=c.row.private.review_reports as Record<string,SavedRevisionReview>|undefined;
  requireThat(reports?.REVIEW_FACTS && reports.REVIEW_STYLE,'REVISION_REVIEW_NOT_PASSED','修改尚未完成独立双复核',409);
  const runs:RoleRun[]=[];
  for(const role of ['REVIEW_FACTS','REVIEW_STYLE'] as const){const saved=reports[role]!;const report=await validateRevisionReview(db,cfg,c,saved.run_id,saved.report,true);
    requireThat(report.verdict==='PASS','REVISION_REVIEW_NOT_PASSED','修改复核存在未解决问题',422);runs.push(await roleProof(db,cfg,c,saved.run_id,role,true));}
  const post=c.row.private.post_result as {run_id:string;result:RevisionMediaResult;hash:string}|undefined;
  requireThat(post && hash(post.result)===post.hash,'REVISION_POST_UNVERIFIED','修改缺少已完成制作检查点',503);
  await validateRevisionMedia(db,c,post.run_id,post.result);const postRun=await roleProof(db,cfg,c,post.run_id,'POST',true);
  requireThat(postRun.output_hash===post.hash,'REVISION_POST_UNVERIFIED','修改制作结果与原回执不一致',503);runs.push(postRun);
  const all=(await db.query<{id:string}>(`SELECT r.id FROM agent_runs r JOIN stage_runs s ON s.tenant_id=r.tenant_id AND s.id=r.private->>'stage_run_id'
    WHERE s.tenant_id=$1 AND s.scope_type='REVISION' AND s.scope_id=$2`,[c.row.tenant_id,c.row.id])).rows;
  const original=(await db.query<RoleRun>(`SELECT r.* FROM agent_runs r JOIN agent_instances i ON i.tenant_id=r.tenant_id AND i.id=r.instance_id
    WHERE i.tenant_id=$1 AND (i.order_id=$2 OR EXISTS(SELECT 1 FROM revision_requests prior WHERE prior.tenant_id=i.tenant_id
      AND prior.id=i.preview_session_id AND prior.order_id=$2 AND prior.id<>$3))`,[c.row.tenant_id,c.row.order_id,c.row.id])).rows;
  requireThat(all.length===3 && runs.every(r=>all.some(row=>row.id===r.id))
    && (['instance_id','thread_id','runtime_process_ref','role_identity_ref'] as const).every(field=>
      new Set(runs.map(r=>r[field])).size===3 && runs.every(r=>original.every(old=>old[field]!==r[field]))),
    'REVISION_REVIEW_IDENTITY_REUSED','修改必须使用与原制作及其他修改角色独立的新进程和上下文',503);
  const unresolved=await db.query(`SELECT id FROM inference_requests WHERE tenant_id=$1 AND run_id=ANY($2) AND state<>'SUCCEEDED'
    UNION ALL SELECT id FROM agent_tool_intents WHERE tenant_id=$1 AND run_id=ANY($2) AND state<>'SUCCEEDED'
    UNION ALL SELECT id FROM agent_instances WHERE tenant_id=$1 AND id=ANY($3) AND state<>'RELEASED'
    UNION ALL SELECT id FROM revision_cost_reservations WHERE tenant_id=$1 AND revision_id=$4 AND state IN ('RESERVED','UNKNOWN')`,
    [c.row.tenant_id,runs.map(r=>r.id),runs.map(r=>r.instance_id),c.row.id]);
  requireThat(unresolved.rowCount===0,'REVISION_SIDE_EFFECTS_UNRESOLVED','修改仍有未决调用、费用或未释放实例',503);
  requireThat((await db.query(`SELECT b.id FROM revision_budgets b JOIN orders o ON o.tenant_id=b.tenant_id AND o.id=b.order_id
    WHERE b.tenant_id=$1 AND b.order_id=$2 AND b.policy_hash=$3 AND b.ceiling_micro=$4
    AND b.spent_micro+b.reserved_micro+o.spent_micro+o.reserved_micro<=o.budget_micro`,
    [c.row.tenant_id,c.row.order_id,c.input.policy_hash,c.policy.budget_micro])).rowCount===1,
    'REVISION_BUDGET_CHANGED','制作与修改总费用超出原冻结订单预算',503);
}
