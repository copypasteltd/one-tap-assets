import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['tests/integration/**/*.test.ts'], bail: 1, testTimeout: 120_000, hookTimeout: 60_000, fileParallelism: false, pool: 'forks', maxWorkers: 1,
  reporters: ['default', 'json'], outputFile: { json: 'runtime/test-results/integration.json' } }, cacheDir: 'runtime/vitest-integration-cache' });
