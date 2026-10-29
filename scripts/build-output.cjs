const { resolve, relative, sep } = require('node:path');
const { existsSync, lstatSync } = require('node:fs');
function buildRoot() {
  const root = resolve(__dirname, '..');
  const target = resolve(root, process.env.YPCC_BUILD_ROOT || 'runtime/build');
  const suffix = relative(resolve(root, 'runtime'), target);
  if (!suffix || suffix.startsWith('..') || resolve(root, 'runtime', suffix) !== target) throw new Error('Build output must be a child of project runtime');
  let current = root;
  for (const part of relative(root, target).split(sep)) {
    current = resolve(current, part);
    if (existsSync(current) && lstatSync(current).isSymbolicLink()) throw new Error('Build output cannot traverse a link');
  }
  return target;
}
module.exports = { buildRoot };
