import { readFileSync } from 'node:fs';
import type { DTO } from '../../src/shared/contracts/types.js';
import type { PresetSource, VariantSource } from '../../src/api/modules/catalog.js';
import { normalizeVision } from '../../src/worker/analysis/profile.js';
export const TEST_SHA = 'a'.repeat(64);
export const presets = (JSON.parse(readFileSync('assets/presets/presets.v3.1.json', 'utf8')) as { presets: PresetSource[] }).presets;
export const variant = (id = 'minimal-clean.photo-layout'): VariantSource => presets.flatMap(p => p.execution_variants).find(v => v.variant_id === id)!;
export function rawProfile(): DTO<'Profile'> {
  return { schema_version: '1.1', profile_id: 'model-profile', product_id: 'model-product', photo_version: 1, identity_lock_id: 'model-lock',
    summary: '照片中是同一只蓝色带盖杯，正面、侧面和杯盖可见。', category: '杯具', name: '蓝色带盖杯',
    observations: [{ feature: '颜色', value: '蓝色', status: 'OBSERVED', source_asset_ids: ['asset-a'], evidence_ids: ['ev-a'], note: '整体可见颜色', model_reported_confidence: 0.9 },
      { feature: '结构', value: '带杯盖', status: 'OBSERVED', source_asset_ids: ['asset-c'], evidence_ids: ['ev-c'], note: '杯盖可见', model_reported_confidence: 0.9 }],
    label_texts: [], hypotheses: [], unknowns: ['容量', '材料'], conflicts: [],
    photo_roles: [{ asset_id: 'asset-a', role: 'WHOLE' }, { asset_id: 'asset-b', role: 'SIDE' }, { asset_id: 'asset-c', role: 'DETAIL' }],
    evidence: [{ evidence_id: 'ev-a', asset_id: 'asset-a', kind: 'OBSERVATION', text: '杯身可见蓝色', region: [0.1, 0.1, 0.6, 0.6] },
      { evidence_id: 'ev-c', asset_id: 'asset-c', kind: 'OBSERVATION', text: '可见杯盖', region: [0.1, 0.1, 0.5, 0.5] }], profile_hash: TEST_SHA, revision: 1 };
}
export const profile = (): DTO<'Profile'> => normalizeVision(rawProfile(), { tenantId: 'tenant-test', productId: 'product-test', photoVersion: 1, revision: 1, assetIds: ['asset-a', 'asset-b', 'asset-c'] }).profile;
