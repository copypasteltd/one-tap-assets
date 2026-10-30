import type {Db} from '../../api/db/pool.js';
import type {ExecutionContext} from '../compiler/order-context.js';
import type {Snapshot} from '../compiler/snapshot.js';
import type {StageLease} from '../queue/leases.js';
import type {ArkContract} from '../providers/ark.js';
import {generationSourceStage} from '../repair/generation.js';
import {requireThat} from '../../api/lib/errors.js';

/** Shared rendering inputs contain no fabricated order or payment. A SAMPLE
 * keeps its own identity, frozen input hash, authority and platform ledger. */
export interface GenerationContext extends Omit<ExecutionContext,'orderId'|'snapshot'> {
  orderId:string|null; sampleId?:string; skillVariantId?:string;
  snapshot:Omit<Snapshot,'order_id'|'pricing'|'budget'|'fulfillable_at'|'policy_version'>;
}
export function generationScope(c:GenerationContext){
  requireThat(c.sampleId?c.orderId===null:typeof c.orderId==='string'&&c.orderId.length>0,'GENERATION_SCOPE_INVALID','生成执行范围必须明确且唯一',403);
  return c.sampleId?{type:'SAMPLE' as const,id:c.sampleId,column:'sample_id' as const,stage:'SAMPLE_PRODUCTION',instanceColumn:'preview_session_id' as const}
    :{type:'ORDER' as const,id:c.orderId!,column:'order_id' as const,stage:'PRODUCTION',instanceColumn:'order_id' as const};
}
export function orderGenerationContext(c:GenerationContext):ExecutionContext {
  if(c.sampleId||!c.orderId)throw new Error('Order-only generation authority required');
  return c as ExecutionContext;
}
/** SQL fragments use only the closed scope enum, never caller input. */
export function generationSource(c:GenerationContext,stage:string,kind:'IMAGE'|'VIDEO',operation:string){
  return c.sampleId?stage:generationSourceStage(orderGenerationContext(c),stage,kind,operation);
}
export function generationCostConfirmed(c:GenerationContext,alias:'s'='s'){
  return c.sampleId?`EXISTS(SELECT 1 FROM platform_budget_reservations b JOIN platform_cost_accounts a ON a.id=b.account_id
    WHERE b.tenant_id=${alias}.tenant_id AND b.id=${alias}.reservation_id AND b.state='SETTLED'
    AND b.intent_key=${alias}.intent_key AND a.tenant_id=${alias}.tenant_id
    AND left(a.scope_id,length('CODEX_SAMPLE:'||(${alias}.private->>'owner_id')||':'))='CODEX_SAMPLE:'||(${alias}.private->>'owner_id')||':')`
    :`EXISTS(SELECT 1 FROM budget_reservations b WHERE b.tenant_id=${alias}.tenant_id AND b.order_id=${alias}.order_id
      AND b.id=${alias}.reservation_id AND b.submission_id=${alias}.id AND b.state='SETTLED')`;
}
export interface GenerationScopeAdapter {
  readonly column:'sample_id';readonly type:'SAMPLE';readonly stage:'SAMPLE_PRODUCTION';
  context(db:Db,lease:StageLease):Promise<GenerationContext>;
  reserve(db:Db,lease:StageLease,intent:string,contract:ArkContract):Promise<string>;
  settle(db:Db,row:{tenant_id:string;reservation_id:string},actual:number|null,noCharge:boolean):Promise<void>;
  lock(db:Db,tenantId:string,scopeId:string):Promise<void>;
  live(db:Db,tenantId:string,scopeId:string):Promise<boolean>;
}
