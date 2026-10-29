import pg from 'pg';
import { loadEnvFile } from 'node:process';
import { randomUUID } from 'node:crypto';
import { config, type Config } from '../../src/api/config.js';
import { migrate } from '../../src/api/db/migrate.js';
import { seed } from '../../src/api/db/seed.js';
import { insert } from '../../src/api/db/store.js';
import { createProduct } from '../../src/api/modules/products.js';
import { issueSession, authenticate } from '../../src/api/modules/identity.js';
import { addSeconds, id } from '../../src/api/lib/crypto.js';
import type { Principal } from '../../src/shared/contracts/types.js';
export interface TestDatabase { pool: pg.Pool; cfg: Config; close(): Promise<void> }
export async function testDatabase(): Promise<TestDatabase> {
  loadEnvFile('.env.local'); process.env.APP_ENV = 'test';
  const cfg = config({ env: 'test', devMode: true, paymentsEnabled: false, generationEnabled: false, publishingEnabled: false });
  const name = `ypcc_test_${randomUUID().replaceAll('-', '')}`;
  if (!/^ypcc_test_[a-f0-9]{32}$/.test(name)) throw new Error('Invalid isolated test schema');
  const admin = new pg.Pool({ connectionString: cfg.databaseUrl, max: 2 }); await admin.query(`CREATE SCHEMA ${name}`);
  const pool = new pg.Pool({ connectionString: cfg.databaseUrl, options: `--search_path=${name}`, max: 12, statement_timeout: 15000 });
  try { await migrate(pool); await seed(pool); }
  catch (error) { await pool.end(); await admin.query(`DROP SCHEMA ${name} CASCADE`); await admin.end(); throw error; }
  return { pool, cfg, close: async () => { await pool.end(); await admin.query(`DROP SCHEMA ${name} CASCADE`); await admin.end(); } };
}
export async function account(db: TestDatabase, subject = id('testsubject')): Promise<{ principal: Principal; accessToken: string }> {
  const session = await issueSession(db.pool, { platform: 'alipay', appId: 'dev-alipay', subjectId: subject });
  return { principal: await authenticate(db.pool, `Bearer ${session.access_token}`, db.cfg), accessToken: session.access_token };
}
export async function orderFixture(db: TestDatabase, ceilingMicro = 100, principal?: Principal): Promise<{ principal: Principal; orderId: string }> {
  const p = principal ?? (await account(db)).principal; const product = await createProduct(db.pool, p); const photoId = id('photos'); const profileId = id('profile'); const lockId = id('lock'); const planId = id('plan'); const quoteId = id('quote'); const orderId = id('order');
  await insert(db.pool, 'product_photo_versions', { id: photoId, tenant_id: p.tenantId, product_id: product.product_id, revision: 1, photo_set_hash: 'a'.repeat(64), data: {} });
  await insert(db.pool, 'profile_versions', { id: profileId, tenant_id: p.tenantId, owner_id: p.userId, product_id: product.product_id, photo_version_id: photoId, revision: 1, profile_hash: 'b'.repeat(64), data: {} });
  await insert(db.pool, 'identity_locks', { id: lockId, tenant_id: p.tenantId, profile_id: profileId, hash: 'c'.repeat(64), data: {} });
  await insert(db.pool, 'plan_versions', { id: planId, tenant_id: p.tenantId, owner_id: p.userId, product_id: product.product_id, photo_version_id: photoId, profile_id: profileId, identity_lock_id: lockId, variant_version_id: 'minimal-clean.photo-layout.3.1.0', state: 'READY', plan_hash: 'd'.repeat(64), data: {}, private: {} });
  await insert(db.pool, 'quotes', { id: quoteId, tenant_id: p.tenantId, owner_id: p.userId, plan_id: planId, plan_hash: 'd'.repeat(64), amount_fen: 100, expires_at: addSeconds(900), state: 'CONSUMED', data: {}, private: {} });
  await insert(db.pool, 'orders', { id: orderId, tenant_id: p.tenantId, owner_id: p.userId, quote_id: quoteId, channel: 'alipay', app_id: 'dev-alipay', subject_id: p.subjectId,
    amount_fen: 100, payment_state: 'CONFIRMED', fulfillment_state: 'IN_PROGRESS', payable_until: addSeconds(900), budget_micro: ceilingMicro, deadline_at: addSeconds(600),
    data: { order_id: orderId, channel: 'alipay', currency: 'CNY', amount_fen: 100, payment_state: 'CONFIRMED', fulfillment_state: 'IN_PROGRESS', payable_until: addSeconds(900) }, private: {} });
  return { principal: p, orderId };
}
