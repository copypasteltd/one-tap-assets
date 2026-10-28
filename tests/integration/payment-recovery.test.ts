import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { testDatabase, orderFixture, type TestDatabase } from '../helpers/database.js';
import { insert } from '../../src/api/db/store.js';
import { id, iso, addSeconds, hash } from '../../src/api/lib/crypto.js';
import { transaction } from '../../src/api/db/pool.js';
import { AlipayClient, AlipayBusinessError } from '../../src/api/adapters/alipay.js';
import { PaymentReconciler } from '../../src/worker/payments/reconcile.js';
import { confirmPayment, createOrder, type VerifiedPayment } from '../../src/api/modules/commerce.js';
import { requestDeletion } from '../../src/api/modules/support.js';
import type { DTO } from '../../src/shared/contracts/types.js';
import type { FrozenContract } from '../../src/worker/compiler/snapshot.js';
import { basePlan } from '../../src/worker/compiler/plan.js';
import { profile, variant, TEST_SHA } from '../helpers/fixtures.js';
let db: TestDatabase;
beforeAll(async () => { db = await testDatabase(); }); afterAll(async () => { await db?.close(); });
async function payable(cancelled = false) {
  const { principal: p, orderId } = await orderFixture(db, 100_000_000);
  const row = (await db.pool.query<{ quote_id: string; plan_id: string; product_id: string; profile_id: string; identity_lock_id: string }>(`SELECT o.quote_id,q.plan_id,p.product_id,p.profile_id,p.identity_lock_id
    FROM orders o JOIN quotes q ON q.id=o.quote_id JOIN plan_versions p ON p.id=q.plan_id WHERE o.id=$1`, [orderId])).rows[0]!;
  const inputProfile = { ...profile(), product_id: row.product_id, profile_id: row.profile_id, identity_lock_id: row.identity_lock_id, photo_version: 2 };
  const product = { product_id: row.product_id, revision: 2, photo_version: 2, profile_id: inputProfile.profile_id, created_at: iso() };
  const source = variant(); const creative = basePlan(inputProfile, source); const initialExpiry = addSeconds(86400);
  // Metadata fixtures for retention/payment tests; no real model or buyer media.
  const assets = Array.from({ length: 6 }, () => ({ asset_id: id('asset'), sha256: hash(id('photo')) }));
  for (const asset of assets) await insert(db.pool, 'assets', { id: asset.asset_id, tenant_id: p.tenantId, owner_id: p.userId,
    product_id: product.product_id, purpose: 'PRODUCT_PHOTO', state: 'READY', object_key: `${p.tenantId}/synthetic/${asset.asset_id}.png`,
    upload_token_hash: TEST_SHA, expected_bytes: 12, declared_mime: 'image/png', sha256: asset.sha256,
    expires_at: initialExpiry, grant_expires_at: addSeconds(900) });
  const photoHash = hash({ photos: assets.slice(0, 3), revision: 2, normalization: 'sharp-auto-orient-strip-png-v1' });
  for (const revision of [2, 3]) {
    const photoId = id('photos'); const photos = revision === 2 ? assets.slice(0, 3) : assets.slice(3);
    await insert(db.pool, 'product_photo_versions', { id: photoId, tenant_id: p.tenantId, product_id: product.product_id,
      revision, photo_set_hash: revision === 2 ? photoHash : hash(photos), data: photos });
    for (const [position, asset] of photos.entries()) await insert(db.pool, 'product_photo_items', { id: id('item'),
      tenant_id: p.tenantId, photo_version_id: photoId, asset_id: asset.asset_id, position });
  }
  await db.pool.query('UPDATE product_drafts SET current_profile_id=$2,data=$3 WHERE id=$1', [product.product_id, inputProfile.profile_id, product]);
  const cases = JSON.parse(readFileSync('assets/development/v1.1/contracts/codex-fixtures.json', 'utf8')) as { cases: { name: string; value: unknown }[] };
  const codex = cases.cases.find(c => c.name === 'frozen_codex_contract')!.value as DTO<'CodexContract'>;
  const contract: FrozenContract = { product, profile: inputProfile, photo_set_hash: photoHash, identity_lock_hash: TEST_SHA,
    request: { product_id: product.product_id, photo_version: 2, profile_id: inputProfile.profile_id, identity_lock_id: inputProfile.identity_lock_id,
      preset_id: 'minimal-clean', preset_version: '3.1.0', variant_id: source.variant_id, variant_version: source.version }, creative, source, plan_hash: hash(creative),
    model_versions: [{ provider: 'synthetic-fixture', actual_model: 'fixture-vision', registry_version: 'fixture-v1', roles: ['VISION_ANALYSIS'], capability_hash: TEST_SHA, rate_snapshot_id: 'fixture-rate' }],
    resource_versions: [], codex_contract: codex, budget_micro: 100_000_000, repair_ceiling_micro: 0 };
  const data: DTO<'Order'> = { order_id: orderId, quote_id: row.quote_id, channel: 'alipay', currency: 'CNY', amount_fen: 100,
    payment_state: 'CREATED', fulfillment_state: cancelled ? 'CANCELLED' : 'NOT_STARTED', refund_id: null, job_id: null,
    payable_until: addSeconds(900), delivery_expires_at: null, created_at: iso() };
  await db.pool.query('UPDATE orders SET payment_state=$2,fulfillment_state=$3,data=$4,private=$5 WHERE id=$1', [orderId, data.payment_state, data.fulfillment_state, data, { contract }]);
  const paymentId = id('payment');
  await insert(db.pool, 'payments', { id: paymentId, tenant_id: p.tenantId, order_id: orderId, provider: 'alipay', merchant_id: 'merchant-test', state: 'CREATED', amount_fen: 100, intent_key: `payment:${orderId}`,
    data: { payment_id: paymentId, order_id: orderId, state: 'CREATED', channel: 'alipay', expires_at: data.payable_until, action: { kind: 'QUERY_ORIGINAL_ORDER' } } });
  const event: VerifiedPayment = { channel: 'alipay', appId: p.appId, merchantId: 'merchant-test', subjectId: p.subjectId, orderId,
    providerOrderId: id('vendortrade'), eventKey: id('event'), amountFen: 100, rawHash: TEST_SHA };
  return { tenantId: p.tenantId, p, orderId, paymentId, product, contract, planId: row.plan_id, assets, initialExpiry, event };
}
describe('payment recovery with explicit synthetic provider transport', () => {
  it('does not recreate an original payment after an uncertain submission', async () => {
    const fixture = await payable();
    const cfg = { ...db.cfg, paymentsEnabled: true, alipay: { ...db.cfg.alipay, appId: 'dev-alipay', merchantId: 'merchant-test' } };
    const adapter = new AlipayClient(cfg); const calls: string[] = [];
    vi.spyOn(adapter, 'call').mockImplementation(async method => { calls.push(method); if (method === 'alipay.trade.create') throw new Error('synthetic network drop after submit'); throw new AlipayBusinessError('40004', 'ACQ.TRADE_NOT_EXIST'); });
    const reconciler = new PaymentReconciler(db.pool, cfg, { alipay: adapter });
    await expect(reconciler.create(fixture.tenantId, fixture.orderId)).rejects.toThrow();
    for (let i = 0; i < 4; i++) await reconciler.create(fixture.tenantId, fixture.orderId);
    expect(calls.filter(m => m === 'alipay.trade.create')).toHaveLength(1); expect(calls.filter(m => m === 'alipay.trade.query')).toHaveLength(4);
    expect((await db.pool.query('SELECT state FROM payments WHERE id=$1', [fixture.paymentId])).rows[0].state).toBe('UNKNOWN');
    expect((await db.pool.query('SELECT count(*) AS n FROM ledger_entries WHERE order_id=$1', [fixture.orderId])).rows[0].n).toBe('0');
  });
  it('rejects a paid receipt for a different app, buyer or amount before granting entitlement', async () => {
    const fixture = await payable();
    for (const change of [{ appId: 'other-app' }, { subjectId: 'other-buyer' }, { merchantId: 'other-merchant' }, { amountFen: 101 }]) {
      await expect(transaction(db.pool, client => confirmPayment(client, { ...fixture.event, ...change }))).rejects.toMatchObject({ code: 'PAYMENT_SCOPE_INVALID' });
    }
    expect((await db.pool.query('SELECT count(*) AS n FROM ledger_entries WHERE order_id=$1', [fixture.orderId])).rows[0].n).toBe('0');
  });
  it('grants one immutable snapshot, one job and one ledger entry under twenty concurrent confirmations', async () => {
    const fixture = await payable();
    await Promise.all(Array.from({ length: 20 }, () => transaction(db.pool, client => confirmPayment(client, fixture.event))));
    for (const table of ['ledger_entries', 'execution_snapshots', 'render_jobs']) expect((await db.pool.query(`SELECT count(*) AS n FROM ${table} WHERE order_id=$1`, [fixture.orderId])).rows[0].n).toBe('1');
    expect((await db.pool.query('SELECT count(*) AS n FROM stage_runs WHERE scope_id=$1', [fixture.orderId])).rows[0].n).toBe('6');
    await expect(db.pool.query("UPDATE execution_snapshots SET data='{}' WHERE order_id=$1", [fixture.orderId])).rejects.toThrow('immutable snapshot');
  });
  it('creates an original-channel refund when a cancelled order is paid late', async () => {
    const fixture = await payable(true); await transaction(db.pool, client => confirmPayment(client, fixture.event));
    const refund = (await db.pool.query('SELECT provider,amount_fen,state FROM refunds WHERE order_id=$1', [fixture.orderId])).rows[0];
    expect(refund).toMatchObject({ provider: 'alipay', amount_fen: 100, state: 'REQUESTED' });
    expect((await db.pool.query('SELECT count(*) AS n FROM execution_snapshots WHERE order_id=$1', [fixture.orderId])).rows[0].n).toBe('0');
  });
  it('does not extend any input lifetime when an unpaid order is created', async () => {
    const f = await payable(); const quoteId = id('quote');
    await db.pool.query(`UPDATE execution_variants SET sale_enabled=true,admission_state='ADMITTED',price_fen=100,
      data=data||'{"sale_enabled":true,"admission_state":"ADMITTED"}'::jsonb WHERE variant_id=$1 AND version=$2`,
      [f.contract.source.variant_id, f.contract.source.version]);
    const quote: DTO<'Quote'> = { quote_id: quoteId, plan_id: f.planId, plan_hash: f.contract.plan_hash, state: 'OPEN', currency: 'CNY',
      amount_fen: 100, expires_at: addSeconds(900), output_slots: [], terms_version: 'YPCC-TERMS-3.1', hard_deadline_seconds: 600 };
    await insert(db.pool, 'quotes', { id: quoteId, tenant_id: f.tenantId, owner_id: f.p.userId, plan_id: f.planId,
      plan_hash: quote.plan_hash, amount_fen: 100, expires_at: quote.expires_at, state: 'OPEN', data: quote, private: { contract: f.contract } });
    const productBefore = (await db.pool.query('SELECT expires_at FROM product_drafts WHERE id=$1', [f.product.product_id])).rows[0].expires_at;
    const order = await transaction(db.pool, client => createOrder(client, db.cfg, f.p, { quote_id: quoteId, channel: 'alipay' }));
    expect(order.payment_state).toBe('CREATED');
    expect((await db.pool.query('SELECT expires_at FROM assets WHERE product_id=$1', [f.product.product_id])).rows
      .every(row => row.expires_at.toISOString() === f.initialExpiry)).toBe(true);
    expect((await db.pool.query('SELECT expires_at FROM product_drafts WHERE id=$1', [f.product.product_id])).rows[0].expires_at).toEqual(productBefore);
  });
  it('extends only the confirmed frozen photos and does not refresh expiry on a repeated payment receipt', async () => {
    const f = await payable(); await transaction(db.pool, client => confirmPayment(client, f.event));
    const rows = (await db.pool.query<{ id: string; expires_at: Date }>('SELECT id,expires_at FROM assets WHERE product_id=$1 ORDER BY id', [f.product.product_id])).rows;
    for (const photo of f.assets.slice(0, 3)) expect(rows.find(row => row.id === photo.asset_id)!.expires_at.getTime()).toBeGreaterThan(Date.now() + 6.9 * 86400000);
    for (const photo of f.assets.slice(3)) expect(rows.find(row => row.id === photo.asset_id)!.expires_at.toISOString()).toBe(f.initialExpiry);
    await transaction(db.pool, client => confirmPayment(client, { ...f.event, eventKey: id('replay') }));
    expect((await db.pool.query('SELECT id,expires_at FROM assets WHERE product_id=$1 ORDER BY id', [f.product.product_id])).rows).toEqual(rows);
  });
  it('records the paid fact and refunds an input deleted before confirmation without resurrecting photos', async () => {
    const f = await payable();
    await transaction(db.pool, client => requestDeletion(client, f.p, { scope: 'PRODUCT', product_id: f.product.product_id, acknowledge_inflight_contract: false }));
    const order = await transaction(db.pool, client => confirmPayment(client, f.event));
    expect(order).toMatchObject({ payment_state: 'CONFIRMED', fulfillment_state: 'CANCELLED' });
    expect(order.refund_id).toBeTruthy();
    expect((await transaction(db.pool, client => confirmPayment(client, f.event))).refund_id).toBe(order.refund_id);
    expect((await db.pool.query('SELECT state FROM refunds WHERE order_id=$1', [f.orderId])).rows[0].state).toBe('REQUESTED');
    expect((await db.pool.query('SELECT id FROM execution_snapshots WHERE order_id=$1', [f.orderId])).rowCount).toBe(0);
    expect((await db.pool.query('SELECT expires_at FROM assets WHERE product_id=$1', [f.product.product_id])).rows
      .every(row => row.expires_at.toISOString() === f.initialExpiry)).toBe(true);
  });
  it('refunds a confirmed payment when any frozen photo has expired without retaining the remaining set', async () => {
    const f = await payable(); await db.pool.query("UPDATE assets SET expires_at=now()-interval '1 second' WHERE id=$1", [f.assets[0]!.asset_id]);
    const order = await transaction(db.pool, client => confirmPayment(client, f.event));
    expect(order).toMatchObject({ payment_state: 'CONFIRMED', fulfillment_state: 'CANCELLED' });
    expect((await db.pool.query('SELECT count(*) AS n FROM ledger_entries WHERE order_id=$1', [f.orderId])).rows[0].n).toBe('1');
    expect((await db.pool.query('SELECT id FROM render_jobs WHERE order_id=$1', [f.orderId])).rowCount).toBe(0);
    expect((await db.pool.query('SELECT expires_at FROM assets WHERE id=$1', [f.assets[1]!.asset_id])).rows[0].expires_at.toISOString()).toBe(f.initialExpiry);
  });
});
