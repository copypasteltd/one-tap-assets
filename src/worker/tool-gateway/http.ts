import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import type { Config } from '../../api/config.js';
import type { ObjectStorage } from '../../api/storage/storage.js';
import { transaction, type Db } from '../../api/db/pool.js';
import { insert } from '../../api/db/store.js';
import { id, hash, sha256 } from '../../api/lib/crypto.js';
import { requireThat, notFound } from '../../api/lib/errors.js';
import { object } from '../../shared/domain/json.js';
import { checkTool, toolsForRole, type AgentRole } from './policy.js';
import { sampleContext } from '../samples/context.js';
import { revisionContext } from '../revisions/context.js';

export interface ToolScope {
  capability_id: string; tenant_id: string; run_id: string; instance_id: string; stage_run_id: string;
  order_id: string | null; preview_session_id: string | null; role: AgentRole; snapshot_hash: string;
  packet_hash: string | null; stage_fencing_token: string; instance_fencing_token: string; expires_at: Date;
  scope_type: string; scope_id: string; stage_name: string;
  allowed_tools?: string[] | null;
}
export async function authorizeTool(db: Db, authorization: string | undefined, lock = false): Promise<ToolScope> {
  requireThat(typeof authorization === 'string' && authorization.startsWith('Bearer ') && authorization.length < 300, 'TOOL_UNAUTHORIZED', '缺少运行实例授权', 401);
  return loadToolScope(db, 'token_hash', sha256(authorization.slice(7)), lock);
}
/** Internal worker API. A database ID is never accepted as HTTP authorization. */
export async function toolScopeById(db: Db, capabilityId: string, lock = false): Promise<ToolScope> {
  return loadToolScope(db, 'id', capabilityId, lock);
}
async function loadToolScope(db: Db, field: 'token_hash' | 'id', value: string, lock: boolean): Promise<ToolScope> {
  if (lock) {
    // Termination/delivery lock order before stage/capability changes. Follow
    // the same order for tool commits and paid inference reservations.
    const observed = await loadToolScope(db, field, value, false);
    if(observed.scope_type==='REVISION')await revisionContext(db,observed.tenant_id,observed.scope_id,observed.snapshot_hash,true);
    if (observed.order_id) await db.query('SELECT id FROM orders WHERE tenant_id=$1 AND id=$2 FOR UPDATE', [observed.tenant_id, observed.order_id]);
    if (observed.scope_type === 'SAMPLE') await db.query('SELECT id FROM public_samples WHERE tenant_id=$1 AND id=$2 FOR UPDATE', [observed.tenant_id, observed.scope_id]);
  }
  const result = await db.query<ToolScope>(`SELECT c.id AS capability_id,c.*,i.order_id,i.preview_session_id,r.role,r.private->'allowed_tools' AS allowed_tools,
    s.scope_type,s.scope_id,s.stage_name FROM agent_capabilities c
    JOIN agent_instances i ON i.id=c.instance_id AND i.tenant_id=c.tenant_id
    JOIN agent_runs r ON r.id=c.run_id AND r.tenant_id=c.tenant_id AND r.instance_id=i.id
    JOIN stage_runs s ON s.id=c.stage_run_id AND s.tenant_id=c.tenant_id
    WHERE c.${field}=$1 AND c.revoked_at IS NULL AND c.expires_at>now()
    AND i.state='ACTIVE' AND i.lease_expires_at>now() AND i.fencing_token=c.instance_fencing_token
    AND r.state IN ('LOADING_SKILLS','RUNNING') AND s.state='RUNNING' AND s.deadline_at>now()
    AND s.lease_expires_at>now() AND s.fencing_token=c.stage_fencing_token AND s.input_hash=c.snapshot_hash
    AND ((i.order_id IS NOT NULL AND s.scope_type='ORDER' AND s.scope_id=i.order_id)
      OR (i.preview_session_id IS NOT NULL AND s.scope_type IN ('ANALYSIS','PLAN','PREVIEW','REVISION','SAMPLE') AND s.scope_id=i.preview_session_id))
    AND (r.role=CASE WHEN s.scope_type='SAMPLE' AND s.stage_name='SAMPLE' THEN 'CONTENT'
      WHEN s.scope_type='SAMPLE' AND s.stage_name IN ('SAMPLE_PRODUCTION','SAMPLE_POST','SAMPLE_REVIEW_FACTS','SAMPLE_REVIEW_STYLE') THEN substr(s.stage_name,8)
      WHEN s.scope_type='REVISION' AND s.stage_name='REVISION' THEN 'POST'
      WHEN s.scope_type='REVISION' AND s.stage_name IN ('REVISION_REVIEW_FACTS','REVISION_REVIEW_STYLE') THEN substr(s.stage_name,10)
      WHEN s.stage_name IN ('ANALYZE','PLAN','REPAIR_PLAN') THEN 'CONTENT'
      WHEN s.stage_name IN ('PRODUCTION','POST','REVIEW_FACTS','REVIEW_STYLE') THEN s.stage_name ELSE NULL END
      OR (((s.scope_type='ORDER' AND s.stage_name='PRODUCTION') OR (s.scope_type='SAMPLE' AND s.stage_name='SAMPLE_PRODUCTION')) AND r.role='REVIEW_FACTS'
        AND r.private->'review_input'->>'purpose'='REFERENCE_IDENTITY'
        AND r.private->'review_input'->>'packet_hash'=c.packet_hash
        AND r.private->'allowed_tools'='["extract_review_evidence","persist_stage_result"]'::jsonb))
    ${lock ? ' FOR UPDATE OF c' : ''}`, [value]);
  requireThat(result.rows[0], 'TOOL_CAPABILITY_REVOKED', '运行实例授权已过期、已撤销或代次不匹配', 401);
  const scope = result.rows[0];
  if (scope.order_id) requireThat((await db.query(`SELECT id FROM orders WHERE id=$1 AND tenant_id=$2 AND payment_state='CONFIRMED'
    AND fulfillment_state IN ('QUEUED','IN_PROGRESS') AND deadline_at>now() AND NOT (private ? 'media_revoked')`, [scope.order_id, scope.tenant_id])).rowCount === 1, 'TOOL_SCOPE_ENDED', '该订单已停止执行', 409);
  if (scope.scope_type === 'SAMPLE') await sampleContext(db, scope.tenant_id, scope.scope_id, scope.snapshot_hash);
  if(scope.scope_type==='REVISION')await revisionContext(db,scope.tenant_id,scope.scope_id,scope.snapshot_hash);
  return scope;
}
export function checkScopedTool(scope: ToolScope, name: string, args: unknown): Record<string, unknown> {
  requireThat(!scope.allowed_tools || scope.allowed_tools.includes(name), 'TOOL_FORBIDDEN', '当前运行未装载此工具', 403);
  return checkTool(scope.role, name, args);
}
export async function registerToolGateway(app: FastifyInstance, _cfg: Config, pool: pg.Pool, _storage: ObjectStorage): Promise<void> {
  app.get('/v1/internal/p01/agent-tools', async (request, reply) => {
    const scope = await authorizeTool(pool, request.headers.authorization);
    return reply.send({ tools: toolsForRole(scope.role).filter(t => !scope.allowed_tools || scope.allowed_tools.includes(t.name)), deadline_at: scope.expires_at.toISOString() });
  });
  app.post('/v1/internal/p01/agent-tools/calls', { bodyLimit: 256000 }, async (request, reply) => {
    const body = object(request.body);
    requireThat(Object.keys(body).every(k => ['tool', 'arguments', 'idempotency_key'].includes(k)) && typeof body.tool === 'string'
      && typeof body.idempotency_key === 'string' && /^[A-Za-z0-9._:-]{8,128}$/.test(body.idempotency_key), 'TOOL_REQUEST_INVALID', '工具调用格式无效', 400);
    const result = await transaction(pool, async db => {
      const scope = await authorizeTool(db, request.headers.authorization, true);
      const args = checkScopedTool(scope, body.tool as string, body.arguments);
      if ('snapshot_hash' in args) requireThat(args.snapshot_hash === scope.snapshot_hash, 'TOOL_SNAPSHOT_MISMATCH', '工具请求与冻结快照不匹配', 409);
      if ('packet_hash' in args) requireThat(args.packet_hash === scope.packet_hash, 'TOOL_PACKET_MISMATCH', '复核请求与封存材料不匹配', 409);
      const key = `${scope.run_id}:${body.idempotency_key as string}`; const requestHash = hash({ tool: body.tool, arguments: args });
      await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [key]);
      const old = (await db.query<{ id: string; request_hash: string; state: string }>('SELECT id,request_hash,state FROM agent_tool_intents WHERE idempotency_key=$1 AND tenant_id=$2 AND run_id=$3', [key, scope.tenant_id, scope.run_id])).rows[0];
      if (old) { requireThat(old.request_hash === requestHash, 'TOOL_IDEMPOTENCY_CONFLICT', '工具幂等标识已用于不同参数', 409); return { intent_id: old.id, state: old.state }; }
      const binding = (await db.query<{ private: { max_tool_calls?: number; max_scope_tool_calls?: number } }>('SELECT private FROM agent_runs WHERE id=$1 AND tenant_id=$2 FOR UPDATE', [scope.run_id, scope.tenant_id])).rows[0];
      const count = (await db.query<{ n: string }>('SELECT count(*) AS n FROM agent_tool_intents WHERE run_id=$1 AND tenant_id=$2', [scope.run_id, scope.tenant_id])).rows[0]!;
      requireThat(Number(count.n) < (binding?.private.max_tool_calls ?? 32), 'TOOL_LIMIT_EXCEEDED', '该运行已达到工具调用次数上限', 422);
      if ((scope.order_id || ['SAMPLE','REVISION'].includes(scope.scope_type)) && binding?.private.max_scope_tool_calls !== undefined) {
        const scopeCount = scope.scope_type==='REVISION'?(await db.query<{n:string}>(`SELECT count(*) AS n FROM agent_tool_intents t
          JOIN revision_requests r ON r.tenant_id=t.tenant_id AND r.id=t.preview_session_id
          WHERE t.tenant_id=$1 AND r.order_id=(SELECT order_id FROM revision_requests WHERE tenant_id=$1 AND id=$2)`,[scope.tenant_id,scope.scope_id])).rows[0]!:
          (await db.query<{ n: string }>(`SELECT count(*) AS n FROM agent_tool_intents WHERE tenant_id=$1
          AND (($3::boolean AND order_id=$2) OR (NOT $3::boolean AND preview_session_id=$2))`, [scope.tenant_id, scope.order_id ?? scope.scope_id, Boolean(scope.order_id)])).rows[0]!;
        requireThat(Number(scopeCount.n) < binding.private.max_scope_tool_calls, 'TOOL_SCOPE_LIMIT_EXCEEDED', '整单已达到原合同工具调用上限', 422);
      }
      const intentId = id('tool');
      await insert(db, 'agent_tool_intents', { id: intentId, tenant_id: scope.tenant_id, order_id: scope.order_id,
        preview_session_id: scope.preview_session_id, subject_ref: scope.run_id, run_id: scope.run_id, stage_run_id: scope.stage_run_id,
        tool_name: body.tool, idempotency_key: key, request_hash: requestHash, state: 'QUEUED',
        data: { tool: body.tool, arguments: args }, private: { capability_id: scope.capability_id, snapshot_hash: scope.snapshot_hash,
          packet_hash: scope.packet_hash, stage_fencing_token: scope.stage_fencing_token, instance_fencing_token: scope.instance_fencing_token } });
      return { intent_id: intentId, state: 'QUEUED' };
    });
    return reply.code(202).send(result);
  });
  app.get<{ Params: { intent_id: string } }>('/v1/internal/p01/agent-tools/calls/:intent_id', async (request, reply) => {
    const scope = await authorizeTool(pool, request.headers.authorization);
    const row = (await pool.query<{ id: string; state: string; data: Record<string, unknown> }>('SELECT id,state,data FROM agent_tool_intents WHERE id=$1 AND tenant_id=$2 AND run_id=$3', [request.params.intent_id, scope.tenant_id, scope.run_id])).rows[0] ?? notFound();
    return reply.send({ intent_id: row.id, state: row.state, result: row.data.result ?? null, error_code: row.data.error_code ?? null });
  });
}
