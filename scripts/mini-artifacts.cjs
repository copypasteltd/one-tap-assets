const { readFileSync, writeFileSync, readdirSync, lstatSync } = require('node:fs');
const { resolve, relative, isAbsolute, dirname, join } = require('node:path');
const { createHash } = require('node:crypto');
const { Script } = require('node:vm');

const formats = {
  alipay: { template: '.axml', style: '.acss', project: 'mini.project.json' },
  tt: { template: '.ttml', style: '.ttss', project: 'project.config.json' },
};
const digest = bytes => createHash('sha256').update(bytes).digest('hex');

function validateMiniArtifacts(directory, platform, expectedPages, requireManifest = true) {
  const format = formats[platform];
  if (!format) throw new Error('Unsupported mini-program platform');
  const root = resolve(directory), inventory = [];
  function inside(path) {
    const target = resolve(root, path), rel = relative(root, target);
    if (!rel || rel.startsWith('..') || isAbsolute(rel)) throw new Error('Mini artifact reference escapes output');
    return target;
  }
  function walk(dir) {
    if (lstatSync(dir).isSymbolicLink()) throw new Error('Linked mini artifact');
    for (const name of readdirSync(dir).sort()) {
      const path = join(dir, name), stat = lstatSync(path);
      if (stat.isSymbolicLink()) throw new Error('Linked mini artifact');
      if (stat.isDirectory()) walk(path);
      else if (stat.isFile() && path !== join(root, 'delivery-manifest.json')) {
        const bytes = readFileSync(path);
        inventory.push({ path: relative(root, path).replaceAll('\\', '/'), bytes: bytes.length, sha256: digest(bytes) });
      }
    }
  }
  walk(root); inventory.sort((a, b) => a.path.localeCompare(b.path, 'en'));
  const present = new Map(inventory.map(file => [file.path, file]));
  function required(path) {
    inside(path);
    if (!present.get(path)?.bytes) throw new Error(`Missing or empty mini artifact: ${path}`);
    return readFileSync(inside(path), 'utf8');
  }
  const app = JSON.parse(required('app.json'));
  if (!Array.isArray(app.pages) || !app.pages.length || new Set(app.pages).size !== app.pages.length) throw new Error('Invalid mini page list');
  if (expectedPages && JSON.stringify(app.pages) !== JSON.stringify(expectedPages)) throw new Error('Compiled mini pages differ from source');
  required('app.js'); required(`app${format.style}`);
  for (const page of app.pages) {
    if (typeof page !== 'string' || !/^pages\/[a-z0-9-]+\/index$/.test(page)) throw new Error('Invalid mini page path');
    required(`${page}.js`); required(`${page}.json`); required(`${page}${format.template}`);
  }
  const project = JSON.parse(required(format.project));
  if (project.miniprogramRoot !== './') throw new Error('Mini IDE configuration must point at compiled output');
  let scripts = 0, references = 0;
  for (const file of inventory) {
    if (file.path.endsWith('.json')) JSON.parse(required(file.path));
    if (file.path.endsWith('.js')) { new Script(required(file.path), { filename: file.path }); scripts++; }
    if (file.path.endsWith(format.template) || file.path.endsWith('.js')) {
      const source = required(file.path);
      const pattern = file.path.endsWith('.js') ? /\brequire\(\s*["'](\.[^"']+)["']\s*\)/g
        : /<(?:import|include|import-sjs|wxs)\b[^>]*\b(?:src|from)=["']([^"']+)["']/g;
      for (const match of source.matchAll(pattern)) {
        if (match[1].includes('{{')) throw new Error('Unexpected dynamic mini artifact import');
        const path = relative(root, resolve(dirname(inside(file.path)), match[1])).replaceAll('\\', '/');
        inside(path);
        const candidate = present.has(path) ? path : file.path.endsWith('.js') ? `${path}.js` : path;
        required(candidate); references++;
      }
    }
  }
  if (requireManifest) {
    const manifest = JSON.parse(readFileSync(join(root, 'delivery-manifest.json'), 'utf8'));
    if (manifest.platform !== platform || JSON.stringify(manifest.files) !== JSON.stringify(inventory)) throw new Error('Mini artifact manifest differs from output');
  }
  return { schema_version: '1.0', platform, pages: app.pages, page_count: app.pages.length,
    files: inventory, file_count: inventory.length, total_bytes: inventory.reduce((sum, file) => sum + file.bytes, 0),
    javascript_files_parsed: scripts, local_dependencies_checked: references, project_configuration: format.project,
    host_launch_verified: false, real_device_verified: false };
}

function finalizeMiniArtifacts(directory, platform) {
  const format = formats[platform];
  if (!format) throw new Error('Unsupported mini-program platform');
  // App IDs are chosen by the owner in the IDE; never invent a usable account.
  const project = platform === 'alipay' ? { miniprogramRoot: './' }
    : { projectname: '一品成片', miniprogramRoot: './', setting: { urlCheck: true } };
  writeFileSync(join(directory, format.project), JSON.stringify(project, null, 2) + '\n');
  const manifest = validateMiniArtifacts(directory, platform, undefined, false);
  writeFileSync(join(directory, 'delivery-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  return manifest;
}

module.exports = { validateMiniArtifacts, finalizeMiniArtifacts };
