import Ajv2020 from 'ajv/dist/2020.js';
import type {Config} from '../../api/config.js';
import type {Db} from '../../api/db/pool.js';
import {hash} from '../../api/lib/crypto.js';
import {requireThat} from '../../api/lib/errors.js';
import type {ExecutionContext} from '../compiler/order-context.js';
import {admissionHash,checkAdmission,type CodexAdmission} from '../codex/admission.js';
import type {ReviewInput} from '../codex/review-images.js';
import {REFERENCE_IDENTITY_POLICY,referenceRoleInput,type ReferenceMaterial} from './reference-material.js';

type Verdict='PASS'|'FAIL'|'UNCERTAIN';
export interface ReferenceReport {
  version:'1.0.0';purpose:'REFERENCE_IDENTITY';policy_version:typeof REFERENCE_IDENTITY_POLICY;report_id:string;
  tenant_id:string;order_id:string;snapshot_hash:string;packet_hash:string;identity_lock_hash:string;
  run_id:string;thread_id:string;runtime_process_ref:string;isolation_evidence_id:string;
  verdict:Verdict;evidence_complete:boolean;checked_asset_ids:string[];
  frames:{asset_id:string;sha256:string;verdict:Verdict;anchors:{anchor_id:string;verdict:Verdict;source_asset_ids:string[];detail:string}[]}[];
  findings:{asset_id:string;code:'IDENTITY_MISMATCH'|'UNREADABLE'|'UNSUPPORTED_DETAIL';detail:string}[];
}
const ref={type:'string',pattern:'^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$'},digest={type:'string',pattern:'^[a-f0-9]{64}$'};
const text={type:'string',minLength:1,maxLength:2000},verdict={enum:['PASS','FAIL','UNCERTAIN']};
const list=(items:unknown,min=0,max=200)=>({type:'array',items,minItems:min,maxItems:max});
const exact=(properties:Record<string,unknown>)=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
export const referenceReportSchema=exact({version:{const:'1.0.0'},purpose:{const:'REFERENCE_IDENTITY'},policy_version:{const:REFERENCE_IDENTITY_POLICY},report_id:ref,
  tenant_id:ref,order_id:ref,snapshot_hash:digest,packet_hash:digest,identity_lock_hash:digest,run_id:ref,thread_id:ref,
  runtime_process_ref:text,isolation_evidence_id:ref,verdict,evidence_complete:{type:'boolean'},checked_asset_ids:{...list(ref,1),uniqueItems:true},
  frames:list(exact({asset_id:ref,sha256:digest,verdict,anchors:list(exact({anchor_id:ref,verdict,source_asset_ids:{...list(ref,1,5),uniqueItems:true},detail:text}),1,500)}),1,100),
  findings:list(exact({asset_id:ref,code:{enum:['IDENTITY_MISMATCH','UNREADABLE','UNSUPPORTED_DETAIL']},detail:text}))});
const schema=new Ajv2020({strict:false,allErrors:true}).compile<ReferenceReport>(referenceReportSchema);
interface ReferenceRun {
  id:string;instance_id:string;instance_state:string;thread_id:string;state:string;input_hash:string;output_hash:string|null;
  data:{runtime_process_ref:string;role_identity_ref:string;skill_bundle_hash:string;loaded_skill_hashes:string[]};
  private:{stage_run_id:string;runtime_admission:CodexAdmission;inference_limits:unknown;review_input:ReviewInput;input_payload_hash:string;stage_result?:ReferenceReport};
}
export async function referenceReviewIdentity(db:Db,cfg:Config,context:ExecutionContext,material:ReferenceMaterial,runId:string){
  const packet=material.packet;
  const run=(await db.query<ReferenceRun>(`SELECT r.*,i.state AS instance_state FROM agent_runs r
    JOIN agent_instances i ON i.tenant_id=r.tenant_id AND i.id=r.instance_id
    JOIN stage_runs s ON s.tenant_id=r.tenant_id AND s.id=r.private->>'stage_run_id'
    WHERE r.tenant_id=$1 AND r.id=$2 AND i.order_id=$3 AND r.role='REVIEW_FACTS'
    AND s.id=$4 AND s.scope_type='ORDER' AND s.scope_id=$3 AND s.stage_name='PRODUCTION' AND s.input_hash=$5`,
  [context.tenantId,runId,context.orderId,packet.stage_run_id,context.snapshotHash])).rows[0];
  requireThat(run&&['RUNNING','SUCCEEDED'].includes(run.state)&&run.thread_id&&run.data.runtime_process_ref
    &&run.input_hash===context.snapshotHash&&run.data.skill_bundle_hash===packet.skill_bundle_hash
    &&run.private.input_payload_hash===hash(referenceRoleInput(packet)),
  'REFERENCE_REVIEW_RUN_INVALID','参考帧核验缺少原订单全新运行或冻结输入',409);
  const admission=checkAdmission(cfg,run.private.runtime_admission),binding=context.contract.runtime_binding;
  requireThat(binding&&admission.review_vision&&hash(admission)===hash(binding.admission)
    &&hash(run.private.inference_limits)===hash(binding.limits),'REFERENCE_REVIEW_RUNTIME_CHANGED','参考核验的模型或计费合同不一致',503);
  const input=run.private.review_input;
  requireThat(input?.purpose==='REFERENCE_IDENTITY'&&input.packet_hash===packet.packet_hash
    &&hash(input.images)===hash(material.images.map(({bytes:_,...image})=>image)),
  'REFERENCE_REVIEW_INPUT_INCOMPLETE','参考核验未绑定全部原图和生成帧',503);
  const isolation=(await db.query<{id:string;admission_hash:string;data:{mode:string;packet_hash:string;runtime_process_ref:string;role_identity_ref:string;
    stage_run_id:string;launcher_sha256:string;isolation:string;virtualization:string;process_tree_bound:boolean}}>(
    'SELECT id,admission_hash,data FROM agent_isolation_evidence WHERE tenant_id=$1 AND run_id=$2 AND instance_id=$3',
    [context.tenantId,runId,run.instance_id])).rows[0];
  requireThat(isolation&&isolation.admission_hash===admissionHash(admission)&&isolation.data.packet_hash===packet.packet_hash
    &&isolation.data.runtime_process_ref===run.data.runtime_process_ref&&isolation.data.role_identity_ref===run.data.role_identity_ref
    &&isolation.data.stage_run_id===packet.stage_run_id&&isolation.data.launcher_sha256===admission.launcher_sha256
    &&isolation.data.isolation==='NATIVE_RESTRICTED_IDENTITY'&&isolation.data.virtualization==='FORBIDDEN'&&isolation.data.process_tree_bound
    &&(isolation.data.mode==='ADMITTED_NATIVE'||cfg.env==='test'&&isolation.data.mode==='SYNTHETIC_PROTOCOL'),
  'REFERENCE_REVIEW_ISOLATION_UNVERIFIED','参考核验没有对应的原生隔离证据',503);
  const skills=(await db.query<{bundle_hash:string;data:{loaded_skills:{sha256:string}[]}}>(
    'SELECT bundle_hash,data FROM skill_load_evidence WHERE tenant_id=$1 AND run_id=$2',[context.tenantId,runId])).rows;
  requireThat(skills.length===1&&skills[0]!.bundle_hash===packet.skill_bundle_hash&&run.data.loaded_skill_hashes.length>0
    &&hash(skills[0]!.data.loaded_skills.map(s=>s.sha256))===hash(run.data.loaded_skill_hashes),
  'REFERENCE_REVIEW_SKILLS_UNVERIFIED','参考核验没有固定风格和事实Skill实际加载证据',503);
  return {run,template:{version:'1.0.0' as const,purpose:'REFERENCE_IDENTITY' as const,policy_version:REFERENCE_IDENTITY_POLICY,
    report_id:`reference_report_${hash({runId,packet:packet.packet_hash}).slice(0,40)}`,tenant_id:context.tenantId,order_id:context.orderId,
    snapshot_hash:context.snapshotHash,packet_hash:packet.packet_hash,identity_lock_hash:packet.identity_lock_hash,
    run_id:runId,thread_id:run.thread_id,runtime_process_ref:run.data.runtime_process_ref,isolation_evidence_id:isolation.id}};
}
export async function validateReferenceReport(db:Db,cfg:Config,context:ExecutionContext,material:ReferenceMaterial,runId:string,raw:unknown,allowRunning=false):Promise<ReferenceReport>{
  requireThat(schema(raw),'REFERENCE_REPORT_INVALID','参考核验报告结构不符合完整规格',422);const report=raw as ReferenceReport;
  const {run,template}=await referenceReviewIdentity(db,cfg,context,material,runId),packet=material.packet;
  requireThat(Object.entries(template).every(([key,value])=>report[key as keyof ReferenceReport]===value)
    &&(run.state==='SUCCEEDED'||allowRunning&&run.state==='RUNNING'),
  'REFERENCE_REPORT_BINDING_INVALID','参考报告的运行身份或冻结摘要不一致',422);
  const ids=material.images.map(i=>i.asset_id);
  requireThat(hash([...report.checked_asset_ids].sort())===hash([...ids].sort())&&report.frames.length===packet.frames.length
    &&new Set(report.frames.map(f=>f.asset_id)).size===packet.frames.length,'REFERENCE_REPORT_INCOMPLETE','参考报告遗漏原图、帧或完整锚点',422);
  let allPassed=true;
  for(const frame of packet.frames){
    const checked=report.frames.find(f=>f.asset_id===frame.asset_id);
    requireThat(checked&&checked.sha256===frame.sha256&&checked.anchors.length===packet.anchors.length
      &&new Set(checked.anchors.map(a=>a.anchor_id)).size===packet.anchors.length,'REFERENCE_REPORT_INCOMPLETE','参考帧摘要或锚点集合不完整',422);
    for(const anchor of packet.anchors){
      const check=checked.anchors.find(a=>a.anchor_id===anchor.anchor_id);
      const sources=context.contract.profile.evidence.filter(e=>anchor.evidence_ids.includes(e.evidence_id)).map(e=>e.asset_id);
      requireThat(check&&check.source_asset_ids.every(id=>packet.originals.some(p=>p.asset_id===id))&&check.source_asset_ids.some(id=>sources.includes(id)),
        'REFERENCE_REPORT_EVIDENCE_INVALID','参考锚点缺少本商品原图依据',422);
      allPassed=allPassed&&check.verdict==='PASS';
    }
    allPassed=allPassed&&checked.verdict==='PASS';
  }
  requireThat(report.findings.every(f=>packet.frames.some(frame=>frame.asset_id===f.asset_id))
    &&(report.verdict!=='PASS'||report.evidence_complete&&allPassed&&report.findings.length===0),
  'REFERENCE_REPORT_CONTRADICTORY','报告不能在锚点不符、未知或证据不足时标记通过',422);
  requireThat((await db.query(`SELECT id FROM agent_tool_intents WHERE tenant_id=$1 AND run_id=$2 AND tool_name='extract_review_evidence'
    AND state='SUCCEEDED' AND data->'result'->>'packet_hash'=$3 AND data->'result'->>'policy_version'=$4`,
  [context.tenantId,runId,packet.packet_hash,REFERENCE_IDENTITY_POLICY])).rowCount!>0,
  'REFERENCE_TOOL_PROOF_MISSING','参考核验没有读取原始受控材料',422);
  const requests=(await db.query<{state:string;data:{review_packet_hash:string;review_image_binding_hash:string;review_image_hashes:string[]}}>(
    'SELECT state,data FROM inference_requests WHERE tenant_id=$1 AND run_id=$2',[context.tenantId,runId])).rows;
  requireThat(requests.length>0&&requests.every(q=>q.state==='SUCCEEDED'&&q.data.review_packet_hash===packet.packet_hash
    &&q.data.review_image_binding_hash===hash(run.private.review_input)&&hash(q.data.review_image_hashes)===hash(material.images.map(i=>i.sha256))),
  'REFERENCE_VISUAL_INFERENCE_UNVERIFIED','参考报告没有全部实际图片的已结算推理证据',503);
  if(!allowRunning)requireThat(run.instance_state==='RELEASED'&&run.output_hash===hash(report)&&run.private.stage_result!==undefined&&hash(run.private.stage_result)===hash(report),
    'REFERENCE_RESULT_NOT_PERSISTED','参考角色未完整持久结果或实例尚未完成释放',503);
  return report;
}
