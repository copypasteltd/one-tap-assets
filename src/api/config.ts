import { resolve, relative, isAbsolute } from 'node:path';
import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { AppError } from './lib/errors.js';

export interface Config {
  env: 'development' | 'test' | 'production'; host: string; port: number; publicBaseUrl: string;
  projectRoot: string; runtimeRoot: string; databaseUrl: string; dbTls: boolean;
  storage: { driver: 'local' | 'oss'; endpoint: string; bucket: string; region: string; keyId: string; secret: string };
  signingKey: string; devMode: boolean; logLevel: string; webOrigins: string[];
  tlsCert: string; tlsKey: string; paymentsEnabled: boolean; generationEnabled: boolean; publishingEnabled: boolean;
  alipay: { appId: string; privateKey: string; publicKey: string; merchantId: string; gateway: string };
  douyin: { appId: string; secret: string; merchantId: string; paymentKey: string; privateKey: string; keyVersion: string; tradeContractPath: string; salt: string; gateway: string };
  provider: { baseUrl: string; apiKey: string; allowedHosts: string[]; visionModel: string; imageModel: string; videoModel: string; rateVersion: string; visionContractPath: string; visionDailyBudgetMicro: number;
    generation?:{baseUrl:string;apiKey:string;allowedHosts:string[]};
    speech?:{enabled:boolean;baseUrl:string;apiKey:string;allowedHosts:string[]};
    listening?:{enabled:boolean;baseUrl:string;apiKey:string;allowedHosts:string[]} };
  managementTokens: string;
  plusRender:{enabled:boolean;priceFen:number;pricingVersion:string};
  plusVideoRender:{enabled:boolean;priceFen:number;pricingVersion:string;budgetMicro:number;listeningModelVersionId:string};
  samples: { dailyBudgetMicro: number; costCeilingMicro: number; maxConcurrent: number; deadlineSeconds: number };
  privacyJournal: { enabled: boolean; directory: string; sourceId: string; keyId: string; hmacKey: string };
  codex: { enabled: boolean; binary: string; sha256: string; model: string; apiKey: string; inferenceProxy: string; protocol: string; rateVersion: string; maxTurns: number; maxInputTokens: number; maxOutputTokens: number; costCeilingMicro: number; isolationCommand: string; admissionPath: string; dailyBudgetMicro: number };
}
export function inside(root: string, target: string): string {
  const absolute = resolve(root, target); const rel = relative(root, absolute);
  if (rel.startsWith('..') || isAbsolute(rel)) throw new AppError('PATH_OUTSIDE_WORKSPACE', '路径超出项目目录', 500);
  return absolute;
}
export function config(overrides: Partial<Config> = {}): Config {
  const root = process.cwd();
  if (existsSync(resolve(root, '.env.local')) && process.env.APP_ENV !== 'test') loadEnvFile(resolve(root, '.env.local'));
  const env = process.env.APP_ENV ?? 'development';
  if (!['development', 'test', 'production'].includes(env)) throw new Error('Invalid APP_ENV');
  const num = (key: string, fallback: number): number => { const value = process.env[key]; const v = value?.trim() ? Number(value) : fallback; if (!Number.isSafeInteger(v) || v < 0) throw new Error(`Invalid ${key}`); return v; };
  const text = (key: string, fallback = ''): string => process.env[key] ?? fallback;
  const enabled = (key: string): boolean => text(key) === 'true';
  const result: Config = {
    env: env as Config['env'], host: text('HOST', '127.0.0.1'), port: num('PORT', 3100),
    publicBaseUrl: text('PUBLIC_BASE_URL', 'https://localhost:3100'), projectRoot: root,
    runtimeRoot: inside(root, text('RUNTIME_ROOT', 'runtime')), databaseUrl: text('DATABASE_URL'), dbTls: text('DB_TLS_MODE') === 'verify-full',
    storage: { driver: text('STORAGE_DRIVER', 'local') as 'local' | 'oss', endpoint: text('STORAGE_ENDPOINT'), bucket: text('STORAGE_BUCKET'), region: text('STORAGE_REGION'), keyId: text('STORAGE_ACCESS_KEY_ID'), secret: text('STORAGE_ACCESS_KEY_SECRET') },
    signingKey: text('SIGNING_KEY'), devMode: env !== 'production' && enabled('DEV_MODE'), logLevel: text('LOG_LEVEL', 'info'),
    webOrigins: text('WEB_ORIGINS', 'https://localhost:5173').split(',').filter(Boolean), tlsCert: text('TLS_CERT_PATH'), tlsKey: text('TLS_KEY_PATH'),
    paymentsEnabled: enabled('PAYMENTS_ENABLED'), generationEnabled: enabled('PROVIDER_GENERATION_ENABLED'), publishingEnabled: enabled('COMMUNITY_PUBLISHING_ENABLED'),
    alipay: { appId: text('ALIPAY_APP_ID'), privateKey: text('ALIPAY_APP_PRIVATE_KEY'), publicKey: text('ALIPAY_PLATFORM_PUBLIC_KEY'), merchantId: text('ALIPAY_MERCHANT_ID'), gateway: text('ALIPAY_GATEWAY', 'https://openapi.alipay.com/gateway.do') },
    douyin: { appId: text('DOUYIN_APP_ID'), secret: text('DOUYIN_APP_SECRET'), merchantId: text('DOUYIN_MERCHANT_ID'), paymentKey: text('DOUYIN_PAYMENT_VERIFY_KEY'), privateKey: text('DOUYIN_APP_PRIVATE_KEY'), keyVersion: text('DOUYIN_KEY_VERSION'), tradeContractPath: text('DOUYIN_TRADE_CONTRACT_PATH'), salt: text('DOUYIN_PAYMENT_SALT'), gateway: text('DOUYIN_PAYMENT_GATEWAY', 'https://open.douyin.com') },
    provider: { baseUrl: text('PROVIDER_BASE_URL'), apiKey: text('PROVIDER_API_KEY'), allowedHosts: text('PROVIDER_ALLOWED_HOSTS', 'api.openai.com').split(',').map(s => s.trim()).filter(Boolean), visionModel: text('VISION_MODEL_ID'), imageModel: text('IMAGE_MODEL_ID'), videoModel: text('VIDEO_MODEL_ID'), rateVersion: text('MODEL_REGISTRY_VERSION'), visionContractPath: text('VISION_CONTRACT_PATH'), visionDailyBudgetMicro: num('VISION_DAILY_BUDGET_MICRO', 0),
      ...(text('GENERATION_BASE_URL')?{generation:{baseUrl:text('GENERATION_BASE_URL'),apiKey:text('GENERATION_API_KEY'),
        allowedHosts:text('GENERATION_ALLOWED_HOSTS').split(',').map(s=>s.trim()).filter(Boolean)}}:{}),
      ...(text('LISTENING_BASE_URL')?{listening:{enabled:enabled('LISTENING_SERVICE_ENABLED'),baseUrl:text('LISTENING_BASE_URL'),apiKey:text('LISTENING_API_KEY'),
        allowedHosts:text('LISTENING_ALLOWED_HOSTS').split(',').map(s=>s.trim()).filter(Boolean)}}:{}),
      ...(text('ASR_BASE_URL')?{speech:{enabled:enabled('ASR_SERVICE_ENABLED'),baseUrl:text('ASR_BASE_URL'),apiKey:text('ASR_API_KEY'),
        allowedHosts:text('ASR_ALLOWED_HOSTS').split(',').map(s=>s.trim()).filter(Boolean)}}:{}) },
    managementTokens: text('MANAGEMENT_TOKENS_JSON'),
    plusRender:{enabled:enabled('PLUS_IMAGE_RENDER_ENABLED'),priceFen:num('PLUS_IMAGE_RENDER_PRICE_FEN',0),pricingVersion:text('PLUS_IMAGE_RENDER_PRICING_VERSION')},
    plusVideoRender:{enabled:enabled('PLUS_VIDEO_RENDER_ENABLED'),priceFen:num('PLUS_VIDEO_RENDER_PRICE_FEN',0),pricingVersion:text('PLUS_VIDEO_RENDER_PRICING_VERSION'),
      budgetMicro:num('PLUS_VIDEO_RENDER_BUDGET_MICRO',0),listeningModelVersionId:text('PLUS_VIDEO_LISTENING_MODEL_VERSION_ID')},
    samples: { dailyBudgetMicro: num('SAMPLE_DAILY_BUDGET_MICRO', 0), costCeilingMicro: num('SAMPLE_COST_CEILING_MICRO', 0), maxConcurrent: num('SAMPLE_MAX_CONCURRENT', 1), deadlineSeconds: num('SAMPLE_DEADLINE_SECONDS', 3600) },
    privacyJournal: { enabled: enabled('PRIVACY_JOURNAL_ENABLED'), directory: text('PRIVACY_JOURNAL_DIRECTORY', 'privacy-journal'),
      sourceId: text('PRIVACY_JOURNAL_SOURCE_ID'), keyId: text('PRIVACY_JOURNAL_KEY_ID'), hmacKey: text('PRIVACY_JOURNAL_HMAC_KEY') },
    codex: { enabled: enabled('CODEX_SERVICE_ENABLED'), binary: text('CODEX_BINARY_PATH'), sha256: text('CODEX_BUILD_SHA256'), model: text('CODEX_MODEL_ID'), apiKey: text('CODEX_SERVICE_API_KEY'), inferenceProxy: text('CODEX_INFERENCE_PROXY'), protocol: text('CODEX_PROTOCOL_VERSION'), rateVersion: text('CODEX_INFERENCE_RATE_VERSION'), maxTurns: num('CODEX_ROLE_MAX_TURNS', 8), maxInputTokens: num('CODEX_ORDER_MAX_INPUT_TOKENS', 40000), maxOutputTokens: num('CODEX_ORDER_MAX_OUTPUT_TOKENS', 8000), costCeilingMicro: num('CODEX_ORDER_COST_CEILING_MICRO', 0), isolationCommand: text('CODEX_ISOLATION_LAUNCHER'), admissionPath: text('CODEX_RUNTIME_ADMISSION_PATH'), dailyBudgetMicro: num('CODEX_PLANNING_DAILY_BUDGET_MICRO', 0) },
    ...overrides,
  };
  if (!result.databaseUrl) throw new Error('DATABASE_URL is required; run scripts/dev-setup.ps1');
  if (result.signingKey.length < 32) throw new Error('SIGNING_KEY must be at least 32 characters');
  if (!result.publicBaseUrl.startsWith('https://')) throw new Error('PUBLIC_BASE_URL must use HTTPS');
  if (!['local', 'oss'].includes(result.storage.driver)) throw new Error('Unknown storage driver');
  if (result.env === 'production' && (result.devMode || !result.dbTls || result.storage.driver !== 'oss')) throw new Error('Production requires verified TLS DB and private OSS; development mode is forbidden');
  if (result.env === 'production' && !result.privacyJournal.enabled) throw new Error('Production requires the external privacy journal and restore gate');
  if (result.privacyJournal.enabled && (!/^[A-Za-z0-9_-]{1,100}$/.test(result.privacyJournal.sourceId)
    || !/^[A-Za-z0-9_-]{1,100}$/.test(result.privacyJournal.keyId) || result.privacyJournal.hmacKey.length < 32)) throw new Error('Privacy journal identity and separate signing key are required');
  if (result.privacyJournal.enabled && result.privacyJournal.hmacKey === result.signingKey) throw new Error('Privacy journal must use a separate signing key');
  inside(root, result.runtimeRoot);
  return result;
}
