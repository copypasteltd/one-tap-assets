import { it, expect } from 'vitest';
import { AlbumQueue } from '../../src/shared/client/album';
import { ClientSession } from '../../src/shared/client/session';
import { ClientError, type WireRequest,type Transport } from '../../src/shared/client/api';
import type { DTO } from '../../src/shared/contracts/types';
import type { HostPort } from '../../src/shared/platform/ports';
function fixture() {
  const records = new Map<string, unknown>(); const sent: WireRequest[] = []; const calls: string[] = []; let rejectReceipt = false; let failVideo = true;
  const host: HostPort = { platform: 'alipay', storage: { get: <T,>(key: string) => structuredClone(records.get(key) ?? null) as T | null,
    set: (key, value) => { records.set(key, structuredClone(value)); }, remove: key => { records.delete(key); } },
    login: async () => { throw new Error('No native login in unit test'); }, choosePhotos: async () => [], upload: async () => {}, copy: async () => {},
    pay: async () => 'UNKNOWN', download: async link => link.deliverable_id,
    save: async (path, kind) => { calls.push(path); if (kind === 'video' && failVideo) throw new ClientError('PERMISSION_DENIED', 'fixture rejection'); return 'SAVED'; },
    transport: async request => {
      sent.push(request); const body = request.body ? JSON.parse(String(request.body)) : null;
      if (request.url.endsWith('/save-sessions')) return { status: 201, data: { data: { save_session_id: 'save-1', ...body, created_at: '2026-10-27T00:00:00Z' } }, headers: {} };
      if (request.url.endsWith('/save-receipts')) { if (rejectReceipt && body.state === 'SAVED') throw new Error('Lost receipt response'); return { status: 200, data: { data: { receipt_id: 'receipt-1', accepted: true } }, headers: {} }; }
      const id = /deliverables\/([^/]+)/.exec(request.url)![1]!; return { status: 200, data: { data: { deliverable_id: id, url: `https://api.example.test/file/${id}`, expires_at: '2099-01-01T00:00:00Z', ttl_seconds: 300 } }, headers: {} };
    },
  };
  let actualTransport=host.transport;host.transport=request=>actualTransport(request);
  const client = new ClientSession(host, 'https://api.example.test'); const attach = (user: string) => client.attach({ access_token: `fixture-${user}`, user_id: user, token_type: 'Bearer', expires_at: '2099-01-01T00:00:00Z' }); attach('buyer-1');
  const item = (id: string, kind: 'image' | 'video' | 'copy'): DTO<'Deliverable'> => ({ deliverable_id: id, kind, slot_id: id, file_name: null, mime_type: null, size_bytes: null, width: null, height: null, fps: null, duration_frames: null, text: kind === 'copy' ? 'fixture copy' : null, sha256: 'a'.repeat(64) });
  const pack: DTO<'Deliverables'> = { order_id: 'order-1', manifest_id: 'manifest-1', manifest_revision: 1, expires_at: '2099-01-01T00:00:00Z', items: [item('image-1', 'image'), item('video-1', 'video'), item('copy-1', 'copy')] };
  return { records, sent, calls, client, pack, attach,wrapTransport:(wrap:(next:Transport)=>Transport)=>{actualTransport=wrap(actualTransport);}, allowVideo: () => { failVideo = false; }, rejectReceipts: () => { rejectReceipt = true; }, allowReceipts: () => { rejectReceipt = false; } };
}
it('resumes only failed media and never mistakes downloaded bytes or a lost receipt for a failed native save', async () => {
  const f = fixture(); f.rejectReceipts(); const queue = new AlbumQueue(f.client, f.pack); await queue.run();
  expect(queue.items.map(i => i.state)).toEqual(['SAVED', 'FAILED']); expect(f.calls).toEqual(['image-1', 'video-1']);
  const original = f.sent.find(r => r.url.endsWith('/save-receipts') && JSON.parse(String(r.body)).state === 'SAVED')!;
  f.allowReceipts(); f.allowVideo(); const resumed = new AlbumQueue(f.client, f.pack); await resumed.run();
  expect(resumed.items.map(i => i.state)).toEqual(['SAVED', 'SAVED']); expect(f.calls).toEqual(['image-1', 'video-1', 'video-1']);
  const receipts = f.sent.filter(r => r.headers['Idempotency-Key'] === original.headers['Idempotency-Key']); expect(receipts).toHaveLength(2); expect(receipts[0]!.body).toBe(receipts[1]!.body);
  expect(f.sent.filter(r => r.url.endsWith('/save-sessions'))).toHaveLength(1);
});
it('requires explicit confirmation before repeating a save whose callback was interrupted', async () => {
  const f = fixture(); const first = new AlbumQueue(f.client, f.pack); await first.open();
  const key = 'ypcc:alipay:buyer-1:album:order-1:1'; const record = f.records.get(key) as { items: { state: string; attempt: number }[] };
  record.items[0]!.state = 'SAVING'; record.items[0]!.attempt = 1; f.records.set(key, record);
  const resumed = new AlbumQueue(f.client, f.pack); await resumed.run(); expect(resumed.items[0]!.state).toBe('UNKNOWN'); expect(f.calls).not.toContain('image-1');
  await resumed.run(['image-1']); expect(f.calls.filter(c => c === 'image-1')).toHaveLength(1); expect(resumed.items[0]!.attempt).toBe(2);
});
it('fences an existing local save queue when the buyer changes', async () => {
  const f = fixture(); const queue = new AlbumQueue(f.client, f.pack); await queue.open(); f.attach('buyer-2');
  const count = f.sent.length; await expect(queue.run()).rejects.toMatchObject({ code: 'SAVE_ACCOUNT_CHANGED' }); expect(f.sent.length).toBe(count); expect(f.calls).toHaveLength(0);
  expect(f.client.recover()).toEqual({});
});
it('saves only the selected media kind and reuses one original session without resaving success',async()=>{
  const f=fixture(),queue=new AlbumQueue(f.client,f.pack);await queue.run({kind:'image'});
  expect(f.calls).toEqual(['image-1']);expect(queue.items.map(i=>i.state)).toEqual(['SAVED','PENDING']);
  f.allowVideo();await queue.run({kind:'video'});await queue.run();expect(f.calls).toEqual(['image-1','video-1']);
  expect(f.sent.filter(r=>r.url.endsWith('/save-sessions'))).toHaveLength(1);
  expect(f.sent.every(r=>!r.url.includes('/orders')&&!r.url.includes('/quotes'))).toBe(true);
});
it('restores the exact local journal before any API or native call and detects duplicate media entries',async()=>{
  const f=fixture();await new AlbumQueue(f.client,f.pack).run({kind:'image'});const count=f.sent.length;
  const restored=new AlbumQueue(f.client,f.pack);expect(restored.restore()).toBe(true);
  expect(restored.items.map(i=>i.state)).toEqual(['SAVED','PENDING']);expect(f.sent.length).toBe(count);expect(f.calls).toEqual(['image-1']);
  const key='ypcc:alipay:buyer-1:album:order-1:1',record=f.records.get(key) as {items:unknown[]};record.items[1]=record.items[0];f.records.set(key,record);
  expect(()=>new AlbumQueue(f.client,f.pack).restore()).toThrowError(expect.objectContaining({code:'SAVE_RECORD_CHANGED'}));
});
function gate(){let release!:()=>void;return {promise:new Promise<void>(done=>{release=done;}),release:()=>release()};}
it('stops while the original save-session response is pending and never resets that stop after opening',async()=>{
  const f=fixture(),entered=gate(),resume=gate();
  f.wrapTransport(next=>async r=>{if(r.url.endsWith('/save-sessions')){entered.release();await resume.promise;}return next(r);});
  const queue=new AlbumQueue(f.client,f.pack),running=queue.run();await entered.promise;queue.stop();resume.release();await running;
  expect(f.calls).toEqual([]);expect(queue.items.map(i=>i.state)).toEqual(['PENDING','PENDING']);
  await queue.run({kind:'image'});expect(f.calls).toEqual(['image-1']);expect(f.sent.filter(r=>r.url.endsWith('/save-sessions'))).toHaveLength(1);
});
it('rechecks pause after the SAVING receipt resolves and before invoking the native album',async()=>{
  const f=fixture(),entered=gate(),resume=gate();
  f.wrapTransport(next=>async r=>{if(r.url.endsWith('/save-receipts')&&JSON.parse(String(r.body)).state==='SAVING'){entered.release();await resume.promise;}return next(r);});
  const queue=new AlbumQueue(f.client,f.pack),running=queue.run();await entered.promise;queue.stop();resume.release();await running;
  expect(f.calls).toEqual([]);expect(queue.items.map(i=>[i.state,i.error])).toEqual([['FAILED','SAVE_PAUSED'],['PENDING',null]]);
});
it('fences an account change while a local download completes, before the native write',async()=>{
  const f=fixture(),entered=gate(),resume=gate();f.client.host.download=async()=>{entered.release();await resume.promise;return 'original-private-temp-file';};
  const queue=new AlbumQueue(f.client,f.pack),running=queue.run({kind:'image'});await entered.promise;f.attach('buyer-2');resume.release();
  await expect(running).rejects.toMatchObject({code:'SAVE_ACCOUNT_CHANGED'});expect(f.calls).toEqual([]);
  expect(f.sent.every(r=>r.headers.Authorization==='Bearer fixture-buyer-1')).toBe(true);
});
it('retries one explicitly missing UNKNOWN item without invoking unrelated failed media',async()=>{
  const f=fixture();const first=new AlbumQueue(f.client,f.pack);await first.open();const key='ypcc:alipay:buyer-1:album:order-1:1';
  const record=f.records.get(key) as {items:{state:string;attempt:number}[]};record.items[0]!.state='UNKNOWN';record.items[0]!.attempt=1;
  record.items[1]!.state='FAILED';record.items[1]!.attempt=1;f.records.set(key,record);
  const queue=new AlbumQueue(f.client,f.pack);await queue.run({deliverableIds:['image-1'],confirmedMissingIds:['image-1']});
  expect(f.calls).toEqual(['image-1']);expect(queue.items.map(i=>[i.state,i.attempt])).toEqual([['SAVED',2],['FAILED',1]]);
});
it('rejects a mismatched download link before fetching or saving any bytes',async()=>{
  const f=fixture();let downloads=0;f.client.host.download=async()=>{downloads++;return 'wrong';};
  f.wrapTransport(next=>async r=>r.url.includes('/download-link')?{status:200,headers:{},data:{data:{deliverable_id:'another-item',url:'https://api.example.test/wrong',expires_at:'2099-01-01T00:00:00Z',ttl_seconds:300}}}:next(r));
  const queue=new AlbumQueue(f.client,f.pack);await queue.run({kind:'image'});expect(downloads).toBe(0);expect(f.calls).toEqual([]);
  expect(queue.items[0]).toMatchObject({state:'FAILED',error:'SAVE_LINK_INVALID'});
  await expect(queue.run({deliverableIds:['copy-1']})).rejects.toMatchObject({code:'SAVE_SELECTION_INVALID'});
});
it('never writes FAILED when local persistence fails after a confirmed native save',async()=>{
  const f=fixture(),set=f.client.host.storage.set;let fail=true;
  f.client.host.storage.set=(key,value)=>{if(fail&&key.includes(':album:')&&(value as {items?:{state:string}[]})?.items?.some(i=>i.state==='SAVED')){fail=false;throw new Error('Synthetic local storage full after native success');}set(key,value);};
  const queue=new AlbumQueue(f.client,f.pack);await expect(queue.run({kind:'image'})).rejects.toThrow('Synthetic local storage');
  expect(queue.items[0]!.state).toBe('SAVED');expect(f.calls).toEqual(['image-1']);
  const resumed=new AlbumQueue(f.client,f.pack);await resumed.run({kind:'image'});expect(resumed.items[0]!.state).toBe('UNKNOWN');expect(f.calls).toEqual(['image-1']);
});
it('merges late original success after reopening instead of repeating a stale UNKNOWN native save',async()=>{
  const f=fixture(),entered=gate(),resume=gate();f.client.host.save=async path=>{f.calls.push(path);entered.release();await resume.promise;return 'SAVED';};
  const original=new AlbumQueue(f.client,f.pack),running=original.run({kind:'image'});await entered.promise;original.stop();
  const reopened=new AlbumQueue(f.client,f.pack);expect(reopened.restore()).toBe(true);expect(reopened.items[0]!.state).toBe('UNKNOWN');
  resume.release();await running;await reopened.run({deliverableIds:['image-1'],confirmedMissingIds:['image-1']});
  expect(f.calls).toEqual(['image-1']);expect(reopened.items[0]!.state).toBe('SAVED');
});
