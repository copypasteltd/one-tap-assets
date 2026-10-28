import type { HostPort } from '../platform/ports.js';
import type { DTO } from '../contracts/types.js';
import { ApiClient, ClientError } from './api.js';
import { fingerprint } from './sha256.js';
export interface RecoveryIds { productId?: string; analysisId?: string; planId?: string; previewId?: string; quoteId?: string; orderId?: string; presetId?: string; presetVersion?: string; batchId?: string }
export class ClientSession {
  readonly api: ApiClient; private loginPromise: Promise<void> | null = null; private account: string | null = null; private identityEpoch = 0;
  constructor(readonly host: HostPort, base: string, allowLocal = false) { this.api = new ApiClient(base, host.transport, () => { this.account = null; }, allowLocal); }
  async login(): Promise<void> {
    if (this.api.userId) return;
    if (this.loginPromise) return this.loginPromise;
    const epoch = this.identityEpoch;
    this.loginPromise = (async () => {
      const code = await this.host.login(); const session = await this.api.call('createPlatformSession', { body: { platform: this.host.platform, code } });
      if (this.identityEpoch !== epoch) throw new ClientError('ACCOUNT_CHANGED', '账户已变化，请重新选择当前会话'); this.attach(session);
    })().finally(() => { this.loginPromise = null; }); return this.loginPromise;
  }
  attach(session: DTO<'Session'>): void {
    this.identityEpoch++;
    const previous = this.host.storage.get<string>('ypcc:last-user');
    if (previous && previous !== session.user_id) this.host.storage.remove(`ypcc:${this.host.platform}:${previous}:recovery`);
    this.account = session.user_id; this.api.setSession(session); this.host.storage.set('ypcc:last-user', session.user_id);
  }
  logout(): void { this.identityEpoch++; if (this.account) this.host.storage.remove(this.key('recovery')); this.api.setSession(null); this.account = null; }
  private key(name: string): string { if (!this.account) throw new Error('Login required'); return `ypcc:${this.host.platform}:${this.account}:${name}`; }
  recover(): RecoveryIds { return this.account ? this.host.storage.get<RecoveryIds>(this.key('recovery')) ?? {} : {}; }
  remember(ids: RecoveryIds): void { this.host.storage.set(this.key('recovery'), { ...this.recover(), ...ids }); }
  // Deterministic within the original logical action, including after a transport timeout or process restart.
  intent(action: string, input: unknown): string { return `ui:${fingerprint(`${this.host.platform}:${this.account}:${action}:${JSON.stringify(input)}`)}`; }
  installation(): string {
    let value = this.host.storage.get<string>('ypcc:installation');
    if (!value) { value = `install-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`; this.host.storage.set('ypcc:installation', value); }
    return value;
  }
}
