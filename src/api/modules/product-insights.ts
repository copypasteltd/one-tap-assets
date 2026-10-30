import type {Db} from '../db/pool.js';
import type {DTO} from '../../shared/contracts/types.js';
import {requireThat,notFound} from '../lib/errors.js';
import {metricsWindow} from './metrics.js';

export async function trafficClassification(db:Db,tenantId:string,userId:string,request?:DTO<'TrafficClassificationRequest'>):Promise<DTO<'TrafficClassification'>>{
  requireThat([tenantId,userId].every(v=>/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(v)),'RESOURCE_ID_INVALID','账户标识无效',400);
  if(!(await db.query('SELECT id FROM users WHERE tenant_id=$1 AND id=$2',[tenantId,userId])).rowCount)notFound();
  if(request)await db.query(`INSERT INTO metrics_traffic_classifications(tenant_id,owner_id,traffic_group) VALUES($1,$2,$3)
    ON CONFLICT(tenant_id,owner_id) DO UPDATE SET traffic_group=EXCLUDED.traffic_group,updated_at=now()`,[tenantId,userId,request.traffic_group]);
  const row=(await db.query<{traffic_group:DTO<'TrafficGroup'>;updated_at:Date}>('SELECT traffic_group,updated_at FROM metrics_traffic_classifications WHERE tenant_id=$1 AND owner_id=$2',[tenantId,userId])).rows[0];
  return {traffic_group:row?.traffic_group??'UNCLASSIFIED',updated_at:row?.updated_at.toISOString()??null};
}
function amount(value:string,micro=false):number{
  const n=BigInt(value);requireThat(n>=0n&&n<=BigInt(micro?Number.MAX_SAFE_INTEGER:2147483647),'METRICS_RANGE_EXCEEDED','统计值超过展示范围，请缩小时间窗口',503);return Number(n);
}
/** A single snapshot of durable source records. Classification is the current
 * operator marking, never proof of real customers, quality or actual posting. */
export async function productInsights(db:Db,query:{window_start?:unknown;window_end?:unknown;traffic_group?:unknown}):Promise<DTO<'ProductInsights'>>{
  const window=metricsWindow(query),group=query.traffic_group??'ALL';
  requireThat(typeof group==='string'&&['ALL','UNCLASSIFIED','INTERNAL_TEST','EXTERNAL'].includes(group),'METRICS_GROUP_INVALID','请选择有效流量分组',400);
  const result=await db.query<{data:Record<string,Record<string,string>>}>(`
    WITH people AS MATERIALIZED (
      SELECT u.tenant_id,u.id FROM users u LEFT JOIN metrics_traffic_classifications c ON c.tenant_id=u.tenant_id AND c.owner_id=u.id
      WHERE $3='ALL' OR coalesce(c.traffic_group,'UNCLASSIFIED')=$3
    ), jobs AS MATERIALIZED (
      SELECT a.* FROM analysis_jobs a JOIN people u ON u.tenant_id=a.tenant_id AND u.id=a.owner_id WHERE a.created_at >= $1::timestamptz AND a.created_at < $2::timestamptz
    ), profiles AS MATERIALIZED (
      SELECT p.* FROM jobs a JOIN profile_versions p ON p.tenant_id=a.tenant_id AND p.id=a.data->>'profile_id'
      AND p.owner_id=a.owner_id AND p.product_id=a.product_id AND p.private->>'analysis_id'=a.id WHERE a.state='READY'
    ), fields AS (
      SELECT p.id,x.value->>'status' AS status,'observation' AS kind FROM profiles p CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(p.data->'observations')='array' THEN p.data->'observations' ELSE '[]' END) x
      UNION ALL SELECT p.id,x.value->>'status','label' FROM profiles p CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(p.data->'label_texts')='array' THEN p.data->'label_texts' ELSE '[]' END) x
      UNION ALL SELECT p.id,NULL,'hypothesis' FROM profiles p CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(p.data->'hypotheses')='array' THEN p.data->'hypotheses' ELSE '[]' END) x
      UNION ALL SELECT p.id,NULL,'unknown' FROM profiles p CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(p.data->'unknowns')='array' THEN p.data->'unknowns' ELSE '[]' END) x
    ), cohort AS MATERIALIZED (
      SELECT o.* FROM orders o JOIN people u ON u.tenant_id=o.tenant_id AND u.id=o.owner_id WHERE o.created_at >= $1 AND o.created_at < $2
    ), delivered AS MATERIALIZED (
      SELECT o.* FROM cohort o WHERE o.payment_state='CONFIRMED' AND o.fulfillment_state='DELIVERED'
        AND EXISTS(SELECT 1 FROM delivery_manifests m WHERE m.tenant_id=o.tenant_id AND m.order_id=o.id AND m.revision=1)
    ), saved AS MATERIALIZED (
      SELECT s.tenant_id,s.owner_id,s.order_id,r.deliverable_id,min(r.received_at) AS received_at
      FROM save_receipts r JOIN save_sessions s ON s.tenant_id=r.tenant_id AND s.id=r.save_session_id
      JOIN people u ON u.tenant_id=s.tenant_id AND u.id=s.owner_id WHERE r.state='SAVED'
      GROUP BY s.tenant_id,s.owner_id,s.order_id,r.deliverable_id
    ), feedback AS (
      SELECT f.* FROM order_usage_feedback f JOIN people u ON u.tenant_id=f.tenant_id AND u.id=f.owner_id WHERE f.updated_at >= $1 AND f.updated_at < $2
    ), published AS MATERIALIZED (
      SELECT p.* FROM publications p JOIN preset_versions v ON v.id=p.published_version_id JOIN presets t ON t.id=v.preset_id
      WHERE p.review_state='PUBLISHED' AND p.data->>'public_sample_state'='PUBLISHED' AND t.visibility='PUBLIC' AND t.source='COMMUNITY'
    ), reservations AS MATERIALIZED (
      SELECT r.* FROM platform_budget_reservations r JOIN platform_cost_accounts a ON a.tenant_id=r.tenant_id AND a.id=r.account_id
      WHERE r.created_at >= $1 AND r.created_at < $2 AND
        (EXISTS(SELECT 1 FROM people u WHERE u.tenant_id=a.tenant_id AND u.id=a.owner_id) OR (a.owner_id IS NULL AND $3 IN ('ALL','UNCLASSIFIED')))
    )
    SELECT jsonb_build_object(
      'recognition',jsonb_build_object(
        'jobs',(SELECT count(*)::text FROM jobs),'ready_jobs',(SELECT count(*)::text FROM jobs WHERE state='READY'),
        'blocked_jobs',(SELECT count(*)::text FROM jobs WHERE state IN ('BLOCKED','NEEDS_PHOTOS')),'failed_jobs',(SELECT count(*)::text FROM jobs WHERE state='FAILED'),
        'attempts',(SELECT count(*)::text FROM analysis_attempts t JOIN jobs a ON a.tenant_id=t.tenant_id AND a.id=t.analysis_id),
        'machine_profiles',(SELECT count(*)::text FROM profiles),'profiles_with_observed_fields',(SELECT count(DISTINCT id)::text FROM fields WHERE kind='observation' AND status='OBSERVED'),
        'observed_fields',(SELECT count(*)::text FROM fields WHERE kind='observation' AND status='OBSERVED'),
        'ocr_fields',(SELECT count(*)::text FROM fields WHERE kind='label' AND status='OCR'),
        'hypothesis_fields',(SELECT count(*)::text FROM fields WHERE kind='hypothesis'),
        'unknown_fields',(SELECT count(*)::text FROM fields WHERE kind='unknown'),
        'conflicted_fields',(SELECT count(*)::text FROM fields WHERE status='CONFLICTED')),
      'funnel',jsonb_build_object(
        'selected_product_presets',(SELECT count(DISTINCT (p.tenant_id,p.owner_id,p.product_id,v.preset_version_id))::text FROM plan_versions p
          JOIN people u ON u.tenant_id=p.tenant_id AND u.id=p.owner_id JOIN execution_variants v ON v.id=p.variant_version_id WHERE p.created_at >= $1 AND p.created_at < $2),
        'paid_orders',(SELECT count(*)::text FROM cohort WHERE payment_state='CONFIRMED'),
        'paid_buyers',(SELECT count(DISTINCT (tenant_id,owner_id))::text FROM cohort WHERE payment_state='CONFIRMED'),
        'first_deliveries',(SELECT count(*)::text FROM delivered)),
      'album',jsonb_build_object('saved_files',(SELECT count(*)::text FROM saved WHERE received_at >= $1 AND received_at < $2),
        'saved_orders',(SELECT count(DISTINCT (tenant_id,order_id))::text FROM saved WHERE received_at >= $1 AND received_at < $2),
        'unwindowed_receipts',(SELECT count(*)::text FROM saved WHERE received_at IS NULL)),
      'feedback',jsonb_build_object('planned_use',(SELECT count(*)::text FROM feedback WHERE choice='PLANNED_USE'),
        'used',(SELECT count(*)::text FROM feedback WHERE choice='USED'),'needs_adjustment',(SELECT count(*)::text FROM feedback WHERE choice='NEEDS_ADJUSTMENT'),
        'withdrawn',(SELECT count(*)::text FROM feedback WHERE choice IS NULL)),
      'community',jsonb_build_object('published_versions',(SELECT count(DISTINCT p.published_version_id)::text FROM published p
          JOIN people u ON u.tenant_id=p.tenant_id AND u.id=p.owner_id WHERE p.created_at >= $1 AND p.created_at < $2),
        'effective_reuses',(SELECT count(DISTINCT (o.tenant_id,o.owner_id,p.product_id,v.preset_version_id))::text FROM delivered o
          JOIN quotes q ON q.tenant_id=o.tenant_id AND q.id=o.quote_id JOIN plan_versions p ON p.tenant_id=q.tenant_id AND p.id=q.plan_id
          JOIN execution_variants v ON v.id=p.variant_version_id JOIN published pub ON pub.published_version_id=v.preset_version_id WHERE pub.owner_id<>o.owner_id)),
      'costs',jsonb_build_object('order_settled_micro',(SELECT coalesce(sum(spent_micro),0)::text FROM cohort),
        'platform_settled_micro',(SELECT coalesce(sum(settled_micro),0)::text FROM reservations WHERE state='SETTLED'),
        'platform_unresolved_reservations',(SELECT count(*)::text FROM reservations WHERE state IN ('RESERVED','UNKNOWN')),
        'platform_unclassified_reservations',(SELECT count(*)::text FROM reservations r JOIN platform_cost_accounts a ON a.id=r.account_id AND a.tenant_id=r.tenant_id WHERE a.owner_id IS NULL))
    ) AS data`,[window.window_start,window.window_end,group]);
  const raw=result.rows[0]!.data;
  const part=(name:string)=>Object.fromEntries(Object.entries(raw[name]!).map(([key,value])=>[key,amount(value,key.endsWith('_micro'))]));
  const recognition=part('recognition') as Omit<DTO<'ProductInsights'>['recognition'],'accuracy'|'evidenced_field_share'>;
  const total=recognition.observed_fields+recognition.ocr_fields+recognition.hypothesis_fields+recognition.unknown_fields+recognition.conflicted_fields;
  return {...window,traffic_group:group as DTO<'ProductInsights'>['traffic_group'],
    recognition:{...recognition,evidenced_field_share:total?(recognition.observed_fields+recognition.ocr_fields)/total:null,accuracy:null},
    funnel:{...part('funnel'),recommendation_impressions:null,recommendation_clicks:null,automatic_success_ratio:null} as DTO<'ProductInsights'>['funnel'],
    album:part('album') as DTO<'ProductInsights'>['album'],feedback:part('feedback') as DTO<'ProductInsights'>['feedback'],community:part('community') as DTO<'ProductInsights'>['community'],
    costs:{...part('costs'),currency:'CNY',review_support_micro:null,complete_cost_micro:null} as DTO<'ProductInsights'>['costs']};
}
