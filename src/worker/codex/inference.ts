import type pg from 'pg';
import { writePrivateObject, inferenceObjectScope } from '../../api/storage/private-objects.js';
import { isUtf8 } from 'node:buffer';
import type { FastifyInstance } from 'fastify';
import type { Config } from '../../api/config.js';
import type { ObjectStorage } from '../../api/storage/storage.js';
import { transaction, type Db } from '../../api/db/pool.js';
import { insert } from '../../api/db/store.js';
import { AppError, requireThat, notFound } from '../../api/lib/errors.js';
import { hash, id, sha256 } from '../../api/lib/crypto.js';
import { safeHttp, type HttpResponse } from '../../api/lib/http.js';
import { object } from '../../shared/domain/json.js';
import { reservePlatform, settlePlatform } from '../budget/platform.js';
import { reserveStageCost, settle } from '../budget/reservations.js';
import { authorizeTool, type ToolScope } from '../tool-gateway/http.js';
import { toolsForRole } from '../tool-gateway/policy.js';
import { admissionHash, checkAdmission, inferenceCost, type CodexAdmission } from './admission.js';
import { authorizeReviewImages } from './review-images.js';
import {reserveRevisionCost,settleRevisionCost} from '../revisions/budget.js';
import {scopeReviewListening} from '../review/listening.js';
import type { StageLease } from '../queue/leases.js';

export interface InferenceLimits {
  max_requests: number; max_input_tokens: number; max_output_tokens: number;
  ceiling_micro: number; daily_ceiling_micro: number; owner_id: string;
  max_requests_per_role?: number;
}
interface Binding { admission: CodexAdmission; limits: InferenceLimits }
interface RequestRow {
  id: string; tenant_id: string; run_id: string; request_hash: string; state: string;
  scope_type: 'ORDER' | 'PLATFORM' | 'REVISION'; scope_id: string; reserved_micro: string;
  reserved_input_tokens: number; reserved_output_tokens: number; response_key: string;
  data: { receipt_sha256?: string; error_code?: string }; private: { reservation_id: string; admission: CodexAdmission };
}
export type InferenceHttp = (url: string, hosts: readonly string[], options: Parameters<typeof safeHttp>[2]) => Promise<HttpResponse>;
const allowedFields = new Set(['model', 'input', 'instructions', 'tools', 'parallel_tool_calls', 'reasoning', 'store', 'stream', 'text',
  'max_output_tokens', 'include', 'service_tier', 'prompt_cache_key', 'prompt_cache_retention']);

/** Text/function context, plus sealed original PNGs for admitted review roles.
 * No hosted, shell, search, audio or arbitrary file tools. */
export function checkInferenceInput(raw: unknown, scope: ToolScope, admission: CodexAdmission): Record<string, unknown> {
  const body = object(raw);
  requireThat(Object.keys(body).every(k => allowedFields.has(k)) && body.model === admission.actual_model
    && body.store === false && body.stream === true && Array.isArray(body.input) && body.input.length > 0 && body.input.length <= 2000,
  'CODEX_INFERENCE_INPUT_INVALID', '推理请求超出已核验模型或协议范围', 422);
  requireThat((body.service_tier === undefined || body.service_tier === admission.service_tier)
    && (body.prompt_cache_retention === undefined || body.prompt_cache_retention === 'in_memory')
    && (body.max_output_tokens === undefined || typeof body.max_output_tokens === 'number' && Number.isSafeInteger(body.max_output_tokens) && body.max_output_tokens > 0),
  'CODEX_INFERENCE_INPUT_INVALID', '推理服务档位、缓存或输出额度不符合冻结费用协议', 422);
  const allowedTools = new Set(toolsForRole(scope.role).filter(t => !scope.allowed_tools || scope.allowed_tools.includes(t.name)).map(t => `mcp__ypcc__${t.name}`));
  requireThat(body.tools === undefined || Array.isArray(body.tools) && body.tools.every(rawTool => {
    const tool = object(rawTool); return tool.type === 'function' && typeof tool.name === 'string' && allowedTools.has(tool.name)
      && Object.keys(tool).every(k => ['type', 'name', 'description', 'parameters', 'strict'].includes(k));
  }), 'CODEX_INFERENCE_TOOL_FORBIDDEN', '推理请求含未授权的内置或外部工具', 403);
  const scan = (value: unknown, depth = 0): void => {
    requireThat(depth < 40, 'CODEX_INFERENCE_INPUT_INVALID', '推理上下文嵌套超过限制', 422);
    if (Array.isArray(value)) { for (const item of value) scan(item, depth + 1); return; }
    if (value && typeof value === 'object') {
      const item = object(value);
      requireThat((item.type !== 'input_image' || (scope.packet_hash && admission.review_vision
        && (scope.role === 'REVIEW_FACTS' || scope.role === 'REVIEW_STYLE')))
        && !['input_file', 'input_audio', 'computer_call', 'file_search_call', 'web_search_call',
        'local_shell_call', 'shell_call', 'apply_patch_call'].includes(String(item.type)),
      'CODEX_INFERENCE_TOOL_FORBIDDEN', '当前文本规划出口不接受媒体、托管工具或命令', 403);
      for (const child of Object.values(item)) scan(child, depth + 1);
    }
  };
  scan(body.input);
  requireThat(Buffer.byteLength(JSON.stringify(body)) <= admission.max_request_bytes,
    'CODEX_INFERENCE_TOO_LARGE', '推理上下文超过已核验大小', 413);
  return body;
}
export interface InferenceReceipt { responseId: string; input: number; output: number; cached: number; cost: number; completed: boolean }
export function inspectInferenceReceipt(bytes: Buffer, admission: CodexAdmission, inputBound: number, outputBound: number): InferenceReceipt {
  requireThat(bytes.length <= admission.max_response_bytes, 'CODEX_RECEIPT_INVALID', '推理回执超过大小限制', 503);
  const text = bytes.toString('utf8');
  requireThat(isUtf8(bytes) && text.includes('\n'), 'CODEX_RECEIPT_INVALID', '推理回执编码无效', 503);
  let terminal: Record<string, unknown> | undefined; let responseId: string | undefined;
  let frames = 0;
  for (const block of text.replaceAll('\r\n', '\n').split('\n\n')) {
    const lines = block.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart());
    if (!lines.length || lines.join('\n') === '[DONE]') continue;
    requireThat(++frames <= 100000, 'CODEX_RECEIPT_INVALID', '推理事件过多', 503);
    let event: Record<string, unknown>;
    try { event = object(JSON.parse(lines.join('\n'))); } catch { throw new AppError('CODEX_RECEIPT_INVALID', '推理事件格式无效', 503); }
    const response = event.response ? object(event.response) : undefined;
    if (response && typeof response.id === 'string') {
      requireThat(!responseId || responseId === response.id, 'CODEX_RECEIPT_INVALID', '推理回执混入多个响应', 503); responseId = response.id;
    }
    if (['response.completed', 'response.incomplete', 'response.failed'].includes(String(event.type))) {
      requireThat(!terminal && response && `response.${String(response.status)}` === event.type, 'CODEX_RECEIPT_INVALID', '推理终态重复、缺失或不一致', 503); terminal = response;
    }
  }
  requireThat(terminal && typeof responseId === 'string' && responseId.length > 0 && responseId.length <= 200
    && terminal.model === admission.actual_model && terminal.service_tier === admission.service_tier && ['completed', 'incomplete', 'failed'].includes(String(terminal.status)),
  'CODEX_RECEIPT_INVALID', '推理回执缺少可信终态或实际模型不匹配', 503);
  const usage = object(terminal.usage); const input = usage.input_tokens; const output = usage.output_tokens;
  const cached = object(usage.input_tokens_details ?? {}).cached_tokens ?? 0;
  requireThat([input, output, cached].every(n => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0)
    && Number(input) <= inputBound && Number(output) <= outputBound && Number(cached) <= Number(input),
  'CODEX_USAGE_INVALID', '实际推理用量超出已预留上界，已保留成本等待核对', 503);
  return { responseId, input: Number(input), output: Number(output), cached: Number(cached),
    cost: inferenceCost(admission, Number(input), Number(output), Number(cached)), completed: terminal.status === 'completed' };
}

/** This is the only Responses egress used by a role. Provider credentials never
 * enter its process. Buffer the bounded SSE until its usage receipt is durable. */
export class InferenceGateway {
  constructor(private pool: pg.Pool, private cfg: Config, private store: ObjectStorage, private http: InferenceHttp = safeHttp) {}
  private async binding(db: Db, scope: ToolScope): Promise<Binding> {
    requireThat(this.cfg.codex.enabled && this.cfg.codex.apiKey, 'CODEX_NOT_CONFIGURED', '受控推理出口尚未启用', 503);
    const run = (await db.query<{ private: { runtime_admission: unknown; inference_limits: InferenceLimits } }>(
      'SELECT private FROM agent_runs WHERE id=$1 AND tenant_id=$2', [scope.run_id, scope.tenant_id])).rows[0] ?? notFound();
    const admission = checkAdmission(this.cfg, run.private.runtime_admission); const limits = run.private.inference_limits;
    requireThat(limits && [limits.max_requests, limits.max_input_tokens, limits.max_output_tokens, limits.ceiling_micro, limits.daily_ceiling_micro]
      .every(n => Number.isSafeInteger(n) && n > 0) && typeof limits.owner_id === 'string',
    'CODEX_LIMITS_INVALID', '执行未绑定已冻结的推理限额', 503);
    requireThat(limits.max_requests_per_role === undefined || (Number.isSafeInteger(limits.max_requests_per_role)
      && limits.max_requests_per_role > 0 && limits.max_requests_per_role <= limits.max_requests),
      'CODEX_INFERENCE_BINDING_INVALID', '角色推理轮次额度不符合冻结规范', 503);
    return { admission, limits };
  }
  async reconcileReceipts(limit = 20): Promise<{ settled: number; blocked: number }> {
    requireThat(Number.isSafeInteger(limit) && limit > 0 && limit <= 100, 'RECONCILIATION_LIMIT_INVALID', '对账批次无效', 500);
    const rows = (await this.pool.query<RequestRow & { object_sha256: string }>(`SELECT i.*,w.sha256 AS object_sha256 FROM inference_requests i
      JOIN private_object_writes w ON w.tenant_id=i.tenant_id AND w.object_key=i.response_key AND w.run_id=i.run_id
        AND w.kind='RECEIPT' AND w.state='STORED' WHERE i.state IN ('SUBMITTING','UNKNOWN') ORDER BY i.updated_at,i.id LIMIT $1`, [limit])).rows;
    let settled = 0; let blocked = 0;
    for (const row of rows) {
      try {
        const bytes = await this.store.get(row.response_key, row.private.admission.max_response_bytes);
        requireThat(sha256(bytes) === row.object_sha256, 'CODEX_RECEIPT_HASH_MISMATCH', '原推理回执摘要不一致', 503);
        await this.settleReceipt(row, bytes); settled++;
      } catch (error) {
        blocked++;
        await this.pool.query(`UPDATE inference_requests SET private=private||jsonb_build_object('reconciliation_error',$3::text),updated_at=now()
          WHERE tenant_id=$1 AND id=$2 AND state IN ('SUBMITTING','UNKNOWN')`, [row.tenant_id, row.id, error instanceof AppError ? error.code : 'CODEX_RECEIPT_INVALID']);
      }
    }
    return { settled, blocked };
  }
  private async settleReceipt(row: RequestRow, bytes: Buffer): Promise<void> {
    const receipt = inspectInferenceReceipt(bytes, row.private.admission, row.reserved_input_tokens, row.reserved_output_tokens);
    requireThat(receipt.cost <= Number(row.reserved_micro), 'CODEX_USAGE_INVALID', '推理实际费用超出预留上界', 503);
    await transaction(this.pool, async db => {
      const current = (await db.query<{ state: string }>('SELECT state FROM inference_requests WHERE id=$1 AND tenant_id=$2 FOR UPDATE', [row.id, row.tenant_id])).rows[0] ?? notFound();
      if (['SUCCEEDED', 'FAILED'].includes(current.state)) return;
      if (row.scope_type === 'ORDER') await settle(db, row.tenant_id, row.private.reservation_id, receipt.cost);
      else if(row.scope_type==='REVISION')await settleRevisionCost(db,row.tenant_id,row.private.reservation_id,receipt.cost);
      else await settlePlatform(db, row.tenant_id, row.private.reservation_id, receipt.cost);
      await db.query(`UPDATE inference_requests SET state=$3,actual_micro=$4,actual_input_tokens=$5,actual_output_tokens=$6,
        data=data||jsonb_build_object('receipt_sha256',$7::text,'response_id',$8::text),updated_at=now() WHERE id=$1 AND tenant_id=$2`,
      [row.id, row.tenant_id, receipt.completed ? 'SUCCEEDED' : 'FAILED', receipt.cost, receipt.input, receipt.output, sha256(bytes), receipt.responseId]);
      await db.query(`UPDATE agent_runs SET spent_micro=spent_micro+$3,updated_at=now(),data=data||jsonb_build_object(
        'spend_confirmed_micro',spent_micro+$3,'spend_reserved_micro',COALESCE((SELECT sum(reserved_micro)
          FROM inference_requests WHERE run_id=$1 AND state IN ('SUBMITTING','UNKNOWN')),0)) WHERE id=$1 AND tenant_id=$2`, [row.run_id, row.tenant_id, receipt.cost]);
    });
  }
  private async replay(row: RequestRow): Promise<Buffer> {
    if (row.state === 'FAILED' && !row.data.receipt_sha256) throw new AppError(row.data.error_code ?? 'CODEX_INFERENCE_REJECTED', '原推理请求未成功，禁止隐式重购', 409);
    if (!await this.store.exists(row.response_key)) throw new AppError('CODEX_INFERENCE_UNKNOWN', '原推理尚无完整回执，禁止再次提交', 409);
    const bytes = await this.store.get(row.response_key, row.private.admission.max_response_bytes);
    if (row.data.receipt_sha256) requireThat(sha256(bytes) === row.data.receipt_sha256, 'CODEX_RECEIPT_HASH_MISMATCH', '推理回执摘要不一致', 503);
    await this.settleReceipt(row, bytes); return bytes;
  }
  async respond(authorization: string | undefined, raw: unknown, signal?: AbortSignal): Promise<Buffer> {
    const prepared = await transaction(this.pool, async db => {
      const scope = await authorizeTool(db, authorization); const binding = await this.binding(db, scope);
      const input = checkInferenceInput(raw, scope, binding.admission); const requestHash = hash(input);
      const listeningHash=await scopeReviewListening(db,this.cfg,this.store,scope);
      const visual = await authorizeReviewImages(db, scope, input.input, binding.admission);
      const type = scope.scope_type==='REVISION'?'REVISION':scope.order_id ? 'ORDER' : 'PLATFORM'; const scopeId = scope.order_id ?? scope.preview_session_id!;
      // Aftercare request IDs are checkpoints, not fresh sold token/call pools.
      const revisionOrder=type==='REVISION'?(await db.query<{order_id:string}>('SELECT order_id FROM revision_requests WHERE tenant_id=$1 AND id=$2',[scope.tenant_id,scopeId])).rows[0]??notFound():null;
      const scopeIds=revisionOrder?(await db.query<{id:string}>('SELECT id FROM revision_requests WHERE tenant_id=$1 AND order_id=$2',[scope.tenant_id,revisionOrder.order_id])).rows.map(r=>r.id):[scopeId];
      await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`inference:${scope.tenant_id}:${type}:${revisionOrder?.order_id??scopeId}`]);
      // Recheck after waiting on the scope budget lock. No lost lease may buy.
      await authorizeTool(db, authorization, true);
      const old = (await db.query<RequestRow>('SELECT * FROM inference_requests WHERE tenant_id=$1 AND run_id=$2 AND request_hash=$3', [scope.tenant_id, scope.run_id, requestHash])).rows[0];
      if (old) return { row: old, old: true, body: '', deadline: scope.expires_at };
      const violated = await db.query(`SELECT id FROM inference_requests WHERE data->>'admission_hash'=$1
        AND data->>'contract_violation'='true' LIMIT 1`, [admissionHash(binding.admission)]);
      requireThat(violated.rowCount === 0, 'CODEX_ADMISSION_QUARANTINED', '该推理能力的用量或协议需重新核验，已停止新调用', 503);
      const totals = (await db.query<{ count: string; pending: boolean; input: string; output: string; cost: string; changed: boolean }>(`SELECT count(*) AS count,
        COALESCE(bool_or(state IN ('SUBMITTING','UNKNOWN')),false) AS pending,
        COALESCE(sum(COALESCE(actual_input_tokens,reserved_input_tokens)),0) AS input,
        COALESCE(sum(COALESCE(actual_output_tokens,reserved_output_tokens)),0) AS output,
        COALESCE(sum(COALESCE(actual_micro,reserved_micro)),0) AS cost,
        COALESCE(bool_or(private->>'scope_binding_hash' IS DISTINCT FROM $4),false) AS changed
        FROM inference_requests WHERE tenant_id=$1 AND scope_type=$2 AND scope_id=ANY($3::text[])`,
      [scope.tenant_id, type, scopeIds, hash(binding)])).rows[0]!;
      requireThat(!totals.pending, 'CODEX_INFERENCE_UNKNOWN', '该成本域存在在途或结果不明的推理，先核对原回执', 409);
      requireThat(!totals.changed, 'CODEX_SCOPE_BINDING_CHANGED', '原推理预算与准入快照不能更换', 409);
      if (binding.limits.max_requests_per_role !== undefined) {
        const roleCount = (await db.query<{ n: string }>(`SELECT count(*) AS n FROM inference_requests q JOIN agent_runs r ON r.id=q.run_id AND r.tenant_id=q.tenant_id
          WHERE q.tenant_id=$1 AND q.scope_type=$2 AND q.scope_id=ANY($3::text[]) AND r.role=$4`, [scope.tenant_id, type, scopeIds, scope.role])).rows[0]!;
        requireThat(Number(roleCount.n) < binding.limits.max_requests_per_role, 'CODEX_ROLE_INFERENCE_LIMIT', '该角色已达到原合同推理轮次上限', 422);
      }
      const output = Math.min(binding.admission.max_request_output_tokens, binding.limits.max_output_tokens - Number(totals.output),
        typeof input.max_output_tokens === 'number' ? input.max_output_tokens : binding.admission.max_request_output_tokens);
      requireThat(output > 0 && Number(totals.count) < binding.limits.max_requests, 'CODEX_INFERENCE_LIMIT', '已达到原推理轮次或输出限额', 422);
      // The tokenizer bound must be certified for the pinned model in G0. This
      // intentionally counts JSON bytes too, rather than guessing from words.
      const body = JSON.stringify({ ...input, service_tier: binding.admission.service_tier, max_output_tokens: output,
        prompt_cache_key: hash({ tenant_id: scope.tenant_id, scope_id: scopeId, run_id: scope.run_id }), prompt_cache_retention: 'in_memory' });
      const tokenBody = JSON.stringify({ ...JSON.parse(body), input: visual.text_input });
      const inputBound = Buffer.byteLength(tokenBody) + binding.admission.input_overhead_tokens + visual.input_bound_extra;
      requireThat(Buffer.byteLength(body) <= binding.admission.max_request_bytes && inputBound + Number(totals.input) <= binding.limits.max_input_tokens,
        'CODEX_INFERENCE_LIMIT', '推理上下文将超过原输入上界', 422);
      const amount = Math.max(1, inferenceCost(binding.admission, inputBound, output));
      requireThat(Number(totals.cost) + amount <= binding.limits.ceiling_micro, 'CODEX_INFERENCE_BUDGET', '该推理将超过冻结的费用上限', 422);
      const requestId = id('infer'); const intentKey = `inference:${requestId}`;
      const costStage = type === 'ORDER' ? (await db.query<StageLease>(`SELECT * FROM stage_runs WHERE tenant_id=$1 AND id=$2
        AND scope_type='ORDER' AND scope_id=$3 AND fencing_token=$4 AND input_hash=$5`,
      [scope.tenant_id, scope.stage_run_id, scopeId, scope.stage_fencing_token, scope.snapshot_hash])).rows[0] : null;
      requireThat(type !== 'ORDER' || costStage, 'COST_STAGE_INVALID', '推理费用缺少当前原订单阶段绑定', 409);
      const reservation = type === 'ORDER' ? await reserveStageCost(db, costStage!, intentKey, amount, binding.admission, { kind: 'INFERENCE' })
        : type==='REVISION' ? await reserveRevisionCost(db,scope.tenant_id,scopeId,intentKey,amount,binding.admission)
        : await reservePlatform(db, { tenantId: scope.tenant_id, ownerId: binding.limits.owner_id, category: scope.scope_type === 'SAMPLE' ? 'CODEX_SAMPLE' : 'CODEX_PLANNING', dailyCeilingMicro: binding.limits.daily_ceiling_micro }, intentKey, amount, binding.admission);
      await insert(db, 'inference_requests', { id: requestId, tenant_id: scope.tenant_id, run_id: scope.run_id, stage_run_id: scope.stage_run_id,
        intent_key: intentKey, request_hash: requestHash, state: 'SUBMITTING', reserved_micro: amount, scope_type: type, scope_id: scopeId,
        reserved_input_tokens: inputBound, reserved_output_tokens: output, response_key: `${scope.tenant_id}/inference/${requestId}.sse`,
        data: { body_sha256: sha256(body), admission_hash: admissionHash(binding.admission), review_packet_hash: scope.packet_hash,
          review_image_hashes: visual.image_hashes, review_image_binding_hash: visual.binding_hash,review_listening_hash:listeningHash },
        private: { reservation_id: reservation, admission: binding.admission, scope_binding_hash: hash(binding) } });
      await db.query(`UPDATE agent_runs SET data=data||jsonb_build_object('spend_reserved_micro',COALESCE((SELECT sum(reserved_micro)
        FROM inference_requests WHERE run_id=$1 AND state IN ('SUBMITTING','UNKNOWN')),0)),updated_at=now() WHERE id=$1 AND tenant_id=$2`, [scope.run_id, scope.tenant_id]);
      const row = (await db.query<RequestRow>('SELECT * FROM inference_requests WHERE id=$1', [requestId])).rows[0]!;
      return { row, old: false, body, deadline: scope.expires_at };
    });
    if (prepared.old) { const bytes = await this.replay(prepared.row); await authorizeTool(this.pool, authorization); return bytes; }
    const { row } = prepared;
    try {
      const response = await this.http(`${row.private.admission.inference_base_url.replace(/\/$/, '')}/responses`, this.cfg.provider.allowedHosts,
        { method: 'POST', headers: { Authorization: `Bearer ${this.cfg.codex.apiKey}`, 'Content-Type': 'application/json', Accept: 'text/event-stream', 'X-Client-Request-Id': row.id },
          body: prepared.body, maxBytes: row.private.admission.max_response_bytes, timeoutMs: Math.max(1, Math.min(120000, prepared.deadline.getTime() - Date.now())), ...(signal ? { signal } : {}) });
      if (response.status < 200 || response.status >= 300) {
        if (row.private.admission.no_charge_http_statuses.includes(response.status)) {
          await transaction(this.pool, async db => {
            if (row.scope_type === 'ORDER') await settle(db, row.tenant_id, row.private.reservation_id, null, true);
            else if(row.scope_type==='REVISION')await settleRevisionCost(db,row.tenant_id,row.private.reservation_id,null,true);
            else await settlePlatform(db, row.tenant_id, row.private.reservation_id, null, true);
            await db.query(`UPDATE inference_requests SET state='FAILED',actual_micro=0,actual_input_tokens=0,actual_output_tokens=0,
              data=data||'{"error_code":"CODEX_INFERENCE_REJECTED"}'::jsonb,updated_at=now() WHERE id=$1 AND tenant_id=$2`, [row.id, row.tenant_id]);
            await db.query(`UPDATE agent_runs SET data=data||jsonb_build_object('spend_reserved_micro',COALESCE((SELECT sum(reserved_micro)
              FROM inference_requests WHERE run_id=$1 AND state IN ('SUBMITTING','UNKNOWN')),0)),updated_at=now() WHERE id=$1 AND tenant_id=$2`, [row.run_id, row.tenant_id]);
          });
          throw new AppError('CODEX_INFERENCE_REJECTED', '推理供应商拒绝了原请求', 503);
        }
        throw new AppError('CODEX_INFERENCE_UNKNOWN', '原推理计费状态需要核对', 503);
      }
      requireThat(String(response.headers['content-type']).startsWith('text/event-stream'), 'CODEX_RECEIPT_INVALID', '推理服务未返回已核验的事件流', 503);
      // Validate before saving or exposing a receipt. The deterministic private
      // key closes the object-write / database-commit crash gap.
      inspectInferenceReceipt(response.bytes, row.private.admission, row.reserved_input_tokens, row.reserved_output_tokens);
      await writePrivateObject(this.pool, this.store, await inferenceObjectScope(this.pool, row.tenant_id, row.run_id),
        row.response_key, response.bytes, 'text/event-stream');
      await this.settleReceipt(row, response.bytes);
      await authorizeTool(this.pool, authorization); return response.bytes;
    } catch (error) {
      await transaction(this.pool, async db => {
        const changed = await db.query(`UPDATE inference_requests SET state='UNKNOWN',updated_at=now()
          WHERE id=$1 AND tenant_id=$2 AND state='SUBMITTING' RETURNING id`, [row.id, row.tenant_id]);
        if (changed.rowCount) {
          if (row.scope_type === 'ORDER') await settle(db, row.tenant_id, row.private.reservation_id, null);
          else if(row.scope_type==='REVISION')await settleRevisionCost(db,row.tenant_id,row.private.reservation_id,null);
          else await settlePlatform(db, row.tenant_id, row.private.reservation_id, null);
        }
      });
      if (error instanceof AppError && ['CODEX_RECEIPT_INVALID', 'CODEX_USAGE_INVALID'].includes(error.code)) {
        await this.pool.query(`UPDATE inference_requests SET data=data||jsonb_build_object('contract_violation',true,'error_code',$3::text)
          WHERE id=$1 AND tenant_id=$2`, [row.id, row.tenant_id, error.code]);
      }
      throw error;
    }
  }
}
export async function registerInferenceGateway(app: FastifyInstance, cfg: Config, pool: pg.Pool, store: ObjectStorage, http?: InferenceHttp): Promise<void> {
  const gateway = new InferenceGateway(pool, cfg, store, http);
  app.post('/v1/internal/p01/agent-inference/responses', { bodyLimit: 36000000,
    preParsing: async (request,_reply,payload) => { await authorizeTool(pool, request.headers.authorization); return payload; } }, async (request, reply) => {
    const controller = new AbortController(); const closed = (): void => { if (!reply.raw.writableEnded) controller.abort(); };
    reply.raw.once('close', closed);
    try {
      const bytes = await gateway.respond(request.headers.authorization, request.body, controller.signal);
      return reply.header('Cache-Control', 'private, no-store').type('text/event-stream').send(bytes);
    } finally { reply.raw.off('close', closed); }
  });
}
