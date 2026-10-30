import type {Config} from '../../api/config.js';
import type {Db} from '../../api/db/pool.js';
import {hash} from '../../api/lib/crypto.js';
import {requireThat} from '../../api/lib/errors.js';
import type {ObjectStorage} from '../../api/storage/storage.js';
import {storage} from '../../api/storage/storage.js';
import {readNativeListening,type ListeningEvidence} from '../audio/listening-gateway.js';
import {executionContext,type ExecutionContext} from '../compiler/order-context.js';
import type {ToolScope} from '../tool-gateway/http.js';
import type {DTO} from '../../shared/contracts/types.js';
import {requireAudioReviewAdmission} from './native-audio.js';
import {readDeliveredNativeListening,type DeliveredListeningAuthority} from '../audio/delivered-listening.js';

export async function reviewListening(db:Db,cfg:Config,context:ExecutionContext,packet:DTO<'ReviewPacket'>,
  store:ObjectStorage=storage(cfg),aftercare?:DeliveredListeningAuthority):Promise<ListeningEvidence|null>{
  requireAudioReviewAdmission(context);
  if(context.snapshot.audio_policy.speech_mode==='NONE')return null;
  const evidence=aftercare?await readDeliveredNativeListening(db,cfg,store,context,aftercare):await readNativeListening(db,cfg,store,context);
  requireThat(evidence.packet_hash===packet.packet_hash,'LISTENING_PACKET_CHANGED','最终复核只能读取同一原审查包的听音',409);
  return evidence;
}
/** Paid final-role inference must still reference the live original approval.
 * Reference identity review occurs before audio production and is separate. */
export async function scopeReviewListening(db:Db,cfg:Config,store:ObjectStorage,scope:ToolScope):Promise<string|null>{
  if(scope.scope_type==='REVISION'&&['REVISION_REVIEW_FACTS','REVISION_REVIEW_STYLE'].includes(scope.stage_name)){
    const {revisionContext}=await import('../revisions/context.js');
    const {revisionPacket,revisionImages}=await import('../revisions/media.js');
    const c=await revisionContext(db,scope.tenant_id,scope.scope_id,scope.snapshot_hash),packet=revisionPacket(c);
    if(c.snapshot.audio_policy.speech_mode==='NONE')return null;
    await revisionImages(db,cfg,store,c);
    const run=(await db.query<{private:{review_input?:{retained_native_audio_hash?:string}}}>(
      'SELECT private FROM agent_runs WHERE tenant_id=$1 AND id=$2',[scope.tenant_id,scope.run_id])).rows[0];
    requireThat(packet.native_audio&&scope.packet_hash===packet.packet_hash
      &&run?.private.review_input?.retained_native_audio_hash===hash(packet.native_audio),
      'REVISION_AUDIO_INPUT_INVALID','售后推理缺少原已付听音、完整转写及不变音视频输入',503);
    return hash(packet.native_audio);
  }
  if(scope.scope_type!=='ORDER'||!['REVIEW_FACTS','REVIEW_STYLE'].includes(scope.stage_name))return null;
  const context=await executionContext(db,scope.tenant_id,scope.scope_id,scope.snapshot_hash,scope.stage_run_id);
  requireAudioReviewAdmission(context);
  const evidence=context.snapshot.audio_policy.speech_mode==='NONE'?null:await readNativeListening(db,cfg,store,context);
  const run=(await db.query<{private:{review_input?:{native_listening?:ListeningEvidence}}}>(
    'SELECT private FROM agent_runs WHERE tenant_id=$1 AND id=$2',[scope.tenant_id,scope.run_id])).rows[0];
  requireThat(evidence?Boolean(run?.private.review_input?.native_listening)&&evidence.packet_hash===scope.packet_hash&&hash(run?.private.review_input?.native_listening)===hash(evidence)
    :!run?.private.review_input?.native_listening,'REVIEW_LISTENING_INPUT_INVALID','最终推理缺少同包、已结算的原听音输入',503);
  return evidence?hash(evidence):null;
}
