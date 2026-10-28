import { beforeAll, afterAll, it, expect } from 'vitest';
import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { build } from 'esbuild';
import { testDatabase, type TestDatabase } from '../helpers/database.js';
import { inside } from '../../src/api/config.js';
import { id } from '../../src/api/lib/crypto.js';
let db: TestDatabase; let root: string;
beforeAll(async () => { db = await testDatabase(); root = inside(db.cfg.runtimeRoot, `tests/build-smoke/${id('case')}`); await mkdir(root, { recursive: true }); });
afterAll(async () => { await db?.close(); if (root) await rm(inside(db.cfg.runtimeRoot, root), { recursive: true, force: true }); });
it('runs the native compiled worker twice without executing imported CLI entrypoints or any external paid call', async () => {
  const path = join(root, 'worker.mjs');
  await build({ entryPoints: ['src/worker/main.ts'], outfile: path, bundle: true, platform: 'node', target: 'node24', format: 'esm', packages: 'external' });
  const schema = (await db.pool.query<{ name: string }>('SELECT current_schema() AS name')).rows[0]!.name;
  expect(schema).toMatch(/^ypcc_test_[a-f0-9]{32}$/);
  const env: NodeJS.ProcessEnv = { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, WINDIR: process.env.WINDIR,
    TEMP: root, TMP: root, APP_ENV: 'test', DATABASE_URL: db.cfg.databaseUrl, PGOPTIONS: `--search_path=${schema}`,
    SIGNING_KEY: 'synthetic-test-signing-key-only-at-least-32', RUNTIME_ROOT: root,
    PAYMENTS_ENABLED: 'false', PROVIDER_GENERATION_ENABLED: 'false', CODEX_SERVICE_ENABLED: 'false', COMMUNITY_PUBLISHING_ENABLED: 'false' };
  for (let run = 0; run < 2; run++) {
    const child = spawnSync(process.execPath, [path, '--once'], { cwd: db.cfg.projectRoot, env, windowsHide: true, encoding: 'utf8', timeout: 20000 });
    expect(child.status, 'Compiled worker must exit normally').toBe(0);
    // Every line is a structured worker event. A bundled import.meta.url CLI
    // guard used to print an extra migration banner and create a second pool.
    const events = child.stdout.trim().split(/\r?\n/).map(line => JSON.parse(line));
    expect(events).toHaveLength(1); expect(events[0]).toMatchObject({ event: 'worker_ready', stage_handlers: [], event_handlers: [],
      skill_cache: { skills: 19, bundles: 14 }, stage_registry_complete: false });
    expect(events[0]).not.toHaveProperty('production_generation_ready');
  }
  const rows = await db.pool.query("SELECT data->>'state' AS state FROM worker_heartbeats");
  expect(rows.rows).toEqual([{ state: 'STOPPED' }, { state: 'STOPPED' }]);
});
it('runs the compiled independent reaper twice with all paid services disabled and closes its own pool', async () => {
  const path = join(root, 'reaper.mjs');
  await build({ entryPoints: ['src/worker/lifecycle/reaper-main.ts'], outfile: path, bundle: true, platform: 'node', target: 'node24', format: 'esm', packages: 'external' });
  const schema = (await db.pool.query<{ name: string }>('SELECT current_schema() AS name')).rows[0]!.name;
  const env: NodeJS.ProcessEnv = { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, WINDIR: process.env.WINDIR,
    TEMP: root, TMP: root, APP_ENV: 'test', DATABASE_URL: db.cfg.databaseUrl, PGOPTIONS: `--search_path=${schema}`,
    SIGNING_KEY: 'synthetic-test-signing-key-only-at-least-32', RUNTIME_ROOT: root,
    PAYMENTS_ENABLED: 'false', PROVIDER_GENERATION_ENABLED: 'false', CODEX_SERVICE_ENABLED: 'false', COMMUNITY_PUBLISHING_ENABLED: 'false' };
  for (let run = 0; run < 2; run++) {
    const child = spawnSync(process.execPath, [path, '--once'], { cwd: db.cfg.projectRoot, env, windowsHide: true, encoding: 'utf8', timeout: 20000 });
    expect(child.status, 'Independent reaper must exit normally').toBe(0);
    const events = child.stdout.trim().split(/\r?\n/).map(line => JSON.parse(line));
    expect(events).toHaveLength(1); expect(events[0]).toMatchObject({ event: 'reaper_ready' });
  }
  expect((await db.pool.query("SELECT data->>'state' AS state FROM worker_heartbeats WHERE id LIKE 'reaper_%'")).rows)
    .toEqual([{ state: 'STOPPED' }, { state: 'STOPPED' }]);
});
it('runs compiled independent media maintenance twice with every paid service disabled', async () => {
  const path = join(root, 'media-maintenance.mjs');
  await build({ entryPoints: ['src/worker/lifecycle/media-maintenance-main.ts'], outfile: path, bundle: true, platform: 'node', target: 'node24', format: 'esm', packages: 'external' });
  const schema = (await db.pool.query<{ name: string }>('SELECT current_schema() AS name')).rows[0]!.name;
  const env: NodeJS.ProcessEnv = { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, WINDIR: process.env.WINDIR,
    TEMP: root, TMP: root, APP_ENV: 'test', DATABASE_URL: db.cfg.databaseUrl, PGOPTIONS: `--search_path=${schema}`,
    SIGNING_KEY: 'synthetic-test-signing-key-only-at-least-32', RUNTIME_ROOT: root,
    PAYMENTS_ENABLED: 'false', PROVIDER_GENERATION_ENABLED: 'false', CODEX_SERVICE_ENABLED: 'false', COMMUNITY_PUBLISHING_ENABLED: 'false' };
  for (let run = 0; run < 2; run++) {
    const child = spawnSync(process.execPath, [path, '--once'], { cwd: db.cfg.projectRoot, env, windowsHide: true, encoding: 'utf8', timeout: 20000 });
    expect(child.status).toBe(0);
    const events = child.stdout.trim().split(/\r?\n/).map(line => JSON.parse(line));
    expect(events).toHaveLength(1); expect(events[0]).toMatchObject({ event: 'media_maintenance_ready' });
  }
  expect((await db.pool.query("SELECT data->>'state' AS state FROM worker_heartbeats WHERE id LIKE 'media_cleanup_%'")).rows)
    .toEqual([{ state: 'STOPPED' }, { state: 'STOPPED' }]);
});
it('initializes and queries the compiled privacy journal CLI without importing another entrypoint or leaving a pool open', async () => {
  const path = join(root, 'privacy-journal.mjs');
  await build({ entryPoints: ['src/worker/lifecycle/privacy-journal-main.ts'], outfile: path, bundle: true, platform: 'node', target: 'node24', format: 'esm', packages: 'external' });
  const schema = (await db.pool.query<{ name: string }>('SELECT current_schema() AS name')).rows[0]!.name;
  expect(schema).toMatch(/^ypcc_test_[a-f0-9]{32}$/);
  const env: NodeJS.ProcessEnv = { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, WINDIR: process.env.WINDIR,
    TEMP: root, TMP: root, APP_ENV: 'test', DATABASE_URL: db.cfg.databaseUrl, PGOPTIONS: `--search_path=${schema}`,
    SIGNING_KEY: 'synthetic-test-signing-key-only-at-least-32', RUNTIME_ROOT: root,
    PAYMENTS_ENABLED: 'false', PROVIDER_GENERATION_ENABLED: 'false', CODEX_SERVICE_ENABLED: 'false', COMMUNITY_PUBLISHING_ENABLED: 'false',
    PRIVACY_JOURNAL_ENABLED: 'true', PRIVACY_JOURNAL_DIRECTORY: 'cli-journal', PRIVACY_JOURNAL_SOURCE_ID: 'synthetic-compiled-cli', PRIVACY_JOURNAL_KEY_ID: 'synthetic-v1', PRIVACY_JOURNAL_HMAC_KEY: 'synthetic-compiled-journal-key-separate-from-api-key' };
  for (const command of ['initialize','status','status']) {
    const child = spawnSync(process.execPath, [path, command], { cwd: db.cfg.projectRoot, env, windowsHide: true, encoding: 'utf8', timeout: 20000 });
    expect(child.status).toBe(0); const events = child.stdout.trim().split(/\r?\n/).map(line => JSON.parse(line));
    expect(events).toHaveLength(1); expect(events[0].head_sha256).toMatch(/^[a-f0-9]{64}$/); expect(events[0].sequence).toBe(0);
    if (command === 'status') expect(events[0].ready).toBe(true);
  }
});
