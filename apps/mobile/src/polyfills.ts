/**
 * What the phone's JavaScript lacks that the game's packages use. Imported first by the app's entry (index.ts),
 * before the router or any of them load.
 */
import * as Crypto from 'expo-crypto';
import { getCalendars } from 'expo-localization';
import { installClone } from './clone';
import { readDaysIn } from './intl';

// The game's clone is JSON on the phone, in place of the one Expo's runtime puts there (clone.ts).
installClone();

const g = globalThis as { crypto?: { getRandomValues?: unknown; randomUUID?: unknown } };
if (typeof g.crypto?.getRandomValues !== 'function' || typeof g.crypto?.randomUUID !== 'function') {
  g.crypto = { ...(g.crypto ?? {}), getRandomValues: Crypto.getRandomValues, randomUUID: Crypto.randomUUID };
}

readDaysIn(getCalendars()[0]?.timeZone);
