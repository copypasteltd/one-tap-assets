import { mkdir, readFile, writeFile, rename, rm, stat, lstat, readdir, unlink } from 'node:fs/promises';
import { basename, dirname, relative, resolve, sep, join } from 'node:path';
import { createHmac } from 'node:crypto';
import type { Config } from '../config.js';
import { inside } from '../config.js';
import { id, sha256 } from '../lib/crypto.js';
import { AppError, requireThat } from '../lib/errors.js';
import { ossVersionPage } from './oss-versions.js';

export interface ObjectErasure { driver: 'local' | 'oss'; current_absent: true; all_versions_absent: true; versions_removed: number; request_ids: string[] }

export interface ObjectStorage {
  put(key: string, bytes: Buffer, mime: string): Promise<void>; get(key: string, maxBytes?: number): Promise<Buffer>;
  delete(key: string): Promise<void>; exists(key: string): Promise<boolean>;
  erase?(key: string, signal?: AbortSignal): Promise<ObjectErasure>;
}
export function validObjectKey(key: string): string {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9/_.-]{0,500}$/.test(key) || key.split('/').some(s => s === '..' || s === '.' || !s)) throw new AppError('INVALID_OBJECT_KEY', '无效的存储路径', 500);
  return key;
}
export class LocalStorage implements ObjectStorage {
  private root: string;
  constructor(private cfg: Config) { this.root = inside(cfg.runtimeRoot, 'objects'); }
  async put(key: string, bytes: Buffer, _mime: string): Promise<void> {
    const path = inside(this.root, validObjectKey(key)); await mkdir(dirname(path), { recursive: true });
    const temp = `${path}.${id('upload')}.tmp`; await writeFile(temp, bytes); await rename(temp, path);
  }
  async get(key: string, maxBytes = 2_000_000_000): Promise<Buffer> {
    const path = inside(this.root, validObjectKey(key)); const s = await stat(path);
    if (s.size > maxBytes) throw new AppError('OBJECT_TOO_LARGE', '文件超过允许大小', 413);
    return readFile(path);
  }
  async delete(key: string): Promise<void> { await rm(inside(this.root, validObjectKey(key)), { force: true }); }
  async exists(key: string): Promise<boolean> { try { await stat(inside(this.root, validObjectKey(key))); return true; } catch { return false; } }
  private async noLinks(path: string): Promise<boolean> {
    let cursor = this.cfg.projectRoot;
    for (const part of relative(this.cfg.projectRoot, inside(this.root, path)).split(sep).filter(Boolean)) {
      cursor = resolve(cursor, part);
      try { requireThat(!(await lstat(cursor)).isSymbolicLink(), 'STORAGE_PATH_REPARSE', '存储删除路径含链接或重解析点', 503); }
      catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false; throw error; }
    }
    return true;
  }
  async erase(key: string, signal?: AbortSignal): Promise<ObjectErasure> {
    const path = inside(this.root, validObjectKey(key)); let removed = 0;
    requireThat(!signal?.aborted, 'OBJECT_ERASURE_INTERRUPTED', '对象删除已中断', 409);
    if (await this.noLinks(dirname(path))) {
      // These names are generated exclusively by put(), never by the caller.
      for (const name of await readdir(dirname(path))) if (name === basename(path) || name.startsWith(`${basename(path)}.upload_`) && name.endsWith('.tmp')) {
        requireThat(!signal?.aborted, 'OBJECT_ERASURE_INTERRUPTED', '对象删除已中断', 409);
        const target = join(dirname(path), name);
        if (await this.noLinks(target)) { requireThat((await lstat(target)).isFile(), 'STORAGE_PATH_INVALID', '对象删除目标不是普通文件', 503); await unlink(target); removed++; }
      }
    }
    requireThat(!await this.noLinks(path), 'OBJECT_ERASURE_UNVERIFIED', '删除后的对象仍然存在', 503);
    return { driver: 'local', current_absent: true, all_versions_absent: true, versions_removed: removed, request_ids: [] };
  }
}
/** OSS Signature V1 signed server-side requests. No bucket/public ACL operation. */
export class OssStorage implements ObjectStorage {
  constructor(private cfg: Config, private http: typeof fetch = fetch) {
    if (!cfg.storage.endpoint.startsWith('https://') || !cfg.storage.bucket || !cfg.storage.keyId || !cfg.storage.secret) throw new Error('OSS configuration incomplete');
    requireThat(http === fetch || cfg.env === 'test', 'TEST_PORT_FORBIDDEN', '存储替身只能用于显式测试环境', 500);
  }
  private async request(method: string, key: string, body?: Buffer, mime = '', query: Record<string, string> = {}, signal?: AbortSignal): Promise<Response> {
    if (key) validObjectKey(key); else requireThat(query.versions === '', 'INVALID_OBJECT_KEY', '不允许未指定对象的存储操作', 500);
    const { bucket, endpoint, keyId, secret } = this.cfg.storage; const date = new Date().toUTCString();
    const url = new URL(endpoint); url.hostname = `${bucket}.${url.hostname}`; url.pathname = `/${key}`;
    for (const [name, value] of Object.entries(query)) url.searchParams.set(name, value);
    const signed = Object.keys(query).filter(name => name === 'versions' || name === 'versionId').sort().map(name => query[name] ? `${name}=${query[name]}` : name).join('&');
    const canonical = `${method}\n\n${mime}\n${date}\n/${bucket}/${key}${signed ? `?${signed}` : ''}`;
    const signature = createHmac('sha1', secret).update(canonical).digest('base64');
    const headers: Record<string, string> = { Date: date, Authorization: `OSS ${keyId}:${signature}` };
    if (mime) headers['Content-Type'] = mime;
    const timeout = AbortSignal.timeout(30000);
    const response = await this.http(url, { method, headers, ...(body ? { body: new Uint8Array(body) } : {}), signal: signal ? AbortSignal.any([signal, timeout]) : timeout, redirect: 'error' });
    if (!response.ok && !(method === 'DELETE' && response.status === 404) && !(method === 'HEAD' && response.status === 404)) throw new AppError('STORAGE_ERROR', '私有存储暂时不可用', 503, true);
    return response;
  }
  async put(key: string, bytes: Buffer, mime: string): Promise<void> { await this.request('PUT', key, bytes, mime); }
  async get(key: string, maxBytes = 2_000_000_000): Promise<Buffer> {
    const response = await this.request('GET', key); const parts: Buffer[] = []; let size = 0;
    if (!response.body) throw new AppError('STORAGE_EMPTY', '文件读取失败', 503);
    const reader = response.body.getReader();
    try { while (true) { const { value, done } = await reader.read(); if (done) break; size += value.byteLength; if (size > maxBytes) { await reader.cancel(); throw new AppError('OBJECT_TOO_LARGE', '文件超过允许大小', 413); } parts.push(Buffer.from(value)); } } finally { reader.releaseLock(); }
    return Buffer.concat(parts);
  }
  async delete(key: string): Promise<void> { await this.request('DELETE', key); }
  async exists(key: string): Promise<boolean> { return (await this.request('HEAD', key)).ok; }
  private async versions(key: string, signal?: AbortSignal) {
    const versions: { key: string; versionId: string }[] = []; const requests: string[] = []; const cursors = new Set<string>();
    let marker = ''; let versionMarker = '';
    for (let page = 0; page < 20; page++) {
      const query: Record<string, string> = { versions: '', prefix: key, 'max-keys': '999' };
      if (marker) { query['key-marker'] = marker; query['version-id-marker'] = versionMarker; }
      const response = await this.request('GET', '', undefined, '', query, signal);
      const reader = response.body?.getReader(); requireThat(reader, 'OSS_VERSION_RESPONSE_INVALID', '历史版本清单为空', 503);
      const parts: Uint8Array[] = []; let length = 0;
      try { while (true) { const result = await reader.read(); if (result.done) break;
        length += result.value.byteLength; requireThat(length <= 2000000, 'OSS_VERSION_RESPONSE_INVALID', '历史版本清单超限', 503); parts.push(result.value); }
      } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
      const parsed = ossVersionPage(Buffer.concat(parts).toString('utf8'), this.cfg.storage.bucket, key);
      versions.push(...parsed.versions.filter(v => v.key === key));
      const requestId = response.headers.get('x-oss-request-id'); if (requestId) requests.push(requestId);
      requireThat(versions.length <= 1000, 'OBJECT_ERASURE_LIMIT', '对象历史版本超过单次清理限制', 503);
      if (!parsed.truncated) return { versions, requests };
      const cursor = `${parsed.nextKey}\n${parsed.nextVersion}`;
      requireThat(!cursors.has(cursor), 'OSS_VERSION_RESPONSE_INVALID', '历史版本清单游标没有前进', 503);
      cursors.add(cursor); marker = parsed.nextKey; versionMarker = parsed.nextVersion;
    }
    throw new AppError('OBJECT_ERASURE_LIMIT', '历史版本分页超过单次清理限制', 503);
  }
  async erase(key: string, signal?: AbortSignal): Promise<ObjectErasure> {
    validObjectKey(key); const requests: string[] = []; let removed = 0;
    await this.request('DELETE', key, undefined, '', {}, signal);
    for (let round = 0; round < 3; round++) {
      const listed = await this.versions(key, signal); requests.push(...listed.requests);
      if (!listed.versions.length) {
        requireThat(!(await this.request('HEAD', key, undefined, '', {}, signal)).ok,
          'OBJECT_ERASURE_UNVERIFIED', '对象仍然存在，不能确认永久删除', 503);
        return { driver: 'oss', current_absent: true, all_versions_absent: true, versions_removed: removed, request_ids: requests };
      }
      for (const item of listed.versions) {
        const result = await this.request('DELETE', key, undefined, '', { versionId: item.versionId }, signal);
        const requestId = result.headers.get('x-oss-request-id'); if (requestId) requests.push(requestId); removed++;
      }
    }
    throw new AppError('OBJECT_ERASURE_UNVERIFIED', '历史版本仍有变化，等待后续核验', 503);
  }
}
export const storage = (cfg: Config): ObjectStorage => cfg.storage.driver === 'oss' ? new OssStorage(cfg) : new LocalStorage(cfg);
