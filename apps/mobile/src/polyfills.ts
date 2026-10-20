/**
 * What the phone's JavaScript may lack that the game's packages use. Loaded before anything else.
 * The spike also notes what was missing, to say so on screen.
 */
import * as Crypto from 'expo-crypto';

export const missing: string[] = [];

if (typeof globalThis.structuredClone !== 'function') {
  missing.push('structuredClone');
  // The game only ever clones plain data (states, saves, views): JSON is exact for it.
  globalThis.structuredClone = (<T,>(value: T): T => (value === undefined ? value : JSON.parse(JSON.stringify(value)))) as typeof structuredClone;
}

const g = globalThis as { crypto?: { getRandomValues?: unknown; randomUUID?: unknown } };
if (typeof g.crypto?.getRandomValues !== 'function' || typeof g.crypto?.randomUUID !== 'function') {
  missing.push('crypto');
  g.crypto = { ...(g.crypto ?? {}), getRandomValues: Crypto.getRandomValues, randomUUID: Crypto.randomUUID };
}

// Hermes's Intl formats numbers but cannot say which part of the result is which. The game asks
// only where the currency sign stands around a whole number: read off the formatted text.
const proto = Intl.NumberFormat.prototype as Intl.NumberFormat & { formatToParts?: unknown };
if (typeof proto.formatToParts !== 'function') {
  missing.push('Intl.NumberFormat.formatToParts');
  proto.formatToParts = function (this: Intl.NumberFormat, value: number) {
    const text = this.format(value);
    const match = /[\d\s.,  ]*\d/.exec(text);
    if (!match) return [{ type: 'literal', value: text }];
    const parts: Intl.NumberFormatPart[] = [];
    if (match.index > 0) parts.push({ type: 'literal', value: text.slice(0, match.index) });
    parts.push({ type: 'integer', value: match[0] });
    if (match.index + match[0].length < text.length) parts.push({ type: 'literal', value: text.slice(match.index + match[0].length) });
    return parts;
  } as Intl.NumberFormat['formatToParts'];
}
