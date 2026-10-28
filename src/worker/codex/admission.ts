import { readFile } from 'node:fs/promises';
import Ajv2020 from 'ajv/dist/2020.js';
import { inside, type Config } from '../../api/config.js';
import { AppError, requireThat } from '../../api/lib/errors.js';
import { hash } from '../../api/lib/crypto.js';

/** Operator admission, separate from the sold CodexContract. An ADMITTED word
 * and evidence digests alone do not establish that the G0 tests were performed. */
export interface CodexAdmission {
  schema_version: '1.0.0'; state: 'ADMITTED'; valid_until: string; evidence_sha256: string;
  runtime_build_id: string; runtime_sha256: string; protocol_version: string;
  actual_model: string; model_version_id: string; rate_version_id: string; service_tier: 'default';
  launcher_sha256: string; launcher_evidence_sha256: string;
  isolation: 'NATIVE_RESTRICTED_IDENTITY'; virtualization: 'FORBIDDEN';
  shell_tools: 'DISABLED'; process_tree_cleanup: 'VERIFIED';
  inference_base_url: string; tokenizer_bound: 'UTF8_BYTES_PLUS_CERTIFIED_OVERHEAD';
  input_overhead_tokens: number; max_request_bytes: number; max_response_bytes: number;
  max_request_output_tokens: number; input_micro_per_million: number;
  cached_input_micro_per_million: number; output_micro_per_million: number;
  no_charge_http_statuses: number[];
  review_vision?: { evidence_sha256: string; detail: 'original'; max_images: number; max_image_bytes: number;
    max_image_pixels: number; max_total_image_bytes: number; tokens_per_image_bound: number };
}
const str = { type: 'string', minLength: 1, maxLength: 200 };
const digest = { type: 'string', pattern: '^[a-f0-9]{64}$' };
const properties = {
  schema_version: { const: '1.0.0' }, state: { const: 'ADMITTED' }, valid_until: str, evidence_sha256: digest,
  runtime_build_id: str, runtime_sha256: digest, protocol_version: str, actual_model: str, model_version_id: str, rate_version_id: str, service_tier: { const: 'default' },
  launcher_sha256: digest, launcher_evidence_sha256: digest, isolation: { const: 'NATIVE_RESTRICTED_IDENTITY' },
  virtualization: { const: 'FORBIDDEN' }, shell_tools: { const: 'DISABLED' }, process_tree_cleanup: { const: 'VERIFIED' },
  inference_base_url: { type: 'string', maxLength: 1000 }, tokenizer_bound: { const: 'UTF8_BYTES_PLUS_CERTIFIED_OVERHEAD' },
  input_overhead_tokens: { type: 'integer', minimum: 2048, maximum: 32000 },
  max_request_bytes: { type: 'integer', minimum: 1024, maximum: 36000000 }, max_response_bytes: { type: 'integer', minimum: 1024, maximum: 16000000 },
  max_request_output_tokens: { type: 'integer', minimum: 1, maximum: 32000 },
  input_micro_per_million: { type: 'integer', minimum: 0, maximum: 10000000000 },
  cached_input_micro_per_million: { type: 'integer', minimum: 0, maximum: 10000000000 },
  output_micro_per_million: { type: 'integer', minimum: 0, maximum: 10000000000 },
  no_charge_http_statuses: { type: 'array', uniqueItems: true, items: { enum: [400, 401, 403, 404, 413, 422, 429] } },
};
const visionProperties = { evidence_sha256: digest, detail: { const: 'original' },
  max_images: { type: 'integer', minimum: 1, maximum: 1000 }, max_image_bytes: { type: 'integer', minimum: 1024, maximum: 30000000 },
  max_image_pixels: { type: 'integer', minimum: 1, maximum: 30000000 }, max_total_image_bytes: { type: 'integer', minimum: 1024, maximum: 24000000 },
  tokens_per_image_bound: { type: 'integer', minimum: 1, maximum: 1000000 } };
const valid = new Ajv2020({ strict: false }).compile<CodexAdmission>({ type: 'object',
  properties: { ...properties, review_vision: { type: 'object', properties: visionProperties, required: Object.keys(visionProperties), additionalProperties: false } },
  required: Object.keys(properties), additionalProperties: false });
export function checkAdmission(cfg: Config, raw: unknown): CodexAdmission {
  requireThat(valid(raw), 'CODEX_ADMISSION_INVALID', 'Codex 运行与费用准入文件不符合规范', 503);
  const admission = raw;
  let url: URL;
  try { url = new URL(admission.inference_base_url); } catch { throw new AppError('CODEX_ADMISSION_INVALID', '推理服务地址无效', 503); }
  requireThat(admission.actual_model === cfg.codex.model && admission.runtime_sha256 === cfg.codex.sha256
    && admission.protocol_version === cfg.codex.protocol && admission.rate_version_id === cfg.codex.rateVersion
    && Date.parse(admission.valid_until) > Date.now() && url.protocol === 'https:' && !url.username && !url.password
    && !url.search && !url.hash && (!url.port || url.port === '443') && cfg.provider.allowedHosts.includes(url.hostname)
    && admission.cached_input_micro_per_million <= admission.input_micro_per_million,
  'CODEX_ADMISSION_MISMATCH', 'Codex 构建、协议、模型、费率或准入有效期不匹配', 503);
  requireThat(cfg.codex.maxTurns >= 1 && cfg.codex.maxTurns <= 100 && cfg.codex.maxInputTokens > 0
    && cfg.codex.maxOutputTokens > 0 && cfg.codex.costCeilingMicro > 0, 'CODEX_LIMITS_INVALID', 'Codex 硬限额尚未配置', 503);
  return admission;
}
export async function codexAdmission(cfg: Config): Promise<CodexAdmission> {
  requireThat(cfg.codex.enabled && cfg.codex.admissionPath && cfg.codex.apiKey && cfg.codex.binary && cfg.codex.isolationCommand,
    'CODEX_NOT_CONFIGURED', 'Codex 原生运行和受控推理服务尚未配置', 503);
  let raw: unknown;
  try { raw = JSON.parse(await readFile(inside(cfg.projectRoot, cfg.codex.admissionPath), 'utf8')); }
  catch { throw new AppError('CODEX_ADMISSION_INVALID', 'Codex 准入文件不可用', 503); }
  return checkAdmission(cfg, raw);
}
export const admissionHash = (admission: CodexAdmission): string => hash(admission);
export function inferenceCost(admission: CodexAdmission, input: number, output: number, cached = 0): number {
  requireThat([input, output, cached].every(n => Number.isSafeInteger(n) && n >= 0) && cached <= input,
    'CODEX_USAGE_INVALID', '推理用量回执无效', 503);
  const total = BigInt(input - cached) * BigInt(admission.input_micro_per_million)
    + BigInt(cached) * BigInt(admission.cached_input_micro_per_million) + BigInt(output) * BigInt(admission.output_micro_per_million);
  const result = Number((total + 999999n) / 1000000n);
  requireThat(Number.isSafeInteger(result), 'CODEX_COST_INVALID', '推理费用超出整数限制', 503); return result;
}
