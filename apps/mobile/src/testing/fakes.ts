import { createContext, createElement, useEffect, type ReactNode } from 'react';
import { vi } from 'vitest';
import type { Cue } from '../ui/sound';
import { painted } from '../ui/testing/skia';

/*
 * The phone's native modules, as the tests of the game have them. Nothing here loads in a test (they are the phone's
 * own: its router, its store of keys and values, its speaker, its screen's edges, its canvas), so each is stood in for
 * by something that keeps what was asked of it, for the test to read. `setup.ts` puts them in place of the modules;
 * `render.tsx` hands them to the tests. They are put back as they were after every test.
 */

/** What a screen asks of the router: every move is a spy. */
export const router = { push: vi.fn(), back: vi.fn(), replace: vi.fn(), dismissTo: vi.fn(), canGoBack: vi.fn(() => true) };
/** The query of the address the screen was opened with (`/scene?name=`): none, unless a test gives it some. A `Redirect` is a box that names where it goes. */
export const params: Record<string, string> = {};
export const expoRouter = {
  useRouter: () => router,
  useLocalSearchParams: () => params,
  Redirect: ({ href }: { href: string }) => createElement('div', { 'data-redirect': href }),
  // A screen of a test is the one in front: what it does while it is in front, it does while it is drawn.
  useFocusEffect: (effect: () => void | (() => void)) => useEffect(effect, [effect]),
};

/** Who listens to Android's Back (`BackHandler.addEventListener('hardwareBackPress', …)`), in the order they began to: the phone asks the latest first. */
export const backListeners: Array<() => boolean | null | undefined> = [];
/** Android's Back as the screens reach it (react-native-web has none: it only says it is not there). */
export const backHandler = {
  addEventListener(_event: 'hardwareBackPress', listener: () => boolean | null | undefined) {
    backListeners.push(listener);
    return {
      remove: () => {
        const at = backListeners.lastIndexOf(listener);
        if (at >= 0) backListeners.splice(at, 1);
      },
    };
  },
};

/**
 * Presses Android's Back, as the phone hears it: a sheet that is open is a Modal, which takes the press itself and asks to be closed (on the web
 * that react-native-web stands in for, the Modal hears Escape); with none, each listener from the latest is asked until one takes it; and if none
 * does, the app is left (the system's own Back, on the first screen). Says which of the three it was.
 */
export function pressBack(): 'sheet' | 'screen' | 'left' {
  if (document.querySelector('[aria-modal="true"]') !== null) {
    document.dispatchEvent(new KeyboardEvent('keyup', { key: 'Escape', bubbles: true }));
    return 'sheet';
  }
  for (const listener of [...backListeners].reverse()) if (listener() === true) return 'screen';
  return 'left';
}

/** The phone: its languages in its order of preference, and the time zone it is in. */
export const device = { languages: ['en'] as string[], timeZone: 'UTC' };
export const expoLocalization = {
  getLocales: () => device.languages.map((languageCode) => ({ languageCode, languageTag: languageCode })),
  getCalendars: () => [{ timeZone: device.timeZone }],
};

/** What the phone's key-value store holds, by key: the game, the runs, the profile, the language and the basket are all in it. */
export const kv = new Map<string, string>();
export const expoKeyValueStore = {
  default: {
    getItem: (key: string) => Promise.resolve(kv.get(key) ?? null),
    setItem: (key: string, value: string) => Promise.resolve(void kv.set(key, value)),
    removeItem: (key: string) => Promise.resolve(kv.delete(key)),
    getItemSync: (key: string) => kv.get(key) ?? null,
    setItemSync: (key: string, value: string) => void kv.set(key, value),
    removeItemSync: (key: string) => kv.delete(key),
  },
};

/** The cues the game has played, in the order they began. */
export const heard: Cue[] = [];
/** A player that plays nothing and writes down which cue it was made for; a source is `file:` and the cue (see `soundSources`). */
export const expoAudio = {
  createAudioPlayer: (source: string) => ({
    play: () => void heard.push(source.slice('file:'.length) as Cue),
    seekTo: () => Promise.resolve(),
    remove: () => undefined,
  }),
  setAudioModeAsync: () => Promise.resolve(),
};
/** The cues' files are only loaded on the phone: here each is the name of its cue. */
export const soundSources = { SOUND_SOURCES: new Proxy({}, { get: (_target, cue) => `file:${String(cue)}` }) };

/** The edges of the screen the phone draws under: none, unless a test gives it some. */
export const insets = { top: 0, bottom: 0, left: 0, right: 0 };
export const safeArea = { useSafeAreaInsets: () => insets };

/** How many times each sprite has been drawn, by id: what a test that something was not drawn again counts. */
export const spriteRenders = new Map<string, number>();
/**
 * Sprites are drawn with Skia on the phone only: here each is a box that names its id, says if it is only the shape of the picture, and the box
 * it is drawn into where it is given one (`size`, as `w x h`); what is drawn over the picture in its canvas (the rainbow of a legendary card) is
 * drawn inside it. The stage's scale of the art (`ArtScale`) is the phone's: one point an art pixel.
 */
export const spriteModule = {
  Sprite: ({ id, silhouette, size, children }: { id: string; silhouette?: boolean; size?: { w: number; h: number }; children?: ReactNode }) => {
    spriteRenders.set(id, (spriteRenders.get(id) ?? 0) + 1);
    return createElement('div', { 'data-sprite': id, ...(silhouette ? { 'data-silhouette': 'true' } : null), ...(size ? { 'data-size': `${size.w}x${size.h}` } : null) }, children);
  },
  ArtScale: createContext(1),
};

/** The phone's files, as the game writes them (the picture of a life, in the cache): by their address, what was written there last. */
export const files = new Map<string, Uint8Array | string>();
/** The phone's file system, as the share card reaches it: a file in the cache, made (in place of one of that name, when told) and written. */
export const expoFileSystem = {
  Paths: { cache: { uri: 'file:///cache/' } },
  File: class {
    readonly uri: string;
    constructor(directory: { uri: string }, name: string) {
      this.uri = `${directory.uri}${name}`;
    }
    create(options: { overwrite?: boolean } = {}): void {
      if (files.has(this.uri) && options.overwrite !== true) throw new Error(`a file is already at ${this.uri}`);
      files.set(this.uri, new Uint8Array());
    }
    async write(content: Uint8Array | string): Promise<void> {
      files.set(this.uri, content);
    }
  },
};
/** The phone's share sheet: whether there is one, and every file it was handed, in order, with what it was told of it. */
export const shareSheet = { available: true, handed: [] as Array<{ url: string; options?: Record<string, unknown> }> };
export const expoSharing = {
  isAvailableAsync: () => Promise.resolve(shareSheet.available),
  shareAsync: (url: string, options?: Record<string, unknown>) => Promise.resolve(void shareSheet.handed.push({ url, options })),
};

/** Puts every stand-in back as it was found, for the next test. */
export function resetFakes(): void {
  for (const spy of Object.values(router)) spy.mockReset();
  backListeners.length = 0;
  device.languages = ['en'];
  device.timeZone = 'UTC';
  for (const key of Object.keys(params)) delete params[key];
  kv.clear();
  heard.length = 0;
  spriteRenders.clear();
  Object.assign(insets, { top: 0, bottom: 0, left: 0, right: 0 });
  files.clear();
  shareSheet.available = true;
  shareSheet.handed.length = 0;
  painted.reset();
}

/**
 * The gesture handler, whose native side cannot be loaded here: a gesture is its configuration, handed back as it was given (a test that drives
 * one takes its callbacks from it), and a detector draws what it holds. The slider's own test drives its pan with a stand-in of its own.
 */
export const gestureHandler = {
  usePanGesture: <T,>(config: T): T => config,
  GestureDetector: ({ children }: { children: ReactNode }) => children,
  GestureHandlerRootView: ({ children }: { children: ReactNode }) => children,
};
