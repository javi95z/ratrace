/**
 * The web's twin of polyfills.ts. A browser has WebCrypto, `structuredClone` and the Intl the game needs, so nothing is installed over them
 * (no expo-crypto, no formatjs, no JSON clone). Imported first by the app's entry (index.ts), as the phone's is, so the entry stays one.
 */
/** Nothing to install: a browser's `crypto` has random values, ids and `subtle.digest` of its own. Kept for the phone file's export. */
export function installCrypto(target: { crypto?: Crypto }): void {
  void target;
}
