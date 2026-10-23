import { Skia, type SkImage } from '@shopify/react-native-skia';
import { useCallback, useMemo, useRef, useSyncExternalStore } from 'react';
import { Image, type ImageSourcePropType } from 'react-native';
import { SOURCES } from '../sprites/sources';
import { forgetComposed } from './ratPicture';
import { reportMissing } from './sprites';

/** What Skia is given for a sprite's file (a Metro asset id). */
export const sourceOf = (id: string): ImageSourcePropType | undefined => (Object.hasOwn(SOURCES, id) ? SOURCES[id] : undefined);

/** Reads a sprite's file and decodes it: null when it does not decode. */
export type LoadSprite = (source: ImageSourcePropType) => Promise<SkImage | null>;

/** The phone's: the bundled file by its asset's address, read and decoded by Skia (what Skia's own `useImage` does). */
const readAndDecode: LoadSprite = async (source) => {
  const uri = typeof source === 'number' ? Image.resolveAssetSource(source)?.uri : (source as { uri?: string }).uri;
  if (!uri) throw new Error('no address for this asset');
  return Skia.Image.MakeImageFromEncoded(await Skia.Data.fromURI(uri));
};

/** A sprite's picture: still loading (null, not failed), decoded, or failed (a read refused or a file that did not decode). */
export interface SpriteImage {
  image: SkImage | null;
  failed: boolean;
}
const LOADING: SpriteImage = { image: null, failed: false };
const FAILED: SpriteImage = { image: null, failed: true };

interface Entry {
  state: SpriteImage;
  listeners: Set<() => void>;
  /** What its picture takes decoded (width × height × 4), counted once it is in; none while loading or failed. */
  bytes: number;
}

/** What the decoded pictures may take all together: past it, the ones drawn longest ago that nobody is looking at go. */
export const SPRITE_BUDGET_BYTES = 24 * 1024 * 1024;

/**
 * Every sprite's picture, read and decoded once for the whole app and shared by every place that draws it: a list of
 * two hundred coins is one read and one decode, not two hundred. Kept up to the budget: all the art decoded would take
 * about 60 MiB (a sprite is mostly 64 KB, the largest, the world map, 540 KB), and a screen draws a small part of it.
 * The map is in the order the sprites were last asked for, the one drawn longest ago first.
 */
const cache = new Map<string, Entry>();
/** What the pictures in the cache take decoded, all together. */
let held = 0;
let load: LoadSprite = readAndDecode;

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
  // And what was put together from them (ratPicture.ts).
  forgetComposed();
  held = 0;
  reading.clear();
  toldOfReads();
}

/**
 * Forgets pictures, the one drawn longest ago first, until the cache is within its budget. A picture someone is looking
 * at (it has a listener) is never forgotten, nor a sprite that failed (it takes nothing, and must be told once): so the
 * cache may hold more than its budget while the screen needs it, and is trimmed as soon as the screen lets go.
 */
function trim(): void {
  for (const [id, entry] of cache) {
    if (held <= SPRITE_BUDGET_BYTES) return;
    if (entry.listeners.size > 0 || !entry.state.image) continue;
    cache.delete(id);
    held -= entry.bytes;
    const { image } = entry.state;
    // Whoever still holds this entry (drawn, not yet watching) sees its state change, draws again and asks anew: never a
    // picture that was let go. (A new object, so that it differs from the loading one such a holder may have seen.)
    entry.state = { image: null, failed: false };
    image.dispose();
  }
}

/** The entry of a sprite that has a file, its read begun the first time it is asked for. Asked for, it is the last one drawn. */
function entryOf(id: string, source: ImageSourcePropType): Entry {
  const known = cache.get(id);
  if (known) {
    cache.delete(id);
    cache.set(id, known);
    return known;
  }
  const entry: Entry = { state: LOADING, listeners: new Set(), bytes: 0 };
  cache.set(id, entry);
  reading.add(entry);
  toldOfReads();
  const settle = (state: SpriteImage) => {
    entry.state = state;
    if (reading.delete(entry)) toldOfReads();
    // Forgotten while it was being read (the cache was cleared): not counted, not kept.
    if (state.image && cache.get(id) === entry) {
      entry.bytes = state.image.width() * state.image.height() * 4;
      held += entry.bytes;
      trim();
    }
    for (const listener of entry.listeners) listener();
  };
  const fail = () => {
    reportMissing(id, 'did not load');
    settle(FAILED);
  };
  // A read refused and a file that does not decode end the same way: the checkerboard, told once.
  load(source).then((image) => (image ? settle({ image, failed: false }) : fail()), fail);
  return entry;
}

/**
 * A sprite's picture read and decoded on its own, outside the shared cache, for whoever draws it once and lets it go (`dispose`) when done: the share
 * card, which draws on a surface of its own while the screen goes on drawing (the cache may let go of a picture nobody is watching). Null where the
 * sprite has no file, or its file is not read or does not decode.
 */
export async function readSprite(id: string): Promise<SkImage | null> {
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

/** The picture of a sprite (none for an id with no file), redrawn once it is decoded or has failed. */
export function useSpriteImage(id: string | null | undefined): SpriteImage {
  const source = id ? sourceOf(id) : undefined;
  const entry = id && source !== undefined ? entryOf(id, source) : null;
  const subscribe = useCallback(
    (listener: () => void) => {
      if (!entry) return nothing();
      entry.listeners.add(listener);
      return () => {
        entry.listeners.delete(listener);
        // Put down, it may be what kept the cache over its budget.
        trim();
      };
    },
    [entry],
  );
  return useSyncExternalStore(subscribe, () => (entry ? entry.state : NONE), () => NONE);
}

/**
 * The pictures of several sprites at once (`useSpriteImage` for each, a list of ids of any length), drawn again when any of them is decoded or
 * fails. The list given back is the same object for as long as every picture in it is the same.
 */
export function useSpriteImages(ids: readonly (string | null | undefined)[]): readonly SpriteImage[] {
  const key = ids.map((id) => id ?? '').join('\n');
  // Each picture's entry, its read begun the first time it is asked for (as `useSpriteImage` does), for as long as the ids are the same (`key`
  // says them all: a list made anew with the same ids keeps its entries).
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
        // Put down, they may be what kept the cache over its budget.
        trim();
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
 * Begins reading and decoding sprites a screen will draw soon (the rat editor's other tabs, once its first is on screen), so that they are in when
 * it draws them: a sprite already asked for is left as it is. Nothing watches them: kept as any other, they may go only past the budget.
 */
export function readAhead(ids: readonly string[]): void {
  for (const id of ids) {
    const source = sourceOf(id);
    if (source !== undefined && !cache.has(id)) entryOf(id, source);
  }
}

/** How many sprites are being read and decoded right now: none once every picture asked for is in, or has failed. */
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
