import type {Db} from '../../api/db/pool.js';
import type {Config} from '../../api/config.js';
import {hash} from '../../api/lib/crypto.js';
import {requireThat} from '../../api/lib/errors.js';
import type {FrozenContract,ModelBinding} from '../compiler/snapshot.js';
import {admitListeningContract,frozenListeningContract,type ListeningContract} from '../providers/omni-listening.js';

export interface ListeningModelRow {id:string;status:string;data:ModelBinding;private?:{listening_contract?:unknown}}
function matches(c:ListeningContract,row:ListeningModelRow):boolean{
  return row.id===c.model_version_id&&row.data.provider===c.provider&&row.data.actual_model===c.actual_model
    &&row.data.registry_version===c.registry_version&&row.data.rate_snapshot_id===c.rate_snapshot_id
    &&row.data.capability_hash===hash(c)&&row.data.roles.includes('QC');
}
/** Optional on historical internal contracts. Missing listening capability
 * never admits the final audio reviews, public order or delivery. */
export function frozenOrderListening(contract:FrozenContract):ListeningContract|null{
  const raw=contract.listening_contract;
  if(!raw)return null;
  const c=frozenListeningContract(raw),audio=contract.native_audio_contract;
  requireThat(audio&&contract.source.audio_policy.speech!=='none'&&contract.creative.target_frames===audio.target_frames
    &&audio.target_frames<=c.max_target_frames&&contract.model_versions.filter(m=>m.roles.includes('QC')).length===1
    &&contract.model_versions.some(m=>matches(c,{id:c.model_version_id,status:'ADMITTED',data:m}))
    &&BigInt(audio.cost.ceiling_micro)+BigInt(c.per_request_ceiling_micro)*BigInt(c.max_packets)
      +BigInt(contract.codex_contract.agent_cost_ceiling_micro)+BigInt(contract.revision_policy?.budget_micro??0)<=BigInt(contract.budget_micro),
  'LISTENING_ORDER_CONTRACT_INVALID','听音能力、两次原整包上限及售后费用未冻结在原订单内',503);return c;
}
export function freezeOrderListening(cfg:Config,contract:FrozenContract,models:ListeningModelRow[]):void{
  const rows=models.filter(m=>m.data.roles.includes('QC'));
  if(rows.length===0){requireThat(!contract.listening_contract,'LISTENING_ORDER_CONTRACT_INVALID','听音合同缺少原模型绑定',503);return;}
  requireThat(rows.length===1&&contract.native_audio_contract,'LISTENING_ORDER_CONTRACT_INVALID','有声方案只能选择唯一独立听音模型',503);
  const c=admitListeningContract(cfg,rows[0]!.private?.listening_contract);
  requireThat(rows[0]!.status==='ADMITTED'&&matches(c,rows[0]!),'LISTENING_MODEL_BINDING_INVALID','听音模型准入、协议、能力摘要或费率版本不一致',503);
  contract.listening_contract=structuredClone(c);frozenOrderListening(contract);
}
export async function verifyListeningLive(db:Db,cfg:Config,contract:FrozenContract,lock=false):Promise<ListeningContract>{
  const c=frozenOrderListening(contract);requireThat(c,'INDEPENDENT_AUDIO_REVIEW_REQUIRED','原订单尚未冻结独立听音能力',503);
  admitListeningContract(cfg,c);
  const row=(await db.query<ListeningModelRow>(`SELECT id,status,data,private FROM provider_model_versions WHERE id=$1${lock?' FOR SHARE':''}`,[c.model_version_id])).rows[0];
  requireThat(row&&row.status==='ADMITTED'&&matches(c,row)&&hash(row.private?.listening_contract)===hash(c),
    'LISTENING_MODEL_CHANGED','原听音模型、能力或费率登记已撤销或改变',503);
  const incident=await db.query(`SELECT id FROM provider_submissions WHERE generation_kind='LISTENING'
    AND private @> $1::jsonb LIMIT 1`,[JSON.stringify({contract_hash:hash(c),contract_violation:true})]);
  requireThat(!incident.rowCount,'LISTENING_CONTRACT_SUSPENDED','听音原回执违反能力上限，该能力已暂停',503);return c;
}
