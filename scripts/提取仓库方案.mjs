// Read-only research export of upstream declarative recipes, not a production importer.
// Upstream: ClipForge / xixihhhh, AGPL-3.0-only; preserve attribution with exported data.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { resolve, join } from 'node:path';
import { readFile, mkdir, writeFile, realpath } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const projectRoot = process.cwd();
const reviewRoot = resolve(projectRoot, 'runtime/repository-review');
const repositoryRoot = join(reviewRoot, 'one-tap-ads');
const expectedCommit = '1aab133dd75f4db57c3f62e6da2fdd121c5d509b';
const commit = execFileSync('git', ['-C', repositoryRoot, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (commit !== expectedCommit) throw new Error(`Source commit changed: ${commit}`);
const requireFromVitest = createRequire(await realpath(join(reviewRoot, 'node_modules/vitest/package.json')));
const { createServer } = await import(pathToFileURL(requireFromVitest.resolve('vite')).href);
const server = await createServer({
  configFile: false,
  root: repositoryRoot,
  cacheDir: join(reviewRoot, 'cache/case-review-vite'),
  resolve: { alias: { '@': join(repositoryRoot, 'src') } },
  server: { middlewareMode: true, hmr: false, watch: null },
  logLevel: 'error',
});
try {
  const load = (name) => server.ssrLoadModule(`/src/lib/${name}.ts`);
  const ad = await load('ad-templates');
  const cameras = await load('camera-presets');
  const looks = await load('look-presets');
  const styles = await load('style-packs');
  const captions = await load('caption-presets');
  const examples = await load('examples');
  const prompts = await load('script-engine/prompts');
  const production = await load('production-profiles');
  const presenters = await load('presenters');
  const categories = await server.ssrLoadModule('/src/lib/script-engine/templates/index.ts');
  const categoryEntries = Object.keys(categories.categoryNameMap).map((category) => ({
    category,
    name: categories.categoryNameMap[category],
    ...categories.getTemplatesByCategory(category),
  }));
  const sourceFiles = ['ad-templates', 'camera-presets', 'look-presets', 'style-packs', 'caption-presets', 'examples', 'script-engine/prompts', 'production-profiles', 'presenters', 'storyboard-grid', 'storyboard-film'];
  const hashes = {};
  for (const name of sourceFiles) {
    hashes[`src/lib/${name}.ts`] = createHash('sha256').update(await readFile(join(repositoryRoot, `src/lib/${name}.ts`))).digest('hex');
  }
  const records = ad.AD_TEMPLATES.map((template) => ({
    ...template,
    resolved: {
      group: ad.AD_TEMPLATE_GROUPS.find((group) => group.id === template.group)?.name ?? null,
      look: looks.getLookPreset(template.look) ?? null,
      cameras: Object.fromEntries(Object.entries(template.cameraPlan).map(([role, id]) => [role, cameras.getCameraPreset(id) ?? null])),
      caption: captions.CAPTION_PRESETS[template.compose.captionPreset] ?? null,
      script_directive: ad.adTemplateScriptDirective(template),
    },
  }));
  const countBy = (items, select) => items.reduce((counts, item) => {
    const key = select(item) ?? '(omitted)';
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
  const canonical = (value) => Array.isArray(value) ? value.map(canonical)
    : value && typeof value === 'object'
      ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]))
      : value;
  const signatureGroups = (select) => {
    const groups = new Map();
    for (const record of records) {
      const signature = JSON.stringify(canonical(select(record)));
      const ids = groups.get(signature) ?? [];
      ids.push(record.id);
      groups.set(signature, ids);
    }
    return [...groups.values()];
  };
  const rawSource = await readFile(join(repositoryRoot, 'src/lib/ad-templates.ts'), 'utf8');
  const sourceLine = (id) => {
    const offset = rawSource.indexOf(`id: "${id}"`);
    return offset < 0 ? null : rawSource.slice(0, offset).split('\n').length;
  };
  for (const record of records) record.source_line = sourceLine(record.id);
  const exactExecutionGroups = signatureGroups((t) => ({ styleType: t.styleType, videoMode: t.videoMode, look: t.look, cameraPlan: t.cameraPlan, compose: t.compose }));
  const narrativeGroups = signatureGroups((t) => ({ styleType: t.styleType, videoMode: t.videoMode, look: t.look, cameraPlan: t.cameraPlan, compose: t.compose, scriptHint: t.scriptHint }));
  const result = {
    status: 'UPSTREAM_RESEARCH_SNAPSHOT_NOT_DEPLOYED_OR_RELICENSED',
    extracted_at: new Date().toISOString(),
    repository: 'https://github.com/copypasteltd/one-tap-ads',
    commit,
    license: 'AGPL-3.0-only',
    attribution: 'ClipForge, Copyright (C) 2026 xixihhhh; see upstream LICENSE and NOTICE',
    source_sha256: hashes,
    summary: {
      recipes: records.length,
      groups: countBy(records, (t) => t.group),
      video_modes: countBy(records, (t) => t.videoMode),
      script_styles: countBy(records, (t) => t.styleType),
      looks: countBy(records, (t) => t.look),
      caption_styles: countBy(records, (t) => t.compose.captionPreset),
      explicit_quality: countBy(records, (t) => t.compose.quality),
      cameras: cameras.CAMERA_PRESETS.length,
      look_presets: looks.LOOK_PRESETS.length,
      style_packs: styles.BUILTIN_STYLE_PACKS.length,
      caption_presets: Object.keys(captions.CAPTION_PRESETS).length,
      category_templates: categoryEntries.reduce((n, category) => n + category.templates.length, 0),
      category_template_counts: Object.fromEntries(categoryEntries.map((category) => [category.category, category.templates.length])),
      unique_execution_settings_without_script_hint: exactExecutionGroups.length,
      unique_with_script_hint: narrativeGroups.length,
      same_execution_settings_groups: exactExecutionGroups.filter((ids) => ids.length > 1),
    },
    groups: ad.AD_TEMPLATE_GROUPS,
    recipes: records,
    camera_presets: cameras.CAMERA_PRESETS,
    look_presets: looks.LOOK_PRESETS,
    style_packs: styles.BUILTIN_STYLE_PACKS,
    caption_presets: captions.CAPTION_PRESETS,
    script_style_labels: prompts.styleNameMap,
    script_style_directives: prompts.stylePrompts,
    video_mode_directives: prompts.VIDEO_MODE_DIRECTIVES,
    production_profiles: production.PRODUCTION_PROFILES,
    presenter_presets: Object.fromEntries(Object.entries(presenters).filter(([key, value]) => /PRESET/.test(key) && typeof value !== 'function')),
    category_templates: categoryEntries,
    examples: { products: examples.getExampleProducts('zh'), scripts: examples.getExampleTemplates('zh'), showcase: examples.getExampleShowcase('zh') },
    recommendation_samples: [
      { category: 'food', productName: '冷萃咖啡液', sellingPoints: '' },
      { category: 'digital', productName: '便携榨汁杯', sellingPoints: '' },
      { category: 'fashion', productName: '通勤双肩背包', sellingPoints: '红色 双提手 外侧拉链口袋' },
    ].map((input) => ({ input, ids: ad.recommendAdTemplates(input, 8).map((t) => t.id) })),
  };
  const outDir = resolve(projectRoot, 'assets/research/one-tap-ads');
  await mkdir(outDir, { recursive: true });
  const output = join(outDir, '方案完整目录-1aab133.json');
  await writeFile(output, JSON.stringify(result, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify({ output, ...result.summary }, null, 2));
} finally {
  await server.close();
}
