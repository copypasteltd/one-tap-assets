import type {Db} from '../../api/db/pool.js';
import type {DTO} from '../../shared/contracts/types.js';
import {requireThat} from '../../api/lib/errors.js';

/** Resolve each defect to sealed output evidence. A missing location must not
 * become permission to alter the whole order. Shared contract/copy or original
 * photo findings explicitly affect all outputs that use those shared inputs. */
export async function repairTargets(db:Db,packet:DTO<'ReviewPacket'>,reports:DTO<'ReviewReport'>[]):Promise<string[]>{
  const evidence=(await db.query<{id:string;artifact_id:string|null;kind:string}>(
    'SELECT id,artifact_id,kind FROM review_evidence WHERE tenant_id=$1 AND packet_id=$2',
    [packet.tenant_id,packet.packet_id])).rows;
  const targets=new Set<string>();
  const findings=reports.flatMap(r=>r.findings);
  requireThat(findings.length>0,'REPAIR_FINDINGS_MISSING','失败报告未定位可修改的问题',409);
  for(const finding of findings){
    const local=new Set<string>();
    for(const ref of finding.evidence_ids){
      const item=evidence.find(e=>e.id===ref),output=packet.outputs.find(o=>o.asset_id===(item?.artifact_id??ref));
      if(output)local.add(output.slot_id);
      if(packet.original_assets.some(o=>o.asset_id===ref)||item?.kind==='CONTRACT'||item?.kind==='COPY')
        packet.required_slot_ids.forEach(id=>local.add(id));
    }
    requireThat(local.size>0,'REPAIR_FINDING_NOT_LOCATED','修复问题需要本封存包的明确素材证据',409);
    local.forEach(id=>targets.add(id));
  }
  return [...targets].sort();
}
