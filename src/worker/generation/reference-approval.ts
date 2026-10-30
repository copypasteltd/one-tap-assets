import type {Db} from '../../api/db/pool.js';
import type {Config} from '../../api/config.js';
import type {ObjectStorage} from '../../api/storage/storage.js';
import {hash} from '../../api/lib/crypto.js';
import {requireThat} from '../../api/lib/errors.js';
import {generationScope,generationCostConfirmed,generationSource,orderGenerationContext,type GenerationContext} from './scope.js';
import {referenceMaterial} from './reference-material.js';
import {validateReferenceReport,type ReferenceReport} from './reference-report.js';

export interface ReferenceApproval {
  run_id:string;packet_hash:string;report_hash:string;
  frames:{asset_id:string;sha256:string;operation_key:string}[];
}
/** No caller-supplied approval and no model purchase here. Rebuild the actual
 * material and independently validate the original completed/released role. */
export async function readReferenceApproval(db:Db,cfg:Config,store:ObjectStorage,context:GenerationContext,stageId:string){
  const runs=(await db.query<{id:string;state:string;private:{stage_result?:ReferenceReport}}>(
    `SELECT id,state,private FROM agent_runs WHERE tenant_id=$1 AND private->>'stage_run_id'=$2
      AND private->'review_input'->>'purpose'='REFERENCE_IDENTITY' ORDER BY created_at`,[context.tenantId,stageId])).rows;
  requireThat(runs.length===1&&runs[0]!.state==='SUCCEEDED','GENERATION_REFERENCE_REVIEW_REQUIRED',
    '视频购买需要原阶段完整且已完成的参考帧身份核验',409);
  const material=await referenceMaterial(db,store,context,stageId),run=runs[0]!;
  const report=await validateReferenceReport(db,cfg,context,material,run.id,run.private.stage_result);
  requireThat(report.verdict==='PASS'&&report.evidence_complete,'REFERENCE_IDENTITY_REJECTED','参考帧未全部通过身份核验，不得购买视频',422);
  const approval:ReferenceApproval={run_id:run.id,packet_hash:report.packet_hash,report_hash:hash(report),
    frames:material.packet.frames.map(({asset_id,sha256,operation_key})=>({asset_id,sha256,operation_key}))};
  return {approval,material};
}
