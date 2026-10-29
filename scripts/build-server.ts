import { build } from 'esbuild';
import { createRequire } from 'node:module';
const { buildRoot } = createRequire(import.meta.url)('./build-output.cjs') as { buildRoot(): string };
await build({ entryPoints: ['src/api/main.ts', 'src/worker/main.ts', 'src/worker/tool-gateway/mcp-main.ts', 'src/worker/lifecycle/reaper-main.ts', 'src/worker/lifecycle/media-maintenance-main.ts', 'src/worker/lifecycle/privacy-journal-main.ts'],
  outdir: buildRoot(), outbase: 'src', bundle: true, platform: 'node', target: 'node24', format: 'esm',
  packages: 'external', sourcemap: true });
