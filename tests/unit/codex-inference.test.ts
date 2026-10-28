import { it, expect } from 'vitest';
import { checkInferenceInput, inspectInferenceReceipt } from '../../src/worker/codex/inference.js';
import { inferenceCost } from '../../src/worker/codex/admission.js';
import { syntheticAdmission, syntheticSse } from '../helpers/codex.js';
import type { ToolScope } from '../../src/worker/tool-gateway/http.js';
const scope = { role: 'CONTENT', allowed_tools: ['analyze_photos'] } as ToolScope;
it('restricts text inference to the pinned model and actually loaded MCP tools', () => {
  const admission = syntheticAdmission(); const body = { model: admission.actual_model, store: false, stream: true,
    input: [{ role: 'user', content: '商品证据' }], tools: [{ type: 'function', name: 'mcp__ypcc__analyze_photos', parameters: {} }] };
  expect(checkInferenceInput(body, scope, admission)).toEqual(body);
  for (const change of [{ model: 'different-model' }, { store: true }, { service_tier: 'priority' }, { prompt_cache_retention: '24h' }, { previous_response_id: 'cross-buyer-context' },
    { tools: [{ type: 'web_search' }] }, { tools: [{ type: 'function', name: 'mcp__ypcc__inspect_actual_media' }] },
    { input: [{ type: 'input_image', image_url: 'https://private.invalid/buyer.png' }] }]) {
    expect(() => checkInferenceInput({ ...body, ...change }, scope, admission)).toThrow();
  }
});
it('requires one matching SSE terminal and charges cached inputs with integer micro-units', () => {
  const admission = syntheticAdmission(); const bytes = syntheticSse(admission);
  expect(inspectInferenceReceipt(bytes, admission, 1000, 200)).toMatchObject({ input: 100, cached: 20, output: 20, cost: 130, completed: true });
  expect(inferenceCost({ ...admission, input_micro_per_million: 1 }, 1, 0)).toBe(1);
  expect(() => inspectInferenceReceipt(bytes, admission, 99, 200)).toThrow();
  expect(() => inspectInferenceReceipt(Buffer.concat([bytes, bytes]), admission, 1000, 200)).toThrow();
  expect(() => inspectInferenceReceipt(bytes, { ...admission, actual_model: 'other' }, 1000, 200)).toThrow();
  expect(() => inspectInferenceReceipt(Buffer.from(bytes.toString().split('event: response.completed')[0]!), admission, 1000, 200)).toThrow();
});
