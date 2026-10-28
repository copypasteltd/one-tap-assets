import { readFileSync } from 'node:fs';
import { it, expect } from 'vitest';
import type { DTO } from '../../src/shared/contracts/types.js';
import { assertReviewConsensus, assertSealedPacket, packetHash, reviewHash } from '../../src/worker/review/packet.js';

const fixtures = JSON.parse(readFileSync('assets/development/v1.1/contracts/codex-fixtures.json', 'utf8')) as { cases: { name: string; value: DTO<'ReviewPacket'> }[] };
const fixture = (name: string) => structuredClone(fixtures.cases.find(c => c.name === name)!.value);
it('matches the independently calculated Python sortkeys UTF-8 vector, including Unicode key order', () => {
  expect(reviewHash({ 中文: ['原图', { z: 'x', a: 'y' }], '\ue000': '私用', '😀': '补充' }))
    .toBe('3d2aebc80e8e9f0f864d78e1c18f1b52f037b138714fd1c89d7251de018a6e38');
  expect(() => reviewHash({ x: 1.5 })).toThrow();
});
it('binds original evidence and versions while excluding report progress from the seal', () => {
  const packet = fixture('two_fresh_reviews_allow_delivery');
  expect(() => assertReviewConsensus(packet)).not.toThrow();
  packet.state = 'REVIEWING'; packet.reports = []; packet.publication_decision = 'PENDING';
  expect(packetHash(packet)).toBe(packet.packet_hash);
  expect(() => assertSealedPacket(packet)).not.toThrow();
  packet.evidence_assets[0]!.sha256 = '0'.repeat(64);
  expect(() => assertSealedPacket(packet)).toThrow();
});
it.each(['creator_cannot_sign_review', 'creator_thread_cannot_review', 'two_reviews_cannot_share_thread',
  'two_reviews_cannot_share_run', 'two_reviews_cannot_share_process', 'producer_process_cannot_review',
  'old_output_review_rejected', 'cross_tenant_review_rejected', 'changed_asset_invalidates_review',
  'review_disagreement_blocks_publish', 'single_review_not_enough'])('rejects a structurally plausible invalid consensus: %s', name => {
  expect(() => assertReviewConsensus(fixture(name))).toThrow();
});
it('does not allow an agent to invent a harmless MINOR exception', () => {
  const packet = fixture('two_fresh_reviews_allow_delivery');
  packet.reports[0]!.findings.push({ category: 'STYLE', severity: 'MINOR', evidence_ids: [], time_ms: null, detail: '未由当前规则预先豁免' });
  expect(() => assertReviewConsensus(packet)).toThrow();
});
