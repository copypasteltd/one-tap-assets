import type { HostPort } from '../platform/ports';
import { ClientSession } from '../client/session';
let instance: ClientSession;
declare const __YPCC_API_BASE__: string;
export function configureHost(host: HostPort): void { instance = new ClientSession(host, __YPCC_API_BASE__); }
export function client(): ClientSession { if (!instance) throw new Error('Host bootstrap required'); return instance; }
