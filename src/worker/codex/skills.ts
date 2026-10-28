import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type pg from 'pg';
import type { Config } from '../../api/config.js';
import { inside } from '../../api/config.js';
import { sha256 } from '../../api/lib/crypto.js';
import { canonicalize } from '../../shared/domain/json.js';
import { requireThat } from '../../api/lib/errors.js';
import type { AgentRole } from '../tool-gateway/policy.js';
interface SkillRef { name: string; version: string; sha256: string }
export interface SkillBundle { bundle_id: string; version: string; sha256: string; payload: { preset_id: string; variant_id: string; engine: string; roles: Record<AgentRole, SkillRef[]> } }
interface Registry { skills: (SkillRef & { path: string })[]; bundles: SkillBundle[] }
export async function bundleForVariant(cfg: Config, variantId: string): Promise<SkillBundle> {
  const registry = JSON.parse(await readFile(inside(cfg.projectRoot, 'assets/skills/ypcc/v1.0/registry.json'), 'utf8')) as Registry;
  const bundle = registry.bundles.find(b => b.payload.variant_id === variantId);
  requireThat(bundle && sha256(canonicalize(bundle.payload)) === bundle.sha256, 'SKILL_BUNDLE_MISSING', '方案对应的可信 Skill 组合缺失', 503);
  return bundle;
}
export async function bundleForHash(cfg: Config, bundleHash: string): Promise<SkillBundle> {
  const registry = JSON.parse(await readFile(inside(cfg.projectRoot, 'assets/skills/ypcc/v1.0/registry.json'), 'utf8')) as Registry;
  const bundle = registry.bundles.find(b => b.sha256 === bundleHash);
  requireThat(bundle && sha256(canonicalize(bundle.payload)) === bundle.sha256, 'SKILL_BUNDLE_MISSING', '冻结的可信 Skill 组合缺失或摘要不一致', 503);
  return bundle;
}
export async function prewarmSkills(cfg: Config): Promise<{ bundles: number; skills: number }> {
  const registry = JSON.parse(await readFile(inside(cfg.projectRoot, 'assets/skills/ypcc/v1.0/registry.json'), 'utf8')) as Registry;
  for (const skill of registry.skills) {
    const bytes = await readFile(inside(cfg.projectRoot, skill.path));
    requireThat(sha256(bytes) === skill.sha256, 'SKILL_HASH_MISMATCH', '可信 Skill 内容摘要不一致', 503);
    const path = inside(cfg.runtimeRoot, `skill-cache/${skill.sha256}/SKILL.md`); await mkdir(join(path, '..'), { recursive: true });
    try { await writeFile(path, bytes, { mode: 0o444, flag: 'wx' }); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; }
    requireThat(sha256(await readFile(path)) === skill.sha256, 'SKILL_CACHE_HASH_MISMATCH', '预热 Skill 缓存损坏，已停止加载', 503);
  }
  for (const bundle of registry.bundles) requireThat(sha256(canonicalize(bundle.payload)) === bundle.sha256, 'SKILL_BUNDLE_HASH_MISMATCH', 'Skill 组合摘要不一致', 503);
  return { bundles: registry.bundles.length, skills: registry.skills.length };
}
export async function materializeRoleSkills(cfg: Config, db: pg.Pool, variantId: string, role: AgentRole, home: string, expectedHash?: string): Promise<{ bundle: SkillBundle; skills: { name: string; sha256: string; path: string }[] }> {
  const registry = JSON.parse(await readFile(inside(cfg.projectRoot, 'assets/skills/ypcc/v1.0/registry.json'), 'utf8')) as Registry;
  const bundle = registry.bundles.find(b => b.payload.variant_id === variantId && (!expectedHash || b.sha256 === expectedHash));
  requireThat(bundle && sha256(canonicalize(bundle.payload)) === bundle.sha256, 'SKILL_BUNDLE_MISSING', '冻结的 Skill 组合不存在或摘要不一致', 503);
  const state = (await db.query<{ state: string }>('SELECT state FROM skill_bundles WHERE bundle_hash=$1', [bundle.sha256])).rows[0];
  requireThat(state?.state === 'ADMITTED' || (cfg.devMode && cfg.env !== 'production'), 'SKILL_BUNDLE_NOT_ADMITTED', 'Skill 组合尚未完成生产准入', 503);
  const skills = [];
  for (const ref of bundle.payload.roles[role]) {
    const source = registry.skills.find(s => s.name === ref.name && s.version === ref.version && s.sha256 === ref.sha256);
    requireThat(source && /^[a-z][a-z0-9-]+$/.test(source.name), 'SKILL_BUNDLE_INVALID', 'Skill 组合引用无效', 503);
    const bytes = await readFile(inside(cfg.projectRoot, source.path)); requireThat(sha256(bytes) === ref.sha256, 'SKILL_HASH_MISMATCH', 'Skill 内容已改变', 503);
    const dir = inside(home, `skills/${source.name}`); await mkdir(dir, { recursive: true }); const path = join(dir, 'SKILL.md'); await writeFile(path, bytes, { mode: 0o444, flag: 'wx' });
    skills.push({ name: source.name, sha256: ref.sha256, path });
  }
  requireThat(skills.length === 6, 'SKILL_BUNDLE_INVALID', '每角色应加载核心、单一风格、三类目标与角色 Skill', 503);
  return { bundle, skills };
}
