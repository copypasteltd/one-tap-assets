import pg from 'pg';
import type { Config } from '../config.js';
export type Db = pg.Pool | pg.PoolClient;
export const createPool = (cfg: Config): pg.Pool => new pg.Pool({ connectionString: cfg.databaseUrl,
  ssl: cfg.dbTls ? { rejectUnauthorized: true } : false, max: 12, connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000, statement_timeout: 10000, application_name: 'ypcc' });
export async function transaction<T>(pool: pg.Pool, fn: (db: pg.PoolClient) => Promise<T>): Promise<T> {
  const db = await pool.connect();
  try { await db.query('BEGIN'); const result = await fn(db); await db.query('COMMIT'); return result; }
  catch (error) { await db.query('ROLLBACK'); throw error; }
  finally { db.release(); }
}
