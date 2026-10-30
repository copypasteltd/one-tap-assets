import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import type {Db} from '../db/pool.js';
import type {DTO} from '../../shared/contracts/types.js';
import {managementDocument} from '../lib/validation.js';
import {requireThat} from '../lib/errors.js';

export interface MetricsWindow {window_start:string;window_end:string}
const parameters=managementDocument.paths['/metrics/summary']!.get!.parameters as {name?:string;schema?:object}[];
const ajv=new Ajv2020({strict:false,validateFormats:true});addFormats(ajv);
const validWindow=ajv.compile<MetricsWindow>({type:'object',required:['window_start','window_end'],additionalProperties:false,
  properties:Object.fromEntries(['window_start','window_end'].map(name=>[name,parameters.find(p=>p.name===name)!.schema]))});
export function metricsWindow(query:{window_start?:unknown;window_end?:unknown}):MetricsWindow {
  const value={window_start:query.window_start,window_end:query.window_end};
  requireThat(validWindow(value),'METRICS_WINDOW_INVALID','请选择完整、有效的起止时间',400);
  const width=Date.parse(value.window_end)-Date.parse(value.window_start);
  requireThat(Number.isFinite(width)&&width>=1&&width<=90*86400000,'METRICS_WINDOW_INVALID','结束时间须晚于开始时间，单次最多查询90天',400);
  return value;
}
function count(value:string,maximum=2147483647):number {
  const n=BigInt(value);requireThat(n>=0n&&n<=BigInt(maximum),'METRICS_RANGE_EXCEEDED','统计值超过当前展示范围，请缩小时间窗口',503);return Number(n);
}
/** One database statement gives every measure the same read snapshot. Windows
 * are half open. Counts are current states of records created in that window,
 * not a reconstructed historical state or a claim of real-provider quality. */
export async function operationalSummary(db:Db,query:{window_start?:unknown;window_end?:unknown}):Promise<DTO<'MetricsSummary'>> {
  const window=metricsWindow(query);
  const result=await db.query<{paid:string;delivered:string;spent:string;unknown:string;refunds:string;deadline:string;routes:{engine:string;p95:string}[]}>(`
    WITH cohort AS MATERIALIZED (
      SELECT id,tenant_id,payment_state,fulfillment_state,spent_micro FROM orders WHERE created_at >= $1::timestamptz AND created_at < $2::timestamptz
    ), first_delivery AS (
      SELECT c.id,c.tenant_id,m.delivered_at,s.data->>'engine' AS engine,
        CASE WHEN pg_input_is_valid(s.data->>'fulfillable_at','timestamp with time zone')
          THEN (s.data->>'fulfillable_at')::timestamptz END AS fulfillable_at
      FROM cohort c JOIN delivery_manifests m ON m.tenant_id=c.tenant_id AND m.order_id=c.id AND m.revision=1
      LEFT JOIN execution_snapshots s ON s.tenant_id=c.tenant_id AND s.order_id=c.id
      WHERE c.payment_state='CONFIRMED' AND c.fulfillment_state='DELIVERED'
    ), route AS (
      SELECT engine,ceil(percentile_cont(.95) WITHIN GROUP(ORDER BY extract(epoch FROM delivered_at-fulfillable_at)))::bigint::text AS p95
      FROM first_delivery WHERE engine IN ('PHOTO_LAYOUT','PER_SHOT_AI','REFERENCE_FILM') AND fulfillable_at IS NOT NULL AND delivered_at>=fulfillable_at GROUP BY engine
    )
    SELECT (SELECT count(*)::text FROM cohort WHERE payment_state='CONFIRMED') AS paid,
      (SELECT count(*)::text FROM first_delivery) AS delivered,
      (SELECT coalesce(sum(spent_micro),0)::text FROM cohort) AS spent,
      (SELECT count(*)::text FROM provider_submissions WHERE state='UNKNOWN' AND created_at >= $1 AND created_at < $2) AS unknown,
      (SELECT count(*)::text FROM refunds WHERE state IN ('REQUESTED','PROCESSING','UNKNOWN') AND created_at >= $1 AND created_at < $2) AS refunds,
      (SELECT count(DISTINCT (tenant_id,scope_type,scope_id))::text FROM stage_runs WHERE state='FAILED' AND data->>'reason_code'='HARD_DEADLINE_EXCEEDED'
        AND created_at >= $1 AND created_at < $2) AS deadline,
      (SELECT coalesce(jsonb_agg(jsonb_build_object('engine',engine,'p95',p95)),'[]'::jsonb) FROM route) AS routes`,[window.window_start,window.window_end]);
  const row=result.rows[0]!,paid=count(row.paid),delivered=count(row.delivered);
  requireThat(delivered<=paid,'METRICS_INCONSISTENT','交付与付款记录不一致，请核对原记录',503);
  const p95=(engine:string)=>{const value=row.routes.find(r=>r.engine===engine);return value?count(value.p95):null;};
  return {...window,paid_orders:paid,delivered_orders:delivered,unknown_submissions:count(row.unknown),refunds_pending:count(row.refunds),
    hard_deadline_failures:count(row.deadline),cost_currency:'CNY',cost_micro_total:count(row.spent,Number.MAX_SAFE_INTEGER),
    automatic_pack_success_ratio:paid?delivered/paid:null,
    route_p95_seconds:{PHOTO_LAYOUT:p95('PHOTO_LAYOUT'),PER_SHOT_AI:p95('PER_SHOT_AI'),REFERENCE_FILM:p95('REFERENCE_FILM')}};
}
