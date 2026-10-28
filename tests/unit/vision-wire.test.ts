import { it, expect } from 'vitest';
import { prepareVision, type VisionWireContract } from '../../src/worker/providers/vision.js';

it('binds a recoverable vision intent to the exact transmitted image bytes', () => {
  const contract: VisionWireContract = { schema_version: '1.0.0', state: 'ADMITTED', wire: 'OPENAI_CHAT_COMPLETIONS', provider: 'test-fixture',
    actual_model: 'fixture-model', base_url: 'https://vision.example.test/v1', registry_version: 'fixture-1', rate_version: 'fixture-rate-1',
    official_documentation: 'https://developers.openai.com/api/docs/guides/images-vision', capability_evidence_sha256: 'a'.repeat(64),
    valid_until: '2099-01-01T00:00:00Z', max_images: 5, max_image_edge: 1536, max_total_pixels: 11796480,
    max_request_bytes: 16000000, max_output_tokens: 6000, certified_max_input_tokens: 16000,
    input_micro_per_million: 1000, output_micro_per_million: 2000, per_request_ceiling_micro: 100, no_charge_http_statuses: [] };
  // Keep the declared source-photo metadata constant; a changed derivative must not reuse an earlier paid intent.
  const images = ['a', 'b', 'c'].map(assetId => ({ assetId, bytes: Buffer.from(`fixture-image-${assetId}`), width: 640, height: 800, sha256: 'b'.repeat(64) }));
  const first = prepareVision(contract, images);
  expect(prepareVision(contract, images).requestHash).toBe(first.requestHash);
  images[0]!.bytes = Buffer.from('different-derivative');
  const changed = prepareVision(contract, images);
  expect(changed.summary).toEqual(first.summary);
  expect(changed.requestHash).not.toBe(first.requestHash);
});
