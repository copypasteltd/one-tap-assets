import {it,expect} from 'vitest';
import {waitForLocalReady} from '../../scripts/delivery/readiness';
it('keeps observing fast refusals until actual readiness within one elapsed-time budget',async()=>{
  let clock=0,probes=0;const ready=await waitForLocalReady({timeoutMs:45000,now:()=>clock,pause:async ms=>{clock+=ms;},stopped:()=>false,probe:async remaining=>{probes++;expect(remaining).toBeLessThanOrEqual(1000);return clock>=20000;}});
  expect(ready).toBe(true);expect(probes).toBe(41);expect(clock).toBe(20000);
});
it('does not accept a late positive result and passes only the remaining probe budget',async()=>{
  let clock=0;const budgets:number[]=[];const ready=await waitForLocalReady({timeoutMs:1200,now:()=>clock,pause:async ms=>{clock+=ms;},stopped:()=>false,probe:async remaining=>{budgets.push(remaining);clock+=600;return budgets.length===2;}});
  expect(ready).toBe(false);expect(budgets).toEqual([1000,100]);
});
it('does not probe after stop and rejects a successful response if shutdown happened while waiting',async()=>{
  let calls=0;expect(await waitForLocalReady({timeoutMs:1000,stopped:()=>true,probe:async()=>{calls++;return true;}})).toBe(false);expect(calls).toBe(0);
  let stopped=false;expect(await waitForLocalReady({timeoutMs:1000,stopped:()=>stopped,probe:async()=>{stopped=true;return true;}})).toBe(false);
});
it('stops at the original deadline instead of granting another budget after each failed probe',async()=>{
  let clock=0,probes=0;expect(await waitForLocalReady({timeoutMs:1400,now:()=>clock,pause:async ms=>{clock+=ms;},stopped:()=>false,probe:async()=>{probes++;return false;}})).toBe(false);
  expect(clock).toBe(1400);expect(probes).toBe(3);
});
