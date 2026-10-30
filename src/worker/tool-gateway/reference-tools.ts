import type pg from 'pg';
import type {Config} from '../../api/config.js';
import type {ObjectStorage} from '../../api/storage/storage.js';
import {hash} from '../../api/lib/crypto.js';
import {requireThat} from '../../api/lib/errors.js';
import {executionContext} from '../compiler/order-context.js';
import {referenceMaterial} from '../generation/reference-material.js';
import {referenceReviewIdentity,validateReferenceReport} from '../generation/reference-report.js';
import type {ToolHandler} from './consumer.js';
import type {ToolScope} from './http.js';
import type {Db} from '../../api/db/pool.js';
import type {GenerationContext} from '../generation/scope.js';

export function referenceTools(pool:pg.Pool,cfg:Config,store:ObjectStorage,resolver?:(db:Db,scope:ToolScope)=>Promise<GenerationContext>):Record<string,ToolHandler>{
  const resolve=async(db:Db,scope:ToolScope)=>resolver?resolver(db,scope):executionContext(db,scope.tenant_id,scope.order_id!,scope.snapshot_hash,scope.stage_run_id);
  const load=async(scope:ToolScope)=>{
    requireThat(scope.role==='REVIEW_FACTS'&&(resolver?scope.scope_type==='SAMPLE'&&scope.stage_name==='SAMPLE_PRODUCTION':scope.scope_type==='ORDER'&&scope.stage_name==='PRODUCTION'&&scope.order_id),
      'REFERENCE_SCOPE_INVALID','参考工具仅供制作阶段的独立事实核验',403);
    const context=await resolve(pool,scope);
    const material=await referenceMaterial(pool,store,context,scope.stage_run_id);
    requireThat(material.packet.packet_hash===scope.packet_hash,'REFERENCE_PACKET_CHANGED','原参考帧材料已经变化',409);
    return {context,material};
  };
  return {
    extract_review_evidence:async(scope,args)=>{
      const {context,material}=await load(scope);
      requireThat(args.packet_hash===material.packet.packet_hash,'REFERENCE_PACKET_CHANGED','核验请求不属于原参考帧',409);
      const {template}=await referenceReviewIdentity(pool,cfg,context,material,scope.run_id);
      return {result:{packet_hash:material.packet.packet_hash,policy_version:material.packet.policy_version,report_template:template,
        checked_asset_ids:material.images.map(i=>i.asset_id),required_frames:material.packet.frames,
        required_anchors:material.packet.anchors,source_evidence:context.contract.profile.evidence,
        task:'填写每帧与每个锚点的观察、结论和原图依据。模糊、遮挡或证据不足只能UNCERTAIN；本工具不代替视觉判断。'}};
    },
    persist_stage_result:async(scope,args)=>{
      const {context,material}=await load(scope);
      const report=await validateReferenceReport(pool,cfg,context,material,scope.run_id,args.result,true),digest=hash(report);
      return {result:{persisted:true,result_hash:digest},commit:async db=>{
        const current=await resolve(db,scope);
        const latest=await referenceMaterial(db,store,current,scope.stage_run_id);
        requireThat(latest.packet.packet_hash===material.packet.packet_hash,'REFERENCE_PACKET_CHANGED','提交时原帧已经变化',409);
        await validateReferenceReport(db,cfg,current,latest,scope.run_id,report,true);
        requireThat((await db.query(`UPDATE agent_runs SET output_hash=$3,checkpoint_hash=$3,
          private=private||jsonb_build_object('stage_result',$4::jsonb),updated_at=now()
          WHERE tenant_id=$1 AND id=$2 AND state='RUNNING' AND (output_hash IS NULL OR output_hash=$3)`,
        [scope.tenant_id,scope.run_id,digest,JSON.stringify(report)])).rowCount===1,
        'REFERENCE_RESULT_CHANGED','参考角色已结束或原结论不能改写',409);
      }};
    },
  };
}
