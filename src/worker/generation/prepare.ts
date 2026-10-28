import type pg from 'pg';
import type {Config} from '../../api/config.js';
import type {ObjectStorage} from '../../api/storage/storage.js';
import {requireThat} from '../../api/lib/errors.js';
import type {ExecutionContext} from '../compiler/order-context.js';
import type {RoleExecutor} from '../codex/planning.js';
import {bundleForVariant} from '../codex/skills.js';
import {PendingExternal,type StageLease} from '../queue/leases.js';
import {GenerationGateway} from './gateway.js';
import {ReferenceIdentityService} from './reference-service.js';
import {referenceRequest} from './requests.js';
import {validateGenerationExecution} from './contracts.js';
import {submitGenerationNode} from './execute.js';

/** The frozen Codex plan drives renderer inputs. The independent reference
 * role completes and releases before the single PRODUCTION role is launched,
 * so no nested role waits on the same serial MCP consumer. */
export async function prepareGeneratedReferences(pool:pg.Pool,cfg:Config,store:ObjectStorage,lease:StageLease,
  context:ExecutionContext,executor:RoleExecutor,gateway:GenerationGateway,signal:AbortSignal):Promise<void>{
  validateGenerationExecution(context.contract);
  const bundle=await bundleForVariant(cfg,context.snapshot.variant_id);
  requireThat(bundle.sha256===context.snapshot.codex_contract.skill_bundle_hash,'SKILL_BUNDLE_MISSING','原参考制作风格Skill摘要已变化',503);
  const shots=context.snapshot.engine==='REFERENCE_FILM'?['film']:context.contract.creative.shots.map(s=>s.shot_id);
  for(const shot of shots){
    const result=await submitGenerationNode(pool,gateway,lease,referenceRequest(context,shot),signal);
    requireThat(result.state!=='FAILED','GENERATION_REFERENCE_FAILED','原参考生成失败，禁止重购绕过',503);
    if(result.state!=='SUCCEEDED')throw new PendingExternal(3,'GENERATION_REFERENCE_PENDING');
  }
  await new ReferenceIdentityService(pool,cfg,store,executor).review(lease,signal);
}
