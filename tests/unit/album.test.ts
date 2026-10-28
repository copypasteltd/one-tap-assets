import { it, expect } from 'vitest';
import { AlbumQueue } from '../../src/shared/client/album';
import { ClientSession } from '../../src/shared/client/session';
import { ClientError, type WireRequest } from '../../src/shared/client/api';
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
  const client = new ClientSession(host, 'https://api.example.test'); const attach = (user: string) => client.attach({ access_token: `fixture-${user}`, user_id: user, token_type: 'Bearer', expires_at: '2099-01-01T00:00:00Z' }); attach('buyer-1');
  const item = (id: string, kind: 'image' | 'video' | 'copy'): DTO<'Deliverable'> => ({ deliverable_id: id, kind, slot_id: id, file_name: null, mime_type: null, size_bytes: null, width: null, height: null, fps: null, duration_frames: null, text: kind === 'copy' ? 'fixture copy' : null, sha256: 'a'.repeat(64) });
  const pack: DTO<'Deliverables'> = { order_id: 'order-1', manifest_id: 'manifest-1', manifest_revision: 1, expires_at: '2099-01-01T00:00:00Z', items: [item('image-1', 'image'), item('video-1', 'video'), item('copy-1', 'copy')] };
  return { records, sent, calls, client, pack, attach, allowVideo: () => { failVideo = false; }, rejectReceipts: () => { rejectReceipt = true; }, allowReceipts: () => { rejectReceipt = false; } };
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
