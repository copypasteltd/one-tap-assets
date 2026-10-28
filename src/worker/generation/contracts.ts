import type {Config} from '../../api/config.js';
import {hash} from '../../api/lib/crypto.js';
import {requireThat} from '../../api/lib/errors.js';
import type {FrozenContract,ModelBinding} from '../compiler/snapshot.js';
import {admitArkContract,frozenArkContract,type ArkContract} from '../providers/ark.js';

export interface GenerationModelRow {id:string;status:string;data:ModelBinding;private?:{ark_contract?:unknown}}
function matches(c:ArkContract,row:GenerationModelRow):boolean{
  const role=c.wire==='ARK_IMAGE'?'IMAGE':'VIDEO';
  return c.model_version_id===row.id&&row.data.provider===c.provider&&row.data.actual_model===c.actual_model
    &&row.data.registry_version===c.registry_version&&row.data.rate_snapshot_id===c.rate_snapshot_id
    &&row.data.capability_hash===hash(c)&&row.data.roles.includes(role);
}
/** This is part of the private quote contract, and thus its existing immutable hash. */
export function freezeGenerationContracts(cfg:Config,rows:GenerationModelRow[]):ArkContract[]{
  const selected=rows.filter(row=>row.data.roles.some(role=>role==='IMAGE'||role==='VIDEO'));
  const result=selected.map(row=>{const c=admitArkContract(cfg,row.private?.ark_contract);
    requireThat(row.status==='ADMITTED'&&matches(c,row),'GENERATION_MODEL_BINDING_INVALID','生成模型登记与实际协议或费率不一致',503);return structuredClone(c);});
  requireThat(result.length===2&&new Set(result.map(c=>c.wire)).size===2,'GENERATION_MODEL_NOT_ADMITTED','生成式方案需要明确的图片和视频协议',503);
  return result;
}
export function generationContract(contract:FrozenContract,kind:'IMAGE'|'VIDEO'):ArkContract{
  const candidates=(contract.generation_contracts??[]).filter(c=>c.wire===(kind==='IMAGE'?'ARK_IMAGE':'ARK_VIDEO'));
  requireThat(candidates.length===1,'GENERATION_MODEL_NOT_ADMITTED','原订单缺少唯一冻结生成协议',503);
  const c=frozenArkContract(candidates[0]);
  requireThat(contract.model_versions.some(data=>matches(c,{id:c.model_version_id,status:'ADMITTED',data})),
    'GENERATION_MODEL_BINDING_INVALID','原订单的生成协议与模型快照不一致',503);return c;
}
export function validateGenerationBudget(contract:FrozenContract):void{
  if(contract.source.engine==='PHOTO_LAYOUT')return;
  const image=generationContract(contract,'IMAGE'),video=generationContract(contract,'VIDEO');
  const shots=contract.creative.shots.length;
  const imageCalls=contract.source.output_slots.filter(slot=>slot.kind==='image').length+(contract.source.engine==='PER_SHOT_AI'?shots:1);
  const videoCalls=contract.source.engine==='PER_SHOT_AI'?shots:1;
  const minimum=BigInt(imageCalls)*BigInt(image.rate.ceiling_micro)+BigInt(videoCalls)*BigInt(video.rate.ceiling_micro)
    +BigInt(contract.codex_contract.agent_cost_ceiling_micro)+BigInt(contract.revision_policy?.budget_micro??0)+BigInt(contract.repair_ceiling_micro);
  requireThat(minimum<=BigInt(contract.budget_micro),'GENERATION_BUDGET_INVALID','原总预算不能覆盖冻结素材、Agent、售后与修复上界',503);
  requireThat(contract.source.audio_policy.speech==='none','NATIVE_AUDIO_NOT_ADMITTED','原生人声和人物能力尚未完成单独准入',503);
}
