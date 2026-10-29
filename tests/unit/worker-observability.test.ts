import { describe, expect, it } from 'vitest';
import { AppError } from '../../src/api/lib/errors.js';
import { errorCode } from '../../src/worker/runtime.js';
import { emitWorkerLog, failureMetadata } from '../../src/worker/observability.js';

describe('worker failure privacy and observational isolation', () => {
  it('retains fixed categories without copying arbitrary secret-bearing error fields', () => {
    const secret = 'synthetic-private-token-and-customer-value';
    const failure = Object.assign(new TypeError(secret), { name: secret, stack: secret,
      cause: { token: secret }, detail: secret, query: secret, path: secret, code: secret });
    expect(errorCode(failure)).toBe('WORKER_INTERNAL_ERROR');
    expect(failureMetadata(failure)).toEqual({ kind: 'TYPE' });
    expect(JSON.stringify(failureMetadata(failure))).not.toContain(secret);
    expect(failureMetadata(Object.assign(new Error(secret), { code: '22P02', detail: secret })))
      .toEqual({ kind: 'DATABASE', native_code: '22P02' });
    expect(failureMetadata(Object.assign(new Error(secret), { code: 'ENOSPC', path: secret })))
      .toEqual({ kind: 'SYSTEM', native_code: 'ENOSPC' });
    const application = new AppError('VOICE_LICENSE_REVOKED', secret, 409, false, [{ field: secret, reason: secret }]);
    expect(errorCode(application)).toBe('VOICE_LICENSE_REVOKED');
    expect(failureMetadata(application)).toEqual({ kind: 'APPLICATION' });
    expect(failureMetadata({ message: secret, code: '22P02' })).toEqual({ kind: 'NON_ERROR' });
  });
  it('never invokes external code accessors or lets a broken sink escape into execution', async () => {
    let touched = false;
    const failure = Object.defineProperty(new Error('private'), 'code', { get() { touched = true; throw new Error('private'); } });
    expect(failureMetadata(failure)).toEqual({ kind: 'ERROR' }); expect(touched).toBe(false);
    const hostile = new Proxy(new Error('private'), { getOwnPropertyDescriptor() { throw new Error('private'); } });
    expect(failureMetadata(hostile)).toEqual({ kind: 'NON_ERROR' });
    expect(() => emitWorkerLog(() => { throw new Error('diagnostic sink is unavailable'); },
      { event: 'stage_succeeded', resource_id: 'stage-synthetic' })).not.toThrow();
    emitWorkerLog(async () => { throw new Error('asynchronous diagnostic sink is unavailable'); }, { event: 'stage_succeeded' });
    await new Promise<void>(resolve => setImmediate(resolve));
  });
});
