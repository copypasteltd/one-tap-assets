import { beforeAll, afterAll, it, expect } from 'vitest';
import { rm } from 'node:fs/promises';
import sharp from 'sharp';
import type { FastifyInstance, HTTPMethods } from 'fastify';
import { testDatabase, account, type TestDatabase } from '../helpers/database';
import { buildApp } from '../../src/api/app';
import { config, inside } from '../../src/api/config';
import { LocalStorage } from '../../src/api/storage/storage';
import { insert } from '../../src/api/db/store';
import { id, hash, sha256 as hashBytes } from '../../src/api/lib/crypto';
import type { DTO } from '../../src/shared/contracts/types';
import type { HostPort, LocalPhoto } from '../../src/shared/platform/ports';
import { ClientSession } from '../../src/shared/client/session';
import { uploadEvidence } from '../../src/shared/client/evidence';
import {compilePresetConfig} from '../../src/api/modules/community';
import {transaction} from '../../src/api/db/pool';
import {CREATIVE_COMPONENTS} from '../../src/shared/domain/creative-components';

type Actor = Awaited<ReturnType<typeof account>>;
let db: TestDatabase; let app: FastifyInstance; let folder: string; let a: Actor; let b: Actor; let buyer: Actor; let otherBuyer: Actor;
let componentIds: string[]; let blueprint: string; let cfg: ReturnType<typeof config>;
beforeAll(async () => {
  db = await testDatabase(); folder = inside(db.cfg.runtimeRoot, `tests/community/${id('case')}`); cfg = config({ ...db.cfg, runtimeRoot: folder });
  app = await buildApp({ cfg, pool: db.pool, storage: new LocalStorage(cfg), tls: false });
  [a, b, buyer, otherBuyer] = await Promise.all([account(db), account(db), account(db), account(db)]);
  const c = await app.inject({ method: 'GET', url: '/v1/p01/community-components' });
  // Registries require a session, matching the creator UI's login boundary.
  const components = await request('GET', '/community-components', a);
  componentIds = components.json<{ data: DTO<'ComponentOptionList'> }>().data.items.filter(x => x.type === 'STYLE').map(x => x.component_version_id);
  const specs = (await request('GET', '/variant-blueprints', a)).json<{ data: DTO<'VariantBlueprintList'> }>().data.items;
  blueprint = specs.find(x => x.engine === 'PHOTO_LAYOUT')!.blueprint_id; expect(c.statusCode).toBe(401);
});
afterAll(async () => { await app?.close(); await db?.close(); if (folder) await rm(inside(db.cfg.runtimeRoot, folder), { recursive: true, force: true }); });
function request(method: HTTPMethods, path: string, actor?: Actor, body?: unknown, key?: string) {
  return app.inject({ method, url: `/v1/p01${path}`, headers: { ...(actor ? { authorization: `Bearer ${actor.accessToken}` } : {}),
    ...(key ? { 'idempotency-key': key } : {}), ...(body !== undefined ? { 'content-type': 'application/json' } : {}) }, ...(body !== undefined ? { payload: JSON.stringify(body) } : {}) });
}
function settings(name = '测试作者的清新方案'): DTO<'PresetConfig'> { return { name, description: '仅用于原生数据库与界面接口验证的原创测试说明', style_tags: ['自然', '清新'],
  parent_preset_version: null, component_versions: [componentIds[0]!], variant_blueprint_ids: [blueprint], resource_version_ids: [], fork_allowed: true }; }
it('creative components persist all four categories through the authenticated author API and freeze distinct executable sources',async()=>{
  const registry=(await request('GET','/community-components',a)).json<{data:DTO<'ComponentOptionList'>}>().data;
  expect(registry.items).toHaveLength(25);
  const config={...settings('受控四类组件'),component_versions:[componentIds[0]!,'narrative.detail-first.1','rhythm.quick-open.1','camera.hold.1','caption.bold.1']};
  const created=await request('POST','/preset-drafts',a,{config},id('creative-create'));expect(created.statusCode,created.body).toBe(201);
  const d=created.json<{data:DTO<'PresetDraft'>}>().data;
  expect((await request('GET',`/preset-drafts/${d.draft_id}`,a)).json().data.config).toEqual(config);
  expect((await request('GET',`/preset-drafts/${d.draft_id}`,b)).statusCode).toBe(404);
  const [first]=await transaction(db.pool,tx=>compilePresetConfig(tx,config));
  const changed={...config,component_versions:config.component_versions.map(c=>c==='camera.hold.1'?'camera.pan.1':c)};
  const update=await request('PATCH',`/preset-drafts/${d.draft_id}`,a,{expected_revision:d.revision,config:changed},id('creative-update'));
  expect(update.statusCode,update.body).toBe(200);
  const [second]=await transaction(db.pool,tx=>compilePresetConfig(tx,changed));
  expect(second!.source_hash).not.toBe(first!.source_hash);
  expect(first!.source.creative_components.community_direction).toMatchObject({camera:'HOLD',caption:'bold',narrative:'DETAIL_FIRST',rhythm:'QUICK_OPEN'});
  expect(second!.source.creative_components.community_direction).toMatchObject({camera:'PAN'});
  expect((first!.source.community_binding as {component_bindings:unknown[]}).component_bindings).toHaveLength(5);
});
it('creative components reject duplicate categories and engine conflicts before creating an author draft',async()=>{
  for(const ids of [['camera.hold.1','camera.pan.1'],['engine.REFERENCE_FILM.1']]){
    const result=await request('POST','/preset-drafts',a,{config:{...settings(),component_versions:[componentIds[0]!,...ids]}},id('creative-denied'));
    expect(result.statusCode,result.body).toBe(422);expect(result.json().code).toBe(ids.length===2?'COMMUNITY_COMPONENT_CONFLICT':'COMPONENT_ENGINE_MISMATCH');
  }
});
it('creative components reject altered registered text or version instead of silently compiling untrusted instructions',async()=>{
  const definition=CREATIVE_COMPONENTS.find(c=>c.option.component_version_id==='camera.hold.1')!;
  const config={...settings(),component_versions:[componentIds[0]!,definition.option.component_version_id]};
  await db.pool.query('UPDATE component_versions SET data=$2 WHERE id=$1',[definition.option.component_version_id,{...definition.option,description:'powershell untrusted'}]);
  try{await expect(transaction(db.pool,tx=>compilePresetConfig(tx,config))).rejects.toMatchObject({code:'COMMUNITY_COMPONENT_UNSUPPORTED'});}
  finally{await db.pool.query('UPDATE component_versions SET data=$2 WHERE id=$1',[definition.option.component_version_id,definition.option]);}
  await db.pool.query("UPDATE component_versions SET version='9.9.9' WHERE id=$1",[definition.option.component_version_id]);
  try{await expect(transaction(db.pool,tx=>compilePresetConfig(tx,config))).rejects.toMatchObject({code:'COMMUNITY_COMPONENT_UNSUPPORTED'});}
  finally{await db.pool.query('UPDATE component_versions SET version=$2 WHERE id=$1',[definition.option.component_version_id,definition.version]);}
});
async function draft(actor: Actor, name = id('draft-name')): Promise<DTO<'PresetDraft'>> {
  const r = await request('POST', '/preset-drafts', actor, { config: settings(name) }, id('create-draft')); expect(r.statusCode, r.body).toBe(201); return r.json<{ data: DTO<'PresetDraft'> }>().data;
}
it('persists dotted and colon intent keys at both length boundaries and rejects invalid keys without creating drafts', async () => {
  for (const key of ['ui:k._-0', `ui:${'k'.repeat(125)}`]) {
    const body = { config: settings(`幂等边界${key.length}`) };
    const created = await request('POST', '/preset-drafts', a, body, key); expect(created.statusCode, created.body).toBe(201);
    const replay = await request('POST', '/preset-drafts', a, body, key); expect(replay.statusCode, replay.body).toBe(201);
    expect(replay.json().data.draft_id).toBe(created.json().data.draft_id);
  }
  const count = async () => Number((await db.pool.query<{ count: string }>('SELECT count(*) FROM preset_drafts WHERE owner_id=$1', [a.principal.userId])).rows[0]!.count);
  const before = await count();
  for (const key of ['short-7', 'k'.repeat(129), 'ui:key/0', 'ui:key 0']) {
    const rejected = await request('POST', '/preset-drafts', a, { config: settings() }, key);
    expect(rejected.statusCode, rejected.body).toBe(400); expect(rejected.json().code).toBe('IDEMPOTENCY_REQUIRED');
  }
  expect(await count()).toBe(before);
});
it('authenticates every creator recovery query and scopes nested samples and private records to their owner', async () => {
  const d = await draft(a);
  for (const path of ['/rights-records', '/preset-publications', '/appeals', '/creator/reports', `/preset-drafts/${d.draft_id}/samples`]) expect((await request('GET', path)).statusCode).toBe(401);
  expect((await request('GET', `/preset-drafts/${d.draft_id}`, b)).statusCode).toBe(404);
  expect((await request('GET', `/preset-drafts/${d.draft_id}/samples`, b)).statusCode).toBe(404);
  const list = (await request('GET', '/preset-drafts?limit=100', b)).json<{ data: DTO<'PresetDraftList'> }>().data;
  expect(list.items.some(x => x.draft_id === d.draft_id)).toBe(false);
});
it('rejects unregistered components, executable text, duplicate/ambiguous styles and incompatible production choices', async () => {
  const invalid = [
    { ...settings(), component_versions: ['untrusted.script.1'] },
    { ...settings(), description: 'https://untrusted.invalid/run-script' },
    { ...settings(), component_versions: componentIds.slice(0, 2) },
    { ...settings(), component_versions: [componentIds[0]!, 'engine.REFERENCE_FILM.1'] },
    { ...settings(), variant_blueprint_ids: [blueprint, blueprint] },
    { ...settings(), parent_preset_version: 'unproven-parent@1.0.0' },
  ];
  for (const value of invalid) expect((await request('POST', '/preset-drafts', a, { config: value }, id('bad-draft'))).statusCode).toBe(422);
  const unknownField = await request('POST', '/preset-drafts', a, { config: { ...settings(), model_endpoint: 'https://untrusted.invalid' } }, id('unknown-field'));
  expect(unknownField.statusCode).toBe(400); expect(unknownField.json().code).toBe('INVALID_REQUEST');
});
it('keeps optimistic draft edits and original fork attribution across replays and concurrent modifications', async () => {
  const d = await draft(a); const body = { expected_revision: 0, config: { ...d.config, name: '更新后的方案' } }; const key = id('draft-edit');
  const first = await request('PATCH', `/preset-drafts/${d.draft_id}`, a, body, key); expect(first.statusCode).toBe(200);
  expect((await request('PATCH', `/preset-drafts/${d.draft_id}`, a, body, key)).json().data).toEqual(first.json().data);
  expect((await request('PATCH', `/preset-drafts/${d.draft_id}`, a, { ...body, config: { ...body.config, name: '过时编辑' } }, id('stale'))).statusCode).toBe(409);
  const race = await Promise.all(['甲', '乙'].map(name => request('PATCH', `/preset-drafts/${d.draft_id}`, a, { expected_revision: 1, config: { ...d.config, name } }, id('race'))));
  expect(race.map(r => r.statusCode).sort()).toEqual([200, 409]);
  const preset = (await request('GET', '/presets?limit=1')).json<{ data: DTO<'PresetSummaryList'> }>().data.items[0]!;
  const forkBody = { parent_version: preset.version, name: '有来源的派生方案' }; const forkKey = id('fork');
  const fork = await request('POST', `/presets/${preset.preset_id}/forks`, b, forkBody, forkKey); expect(fork.statusCode, fork.body).toBe(201);
  expect((await request('POST', `/presets/${preset.preset_id}/forks`, b, forkBody, forkKey)).json().data).toEqual(fork.json().data);
  const f = fork.json<{ data: DTO<'PresetDraft'> }>().data; expect(f.config.parent_preset_version).toBe(`${preset.preset_id}@${preset.version}`);
  expect((await request('PATCH', `/preset-drafts/${f.draft_id}`, b, { expected_revision: 0, config: { ...f.config, parent_preset_version: null } }, id('remove-parent'))).statusCode).toBe(422);
});
it('paginates favorites with account-bound cursors, current sale status and removal of withdrawn entries', async () => {
  const presets = (await request('GET', '/presets?limit=4')).json<{ data: DTO<'PresetSummaryList'> }>().data.items;
  for (const p of presets) expect((await request('PUT', `/presets/${p.preset_id}/favorite`, buyer, {})).statusCode).toBe(200);
  const first = (await request('GET', '/favorites?limit=2', buyer)).json<{ data: DTO<'PresetSummaryList'> }>().data;
  expect(first.items).toHaveLength(2); expect(first.next_cursor).toBeTruthy();
  const second = (await request('GET', `/favorites?limit=2&cursor=${encodeURIComponent(first.next_cursor!)}`, buyer)).json<{ data: DTO<'PresetSummaryList'> }>().data;
  expect(new Set([...first.items, ...second.items].map(x => x.preset_id)).size).toBe(4); expect(second.next_cursor).toBeNull();
  expect((await request('GET', `/favorites?limit=2&cursor=${encodeURIComponent(first.next_cursor!)}`, otherBuyer)).statusCode).toBe(400);
  expect((await request('GET', '/favorites?limit=101', buyer)).statusCode).toBe(400);
  expect((await request('GET', '/favorites', otherBuyer)).json().data.items).toEqual([]);
  const p = presets[0]!;
  await db.pool.query("UPDATE presets SET data=jsonb_set(data,'{sale_enabled}','true'::jsonb) WHERE id=$1", [p.preset_id]);
  expect((await request('GET', '/favorites?limit=100', buyer)).json<{ data: DTO<'PresetSummaryList'> }>().data.items.find(x => x.preset_id === p.preset_id)!.sale_enabled).toBe(false);
  await db.pool.query("UPDATE presets SET visibility='PRIVATE' WHERE id=$1", [p.preset_id]);
  try { expect((await request('DELETE', `/presets/${p.preset_id}/favorite`, buyer, {})).statusCode).toBe(200); }
  finally { await db.pool.query("UPDATE presets SET visibility='PUBLIC',data=jsonb_set(data,'{sale_enabled}','false'::jsonb) WHERE id=$1", [p.preset_id]); }
});
it('recovers actual sample/publication rows through scoped pages without exposing private payloads or certifying generation', async () => {
  const d = await draft(a); const another = await draft(a); const ids: string[] = [];
  for (let n = 0; n < 3; n++) {
    const sampleId = id('sample'); ids.push(sampleId); const data: DTO<'Sample'> = { sample_id: sampleId, draft_id: d.draft_id, state: 'QUEUED', visibility: 'PRIVATE', rights_verified: false };
    await insert(db.pool, 'public_samples', { id: sampleId, tenant_id: a.principal.tenantId, owner_id: a.principal.userId, draft_id: d.draft_id, state: 'QUEUED', data, private: { not_public: 'synthetic secret evidence' } });
  }
  const first = (await request('GET', `/preset-drafts/${d.draft_id}/samples?limit=2`, a)).json<{ data: DTO<'SampleList'> }>().data;
  expect(first.items).toHaveLength(2); expect(JSON.stringify(first)).not.toContain('not_public'); expect(first.items.every(x => x.state === 'QUEUED')).toBe(true);
  const second = (await request('GET', `/preset-drafts/${d.draft_id}/samples?limit=2&cursor=${encodeURIComponent(first.next_cursor!)}`, a)).json<{ data: DTO<'SampleList'> }>().data;
  expect(new Set([...first.items, ...second.items].map(x => x.sample_id))).toEqual(new Set(ids));
  expect((await request('GET', `/preset-drafts/${another.draft_id}/samples?cursor=${encodeURIComponent(first.next_cursor!)}`, a)).statusCode).toBe(400);
  expect((await request('POST', `/preset-samples/${ids[0]}/media-links`, a, {}, id('not-ready'))).statusCode).toBe(422);
  const pub: DTO<'Publication'> = { publication_id: id('publication'), draft_id: d.draft_id, revision: 0, state: 'UNDER_REVIEW', admission_state: 'NOT_EVALUATED', sale_enabled: false, reason_codes: [], preset_id: null, published_version: null };
  await insert(db.pool, 'publications', { id: pub.publication_id, tenant_id: a.principal.tenantId, owner_id: a.principal.userId, draft_id: d.draft_id, draft_revision: 0, review_state: pub.state, admission_state: pub.admission_state, data: pub, private: { hidden: 'synthetic author-only source' } });
  expect((await request('GET', '/preset-publications', a)).json().data.items).toContainEqual(pub);
  expect((await request('GET', '/preset-publications', b)).json().data.items).not.toContainEqual(pub);
});
it('shows authors only governance metadata for their own presets and keeps reporter evidence and appeals private', async () => {
  const presetId = id('community-preset'); const versionId = id('preset-version'); const version = '1.0.0';
  const summary: DTO<'PresetSummary'> = { preset_id: presetId, version, name: '测试作者方案', author_name: '测试作者', source: 'COMMUNITY', style_tags: ['清新'], sample_id: null, sample_label: 'AUTHORIZED_SAMPLE_NOT_YOUR_RESULT', sale_enabled: false };
  const detail: DTO<'PresetDetail'> = { preset: summary, description: '独立合成治理测试', variants: [], license_summary: '测试许可', fork_allowed: false, parent_version: null };
  await insert(db.pool, 'presets', { id: presetId, author_id: a.principal.userId, source: 'COMMUNITY', current_version: version, data: summary });
  await insert(db.pool, 'preset_versions', { id: versionId, preset_id: presetId, version, hash: hash(detail), license_version: 'fixture-license', data: detail });
  const created = await request('POST', `/presets/${presetId}/reports`, buyer, { preset_version: version, reason: 'RIGHTS', message: 'synthetic private reporter statement' }, id('report'));
  expect(created.statusCode).toBe(201); const report = created.json<{ data: DTO<'Report'> }>().data;
  expect((await request('GET', '/creator/reports', a)).json().data.items).toContainEqual(report);
  expect((await request('GET', '/creator/reports', b)).json().data.items).not.toContainEqual(report);
  expect((await request('GET', `/reports/${report.report_id}`, a)).statusCode).toBe(404);
  expect(JSON.stringify((await request('GET', '/creator/reports', a)).json())).not.toContain('synthetic private reporter statement');
  expect((await request('POST', `/reports/${report.report_id}/appeals`, a, { message: '决定形成前不能申诉' }, id('early'))).statusCode).toBe(422);
  await db.pool.query("UPDATE moderation_reports SET state='RESOLVED',data=jsonb_set(data,'{state}','\"RESOLVED\"'::jsonb) WHERE id=$1", [report.report_id]);
  expect((await request('POST', `/reports/${report.report_id}/appeals`, b, { message: '无权申诉' }, id('denied'))).statusCode).toBe(404);
  const appeal = await request('POST', `/reports/${report.report_id}/appeals`, a, { message: '测试作者请求复核' }, id('appeal'));
  expect(appeal.statusCode).toBe(201); expect((await request('GET', '/appeals', a)).json().data.items).toContainEqual(appeal.json().data);
  expect((await request('GET', '/appeals', buyer)).json().data.items).not.toContainEqual(appeal.json().data);
});

async function evidenceClient(actor: Actor, fault?: 'LOST_ACK' | 'SWITCH') {
  let writes = 0; let lost = false; const values = new Map<string, unknown>(); let session: ClientSession;
  const host: HostPort = { platform: 'alipay', storage: { get: <T,>(key: string) => (values.get(key) as T) ?? null, set: (key, value) => { values.set(key, value); }, remove: key => { values.delete(key); } },
    transport: async wire => { const url = new URL(wire.url); const r = await app.inject({ method: wire.method as HTTPMethods, url: url.pathname + url.search, headers: wire.headers, ...(typeof wire.body === 'string' ? { payload: wire.body } : {}) });
      if (fault === 'LOST_ACK' && !lost && url.pathname.endsWith('/complete') && r.statusCode === 200) { lost = true; throw new Error('synthetic response loss after commit'); }
      return { status: r.statusCode, data: r.json(), headers: {} }; },
    upload: async (grant, photo) => { writes++; const boundary = 'ypcc-private-proof-fixture';
      const payload = Buffer.concat([Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="proof.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`), Buffer.from(photo.bytes), Buffer.from(`\r\n--${boundary}--\r\n`)]);
      const r = await app.inject({ method: 'POST', url: new URL(grant.upload_url).pathname, headers: { ...grant.headers, 'content-type': `multipart/form-data; boundary=${boundary}` }, payload }); expect(r.statusCode, r.body).toBe(204);
      if (fault === 'SWITCH') session.attach({ access_token: otherBuyer.accessToken, user_id: otherBuyer.principal.userId, token_type: 'Bearer', expires_at: '2099-01-01T00:00:00Z' }); },
    login: async () => { throw new Error('real login must not run'); }, choosePhotos: async () => [], pay: async () => 'UNKNOWN', download: async () => '', save: async () => 'UNKNOWN', copy: async () => {} };
  session = new ClientSession(host, cfg.publicBaseUrl); session.attach({ access_token: actor.accessToken, user_id: actor.principal.userId, token_type: 'Bearer', expires_at: '2099-01-01T00:00:00Z' });
  const photos: LocalPhoto[] = [];
  for (let n = 0; n < 2; n++) { const bytes = await sharp({ create: { width: 800, height: 640, channels: 3, background: { r: 60 + n * 20, g: 100, b: 70 } } }).jpeg().toBuffer(); photos.push({ path: `synthetic-proof-${n}`, bytes: Uint8Array.from(bytes).buffer, width: 800, height: 640, mime: 'image/jpeg', sha256: hashBytes(bytes) }); }
  return { session, photos, writes: () => writes };
}
it('recovers an evidence batch after a lost completion response without duplicate uploads or rights submissions', async () => {
  const actor = await account(db); const f = await evidenceClient(actor, 'LOST_ACK');
  await expect(uploadEvidence(f.session, f.photos, 'original-proof-batch', 'RIGHTS_EVIDENCE')).rejects.toMatchObject({ code: 'NETWORK_UNKNOWN' });
  const ids = await uploadEvidence(f.session, f.photos, 'original-proof-batch', 'RIGHTS_EVIDENCE'); expect(ids).toHaveLength(2); expect(f.writes()).toBe(2);
  const body: DTO<'RightsRecordRequest'> = { scope: 'SAMPLE_PUBLICATION', statement: 'synthetic proof only', evidence_asset_ids: ids }; const key = id('rights');
  const first = await request('POST', '/rights-records', actor, body, key); expect(first.statusCode).toBe(201);
  expect((await request('POST', '/rights-records', actor, body, key)).json().data).toEqual(first.json().data);
  const rows = (await request('GET', '/rights-records', actor)).json<{ data: DTO<'RightsRecordList'> }>().data.items; expect(rows).toEqual([first.json().data]);
  expect((await request('GET', `/rights-records/${rows[0]!.rights_record_id}`, otherBuyer)).statusCode).toBe(404);
  expect((await db.pool.query('SELECT count(*)::int AS n FROM assets WHERE tenant_id=$1 AND owner_id=$2', [actor.principal.tenantId, actor.principal.userId])).rows[0].n).toBe(2);
});
it('stops an evidence upload at an account switch without binding the old owner media to the new account', async () => {
  const actor = await account(db); const f = await evidenceClient(actor, 'SWITCH');
  await expect(uploadEvidence(f.session, f.photos, 'switching-proof-batch', 'RIGHTS_EVIDENCE')).rejects.toMatchObject({ code: 'ACCOUNT_CHANGED' }); expect(f.writes()).toBe(1);
  const rows = (await db.pool.query('SELECT owner_id,purpose FROM assets WHERE tenant_id=$1', [actor.principal.tenantId])).rows;
  expect(rows).toEqual([{ owner_id: actor.principal.userId, purpose: 'RIGHTS_EVIDENCE' }]);
});
