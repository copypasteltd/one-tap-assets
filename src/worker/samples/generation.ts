import type pg from 'pg';
import type {Db} from '../../api/db/pool.js';
import type {Config} from '../../api/config.js';
import type {ObjectStorage} from '../../api/storage/storage.js';
import {hash} from '../../api/lib/crypto.js';
import {requireThat} from '../../api/lib/errors.js';
import {lockMediaOwner} from '../../api/modules/media-access.js';
import type {FrozenContract} from '../compiler/snapshot.js';
import {creativePlanHash} from '../compiler/plan.js';
import {freezeAiDisclosure} from '../compiler/disclosure.js';
import {GenerationGateway} from '../generation/gateway.js';
import type {GenerationContext,GenerationScopeAdapter} from '../generation/scope.js';
import {validateGenerationExecution} from '../generation/contracts.js';
import {ArkClient} from '../providers/ark.js';
import {reservePlatform,settlePlatform} from '../budget/platform.js';
import {assertLease,PendingExternal,type StageLease} from '../queue/leases.js';
import {sampleContext,samplePlan,type SampleContext} from './context.js';
import {ReferenceIdentityService} from '../generation/reference-service.js';
import {referenceRequest} from '../generation/requests.js';
import {submitGenerationNode} from '../generation/execute.js';
import type {RoleExecutor} from '../codex/planning.js';

/** Noncommercial projection of the frozen sample, never bindSnapshot(fakeOrder). */
export function sampleGenerationContext(c:SampleContext):GenerationContext{
  const i=c.input,g=i.generation;
  requireThat(g&&i.source.engine!=='PHOTO_LAYOUT'&&i.limits.ceiling_micro===g.codex_contract.agent_cost_ceiling_micro,
    'SAMPLE_GENERATION_NOT_FROZEN','本次样例没有冻结生成能力，不能补写旧样例',503);
  const plan=samplePlan(c),maxVideo=i.source.engine==='PER_SHOT_AI'?plan.shots.length:1;
  requireThat(maxVideo<=g.max_video_calls&&plan.image_slots.length+maxVideo<=g.max_image_calls,
    'SAMPLE_GENERATION_BUDGET_INVALID','内容计划超出原样例生成次数',422);
  const contract:FrozenContract={product:g.product,profile:i.profile,photo_set_hash:i.photo_set_hash,identity_lock_hash:i.identity_lock_hash,
    request:{product_id:i.request.product_id,photo_version:i.profile.photo_version,profile_id:i.profile.profile_id,identity_lock_id:i.profile.identity_lock_id,
      preset_id:String(i.source.creative_components.platform_style_id),preset_version:i.source.skill_bundle.version,variant_id:i.source.variant_id,variant_version:i.source.version},
    creative:plan,source:i.source,plan_hash:creativePlanHash(plan),model_versions:g.model_versions,resource_versions:g.resource_versions,
    codex_contract:g.codex_contract,generation_contracts:g.generation_contracts,budget_micro:g.total_ceiling_micro,repair_ceiling_micro:0,
    runtime_binding:{admission:i.admission,limits:i.limits}};
  freezeAiDisclosure(contract);validateGenerationExecution(contract);
  const snapshot:GenerationContext['snapshot']={schema_version:'1.1.0',tenant_id:i.tenant_id,product_id:i.request.product_id,
    photo_version:i.profile.photo_version,photo_set_hash:i.photo_set_hash,profile_id:i.profile.profile_id,profile_hash:i.profile.profile_hash,
    identity_lock_id:i.profile.identity_lock_id,identity_lock_hash:i.identity_lock_hash,preset_id:contract.request.preset_id,preset_version:contract.request.preset_version,
    variant_id:i.source.variant_id,variant_version:i.source.version,engine:i.source.engine,plan_hash:contract.plan_hash,canonicalization:'RFC8785',
    model_versions:g.model_versions,resource_versions:g.resource_versions,reference_policy:{max_images:5,max_total_pixels:150_000_000,mapping_hash:null},
    audio_policy:{speech_mode:'NONE',language:null,native_voice_id:null,preserve_native_speech:false,caption_alignment:'NO_SPEECH',music_license_ids:[],ducking_enabled:false},
    timeline:{fps:30,target_frames:plan.target_frames,shots:plan.shots.map(({shot_id,start_frame,end_frame,overlap_frames,evidence_ids,spoken_text})=>({shot_id,start_frame,end_frame,overlap_frames,evidence_ids,spoken_text}))},
    outputs:i.source.output_slots.map(s=>({slot_id:s.slot_id,kind:s.kind,count:1,width:s.width,height:s.height,fps:s.kind==='video'?30:null,
      duration_frames:s.kind==='video'?plan.target_frames:null,format:s.kind==='video'?'mp4-h264-yuv420p':'png'})),
    deadline_at:i.deadline_at,codex_contract:g.codex_contract};
  return {tenantId:i.tenant_id,orderId:null,sampleId:i.sample_id,skillVariantId:i.skill_variant_id,ownerId:i.owner_id,
    snapshotHash:c.inputHash,photoVersionId:i.photo_version_id,snapshot,contract};
}
export async function liveSampleGeneration(db:Db,lease:StageLease):Promise<GenerationContext>{
  requireThat(lease.scope_type==='SAMPLE'&&lease.stage_name==='SAMPLE_PRODUCTION','SAMPLE_GENERATION_SCOPE_INVALID','样例生成只可使用原制作阶段',403);
  const owner=(await db.query<{owner_id:string}>('SELECT owner_id FROM public_samples WHERE tenant_id=$1 AND id=$2',[lease.tenant_id,lease.scope_id])).rows[0];
  requireThat(owner,'SAMPLE_INPUT_UNAVAILABLE','样例不可用',409);
  await lockMediaOwner(db,lease.tenant_id,owner.owner_id);
  const c=await sampleContext(db,lease.tenant_id,lease.scope_id,lease.input_hash,true);await assertLease(db,lease);
  requireThat(new Date(lease.deadline_at).toISOString()===c.input.deadline_at,'SAMPLE_GENERATION_SCOPE_INVALID','样例阶段原截止不一致',403);
  return sampleGenerationContext(c);
}
function adapter():GenerationScopeAdapter{return {column:'sample_id',type:'SAMPLE',stage:'SAMPLE_PRODUCTION',context:liveSampleGeneration,
  lock:async(db,tenant,sample)=>{await db.query('SELECT id FROM public_samples WHERE tenant_id=$1 AND id=$2 FOR UPDATE',[tenant,sample]);},
  live:async(db,tenant,sample)=>!!(await db.query(`SELECT id FROM public_samples WHERE tenant_id=$1 AND id=$2 AND state IN ('QUEUED','GENERATING')
    AND NOT (private ? 'media_revoked') AND (private->'execution'->'input'->>'deadline_at')::timestamptz>now()`,[tenant,sample])).rowCount,
  reserve:async(db,lease,intent,contract)=>{
    const c=await sampleContext(db,lease.tenant_id,lease.scope_id,lease.input_hash,true),g=c.input.generation!;
    const reserved=(await db.query<{amount:string}>(`SELECT COALESCE(sum(b.amount_micro),0) AS amount FROM provider_submissions p
      JOIN platform_budget_reservations b ON b.tenant_id=p.tenant_id AND b.id=p.reservation_id WHERE p.tenant_id=$1 AND p.sample_id=$2`,[lease.tenant_id,lease.scope_id])).rows[0]!;
    requireThat(Number(reserved.amount)+contract.rate.ceiling_micro<=g.ceiling_micro,'SAMPLE_GENERATION_BUDGET_EXCEEDED','原样例生成额度已用完',429);
    return reservePlatform(db,{tenantId:lease.tenant_id,ownerId:c.input.owner_id,category:'CODEX_SAMPLE',dailyCeilingMicro:c.input.limits.daily_ceiling_micro},
      intent,contract.rate.ceiling_micro,{sample_id:lease.scope_id,input_hash:c.inputHash,contract_hash:hash(contract),rate_snapshot_id:contract.rate_snapshot_id,rate:contract.rate});
  },
  settle:async(db,row,actual,noCharge)=>settlePlatform(db,row.tenant_id,row.reservation_id,actual,noCharge),
};}
export function sampleGenerationGateway(pool:pg.Pool,cfg:Config,store:ObjectStorage,client?:ArkClient):GenerationGateway{
  requireThat(!client||cfg.env==='test','TEST_PORT_FORBIDDEN','样例供应商替身仅限测试',500);
  return new GenerationGateway(pool,cfg,store,client??new ArkClient(cfg),adapter());
}
export async function prepareSampleReferences(pool:pg.Pool,cfg:Config,store:ObjectStorage,lease:StageLease,c:SampleContext,
  executor:RoleExecutor,gateway:GenerationGateway,signal:AbortSignal):Promise<void>{
  const context=sampleGenerationContext(c),shots=context.snapshot.engine==='REFERENCE_FILM'?['film']:context.contract.creative.shots.map(s=>s.shot_id);
  for(const shot of shots){const result=await submitGenerationNode(pool,gateway,lease,referenceRequest(context,shot),signal);
    requireThat(result.state!=='FAILED','GENERATION_REFERENCE_FAILED','样例原参考生成失败，不能重购绕过',503);
    if(result.state!=='SUCCEEDED')throw new PendingExternal(3,'GENERATION_REFERENCE_PENDING');}
  await new ReferenceIdentityService(pool,cfg,store,cfg.env==='test'?executor:undefined,liveSampleGeneration).review(lease,signal);
}
