import type { Db } from '../db/pool.js';
import type { DTO } from '../../shared/contracts/types.js';
import { notFound, requireThat } from '../lib/errors.js';
import type { Config } from '../config.js';
import type { PageQuery, RecordRow } from '../db/store.js';
import { cursor, limit } from '../lib/pagination.js';
import { hash } from '../lib/crypto.js';

export interface SourceSlot { slot_id: string; kind: 'image' | 'video'; width: number; height: number; fps?: number; duration_seconds?: number; role: string }
export interface VariantSource {
  variant_id: string; version: string; name: string; engine: DTO<'Engine'>; output_slots: SourceSlot[];
  required_auxiliary_outputs: string[]; audio_policy: { speech: string; language: string | null; music: string; preserve_native_speech: boolean; caption_alignment: string; second_tts_over_native_speech_allowed?:boolean; action_sound_required?:boolean };
  timeline_policy: { target_frames: number; fps: number; base_segments: { role: string; start_seconds: number; end_seconds: number }[] | null };
  input: { shot_hints: string[] }; creative_components: Record<string, unknown>;
  skill_bundle: { id: string; version: string; hash: string }; [key: string]: unknown;
}
export interface PresetSource {
  preset_id: string; version: string; name: string; category: string; style: { description: string };
  rhythm: { description: string }; execution_variants: VariantSource[]; community: Record<string, unknown>; [key: string]: unknown;
}
export function outputSlots(source: VariantSource): DTO<'OutputSlot'>[] {
  const slots: DTO<'OutputSlot'>[] = source.output_slots.map(slot => ({ slot_id: slot.slot_id, kind: slot.kind, count: 1,
    width: slot.width, height: slot.height, fps: slot.kind === 'video' ? slot.fps ?? 30 : null,
    duration_frames: slot.kind === 'video' ? Math.round((slot.duration_seconds ?? 0) * (slot.fps ?? 30)) : null }));
  if (source.required_auxiliary_outputs.includes('copy')) slots.push({ slot_id: 'copy', kind: 'copy', count: 1, width: null, height: null, fps: null, duration_frames: null });
  return slots;
}
export function variantDto(source: VariantSource): DTO<'Variant'> {
  return { variant_id: source.variant_id, version: source.version, name: source.name, engine: source.engine,
    sale_enabled: false, admission_state: 'NOT_EVALUATED', reason_codes: ['REQUIRES_REAL_CAPABILITY_AND_RELEASE_VALIDATION'], price_fen: null,
    output_slots: outputSlots(source), speech_mode: source.audio_policy.speech === 'none' ? 'NONE' : 'NATIVE_ZH', input_guidance: source.input.shot_hints };
}
export async function presetVersion(db: Db, presetId: string, version: string): Promise<DTO<'PresetDetail'>> {
  const found = await db.query<{ id: string; data: DTO<'PresetDetail'>; visibility: string }>('SELECT v.id,v.data,p.visibility FROM preset_versions v JOIN presets p ON p.id=v.preset_id WHERE v.preset_id=$1 AND v.version=$2', [presetId, version]);
  const row = found.rows[0]; if (!row || row.visibility !== 'PUBLIC') notFound();
  const variants = await db.query<{ data: DTO<'Variant'> }>('SELECT data FROM execution_variants WHERE preset_version_id=$1 ORDER BY variant_id', [row.id]);
  return { ...row.data, preset: { ...row.data.preset, sale_enabled: variants.rows.some(v => v.data.sale_enabled) }, variants: variants.rows.map(v => v.data) };
}
export async function getVariant(db: Db, variantId: string, version: string, lock = false): Promise<RecordRow<DTO<'Variant'>> & { private: { source: VariantSource; preset_id: string; model_version_ids?: string[]; budget_micro?: number; codex_contract?: unknown } }> {
  const found = await db.query<RecordRow<DTO<'Variant'>> & { private: { source: VariantSource; preset_id: string; model_version_ids?: string[]; budget_micro?: number; codex_contract?: unknown } }>(`SELECT * FROM execution_variants WHERE variant_id=$1 AND version=$2${lock ? ' FOR UPDATE' : ''}`, [variantId, version]);
  return found.rows[0] ?? notFound();
}
export async function listPresets(db: Db, cfg: Config, query: PageQuery): Promise<DTO<'PresetSummaryList'>> {
  const size = limit(query.limit); const scope = hash({ kind: 'catalog', q: query.q ?? '', tag: query.tag ?? '', source: query.source ?? '' });
  const point = cursor.decode(cfg, query.cursor, scope); const params: unknown[] = [size + 1]; const conditions = ["p.visibility='PUBLIC'"];
  if (point) { params.push(point.createdAt, point.id); conditions.push(`(p.created_at,p.id)<($${params.length - 1}::timestamptz,$${params.length})`); }
  if (query.q) { params.push(`%${query.q.replaceAll('%', '\\%').replaceAll('_', '\\_')}%`); conditions.push(`p.data->>'name' ILIKE $${params.length}`); }
  if (query.source) { requireThat(['OFFICIAL', 'COMMUNITY'].includes(query.source), 'INVALID_FILTER', '来源筛选无效', 400); params.push(query.source); conditions.push(`p.source=$${params.length}`); }
  if (query.tag) { params.push(query.tag); conditions.push(`p.data->'style_tags' ? $${params.length}`); }
  const rows = await db.query<{ id: string; data: DTO<'PresetSummary'>; created_at: Date; sale_enabled: boolean }>(`SELECT p.id,p.data,p.created_at,EXISTS(SELECT 1 FROM preset_versions v JOIN execution_variants x ON x.preset_version_id=v.id WHERE v.preset_id=p.id AND v.version=p.current_version AND x.sale_enabled) AS sale_enabled FROM presets p WHERE ${conditions.join(' AND ')} ORDER BY p.created_at DESC,p.id DESC LIMIT $1`, params);
  const selected = rows.rows.slice(0, size); const last = selected.at(-1);
  return { items: selected.map(r => ({ ...r.data, sale_enabled: r.sale_enabled })), next_cursor: rows.rows.length > size && last ? cursor.encode(cfg, { createdAt: last.created_at.toISOString(), id: last.id }, scope) : null };
}
