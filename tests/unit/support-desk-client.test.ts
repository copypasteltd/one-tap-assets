import {it,expect,vi} from 'vitest';
import {SupportDeskClient} from '../../src/shared/client/support-desk';
const body={action:'CLAIM' as const,expected_revision:0};
const data={ticket_id:'ticket_1',revision:1};
it('calls the default browser fetch without binding the client as its Window receiver',async()=>{
  const request=vi.fn(function(this:unknown){if(this!==undefined)throw new TypeError('Illegal invocation');return Promise.resolve(Response.json({data}));});
  vi.stubGlobal('fetch',request);
  try{const desk=new SupportDeskClient();desk.connect('fixture');expect(await desk.detail('ticket_1')).toEqual(data);expect(request).toHaveBeenCalledOnce();}
  finally{vi.unstubAllGlobals();}
});
it('keeps an uncertain mutation on the original key/body and rejects replacement content',async()=>{
  const requests:RequestInit[]=[];let lose=true;const desk=new SupportDeskClient(async(_url,init)=>{requests.push(init!);if(lose){lose=false;throw new Error('Committed ACK lost');}return Response.json({data});});
  desk.connect('synthetic-token');await expect(desk.process('ticket_1',body)).rejects.toMatchObject({code:'NETWORK_UNKNOWN'});expect(desk.pending).toBe(true);
  await expect(desk.process('ticket_2',body)).rejects.toMatchObject({code:'MANAGEMENT_ORIGINAL_PENDING'});expect(requests).toHaveLength(1);
  expect(await desk.retry()).toEqual(data);expect(requests[1]!.body).toBe(requests[0]!.body);expect(requests[1]!.headers).toEqual(requests[0]!.headers);expect(desk.pending).toBe(false);
});
it('clears a definitively rejected operation and requires current state for any next request',async()=>{
  const desk=new SupportDeskClient(async()=>Response.json({code:'SUPPORT_REVISION_CHANGED',message:'请刷新工单'},{status:409}));desk.connect('fixture');
  await expect(desk.process('ticket_1',body)).rejects.toMatchObject({status:409});expect(desk.pending).toBe(false);
  await expect(desk.retry()).rejects.toMatchObject({code:'MANAGEMENT_ORIGINAL_MISSING'});
});
it('rejects a late successful reply after logout or account replacement',async()=>{
  let finish!:(value:Response)=>void;const desk=new SupportDeskClient(()=>new Promise(done=>{finish=done;}));desk.connect('first');const pending=desk.process('ticket_1',body);desk.connect('second');
  finish(Response.json({data}));await expect(pending).rejects.toMatchObject({code:'MANAGEMENT_ACCOUNT_CHANGED'});expect(desk.pending).toBe(false);
});
it('retains a successful but mismatched receipt for original-key recovery',async()=>{
  const desk=new SupportDeskClient(async()=>Response.json({data:{...data,ticket_id:'foreign_ticket'}}));desk.connect('fixture');
  await expect(desk.process('ticket_1',body)).rejects.toMatchObject({code:'MANAGEMENT_RESPONSE_INVALID'});expect(desk.pending).toBe(true);desk.disconnect();expect(desk.pending).toBe(false);
});
