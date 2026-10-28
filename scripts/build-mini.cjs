const { spawnSync } = require('node:child_process');
const { mkdirSync } = require('node:fs');
const { resolve, join } = require('node:path');
const { mkdir, writeFile } = require('node:fs/promises');
const sharp = require('sharp');
const platform = process.argv[2];
if (!['alipay', 'tt'].includes(platform)) throw new Error('Unsupported mini-program platform');
const root = resolve(__dirname, '..'); const name = platform === 'alipay' ? 'mini-alipay' : 'mini-douyin';
const work = join(root, 'runtime/taro-work', name); mkdirSync(work, { recursive: true });
const result = spawnSync(process.execPath, [join(root, 'scripts/mini-build-entry.cjs'), name, platform], {
  cwd: work, env: { ...process.env, NODE_ENV: 'production', TARO_ENV: platform, TARO_CACHE_DIR: join(root, 'runtime/taro-cache', name) }, stdio: 'inherit', windowsHide: true,
});
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status || 1);
(async () => {
  const target = join(root, 'runtime/build', name, 'assets'); await mkdir(target, { recursive: true });
  const source = join(root, 'assets/design/柚子创作社/v1.0/reference/C-拍照制作.png');
  const crops = [{ left: 36, top: 277, width: 97, height: 123 }, { left: 165, top: 249, width: 109, height: 142 }, { left: 301, top: 290, width: 96, height: 119 }];
  for (const [i, crop] of crops.entries()) await sharp(source).extract(crop).png().toFile(join(target, `example-${i}.png`));
  await writeFile(join(root, 'runtime/build', name, 'example-source.json'), JSON.stringify({ source: 'YPCC-DS-C-1.0.0/C-拍照制作.png', purpose: 'Illustrative input photos, never a buyer result or a preset-specific sample', crops }, null, 2));
})().catch(error => { process.stderr.write(String(error)); process.exitCode = 1; });
