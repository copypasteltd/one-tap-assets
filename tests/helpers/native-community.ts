import type {TestDatabase} from './database.js';
import {account} from './database.js';
import type {Config} from '../../src/api/config.js';
import type {FrozenContract} from '../../src/worker/compiler/snapshot.js';
import type {DTO} from '../../src/shared/contracts/types.js';
import {createDraft,compilePresetConfig} from '../../src/api/modules/community.js';
import {registerLicense,decideLicense} from '../../src/api/modules/licenses.js';
import {variantDto} from '../../src/api/modules/catalog.js';
import {bundleForSource} from '../../src/worker/codex/skills.js';
import {insert} from '../../src/api/db/store.js';
import {id,hash} from '../../src/api/lib/crypto.js';

/** Published author metadata and model/rights admission are explicit synthetic
 * fixtures. They do not certify a real public sample or commercial admission. */
export async function nativeCommunityFixture(db:TestDatabase,cfg:Config,contract:FrozenContract,modelIds:string[]){
  if(cfg.env!=='test')throw new Error('Native community fixture is test-only');
  const author=await account(db),base=contract.source,style=base.variant_id.split('.')[0]!,skill=await bundleForSource(cfg,base);
  const cc={...contract.codex_contract,skill_bundle_id:skill.bundle_id,skill_bundle_version:skill.version,skill_bundle_hash:skill.sha256};
  await db.pool.query("UPDATE execution_variants SET sale_enabled=false,admission_state='ADMITTED',price_fen=100,data=$2,private=$3 WHERE variant_id=$1",
    [base.variant_id,JSON.stringify({...variantDto(base),sale_enabled:false,admission_state:'ADMITTED',price_fen:100}),JSON.stringify({source:base,preset_id:style,
      codex_contract:cc,model_version_ids:modelIds,budget_micro:contract.budget_micro,repair_ceiling_micro:contract.repair_ceiling_micro,resource_versions:contract.resource_versions})]);
  await db.pool.query("UPDATE skill_bundles SET state='ADMITTED' WHERE bundle_hash=$1",[skill.sha256]);
  const draft=await createDraft(db.pool,author.principal,{name:'合成有声社区协议',description:'Synthetic published configuration; no production admission or real authorization.',
    style_tags:['合成'],parent_preset_version:null,component_versions:[`style.${style}.1`],variant_blueprint_ids:[`blueprint.${base.variant_id}`],resource_version_ids:[],fork_allowed:true});
  const compiled=await compilePresetConfig(db.pool,draft.config),presetId=id('community'),versionId=`${presetId}.1.0.0`;
  const source={...compiled[0]!.source,variant_id:`${presetId}.variant-1`,version:'1.0.0',name:'合成有声社区协议·原生声音'};
  const terms=await registerLicense(db.pool,{license_id:id('license'),version:'1.0.0',name:'仅合成商业协议测试',full_text:'SYNTHETIC COMMUNITY LICENSE. NO REAL PUBLICATION OR RIGHTS GRANT.',fork_allowed:true,attribution_required:true});
  await decideLicense(db.pool,terms.license_id,{expected_state:'DRAFT',expected_content_hash:terms.content_hash,decision:'APPROVE',review_reference:'synthetic-native-community',reason:'仅验证原生商业配置协议'});
  const summary:DTO<'PresetSummary'>={preset_id:presetId,version:'1.0.0',name:'合成有声社区协议',author_name:'合成独立作者',source:'COMMUNITY',style_tags:['合成'],sample_id:null,
    sample_label:'AUTHORIZED_SAMPLE_NOT_YOUR_RESULT',sale_enabled:false};
  await insert(db.pool,'presets',{id:presetId,author_id:author.principal.userId,source:'COMMUNITY',current_version:'1.0.0',data:summary});
  await insert(db.pool,'preset_versions',{id:versionId,preset_id:presetId,version:'1.0.0',hash:hash(summary),license_version:terms.license_id,
    data:{preset:summary,description:'仅合成测试元数据',variants:[variantDto(source)],license_summary:terms.full_text,fork_allowed:true,parent_version:null}});
  await insert(db.pool,'execution_variants',{id:`${source.variant_id}.1.0.0`,preset_version_id:versionId,variant_id:source.variant_id,version:source.version,engine:source.engine,
    data:variantDto(source),private:{source,preset_id:presetId,community_config:draft.config}});
  await insert(db.pool,'publications',{id:id('publication'),tenant_id:author.principal.tenantId,owner_id:author.principal.userId,draft_id:draft.draft_id,draft_revision:draft.revision,
    review_state:'PUBLISHED',admission_state:'NOT_EVALUATED',published_version_id:versionId,data:{},private:{config:draft.config,request:{license_content_hash:terms.content_hash}}});
  const input={variantId:source.variant_id,version:source.version,expectedRevision:0,actor:'synthetic-platform-native-operator',reason:'验证冻结的有声社区商业配置，非真实准入',
    nativeVoice:{character_version_id:contract.creative.character_version_id!,native_voice_id:contract.creative.native_voice_id!}};
  const request:DTO<'PlanRequest'>={...contract.request,preset_id:presetId,preset_version:source.version,variant_id:source.variant_id,variant_version:source.version};
  return {source,presetId,versionId,author,input,request,blueprintId:base.variant_id};
}
