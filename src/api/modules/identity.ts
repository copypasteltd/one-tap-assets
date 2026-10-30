import type pg from 'pg';
import type { Config } from '../config.js';
import type { DTO, Principal, ManagementPrincipal } from '../../shared/contracts/types.js';
import { id, token, sha256, addSeconds, equalSecret } from '../lib/crypto.js';
import { transaction, type Db } from '../db/pool.js';
import { insert } from '../db/store.js';
import { AppError, requireThat } from '../lib/errors.js';
import { AlipayClient } from '../adapters/alipay.js';
import { remoteJson } from '../lib/http.js';
import { object } from '../../shared/domain/json.js';
import {plusPrincipal} from './plus-access.js';

export interface PlatformIdentity { platform: DTO<'Platform'>; appId: string; subjectId: string }
export async function exchangeIdentity(cfg: Config, request: DTO<'SessionRequest'>): Promise<PlatformIdentity> {
  if (request.platform === 'alipay') {
    const result = await new AlipayClient(cfg).call('alipay.system.oauth.token', { grant_type: 'authorization_code', code: request.code });
    requireThat(typeof result.user_id === 'string' && result.user_id.length > 0, 'LOGIN_REJECTED', '请重新授权支付宝登录', 401);
    return { platform: request.platform, appId: cfg.alipay.appId, subjectId: result.user_id };
  }
  requireThat(cfg.douyin.appId && cfg.douyin.secret, 'DOUYIN_NOT_CONFIGURED', '抖音登录尚未配置', 503);
  const body = object(await remoteJson('https://developer.toutiao.com/api/apps/v2/jscode2session', ['developer.toutiao.com'], { appid: cfg.douyin.appId, secret: cfg.douyin.secret, code: request.code }));
  const data = object(body.data);
  requireThat(body.err_no === 0 && typeof data.openid === 'string' && data.openid.length > 0, 'LOGIN_REJECTED', '请重新授权抖音登录', 401);
  return { platform: request.platform, appId: cfg.douyin.appId, subjectId: data.openid };
}
export async function issueSession(pool: pg.Pool, identity: PlatformIdentity): Promise<DTO<'Session'>> {
  return transaction(pool, async db => {
    await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`${identity.platform}:${identity.appId}:${identity.subjectId}`]);
    const existing = await db.query<{ id: string; tenant_id: string; user_id: string }>('SELECT id,tenant_id,user_id FROM platform_identities WHERE platform=$1 AND app_id=$2 AND subject_id=$3', [identity.platform, identity.appId, identity.subjectId]);
    let row = existing.rows[0];
    if (!row) {
      row = { id: id('identity'), tenant_id: id('tenant'), user_id: id('user') };
      await insert(db, 'tenants', { id: row.tenant_id }); await insert(db, 'users', { id: row.user_id, tenant_id: row.tenant_id });
      await insert(db, 'platform_identities', { ...row, platform: identity.platform, app_id: identity.appId, subject_id: identity.subjectId });
    }
    const secret = token(); const expiry = addSeconds(7 * 86400);
    await insert(db, 'sessions', { id: id('session'), tenant_id: row.tenant_id, owner_id: row.user_id, identity_id: row.id, token_hash: sha256(secret), expires_at: expiry });
    return { access_token: secret, token_type: 'Bearer', expires_at: expiry, user_id: row.user_id };
  });
}
export async function authenticate(db: Db, authorization: string | undefined, cfg: Config): Promise<Principal> {
  if (!authorization?.startsWith('Bearer ')) throw new AppError('UNAUTHENTICATED', '请先登录', 401);
  const result = await db.query<{ id: string; tenant_id: string; owner_id: string; platform: DTO<'Platform'>; app_id: string; subject_id: string }>('SELECT s.id,s.tenant_id,s.owner_id,i.platform,i.app_id,i.subject_id FROM sessions s JOIN platform_identities i ON i.id=s.identity_id AND i.tenant_id=s.tenant_id WHERE s.token_hash=$1 AND s.revoked_at IS NULL AND s.expires_at>now()', [sha256(authorization.slice(7))]);
  const row = result.rows[0];
  const principal:Principal|undefined=row?{tenantId:row.tenant_id,userId:row.owner_id,sessionId:row.id,platform:row.platform,appId:row.app_id,subjectId:row.subject_id}:await plusPrincipal(db,authorization.slice(7));
  if(!principal)throw new AppError('SESSION_EXPIRED','登录已过期，请重新登录',401);
  const approvedApp = principal.platform === 'alipay' ? cfg.alipay.appId : cfg.douyin.appId;
  requireThat(principal.appId === approvedApp || (cfg.devMode && principal.appId === `dev-${principal.platform}`), 'APP_SCOPE_INVALID', '登录应用不匹配', 403);
  return principal;
}
export function authenticateManagement(cfg: Config, authorization: string | undefined, permission: string): ManagementPrincipal {
  const key = authorization?.startsWith('Bearer ') ? authorization.slice(7) : '';
  let users: { actor: string; token_hash: string; permissions: string[] }[];
  try { users = JSON.parse(cfg.managementTokens || '[]') as typeof users; } catch { throw new AppError('MANAGEMENT_CONFIGURATION_ERROR', '管理服务尚未配置', 503); }
  const user = users.find(u => equalSecret(u.token_hash, sha256(key)));
  if (!key || !user) throw new AppError('MANAGEMENT_UNAUTHENTICATED', '请使用独立管理身份登录', 401);
  const permissions = new Set(user.permissions);
  if (!permissions.has(permission) && !permissions.has('*')) throw new AppError('MANAGEMENT_FORBIDDEN', '当前管理身份无此权限', 403);
  return { actor: user.actor, permissions };
}
