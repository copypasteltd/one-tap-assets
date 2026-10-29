import type {Db} from '../../api/db/pool.js';
import {requireThat} from '../../api/lib/errors.js';
import type {ExecutionContext} from '../compiler/order-context.js';
import {operationArtifacts} from '../media/artifacts.js';
import type {RepairGenerationNode} from './cost-authorization.js';

export function originalRepairContext(context:ExecutionContext):ExecutionContext{
  const {repair,...base}=context;
  return repair?{...base,contract:{...base.contract,creative:repair.original_plan}}:base;
}
export function generationSourceStage(context:ExecutionContext,stage:string,kind:'IMAGE'|'VIDEO',key:string):string{
  if(!context.repair)return stage;
  return context.repair.generation_nodes.some(n=>n.kind===kind&&n.operation_key===key)?stage:context.repair.source_production_stage_id;
}
/** Each output already seals its actual provider sources. Permissions are
 * derived from that provenance rather than invented by the planning role. */
export async function affectedGenerationNodes(db:Db,context:ExecutionContext,targets:string[]):Promise<RepairGenerationNode[]>{
  if(context.snapshot.engine==='PHOTO_LAYOUT')return [];
  const post=await operationArtifacts(db,context,'POST'),found=new Map<string,RepairGenerationNode>();
  for(const slot of targets){
    const artifact=post.receipt.artifacts.find(a=>a.slot_id===slot);
    requireThat(artifact,'REPAIR_SOURCE_INVALID','原失败素材缺少已封存来源',409);
    if(artifact.spec.kind==='copy')continue;
    requireThat(artifact.spec.generation_sources?.length,'REPAIR_SOURCE_INVALID','生成式失败素材缺少实际购买来源',409);
    for(const source of artifact.spec.generation_sources){
      const rows=(await db.query<{id:string;generation_kind:'IMAGE'|'VIDEO';operation_key:string}>(`SELECT p.id,p.generation_kind,p.operation_key
        FROM provider_submissions p JOIN stage_runs s ON s.tenant_id=p.tenant_id AND s.id=p.stage_run_id
        JOIN budget_reservations b ON b.tenant_id=p.tenant_id AND b.id=p.reservation_id AND b.submission_id=p.id
        WHERE p.tenant_id=$1 AND p.order_id=$2 AND p.id=$3 AND p.operation_key=$4 AND p.private->'output'->>'sha256'=$5
        AND p.state='SUCCEEDED' AND p.private->>'billing_valid'='true' AND p.private->>'provider_terminal'='true'
        AND b.purpose='FIRST_PASS' AND b.state='SETTLED' AND s.stage_name='PRODUCTION' AND s.attempt=1
        AND s.state='SUCCEEDED' AND s.scope_id=$2 AND s.input_hash=$6`,
        [context.tenantId,context.orderId,source.submission_id,source.operation_key,source.sha256,context.snapshotHash])).rows;
      requireThat(rows.length===1,'REPAIR_SOURCE_INVALID','原生成来源未完成或费用未核对',409);
      const row=rows[0]!;found.set(row.id,{kind:row.generation_kind,operation_key:row.operation_key,original_submission_id:row.id});
    }
  }
  return [...found.values()].sort((a,b)=>`${a.kind}:${a.operation_key}`.localeCompare(`${b.kind}:${b.operation_key}`));
}
