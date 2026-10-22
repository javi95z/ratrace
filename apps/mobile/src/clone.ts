/**
 * The game's `structuredClone` on the phone.
 *
 * The engine and the session clone the game's state on every move (a round, a card, a preview of the round, every view and every save). Hermes has
 * no clone of its own, and Expo's runtime puts one there before the app's first line runs: `@ungap/structured-clone`, written in JavaScript, which
 * walks a value twice (into pairs, and back) and keeps a map of every object it met. On the phone that was a large part of a round's cost on the
 * JavaScript thread (measured in Resolve's profile).
 *
 * The game clones only plain data (states, saves, views, profiles, finished lives), and on the phone all of it is kept as JSON already
 * (`kvStore.ts`): a life that is saved and opened again has been through JSON. Hermes's JSON is native. So the phone clones through JSON, whatever was
 * put there before (the web and the tests keep their engine's own). `clone.test.ts` plays whole lives both ways, under the rules of today and under
 * an older bundle's, and finds every step, the profile and the finished lives alike.
 */
export function jsonClone<T>(value: T): T {
  return value === undefined ? value : (JSON.parse(JSON.stringify(value)) as T);
}

type Clone = (value: unknown, options?: { transfer?: unknown[] }) => unknown;

/** What JSON cannot copy and a library may ask the global clone for: bytes (a buffer, or a view of one). */
const isBytes = (value: unknown): boolean => value instanceof ArrayBuffer || ArrayBuffer.isView(value);

/**
 * Makes the JSON clone the game's `structuredClone`, in place of whatever is there, without reading it (Expo's is a lazy getter that loads its
 * module when first read). Called by the phone's entry only (polyfills.ts): Hermes has no clone of its own to keep.
 *
 * It is the global, so it is every library's clone too, not the game's alone: Expo's streams (`expo/virtual/streams.js`, the web streams polyfill)
 * ask it to move a buffer from one stream to another, `structuredClone(buffer, { transfer: [buffer] })`, where Hermes has no
 * `ArrayBuffer.prototype.transfer`; JSON would make the buffer an empty object. What JSON cannot copy (bytes) and a call that asks to transfer go to
 * the clone that was there before, read only then; everything else, the game's plain data, through JSON.
 */
export function installClone(): void {
  const before = Object.getOwnPropertyDescriptor(globalThis, 'structuredClone');
  const theirs = (): Clone | undefined => (before?.get ? (before.get.call(globalThis) as Clone | undefined) : (before?.value as Clone | undefined));
  const clone = (value: unknown, options?: { transfer?: unknown[] }): unknown => {
    if (options?.transfer !== undefined || isBytes(value)) {
      const other = theirs();
      if (other) return other(value, options);
    }
    return jsonClone(value);
  };
  Object.defineProperty(globalThis, 'structuredClone', { value: clone, writable: true, configurable: true, enumerable: true });
}
