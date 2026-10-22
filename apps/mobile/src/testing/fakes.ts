import { createContext, createElement, useEffect, useState, type ComponentType, type ReactNode } from 'react';
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
/** The path of the screen in front, as the router says it (`usePathname`). */
export const pathname = { now: '/' };
export const expoRouter = {
  useRouter: () => router,
  usePathname: () => pathname.now,
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

/**
 * Whether the app is in front, as React Native's AppState says it: in front, unless a test sends it away (`appState.set('background')`), and every
 * listener told of each change, as the phone tells them.
 */
export const appState = {
  currentState: 'active' as 'active' | 'background' | 'inactive',
  listeners: new Set<(state: string) => void>(),
  set(next: 'active' | 'background' | 'inactive') {
    appState.currentState = next;
    for (const listener of [...appState.listeners]) listener(next);
  },
};
export const appStateModule = {
  get currentState() {
    return appState.currentState;
  },
  addEventListener(_event: 'change', listener: (state: string) => void) {
    appState.listeners.add(listener);
    return { remove: () => void appState.listeners.delete(listener) };
  },
};

/** The phone's connection, as expo-network tells it: there, unless a test takes it away (`network.set(false)`); every listener is told of a change. */
export const network = {
  connected: true,
  listeners: new Set<(state: { isConnected: boolean; isInternetReachable: boolean }) => void>(),
  set(connected: boolean) {
    network.connected = connected;
    for (const listener of [...network.listeners]) listener({ isConnected: connected, isInternetReachable: connected });
  },
};
export const expoNetwork = {
  getNetworkStateAsync: async () => ({ isConnected: network.connected, isInternetReachable: network.connected }),
  addNetworkStateListener(listener: (state: { isConnected: boolean; isInternetReachable: boolean }) => void) {
    network.listeners.add(listener);
    return { remove: () => void network.listeners.delete(listener) };
  },
};

/** How the system's browser comes back: to an address, or closed (by the player, or for them: the system took it away). */
export type BrowserAnswer = { type: 'success'; url: string } | { type: 'cancel' | 'dismiss' };
/**
 * The system's browser, opened for Google: it keeps what it was opened with, and comes back as a test says: with the answers `queued`, one to each
 * opening in turn (a promise is a browser held open until the test settles it), and then with `answer` (closed, unless told otherwise).
 */
export const authBrowser = {
  opened: [] as Array<{ url: string; redirect: string }>,
  answer: { type: 'cancel' } as BrowserAnswer,
  queued: [] as Array<BrowserAnswer | Promise<BrowserAnswer>>,
  /**
   * Android's auth session (expo-web-browser's own): a trip that has come back is still held as open until the app is `active` again, and let go a
   * turn after; an opening before then is refused ("WebBrowser is already open"). Off, unless a test turns it on.
   */
  android: false,
  /** Held by a trip that came back, as above. */
  held: false,
  /** The openings refused while held. */
  refused: 0,
  /** Held for this many more `active`s than Android would hold it (a browser that does not let go): a test of an opening refused twice. */
  stubborn: 0,
};
export const expoWebBrowser = {
  openAuthSessionAsync: async (url: string, redirect: string): Promise<BrowserAnswer> => {
    if (authBrowser.held) {
      authBrowser.refused += 1;
      throw new Error('WebBrowser is already open, only one can be open at a time');
    }
    authBrowser.opened.push({ url, redirect });
    const answer = await (authBrowser.queued.shift() ?? authBrowser.answer);
    if (authBrowser.android) {
      authBrowser.held = true;
      const letGo = (state: string) => {
        if (state !== 'active') return;
        if (authBrowser.stubborn > 0) {
          authBrowser.stubborn -= 1;
          return;
        }
        appState.listeners.delete(letGo);
        void Promise.resolve().then(() => (authBrowser.held = false));
      };
      appState.listeners.add(letGo);
    }
    return answer;
  },
};

/** The app's own description, as expo-constants reads it from app.json. */
export const expoConstants = { default: { expoConfig: { version: '1.0.0' } } };

/** What the phone's key-value store holds, by key: the game, the runs, the profile, the language and the basket are all in it. */
export const kv = new Map<string, string>();
export const expoKeyValueStore = {
  default: {
    getItem: (key: string) => Promise.resolve(kv.get(key) ?? null),
    setItem: (key: string, value: string) => Promise.resolve(void kv.set(key, value)),
    removeItem: (key: string) => Promise.resolve(kv.delete(key)),
    getAllKeys: () => Promise.resolve([...kv.keys()]),
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
 * Sprites are drawn with Skia on the phone only: here each is a box that names its id, says if it is only the shape of the picture or drawn in
 * grey, and the box it is drawn into where it is given one (`size`, as `w x h`); what is drawn over the picture in its canvas (the rainbow of a
 * legendary card) is drawn inside it. The stage's scale of the art (`ArtScale`) is the phone's: one point an art pixel.
 */
export const spriteModule = {
  Sprite: ({ id, silhouette, grey, size, children }: { id: string; silhouette?: boolean; grey?: boolean; size?: { w: number; h: number }; children?: ReactNode }) => {
    spriteRenders.set(id, (spriteRenders.get(id) ?? 0) + 1);
    return createElement('div', { 'data-sprite': id, ...(silhouette ? { 'data-silhouette': 'true' } : null), ...(grey ? { 'data-grey': 'true' } : null), ...(size ? { 'data-size': `${size.w}x${size.h}` } : null) }, children);
  },
  /** Pictures laid on one canvas: here a box of each, named by its id, in order, with its box and its grey as a `Sprite`'s says them. */
  SpriteLayers: ({ layers }: { layers: ReadonlyArray<{ id: string; w: number; h: number; grey?: boolean }> }) =>
    createElement(
      'div',
      { 'data-layers': 'true' },
      ...layers.map((layer, i) => {
        spriteRenders.set(layer.id, (spriteRenders.get(layer.id) ?? 0) + 1);
        return createElement('div', { key: `${i}:${layer.id}`, 'data-sprite': layer.id, 'data-size': `${layer.w}x${layer.h}`, ...(layer.grey ? { 'data-grey': 'true' } : null) });
      }),
    ),
  /** A loop's frames on one canvas: here a box of each frame's, named by its id, in order. */
  SpriteStrip: ({ ids, frame }: { ids: readonly string[]; frame: { w: number; h: number } }) =>
    createElement('div', { 'data-strip': 'true' }, ...ids.map((id) => createElement('div', { key: id, 'data-sprite': id, 'data-size': `${frame.w}x${frame.h}` }))),
  ArtScale: createContext(1),
  /** How a picture is sampled on a canvas drawn by hand (a rat's layers): here only what it says. */
  PIXELATED: { filter: 0, mipmap: 0 },
};

/** The phone's files, as the game writes them (the picture of a life, in the cache): by their address, what was written there last. */
export const files = new Map<string, Uint8Array | string>();
/** The folders of the phone's files that exist, by their address (ending in `/`): the cache is always there. */
export const folders = new Set<string>(['file:///cache/']);
/**
 * The phone's file system, as the share card reaches it: a folder of the cache (made, emptied by deleting it), and a file in it, made (in place of one
 * of that name, when told) and written.
 */
export const expoFileSystem = {
  Paths: { cache: { uri: 'file:///cache/' } },
  Directory: class {
    readonly uri: string;
    constructor(parent: { uri: string }, name: string) {
      this.uri = `${parent.uri}${name}/`;
    }
    get exists(): boolean {
      return folders.has(this.uri);
    }
    create(options: { intermediates?: boolean; idempotent?: boolean } = {}): void {
      if (folders.has(this.uri) && options.idempotent !== true) throw new Error(`a folder is already at ${this.uri}`);
      folders.add(this.uri);
    }
    delete(): void {
      if (!folders.delete(this.uri)) throw new Error(`no folder at ${this.uri}`);
      for (const uri of [...files.keys()]) if (uri.startsWith(this.uri)) files.delete(uri);
    }
  },
  File: class {
    readonly uri: string;
    constructor(directory: { uri: string }, name: string) {
      this.uri = `${directory.uri}${name}`;
    }
    create(options: { overwrite?: boolean } = {}): void {
      if (!folders.has(this.uri.slice(0, this.uri.lastIndexOf('/') + 1))) throw new Error(`no folder for ${this.uri}`);
      if (files.has(this.uri) && options.overwrite !== true) throw new Error(`a file is already at ${this.uri}`);
      files.set(this.uri, new Uint8Array());
    }
    async write(content: Uint8Array | string): Promise<void> {
      files.set(this.uri, content);
    }
  },
};
/** The phone's share sheet: whether there is one, and every file it was handed, in order, with what it was told of it. */
export const shareSheet = { available: true, fails: false, handed: [] as Array<{ url: string; options?: Record<string, unknown> }> };
export const expoSharing = {
  isAvailableAsync: () => Promise.resolve(shareSheet.available),
  shareAsync: (url: string, options?: Record<string, unknown>) => (shareSheet.fails ? Promise.reject(new Error('the share sheet would not open')) : Promise.resolve(void shareSheet.handed.push({ url, options }))),
};
/** The phone's clipboard (expo-clipboard, `ui/copy.ts`): what was last put on it, and whether it takes it (a phone's always does; a test can say no). */
export const clipboard = { text: null as string | null, refuses: false };
/**
 * The WebViews on screen (react-native-webview: the captcha's page, online/captcha.tsx), each with the props it was last drawn with, in the order they
 * were mounted: a test reads the page it was handed and answers through its `onMessage`, as the page would. Nothing is loaded.
 */
export const webViews: Array<{ props: Record<string, unknown> & { onMessage?(event: { nativeEvent: { data: string; url: string } }): void } }> = [];
function FakeWebView(props: Record<string, unknown>) {
  const [me] = useState(() => ({ props }));
  me.props = props;
  useEffect(() => {
    webViews.push(me);
    return () => {
      const at = webViews.indexOf(me);
      if (at >= 0) webViews.splice(at, 1);
    };
  }, [me]);
  return createElement('div', { 'data-webview': 'true' });
}
export const reactNativeWebView = { __esModule: true, default: FakeWebView, WebView: FakeWebView };

export const expoClipboard = {
  setStringAsync: async (text: string): Promise<boolean> => {
    if (clipboard.refuses) return false;
    clipboard.text = text;
    return true;
  },
};

/**
 * The phone's photos (expo-media-library): whether the player allows the app to add to them (the system's question, answered), whether saving
 * fails, what was asked (`writeOnly` and, on Android, the kinds of media), and the files saved there, in order.
 */
export const photos = {
  allows: true,
  fails: false,
  asked: [] as Array<{ writeOnly: boolean | undefined; granular: string[] | undefined }>,
  saved: [] as string[],
  /** A save held until this is let go (a phone slow to save), where a test sets one. */
  held: null as Promise<void> | null,
};
export const expoMediaLibrary = {
  requestPermissionsAsync: (writeOnly?: boolean, granular?: string[]) => {
    photos.asked.push({ writeOnly, granular });
    return Promise.resolve({ granted: photos.allows, status: photos.allows ? 'granted' : 'denied', canAskAgain: true, expires: 'never' });
  },
  Asset: {
    create: async (filePath: string) => {
      if (photos.held) await photos.held;
      if (photos.fails) throw new Error('the phone could not save it');
      photos.saved.push(filePath);
      return { id: `asset-${photos.saved.length}` };
    },
  },
};

/**
 * A list that draws only the rows near the screen (React Native's `FlatList`, the kit's `ListScreen`) windows them by the layout the phone measures;
 * jsdom lays nothing out, so it would draw its first ten and never another. Here it draws every row at once, as the phone has once each has been
 * scrolled to: what a test reads of a list is the whole of it. (The kit's own test of `ListScreen`, which has none of these stand-ins, holds that
 * the real one windows.)
 */
export function everyRow<P extends { data?: ArrayLike<unknown> | null; initialNumToRender?: number | null }>(List: ComponentType<P>): ComponentType<P> {
  return function EveryRow(props: P) {
    return createElement(List, { ...props, initialNumToRender: Math.max(10, props.initialNumToRender ?? 0, props.data?.length ?? 0) });
  };
}

/**
 * What the app keeps of a stand-in for as long as it lasts (the phone's one listening to its connection, `online/page.ts`), put back with them:
 * handed in by `setup.ts`, because this file cannot import the app's modules that import the stand-ins it makes.
 */
const alsoReset: Array<() => void> = [];
export const resetAlso = (reset: () => void): void => void alsoReset.push(reset);

/** Puts every stand-in back as it was found, for the next test. */
export function resetFakes(): void {
  for (const reset of alsoReset) reset();
  for (const spy of Object.values(router)) spy.mockReset();
  backListeners.length = 0;
  device.languages = ['en'];
  device.timeZone = 'UTC';
  for (const key of Object.keys(params)) delete params[key];
  pathname.now = '/';
  kv.clear();
  appState.currentState = 'active';
  appState.listeners.clear();
  network.connected = true;
  network.listeners.clear();
  authBrowser.opened.length = 0;
  authBrowser.answer = { type: 'cancel' };
  authBrowser.queued.length = 0;
  Object.assign(authBrowser, { android: false, held: false, refused: 0, stubborn: 0 });
  heard.length = 0;
  spriteRenders.clear();
  Object.assign(insets, { top: 0, bottom: 0, left: 0, right: 0 });
  files.clear();
  folders.clear();
  folders.add('file:///cache/');
  shareSheet.available = true;
  shareSheet.fails = false;
  shareSheet.handed.length = 0;
  Object.assign(photos, { allows: true, fails: false, held: null });
  photos.asked.length = 0;
  photos.saved.length = 0;
  painted.reset();
  Object.assign(clipboard, { text: null, refuses: false });
  webViews.length = 0;
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
