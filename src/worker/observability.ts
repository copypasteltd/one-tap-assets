import { AppError } from '../api/lib/errors.js';

export interface WorkerFailure {
  kind: 'APPLICATION' | 'DATABASE' | 'SYSTEM' | 'TYPE' | 'RANGE' | 'SYNTAX' | 'REFERENCE' | 'ERROR' | 'NON_ERROR';
  native_code?: string;
}
export type WorkerFailurePhase = 'AUTHORIZE' | 'HANDLER' | 'RESULT' | 'COMMIT' | 'SETTLEMENT' | 'STARTUP';
export type WorkerLogEvent = {
  event: string; code?: string; resource_id?: string;
  failure?: WorkerFailure; failure_phase?: WorkerFailurePhase;
};
export type WorkerLog = (event: WorkerLogEvent) => void;

// Fixed diagnostic vocabulary only. Never copy messages, stacks, SQL detail,
// paths, causes, constructor names or arbitrary provider codes into logs.
const databaseCodes = new Set(['08000', '08001', '08003', '08006', '08007', '08P01',
  '22001', '22003', '22007', '22008', '22012', '22P02', '23502', '23503', '23505', '23514',
  '25006', '25P02', '40001', '40P01', '42501', '42601', '42703', '42P01',
  '53000', '53100', '53200', '53300', '53400', '55P03', '57014', '57P01', '57P02', '57P03', '58030', 'XX000']);
const systemCodes = new Set(['EACCES', 'EADDRINUSE', 'EBUSY', 'ECONNABORTED', 'ECONNREFUSED',
  'ECONNRESET', 'EEXIST', 'EHOSTUNREACH', 'EIO', 'EISDIR', 'EMFILE', 'ENFILE', 'ENOBUFS',
  'ENOENT', 'ENOMEM', 'ENOSPC', 'ENOTDIR', 'EPERM', 'EPIPE', 'ETIMEDOUT', 'EAI_AGAIN', 'ENOTFOUND']);

export function failureMetadata(error: unknown): WorkerFailure {
  try {
    if (error instanceof AppError) return { kind: 'APPLICATION' };
    if (!(error instanceof Error)) return { kind: 'NON_ERROR' };
    // Do not invoke accessors supplied by an external error object.
    const descriptor = Object.getOwnPropertyDescriptor(error, 'code');
    const code: unknown = descriptor && 'value' in descriptor ? descriptor.value : undefined;
    if (typeof code === 'string' && databaseCodes.has(code)) return { kind: 'DATABASE', native_code: code };
    if (typeof code === 'string' && systemCodes.has(code)) return { kind: 'SYSTEM', native_code: code };
    if (error instanceof TypeError) return { kind: 'TYPE' };
    if (error instanceof RangeError) return { kind: 'RANGE' };
    if (error instanceof SyntaxError) return { kind: 'SYNTAX' };
    if (error instanceof ReferenceError) return { kind: 'REFERENCE' };
    return { kind: 'ERROR' };
  } catch { return { kind: 'NON_ERROR' }; }
}

export function emitWorkerLog(log: WorkerLog | undefined, event: WorkerLogEvent): void {
  // An observational sink cannot commit, fail, retry or buy work.
  try {
    const result: unknown = log?.(event);
    if (result !== undefined) void Promise.resolve(result).catch(() => {});
  } catch { /* Work settlement remains authoritative. */ }
}
