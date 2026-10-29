import {it,expect} from 'vitest';
import {ClientSession} from '../../src/shared/client/session';
import {ClientError,type WireRequest} from '../../src/shared/client/api';
import {SupportSubmission} from '../../src/shared/client/support';
import type {HostPort,LocalPhoto} from '../../src/shared/platform/ports';
const expiry='2099-01-01T00:00:00Z';
const photo=(name='a'):LocalPhoto=>({path:`private-${name}.png`,bytes:new Uint8Array([1,2,3]).buffer,width:1000,height:1000,mime:'image/png',sha256:name.repeat(64)});
function fixture(){
  const sent:WireRequest[]=[],stored=new Map<string,unknown>(),uploaded:string[]=[];let complete=false,lose=false,created=false,hidden=false;
  let delegate:((request:WireRequest)=>Promise<unknown>)|undefined;
  const result={ticket_id:'ticket_original',order_id:'order_original',state:'OPEN',category:'SAVE',updated_at:expiry};
  const host:HostPort={platform:'alipay',storage:{get:<T>(k:string)=>(stored.get(k)??null) as T|null,set:(k,v)=>{stored.set(k,v);},remove:k=>{stored.delete(k);}},
    transport:async request=>{sent.push(request);let data:unknown;
      if(delegate)data=await delegate(request);
      else if(request.url.endsWith('/orders/order_original'))data={order_id:'order_original'};
      else if(request.url.endsWith('/assets'))data={asset_id:'asset_original',upload_url:'https://upload.test/private',headers:{}};
      else if(request.url.endsWith('/complete')){
        if(!complete)return {status:409,data:{code:'UPLOAD_NOT_COMPLETE',message:'Not uploaded'},headers:{}};data={asset_id:'asset_original'};
      }else {created=true;if(lose){lose=false;throw new Error('Synthetic committed ACK loss');}data=result;}
      return {status:200,data:{data},headers:{}};},
    login:async()=>'',choosePhotos:async()=>[],upload:async grant=>{uploaded.push(grant.asset_id);complete=true;},download:async()=>'',save:async()=> 'UNKNOWN',copy:async()=>{},pay:async()=> 'UNKNOWN'};
  const client=new ClientSession(host,'https://api.test');const attach=(user:string)=>client.attach({user_id:user,access_token:`fixture-${user}`,token_type:'Bearer',expires_at:expiry});attach('buyer');
  return {client,sent,stored,uploaded,result,attach,submission:()=>new SupportSubmission(client,'order_original',()=>{if(hidden)throw new ClientError('PAGE_HIDDEN','Page hidden');}),
    lose:()=>{lose=true;},created:()=>created,hide:()=>{hidden=true;},delegate:(fn:typeof delegate)=>{delegate=fn;}};
}
const input=()=>({category:'SAVE' as const,message:' 相册保存失败 ',photos:[] as LocalPhoto[]});
it('validates support input before any API call and never stores descriptions, bytes or links',async()=>{
  const f=fixture();for(const bad of [{...input(),message:'   '},{...input(),message:'字'.repeat(2001)},{...input(),photos:Array.from({length:6},()=>photo())},{...input(),photos:[{...photo(),bytes:new ArrayBuffer(10000001)}]}])
    await expect(f.submission().submit(bad)).rejects.toBeInstanceOf(ClientError);
  expect(f.sent).toEqual([]);expect([...f.stored.keys()]).toEqual(['ypcc:last-user']);
});
it('freezes one original submission, shares concurrent calls and skips another mutation after success',async()=>{
  const f=fixture(),s=f.submission(),first=s.submit(input()),second=s.submit(input());expect(first).toBe(second);await first;await s.submit(input());
  const posts=f.sent.filter(r=>r.method==='POST');expect(posts).toHaveLength(1);expect(JSON.parse(String(posts[0]!.body))).toEqual({category:'SAVE',message:'相册保存失败'});expect(s.pending).toBe(false);
});
it('retries the original key and body after a committed ACK is lost without allowing edited content',async()=>{
  const f=fixture(),s=f.submission();f.lose();await expect(s.submit(input())).rejects.toMatchObject({code:'NETWORK_UNKNOWN'});expect(f.created()).toBe(true);expect(s.pending).toBe(true);
  await expect(s.submit({...input(),message:'Different request'})).rejects.toMatchObject({code:'SUPPORT_ORIGINAL_REQUIRED'});await s.submit(input());
  const requests=f.sent.filter(r=>r.url.endsWith('/tickets'));expect(requests).toHaveLength(2);expect(requests[0]!.body).toBe(requests[1]!.body);expect(requests[0]!.headers['Idempotency-Key']).toBe(requests[1]!.headers['Idempotency-Key']);
});
it('reuses the original upload grant and completed asset when retrying a support request',async()=>{
  const f=fixture(),s=f.submission(),value={...input(),photos:[photo()]};f.lose();await expect(s.submit(value)).rejects.toMatchObject({code:'NETWORK_UNKNOWN'});await s.submit(value);
  expect(f.uploaded).toEqual(['asset_original']);const grants=f.sent.filter(r=>r.url.endsWith('/assets'));expect(grants).toHaveLength(2);
  expect(JSON.parse(String(grants[0]!.body)).purpose).toBe('SUPPORT_EVIDENCE');expect(grants[0]!.headers['Idempotency-Key']).toBe(grants[1]!.headers['Idempotency-Key']);
  expect(JSON.stringify([...f.stored])).not.toContain('相册');expect(JSON.stringify([...f.stored])).not.toContain('https://upload');
});
it('stops after a grant resolves if the page was hidden and does not upload or create a ticket',async()=>{
  const f=fixture();f.delegate(async request=>{if(request.url.endsWith('/assets')){f.hide();return {asset_id:'asset_original'};}return {order_id:'order_original'};});
  await expect(f.submission().submit({...input(),photos:[photo()]})).rejects.toMatchObject({code:'PAGE_HIDDEN'});expect(f.uploaded).toEqual([]);expect(f.sent.filter(r=>r.url.endsWith('/complete')||r.url.endsWith('/tickets'))).toEqual([]);
});
it('rejects an account switch during order lookup and a response bound to another order',async()=>{
  for(const changeAccount of [true,false]){
    const f=fixture();f.delegate(async()=>{if(changeAccount)f.attach('stranger');return {order_id:'other-order'};});
    await expect(f.submission().submit({...input(),photos:[photo()]})).rejects.toMatchObject({code:changeAccount?'ACCOUNT_CHANGED':'ORDER_CHANGED'});expect(f.sent).toHaveLength(1);expect(f.uploaded).toEqual([]);
  }
});
it('keeps a mismatched ticket result unresolved instead of displaying it as accepted',async()=>{
  const f=fixture();f.result.order_id='foreign-order';const s=f.submission();await expect(s.submit(input())).rejects.toMatchObject({code:'SUPPORT_RESULT_INVALID'});expect(s.pending).toBe(true);
});
