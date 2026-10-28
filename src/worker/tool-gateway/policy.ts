import { readFileSync } from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
import { AppError, requireThat } from '../../api/lib/errors.js';
import { object } from '../../shared/domain/json.js';
export type AgentRole = 'CONTENT' | 'PRODUCTION' | 'POST' | 'REVIEW_FACTS' | 'REVIEW_STYLE';
interface ToolPolicy { version: string; default_deny: boolean; tools: { name: string; allowed_roles: AgentRole[] }[] }
export const policy = JSON.parse(readFileSync('assets/development/v1.1/tool-policy.json', 'utf8')) as ToolPolicy;
const idSchema = { type: 'string', pattern: '^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$' };
const hashSchema = { type: 'string', pattern: '^[a-f0-9]{64}$' };
const exact = (properties: Record<string, unknown>, required = Object.keys(properties)): object => ({ type: 'object', properties, required, additionalProperties: false });
export const toolSchemas: Record<string, object> = {
  analyze_photos: exact({}), validate_content_plan: exact({ plan: { type: 'object' } }),
  render_photo_pack: exact({ snapshot_hash: hashSchema }),
  generate_reference_frames: exact({ shot_id: idSchema }), submit_video: exact({ shot_id: { anyOf: [idSchema, { type: 'null' }] } }),
  query_original_submission: exact({ submission_id: idSchema }),
  inspect_actual_media: exact({ asset_ids: { type: 'array', items: idSchema, minItems: 1, maxItems: 100, uniqueItems: true } }),
  extract_review_evidence: exact({ packet_hash: hashSchema }),
  transcribe_actual_audio: exact({ artifact_id: idSchema }),
  execute_post_plan: exact({ snapshot_hash: hashSchema }),
  persist_stage_result: exact({ result: { type: 'object' } }),
};
const ajv = new Ajv2020({ allErrors: true, strict: false });
const validators = new Map(Object.entries(toolSchemas).map(([name, schema]) => [name, ajv.compile(schema)]));
export function checkTool(role: AgentRole, name: string, args: unknown): Record<string, unknown> {
  const allowed = policy.tools.find(t => t.name === name);
  requireThat(policy.default_deny && allowed?.allowed_roles.includes(role), 'TOOL_FORBIDDEN', '该角色无权调用此工具', 403);
  const validate = validators.get(name);
  if (!validate || !validate(args)) throw new AppError('TOOL_ARGUMENT_INVALID', '工具参数不符合受控规格', 400);
  return object(args);
}
export function toolsForRole(role: AgentRole): { name: string; description: string; inputSchema: object }[] {
  return policy.tools.filter(t => t.allowed_roles.includes(role)).map(t => ({ name: t.name, description: `一品成片平台工具 ${t.name}。作用域、模型、媒体与预算由平台决定；不接受路径、URL、代码或凭证。`, inputSchema: toolSchemas[t.name]! }));
}
