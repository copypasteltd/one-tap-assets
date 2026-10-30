/** getRandomValues is available on ordinary HTTP origins as well as HTTPS. */
export function requestKey(): string {
  const random = globalThis.crypto;
  if (typeof random?.randomUUID === 'function') return random.randomUUID();
  if (typeof random?.getRandomValues !== 'function') throw new Error('浏览器缺少随机数能力，请使用更新的浏览器');
  const bytes = random.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const value = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}
