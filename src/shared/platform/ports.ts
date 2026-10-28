import type { DTO, Platform } from '../contracts/types.js';
import type { Transport } from '../client/api.js';
export interface LocalPhoto { path: string; bytes: ArrayBuffer; width: number; height: number; mime: 'image/jpeg' | 'image/png'; sha256: string }
export interface LocalStore { get<T>(key: string): T | null; set<T>(key: string, value: T): void; remove(key: string): void }
export interface HostPort {
  platform: Platform; transport: Transport; storage: LocalStore;
  login(): Promise<string>; choosePhotos(): Promise<LocalPhoto[]>;
  upload(grant: DTO<'UploadGrant'>, photo: LocalPhoto): Promise<void>;
  pay(action: DTO<'PaymentAction'>): Promise<'RETURNED' | 'CANCELLED' | 'UNKNOWN'>;
  download(link: DTO<'DownloadLink'>): Promise<string>;
  save(path: string, kind: 'image' | 'video'): Promise<'SAVED' | 'UNKNOWN'>;
  copy(text: string): Promise<void>;
}
