import { it, expect, vi } from 'vitest';
import { visibleDwell } from '../../src/shared/domain/recommendation-events';
import { reportRecommendationEvent } from '../../src/shared/client/recommendation-events';
import type { ClientSession } from '../../src/shared/client/session';
import type { DTO } from '../../src/shared/contracts/types';

it('requires an uninterrupted visible dwell and cancels on hiding or unmount', () => {
  vi.useFakeTimers();
  try {
    const report = vi.fn(), dwell = visibleDwell(report);
    dwell.ratio(.49); vi.advanceTimersByTime(700); expect(report).not.toHaveBeenCalled();
    dwell.ratio(.5); vi.advanceTimersByTime(300); dwell.ratio(0); vi.advanceTimersByTime(400); expect(report).not.toHaveBeenCalled();
    dwell.ratio(.8); vi.advanceTimersByTime(499); dwell.stop(); vi.advanceTimersByTime(2); expect(report).not.toHaveBeenCalled();
    dwell.ratio(.5); vi.advanceTimersByTime(500); dwell.ratio(1); vi.advanceTimersByTime(1000); expect(report).toHaveBeenCalledTimes(1);
  } finally { vi.useRealTimers(); }
});
const item = () => ({ measurement: { token: 'synthetic-not-a-server-token', expires_at: new Date(Date.now() + 10000).toISOString() } }) as DTO<'Recommendation'>;
function setup() {
  const call = vi.fn(async (..._args: unknown[]) => ({ accepted: true, duplicate: false }));
  const client = { api: { userId: 'buyer-a', call }, recover: () => ({ productId: 'product-a' }) } as unknown as ClientSession;
  return { client, call };
}
it('drops expired, unsupported and changed-account/product telemetry without relogging', async () => {
  const { client, call } = setup();
  await reportRecommendationEvent(client, 'buyer-b', 'product-a', item(), 'CLICK');
  await reportRecommendationEvent(client, 'buyer-a', 'product-b', item(), 'CLICK');
  await reportRecommendationEvent(client, 'buyer-a', 'product-a', {} as DTO<'Recommendation'>, 'IMPRESSION');
  const expired = item(); expired.measurement!.expires_at = '2020-01-01T00:00:00Z';
  await reportRecommendationEvent(client, 'buyer-a', 'product-a', expired, 'IMPRESSION');
  expect(call).not.toHaveBeenCalled();
});
it('reports a click independently and absorbs a failed telemetry request', async () => {
  const { client, call } = setup(); call.mockRejectedValueOnce(new Error('synthetic offline'));
  await expect(reportRecommendationEvent(client, 'buyer-a', 'product-a', item(), 'CLICK')).resolves.toBeUndefined();
  expect(call).toHaveBeenCalledTimes(1); expect(call.mock.calls[0]).toEqual(['recordRecommendationEvent', expect.objectContaining({ body: expect.objectContaining({ kind: 'CLICK' }) })]);
});
