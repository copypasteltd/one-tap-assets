import type pg from 'pg';
import {heartbeatStage,type StageLease} from '../../src/worker/queue/leases.js';

/** Match the real worker's processing/commit boundary without leaving an
 * unhandled or in-flight test heartbeat after a transaction ends. */
export async function withFixtureLease<T>(pool:pg.Pool,lease:StageLease,action:(signal:AbortSignal)=>Promise<T>,parent?:AbortSignal):Promise<T>{
  const controller=new AbortController(),signal=parent?AbortSignal.any([parent,controller.signal]):controller.signal;
  let pending:Promise<void>|null=null;let failure:unknown;
  const pulse=setInterval(()=>{
    if(pending||signal.aborted)return;
    pending=heartbeatStage(pool,lease).then(ok=>{if(!ok)throw new Error('Fixture lease was lost');})
      .catch(error=>{failure=error;controller.abort();}).finally(()=>{pending=null;});
  },5000);
  try{
    const result=await action(signal);clearInterval(pulse);if(pending)await pending;if(failure)throw failure;return result;
  }finally{clearInterval(pulse);if(pending)await pending;}
}
