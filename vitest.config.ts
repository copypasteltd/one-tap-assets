import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['tests/unit/**/*.test.ts'], testTimeout: 30_000, pool: 'forks', maxWorkers: 2,
  reporters: ['default', 'json'], outputFile: { json: 'runtime/test-results/unit.json' } }, cacheDir: 'runtime/vitest-cache' });
