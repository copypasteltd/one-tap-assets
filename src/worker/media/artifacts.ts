import type pg from 'pg';
import { transaction } from '../../api/db/pool.js';
import { insert } from '../../api/db/store.js';
import { hash, id } from '../../api/lib/crypto.js';
import { requireThat } from '../../api/lib/errors.js';
import type { ObjectStorage } from '../../api/storage/storage.js';
import { validObjectKey } from '../../api/storage/storage.js';
import { executionContext, type ExecutionContext } from '../compiler/order-context.js';
import { toolScopeById, type ToolScope } from '../tool-gateway/http.js';
import type { ToolLease } from '../tool-gateway/consumer.js';
import { PendingExternal } from '../queue/leases.js';
import type { MediaInspection } from './native.js';
import type { ResourceBinding } from '../compiler/snapshot.js';

export type MediaPhase = 'PRODUCTION' | 'POST';
export interface ArtifactSpec {
  ai_disclosure?:import('./disclosure.js').AiDisclosureProof;
  native_audio?:import('../audio/order-proof.js').NativeOrderAudio;
  generation_sources?:import('../generation/outputs.js').GenerationSource[];reference_approval_hash?:string;
  phase: MediaPhase; kind: 'image' | 'video' | 'copy'; snapshot_hash: string; plan_hash: string;
  identity_lock_hash: string; renderer_version: string; source_asset_ids: string[]; source_artifact_ids: string[];
  resource_bindings: ResourceBinding[];
  inspection: MediaInspection | { kind: 'copy'; bytes: number; encoding: 'utf-8' };
}
export interface PrivateArtifact { id: string; slot_id: string; object_key: string; sha256: string; spec: ArtifactSpec }
export interface MediaReceipt {
  version: 'YPCC-MEDIA-1'; operation_id: string; phase: MediaPhase; snapshot_hash: string; input_hash: string;
  artifacts: PrivateArtifact[];
}
export interface MediaOperation {
  id: string; tenant_id: string; order_id: string; stage_run_id: string; phase: MediaPhase; input_hash: string;
  state: 'PREPARING' | 'READY'; generation: number; owner_intent_id: string | null; manifest_key: string | null; manifest_hash: string | null;
}
export const artifactSetHash = (artifacts: PrivateArtifact[]): string => hash([...artifacts].sort((a, b) => a.slot_id.localeCompare(b.slot_id)));
export const checkpointHash = (receipt: MediaReceipt): string => hash({ operation_id: receipt.operation_id, phase: receipt.phase,
  snapshot_hash: receipt.snapshot_hash, input_hash: receipt.input_hash, output_set_hash: artifactSetHash(receipt.artifacts) });

async function assertIntent(db: pg.PoolClient, scope: ToolScope, intent: ToolLease): Promise<void> {
  const current = await toolScopeById(db, scope.capability_id, true);
  requireThat(current.run_id === scope.run_id && current.snapshot_hash === scope.snapshot_hash && current.role === scope.role,
    'TOOL_BINDING_CHANGED', '媒体工具的运行绑定已失效', 409);
  const row = await db.query(`SELECT id FROM agent_tool_intents WHERE id=$1 AND tenant_id=$2 AND run_id=$3
    AND state='RUNNING' AND fencing_token=$4 AND lease_owner=$5 AND lease_expires_at>now() FOR UPDATE`,
  [intent.id, scope.tenant_id, scope.run_id, intent.fencing_token, intent.lease_owner]);
  requireThat(row.rowCount === 1, 'TOOL_LEASE_LOST', '媒体工具执行租约已失效', 409);
}
export async function operationFor(pool: pg.Pool, scope: ToolScope, intent: ToolLease, phase: MediaPhase, inputHash: string): Promise<MediaOperation> {
  return transaction(pool, async db => {
    await assertIntent(db, scope, intent);
    await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`media:${scope.stage_run_id}:${phase}`]);
    const previous=(await db.query<MediaOperation>(`SELECT * FROM media_operations WHERE stage_run_id=$1 AND phase=$2 FOR UPDATE`,
      [scope.stage_run_id,phase])).rows;
    requireThat(previous.every(row=>row.input_hash===inputHash),'MEDIA_INPUT_CHANGED','原媒体执行输入或制作版本已变化，不可重建原任务',503);
    const old=previous[0];
    if (old) return old;
    const operationId = id('media');
    await insert(db, 'media_operations', { id: operationId, tenant_id: scope.tenant_id, order_id: scope.order_id,
      stage_run_id: scope.stage_run_id, phase, input_hash: inputHash, state: 'PREPARING' });
    return (await db.query<MediaOperation>('SELECT * FROM media_operations WHERE id=$1', [operationId])).rows[0]!;
  });
}
export async function claimMediaGeneration(pool: pg.Pool, scope: ToolScope, intent: ToolLease, operation: MediaOperation): Promise<MediaOperation> {
  return transaction(pool, async db => {
    await assertIntent(db, scope, intent);
    const current = (await db.query<MediaOperation>('SELECT * FROM media_operations WHERE tenant_id=$1 AND id=$2 FOR UPDATE', [scope.tenant_id, operation.id])).rows[0]!;
    requireThat(current.state === 'PREPARING', 'MEDIA_CHECKPOINT_MISSING', '已有媒体检查点不能被静默重建', 503);
    if (current.generation !== operation.generation) throw new PendingExternal(2, 'MEDIA_OPERATION_BUSY');
    if (current.owner_intent_id && current.owner_intent_id !== intent.id) {
      const old = await db.query(`SELECT id FROM agent_tool_intents WHERE id=$1 AND state IN ('QUEUED','UNKNOWN','RUNNING')
        AND (state<>'RUNNING' OR lease_expires_at>now())`, [current.owner_intent_id]);
      if (old.rowCount) throw new PendingExternal(2, 'MEDIA_OPERATION_BUSY');
    }
    const generation = current.generation + 1;
    return (await db.query<MediaOperation>(`UPDATE media_operations SET generation=$3,owner_intent_id=$4,manifest_key=$5,updated_at=now()
      WHERE tenant_id=$1 AND id=$2 RETURNING *`, [scope.tenant_id, operation.id, generation, intent.id,
      `${scope.tenant_id}/media/${scope.order_id}/${operation.id}/generation-${generation}.json`])).rows[0]!;
  });
}
/** Receipt fields are never supplied by a model. Nevertheless, recovery checks
 * their full binding and each object's hash before making artifacts visible. */
export async function originalMediaReceipt(store: ObjectStorage, operation: MediaOperation, context: ExecutionContext): Promise<MediaReceipt | null> {
  if (!operation.manifest_key || !(await store.exists(operation.manifest_key))) {
    requireThat(operation.state !== 'READY', 'MEDIA_CHECKPOINT_MISSING', '已完成媒体的原始检查点丢失', 503); return null;
  }
  const receipt = JSON.parse((await store.get(operation.manifest_key, 256000)).toString('utf8')) as MediaReceipt;
  requireThat(receipt && receipt.version === 'YPCC-MEDIA-1' && receipt.operation_id === operation.id && receipt.phase === operation.phase
    && receipt.snapshot_hash === context.snapshotHash && receipt.input_hash === operation.input_hash && Array.isArray(receipt.artifacts)
    && receipt.artifacts.length > 0 && receipt.artifacts.length <= 100 && (!operation.manifest_hash || hash(receipt) === operation.manifest_hash),
    'MEDIA_RECEIPT_MISMATCH', '原媒体检查点摘要或作用域不一致', 503);
  const seen = new Set<string>();
  for (const artifact of receipt.artifacts) {
    requireThat(artifact && /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(artifact.id) && typeof artifact.slot_id === 'string'
      && !seen.has(artifact.slot_id) && /^[a-f0-9]{64}$/.test(artifact.sha256) && artifact.spec?.phase === operation.phase
      && artifact.spec.snapshot_hash === context.snapshotHash && artifact.spec.plan_hash === context.snapshot.plan_hash
      && artifact.spec.identity_lock_hash === context.snapshot.identity_lock_hash
      && typeof artifact.object_key === 'string'
      && validObjectKey(artifact.object_key).startsWith(`${context.tenantId}/media/${context.orderId}/${operation.id}/`),
      'MEDIA_RECEIPT_MISMATCH', '原媒体产物不属于当前合同', 503);
    seen.add(artifact.slot_id);
  }
  return receipt;
}
export async function commitMediaOperation(db: pg.PoolClient, context: ExecutionContext, operation: MediaOperation, receipt: MediaReceipt): Promise<void> {
  await executionContext(db, context.tenantId, context.orderId, context.snapshotHash);
  const current = (await db.query<MediaOperation>('SELECT * FROM media_operations WHERE tenant_id=$1 AND id=$2 FOR UPDATE', [context.tenantId, operation.id])).rows[0];
  requireThat(current?.generation === operation.generation && current.manifest_key === operation.manifest_key,
    'MEDIA_GENERATION_LOST', '媒体执行代次已被接管', 409);
  const receiptHash = hash(receipt);
  if (current.state === 'READY') {
    requireThat(current.manifest_hash === receiptHash, 'MEDIA_RECEIPT_MISMATCH', '媒体检查点不可被另一结果覆盖', 503); return;
  }
  for (const artifact of receipt.artifacts) {
    await insert(db, 'artifacts', { id: artifact.id, tenant_id: context.tenantId, order_id: context.orderId,
      stage_run_id: operation.stage_run_id, slot_id: artifact.slot_id, media_operation_id: operation.id,
      object_key: artifact.object_key, sha256: artifact.sha256, spec_json: artifact.spec,
      data: { artifact_id: artifact.id, slot_id: artifact.slot_id, phase: operation.phase },
      expires_at: new Date(Date.parse(context.snapshot.deadline_at) + 7 * 86400000).toISOString() });
  }
  await db.query(`UPDATE media_operations SET state='READY',manifest_hash=$3,data=$4,updated_at=now() WHERE tenant_id=$1 AND id=$2`,
    [context.tenantId, operation.id, receiptHash, JSON.stringify({ output_set_hash: artifactSetHash(receipt.artifacts), artifact_ids: receipt.artifacts.map(a => a.id) })]);
}
export async function operationArtifacts(db: pg.Pool | pg.PoolClient, context: ExecutionContext, phase: MediaPhase): Promise<{ operation: MediaOperation; receipt: MediaReceipt }> {
  const row = (await db.query<MediaOperation>(`SELECT m.* FROM media_operations m JOIN stage_runs s ON s.id=m.stage_run_id AND s.tenant_id=m.tenant_id
    WHERE m.tenant_id=$1 AND m.order_id=$2 AND m.phase=$3 AND m.state='READY' AND s.input_hash=$4
    AND s.state='SUCCEEDED' ORDER BY s.attempt DESC,m.created_at DESC LIMIT 1`, [context.tenantId, context.orderId, phase, context.snapshotHash])).rows[0];
  requireThat(row, 'MEDIA_PREREQUISITE_MISSING', '前置媒体阶段尚未形成完整检查点', 409);
  return { operation: row, receipt: await receiptFromArtifacts(db, context, row) };
}
export async function receiptFromArtifacts(db: pg.Pool | pg.PoolClient, context: ExecutionContext, operation: MediaOperation): Promise<MediaReceipt> {
  const rows = (await db.query<{ id: string; slot_id: string; object_key: string; sha256: string; spec_json: ArtifactSpec }>(
    'SELECT id,slot_id,object_key,sha256,spec_json FROM artifacts WHERE tenant_id=$1 AND order_id=$2 AND media_operation_id=$3 ORDER BY slot_id',
    [context.tenantId, context.orderId, operation.id])).rows;
  const receipt: MediaReceipt = { version: 'YPCC-MEDIA-1', operation_id: operation.id, phase: operation.phase, snapshot_hash: context.snapshotHash,
    input_hash: operation.input_hash, artifacts: rows.map(({ spec_json, ...a }) => ({ ...a, spec: spec_json })).sort((a, b) => a.slot_id.localeCompare(b.slot_id)) };
  requireThat(rows.length > 0 && hash(receipt) === operation.manifest_hash, 'MEDIA_RECEIPT_MISMATCH', '持久媒体清单不符合原始检查点', 503);
  return receipt;
}
