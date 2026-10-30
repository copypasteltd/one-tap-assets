import type {Db} from '../../api/db/pool.js';
import type {Config} from '../../api/config.js';
import type {ObjectStorage} from '../../api/storage/storage.js';
import type {DTO} from '../../shared/contracts/types.js';
import {hash} from '../../api/lib/crypto.js';
import {requireThat} from '../../api/lib/errors.js';
import type {ExecutionContext} from '../compiler/order-context.js';
import {revisionContext} from '../revisions/context.js';
import {NativeListeningReader,type ListeningEvidence} from './listening-gateway.js';

export interface DeliveredListeningAuthority {revision_id:string;input_hash:string}
/** A separate read-only authorization for unchanged delivered media. It never
 * changes the original deadline, submits listening, or opens a production run. */
class DeliveredNativeListeningReader extends NativeListeningReader {
  constructor(db:Db,cfg:Config,store:ObjectStorage,private authority:DeliveredListeningAuthority){super(db,cfg,store);}
  private async authorize(db:Db,context:ExecutionContext):Promise<void>{
    const c=await revisionContext(db,context.tenantId,this.authority.revision_id,this.authority.input_hash);
    requireThat(c.row.owner_id===context.ownerId&&c.row.order_id===context.orderId&&c.input.product_id===context.snapshot.product_id
      &&c.input.original_snapshot_hash===context.snapshotHash&&c.input.original_contract_hash===hash(context.contract)
      &&c.snapshot.audio_policy.speech_mode==='NATIVE_ZH','LISTENING_AFTERCARE_NOT_AUTHORIZED','原听音只允许当前本人售后读取',403);
  }
  protected override async packetAuthorization(db:Db,context:ExecutionContext,packet:DTO<'ReviewPacket'>):Promise<void>{
    await this.authorize(db,context);
    const row=(await db.query<{private:{packet_id:string;packet_hash:string;snapshot_hash:string;native_listening_hash:string}}>(
      `SELECT private FROM delivery_manifests WHERE tenant_id=$1 AND owner_id=$2 AND order_id=$3 AND revision=1`,
      [context.tenantId,context.ownerId,context.orderId])).rows[0];
    requireThat(packet.state==='PASSED'&&packet.publication_decision==='ALLOW'&&row?.private.packet_id===packet.packet_id
      &&row.private.packet_hash===packet.packet_hash&&row.private.snapshot_hash===context.snapshotHash&&row.private.native_listening_hash,
      'LISTENING_AFTERCARE_SOURCE_INVALID','售后只能读取原已发布完整成片对应的原听音',503);
  }
  protected override async deadlineAuthorization(db:Db,context:ExecutionContext):Promise<void>{await this.authorize(db,context);}
  override async evidence(context:ExecutionContext,db:Db=this.database):Promise<ListeningEvidence>{
    const output=await super.evidence(context,db);
    const row=(await db.query<{private:{native_listening_hash:string;native_listening_submission_id:string}}>(
      `SELECT private FROM delivery_manifests WHERE tenant_id=$1 AND owner_id=$2 AND order_id=$3 AND revision=1`,
      [context.tenantId,context.ownerId,context.orderId])).rows[0];
    requireThat(row?.private.native_listening_hash===hash(output)&&row.private.native_listening_submission_id===output.submission_id,
      'LISTENING_AFTERCARE_SOURCE_INVALID','原发布清单与实际听音回执不一致',503);return output;
  }
}
export function readDeliveredNativeListening(db:Db,cfg:Config,store:ObjectStorage,context:ExecutionContext,
  authority:DeliveredListeningAuthority):Promise<ListeningEvidence>{
  return new DeliveredNativeListeningReader(db,cfg,store,authority).evidence(context);
}
