import type {Db} from '../../api/db/pool.js';
import type {Config} from '../../api/config.js';
import {AppError,requireThat} from '../../api/lib/errors.js';
import {hash,iso} from '../../api/lib/crypto.js';
import {executionContext} from '../compiler/order-context.js';
import {enqueueStage} from '../queue/enqueue.js';
import type {StageLease} from '../queue/leases.js';
import {currentReviewPacket} from '../review/context.js';
import {packetReports} from '../review/reports.js';
import {stopScope} from '../lifecycle/termination.js';
import {authorizeRepairCosts} from './cost-authorization.js';
import {repairTargets} from './targets.js';

/** Invoked after a review stage becomes SUCCEEDED, within that same database
 * transaction. No delivery worker can claim the old candidate between the
 * failed consensus and cancellation/creation of the repair chain. */
export class RepairCoordinator{
  constructor(private cfg:Config){}
  async afterStageCommit(db:Db,lease:StageLease):Promise<void>{
    if(lease.scope_type!=='ORDER'||lease.stage_name!=='REVIEW_STYLE')return;
    const context=await executionContext(db,lease.tenant_id,lease.scope_id,lease.input_hash,lease.id);
    const packet=await currentReviewPacket(db,context);
    const reports=await packetReports(db,this.cfg,context,packet);
    if(packet.state==='PASSED')return;
    requireThat(reports.length===2&&hash(reports)===hash(packet.reports),'REPAIR_REVIEW_INCOMPLETE','修复必须等待本候选的完整双独立复核',409);
    if(lease.attempt!==1||packet.state!=='FAILED'||reports.some(r=>!r.evidence_complete||r.verdict==='INSUFFICIENT_EVIDENCE')){
      await stopScope(db,{tenantId:lease.tenant_id,type:'ORDER',id:lease.scope_id},'REPAIR_REVIEW_BLOCKED');return;
    }
    // Native speech needs a newly sold additional-ASR allowance. Existing sold
    // contracts grant one ASR call; a repair must never silently expand it.
    // Generated routes remain blocked here until selective source reuse and
    // their fresh reference approvals have been admitted end to end.
    if(context.snapshot.engine!=='PHOTO_LAYOUT'){
      await stopScope(db,{tenantId:lease.tenant_id,type:'ORDER',id:lease.scope_id},'REPAIR_ROUTE_NOT_ADMITTED');return;
    }
    await db.query('SAVEPOINT prepare_candidate_repair');
    try{
      requireThat(lease.job_id,'REPAIR_JOB_INVALID','缺少原订单任务',409);
      const targets=await repairTargets(db,packet,reports);
      const active=await db.query(`SELECT id FROM stage_runs WHERE tenant_id=$1 AND job_id=$2 AND attempt=1
        AND state NOT IN ('SUCCEEDED','FAILED','CANCELLED') AND NOT(stage_name='DELIVER' AND state='READY')`,[lease.tenant_id,lease.job_id]);
      requireThat(active.rowCount===0,'REPAIR_ORIGINAL_STAGE_ACTIVE','原阶段尚未完成，不能启动修复',409);
      await db.query(`UPDATE stage_runs SET state='CANCELLED',fencing_token=fencing_token+1,updated_at=now(),
        data=data||jsonb_build_object('state','CANCELLED','reason_code','REPAIR_SUPERSEDED','updated_at',$3::text)
        WHERE tenant_id=$1 AND job_id=$2 AND attempt=1 AND stage_name='DELIVER' AND state='READY'`,[lease.tenant_id,lease.job_id,iso()]);
      const base={tenantId:lease.tenant_id,scopeType:'ORDER',scopeId:lease.scope_id,inputHash:lease.input_hash,
        deadlineAt:context.snapshot.deadline_at,jobId:lease.job_id,attempt:2};
      const preparation=await enqueueStage(db,{...base,name:'REPAIR_PLAN',private:{target_slot_ids:targets,
        source_packet_id:packet.packet_id,source_packet_hash:packet.packet_hash,source_reports_hash:hash(reports)}});
      let dependencies=[preparation];const stages:string[]=[];
      for(const name of ['PRODUCTION','POST','QC','REVIEW_FACTS','REVIEW_STYLE','DELIVER']){
        const next=await enqueueStage(db,{...base,name,dependencies});stages.push(next);dependencies=[next];
      }
      const authorization=await authorizeRepairCosts(db,this.cfg,{tenantId:lease.tenant_id,orderId:lease.scope_id,
        snapshotHash:lease.input_hash,sourcePacketId:packet.packet_id,stageIds:stages,generationNodes:[],preparationStageIds:[preparation]});
      await db.query(`UPDATE render_jobs SET state='QC',updated_at=now(),data=data||jsonb_build_object(
        'current_stage','REPAIR_PLAN','total_stage_count',(SELECT count(*)::int FROM stage_runs WHERE job_id=$2 AND state<>'CANCELLED'),
        'updated_at',$3::text),private=private||jsonb_build_object('repair_authorization_id',$4::text)
        WHERE tenant_id=$1 AND id=$2`,[lease.tenant_id,lease.job_id,iso(),authorization]);
      await db.query('RELEASE SAVEPOINT prepare_candidate_repair');
    }catch(error){
      await db.query('ROLLBACK TO SAVEPOINT prepare_candidate_repair');
      await db.query('RELEASE SAVEPOINT prepare_candidate_repair');
      if(!(error instanceof AppError))throw error;
      await stopScope(db,{tenantId:lease.tenant_id,type:'ORDER',id:lease.scope_id},error.code);
    }
  }
}
