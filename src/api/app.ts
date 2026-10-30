import Fastify, { type FastifyInstance, type HTTPMethods } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import { Transform } from 'node:stream';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type pg from 'pg';
import type { Config } from './config.js';
import type { ObjectStorage } from './storage/storage.js';
import { storage as createStorage } from './storage/storage.js';
import { createPool, transaction } from './db/pool.js';
import { id, hash, sha256 } from './lib/crypto.js';
import { AppError, requireThat, notFound } from './lib/errors.js';
import { validate, validator } from './lib/validation.js';
import { authenticate, exchangeIdentity, issueSession, type PlatformIdentity } from './modules/identity.js';
import { businessHandlers, type BusinessContext } from './routes/business.js';
import { idempotent } from './db/store.js';
import { uploadAsset, authorizeUpload } from './modules/assets.js';
import { getDeliverables, verifyDownload } from './modules/delivery.js';
import {assertPlusOperation,assertPlusDownload} from './modules/plus-access.js';
import type { DTO, Principal, SchemaName } from '../shared/contracts/types.js';
import type { InferenceHttp } from '../worker/codex/inference.js';
import { sampleContext } from '../worker/samples/context.js';
import { verifySampleFiles, type SampleObject } from './modules/sample-evidence.js';
import { authorizedSample, authorizedFile } from './modules/authorized-samples.js';
import { deletionJournal } from './privacy/journal.js';
import { previewMedia,checkPreviewBytes } from './modules/previews.js';
import {requestRateLimit} from '../worker/tool-gateway/traffic.js';
import {registerSupportConsole} from './routes/support-console.js';

interface Endpoint { method: string; path: string; operation_id: string; request_schema: SchemaName | null; response_schema: SchemaName | null; success_status: number; auth_policy: string; idempotency_required: boolean }
export interface AppDependencies { cfg: Config; pool?: pg.Pool; storage?: ObjectStorage; exchange?: (request: DTO<'SessionRequest'>) => Promise<PlatformIdentity>; tls?: boolean; testErrorObserver?: (error: unknown) => void; inferenceHttp?: InferenceHttp }
export async function buildApp(deps: AppDependencies): Promise<FastifyInstance> {
  const cfg = deps.cfg; const pool = deps.pool ?? createPool(cfg); const store = deps.storage ?? createStorage(cfg);
  const journal = deletionJournal(cfg);
  const tls = deps.tls !== false && cfg.tlsCert && cfg.tlsKey ? { cert: await readFile(resolve(cfg.tlsCert)), key: await readFile(resolve(cfg.tlsKey)) } : undefined;
  const app = Fastify({ ...(tls ? { https: tls } : {}), routerOptions: { maxParamLength: 2048 },
    bodyLimit: 10_000_000, requestTimeout: 30000, connectionTimeout: 10000,
    genReqId: () => id('trace'), logger: cfg.env === 'test' ? false : { level: cfg.logLevel, serializers: { req: r => ({ method: r.method, route: r.routeOptions?.url }), res: r => ({ status: r.statusCode }) }, redact: ['req.headers.authorization', 'req.body', 'res.headers.location'] } });
  await app.register(cors, { origin: cfg.webOrigins, credentials: false, allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'X-Upload-Token', 'X-Host-OS'], methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'] });
  await app.register(helmet, { ...(!cfg.publicBaseUrl.startsWith('https://') ? { hsts: false } : {}), contentSecurityPolicy: { directives: { defaultSrc: ["'self'"], imgSrc: ["'self'", 'data:', 'blob:'], mediaSrc: ["'self'", 'blob:'], styleSrc: ["'self'", "'unsafe-inline'"], connectSrc: ["'self'", ...cfg.webOrigins], upgradeInsecureRequests: cfg.publicBaseUrl.startsWith('https://') ? [] : null } } });
  await app.register(rateLimit, requestRateLimit(pool,cfg));
  await app.register(multipart, { limits: { files: 1, fields: 0, parts: 1, fileSize: 10000000, fieldNameSize: 100, headerPairs: 20 }, throwFileSizeLimit: true });
  app.addContentTypeParser('application/octet-stream', { parseAs: 'buffer', bodyLimit: 10_000_000 }, (_req, body, done) => done(null, body));
  app.addContentTypeParser('application/x-www-form-urlencoded', { parseAs: 'string' }, (_req, body, done) => done(null, Object.fromEntries(new URLSearchParams(String(body)))));
  app.setErrorHandler((error, request, reply) => {
    if (cfg.env === 'test') deps.testErrorObserver?.(error);
    const tooLarge = error !== null && typeof error === 'object' && 'statusCode' in error && error.statusCode === 413;
    const rateLimited = error !== null && typeof error === 'object' && 'statusCode' in error && error.statusCode === 429;
    const e = error instanceof AppError ? error : rateLimited ? new AppError('RATE_LIMITED','请求较频繁，请稍后重试',429,true)
      : new AppError(tooLarge ? 'BODY_TOO_LARGE' : 'INTERNAL_ERROR', tooLarge ? '上传内容超过大小限制' : '服务暂时无法处理，请保留订单后重试', tooLarge ? 413 : 500, true);
    if (e.status >= 500) request.log.error({ code: e.code, trace_id: request.id }, 'request failed');
    void reply.code(e.status).send({ code: e.code, message: e.message, retryable: e.retryable, trace_id: request.id, details: e.details });
  });
  app.get('/healthz', async () => { await pool.query('SELECT 1'); return { status: 'ok', service: '一品成片', version: '0.1.0' }; });
  registerSupportConsole(app);
  app.addHook('onRequest', async request => { if (request.url.split('?')[0] !== '/healthz') await journal?.assertReady(pool); });
  app.get('/readyz', async () => { await pool.query('SELECT 1'); await journal?.assertReady(pool); return { status: 'ready' }; });
  app.get('/v1/p01/runtime-info', async () => ({ data: { dev_mode: cfg.devMode, payment_enabled: cfg.paymentsEnabled, generation_enabled: cfg.generationEnabled, codex_enabled: cfg.codex.enabled }, trace_id: id('trace') }));
  const catalog = JSON.parse(await readFile('assets/development/v1.1/contracts/endpoints.json', 'utf8')) as { endpoints: Endpoint[] };
  for (const e of catalog.endpoints) {
    if (e.operation_id === 'receivePaymentEvent') continue;
    if (e.operation_id === 'createPlatformSession') {
      app.post('/v1/p01/sessions/platform', { config: { rateLimit: { max: 15, timeWindow: '1 minute' } } }, async (request, reply) => {
        const data = validate('SessionRequest', request.body); const identity = await (deps.exchange ? deps.exchange(data) : exchangeIdentity(cfg, data));
        const session = await issueSession(pool, identity); return reply.send({ data: validate('Session', session, true), trace_id: request.id });
      }); continue;
    }
    const handler = businessHandlers[e.operation_id]; if (!handler) throw new Error(`Missing operation implementation: ${e.operation_id}`);
    app.route({ ...(e.operation_id.includes('Plus')?{config:{rateLimit:{max:e.operation_id==='createPlusLink'?15:e.operation_id==='pollPlusLink'?60:30,timeWindow:'1 minute'}}}:{}), method: e.method as HTTPMethods, url: `/v1/p01${e.path.replaceAll(/\{([^}]+)\}/g, ':$1')}`, handler: async (request, reply) => {
      if(e.operation_id.includes('Plus')||['getSupportTicket','listSupportTickets','recommendPresets','recordRecommendationEvent','getUsageFeedback','setUsageFeedback'].includes(e.operation_id))reply.header('Cache-Control','private, no-store').header('Referrer-Policy','no-referrer');
      const principal: Principal | null = e.auth_policy.startsWith('public') ? null : await authenticate(pool, request.headers.authorization, cfg);
      if (e.request_schema) validate(e.request_schema, request.body);
      const params = request.params as Record<string, string>;
      const body = request.body ?? {};
      const result = await transaction(pool, async db => {
        await assertPlusOperation(db,principal,e.operation_id);
        const ctx: BusinessContext = { db, cfg, principal, params, body, query: request.query as BusinessContext['query'] };
        const execute = async (): Promise<unknown> => {
          const data = await handler(ctx);
          if (e.response_schema) validate(e.response_schema, data, true);
          return data;
        };
        return e.idempotency_required && principal ? idempotent(db, principal, e.operation_id, Object.values(params).join(':'), typeof request.headers['idempotency-key'] === 'string' ? request.headers['idempotency-key'] : undefined, body, execute) : execute();
      });
      return reply.code(e.success_status).send({ data: result, trace_id: request.id });
    } });
  }
  app.put<{ Params: { asset_id: string } }>('/storage/uploads/:asset_id', async (request, reply) => {
    requireThat(Buffer.isBuffer(request.body), 'UPLOAD_BODY_INVALID', '请上传原始照片文件', 400);
    const secret = request.headers['x-upload-token']; requireThat(typeof secret === 'string', 'UPLOAD_NOT_AUTHORIZED', '缺少上传授权', 401);
    await uploadAsset(pool, store, request.params.asset_id, secret, request.body); return reply.code(204).send();
  });
  app.post<{ Params: { asset_id: string } }>('/storage/uploads/:asset_id', {
    onRequest: async request => {
      const secret = request.headers['x-upload-token']; requireThat(typeof secret === 'string', 'UPLOAD_NOT_AUTHORIZED', '缺少上传授权', 401);
      await authorizeUpload(pool, request.params.asset_id, secret);
    },
    preParsing: async (_request, _reply, payload) => {
      let total = 0;
      const limited = Object.assign(new Transform({ transform(chunk: Buffer, _encoding, callback) {
        total += chunk.length; limited.receivedEncodedLength = total;
        callback(total > 10032768 ? new AppError('BODY_TOO_LARGE', '上传内容超过大小限制', 413) : null, chunk);
      } }), { receivedEncodedLength: 0 });
      payload.on('error', error => limited.destroy(error)); return payload.pipe(limited);
    },
  }, async (request, reply) => {
    requireThat(request.isMultipart(), 'UPLOAD_BODY_INVALID', '请按授权格式上传照片文件', 400);
    let bytes: Buffer | null = null;
    for await (const part of request.parts()) {
      requireThat(part.type === 'file' && part.fieldname === 'file', 'UPLOAD_BODY_INVALID', '每次仅上传一份照片文件', 400);
      bytes = await part.toBuffer(); requireThat(!part.file.truncated, 'BODY_TOO_LARGE', '照片超过10MB', 413);
    }
    requireThat(bytes && bytes.length > 0, 'UPLOAD_BODY_INVALID', '照片文件为空', 400);
    await uploadAsset(pool, store, request.params.asset_id, String(request.headers['x-upload-token']), bytes); return reply.code(204).send();
  });
  app.get<{ Params: { encoded: string }; Querystring: { signature: string } }>('/storage/downloads/:encoded', async (request, reply) => {
    const grant = verifyDownload(cfg, request.params.encoded, request.query.signature ?? '');
    await assertPlusDownload(pool,grant.plusSessionId,grant.tenantId,grant.ownerId);
    let key: string; let mime: string; let name: string; let expectedHash: string | undefined; let sampleExecution = false; let preparedBytes: Buffer | undefined;
    if (grant.purpose === 'DELIVERY') {
      const p = { tenantId: grant.tenantId, userId: grant.ownerId } as Principal;
      const pack = await getDeliverables(pool, p, grant.resourceId); const item = pack.items.find(i => i.deliverable_id === grant.itemId);
      if (!item) notFound();
      requireThat(item.kind !== 'copy', 'COPY_AS_TEXT', '文案请使用复制功能', 422);
      const row = (await pool.query<{ object_key: string }>('SELECT object_key FROM artifacts WHERE id=$1 AND tenant_id=$2 AND order_id=$3 AND sha256=$4', [item.deliverable_id, grant.tenantId, grant.resourceId, item.sha256])).rows[0] ?? notFound();
      key = row.object_key; mime = item.mime_type ?? 'application/octet-stream'; name = item.file_name ?? item.deliverable_id; expectedHash = item.sha256;
    } else if (grant.purpose === 'PREVIEW') {
      requireThat(grant.itemId===grant.resourceId,'DOWNLOAD_NOT_AUTHORIZED','预览下载授权不匹配',401);
      const {output}=await previewMedia(pool,grant.tenantId,grant.resourceId,grant.ownerId);
      key=output.object_key; expectedHash=output.sha256; mime='image/png'; name='一品成片-本人预览.png';
      preparedBytes=await store.get(key,12_000_000); checkPreviewBytes(output,preparedBytes);
    } else if (grant.purpose === 'PUBLIC_SAMPLE') {
      const row = await authorizedSample(pool,grant.resourceId);
      requireThat(row.tenant_id === grant.tenantId && row.owner_id === grant.ownerId, 'DOWNLOAD_NOT_AUTHORIZED', '公开样例授权不匹配', 401);
      const file = await authorizedFile(pool,cfg,row,grant.itemId); preparedBytes = file.bytes;
      key = file.item.object_key; expectedHash = file.item.sha256; mime = file.item.kind === 'video' ? 'video/mp4' : 'image/png'; name = `公开方案样例.${file.item.kind === 'video' ? 'mp4' : 'png'}`;
    } else {
      const row = (await pool.query<{ private: { media: SampleObject[]; execution?: unknown; test_fixture?: boolean; media_revoked?: boolean } }>('SELECT private FROM public_samples WHERE id=$1 AND tenant_id=$2 AND owner_id=$3 AND state=$4', [grant.resourceId, grant.tenantId, grant.ownerId, 'READY'])).rows[0] ?? notFound();
      requireThat(!row.private.media_revoked, 'SAMPLE_MEDIA_UNAVAILABLE', '该样例已撤回', 410);
      if (row.private.execution) { sampleExecution = true; await sampleContext(pool, grant.tenantId, grant.resourceId, undefined, false, true); }
      else requireThat(cfg.env === 'test' && row.private.test_fixture === true, 'SAMPLE_EXECUTION_UNVERIFIED', '样例缺少制作证据', 422);
      const item = row.private.media.find(i => i.item_id === grant.itemId); if (!item) notFound();
      await verifySampleFiles(pool, cfg, { tenantId: grant.tenantId, userId: grant.ownerId }, grant.resourceId, [item]);
      key = item.object_key; expectedHash = item.sha256; mime = item.kind === 'video' ? 'video/mp4' : 'image/png'; name = `方案样例.${item.kind === 'video' ? 'mp4' : 'png'}`;
    }
    const bytes = preparedBytes ?? await store.get(key, 512_000_000);
    await assertPlusDownload(pool,grant.plusSessionId,grant.tenantId,grant.ownerId);
    if (expectedHash) {
      requireThat(sha256(bytes) === expectedHash, 'DELIVERY_FILE_CHANGED', '实际交付文件与已验收清单不一致', 503);
      if (grant.purpose === 'DELIVERY') {
        const latest = await getDeliverables(pool, { tenantId: grant.tenantId, userId: grant.ownerId } as Principal, grant.resourceId);
        requireThat(latest.items.some(i => i.deliverable_id === grant.itemId && i.sha256 === expectedHash), 'DELIVERABLE_NOT_CURRENT', '该素材已经更新', 410);
      } else if (grant.purpose === 'PREVIEW') {
        const {output}=await previewMedia(pool,grant.tenantId,grant.resourceId,grant.ownerId); checkPreviewBytes(output,bytes);
      } else if (grant.purpose === 'PUBLIC_SAMPLE') await authorizedSample(pool,grant.resourceId);
      else if (sampleExecution) await sampleContext(pool, grant.tenantId, grant.resourceId, undefined, false, true);
    }
    reply.header('Cache-Control', 'private, no-store').header('Content-Type', mime).header('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(name)}`).header('Accept-Ranges', 'bytes');
    const range = request.headers.range;
    if (range) {
      const match = /^bytes=(\d+)-(\d*)$/.exec(range); if (!match) return reply.code(416).send();
      const start = Number(match[1]); const end = match[2] ? Math.min(Number(match[2]), bytes.length - 1) : bytes.length - 1;
      if (start >= bytes.length || end < start) return reply.code(416).header('Content-Range', `bytes */${bytes.length}`).send();
      return reply.code(206).header('Content-Range', `bytes ${start}-${end}/${bytes.length}`).send(bytes.subarray(start, end + 1));
    }
    return reply.send(bytes);
  });
  if (cfg.devMode && cfg.env !== 'production') {
    app.post<{ Body: { platform: DTO<'Platform'>; account?: string } }>('/dev/sessions', async (request, reply) => {
      requireThat(['127.0.0.1', '::1'].includes(request.ip), 'DEV_LOCAL_ONLY', '本地开发入口仅允许回环访问', 403);
      requireThat(['alipay', 'douyin'].includes(request.body.platform), 'INVALID_PLATFORM', '宿主无效', 400);
      const account = request.body.account ?? 'local-developer'; requireThat(/^[A-Za-z0-9._-]{1,80}$/.test(account), 'INVALID_ACCOUNT', '开发账号标识无效', 400);
      return reply.send({ data: await issueSession(pool, { platform: request.body.platform, appId: `dev-${request.body.platform}`, subjectId: account }), trace_id: request.id });
    });
  }
  const { registerManagement } = await import('./routes/management.js'); await registerManagement(app, cfg, pool,store);
  const { registerPayments } = await import('./routes/payments.js'); await registerPayments(app, cfg, pool);
  const { registerToolGateway } = await import('../worker/tool-gateway/http.js'); await registerToolGateway(app, cfg, pool, store);
  requireThat(!deps.inferenceHttp || cfg.env === 'test', 'TEST_PORT_FORBIDDEN', '推理替身只能用于显式测试环境', 500);
  const { registerInferenceGateway } = await import('../worker/codex/inference.js'); await registerInferenceGateway(app, cfg, pool, store, deps.inferenceHttp);
  app.addHook('onClose', async () => { if (!deps.pool) await pool.end(); }); return app;
}
