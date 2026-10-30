import { it, expect } from 'vitest';
import { matchProductStyles } from '../../src/shared/domain/recommendations';
import { rawProfile } from '../helpers/fixtures';
import { readRecommendations } from '../../src/shared/client/recommendations';
import { ClientSession } from '../../src/shared/client/session';
import type { HostPort } from '../../src/shared/platform/ports';
import type { DTO } from '../../src/shared/contracts/types';

it('ranks the recognized category and evidence-backed structure above generic styles', () => {
  const scores = matchProductStyles(rawProfile(), ['asset-a', 'asset-b', 'asset-c']);
  expect(scores['fresh-daily']!.score).toBeGreaterThan(scores['feature-cards']!.score);
  expect(scores['feature-cards']!.score).toBeGreaterThan(scores['minimal-clean']!.score);
});
it('ignores hypotheses and observations with missing or foreign photo evidence', () => {
  const profile = rawProfile(); profile.category = null;
  profile.observations[0]!.evidence_ids = ['missing']; profile.observations[1]!.source_asset_ids = ['foreign'];
  const scores = matchProductStyles(profile, ['asset-a', 'asset-b', 'asset-c']);
  expect(scores['color-pop']).toBeUndefined(); expect(scores['feature-cards']).toBeUndefined();
  expect(Object.keys(scores)).toEqual(['minimal-clean', 'portrait-social', 'launch-story']);
});
it('routes a recognized food category without copying unconfirmed product claims into reasons', () => {
  const profile = rawProfile(); profile.category = '烘焙/面包'; profile.unknowns = ['有机认证', '健康功效'];
  const scores = matchProductStyles(profile, ['asset-a', 'asset-b', 'asset-c']);
  expect(scores['appetite-flash']!.score).toBe(90); expect(JSON.stringify(scores)).not.toMatch(/有机|功效/);
});

const expected = { product_id: 'product-a', profile_id: 'profile-a', photo_version: 1 };
const auth = (user = 'a'): DTO<'Session'> => ({ user_id: user, access_token: `synthetic-${user}`, token_type: 'Bearer', expires_at: '2099-01-01T00:00:00Z' });
function setup(onRequest?: (path: string, count: number, client: ClientSession) => void) {
  const records = new Map<string, unknown>(), calls: string[] = []; let count = 0;
  const host = { platform: 'alipay', storage: { get: (k: string) => records.get(k) ?? null, set: (k: string, v: unknown) => records.set(k, v), remove: (k: string) => records.delete(k) },
    transport: async (request: { url: string; method: string }) => {
      const path = new URL(request.url).pathname; calls.push(request.method + ' ' + path); onRequest?.(path, ++count, client);
      return { status: 200, headers: {}, data: { data: path.endsWith('/preset-recommendations') ? { items: [], next_cursor: null } : { ...expected } } };
    } } as unknown as HostPort;
  const client = new ClientSession(host, 'https://synthetic.invalid'); client.attach(auth()); client.remember({ productId: expected.product_id, presetId: 'keep-style', variantId: 'keep-spec' });
  return { client, calls };
}
it('reads a recommendation without replacing the selected style or creating a plan/charge', async () => {
  const { client, calls } = setup(); expect(await readRecommendations(client, expected)).toEqual({ items: [], next_cursor: null });
  expect(calls).toHaveLength(3); expect(calls.every(c => c.startsWith('GET '))).toBe(true);
  expect(client.recover()).toMatchObject({ presetId: 'keep-style', variantId: 'keep-spec' });
});
it('discards a response when the buyer changes while recommendations load', async () => {
  const { client } = setup((path, _n, c) => { if (path.endsWith('/preset-recommendations')) c.attach(auth('b')); });
  await expect(readRecommendations(client, expected)).rejects.toMatchObject({ code: 'ACCOUNT_CHANGED' });
});
it('discards a response after the active draft changes', async () => {
  const { client } = setup((path, _n, c) => { if (path.endsWith('/preset-recommendations')) c.remember({ productId: 'other' }); });
  await expect(readRecommendations(client, expected)).rejects.toMatchObject({ code: 'INPUT_VERSION_CHANGED' });
});
