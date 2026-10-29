import type { DTO } from '../contracts/types';
import type { ClientSession } from './session';
import { ClientError } from './api';
export interface AlbumItem { id: string; kind: 'image' | 'video'; state: DTO<'AlbumSaveItemState'>; attempt: number; error: string | null; pendingReceipt: boolean; occurredAt: string }
interface Journal { sessionId: string; items: AlbumItem[] }
export interface AlbumSelection { kind?:'image'|'video'; deliverableIds?:string[]; confirmedMissingIds?:string[] }
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
  private saved(item:AlbumItem):boolean {return item.state==='SAVED';}
  private mergeConfirmed():void {
    const stored=this.client.host.storage.get<Journal>(this.key);
    if(!this.journal||stored?.sessionId!==this.journal.sessionId||!Array.isArray(stored.items))return;
    for(const item of this.journal.items){
      const known=stored.items.find(i=>i&&i.id===item.id&&i.kind===item.kind&&i.state==='SAVED');
      if(known&&item.state!=='SAVED')Object.assign(item,known);
    }
  }
  private publish(): void { this.scope(); this.mergeConfirmed();this.client.host.storage.set(this.key, this.journal); this.changed(this.items); }
  /** Restore local progress without creating a server session or invoking the album. */
  restore():boolean {
    this.scope();
    if(this.journal){this.changed(this.items);return true;}
    const old = this.client.host.storage.get<Journal>(this.key);
    if (old) {
      const expected = this.pack.items.filter(i => i.kind !== 'copy');
      if (!Array.isArray(old.items)||!old.sessionId||old.items.length !== expected.length
        ||old.items.some(i => !i||!expected.some(x => x.deliverable_id === i.id && x.kind === i.kind)||!['PENDING','DOWNLOADING','SAVING','SAVED','FAILED','UNKNOWN'].includes(i.state)
          ||!Number.isSafeInteger(i.attempt)||i.attempt<0||i.attempt>1000)||new Set(old.items.map(i=>i.id)).size!==expected.length) throw new ClientError('SAVE_RECORD_CHANGED', '保存记录与当前素材包不一致，请联系支持');
      this.journal = {sessionId:old.sessionId,items:old.items.map(i=>({...i}))};
      for (const item of this.journal.items) {
        if (item.state === 'SAVING') { item.state = 'UNKNOWN'; item.error = 'CALLBACK_INTERRUPTED'; item.pendingReceipt = true; item.occurredAt = new Date().toISOString(); }
        else if (item.state === 'DOWNLOADING') { item.state = 'PENDING'; item.error = null; }
      }
      this.publish();return true;
    }return false;
  }
  async open(): Promise<void> {
    this.scope();if(this.restore())return;
      const media = this.pack.items.filter((i): i is DTO<'Deliverable'> & { kind: 'image' | 'video' } => i.kind !== 'copy');
      if (!media.length) throw new ClientError('NO_ALBUM_ITEMS', '文案可直接复制，本包没有相册素材');
      const request = { order_id: this.pack.order_id, installation_id: this.client.installation(), deliverable_ids: media.map(i => i.deliverable_id) };
      const session = await this.client.api.call('createSaveSession', { body: request, key: this.client.intent('save-session', { ...request, manifest_revision: this.pack.manifest_revision }) });
      this.scope();
      if(!session.save_session_id||session.order_id!==request.order_id||session.installation_id!==request.installation_id||session.deliverable_ids.length!==media.length||new Set(session.deliverable_ids).size!==media.length
        ||session.deliverable_ids.some(id=>!request.deliverable_ids.includes(id)))throw new ClientError('SAVE_SESSION_INVALID','保存会话与原素材包不一致，请重新查询');
      this.journal = { sessionId: session.save_session_id, items: media.map(i => ({ id: i.deliverable_id, kind: i.kind, state: 'PENDING', attempt: 0, error: null, pendingReceipt: false, occurredAt: new Date().toISOString() })) };
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
  async run(selection:AlbumSelection|string[] = {}): Promise<void> {
    this.scope();
    if (this.running) return;this.stopped = false; this.running = true;
    try {
      const options:AlbumSelection=Array.isArray(selection)?{confirmedMissingIds:selection}:selection;
      if(options.deliverableIds?.some(id=>!this.pack.items.some(i=>i.deliverable_id===id&&i.kind!=='copy')))
        throw new ClientError('SAVE_SELECTION_INVALID','保存列表与原素材包不一致');
      if (!this.journal) await this.open();this.scope();this.mergeConfirmed();
      for (const item of this.journal!.items) {
        if (this.stopped) break;this.scope();
        if((options.kind&&item.kind!==options.kind)||(options.deliverableIds&&!options.deliverableIds.includes(item.id)))continue;
        await this.report(item);if(this.stopped)break;this.mergeConfirmed();
        if (item.state === 'SAVED' || (item.state === 'UNKNOWN' && !options.confirmedMissingIds?.includes(item.id))) continue;
        if (item.attempt >= 1000) continue; item.attempt++;
        let nativeReturned=false;
        try {
          await this.state(item, 'DOWNLOADING'); if (this.stopped) break;if(this.saved(item))continue;
          const link = await this.client.api.call('createDownloadLink', { params: { deliverable_id: item.id }, key: this.client.intent('download', { session: this.journal!.sessionId, id: item.id, attempt: item.attempt }) });
          this.scope();if(this.stopped){await this.state(item,'FAILED','SAVE_PAUSED');break;}this.mergeConfirmed();if(this.saved(item))continue;
          if(link.deliverable_id!==item.id)throw new ClientError('SAVE_LINK_INVALID','领取链接与当前素材不一致，请重新查询');
          const path = await this.client.host.download(link); if (this.stopped) { await this.state(item, 'FAILED', 'SAVE_PAUSED'); break; }
          await this.state(item, 'SAVING');
          this.scope();if(this.stopped){await this.state(item,'FAILED','SAVE_PAUSED');break;}this.mergeConfirmed();if(this.saved(item))continue;
          const result = await this.client.host.save(path, item.kind);nativeReturned=true;
          await this.state(item, result, result === 'UNKNOWN' ? 'CALLBACK_UNKNOWN' : null);
        } catch (error) {
          if(nativeReturned)throw error; // A journal write failure must never downgrade a confirmed native result to FAILED.
          const code = error instanceof ClientError ? error.code : 'ALBUM_PERMISSION_OR_SAVE_FAILED';
          // A missing native callback is ambiguous; a rejected native callback is a known failure.
          await this.state(item, 'FAILED', code);
        }
      }
    } finally { this.running = false; }
  }
}
