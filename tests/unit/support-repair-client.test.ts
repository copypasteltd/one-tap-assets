import {it,expect} from 'vitest';
import {SupportDeskClient} from '../../src/shared/client/support-desk';
const body={ticket_id:'ticket_1',expected_ticket_revision:1,change:{kind:'DISPLAY_TEXT' as const,manifest_revision:1,display_text:'原实拍商品，欢迎了解。'}};
const receipt={revision_id:'repair_1',order_id:'order_1',state:'REQUESTED',result_manifest_revision:null,consumes_user_allowance:false};
it('freezes an uncertain correction and shares one pending-write gate with ticket processing',async()=>{
  const requests:{url:string;init:RequestInit}[]=[];let lose=true;
  const desk=new SupportDeskClient(async(url,init)=>{requests.push({url:String(url),init:init!});if(lose){lose=false;throw new Error('Committed ACK lost');}return Response.json({data:receipt});});
  desk.connect('synthetic');const input=structuredClone(body);await expect(desk.repair('order_1','ticket_1',input)).rejects.toMatchObject({code:'NETWORK_UNKNOWN'});input.change.display_text='Changed after submission';
  expect(desk.pendingKind).toBe('REPAIR');expect(desk.pendingTicketId).toBe('ticket_1');
  await expect(desk.process('ticket_1',{expected_revision:1,action:'REPLY',message:'new operation'})).rejects.toMatchObject({code:'MANAGEMENT_ORIGINAL_PENDING'});
  await expect(desk.repair('order_1','ticket_1',input)).rejects.toMatchObject({code:'MANAGEMENT_ORIGINAL_PENDING'});expect(requests).toHaveLength(1);
  expect(await desk.retryRepair()).toEqual(receipt);expect(requests[1]!.url).toBe(requests[0]!.url);expect(requests[1]!.init.body).toBe(requests[0]!.init.body);expect(requests[1]!.init.headers).toEqual(requests[0]!.init.headers);expect(JSON.parse(requests[1]!.init.body as string)).toEqual(body);expect(desk.pending).toBe(false);
  expect(requests[0]!.url).toBe('/v1/internal/p01/orders/order_1/platform-repairs');
});
it('does not replace a pending ticket operation with a correction',async()=>{
  const desk=new SupportDeskClient(async()=>{throw new Error('Unknown');});desk.connect('synthetic');await expect(desk.process('ticket_1',{action:'CLAIM',expected_revision:0})).rejects.toMatchObject({code:'NETWORK_UNKNOWN'});
  await expect(desk.repair('order_1','ticket_1',body)).rejects.toMatchObject({code:'MANAGEMENT_ORIGINAL_PENDING'});expect(desk.pendingKind).toBe('PROCESS');
});
it('retains a foreign or allowance-consuming correction receipt for original-key recovery',async()=>{
  let consume=false;const desk=new SupportDeskClient(async()=>Response.json({data:{...receipt,...(consume?{consumes_user_allowance:true}:{order_id:'foreign_order'})}}));desk.connect('synthetic');
  await expect(desk.repair('order_1','ticket_1',body)).rejects.toMatchObject({code:'MANAGEMENT_RESPONSE_INVALID'});consume=true;
  await expect(desk.retryRepair()).rejects.toMatchObject({code:'MANAGEMENT_RESPONSE_INVALID'});expect(desk.pending).toBe(true);
});
it('clears a definitive stale-ticket refusal and rejects late responses across accounts',async()=>{
  const desk=new SupportDeskClient(async()=>Response.json({code:'SUPPORT_REVISION_CHANGED',message:'请刷新'},{status:409}));desk.connect('synthetic');
  await expect(desk.repair('order_1','ticket_1',body)).rejects.toMatchObject({status:409});expect(desk.pending).toBe(false);
  let finish!:(value:Response)=>void;const other=new SupportDeskClient(()=>new Promise(done=>finish=done));other.connect('first');const request=other.repair('order_1','ticket_1',body);other.connect('second');
  finish(Response.json({data:receipt}));await expect(request).rejects.toMatchObject({code:'MANAGEMENT_ACCOUNT_CHANGED'});expect(other.pending).toBe(false);
});
it('rejects a cross-order context instead of displaying private material',async()=>{
  const desk=new SupportDeskClient(async()=>Response.json({data:{ticket:{ticket_id:'ticket_1',order_id:'order_1'},manifest:{order_id:'foreign_order'},product_profile:{},repair:null}}));desk.connect('synthetic');
  await expect(desk.repairContext('ticket_1')).rejects.toMatchObject({code:'MANAGEMENT_RESPONSE_INVALID'});
});
it('checks both manifest identity and actual PNG hash before returning a private image',async()=>{
  const bytes=Uint8Array.from([137,80,78,71,13,10,26,10,0]),sha=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join('');
  let corrupt=false;const desk=new SupportDeskClient(async()=>Response.json({data:{manifest_revision:2,deliverable_id:'image_1',mime_type:'image/png',sha256:sha,bytes_base64:btoa(String.fromCharCode(...(corrupt?bytes.slice(0,8):bytes)))}}));desk.connect('synthetic');
  expect((await desk.repairImage('ticket_1',2,'image_1',sha)).sha256).toBe(sha);corrupt=true;
  await expect(desk.repairImage('ticket_1',2,'image_1',sha)).rejects.toMatchObject({code:'MANAGEMENT_RESPONSE_INVALID'});
  await expect(desk.repairImage('ticket_1',3,'image_1',sha)).rejects.toMatchObject({code:'MANAGEMENT_RESPONSE_INVALID'});
});
