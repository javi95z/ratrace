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
