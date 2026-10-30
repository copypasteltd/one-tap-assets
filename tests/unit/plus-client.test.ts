import {it,expect} from 'vitest';
import {PlusClient} from '../../src/web/client';
import type {DTO} from '../../src/shared/contracts/types';
import type {WireRequest} from '../../src/shared/client/api';
const link:DTO<'PlusLink'>={link_id:'pluslink_synthetic',user_code:'ABCD2345',poll_key:'p'.repeat(43),expires_at:new Date(Date.now()+300000).toISOString(),poll_interval_seconds:3};
const session=():DTO<'PlusBrowserSession'>=>({access_token:'s'.repeat(43),token_type:'Bearer',user_id:'synthetic-buyer',expires_at:new Date(Date.now()+3600000).toISOString(),connection:{session_id:'plussession_'+'a'.repeat(32),platform:'alipay',created_at:new Date().toISOString(),expires_at:new Date(Date.now()+3600000).toISOString(),state:'ACTIVE'}});
const response=(data:unknown)=>({status:200,headers:{},data:{data}});
it('uses a separate poll secret, keeps approval in memory and drops it on disconnect',async()=>{
  const seen:WireRequest[]=[],s=session();const client=new PlusClient('https://synthetic.invalid',async input=>{seen.push(input);return response(input.url.endsWith('/poll')?{state:'APPROVED',session:s}:{items:[],next_cursor:null});});
  await client.poll(link);expect(client.connected()).toEqual(s);expect(seen[0]!.headers.Authorization).toBeUndefined();expect(String(seen[0]!.body)).toContain(link.poll_key);
  await client.call('listProducts');expect(seen[1]!.headers.Authorization).toBe(`Bearer ${s.access_token}`);
  client.disconnect();expect(client.connected()).toBeUndefined();await expect(client.call('listProducts')).rejects.toBeTruthy();expect(seen).toHaveLength(2);
});
it('never adopts a delayed approved poll after the user disconnects',async()=>{
  let resolve!:(data:ReturnType<typeof response>)=>void;
  const client=new PlusClient('https://synthetic.invalid',()=>new Promise(done=>{resolve=done;}));const pending=client.poll(link);client.disconnect();resolve(response({state:'APPROVED',session:session()}));
  await expect(pending).rejects.toMatchObject({code:'PLUS_CONNECTION_CHANGED'});expect(client.connected()).toBeUndefined();
});
it('does not return an old private read after changing the connection',async()=>{
  let resolve!:(data:ReturnType<typeof response>)=>void;const client=new PlusClient('https://synthetic.invalid',async input=>input.url.endsWith('/poll')?response({state:'APPROVED',session:session()}):new Promise(done=>{resolve=done;}));
  await client.poll(link);const pending=client.call('listProducts');client.disconnect();resolve(response({items:[{private:'old account'}],next_cursor:null}));
  await expect(pending).rejects.toMatchObject({code:'PLUS_CONNECTION_CHANGED'});
});
