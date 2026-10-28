import type {Db} from '../../api/db/pool.js';
import type {Config} from '../../api/config.js';
import type {ObjectStorage} from '../../api/storage/storage.js';
import {hash,sha256} from '../../api/lib/crypto.js';
import {requireThat} from '../../api/lib/errors.js';
import type {ExecutionContext} from '../compiler/order-context.js';
import type {MediaReceipt} from '../media/artifacts.js';
import type {GenerationOutput} from './gateway.js';
import {generationContract} from './contracts.js';
import {readReferenceApproval} from './reference-approval.js';

export interface GenerationSource {submission_id:string;operation_key:string;sha256:string}
export async function generatedOutputs(db:Db,cfg:Config,store:ObjectStorage,context:ExecutionContext,stageId:string){
  const {approval}=await readReferenceApproval(db,cfg,store,context,stageId);
  const videoKeys=context.snapshot.engine==='PER_SHOT_AI'?context.contract.creative.shots.map(s=>`video:${s.shot_id}`):['film:original'];
  const required=[...approval.frames.map(f=>f.operation_key),...context.snapshot.outputs.filter(s=>s.kind==='image').map(s=>`image:${s.slot_id}`),...videoKeys];
  const rows=(await db.query<{id:string;operation_key:string;generation_kind:'IMAGE'|'VIDEO';model_version_id:string;input_hash:string;state:string;
    private:{owner_id:string;product_id:string;contract_hash:string;wire_contract:unknown;request_sha256:string;billing_valid?:boolean;provider_terminal?:boolean;
      prepared:{request_hash:string;contract_hash:string;reference_approval?:unknown;references:{id:string;sha256:string}[]};output?:GenerationOutput}}>(
    `SELECT id,operation_key,generation_kind,model_version_id,input_hash,state,private FROM provider_submissions
    WHERE tenant_id=$1 AND order_id=$2 AND stage_run_id=$3 AND operation_key=ANY($4) AND generation_kind IS NOT NULL`,
    [context.tenantId,context.orderId,stageId,required])).rows;
  requireThat(rows.length===required.length&&new Set(rows.map(r=>r.operation_key)).size===required.length,
    'GENERATED_PACK_INCOMPLETE','生成式整包缺少原计划节点',409);
  const outputs=new Map<string,{source:GenerationSource;output:GenerationOutput;bytes:Buffer}>();
  for(const row of rows){
    const c=generationContract(context.contract,row.generation_kind),p=row.private;
    requireThat(row.state==='SUCCEEDED'&&p.output&&p.billing_valid&&p.provider_terminal
      &&p.owner_id===context.ownerId&&p.product_id===context.snapshot.product_id&&row.model_version_id===c.model_version_id
      &&p.contract_hash===hash(c)&&hash(p.wire_contract)===hash(c)&&p.prepared.contract_hash===hash(c)
      &&p.prepared.request_hash===row.input_hash&&p.request_sha256===row.input_hash,
      'GENERATED_PACK_SOURCE_INVALID','生成节点没有原模型/费用/请求与完整成品证据',503);
    if(row.generation_kind==='VIDEO'){
      const frame=approval.frames.find(f=>f.operation_key===(row.operation_key==='film:original'?'reference:film':row.operation_key.replace(/^video:/,'reference:')))!;
      requireThat(p.prepared.reference_approval&&hash(p.prepared.reference_approval)===hash(approval)&&p.prepared.references.length===1
        &&p.prepared.references[0]!.id===frame.asset_id&&p.prepared.references[0]!.sha256===frame.sha256,
        'GENERATION_REFERENCE_APPROVAL_CHANGED','视频实际参考与原报告不一致',503);
    }
    const object=(await db.query<{sha256:string}>(`SELECT sha256 FROM private_object_writes WHERE tenant_id=$1 AND owner_id=$2
      AND order_id=$3 AND product_id=$4 AND kind='MEDIA' AND object_key=$5 AND state='STORED' AND NOT delete_requested AND expires_at>now()`,
      [context.tenantId,context.ownerId,context.orderId,context.snapshot.product_id,p.output.object_key])).rows[0];
    requireThat(object?.sha256===p.output.sha256,'GENERATION_MEDIA_REVOKED','原生成成品已撤权或缺少登记',410);
    const bytes=await store.get(p.output.object_key,c.max_download_bytes);
    requireThat(sha256(bytes)===p.output.sha256,'GENERATION_OBJECT_HASH_MISMATCH','原生成成品字节已变化',503);
    outputs.set(row.operation_key,{source:{submission_id:row.id,operation_key:row.operation_key,sha256:p.output.sha256},output:p.output,bytes});
  }
  return {approval,outputs,videoKeys};
}
export function sourcesForSlot(material:Awaited<ReturnType<typeof generatedOutputs>>,kind:string,slotId:string):GenerationSource[]{
  const keys=kind==='image'?[`image:${slotId}`]:kind==='video'?[...material.approval.frames.map(f=>f.operation_key),...material.videoKeys]:[];
  return keys.map(key=>material.outputs.get(key)!.source).sort((a,b)=>a.operation_key.localeCompare(b.operation_key));
}
export function checkGeneratedSources(receipt:MediaReceipt,material:Awaited<ReturnType<typeof generatedOutputs>>):void{
  for(const a of receipt.artifacts){
    const expected=sourcesForSlot(material,a.spec.kind,a.slot_id);
    requireThat(a.spec.kind==='copy'?a.spec.generation_sources===undefined&&a.spec.reference_approval_hash===undefined
      :a.spec.generation_sources&&hash(a.spec.generation_sources)===hash(expected)&&a.spec.reference_approval_hash===hash(material.approval),
      'GENERATED_PACK_SOURCE_INVALID','产物没有绑定原生成节点及参考核验',503);
  }
}
