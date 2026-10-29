import {setTimeout as delay} from 'node:timers/promises';

/** One elapsed-time budget, independent of how quickly refused probes return. */
export async function waitForLocalReady(options:{timeoutMs:number;probe:(remainingMs:number)=>Promise<boolean>;stopped:()=>boolean;
  now?:()=>number;pause?:(milliseconds:number)=>Promise<void>}):Promise<boolean>{
  const now=options.now??(()=>performance.now()),pause=options.pause??(async ms=>{await delay(ms);});
  const deadline=now()+options.timeoutMs;
  while(!options.stopped()){
    const remaining=deadline-now();if(remaining<=0)return false;
    const ready=await options.probe(Math.max(1,Math.ceil(Math.min(1000,remaining))));
    if(options.stopped()||now()>=deadline)return false;
    if(ready)return true;
    await pause(Math.max(0,Math.min(500,deadline-now())));
  }
  return false;
}
