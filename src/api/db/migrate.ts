import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type pg from 'pg';
import { transaction } from './pool.js';
import { sha256 } from '../lib/crypto.js';
export async function migrate(pool: pg.Pool): Promise<void> {
  await transaction(pool, async db => {
    await db.query("SELECT pg_advisory_xact_lock(hashtext('ypcc-migrations'))");
    await db.query('CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, sha256 text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())');
    const folder = resolve('src/api/db/migrations');
    for (const file of (await readdir(folder)).filter(f => f.endsWith('.sql')).sort()) {
      const sql = await readFile(resolve(folder, file), 'utf8');
      const old = await db.query<{ sha256: string }>('SELECT sha256 FROM schema_migrations WHERE version=$1', [file]);
      if (old.rows[0]) { if (old.rows[0].sha256 !== sha256(sql)) throw new Error(`Migration changed: ${file}`); continue; }
      await db.query(sql);
      await db.query('INSERT INTO schema_migrations(version,sha256) VALUES ($1,$2)', [file, sha256(sql)]);
    }
  });
}
