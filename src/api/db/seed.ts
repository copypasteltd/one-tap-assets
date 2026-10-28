import { readFile } from 'node:fs/promises';
import type pg from 'pg';
import { transaction } from './pool.js';
import { hash, id } from '../lib/crypto.js';
import { variantDto, type PresetSource } from '../modules/catalog.js';
import type { DTO } from '../../shared/contracts/types.js';
import { FONT_BINDING, FONT_LICENSE, loadProductionFont } from '../../worker/media/font.js';

export async function seed(pool: pg.Pool): Promise<void> {
  await loadProductionFont(process.cwd());
  const registry = JSON.parse(await readFile('assets/presets/presets.v3.1.json', 'utf8')) as { presets: PresetSource[] };
  await transaction(pool, async db => {
    await db.query("SELECT pg_advisory_xact_lock(hashtext('ypcc-seed'))");
    await db.query(`INSERT INTO resource_licenses(id,resource_id,version,data) VALUES($1,$2,$3,$4) ON CONFLICT(id) DO NOTHING`,
      [FONT_BINDING.license_record_id, FONT_BINDING.resource_version_id, FONT_LICENSE.source_commit, FONT_LICENSE]);
    for (const p of registry.presets) {
      const summary: DTO<'PresetSummary'> = { preset_id: p.preset_id, version: p.version, name: p.name, author_name: '一品成片官方', source: 'OFFICIAL', style_tags: [p.category, p.style.description, p.rhythm.description].map(s => s.slice(0, 50)), sample_id: null, sample_label: 'AUTHORIZED_SAMPLE_NOT_YOUR_RESULT', sale_enabled: false };
      const detail: DTO<'PresetDetail'> = { preset: summary, description: `${p.style.description}；${p.rhythm.description}。照片里的商品保持原貌，文案只使用可核实内容。`, variants: p.execution_variants.map(variantDto), license_summary: '平台原创执行规格；第三方人物、声音、音乐及样例须分别准入后使用。', fork_allowed: true, parent_version: null };
      await db.query('INSERT INTO presets(id,author_id,source,current_version,data) VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO NOTHING', [p.preset_id, null, 'OFFICIAL', p.version, summary]);
      const versionId = `${p.preset_id}.${p.version}`;
      await db.query('INSERT INTO preset_versions(id,preset_id,version,hash,license_version,data) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(preset_id,version) DO NOTHING', [versionId, p.preset_id, p.version, hash(detail), 'official-spec-1.0', detail]);
      for (const v of p.execution_variants) {
        await db.query('INSERT INTO execution_variants(id,preset_version_id,variant_id,version,engine,data,private) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(variant_id,version) DO NOTHING', [`${v.variant_id}.${v.version}`, versionId, v.variant_id, v.version, v.engine, variantDto(v), { source: v, preset_id: p.preset_id }]);
      }
      await db.query('INSERT INTO component_versions(id,type,version,data) VALUES($1,$2,$3,$4) ON CONFLICT(id) DO NOTHING', [`style.${p.preset_id}.1`, 'STYLE', '1.0.0', { component_version_id: `style.${p.preset_id}.1`, type: 'STYLE', name: p.name, description: p.style.description, supported_engines: ['PHOTO_LAYOUT', 'PER_SHOT_AI', 'REFERENCE_FILM'] } satisfies DTO<'ComponentOption'>]);
    }
    for (const engine of ['PHOTO_LAYOUT', 'PER_SHOT_AI', 'REFERENCE_FILM'] as const) {
      await db.query('INSERT INTO component_versions(id,type,version,data) VALUES($1,$2,$3,$4) ON CONFLICT(id) DO NOTHING', [`engine.${engine}.1`, 'ENGINE', '1.0.0', { component_version_id: `engine.${engine}.1`, type: 'ENGINE', name: { PHOTO_LAYOUT: '照片动效', PER_SHOT_AI: '逐镜生成', REFERENCE_FILM: '连续短片' }[engine], description: '执行由平台受控工具完成，社区配置不能提交代码或外部链接。', supported_engines: [engine] } satisfies DTO<'ComponentOption'>]);
    }
    const skills = JSON.parse(await readFile('assets/skills/ypcc/v1.0/registry.json', 'utf8')) as { skills: { name: string; version: string; sha256: string }[]; bundles: { bundle_id: string; version: string; sha256: string }[] };
    for (const s of skills.skills) await db.query('INSERT INTO skill_versions(id,name,version,content_hash,trust_state,data) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(name,version,content_hash) DO NOTHING', [id('skill'), s.name, s.version, s.sha256, 'OFFICIAL_DRAFT', s]);
    for (const b of skills.bundles) await db.query('INSERT INTO skill_bundles(id,version,bundle_hash,state,data) VALUES($1,$2,$3,$4,$5) ON CONFLICT(bundle_hash) DO NOTHING', [b.bundle_id, b.version, b.sha256, 'DRAFT_NOT_ADMITTED', b]);
  });
}
