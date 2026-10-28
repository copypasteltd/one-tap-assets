import type { Db } from '../../api/db/pool.js';
import { id } from '../../api/lib/crypto.js';
import { requireThat } from '../../api/lib/errors.js';

const TABLES = new Set(['product_drafts','assets','product_photo_versions','profile_versions','identity_locks','correction_versions',
  'analysis_jobs','analysis_attempts','plan_versions','scene_locks','shot_plans','reference_frame_sets','optional_previews','quotes','orders',
  'execution_snapshots','render_jobs','stage_runs','provider_submissions','agent_instances','agent_runs','agent_tool_intents','inference_requests',
  'media_operations','artifacts','qc_decisions','review_packets','review_reports','review_evidence','delivery_manifests','revision_requests','support_tickets','public_samples']);
export interface RedactionScope { tenantId: string; ownerId: string; productIds: string[]; orderIds: string[]; assetIds: string[] }
export interface RedactionEvidence { state: 'BLOCKED' | 'PENDING' | 'REDACTED'; redacted_rows: number; remaining_rows: number; blockers: string[] }
/** The caller holds the media-owner lock and transaction. Only revoked, settled,
 * physically erased scopes may lose their recovery payloads. Financial columns,
 * original immutable hashes and identifiers are retained. */
export async function redactPrivateContent(db: Db, scope: RedactionScope, objectsPending: boolean): Promise<RedactionEvidence> {
  const args = [scope.tenantId, scope.ownerId, scope.productIds, scope.orderIds, scope.assetIds];
  const targets = `s.tenant_id=$1 AND s.owner_id=$2 AND (s.product_id=ANY($3::text[]) OR s.order_id=ANY($4::text[]) OR s.asset_id=ANY($5::text[]))`;
  const countRows = async (): Promise<{ remaining: number; redacted: number }> => {
    const count = (await db.query<{ remaining: string; redacted: string }>(`SELECT count(*) FILTER(WHERE r.id IS NULL) AS remaining,count(*) FILTER(WHERE r.id IS NOT NULL) AS redacted
      FROM privacy_content_scope s LEFT JOIN privacy_redactions r ON r.tenant_id=s.tenant_id AND r.target_table=s.table_name AND r.target_id=s.id WHERE ${targets}`, args)).rows[0]!;
    return { remaining: Number(count.remaining), redacted: Number(count.redacted) };
  };
  const blockers: string[] = objectsPending ? ['CONTROLLED_OBJECTS_PENDING'] : [];
  const checks = (await db.query<{ code: string }>(`WITH targets AS (SELECT s.table_name,s.id FROM privacy_content_scope s WHERE ${targets})
    SELECT 'INPUT_NOT_REVOKED' AS code WHERE EXISTS (SELECT 1 FROM product_drafts WHERE tenant_id=$1 AND id=ANY($3::text[]) AND deleted_at IS NULL)
    UNION ALL SELECT 'ORDER_NOT_REVOKED' WHERE EXISTS (SELECT 1 FROM orders WHERE tenant_id=$1 AND id=ANY($4::text[]) AND private->>'media_revoked' IS DISTINCT FROM 'true')
    UNION ALL SELECT 'INSTANCE_RELEASE_PENDING' WHERE EXISTS (SELECT 1 FROM agent_instances i JOIN targets t ON t.table_name='agent_instances' AND t.id=i.id WHERE i.state<>'RELEASED')
    UNION ALL SELECT 'TOOL_OUTCOME_PENDING' WHERE EXISTS (SELECT 1 FROM agent_tool_intents i JOIN targets t ON t.table_name='agent_tool_intents' AND t.id=i.id WHERE i.state IN ('QUEUED','RUNNING','UNKNOWN'))
    UNION ALL SELECT 'STAGE_TERMINATION_PENDING' WHERE EXISTS (SELECT 1 FROM stage_runs r JOIN targets t ON t.table_name='stage_runs' AND t.id=r.id WHERE r.state IN ('READY','CLAIMED','RUNNING','UNKNOWN'))
    UNION ALL SELECT 'INFERENCE_BILLING_PENDING' WHERE EXISTS (SELECT 1 FROM inference_requests i JOIN targets t ON t.table_name='inference_requests' AND t.id=i.id WHERE i.state IN ('SUBMITTING','UNKNOWN') OR i.actual_micro IS NULL)
    UNION ALL SELECT 'PROVIDER_BILLING_PENDING' WHERE EXISTS (SELECT 1 FROM provider_submissions p JOIN targets t ON t.table_name='provider_submissions' AND t.id=p.id
      LEFT JOIN platform_budget_reservations b ON b.tenant_id=p.tenant_id AND b.id=p.reservation_id
      WHERE p.state NOT IN ('SUCCEEDED','FAILED') OR b.state IN ('RESERVED','UNKNOWN'))
    UNION ALL SELECT 'ORDER_BUDGET_PENDING' WHERE EXISTS (SELECT 1 FROM budget_reservations WHERE tenant_id=$1 AND order_id=ANY($4::text[]) AND state IN ('RESERVED','UNKNOWN'))
    UNION ALL SELECT 'REVISION_BUDGET_PENDING' WHERE EXISTS (SELECT 1 FROM revision_cost_reservations r JOIN revision_budgets b ON b.tenant_id=r.tenant_id AND b.id=r.budget_id
      WHERE b.tenant_id=$1 AND b.order_id=ANY($4::text[]) AND r.state IN ('RESERVED','UNKNOWN'))
    UNION ALL SELECT 'INFERENCE_BUDGET_PENDING' WHERE EXISTS (SELECT 1 FROM inference_requests i JOIN targets t ON t.table_name='inference_requests' AND t.id=i.id
      JOIN platform_budget_reservations b ON b.tenant_id=i.tenant_id AND b.id=i.private->>'reservation_id' WHERE b.state IN ('RESERVED','UNKNOWN'))
    UNION ALL SELECT 'CAPABILITY_REVOCATION_PENDING' WHERE EXISTS (SELECT 1 FROM agent_capabilities c JOIN targets t ON t.table_name='agent_runs' AND t.id=c.run_id WHERE c.revoked_at IS NULL)`, args)).rows;
  blockers.push(...checks.map(c => c.code));
  if (blockers.length) { const count = await countRows(); return { state: 'BLOCKED', redacted_rows: count.redacted, remaining_rows: count.remaining, blockers }; }
  // SQL JSON timestamps must be represented identically for the receipt and the
  // enforcing trigger. Never round-trip whole rows through JS number parsing.
  await db.query("SET LOCAL TIME ZONE 'UTC'");
  const rows = (await db.query<{ table_name: string; id: string; marker_id: string; fields: string[] }>(`SELECT s.table_name,s.id,m.id AS marker_id,ypcc_privacy_fields(s.table_name) AS fields
    FROM privacy_content_scope s JOIN LATERAL (SELECT id FROM deletion_markers m WHERE m.tenant_id=s.tenant_id AND m.owner_id=s.owner_id
      AND ((m.target_type='PRODUCT' AND m.target_id=s.product_id) OR (m.target_type='ORDER' AND m.target_id=s.order_id) OR (m.target_type='ASSET' AND m.target_id=s.asset_id)) ORDER BY id LIMIT 1) m ON true
    WHERE ${targets} AND NOT EXISTS (SELECT 1 FROM privacy_redactions r WHERE r.tenant_id=s.tenant_id AND r.target_table=s.table_name AND r.target_id=s.id)
    ORDER BY s.table_name,s.id LIMIT 500`, args)).rows;
  for (const row of rows) {
    requireThat(TABLES.has(row.table_name) && row.fields.length > 0 && row.fields.every(f => ['data','private','spec_json'].includes(f)),
      'REDACTION_POLICY_INVALID', '私有内容脱敏策略无效', 503);
    const table = row.table_name;
    await db.query(`SELECT id FROM ${table} WHERE tenant_id=$1 AND id=$2 FOR UPDATE`, [scope.tenantId, row.id]);
    await db.query(`INSERT INTO privacy_redactions(id,tenant_id,owner_id,target_table,target_id,marker_id,before_sha256,after_sha256,field_names)
      SELECT $1,$2,$3,$4,t.id,$6,ypcc_privacy_digest(to_jsonb(t)),ypcc_privacy_digest(ypcc_privacy_projection($4,to_jsonb(t))),ypcc_privacy_fields($4)
      FROM ${table} t WHERE t.tenant_id=$2 AND t.id=$5`, [id('redaction'), scope.tenantId, scope.ownerId, table, row.id, row.marker_id]);
    const result = await db.query(`UPDATE ${table} t SET ${row.fields.map(f => `${f}=ypcc_privacy_projection($3,to_jsonb(t))->'${f}'`).join(',')}
      WHERE t.tenant_id=$1 AND t.id=$2`, [scope.tenantId, row.id, table]);
    requireThat(result.rowCount === 1, 'REDACTION_TARGET_CHANGED', '私有内容脱敏目标已变更', 409);
  }
  const count = await countRows();
  return { state: count.remaining ? 'PENDING' : 'REDACTED', redacted_rows: count.redacted, remaining_rows: count.remaining, blockers: [] };
}
