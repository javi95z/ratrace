import { createElement } from 'react';
import { vi } from 'vitest';
import type { Cue } from '../ui/sound';

/*
 * The phone's native modules, as the tests of the game have them. Nothing here loads in a test (they are the phone's
 * own: its router, its store of keys and values, its speaker, its screen's edges, its canvas), so each is stood in for
 * by something that keeps what was asked of it, for the test to read. `setup.ts` puts them in place of the modules;
 * `render.tsx` hands them to the tests. They are put back as they were after every test.
 */

/** What a screen asks of the router: every move is a spy. */
export const router = { push: vi.fn(), back: vi.fn(), replace: vi.fn(), canGoBack: vi.fn(() => true) };
export const expoRouter = { useRouter: () => router };

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

/** Sprites are drawn with Skia on the phone only: here each is a box that names its id. */
export const spriteModule = { Sprite: ({ id }: { id: string }) => createElement('div', { 'data-sprite': id }) };

/** Puts every stand-in back as it was found, for the next test. */
export function resetFakes(): void {
  for (const spy of Object.values(router)) spy.mockReset();
  device.languages = ['en'];
  device.timeZone = 'UTC';
  kv.clear();
  heard.length = 0;
  Object.assign(insets, { top: 0, bottom: 0, left: 0, right: 0 });
}
