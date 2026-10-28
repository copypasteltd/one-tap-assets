import type { DTO } from '../contracts/types';
import type { ClientSession } from './session';
import { ClientError } from './api';
export interface AlbumItem { id: string; kind: 'image' | 'video'; state: DTO<'AlbumSaveItemState'>; attempt: number; error: string | null; pendingReceipt: boolean; occurredAt: string }
interface Journal { sessionId: string; items: AlbumItem[] }
/** The journal belongs to one buyer, installation and immutable manifest revision. */
export class AlbumQueue {
  private journal: Journal | null = null; private stopped = false; private running = false;
  private readonly key: string;
  private readonly buyerId: string;
  constructor(private readonly client: ClientSession, private readonly pack: DTO<'Deliverables'>, private readonly changed: (items: AlbumItem[]) => void = () => {}) {
    if (!client.api.userId) throw new ClientError('SESSION_REQUIRED', '请登录后保存');
    this.buyerId = client.api.userId;
    this.key = `ypcc:${client.host.platform}:${client.api.userId}:album:${pack.order_id}:${pack.manifest_revision}`;
  }
  get items(): AlbumItem[] { return this.journal?.items.map(i => ({ ...i })) ?? []; }
  stop(): void { this.stopped = true; }
  private scope(): void { if (this.client.api.userId !== this.buyerId) throw new ClientError('SAVE_ACCOUNT_CHANGED', '账户已变化，请回到自己的素材包继续保存'); }
  private publish(): void { this.scope(); this.client.host.storage.set(this.key, this.journal); this.changed(this.items); }
  async open(): Promise<void> {
    this.scope();
    const old = this.client.host.storage.get<Journal>(this.key);
    if (old) {
      const expected = this.pack.items.filter(i => i.kind !== 'copy');
      if (old.items.length !== expected.length || old.items.some(i => !expected.some(x => x.deliverable_id === i.id && x.kind === i.kind))) throw new ClientError('SAVE_RECORD_CHANGED', '保存记录与当前素材包不一致，请联系支持');
      this.journal = old;
      for (const item of old.items) {
        if (item.state === 'SAVING') { item.state = 'UNKNOWN'; item.error = 'CALLBACK_INTERRUPTED'; item.pendingReceipt = true; item.occurredAt = new Date().toISOString(); }
        else if (item.state === 'DOWNLOADING') { item.state = 'PENDING'; item.error = null; }
      }
    } else {
      const media = this.pack.items.filter((i): i is DTO<'Deliverable'> & { kind: 'image' | 'video' } => i.kind !== 'copy');
      if (!media.length) throw new ClientError('NO_ALBUM_ITEMS', '文案可直接复制，本包没有相册素材');
      const request = { order_id: this.pack.order_id, installation_id: this.client.installation(), deliverable_ids: media.map(i => i.deliverable_id) };
      const session = await this.client.api.call('createSaveSession', { body: request, key: this.client.intent('save-session', { ...request, manifest_revision: this.pack.manifest_revision }) });
      this.journal = { sessionId: session.save_session_id, items: media.map(i => ({ id: i.deliverable_id, kind: i.kind, state: 'PENDING', attempt: 0, error: null, pendingReceipt: false, occurredAt: new Date().toISOString() })) };
    }
    this.publish();
  }
  private async report(item: AlbumItem): Promise<void> {
    this.scope();
    if (!item.pendingReceipt || !item.attempt) return;
    const request: DTO<'SaveReceiptRequest'> = { save_session_id: this.journal!.sessionId, deliverable_id: item.id, attempt: item.attempt, state: item.state, error_code: item.error, occurred_at: item.occurredAt };
    try { await this.client.api.call('recordSaveReceipt', { body: request, key: this.client.intent('save-receipt', { ...request, occurred_at: undefined }) }); item.pendingReceipt = false; this.publish(); }
    catch { /* Local confirmed save remains authoritative for this installation; retry the receipt later. */ }
  }
  private async state(item: AlbumItem, state: AlbumItem['state'], error: string | null = null): Promise<void> {
    item.state = state; item.error = error; item.pendingReceipt = true; item.occurredAt = new Date().toISOString(); this.publish(); await this.report(item);
  }
  async run(confirmedMissingIds: string[] = []): Promise<void> {
    this.scope();
    if (this.running) return; if (!this.journal) await this.open(); this.stopped = false; this.running = true;
    try {
      for (const item of this.journal!.items) {
        if (this.stopped) break; await this.report(item);
        if (item.state === 'SAVED' || (item.state === 'UNKNOWN' && !confirmedMissingIds.includes(item.id))) continue;
        if (item.attempt >= 1000) continue; item.attempt++;
        try {
          await this.state(item, 'DOWNLOADING'); if (this.stopped) break;
          const link = await this.client.api.call('createDownloadLink', { params: { deliverable_id: item.id }, key: this.client.intent('download', { session: this.journal!.sessionId, id: item.id, attempt: item.attempt }) });
          const path = await this.client.host.download(link); if (this.stopped) { await this.state(item, 'FAILED', 'SAVE_PAUSED'); break; }
          await this.state(item, 'SAVING');
          const result = await this.client.host.save(path, item.kind); await this.state(item, result, result === 'UNKNOWN' ? 'CALLBACK_UNKNOWN' : null);
        } catch (error) {
          const code = error instanceof ClientError ? error.code : 'ALBUM_PERMISSION_OR_SAVE_FAILED';
          // A missing native callback is ambiguous; a rejected native callback is a known failure.
          await this.state(item, 'FAILED', code);
        }
      }
    } finally { this.running = false; }
  }
}
