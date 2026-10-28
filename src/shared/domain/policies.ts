export const POLICIES = Object.freeze({
  quoteTtlSeconds: 900, linkTtlSeconds: 300, inputUnpaidHours: 24,
  deliveryDays: 7, revisionHours: 48, previewsPerDay: 5,
  minPhotos: 3, maxPhotos: 5, maxPhotoBytes: 10_000_000, maxTotalBytes: 50_000_000,
  maxPhotoPixels: 30_000_000, minShortEdge: 640, maxRepairRounds: 1,
  termsVersion: 'YPCC-TERMS-3.1', qcVersion: 'YPCC-QC-1.1',
});
export const DEADLINES = { PHOTO_LAYOUT: 600, PER_SHOT_AI: 1800, REFERENCE_FILM: 3600 } as const;
export type Engine = keyof typeof DEADLINES;
export type AgentRole = 'CONTENT' | 'PRODUCTION' | 'POST' | 'REVIEW_FACTS' | 'REVIEW_STYLE';
export const AGENT_ROLES: AgentRole[] = ['CONTENT', 'PRODUCTION', 'POST', 'REVIEW_FACTS', 'REVIEW_STYLE'];
export function isTerminalFulfillment(state: string): boolean { return ['FAILED', 'CANCELLED', 'DELIVERED'].includes(state); }
