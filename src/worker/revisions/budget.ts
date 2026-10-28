import type {Db} from '../../api/db/pool.js';
import {hash,id} from '../../api/lib/crypto.js';
import {requireThat,notFound} from '../../api/lib/errors.js';

export async function reserveRevisionCost(db:Db,tenantId:string,revisionId:string,intentKey:string,amount:number,rate:unknown):Promise<string> {
  requireThat(Number.isSafeInteger(amount) && amount>0,'COST_INVALID','受限修改成本预留无效',500);
  await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`revision-cost:${intentKey}`]);
  const old=(await db.query<{id:string;tenant_id:string;revision_id:string;amount_micro:string;rate_snapshot:unknown}>(
    'SELECT * FROM revision_cost_reservations WHERE intent_key=$1',[intentKey])).rows[0];
  if(old){requireThat(old.tenant_id===tenantId && old.revision_id===revisionId && Number(old.amount_micro)===amount && hash(old.rate_snapshot)===hash(rate),
    'COST_INTENT_CONFLICT','原受限修改成本意图不能变更',409);return old.id;}
  const account=(await db.query<{id:string}>(`UPDATE revision_budgets b SET reserved_micro=b.reserved_micro+$3 FROM revision_requests r,orders o
    WHERE r.tenant_id=$1 AND r.id=$2 AND r.state IN ('REQUESTED','PROCESSING') AND r.deadline_at>clock_timestamp()
    AND b.tenant_id=r.tenant_id AND b.order_id=r.order_id AND b.owner_id=r.owner_id
    AND b.policy_hash=r.private->'input'->>'policy_hash' AND b.spent_micro+b.reserved_micro+$3<=b.ceiling_micro
    AND o.tenant_id=r.tenant_id AND o.id=r.order_id AND o.owner_id=r.owner_id AND o.payment_state='CONFIRMED' AND o.fulfillment_state='DELIVERED'
    AND NOT(o.private ? 'media_revoked') AND (o.data->>'delivery_expires_at')::timestamptz>clock_timestamp()
    RETURNING b.id`,[tenantId,revisionId,amount])).rows[0];
  requireThat(account,'REVISION_BUDGET_OR_DEADLINE_EXCEEDED','受限修改的原预算、授权或截止已达到限制',422);
  const reservationId=id('revision-cost');
  await db.query(`INSERT INTO revision_cost_reservations(id,tenant_id,budget_id,revision_id,intent_key,amount_micro,state,rate_snapshot)
    VALUES($1,$2,$3,$4,$5,$6,'RESERVED',$7::jsonb)`,[reservationId,tenantId,account.id,revisionId,intentKey,amount,JSON.stringify(rate)]);return reservationId;
}
export async function settleRevisionCost(db:Db,tenantId:string,reservationId:string,actual:number|null,knownNoCharge=false):Promise<void> {
  const row=(await db.query<{state:string;amount_micro:string;budget_id:string}>('SELECT * FROM revision_cost_reservations WHERE tenant_id=$1 AND id=$2 FOR UPDATE',[tenantId,reservationId])).rows[0] ?? notFound();
  if(['SETTLED','RELEASED'].includes(row.state))return;
  if(actual===null && !knownNoCharge){await db.query("UPDATE revision_cost_reservations SET state='UNKNOWN' WHERE tenant_id=$1 AND id=$2",[tenantId,reservationId]);return;}
  const cost=knownNoCharge?0:actual!;
  requireThat(Number.isSafeInteger(cost) && cost>=0 && cost<=Number(row.amount_micro),'COST_RECEIPT_INVALID','受限修改实际费用超出原预留',422);
  await db.query('UPDATE revision_budgets SET reserved_micro=reserved_micro-$3,spent_micro=spent_micro+$4 WHERE tenant_id=$1 AND id=$2',[tenantId,row.budget_id,row.amount_micro,cost]);
  await db.query('UPDATE revision_cost_reservations SET state=$3,settled_micro=$4 WHERE tenant_id=$1 AND id=$2',[tenantId,reservationId,knownNoCharge?'RELEASED':'SETTLED',cost]);
}
