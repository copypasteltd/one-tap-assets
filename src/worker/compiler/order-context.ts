import type pg from 'pg';
import type { DTO } from '../../shared/contracts/types.js';
import { hash } from '../../api/lib/crypto.js';
import { notFound, requireThat } from '../../api/lib/errors.js';
import { validate, validateInternal } from '../../api/lib/validation.js';
import { creativePlanHash, validateCreativePlan } from './plan.js';
import type { FrozenContract, Snapshot } from './snapshot.js';
import {frozenNativeAudio,verifyNativeAudioLive} from '../audio/contract.js';
import {frozenOrderListening} from '../audio/listening-contract.js';
import {frozenAiDisclosure} from './disclosure.js';
import {repairExecutionContext,type RepairContext} from '../repair/context.js';

export interface ExecutionContext {
  tenantId: string; orderId: string; ownerId: string; snapshotHash: string;
  snapshot: Snapshot; contract: FrozenContract; photoVersionId: string;
  repair?:RepairContext;
}
/** Sold inputs are read from immutable versions, never the buyer's latest
 * profile or the author's current preset. Revocation still stops every tool. */
export async function executionContext(db: pg.Pool | pg.PoolClient, tenantId: string, orderId: string, snapshotHash: string,stageId?:string): Promise<ExecutionContext> {
  const order = (await db.query<{ owner_id: string; deadline_at: Date; private: { contract: FrozenContract; contract_hash: string } }>(
    `SELECT owner_id,deadline_at,private FROM orders WHERE tenant_id=$1 AND id=$2 AND payment_state='CONFIRMED'
     AND fulfillment_state IN ('QUEUED','IN_PROGRESS') AND deadline_at>now() AND NOT (private ? 'media_revoked')`, [tenantId, orderId])).rows[0];
  requireThat(order, 'ORDER_NO_LONGER_EXECUTABLE', '该订单已停止执行或素材权限已撤销', 409);
  const stored = (await db.query<{ hash: string; data: Snapshot }>('SELECT hash,data FROM execution_snapshots WHERE tenant_id=$1 AND order_id=$2', [tenantId, orderId])).rows[0] ?? notFound();
  const snapshot = stored.data; const contract = order.private.contract;
  validateInternal('execution-snapshot', snapshot);
  requireThat(stored.hash === snapshotHash && hash(snapshot) === snapshotHash && snapshot.tenant_id === tenantId && snapshot.order_id === orderId,
    'EXECUTION_SNAPSHOT_MISMATCH', '订单执行快照摘要不一致', 503);
  requireThat(contract && hash(contract) === order.private.contract_hash && snapshot.deadline_at === order.deadline_at.toISOString() && snapshot.plan_hash === contract.plan_hash
    && creativePlanHash(contract.creative) === snapshot.plan_hash && snapshot.profile_hash === contract.profile.profile_hash
    && snapshot.product_id === contract.product.product_id && snapshot.identity_lock_hash === contract.identity_lock_hash
    && snapshot.photo_set_hash === contract.photo_set_hash && snapshot.engine === contract.source.engine
    && snapshot.variant_id === contract.source.variant_id && hash(snapshot.codex_contract) === hash(contract.codex_contract)
    && hash(snapshot.resource_versions) === hash(contract.resource_versions) && hash(snapshot.model_versions) === hash(contract.model_versions)
    && snapshot.revision_policy_hash === (contract.revision_policy ? hash(contract.revision_policy) : undefined),
    'EXECUTION_CONTRACT_MISMATCH', '订单合同与冻结计划不一致', 503);
  validate('Profile', contract.profile, true);
  const { profile_hash, ...body } = contract.profile;
  requireThat(hash(body) === profile_hash, 'PROFILE_HASH_MISMATCH', '商品档案摘要不一致', 503);
  validateCreativePlan(contract.creative, contract.profile, contract.source);
  frozenAiDisclosure(contract);
  const audio=frozenNativeAudio(contract);
  const listening=frozenOrderListening(contract);
  requireThat(snapshot.listening_contract_hash===(listening?hash(listening):undefined),
    'EXECUTION_LISTENING_MISMATCH','独立听音快照与原订单合同不一致',503);
  requireThat(snapshot.native_audio_contract_hash===(audio?hash(audio):undefined)
    &&hash(snapshot.audio_policy)===hash({speech_mode:audio?'NATIVE_ZH':'NONE',language:audio?'zh-CN':null,
      native_voice_id:audio?audio.character.native_voice_id:contract.creative.native_voice_id,preserve_native_speech:!!audio,
      caption_alignment:audio?'ACTUAL_AUDIO':'NO_SPEECH',music_license_ids:audio?.music?[audio.music.binding.license_record_id]:[],
      ducking_enabled:audio?.music?.ducking??false}),'EXECUTION_AUDIO_MISMATCH','音频快照与原合同不一致',503);
  await verifyNativeAudioLive(db,contract);
  const photo = (await db.query<{ id: string; photo_set_hash: string }>(
    `SELECT id,photo_set_hash FROM product_photo_versions WHERE tenant_id=$1 AND product_id=$2 AND revision=$3`,
    [tenantId, snapshot.product_id, snapshot.photo_version])).rows[0];
  requireThat(photo?.photo_set_hash === snapshot.photo_set_hash, 'INPUT_HASH_MISMATCH', '已售照片版本摘要不一致', 503);
  const profile = (await db.query<{ data: DTO<'Profile'> }>(
    'SELECT data FROM profile_versions WHERE tenant_id=$1 AND id=$2 AND photo_version_id=$3', [tenantId, snapshot.profile_id, photo.id])).rows[0];
  const lock = (await db.query<{ hash: string }>('SELECT hash FROM identity_locks WHERE tenant_id=$1 AND id=$2 AND profile_id=$3',
    [tenantId, snapshot.identity_lock_id, snapshot.profile_id])).rows[0];
  requireThat(profile && hash(profile.data) === hash(contract.profile) && lock?.hash === snapshot.identity_lock_hash,
    'EXECUTION_EVIDENCE_MISMATCH', '已售商品证据或身份锁不一致', 503);
  const context={ tenantId, orderId, ownerId: order.owner_id, snapshotHash, snapshot, contract, photoVersionId: photo.id };
  return stageId?repairExecutionContext(db,context,stageId):context;
}
