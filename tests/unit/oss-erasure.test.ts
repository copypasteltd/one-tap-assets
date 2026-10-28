import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import { OssStorage } from '../../src/api/storage/storage.js';
import { ossVersionPage } from '../../src/api/storage/oss-versions.js';
import type { Config } from '../../src/api/config.js';

const key = 'tenant-test/media/order-test/photo.png';
const cfg = { env: 'test', storage: { driver: 'oss', endpoint: 'https://oss-example.aliyuncs.com', bucket: 'test-bucket',
  keyId: 'synthetic-key-id', secret: 'synthetic-signing-secret' } } as Config;
const xml = (items: { key: string; id: string; marker?: boolean }[], truncated = false, next?: { key: string; id: string }): string =>
  `<?xml version="1.0"?><ListVersionsResult xmlns="http://doc.oss-cn-hangzhou.aliyuncs.com"><Name>test-bucket</Name><Prefix>${key}</Prefix><IsTruncated>${truncated}</IsTruncated>`
  + items.map(item => `<${item.marker ? 'DeleteMarker' : 'Version'}><Key>${item.key}</Key><VersionId>${item.id}</VersionId></${item.marker ? 'DeleteMarker' : 'Version'}>`).join('')
  + (next ? `<NextKeyMarker>${next.key}</NextKeyMarker><NextVersionIdMarker>${next.id}</NextVersionIdMarker>` : '') + '</ListVersionsResult>';
describe('OSS permanent object erasure', () => {
  it('signs bucket/version requests and deletes null/history/delete markers across pages without deleting a prefix neighbour', async () => {
    const records = [{ key, id: 'null' }, { key, id: 'v1+=' }, { key, id: 'v2/test' }, { key: `${key}.other`, id: 'keep' }];
    const calls: { method: string; url: URL }[] = [];
    const http: typeof fetch = async (input, init) => {
      const url = new URL(String(input)); const method = init!.method!; const headers = new Headers(init!.headers);
      expect(url.protocol).toBe('https:'); expect(url.hostname).toBe('test-bucket.oss-example.aliyuncs.com'); expect(init!.redirect).toBe('error');
      const suffix = url.searchParams.has('versions') ? '?versions' : url.searchParams.has('versionId') ? `?versionId=${url.searchParams.get('versionId')}` : '';
      const canonical = [method, '', '', headers.get('Date'), `/test-bucket${url.pathname}${suffix}`].join('\n');
      expect(headers.get('Authorization')).toBe(`OSS synthetic-key-id:${createHmac('sha1', cfg.storage.secret).update(canonical).digest('base64')}`);
      calls.push({ method, url });
      if (method === 'DELETE') {
        if (!url.searchParams.has('versionId')) records.splice(3, 0, { key, id: 'delete-marker' });
        else { const at = records.findIndex(r => r.key === url.pathname.slice(1) && r.id === url.searchParams.get('versionId')); expect(at).toBeGreaterThanOrEqual(0); records.splice(at, 1); }
        return new Response(null, { status: 204, headers: { 'x-oss-request-id': `request-${calls.length}` } });
      }
      if (method === 'HEAD') return new Response(null, { status: 404 });
      expect(url.pathname).toBe('/'); expect(url.searchParams.get('prefix')).toBe(key);
      const cursor = url.searchParams.get('version-id-marker'); const start = cursor ? records.findIndex(r => r.id === cursor) + 1 : 0;
      const page = records.slice(start, start + 2); const truncated = start + page.length < records.length;
      return new Response(xml(page, truncated, truncated ? page.at(-1) : undefined), { headers: { 'x-oss-request-id': `request-${calls.length}` } });
    };
    const result = await new OssStorage(cfg, http).erase(key);
    expect(result).toMatchObject({ driver: 'oss', current_absent: true, all_versions_absent: true, versions_removed: 4 });
    expect(result.request_ids.length).toBeGreaterThan(4); expect(records).toEqual([{ key: `${key}.other`, id: 'keep' }]);
    expect(calls.filter(c => c.method === 'DELETE' && c.url.searchParams.has('versionId'))).toHaveLength(4);
  });
  it('does not certify a normal delete when listing or deleting history is forbidden', async () => {
    for (const denied of ['list', 'version']) {
      const http: typeof fetch = async (input, init) => {
        const url = new URL(String(input));
        if (init!.method === 'GET') return denied === 'list' ? new Response(null, { status: 403 }) : new Response(xml([{ key, id: 'null' }]));
        if (url.searchParams.has('versionId')) return new Response(null, { status: 403 });
        return new Response(null, { status: 204 });
      };
      await expect(new OssStorage(cfg, http).erase(key)).rejects.toMatchObject({ code: 'STORAGE_ERROR' });
    }
  });
  it('fails closed on DTD, wrong scope, duplicate fields, incomplete containers and missing pagination cursors', () => {
    const good = xml([{ key, id: 'null' }]); expect(ossVersionPage(good, cfg.storage.bucket, key).versions).toHaveLength(1);
    for (const invalid of [good.replace('<?xml version="1.0"?>', '<!DOCTYPE x>'), good.replace('test-bucket', 'other-bucket'),
      good.replace('</Name>', '</Name><Name>test-bucket</Name>'), good.replace('<Version>', '<Version extra="x">'),
      good.replace('</ListVersionsResult>', '<Version/></ListVersionsResult>'), good.replace('<Version>', '<unexpected>').replace('</Version>', '</unexpected>'),
      xml([{ key, id: 'v1' }], true), good.replace(key, 'outside/')]) {
      expect(() => ossVersionPage(invalid, cfg.storage.bucket, key)).toThrow();
    }
  });
  it('rejects a repeating page cursor and an interrupted request without returning proof', async () => {
    let calls = 0;
    const http: typeof fetch = async (_input, init) => {
      if (init!.signal?.aborted) throw new Error('synthetic-aborted');
      calls++; return init!.method === 'GET' ? new Response(xml([{ key, id: 'v1' }], true, { key, id: 'v1' })) : new Response(null, { status: 204 });
    };
    const store = new OssStorage(cfg, http);
    await expect(store.erase(key)).rejects.toMatchObject({ code: 'OSS_VERSION_RESPONSE_INVALID' }); expect(calls).toBe(3);
    await expect(store.erase(key, AbortSignal.abort())).rejects.toThrow('synthetic-aborted');
  });
});
