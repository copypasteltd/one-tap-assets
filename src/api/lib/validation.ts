import Ajv2020, { type ValidateFunction, type AnySchema } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { DTO, SchemaName } from '../../shared/contracts/types.js';
import { AppError } from './errors.js';

interface ApiDocument { components: { schemas: Record<string, object> }; paths: Record<string, Record<string, Record<string, unknown>>> }
export const apiDocument = JSON.parse(readFileSync(resolve('assets/development/v1.1/contracts/openapi.json'), 'utf8')) as ApiDocument;
export const managementDocument = JSON.parse(readFileSync(resolve('assets/development/v1.1/contracts/management-openapi.json'), 'utf8')) as ApiDocument;
const ajv = new Ajv2020({ allErrors: true, strict: false, validateFormats: true, removeAdditional: false, coerceTypes: false });
addFormats(ajv);
ajv.addSchema({ $id: 'urn:ypcc:api', components: { schemas: apiDocument.components.schemas } });
const cache = new Map<string, ValidateFunction>();
export function validator(name: string): ValidateFunction {
  let fn = cache.get(name);
  if (!fn) { fn = ajv.compile({ $ref: `urn:ypcc:api#/components/schemas/${name}` }); cache.set(name, fn); }
  return fn;
}
export function validate<N extends SchemaName>(name: N, value: unknown, response = false): DTO<N> {
  const fn = validator(name);
  if (!fn(value)) throw new AppError(response ? 'RESPONSE_CONTRACT_ERROR' : 'INVALID_REQUEST', response ? '服务端响应校验失败' : '请求内容不符合规范', response ? 500 : 400, false,
    (fn.errors ?? []).slice(0, 20).map(e => ({ field: e.instancePath || '/', reason: (e.message ?? 'invalid').slice(0, 300) })));
  return value as DTO<N>;
}
export function validateInternal(file: string, value: unknown): void {
  const key = `internal:${file}`; let fn = cache.get(key);
  if (!fn) { fn = ajv.compile(JSON.parse(readFileSync(resolve(`assets/development/v1.1/contracts/${file}.schema.json`), 'utf8')) as AnySchema); cache.set(key, fn); }
  if (!fn(value)) throw new AppError('INTERNAL_CONTRACT_ERROR', `内部契约校验失败：${file}`, 500);
}
