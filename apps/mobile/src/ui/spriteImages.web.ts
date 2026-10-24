import { useCallback, useMemo, useRef, useSyncExternalStore } from 'react';
import type { ImageSourcePropType } from 'react-native';
import { getAssetByID } from 'react-native-web/dist/modules/AssetRegistry';
import { SOURCES } from '../sprites/sources';
import { reportMissing } from './sprites';

/*
 * The web export's twin of `spriteImages.ts` (Metro picks it for the web). The web draws a sprite as an `<img>` and never decodes it itself, so
 * what is shared here is not a decoded picture but the sprite's address and size, once the browser has fetched the file: the same cache of reads, the
 * same count of reads under way (`useSpritesLoading`, which the scenes' shots wait on), the same states (`SpriteImage`). The browser keeps the
 * decoded pictures and the files: nothing here is trimmed.
 */

/** What is given for a sprite's file (a Metro asset: on the web a number in react-native-web's registry, or an object with its address). */
export const sourceOf = (id: string): ImageSourcePropType | undefined => (Object.hasOwn(SOURCES, id) ? SOURCES[id] : undefined);

/** A sprite's picture on the web: where the browser fetches it, and its size in art pixels. */
export interface SpritePicture {
  uri: string;
  w: number;
  h: number;
}

/** Reads a sprite's file: null when the browser could not load it. */
export type LoadSprite = (source: ImageSourcePropType) => Promise<SpritePicture | null>;

/** The address of a sprite's file, from what `sourceOf` gives (a registry number, an object with a `uri`, or the address itself). */
export function uriOf(source: ImageSourcePropType | string): string | null {
  if (typeof source === 'string') return source;
  if (typeof source === 'number') {
    const asset = getAssetByID(source);
    if (!asset) return null;
    // The closest scale to the screen's, as react-native-web's own Image picks it.
    const wanted = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;
    const scale = asset.scales.reduce((prev, now) => (Math.abs(now - wanted) < Math.abs(prev - wanted) ? now : prev), asset.scales[0] ?? 1);
    return `${asset.httpServerLocation}/${asset.name}${scale !== 1 ? `@${scale}x` : ''}.${asset.type}`;
  }
  const one = Array.isArray(source) ? source[0] : source;
  return one && typeof one.uri === 'string' && one.uri !== '' ? one.uri : null;
}

/** The browser's: the file fetched by an image of its own and decoded, so that the `<img>` drawn after it finds it ready. */
const loadInBrowser: LoadSprite = (source) =>
  new Promise((resolve, reject) => {
    const uri = uriOf(source);
    if (!uri) {
      reject(new Error('no address for this asset'));
      return;
    }
    const image = new globalThis.Image();
    image.onload = () => {
      const done = () => resolve({ uri, w: image.naturalWidth, h: image.naturalHeight });
      if (typeof image.decode === 'function') image.decode().then(done, done);
      else done();
    };
    image.onerror = () => resolve(null);
    image.src = uri;
  });

/** A sprite's picture: still loading (null, not failed), loaded, or failed (a file the browser could not load). */
export interface SpriteImage {
  image: SpritePicture | null;
  failed: boolean;
}
const LOADING: SpriteImage = { image: null, failed: false };
const FAILED: SpriteImage = { image: null, failed: true };

interface Entry {
  state: SpriteImage;
  listeners: Set<() => void>;
  /** When its read failed (`Date.now()`), for a failure asked again later. */
  failedAt?: number;
}

/**
 * How long a failed file stays failed before the next place that draws it asks the browser again. The Next web's `<img>` keeps its failure only while
 * it is mounted, so the next screen asks again; here the failure is shared, so it is forgotten once this has passed and the sprite is asked for again
 * (a later mount, the next screen). The wait keeps a file that keeps failing from being asked for on every drawing.
 */
export const RETRY_FAILED_MS = 3000;

/**
 * What the decoded pictures may take on the phone. The browser keeps the web's, and the cache here holds an address and a size for each sprite, so
 * nothing is trimmed on the web: the number is kept for the twin's exports.
 */
export const SPRITE_BUDGET_BYTES = 24 * 1024 * 1024;

/** Every sprite's picture, read once for the whole app and shared by every place that draws it. */
const cache = new Map<string, Entry>();
let load: LoadSprite = loadInBrowser;

/** The reads under way, and who wants to know how many there are (`useSpritesLoading`). */
const reading = new Set<Entry>();
const readers = new Set<() => void>();
/**
 * Tells those who watch the reads under way, once the code that started or ended one is done: a read begins while a sprite is being drawn, and no
 * one may be told to draw again in the middle of another's drawing.
 */
function toldOfReads(): void {
  queueMicrotask(() => {
    for (const reader of readers) reader();
  });
}

/** Tests only: reads sprites with `next` from now on, everything read before forgotten. */
export function loadSpritesWith(next: LoadSprite): void {
  load = next;
  cache.clear();
  reading.clear();
  toldOfReads();
}

/** A failed entry whose wait has passed: the next to ask for its sprite reads the file again. */
const stale = (entry: Entry): boolean => entry.failedAt !== undefined && Date.now() - entry.failedAt >= RETRY_FAILED_MS;

/**
 * The entry of a sprite that has a file, its read begun the first time it is asked for, and begun again when it is asked for after a failure has
 * waited `RETRY_FAILED_MS` (the failure is still told only once).
 */
function entryOf(id: string, source: ImageSourcePropType): Entry {
  // A page drawn with no browser (the export's HTML, made on the build's machine) reads nothing: its sprites are still to come, as on a first visit,
  // and the browser reads them once it takes the page over.
  if (typeof window === 'undefined') return { state: LOADING, listeners: new Set() };
  const known = cache.get(id);
  if (known && !stale(known)) return known;
  const entry: Entry = { state: LOADING, listeners: new Set() };
  cache.set(id, entry);
  reading.add(entry);
  toldOfReads();
  const settle = (state: SpriteImage) => {
    entry.state = state;
    if (reading.delete(entry)) toldOfReads();
    for (const listener of entry.listeners) listener();
  };
  const fail = () => {
    reportMissing(id, 'did not load');
    entry.failedAt = Date.now();
    settle(FAILED);
  };
  // A read refused and a file that does not load end the same way: the checkerboard, told once.
  load(source).then((image) => (image ? settle({ image, failed: false }) : fail()), fail);
  return entry;
}

/**
 * A sprite's picture read on its own, outside the shared cache: its address and size, for whoever draws it by itself (the share card, which loads the
 * file into an image of its own). On the web it is not a decoded picture, as the phone's is, so there is nothing to let go. Null where the sprite has
 * no file, or the browser could not load it.
 */
export async function readSprite(id: string): Promise<SpritePicture | null> {
  const source = sourceOf(id);
  if (source === undefined) return null;
  try {
    return await load(source);
  } catch {
    return null;
  }
}

const NONE: SpriteImage = LOADING;
const nothing = () => () => {};

/** The picture of a sprite (none for an id with no file), redrawn once it is loaded or has failed. */
export function useSpriteImage(id: string | null | undefined): SpriteImage {
  const source = id ? sourceOf(id) : undefined;
  const entry = id && source !== undefined ? entryOf(id, source) : null;
  const subscribe = useCallback(
    (listener: () => void) => {
      if (!entry) return nothing();
      entry.listeners.add(listener);
      return () => {
        entry.listeners.delete(listener);
      };
    },
    [entry],
  );
  return useSyncExternalStore(subscribe, () => (entry ? entry.state : NONE), () => NONE);
}

/**
 * The pictures of several sprites at once (`useSpriteImage` for each, a list of ids of any length), drawn again when any of them is loaded or
 * fails. The list given back is the same object for as long as every picture in it is the same.
 */
export function useSpriteImages(ids: readonly (string | null | undefined)[]): readonly SpriteImage[] {
  const key = ids.map((id) => id ?? '').join('\n');
  // Each picture's entry, its read begun the first time it is asked for, for as long as the ids are the same.
  const entries = useMemo(
    () =>
      (key === '' ? [] : key.split('\n')).map((id) => {
        const source = id ? sourceOf(id) : undefined;
        return id && source !== undefined ? entryOf(id, source) : null;
      }),
    [key],
  );
  const held = useRef<readonly SpriteImage[]>([]);
  const subscribe = useCallback(
    (listener: () => void) => {
      for (const entry of entries) entry?.listeners.add(listener);
      return () => {
        for (const entry of entries) entry?.listeners.delete(listener);
      };
    },
    [entries],
  );
  const snapshot = useCallback(() => {
    const now = entries.map((entry) => (entry ? entry.state : NONE));
    const before = held.current;
    if (before.length === now.length && before.every((state, i) => state === now[i])) return before;
    held.current = now;
    return now;
  }, [entries]);
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

/**
 * Begins loading sprites a screen will draw soon (the rat editor's other tabs), so that the browser has them when it draws them: a sprite already
 * asked for is left as it is (but a failure whose wait has passed).
 */
export function readAhead(ids: readonly string[]): void {
  for (const id of ids) {
    const source = sourceOf(id);
    const known = cache.get(id);
    if (source !== undefined && (!known || stale(known))) entryOf(id, source);
  }
}

/** How many sprites are being loaded right now: none once every picture asked for is in, or has failed. */
export const spritesLoading = (): number => reading.size;

const watchReads = (listener: () => void) => {
  readers.add(listener);
  return () => {
    readers.delete(listener);
  };
};

/** `spritesLoading`, drawn again whenever it changes: a page can tell when every picture it asked for is in (the scenes' route, for its shots). */
export function useSpritesLoading(): number {
  return useSyncExternalStore(watchReads, spritesLoading, () => 0);
}
