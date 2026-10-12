/** JSON with object keys sorted, so equal states always give equal text. */
export function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const record = value as Record<string, unknown>;
  const parts = Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`);
  return `{${parts.join(',')}}`;
}

function fnv1a(text: string, seed: number): number {
  let h = seed | 0;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** A 16-character hex fingerprint of a state. Equal states give equal hashes on every device. */
export function stateHash(state: unknown): string {
  const text = canonical(state);
  const high = fnv1a(text, 0x811c9dc5).toString(16).padStart(8, '0');
  const low = fnv1a(text, 0x9747b28c).toString(16).padStart(8, '0');
  return high + low;
}
