import { requireThat } from '../lib/errors.js';
const children: Record<string, readonly string[]> = {
  ListVersionsResult: ['Name','Prefix','KeyMarker','VersionIdMarker','MaxKeys','Delimiter','IsTruncated','NextKeyMarker','NextVersionIdMarker','Version','DeleteMarker'],
  Version: ['Key','VersionId','IsLatest','LastModified','ETag','Type','Size','StorageClass','Owner','RestoreInfo'],
  DeleteMarker: ['Key','VersionId','IsLatest','LastModified','Owner'], Owner: ['ID','DisplayName'],
};
function balancedSubset(xml: string): boolean {
  const source = xml.replace(/^\s*<\?xml[^?]*\?>/, ''); const stack: string[] = []; let end = 0; let count = 0; let roots = 0;
  for (const token of source.matchAll(/<[^>]*>/g)) {
    if (++count > 50000) return false;
    const text = source.slice(end, token.index); if ((!stack.length || children[stack.at(-1)!]) && text.trim()) return false;
    const tag = /^<(\/?)([A-Za-z][A-Za-z0-9]*)(\s+xmlns="[^"<>]+")?\s*(\/?)>$/.exec(token[0]); if (!tag) return false;
    const name = tag[2]!;
    if (tag[1]) { if (tag[3] || tag[4] || stack.pop() !== name) return false; }
    else {
      if (tag[3] && name !== 'ListVersionsResult') return false;
      if (!stack.length && ++roots !== 1) return false;
      if (!stack.length ? name !== 'ListVersionsResult' : !children[stack.at(-1)!]?.includes(name)) return false;
      if (tag[4]) { if (children[name]) return false; } else stack.push(name);
    }
    end = token.index! + token[0].length;
  }
  return !stack.length && !source.slice(end).trim();
}
function value(xml: string, name: string, required = true): string {
  const all = [...xml.matchAll(new RegExp(`<${name}>([^<]*)</${name}>`, 'g'))];
  requireThat(all.length === 1 || !required && all.length === 0, 'OSS_VERSION_RESPONSE_INVALID', '版本清单字段缺失或重复', 503);
  const text = all[0]?.[1] ?? '';
  requireThat(!/&(?!(?:amp|lt|gt|apos|quot);)/.test(text), 'OSS_VERSION_RESPONSE_INVALID', '版本清单包含不支持的实体', 503);
  return text.replace(/&(amp|lt|gt|apos|quot);/g, (_, code: string) => ({ amp: '&', lt: '<', gt: '>', apos: "'", quot: '"' })[code]!);
}
/** Bounded vendor XML subset. DTD/entities, incomplete pages and unexpected
 * version containers fail closed; this is not a general XML interpreter. */
export function ossVersionPage(xml: string, bucket: string, prefix: string) {
  requireThat(Buffer.byteLength(xml) <= 2000000 && !/<!/.test(xml)
    && /^\s*(?:<\?xml[^?]*\?>\s*)?<ListVersionsResult(?:\s+xmlns="[^"<>]+")?>[\s\S]*<\/ListVersionsResult>\s*$/.test(xml)
    && balancedSubset(xml), 'OSS_VERSION_RESPONSE_INVALID', '历史版本清单无效', 503);
  requireThat(value(xml, 'Name') === bucket && value(xml, 'Prefix') === prefix,
    'OSS_VERSION_RESPONSE_INVALID', '历史版本清单不属于当前存储范围', 503);
  const truncated = value(xml, 'IsTruncated');
  requireThat(truncated === 'true' || truncated === 'false', 'OSS_VERSION_RESPONSE_INVALID', '历史版本分页状态缺失', 503);
  const blocks = [...xml.matchAll(/<(Version|DeleteMarker)>([\s\S]*?)<\/\1>/g)];
  requireThat(blocks.length <= 999 && blocks.length === [...xml.matchAll(/<(?:Version|DeleteMarker)(?:\s|\/|>)/g)].length,
    'OSS_VERSION_RESPONSE_INVALID', '历史版本容器无效或超限', 503);
  const versions = blocks.map(block => ({ key: value(block[2]!, 'Key'), versionId: value(block[2]!, 'VersionId') }));
  requireThat(versions.every(v => v.key.startsWith(prefix) && /^[A-Za-z0-9._~+\/=\-]{1,1024}$/.test(v.versionId)),
    'OSS_VERSION_RESPONSE_INVALID', '历史版本或对象标识无效', 503);
  const nextKey = value(xml, 'NextKeyMarker', truncated === 'true');
  const nextVersion = value(xml, 'NextVersionIdMarker', truncated === 'true');
  requireThat(truncated === 'false' || nextKey.startsWith(prefix) && nextVersion.length > 0,
    'OSS_VERSION_RESPONSE_INVALID', '历史版本分页缺少下一游标', 503);
  return { versions, truncated: truncated === 'true', nextKey, nextVersion };
}
