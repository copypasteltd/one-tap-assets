import type { DTO } from '../contracts/types.js';
import type { ClientSession } from './session.js';

/** Best effort only. Never log or persist signed tokens or retry a stale card. */
export async function reportRecommendationEvent(client: ClientSession, buyer: string | null, productId: string, item: DTO<'Recommendation'>, kind: DTO<'RecommendationEventRequest'>['kind']): Promise<void> {
  if (!buyer || client.api.userId !== buyer || client.recover().productId !== productId || !item.measurement
    || !Number.isFinite(Date.parse(item.measurement.expires_at)) || Date.parse(item.measurement.expires_at) <= Date.now()) return;
  try { await client.api.call('recordRecommendationEvent', { params: { product_id: productId }, body: { measurement_token: item.measurement.token, kind } }); }
  catch { /* Telemetry cannot block selecting, paying for or receiving an asset. */ }
}
