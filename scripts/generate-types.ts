import openapiTS, { astToString } from 'openapi-typescript';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

await mkdir('src/shared/contracts', { recursive: true });
for (const [source, target] of [['openapi', 'api'], ['management-openapi', 'management']] as const) {
  const ast = await openapiTS(new URL(`../assets/development/v1.1/contracts/${source}.json`, import.meta.url));
  await writeFile(resolve(`src/shared/contracts/${target}.generated.ts`), astToString(ast));
}
const catalog = JSON.parse(await readFile('assets/development/v1.1/contracts/endpoints.json', 'utf8')) as { endpoints: { operation_id: string; method: string; path: string; auth_policy: string; idempotency_required: boolean; request_schema: string | null; response_schema: string | null }[] };
const endpoints = Object.fromEntries(catalog.endpoints.filter(e => e.operation_id !== 'receivePaymentEvent').map(e => [e.operation_id, {
  method: e.method, path: e.path, authenticated: !e.auth_policy.startsWith('public'), idempotency: e.idempotency_required,
  request: e.request_schema, response: e.response_schema,
}]));
await writeFile('src/shared/contracts/endpoints.generated.ts', `// Generated from the v1.1 endpoint contract; do not edit.\nexport const endpoints = ${JSON.stringify(endpoints, null, 2)} as const;\n`);
