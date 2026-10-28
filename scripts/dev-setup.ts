import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import selfsigned from 'selfsigned';
const root = process.cwd();
await mkdir('runtime/postgres', { recursive: true }); await mkdir('runtime/tls', { recursive: true });
if (!existsSync('.env.local')) {
  const password = randomBytes(24).toString('hex'); const key = randomBytes(32).toString('hex');
  const cert = await selfsigned.generate([{ name: 'commonName', value: 'localhost' }], { keySize: 2048, notAfterDate: new Date(Date.now() + 365 * 86400000), algorithm: 'sha256', extensions: [{ name: 'subjectAltName', altNames: [{ type: 2, value: 'localhost' }, { type: 7, ip: '127.0.0.1' }] }] });
  await writeFile('runtime/tls/localhost.key', cert.private, { mode: 0o600 }); await writeFile('runtime/tls/localhost.crt', cert.cert);
  await writeFile('runtime/postgres/init-password', password, { mode: 0o600 });
  await writeFile('.env.local', `APP_ENV=development\nDEV_MODE=true\nHOST=127.0.0.1\nPORT=3100\nPUBLIC_BASE_URL=https://localhost:3100\nDATABASE_URL=postgresql://ypcc:${password}@127.0.0.1:55432/ypcc\nSIGNING_KEY=${key}\nSTORAGE_DRIVER=local\nTLS_CERT_PATH=runtime/tls/localhost.crt\nTLS_KEY_PATH=runtime/tls/localhost.key\nPAYMENTS_ENABLED=false\nPROVIDER_GENERATION_ENABLED=false\nCOMMUNITY_PUBLISHING_ENABLED=false\nCODEX_SERVICE_ENABLED=false\n`, { mode: 0o600 });
}
const pg = resolve(root, 'runtime/tools/pgsql/bin'); const data = resolve(root, 'runtime/postgres/data');
const run = (binary: string, args: string[], allowFailure = false): number => {
  const result = spawnSync(resolve(pg, `${binary}.exe`), args, { windowsHide: true, cwd: root, encoding: 'utf8', ...(binary === 'pg_ctl' ? { stdio: 'ignore' as const } : {}) });
  if (!allowFailure && result.status !== 0) throw new Error(`${binary}: ${result.stderr || result.stdout || result.error?.message}`);
  return result.status ?? 1;
};
// EDB 17 initdb embeds Windows ANSI library paths in bootstrap SQL. A Chinese
// installation path needs an ASCII bootstrap template; the application DB below
// is explicitly UTF8 and never uses this template's encoding.
if (!existsSync(resolve(data, 'PG_VERSION'))) run('initdb', ['-D', data, '-U', 'ypcc', '-A', 'scram-sha-256', '--pwfile', resolve('runtime/postgres/init-password'), '--encoding=SQL_ASCII', '--locale=C']);
if (run('pg_ctl', ['-D', data, 'status'], true) !== 0) run('pg_ctl', ['-D', data, '-l', resolve('runtime/postgres/server.log'), '-o', '-p 55432 -h 127.0.0.1', '-w', 'start']);
const { config } = await import('../src/api/config.js'); const { createPool } = await import('../src/api/db/pool.js');
const cfg = config(); const url = new URL(cfg.databaseUrl); url.pathname = '/postgres';
const admin = createPool({ ...cfg, databaseUrl: url.toString() });
try { if (!(await admin.query("SELECT 1 FROM pg_database WHERE datname='ypcc'")).rowCount) await admin.query("CREATE DATABASE ypcc TEMPLATE template0 ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C'"); } finally { await admin.end(); }
const pool = createPool(cfg);
try { const { migrate } = await import('../src/api/db/migrate.js'); await migrate(pool); const { seed } = await import('../src/api/db/seed.js'); await seed(pool); } finally { await pool.end(); }
process.stdout.write('Native development database, HTTPS certificate and catalog ready. Credentials stay in .env.local.\n');
