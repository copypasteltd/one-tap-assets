import type {Db} from '../db/pool.js';
import type {Config} from '../config.js';
import type {DTO} from '../../shared/contracts/types.js';
import {getVariant} from './catalog.js';
import {compilePresetConfig,checkParentLicense} from './community.js';
import {license} from './licenses.js';
import {bundleForSource} from '../../worker/codex/skills.js';
import {hash,id,iso} from '../lib/crypto.js';
import {requireThat,notFound} from '../lib/errors.js';
import {validateInternal} from '../lib/validation.js';
import {audit} from '../db/store.js';
import {FONT_BINDING} from '../../worker/media/font.js';

/** Operator-only preparation, never an admission or a sale switch. Caller must
 * use a transaction; community authors have no route to this function. */
export async function prepareCommunityCommercial(db:Db,cfg:Config,input:{variantId:string;version:string;expectedRevision:number;actor:string;reason:string}):Promise<DTO<'ManagedVersion'>> {
  requireThat(Number.isSafeInteger(input.expectedRevision)&&input.expectedRevision>=0&&input.actor.trim().length>=2
    &&input.actor.length<=128&&input.reason.trim().length>=4&&input.reason.length<=1000,'COMMERCIAL_INPUT_INVALID','请提供版本、原修订号、平台操作人及配置说明',422);
  const row=await getVariant(db,input.variantId,input.version,true);
  requireThat(row.revision===input.expectedRevision,'REVISION_CONFLICT','制作规格已更新',409);
  const publication=(await db.query<{private:{config:DTO<'PresetConfig'>;request:DTO<'PublicationRequest'>};license_version:string;visibility:string}>(
    `SELECT a.private,v.license_version,p.visibility FROM publications a JOIN preset_versions v ON v.id=a.published_version_id
     JOIN presets p ON p.id=v.preset_id AND p.source='COMMUNITY' WHERE v.id=$1 AND a.review_state='PUBLISHED'`,[row.preset_version_id])).rows[0]??notFound();
  const terms=await license(db,publication.license_version,true);
  requireThat(publication.visibility==='PUBLIC'&&terms.state==='ACTIVE'&&terms.content_hash===publication.private.request.license_content_hash,
    'LICENSE_NOT_AVAILABLE','社区方案或许可已停止用于新交易',422);
  await checkParentLicense(db,publication.private.config.parent_preset_version,terms.license_id);
  requireThat(!row.data.sale_enabled&&row.data.admission_state==='NOT_EVALUATED'&&!row.private.commercial_binding,
    'COMMERCIAL_ALREADY_FROZEN','商业配置只能在独立准入前冻结一次；变更请发布新版本',409);
  const compiled=await compilePresetConfig(db,publication.private.config);
  const candidate=compiled.find(c=>hash({...c.source,variant_id:row.data.variant_id,version:row.data.version,name:row.data.name})===hash(row.private.source));
  requireThat(candidate,'COMMERCIAL_SOURCE_CHANGED','发布后的蓝本、组件或资源已变化，请重新制作样例并发布新版本',422);
  requireThat(publication.private.config.resource_version_ids.length===0&&row.data.speech_mode==='NONE'
    &&['none','approved_licensed_or_contract_silent'].includes(row.private.source.audio_policy.music),
    'COMMERCIAL_ROUTE_NOT_AVAILABLE','当前商业配置只支持无声及平台字体路线',422);
  const binding=row.private.source.community_binding as {blueprint_version_id:string;blueprint_source_hash:string};
  const base=(await db.query<{id:string;revision:number;data:DTO<'Variant'>;private:Record<string,unknown>}>(
    `SELECT x.id,x.revision,x.data,x.private FROM execution_variants x JOIN preset_versions v ON v.id=x.preset_version_id
     JOIN presets p ON p.id=v.preset_id AND p.source='OFFICIAL' WHERE x.id=$1 FOR SHARE OF x`,[binding.blueprint_version_id])).rows[0]??notFound();
  requireThat(hash(base.private.source)===binding.blueprint_source_hash&&base.data.admission_state==='ADMITTED'&&Number.isSafeInteger(base.data.price_fen)
    &&Number(base.data.price_fen)>0,'BLUEPRINT_NOT_ADMITTED','蓝本价格、能力与成本尚未通过平台准入',422);
  const skill=await bundleForSource(cfg,row.private.source);
  const registered=(await db.query<{state:string}>('SELECT state FROM skill_bundles WHERE bundle_hash=$1 FOR SHARE',[skill.sha256])).rows[0];
  requireThat(registered?.state==='ADMITTED','SKILL_BUNDLE_NOT_ADMITTED','目标风格 Skill 尚未准入',422);
  const cc={...(base.private.codex_contract as DTO<'CodexContract'>),skill_bundle_id:skill.bundle_id,skill_bundle_version:skill.version,skill_bundle_hash:skill.sha256};
  validateInternal('codex-contract',cc);
  const models=base.private.model_version_ids;
  requireThat(Array.isArray(models)&&models.length>0&&new Set(models).size===models.length&&models.every(m=>typeof m==='string'),
    'COMMERCIAL_CONFIGURATION_INCOMPLETE','蓝本模型配置不完整',422);
  const admitted=await db.query("SELECT id FROM provider_model_versions WHERE id=ANY($1) AND status='ADMITTED' FOR SHARE",[models]);
  const budget=Number(base.private.budget_micro),repair=Number(base.private.repair_ceiling_micro??0);
  requireThat(admitted.rowCount===models.length&&Number.isSafeInteger(budget)&&Number.isSafeInteger(repair)&&repair>=0
    &&budget>=cc.agent_cost_ceiling_micro*2+repair,'COMMERCIAL_CONFIGURATION_INCOMPLETE','蓝本模型或原制作、修改预算不足',422);
  const resources=base.private.resource_versions??[];
  requireThat(Array.isArray(resources)&&resources.length<=1&&resources.every(r=>hash(r)===hash(FONT_BINDING)),
    'COMMERCIAL_ROUTE_NOT_AVAILABLE','额外资源必须单独定价与准入',422);
  const commercial={version:'YPCC-COMMUNITY-COMMERCIAL-1',source_hash:hash(row.private.source),blueprint_version_id:base.id,
    blueprint_revision:base.revision,blueprint_configuration_hash:hash(base.private),skill_bundle_hash:skill.sha256,
    actor:input.actor,reason:input.reason,configured_at:iso()};
  const privateData={...row.private,model_version_ids:structuredClone(models),budget_micro:budget,repair_ceiling_micro:repair,
    resource_versions:[],codex_contract:cc,commercial_binding:commercial};
  const data={...row.data,price_fen:base.data.price_fen,sale_enabled:false,reason_codes:['REQUIRES_COMMUNITY_FULL_ADMISSION']};
  await db.query('UPDATE execution_variants SET price_fen=$2,data=$3,private=$4,revision=revision+1 WHERE id=$1',
    [row.id,data.price_fen,JSON.stringify(data),JSON.stringify(privateData)]);
  await audit(db,null,input.actor,'COMMUNITY_COMMERCIAL_PREPARE',row.id,{commercial_hash:hash(commercial),sale_enabled:false},id('trace'));
  return {resource_id:row.id,kind:'VARIANT',revision:input.expectedRevision+1,version:row.data.version,admission_state:'NOT_EVALUATED',
    sale_enabled:false,price_fen:data.price_fen,actual_model:null,model_version_ids:models as string[],evidence_set_id:null,reason_codes:data.reason_codes};
}
