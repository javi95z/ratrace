/**
 * What the phone's JavaScript lacks that the game's packages use. Imported first by the app's entry (index.ts),
 * before the router or any of them load.
 */
import * as Crypto from 'expo-crypto';
import { getCalendars } from 'expo-localization';
import { readDaysIn } from './intl';

if (typeof globalThis.structuredClone !== 'function') {
  // The game only ever clones plain data (states, saves, views): JSON is exact for it (checked in phase 0 on whole lives).
  globalThis.structuredClone = (<T,>(value: T): T => (value === undefined ? value : JSON.parse(JSON.stringify(value)))) as typeof structuredClone;
}

const g = globalThis as { crypto?: { getRandomValues?: unknown; randomUUID?: unknown } };
if (typeof g.crypto?.getRandomValues !== 'function' || typeof g.crypto?.randomUUID !== 'function') {
  g.crypto = { ...(g.crypto ?? {}), getRandomValues: Crypto.getRandomValues, randomUUID: Crypto.randomUUID };
}

readDaysIn(getCalendars()[0]?.timeZone);
