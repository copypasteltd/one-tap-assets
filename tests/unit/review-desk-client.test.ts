import {it,expect,vi} from 'vitest';
import {sha256} from '../../src/api/lib/crypto';
import {ReviewDeskClient} from '../../src/shared/client/review-desk';

const request={expected_revision:2,decision:'APPROVE' as const,reason:'逐项核对原申请',evidence_record_ids:['rights_1']};
const publication={publication_id:'pub_1',revision:3,state:'APPROVED'};
it('keeps an uncertain review decision on its original key and content until its matching receipt arrives',async()=>{
  const calls:{url:string;init:RequestInit}[]=[];const transport=vi.fn(async(url:RequestInfo|URL,init?:RequestInit)=>{
    calls.push({url:String(url),init:init!});if(calls.length===1)throw new Error('Synthetic acknowledgement lost');return Response.json({data:publication});});
  const desk=new ReviewDeskClient(transport);desk.connect('synthetic-reviewer');
  await expect(desk.decide('pub_1',request)).rejects.toMatchObject({code:'NETWORK_UNKNOWN'});expect(desk.pending).toBe(true);
  await expect(desk.decide('pub_2',request)).rejects.toMatchObject({code:'MANAGEMENT_ORIGINAL_PENDING'});
  await expect(desk.decide('pub_1',{...request,reason:'different'})).rejects.toMatchObject({code:'MANAGEMENT_ORIGINAL_PENDING'});
  expect(await desk.retry()).toMatchObject(publication);expect(desk.pending).toBe(false);
  expect(calls[1]!.init).toMatchObject({body:calls[0]!.init.body,headers:calls[0]!.init.headers,credentials:'omit',redirect:'error',cache:'no-store'});
  expect(calls[0]!.url).toBe('/v1/internal/p01/publications/pub_1/review-decisions');desk.disconnect();
});
it('requires a matching publication and decision revision before discarding an uncertain success receipt',async()=>{
  const transport=vi.fn(async()=>Response.json({data:{...publication,revision:12}}));const desk=new ReviewDeskClient(transport);desk.connect('synthetic');
  await expect(desk.decide('pub_1',request)).rejects.toMatchObject({code:'MANAGEMENT_RESPONSE_INVALID'});expect(desk.pending).toBe(true);
  transport.mockImplementationOnce(async()=>Response.json({data:publication}));expect(await desk.retry()).toMatchObject(publication);expect(desk.pending).toBe(false);desk.disconnect();
});
it('clears a definitive conflict and keeps publish retries on their original publication',async()=>{
  const transport=vi.fn(async(_input:RequestInfo|URL,_init?:RequestInit)=>Response.json({code:'REVIEW_STATE_CHANGED',message:'Refresh'},{status:409}));const desk=new ReviewDeskClient(transport);desk.connect('synthetic');
  await expect(desk.decide('pub_1',request)).rejects.toMatchObject({status:409});expect(desk.pending).toBe(false);
  transport.mockImplementationOnce(async()=>{throw new Error('Lost publish acknowledgement');});
  await expect(desk.publish('pub_1',{reason:'发布原申请',evidence_record_ids:['rights_1']})).rejects.toMatchObject({code:'NETWORK_UNKNOWN'});
  transport.mockImplementationOnce(async()=>Response.json({data:{...publication,state:'PUBLISHED'}}));
  expect((await desk.retry()).state).toBe('PUBLISHED');expect(transport.mock.calls.at(-1)?.[0]).toBe('/v1/internal/p01/publications/pub_1/publish');desk.disconnect();
});
it('verifies actual sample bytes against the original list and rejects another sample or a replaced payload',async()=>{
  const bytes=Buffer.from([137,80,78,71,13,10,26,10,1,2,3]),file={sample_id:'sample_1',item_id:'hero',kind:'image' as const,mime_type:'image/png' as const,sha256:sha256(bytes),size_bytes:bytes.length};
  const value={...file,publication_id:'pub_1',rights_record_id:null,bytes_base64:bytes.toString('base64')};
  const transport=vi.fn(async()=>Response.json({data:value}));const desk=new ReviewDeskClient(transport);desk.connect('synthetic');
  expect((await desk.sampleMedia('pub_1',file)).bytes).toEqual(new Uint8Array(bytes));
  transport.mockImplementationOnce(async()=>Response.json({data:{...value,sample_id:'foreign'}}));
  await expect(desk.sampleMedia('pub_1',file)).rejects.toMatchObject({code:'MANAGEMENT_RESPONSE_INVALID'});
  transport.mockImplementationOnce(async()=>Response.json({data:{...value,bytes_base64:Buffer.from('changed').toString('base64')}}));
  await expect(desk.sampleMedia('pub_1',file)).rejects.toMatchObject({code:'MANAGEMENT_RESPONSE_INVALID'});desk.disconnect();
});
it('keeps rights proof separate from sample files and rejects a cross-purpose response',async()=>{
  const bytes=Buffer.from([137,80,78,71,13,10,26,10]),value={publication_id:'pub_1',sample_id:null,rights_record_id:'rights_1',item_id:'proof_1',mime_type:'image/png',size_bytes:bytes.length,sha256:sha256(bytes),bytes_base64:bytes.toString('base64')};
  const transport=vi.fn(async()=>Response.json({data:value}));const desk=new ReviewDeskClient(transport);desk.connect('synthetic');
  expect((await desk.rightsEvidence('pub_1','rights_1','proof_1')).bytes.length).toBe(bytes.length);
  transport.mockImplementationOnce(async()=>Response.json({data:{...value,sample_id:'sample_1'}}));await expect(desk.rightsEvidence('pub_1','rights_1','proof_1')).rejects.toMatchObject({code:'MANAGEMENT_RESPONSE_INVALID'});desk.disconnect();
});
it('rejects late reads from a previous connection and clears its original write on disconnect',async()=>{
  let finish!:(r:Response)=>void;const desk=new ReviewDeskClient(()=>new Promise<Response>(r=>{finish=r;}));desk.connect('first-synthetic');
  const pending=desk.detail('pub_1'),assertion=expect(pending).rejects.toMatchObject({code:'MANAGEMENT_ACCOUNT_CHANGED'});desk.disconnect();desk.connect('second-synthetic');
  finish(Response.json({data:{publication,rights:[],samples:[]}}));await assertion;expect(desk.pending).toBe(false);desk.disconnect();
  await expect(desk.list()).rejects.toMatchObject({code:'MANAGEMENT_LOGIN_REQUIRED'});
});
