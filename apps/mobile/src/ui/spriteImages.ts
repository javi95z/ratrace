import { Skia, type SkImage } from '@shopify/react-native-skia';
import { useCallback, useSyncExternalStore } from 'react';
import { Image, type ImageSourcePropType } from 'react-native';
import { SOURCES } from '../sprites/sources';
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
}

/**
 * Every sprite's picture, read and decoded once for the whole app and shared by every place that draws it: a list of
 * two hundred coins is one read and one decode, not two hundred. Kept for as long as the app runs (the art is small:
 * a few kilobytes a sprite decoded, the largest, a 128 px rat layer, 64 KB).
 */
const cache = new Map<string, Entry>();
let load: LoadSprite = readAndDecode;

/** Tests only: reads sprites with `next` from now on, everything read before forgotten. */
export function loadSpritesWith(next: LoadSprite): void {
  load = next;
  cache.clear();
}

/** The entry of a sprite that has a file, its read begun the first time it is asked for. */
function entryOf(id: string, source: ImageSourcePropType): Entry {
  const known = cache.get(id);
  if (known) return known;
  const entry: Entry = { state: LOADING, listeners: new Set() };
  cache.set(id, entry);
  const settle = (state: SpriteImage) => {
    entry.state = state;
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
      return () => entry.listeners.delete(listener);
    },
    [entry],
  );
  return useSyncExternalStore(subscribe, () => (entry ? entry.state : NONE), () => NONE);
}
