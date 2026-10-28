import type pg from 'pg';
import {AppError} from '../../api/lib/errors.js';
import {PendingExternal,type StageLease} from '../queue/leases.js';
import type {SpeechGateway} from './gateway.js';

/** The durable original ASR effect can remain UNKNOWN after a lost ACK.
 * Deferral keeps its role/capability and budget alive; it never buys a retry. */
export async function submitSpeechNode(pool:pg.Pool,gateway:SpeechGateway,lease:StageLease,sourceWriteId:string,signal:AbortSignal){
  try{return await gateway.submit(lease,sourceWriteId,signal);}
  catch(error){
    if(signal.aborted||error instanceof PendingExternal)throw error;
    const code=error instanceof AppError?error.code:'ASR_OPERATION_FAILED';
    const row=(await pool.query(`SELECT p.id FROM provider_submissions p JOIN stage_runs s ON s.tenant_id=p.tenant_id AND s.id=p.stage_run_id
      WHERE p.tenant_id=$1 AND p.order_id=$2 AND p.stage_run_id=$3 AND p.generation_kind='ASR' AND p.operation_key=$4
      AND p.state IN ('SUBMITTING','UNKNOWN','RUNNING') AND p.private->>'last_error'=$5
      AND s.state='RUNNING' AND s.fencing_token=$6 AND s.lease_expires_at>now() AND s.deadline_at>now()`,
      [lease.tenant_id,lease.scope_id,lease.id,`asr:${sourceWriteId}`,code,lease.fencing_token])).rows[0];
    if(row)throw new PendingExternal(3,'NATIVE_ASR_PENDING');throw error;
  }
}
