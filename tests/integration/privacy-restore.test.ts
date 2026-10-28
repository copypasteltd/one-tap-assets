import { afterEach, it, expect } from 'vitest';
import { mkdir, rm, readFile, writeFile, readdir, unlink, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import type { FastifyInstance } from 'fastify';
import { testDatabase, account, type TestDatabase } from '../helpers/database.js';
import { inside } from '../../src/api/config.js';
import { buildApp } from '../../src/api/app.js';
import { transaction } from '../../src/api/db/pool.js';
import { id, hash } from '../../src/api/lib/crypto.js';
import { createProduct } from '../../src/api/modules/products.js';
import { requestDeletion } from '../../src/api/modules/support.js';
import { owned } from '../../src/api/db/store.js';
import { LocalStorage } from '../../src/api/storage/storage.js';
import { writePrivateObject } from '../../src/api/storage/private-objects.js';
import { DeletionJournal } from '../../src/api/privacy/journal.js';
import { bootstrapDeletionJournal, replayDeletionJournal, finishPrivacyRestore } from '../../src/worker/lifecycle/privacy-restore.js';
import { MediaErasureService } from '../../src/worker/lifecycle/media-erasure.js';
import { WorkerRuntime } from '../../src/worker/runtime.js';
import { ToolConsumer } from '../../src/worker/tool-gateway/consumer.js';

const cases: { db: TestDatabase; root: string; app?: FastifyInstance }[] = [];
afterEach(async () => {
  for (const f of cases.splice(0)) { await f.app?.close(); await f.db.close(); await rm(inside(f.db.cfg.runtimeRoot, f.root), { recursive: true, force: true }); }
});
async function fixture(initialize = true) {
  const db = await testDatabase(); const root = inside(db.cfg.runtimeRoot, `tests/restore/${id('case')}`); await mkdir(root, { recursive: true });
  const entry: typeof cases[number] = { db, root }; cases.push(entry);
  const cfg = { ...db.cfg, runtimeRoot: root, privacyJournal: { enabled: true, directory: 'independent-deletion-journal', sourceId: id('source'), keyId: 'synthetic-key-v1', hmacKey: 'synthetic-journal-key-only-not-real-and-separate' } };
  const journal = new DeletionJournal(cfg); const { principal: p } = await account(db); const product = await createProduct(db.pool, p);
  const store = new LocalStorage(cfg); const key = `${p.tenantId}/input/${id('photo')}.png`; const bytes = Buffer.from('synthetic private bytes for native backup exercise');
  await writePrivateObject(db.pool, store, { tenantId: p.tenantId, ownerId: p.userId, productId: product.product_id, kind: 'INPUT' }, key, bytes, 'image/png');
  if (initialize) await bootstrapDeletionJournal(db.pool, cfg);
  const app = await buildApp({ cfg, pool: db.pool, storage: store, tls: false }); entry.app = app; await app.ready();
  const remove = () => transaction(db.pool, c => requestDeletion(c, p, { scope: 'PRODUCT', product_id: product.product_id, acknowledge_inflight_contract: true }, { journal }));
  const drain = async () => { const media = new MediaErasureService(db.pool, store, id('eraser')); await media.refreshPending(); for (let n = 0; n < 50 && await media.eraseOne(new AbortController().signal); n++) { /* bounded own test objects */ } await media.refreshPending(); };
  return { db, cfg, root, journal, p, product, store, key, bytes, app, remove, drain };
}
it('keeps API readiness closed until initialization and exports legacy tombstones before admitting traffic', async () => {
  const f = await fixture(false);
  expect((await f.app.inject({ method: 'GET', url: '/readyz' })).statusCode).toBe(503);
  await transaction(f.db.pool, c => requestDeletion(c, f.p, { scope: 'PRODUCT', product_id: f.product.product_id, acknowledge_inflight_contract: true }));
  const initialized = await bootstrapDeletionJournal(f.db.pool, f.cfg);
  expect(initialized.sequence).toBe(1); expect((await f.journal.snapshot()).entries[0]!.intent.product_ids).toEqual([f.product.product_id]);
  expect((await f.db.pool.query('SELECT financial_recovery_required FROM privacy_journal_state WHERE source_id=$1', [f.journal.sourceId])).rows[0].financial_recovery_required).toBe(false);
  expect((await f.app.inject({ method: 'GET', url: '/readyz' })).statusCode).toBe(200);
});
it('rolls back deletion when the independent journal cannot be written and preserves the original media', async () => {
  const f = await fixture(); const lock = join(f.root, f.cfg.privacyJournal.directory, 'writer.lock'); await writeFile(lock, 'synthetic competing writer', { flag: 'wx' });
  try { await expect(f.remove()).rejects.toMatchObject({ code: 'PRIVACY_JOURNAL_LOCKED' }); } finally { await unlink(lock); }
  expect((await owned(f.db.pool, 'product_drafts', f.product.product_id, f.p)).deleted_at).toBeNull();
  expect((await f.db.pool.query('SELECT count(*) FROM privacy_deletions')).rows[0].count).toBe('0');
  expect(await f.store.exists(f.key)).toBe(true); expect((await f.journal.snapshot()).head.sequence).toBe(0);
});
it('blocks all public and production admissions after a journal/database commit gap and safely replays the original intent', async () => {
  const f = await fixture();
  await expect(transaction(f.db.pool, async c => { await requestDeletion(c, f.p, { scope: 'PRODUCT', product_id: f.product.product_id, acknowledge_inflight_contract: true }, { journal: f.journal }); throw new Error('synthetic crash before database commit'); })).rejects.toThrow('before database commit');
  const snapshot = await f.journal.snapshot(); expect(snapshot.head.sequence).toBe(1);
  expect((await f.app.inject({ method: 'GET', url: '/v1/p01/runtime-info' })).statusCode).toBe(503);
  expect((await f.app.inject({ method: 'GET', url: '/healthz' })).statusCode).toBe(200);
  const guard = () => f.journal.assertReady(f.db.pool);
  const worker = new WorkerRuntime({ pool: f.db.pool, workerId: id('worker'), stages: {}, events: {}, admissionGuard: guard });
  await expect(worker.processStage(new AbortController().signal)).rejects.toMatchObject({ code: 'PRIVACY_RESTORE_PENDING' });
  const tools = new ToolConsumer(f.db.pool, id('tool'), {}, undefined, guard);
  await expect(tools.process(new AbortController().signal)).rejects.toMatchObject({ code: 'PRIVACY_RESTORE_PENDING' });
  expect(await replayDeletionJournal(f.db.pool, f.cfg, snapshot.sha256)).toEqual({ applied: 1, skipped: 0 });
  await expect(finishPrivacyRestore(f.db.pool, f.cfg, snapshot.sha256)).rejects.toMatchObject({ code: 'PRIVACY_RESTORE_CLEANUP_PENDING' });
  await f.drain(); await finishPrivacyRestore(f.db.pool, f.cfg, snapshot.sha256);
  expect((await f.app.inject({ method: 'GET', url: '/readyz' })).statusCode).toBe(200); expect(await f.store.exists(f.key)).toBe(false);
  expect((await f.db.pool.query('SELECT financial_recovery_required FROM privacy_journal_state WHERE source_id=$1', [f.journal.sourceId])).rows[0].financial_recovery_required).toBe(true);
  const paidJournal = new DeletionJournal({ ...f.cfg, generationEnabled: true });
  await expect(paidJournal.assertReady(f.db.pool)).rejects.toMatchObject({ code: 'FINANCIAL_RESTORE_PENDING' });
  expect(await bootstrapDeletionJournal(f.db.pool, f.cfg)).toEqual({ head_sha256: snapshot.sha256, sequence: snapshot.head.sequence });
  await expect(paidJournal.assertReady(f.db.pool)).rejects.toMatchObject({ code: 'FINANCIAL_RESTORE_PENDING' });
  expect(await replayDeletionJournal(f.db.pool, f.cfg, snapshot.sha256)).toEqual({ applied: 0, skipped: 1 });
  await finishPrivacyRestore(f.db.pool, f.cfg, snapshot.sha256);
});
it('restores an actual native PostgreSQL dump, rejects the stale checkpoint, and erases restored bytes before readiness', async () => {
  const f = await fixture(); const schema = (await f.db.pool.query('SELECT current_schema() AS name')).rows[0].name as string;
  expect(schema).toMatch(/^ypcc_test_[a-f0-9]{32}$/);
  const url = new URL(f.cfg.databaseUrl); const database = decodeURIComponent(url.pathname.slice(1));
  const env: NodeJS.ProcessEnv = { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, WINDIR: process.env.WINDIR, TEMP: f.root, TMP: f.root,
    PGHOST: url.hostname, PGPORT: url.port || '5432', PGUSER: decodeURIComponent(url.username), PGPASSWORD: decodeURIComponent(url.password), PGDATABASE: database, PGSSLMODE: 'disable' };
  const dump = join(f.root, 'database-before-deletion.dump'); const oldHead = await f.journal.readHead();
  const backup = spawnSync(join(f.cfg.projectRoot, 'runtime/tools/pgsql/bin/pg_dump.exe'), ['--format=custom','--no-owner','--no-privileges','--schema',schema,'--file',dump], { env, windowsHide: true, encoding: 'utf8', timeout: 30000 });
  expect(backup.status, backup.stderr).toBe(0);
  await f.remove(); await f.drain(); expect(await f.store.exists(f.key)).toBe(false);
  const latest = await f.journal.readHead(); await f.journal.blockRestore(latest.sha256);
  // Only this freshly created, regex-checked isolated schema is replaced.
  await f.db.pool.query(`DROP SCHEMA ${schema} CASCADE`);
  const restore = spawnSync(join(f.cfg.projectRoot, 'runtime/tools/pgsql/bin/pg_restore.exe'), ['--exit-on-error','--no-owner','--no-privileges','--dbname',database,dump], { env, windowsHide: true, encoding: 'utf8', timeout: 30000 });
  expect(restore.status, restore.stderr).toBe(0);
  await f.store.put(f.key, f.bytes, 'image/png');
  expect((await f.db.pool.query('SELECT deleted_at FROM product_drafts WHERE id=$1', [f.product.product_id])).rows[0].deleted_at).toBeNull();
  expect((await f.app.inject({ method: 'GET', url: '/readyz' })).statusCode).toBe(503);
  await expect(replayDeletionJournal(f.db.pool, f.cfg, oldHead.sha256)).rejects.toMatchObject({ code: 'PRIVACY_JOURNAL_CHECKPOINT_MISMATCH' });
  expect(await replayDeletionJournal(f.db.pool, f.cfg, latest.sha256)).toEqual({ applied: 1, skipped: 0 });
  await expect(owned(f.db.pool, 'product_drafts', f.product.product_id, f.p)).rejects.toMatchObject({ status: 410 });
  await f.drain(); await finishPrivacyRestore(f.db.pool, f.cfg, latest.sha256);
  expect(await f.store.exists(f.key)).toBe(false); expect((await f.app.inject({ method: 'GET', url: '/readyz' })).statusCode).toBe(200);
  await expect(f.db.pool.query('DELETE FROM privacy_replay_receipts')).rejects.toThrow('immutable');
});
it('replays a frozen account deletion without capturing later products or their media', async () => {
  const f = await fixture(); await transaction(f.db.pool, c => requestDeletion(c, f.p, { scope: 'ACCOUNT_MEDIA', acknowledge_inflight_contract: true }, { journal: f.journal }));
  const later = await createProduct(f.db.pool, f.p); const laterKey = `${f.p.tenantId}/input/${id('later')}`;
  await writePrivateObject(f.db.pool, f.store, { tenantId: f.p.tenantId, ownerId: f.p.userId, productId: later.product_id, kind: 'INPUT' }, laterKey, Buffer.from('keep new product'), 'image/png');
  const head = await f.journal.readHead(); await replayDeletionJournal(f.db.pool, f.cfg, head.sha256); await f.drain(); await finishPrivacyRestore(f.db.pool, f.cfg, head.sha256);
  expect((await owned(f.db.pool, 'product_drafts', later.product_id, f.p)).deleted_at).toBeNull(); expect(await f.store.exists(laterKey)).toBe(true);
});
it('rejects edited, missing or wrong-source signed entries without applying a deletion', async () => {
  const f = await fixture(); await f.remove(); const head = await f.journal.readHead(); const directory = join(f.root, f.cfg.privacyJournal.directory);
  const name = (await readdir(directory)).find(n => /^\d{12}-/.test(n))!; const path = join(directory, name); const original = await readFile(path, 'utf8');
  const changed = JSON.parse(original); changed.intent.product_ids = [id('foreign')]; await writeFile(path, JSON.stringify(changed));
  await expect(replayDeletionJournal(f.db.pool, f.cfg, head.sha256)).rejects.toMatchObject({ code: 'PRIVACY_JOURNAL_INVALID' });
  await writeFile(path, original); await unlink(path);
  await expect(f.journal.snapshot(head.sha256)).rejects.toMatchObject({ code: 'PRIVACY_JOURNAL_INCOMPLETE' });
  expect((await f.db.pool.query('SELECT count(*) FROM privacy_replay_receipts')).rows[0].count).toBe('0');
  expect(hash(changed)).not.toBe(head.head.entry_sha256);
  const wrongSource = new DeletionJournal({ ...f.cfg, privacyJournal: { ...f.cfg.privacyJournal, sourceId: id('foreign_source') } });
  await expect(wrongSource.snapshot(head.sha256)).rejects.toMatchObject({ code: 'PRIVACY_JOURNAL_INVALID' });
});
it('refuses a junction in the independent journal path and never writes through to its target', async () => {
  const f = await fixture(false); const target = join(f.root, 'synthetic-junction-target'); await mkdir(target);
  const link = join(f.root, f.cfg.privacyJournal.directory); await symlink(target, link, 'junction');
  await expect(f.journal.readHead()).rejects.toMatchObject({ code: 'PRIVACY_JOURNAL_PATH_UNSAFE' });
  await expect(bootstrapDeletionJournal(f.db.pool, f.cfg)).rejects.toMatchObject({ code: 'PRIVACY_JOURNAL_BOOTSTRAP_BLOCKED' });
  expect(await readdir(target)).toEqual([]);
});
