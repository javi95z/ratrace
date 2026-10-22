/**
 * What the phone's JavaScript lacks that the game's packages use. Imported first by the app's entry (index.ts),
 * before the router or any of them load.
 */
import * as Crypto from 'expo-crypto';
import { getCalendars } from 'expo-localization';
import { installClone } from './clone';
import { readDaysIn } from './intl';

/**
 * The digests WebCrypto makes, by their names, which are expo-crypto's names for them too ('SHA-256'). expo-crypto makes more (MD5 among them), which
 * WebCrypto refuses, and so does this.
 */
const DIGESTS = new Set<string>(['SHA-1', 'SHA-256', 'SHA-384', 'SHA-512']);

/**
 * WebCrypto's `subtle.digest`, from expo-crypto's: the bytes hashed natively, into an ArrayBuffer, as a browser answers. The account's client
 * hashes the proof of each trip to Google with it (PKCE's SHA-256), and without one would send the proof itself. An algorithm it has not got is
 * refused, as a browser refuses it.
 */
async function digest(algorithm: AlgorithmIdentifier, data: BufferSource): Promise<ArrayBuffer> {
  const name = typeof algorithm === 'string' ? algorithm : algorithm.name;
  if (!DIGESTS.has(name.toUpperCase())) throw new Error(`no digest ${name} on this phone`);
  // Only the bytes of a view are its own: one on part of a larger buffer is hashed for those alone.
  const bytes = ArrayBuffer.isView(data) ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength) : new Uint8Array(data);
  return Crypto.digest(name.toUpperCase() as Crypto.CryptoDigestAlgorithm, bytes);
}

/** Gives `target` WebCrypto's random values, ids and digest from expo-crypto, where it lacks them; what it has is left as it is. */
export function installCrypto(target: { crypto?: Crypto }): void {
  const own = target.crypto as Partial<Crypto> | undefined;
  if (typeof own?.getRandomValues !== 'function' || typeof own?.randomUUID !== 'function') {
    target.crypto = { ...(own ?? {}), getRandomValues: Crypto.getRandomValues, randomUUID: Crypto.randomUUID } as unknown as Crypto;
  }
  const crypto = target.crypto as { subtle?: Partial<SubtleCrypto> };
  if (typeof crypto.subtle?.digest !== 'function') crypto.subtle = { ...(crypto.subtle ?? {}), digest } as SubtleCrypto;
}

// The game's clone is JSON on the phone, in place of the one Expo's runtime puts there (clone.ts).
installClone();

installCrypto(globalThis as { crypto?: Crypto });

readDaysIn(getCalendars()[0]?.timeZone);
