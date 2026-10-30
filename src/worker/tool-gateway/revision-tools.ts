import Ajv2020 from 'ajv/dist/2020.js';
import type pg from 'pg';
import type {Config} from '../../api/config.js';
import type {ObjectStorage} from '../../api/storage/storage.js';
import {hash} from '../../api/lib/crypto.js';
import {requireThat} from '../../api/lib/errors.js';
import {revisionContext} from '../revisions/context.js';
import {makeCandidate,candidate,inspectCandidate,revisionPacket,revisionImages,revisionMediaSchema,validateRevisionMedia,type RevisionMediaResult} from '../revisions/media.js';
import {validateRevisionReview,revisionAssetIds} from '../revisions/review.js';
import type {ToolHandler} from './consumer.js';
import type {Db} from '../../api/db/pool.js';
import type {ToolScope} from './http.js';
const valid=new Ajv2020({strict:false}).compile<RevisionMediaResult>(revisionMediaSchema);
async function persist(db:Db,scope:ToolScope,result:unknown):Promise<void>{
  const saved=await db.query(`UPDATE agent_runs SET output_hash=$3,private=private||jsonb_build_object('stage_result',$4::jsonb),updated_at=now()
    WHERE tenant_id=$1 AND id=$2 AND state='RUNNING' AND (output_hash IS NULL OR output_hash=$3)`,[scope.tenant_id,scope.run_id,hash(result),JSON.stringify(result)]);
  requireThat(saved.rowCount===1,'TOOL_SCOPE_ENDED','修改角色已结束或结果已冻结',409);
}
export function revisionTools(pool:pg.Pool,cfg:Config,store:ObjectStorage):Record<string,ToolHandler>{return {
  execute_post_plan:async(scope,args,intent)=>{
    requireThat(scope.role==='POST' && args.snapshot_hash===scope.snapshot_hash,'REVISION_TOOL_INVALID','修改制作工具绑定不一致',403);
    const made=await makeCandidate(pool,store,scope,intent);
    return {result:{stage_result:{revision_id:scope.scope_id,input_hash:scope.snapshot_hash,candidate_hash:made.candidate_hash,
      artifact_ids:made.items.map(i=>i.deliverable_id),tool_receipt_ids:[intent.id]} satisfies RevisionMediaResult}};
  },
  inspect_actual_media:async(scope,args,intent,signal)=>{
    const c=await revisionContext(pool,scope.tenant_id,scope.scope_id,scope.snapshot_hash);const made=candidate(c);
    requireThat(hash(args.asset_ids)===hash(made.items.map(i=>i.deliverable_id)),'REVISION_MEDIA_RESULT_INVALID','修改检测必须覆盖全部清单',422);
    await inspectCandidate(pool,cfg,store,c,signal);return {result:{tool_receipt_id:intent.id,candidate_hash:made.candidate_hash,checked_asset_ids:args.asset_ids}};
  },
  extract_review_evidence:async(scope,args)=>{
    const c=await revisionContext(pool,scope.tenant_id,scope.scope_id,scope.snapshot_hash);const packet=revisionPacket(c);
    requireThat(scope.packet_hash===packet.packet_hash && args.packet_hash===packet.packet_hash,'REVISION_PACKET_CHANGED','修改复核材料已变化',409);
    await revisionImages(pool,cfg,store,c);return {result:{packet_hash:packet.packet_hash,packet,original_request:c.input.request,
      original_copy:c.parent.items.filter(i=>i.kind==='copy'),
      ...(packet.native_audio?{retained_native_audio:packet.native_audio,retained_native_audio_hash:hash(packet.native_audio)}:{}),
      report_requirements:{packet_hash:packet.packet_hash,role:scope.role,checked_asset_ids:revisionAssetIds(c)}}};
  },
  persist_stage_result:async(scope,args)=>{
    const c=await revisionContext(pool,scope.tenant_id,scope.scope_id,scope.snapshot_hash);
    if(scope.role==='POST'){
      requireThat(valid(args.result),'REVISION_MEDIA_RESULT_INVALID','修改制作结果结构不完整',422);const result=args.result;
      await validateRevisionMedia(pool,c,scope.run_id,result);
      return {result:{result_hash:hash(result)},commit:async db=>{const current=await revisionContext(db,scope.tenant_id,scope.scope_id,scope.snapshot_hash,true);
        await validateRevisionMedia(db,current,scope.run_id,result);
        await db.query(`UPDATE revision_requests SET private=private||jsonb_build_object('post_result',$3::jsonb) WHERE tenant_id=$1 AND id=$2`,
          [scope.tenant_id,c.row.id,JSON.stringify({run_id:scope.run_id,result,hash:hash(result)})]);
        await persist(db,scope,result);}};
    }
    const report=await validateRevisionReview(pool,cfg,c,scope.run_id,args.result);
    requireThat(report.role===scope.role,'REVISION_REVIEW_INVALID','复核角色与报告不一致',403);
    return {result:{result_hash:hash(report)},commit:async db=>{const current=await revisionContext(db,scope.tenant_id,scope.scope_id,scope.snapshot_hash,true);
      await validateRevisionReview(db,cfg,current,scope.run_id,report);
      await db.query(`UPDATE revision_requests SET private=jsonb_set(private,'{review_reports}',COALESCE(private->'review_reports','{}'::jsonb)||jsonb_build_object($3::text,$4::jsonb)) WHERE tenant_id=$1 AND id=$2`,
        [scope.tenant_id,c.row.id,scope.role,JSON.stringify({run_id:scope.run_id,report,hash:hash(report)})]);
      await persist(db,scope,report);}};
  },
};}
