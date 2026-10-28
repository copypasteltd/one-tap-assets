export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };

/** RFC 8785: ECMAScript number/string serialization and UTF-16 key sorting. */
export function canonicalize(value: unknown): string {
  const seen = new Set<object>();
  const validString = (text: string): string => {
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);
      if (code >= 0xd800 && code <= 0xdbff) { const next = text.charCodeAt(++i); if (!(next >= 0xdc00 && next <= 0xdfff)) throw new TypeError('Unpaired JSON surrogate'); }
      else if (code >= 0xdc00 && code <= 0xdfff) throw new TypeError('Unpaired JSON surrogate');
    }
    return JSON.stringify(text);
  };
  const encode = (item: unknown): string => {
    if (typeof item === 'string') return validString(item);
    if (item === null || typeof item === 'boolean') return JSON.stringify(item);
    if (typeof item === 'number') {
      if (!Number.isFinite(item)) throw new TypeError('Non-finite JSON number');
      return JSON.stringify(item);
    }
    if (typeof item !== 'object') throw new TypeError('Value is not JSON');
    if (seen.has(item)) throw new TypeError('Cyclic JSON');
    seen.add(item);
    let result: string;
    if (Array.isArray(item)) {
      for (let i = 0; i < item.length; i++) if (!(i in item)) throw new TypeError('Sparse JSON array');
      result = `[${item.map(encode).join(',')}]`;
    }
    else {
      if (Object.getPrototypeOf(item) !== Object.prototype && Object.getPrototypeOf(item) !== null) throw new TypeError('Non-plain JSON object');
      if (Object.getOwnPropertySymbols(item).length) throw new TypeError('Symbol JSON key');
      result = `{${Object.keys(item).sort().map(key => `${validString(key)}:${encode((item as Record<string, unknown>)[key])}`).join(',')}}`;
    }
    seen.delete(item);
    return result;
  };
  return encode(value);
}

export function object(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Expected object');
  return value as Record<string, unknown>;
}

export function integer(value: unknown, label: string, minimum = 0): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum) throw new TypeError(`Invalid ${label}`);
  return value;
}
