import type pg from 'pg';
import type {Config} from '../../api/config.js';
import type {ObjectStorage} from '../../api/storage/storage.js';
import {transaction} from '../../api/db/pool.js';
import {requireThat,notFound} from '../../api/lib/errors.js';
import {executionContext} from '../compiler/order-context.js';
import type {StageLease} from '../queue/leases.js';
import {GenerationGateway,type GenerationResult} from '../generation/gateway.js';
import {referenceRequest,videoRequest} from '../generation/requests.js';
import {readReferenceApproval} from '../generation/reference-approval.js';
import {toolScopeById,type ToolScope} from './http.js';
import type {ToolHandler} from './consumer.js';

const safeResult=(r:GenerationResult)=>({submission_id:r.submission_id,state:r.state,
  ...(r.output?{output:{asset_id:r.submission_id,sha256:r.output.sha256,actual:r.output.inspection}}:{})});
/** Platform-derived inputs only: the model cannot submit prompts, URLs, keys,
 * prices, arbitrary reference IDs or another order's lease through these tools. */
export function generationTools(pool:pg.Pool,cfg:Config,store:ObjectStorage,injected?:GenerationGateway):Record<string,ToolHandler>{
  requireThat(!injected||cfg.env==='test','TEST_PORT_FORBIDDEN','生成工具替身只能用于显式测试环境',500);
  const gateway=injected??new GenerationGateway(pool,cfg,store);
  const bound=async(scope:ToolScope,production:boolean)=>transaction(pool,async db=>{
    const current=await toolScopeById(db,scope.capability_id,true);
    requireThat(current.run_id===scope.run_id&&current.scope_type==='ORDER'&&current.order_id
      &&(production?current.role==='PRODUCTION'&&current.stage_name==='PRODUCTION'
        :current.role===current.stage_name&&(current.role==='PRODUCTION'||current.role==='POST')),
    'GENERATION_SCOPE_INVALID','生成工具只接受原订单制作或后期的受限角色',403);
    const lease=(await db.query<StageLease>('SELECT * FROM stage_runs WHERE tenant_id=$1 AND id=$2',[current.tenant_id,current.stage_run_id])).rows[0]??notFound();
    requireThat(lease.scope_id===current.order_id&&lease.input_hash===current.snapshot_hash
      &&String(lease.fencing_token)===String(current.stage_fencing_token),'GENERATION_SCOPE_INVALID','工具与当前阶段代次不一致',403);
    const context=await executionContext(db,current.tenant_id,current.order_id,current.snapshot_hash);
    requireThat(context.snapshot.engine!=='PHOTO_LAYOUT','GENERATION_ROUTE_INVALID','原图路线不能调用生成式工具',422);
    return {lease,context};
  });
  return {
    generate_reference_frames:async(scope,args,_intent,signal)=>{
      const {lease,context}=await bound(scope,true);
      return {result:safeResult(await gateway.submit(lease,referenceRequest(context,args.shot_id),signal))};
    },
    submit_video:async(scope,args,_intent,signal)=>{
      const {lease,context}=await bound(scope,true);
      const {approval}=await readReferenceApproval(pool,cfg,store,context,lease.id);
      return {result:safeResult(await gateway.submit(lease,videoRequest(context,approval,args.shot_id),signal))};
    },
    query_original_submission:async(scope,args,_intent,signal)=>{
      const {lease,context}=await bound(scope,false),submissionId=args.submission_id as string;
      return {result:safeResult(lease.stage_name==='PRODUCTION'?await gateway.resume(lease,submissionId,signal)
        :await gateway.describe(context,submissionId,signal))};
    },
  };
}
