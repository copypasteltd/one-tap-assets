import { describe, it, expect } from 'vitest';
import { normalizeVision } from '../../src/worker/analysis/profile.js';
import { basePlan, validateCreativePlan } from '../../src/worker/compiler/plan.js';
import { profile, rawProfile, variant } from '../helpers/fixtures.js';
const scope = { tenantId: 'tenant-test', productId: 'product-test', photoVersion: 1, revision: 1, assetIds: ['asset-a', 'asset-b', 'asset-c'] };
describe('multimodal evidence and deterministic creative contract', () => {
  it('normalizes server-owned scope/IDs and locks visible identity without certifying unknowns', () => {
    const result = normalizeVision(rawProfile(), scope);
    expect(result.profile.product_id).toBe(scope.productId); expect(result.profile.profile_id).not.toBe('model-profile');
    expect(result.profile.evidence[0]?.evidence_id).not.toBe('ev-a'); expect(result.identityLock.unknowns).toContain('容量');
    expect(result.identityLock.features.find(f => f.kind === 'COLOR')?.value).toContain('蓝色');
  });
  it('rejects foreign photos, fabricated evidence, duplicate roles and out-of-bounds boxes', () => {
    const foreign = rawProfile(); foreign.evidence[0]!.asset_id = 'other-tenant-photo';
    const absent = rawProfile(); absent.observations[0]!.evidence_ids = ['not-present'];
    const repeated = rawProfile(); repeated.photo_roles[1]!.asset_id = 'asset-a';
    const bounds = rawProfile(); bounds.evidence[0]!.region = [0.8, 0.1, 0.5, 0.5];
    for (const raw of [foreign, absent, repeated, bounds]) expect(() => normalizeVision(raw, scope)).toThrow();
  });
  it('produces contiguous integer-frame plans and rejects gaps or foreign identities', () => {
    const p = profile(); const v = variant(); const plan = basePlan(p, v); expect(() => validateCreativePlan(plan, p, v)).not.toThrow();
    const gap = structuredClone(plan); gap.shots[1]!.start_frame++;
    expect(() => validateCreativePlan(gap, p, v)).toThrow();
    const foreign = structuredClone(plan); foreign.image_slots[0]!.asset_id = 'other-product'; expect(() => validateCreativePlan(foreign, p, v)).toThrow();
  });
  it('keeps OCR claims out of automatic copy and rejects medical claims', () => {
    const p = profile(); p.label_texts.push({ feature: '标签', value: '治疗失眠', status: 'OCR', source_asset_ids: ['asset-a'], evidence_ids: [p.evidence[0]!.evidence_id], note: '仅记录标签可见文字', model_reported_confidence: null });
    const v = variant(); const plan = basePlan(p, v); expect(plan.copy).not.toContain('治疗失眠'); plan.copy = '治疗失眠';
    expect(() => validateCreativePlan(plan, p, v)).toThrow();
    const poster = basePlan(p, v); poster.image_slots[0]!.title = '全网最低9元';
    expect(() => validateCreativePlan(poster, p, v)).toThrow();
  });
  it('requires admitted native speech identity for presenter plans', () => {
    const p = profile(); const v = variant('portrait-social.ai-presenter-single'); const plan = basePlan(p, v);
    expect(() => validateCreativePlan(plan, p, v)).toThrow();
  });
  it('remaps hypothesis evidence and rejects references absent from the current photos', () => {
    const raw = rawProfile(); raw.hypotheses = [{ text: '可能适合随身携带', evidence_ids: ['ev-a'], uncertain: true }];
    const result = normalizeVision(raw, scope);
    expect(result.profile.hypotheses[0]!.evidence_ids[0]).toBe(result.profile.evidence[0]!.evidence_id);
    raw.hypotheses[0]!.evidence_ids = ['invented-evidence']; expect(() => normalizeVision(raw, scope)).toThrow();
  });
});
