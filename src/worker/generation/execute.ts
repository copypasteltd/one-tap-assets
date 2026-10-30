import type pg from 'pg';
import {AppError} from '../../api/lib/errors.js';
import {PendingExternal,type StageLease} from '../queue/leases.js';
import {GenerationGateway,type GenerationRequest} from './gateway.js';

/** A persisted unresolved purchase is a deferred original effect. Do not let
 * the stage/tool runtime retire its scope merely because the first ACK was
 * lost. Only a matching durable gateway error can become this pending state;
 * preflight, permission and terminal failures retain their original errors. */
export async function submitGenerationNode(pool:pg.Pool,gateway:GenerationGateway,lease:StageLease,
  request:GenerationRequest,signal:AbortSignal){
  try{return await gateway.submit(lease,request,signal);}
  catch(error){
    if(signal.aborted||error instanceof PendingExternal)throw error;
    const code=error instanceof AppError?error.code:'GENERATION_RECEIPT_INVALID';
    const row=(await pool.query(`SELECT p.id FROM provider_submissions p JOIN stage_runs s ON s.tenant_id=p.tenant_id AND s.id=p.stage_run_id
      WHERE p.tenant_id=$1 AND ${lease.scope_type==='SAMPLE'?'p.sample_id':'p.order_id'}=$2 AND p.stage_run_id=$3 AND p.operation_key=$4 AND p.generation_kind=$5
      AND p.state IN ('SUBMITTING','UNKNOWN','RUNNING') AND p.private->>'last_error'=$6
      AND s.state='RUNNING' AND s.fencing_token=$7 AND s.lease_expires_at>now() AND s.deadline_at>now()`,
      [lease.tenant_id,lease.scope_id,lease.id,request.operation_key,request.kind,code,lease.fencing_token])).rows[0];
    if(row)throw new PendingExternal(3,request.operation_key.startsWith('reference:')?'GENERATION_REFERENCE_PENDING':'GENERATION_PACK_PENDING');
    throw error;
  }
}
