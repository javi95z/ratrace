/**
 * The game's `structuredClone` on the phone.
 *
 * The engine and the session clone the game's state on every move (a round, a card, a preview of the round, every view and every save). Hermes has
 * no clone of its own, and Expo's runtime puts one there before the app's first line runs: `@ungap/structured-clone`, written in JavaScript, which
 * walks a value twice (into pairs, and back) and keeps a map of every object it met. On the phone that was a large part of a round's cost on the
 * JavaScript thread (measured in Resolve's profile).
 *
 * The game clones only plain data (states, saves, views, profiles), and on the phone all of it is kept as JSON already (`kvStore.ts`): a life that is
 * saved and opened again has been through JSON. Hermes's JSON is native. So the phone clones through JSON, whatever was put there before (the web
 * and the tests keep their engine's own). `clone.test.ts` plays whole lives both ways and finds every step alike.
 */
export function jsonClone<T>(value: T): T {
  return value === undefined ? value : (JSON.parse(JSON.stringify(value)) as T);
}

/**
 * Makes the JSON clone the game's `structuredClone`, in place of whatever is there, without reading it (Expo's is a lazy getter that loads its
 * module when first read). Called by the phone's entry only (polyfills.ts): Hermes has no clone of its own to keep.
 */
export function installClone(): void {
  Object.defineProperty(globalThis, 'structuredClone', { value: jsonClone, writable: true, configurable: true, enumerable: true });
}
