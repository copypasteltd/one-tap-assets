import type {Db} from '../../api/db/pool.js';
import {notFound,requireThat} from '../../api/lib/errors.js';
import {lockMediaOwner} from '../../api/modules/media-access.js';
import {executionContext,type ExecutionContext} from '../compiler/order-context.js';
import {assertLease,type StageLease} from '../queue/leases.js';

/** Caller holds a transaction. Follow owner -> order -> stage before checking
 * the exact immutable binding; an in-memory lease cannot choose another order. */
export async function generationContext(db:Db,lease:StageLease):Promise<ExecutionContext>{
  requireThat(lease.scope_type==='ORDER'&&lease.stage_name==='PRODUCTION','GENERATION_SCOPE_INVALID','生成工具只允许原订单制作阶段',403);
  const owner=(await db.query<{owner_id:string}>('SELECT owner_id FROM orders WHERE tenant_id=$1 AND id=$2',[lease.tenant_id,lease.scope_id])).rows[0]??notFound();
  await lockMediaOwner(db,lease.tenant_id,owner.owner_id);await assertLease(db,lease);
  requireThat((await db.query(`SELECT id FROM stage_runs WHERE tenant_id=$1 AND id=$2 AND scope_type='ORDER'
    AND scope_id=$3 AND stage_name='PRODUCTION' AND input_hash=$4 AND deadline_at=$5`,
  [lease.tenant_id,lease.id,lease.scope_id,lease.input_hash,lease.deadline_at])).rowCount===1,
  'GENERATION_SCOPE_INVALID','生成租约与原订单、阶段、输入或截止时间不一致',403);
  const context=await executionContext(db,lease.tenant_id,lease.scope_id,lease.input_hash,lease.id);
  requireThat(context.snapshot.engine!=='PHOTO_LAYOUT','GENERATION_ROUTE_INVALID','原图路线不能购买生成服务',422);
  requireThat(lease.deadline_at.toISOString()===context.snapshot.deadline_at,'GENERATION_SCOPE_INVALID','生成阶段截止与冻结订单不一致',403);
  return context;
}
