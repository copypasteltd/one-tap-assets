import type {Db} from '../../api/db/pool.js';
import type {Config} from '../../api/config.js';
import {hash} from '../../api/lib/crypto.js';
import {requireThat} from '../../api/lib/errors.js';
import type {FrozenContract,ModelBinding} from '../compiler/snapshot.js';
import {frozenNativeAudio,verifyNativeAudioLive} from './contract.js';
import {frozenOrderListening,verifyListeningLive} from './listening-contract.js';
import {admitArkContract} from '../providers/ark.js';
import {admitSpeechContract} from '../providers/dashscope-asr.js';
import {generationCostCeiling,validateGenerationExecution} from '../generation/contracts.js';
import {checkAdmission} from '../codex/admission.js';

/** A frozen pre-sale binding, not a claim of live commercial admission. Sale
 * availability and signed independent capability evidence remain separate. */
export interface NativeSaleContract {
  version:'YPCC-NATIVE-SALE-1';source_hash:string;plan_hash:string;audio_contract_hash:string;listening_contract_hash:string;
  model_contracts_hash:string;codex_contract_hash:string;revision_policy_hash:string;budget_micro:number;ceiling_micro:number;
  valid_until:string;input_policy:'PRIVATE_SIGNED_HTTPS';
}
function nativeSaleValue(contract:FrozenContract):NativeSaleContract {
  const audio=frozenNativeAudio(contract),listening=frozenOrderListening(contract),runtime=contract.runtime_binding;
  requireThat(audio&&listening&&runtime&&contract.revision_policy,'NATIVE_AUDIO_NOT_ADMITTED','有声公开报价尚未冻结完整原声、独立听音和受限售后能力',503);
  validateGenerationExecution(contract,true);
  const ceiling=generationCostCeiling(contract);requireThat(ceiling<=BigInt(Number.MAX_SAFE_INTEGER),
    'GENERATION_BUDGET_INVALID','声音整包费用上界超出安全范围',503);
  const valid=Math.min(...[...contract.generation_contracts!,audio.asr.contract,listening,runtime.admission,audio.character].map(c=>Date.parse(c.valid_until)));
  requireThat(Number.isFinite(valid),'NATIVE_SALE_CONTRACT_INVALID','原声音能力有效期不完整',503);
  return {version:'YPCC-NATIVE-SALE-1',source_hash:hash(contract.source),plan_hash:contract.plan_hash,
    audio_contract_hash:hash(audio),listening_contract_hash:hash(listening),
    model_contracts_hash:hash([contract.generation_contracts,audio.asr.contract,listening]),codex_contract_hash:hash(contract.codex_contract),
    revision_policy_hash:hash(contract.revision_policy),budget_micro:contract.budget_micro,ceiling_micro:Number(ceiling),
    valid_until:new Date(valid).toISOString(),input_policy:'PRIVATE_SIGNED_HTTPS'};
}
export function frozenNativeSale(contract:FrozenContract):NativeSaleContract {
  requireThat(contract.native_sale_contract,'NATIVE_AUDIO_NOT_ADMITTED','原报价缺少完整声音售前绑定，不能将内部合同自动升级为可购买订单',503);
  const expected=nativeSaleValue(contract);
  requireThat(hash(expected)===hash(contract.native_sale_contract),'NATIVE_SALE_CONTRACT_INVALID','原声音售前配置或费用绑定已变化',503);return expected;
}
/** Used after a verified payment without reading a newer operator config.
 * Revocation becomes a refund on this order, never a replacement purchase. */
export async function verifyNativeSaleRegistration(db:Db,contract:FrozenContract,lock=false):Promise<void>{
  const sale=frozenNativeSale(contract),audio=frozenNativeAudio(contract)!,listening=frozenOrderListening(contract)!;
  requireThat(Date.parse(sale.valid_until)>Date.now(),'NATIVE_SALE_CAPABILITY_CHANGED','原声音能力已到期',503);
  const specs=[...contract.generation_contracts!.map(c=>({contract:c,field:'ark_contract',role:c.wire==='ARK_IMAGE'?'IMAGE':'VIDEO'})),
    {contract:audio.asr.contract,field:'speech_contract',role:'SPEECH'}, {contract:listening,field:'listening_contract',role:'QC'}];
  requireThat(new Set(specs.map(s=>s.contract.model_version_id)).size===specs.length,'NATIVE_SALE_CAPABILITY_CHANGED','原声音模型绑定不唯一',503);
  const rows=(await db.query<{id:string;status:string;data:ModelBinding;private:Record<string,unknown>}>(
    `SELECT id,status,data,private FROM provider_model_versions WHERE id=ANY($1)${lock?' FOR SHARE':''}`,[specs.map(s=>s.contract.model_version_id)])).rows;
  requireThat(rows.length===specs.length&&specs.every(s=>{
    const row=rows.find(r=>r.id===s.contract.model_version_id),c=s.contract;
    return row?.status==='ADMITTED'&&row.data.provider===c.provider&&row.data.actual_model===c.actual_model
      &&row.data.registry_version===c.registry_version&&row.data.rate_snapshot_id===c.rate_snapshot_id
      &&row.data.roles.includes(s.role as ModelBinding['roles'][number])&&row.data.capability_hash===hash(c)&&hash(row.private[s.field])===hash(c);
  }),'NATIVE_SALE_CAPABILITY_CHANGED','原生成、转写或独立听音模型、能力或费率已撤销或变化',503);
  const skill=await db.query("SELECT id FROM skill_bundles WHERE bundle_hash=$1 AND state='ADMITTED'"+(lock?' FOR SHARE':''),[contract.codex_contract.skill_bundle_hash]);
  requireThat(skill.rowCount===1,'NATIVE_SALE_CAPABILITY_CHANGED','原声音风格 Skill 已停止用于新交易',503);
  const incident=await db.query("SELECT id FROM provider_submissions WHERE generation_kind='LISTENING' AND private @> $1::jsonb LIMIT 1",
    [JSON.stringify({contract_hash:hash(listening),contract_violation:true})]);
  requireThat(!incident.rowCount,'NATIVE_SALE_CAPABILITY_CHANGED','原独立听音能力已因回执违规暂停',503);
}
export async function verifyNativeSaleLive(db:Db,cfg:Config,contract:FrozenContract,lock=false):Promise<void>{
  frozenNativeSale(contract);
  requireThat(cfg.paymentsEnabled&&cfg.codex.enabled&&cfg.generationEnabled,'SERVICE_NOT_ADMITTED','原声音制作或交易服务尚未开放',503);
  checkAdmission(cfg,contract.runtime_binding!.admission);
  const audio=frozenNativeAudio(contract)!;
  requireThat(cfg.storage.driver==='oss'&&cfg.storage.endpoint.startsWith('https://')&&cfg.storage.bucket&&cfg.storage.keyId&&cfg.storage.secret,
    'NATIVE_INPUT_STORAGE_UNAVAILABLE','原生声音转写需要已配置的私有HTTPS存储读取能力',503);
  const inputHost=`${cfg.storage.bucket}.${new URL(cfg.storage.endpoint).hostname}`;
  requireThat(audio.asr.contract.input_hosts.includes(inputHost),'NATIVE_INPUT_STORAGE_UNAVAILABLE','私有存储域名不在原转写读取许可内',503);
  for(const c of contract.generation_contracts!)admitArkContract(cfg,c);
  admitSpeechContract(cfg,audio.asr.contract);
  await verifyNativeSaleRegistration(db,contract,lock);await verifyListeningLive(db,cfg,contract,lock);
  await verifyNativeAudioLive(db,contract,lock);
}
export async function freezeNativeSale(db:Db,cfg:Config,contract:FrozenContract):Promise<void>{
  if(contract.source.audio_policy.speech==='none')return;
  requireThat(!contract.native_sale_contract,'NATIVE_SALE_CONTRACT_INVALID','不能替换原声音售前绑定',503);
  contract.native_sale_contract=nativeSaleValue(contract);await verifyNativeSaleLive(db,cfg,contract,true);
}
