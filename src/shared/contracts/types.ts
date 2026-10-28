import type { components } from './api.generated.js';
export type SchemaName = keyof components['schemas'];
export type DTO<N extends SchemaName> = components['schemas'][N];
export type Platform = DTO<'Platform'>;
export interface Principal { tenantId: string; userId: string; sessionId: string; platform: Platform; appId: string; subjectId: string }
export interface ManagementPrincipal { actor: string; permissions: ReadonlySet<string> }
