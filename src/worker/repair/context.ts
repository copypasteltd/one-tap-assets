import type {Db} from '../../api/db/pool.js';
import {hash} from '../../api/lib/crypto.js';
import {requireThat} from '../../api/lib/errors.js';
import type {ExecutionContext} from '../compiler/order-context.js';
import {validateCreativePlan,type CreativePlan} from '../compiler/plan.js';
import type {RepairGenerationNode} from './cost-authorization.js';
import type {DTO} from '../../shared/contracts/types.js';
import {repairTargets} from './targets.js';

export interface RepairContext {
  authorization_id:string; source_packet_id:string; source_packet_hash:string;
  source_production_stage_id:string; planning_stage_id:string; stage_ids:string[];
  generation_nodes:RepairGenerationNode[]; target_slot_ids:string[];
  original_plan:CreativePlan; plan_hash:string|null;
}
export function checkedRepairPlan(context:ExecutionContext,raw:unknown):CreativePlan {
  const plan=raw as CreativePlan,original=context.repair?.original_plan;
  requireThat(original&&context.repair,'REPAIR_PLAN_NOT_AUTHORIZED','当前运行没有修复计划权限',409);
  validateCreativePlan(plan,context.contract.profile,context.contract.source);
  requireThat(hash(plan)!==hash(original),'REPAIR_PLAN_UNCHANGED','修复必须形成实际修改的候选计划',422);
  const fixed=(p:CreativePlan)=>({identity_lock_id:p.identity_lock_id,profile_hash:p.profile_hash,variant_id:p.variant_id,
    fps:p.fps,target_frames:p.target_frames,native_voice_id:p.native_voice_id,character_version_id:p.character_version_id,
    shots:p.shots.map(s=>({shot_id:s.shot_id,start_frame:s.start_frame,end_frame:s.end_frame,overlap_frames:s.overlap_frames,spoken_text:s.spoken_text})),
    image_slots:p.image_slots.map(s=>s.slot_id)});
  requireThat(hash(fixed(plan))===hash(fixed(original)),'REPAIR_CONTRACT_CHANGED','修复不能更换商品、规格、人物声音、原台词或时序',422);
  const targets=new Set(context.repair.target_slot_ids),all=context.snapshot.outputs.every(s=>targets.has(s.slot_id));
  requireThat((plan.title===original.title&&plan.copy===original.copy&&plan.scene===original.scene
      &&hash(plan.claim_evidence_ids)===hash(original.claim_evidence_ids)||all)
    &&plan.image_slots.every((s,i)=>hash(s)===hash(original.image_slots[i])||targets.has(s.slot_id))
    &&(hash(plan.shots)===hash(original.shots)||context.snapshot.outputs.filter(s=>s.kind==='video').every(s=>targets.has(s.slot_id))),
  'REPAIR_PLAN_OUTSIDE_FINDINGS','修复只能修改已定位的问题素材及其共享内容',422);
  return structuredClone(plan);
}

/** A stage ID is a platform binding, never a caller-selected replacement of
 * the sold snapshot. Calls without a stage continue reading the original. */
export async function repairExecutionContext(db:Db,base:ExecutionContext,stageId:string):Promise<ExecutionContext>{
  const stage=(await db.query<{attempt:number;stage_name:string;job_id:string}>(`SELECT attempt,stage_name,job_id FROM stage_runs
    WHERE tenant_id=$1 AND id=$2 AND scope_type='ORDER' AND scope_id=$3 AND input_hash=$4`,
  [base.tenantId,stageId,base.orderId,base.snapshotHash])).rows[0];
  requireThat(stage,'REPAIR_STAGE_BINDING_INVALID','执行阶段不属于原订单快照',409);
  if(stage.attempt===1)return base;
  requireThat(stage.attempt===2,'REPAIR_ROUND_EXHAUSTED','只允许原订单的一轮修复',409);
  const grant=(await db.query<{id:string;source_packet_id:string;source_packet_hash:string;stage_ids:string[];
    preparation_stage_ids:string[];generation_nodes:RepairGenerationNode[]}>(`SELECT a.* FROM repair_cost_authorizations a
    JOIN render_jobs j ON j.tenant_id=a.tenant_id AND j.id=a.job_id AND j.repair_rounds=1
    WHERE a.tenant_id=$1 AND a.order_id=$2 AND a.job_id=$3 AND a.snapshot_hash=$4
      AND $5=ANY(a.stage_ids||a.preparation_stage_ids) AND a.deadline_at=$6::timestamptz`,
  [base.tenantId,base.orderId,stage.job_id,base.snapshotHash,stageId,base.snapshot.deadline_at])).rows[0];
  requireThat(grant&&grant.preparation_stage_ids.length===1,'REPAIR_PLAN_NOT_AUTHORIZED','缺少原订单修复准备阶段的唯一授权',409);
  const planning=(await db.query<{state:string;private:{target_slot_ids?:string[];role_run_id?:string;result_hash?:string;candidate_plan?:CreativePlan;
    source_packet_id?:string;source_packet_hash?:string;source_reports_hash?:string}}>(
    `SELECT state,private FROM stage_runs WHERE tenant_id=$1 AND id=$2 AND job_id=$3 AND scope_id=$4
      AND stage_name='REPAIR_PLAN' AND attempt=2 AND input_hash=$5 AND deadline_at=$6::timestamptz`,
  [base.tenantId,grant.preparation_stage_ids[0],stage.job_id,base.orderId,base.snapshotHash,base.snapshot.deadline_at])).rows[0];
  requireThat(planning&&Array.isArray(planning.private.target_slot_ids)&&planning.private.target_slot_ids.length>0
    &&new Set(planning.private.target_slot_ids).size===planning.private.target_slot_ids.length
    &&planning.private.target_slot_ids.every(id=>base.snapshot.outputs.some(o=>o.slot_id===id)),
  'REPAIR_TARGETS_INVALID','修复需要原失败证据定位的素材清单',409);
  const source=(await db.query<{data:DTO<'ReviewPacket'>}>(`SELECT data FROM review_packets WHERE tenant_id=$1 AND id=$2
    AND order_id=$3 AND snapshot_hash=$4 AND state='FAILED'`,[base.tenantId,grant.source_packet_id,base.orderId,base.snapshotHash])).rows[0]?.data;
  requireThat(source&&source.packet_hash===grant.source_packet_hash&&source.publication_decision==='BLOCK'&&source.reports.length===2
    &&planning.private.source_packet_id===source.packet_id&&planning.private.source_packet_hash===source.packet_hash
    &&planning.private.source_reports_hash===hash(source.reports)
    &&hash(await repairTargets(db,source,source.reports))===hash([...planning.private.target_slot_ids].sort()),
    'REPAIR_SOURCE_CHANGED','原失败证据或问题素材定位已变化',409);
  const repair:RepairContext={authorization_id:grant.id,source_packet_id:grant.source_packet_id,source_packet_hash:grant.source_packet_hash,
    source_production_stage_id:'',planning_stage_id:grant.preparation_stage_ids[0]!,stage_ids:grant.stage_ids,
    generation_nodes:grant.generation_nodes,target_slot_ids:planning.private.target_slot_ids,original_plan:base.contract.creative,plan_hash:null};
  const original=(await db.query<{id:string}>(`SELECT id FROM stage_runs WHERE tenant_id=$1 AND job_id=$2
    AND scope_id=$3 AND scope_type='ORDER' AND stage_name='PRODUCTION' AND attempt=1 AND state='SUCCEEDED' AND input_hash=$4`,
  [base.tenantId,stage.job_id,base.orderId,base.snapshotHash])).rows;
  requireThat(original.length===1,'REPAIR_SOURCE_INVALID','修复缺少唯一原制作阶段',409);
  repair.source_production_stage_id=original[0]!.id;
  const context={...base,repair};
  if(stage.stage_name==='REPAIR_PLAN')return context;
  const plan=checkedRepairPlan(context,planning.private.candidate_plan);
  const run=(await db.query<{output_hash:string;private:{stage_result:unknown}}>(`SELECT output_hash,private FROM agent_runs
    WHERE tenant_id=$1 AND id=$2 AND role='CONTENT' AND state='SUCCEEDED' AND private->>'stage_run_id'=$3`,
  [base.tenantId,planning.private.role_run_id,repair.planning_stage_id])).rows[0];
  requireThat(planning.state==='SUCCEEDED'&&run&&run.output_hash===hash(plan)&&hash(run.private.stage_result)===hash(plan)
    &&planning.private.result_hash===hash(plan),'REPAIR_PLAN_NOT_READY','修复计划尚未形成已提交的原角色检查点',409);
  repair.plan_hash=hash(plan);
  return {...context,contract:{...base.contract,creative:plan}};
}

