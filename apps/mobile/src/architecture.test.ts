import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * The web's wall (apps/web/src/architecture.test.ts), on the phone: a screen talks to the game through `GameSession`
 * (the game context) and to nothing else: never the engine's moves, the device's store or the session's internals, nor
 * the cloud. So the game can move to a server later and no screen changes.
 *
 * As on the web, the app and the core are read as one tree: `@ratrace/core/session/local` is `@/session/local`, and a
 * file of the app is `@/<its path under src>`.
 */
const SRC = fileURLToPath(new URL('.', import.meta.url));
const CORE = fileURLToPath(new URL('../../../packages/core/src', import.meta.url));
const ROOTS = [SRC, CORE];

const rootOf = (path: string) => ROOTS.find((dir) => !relative(dir, path).startsWith('..')) as string;
const rel = (path: string) => relative(rootOf(path), path);

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return filesUnder(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

/** Where an import leads, as the rules name places: a path beside the file, or one into the core, becomes its `@/` path. */
function placeOf(path: string, from: string): string {
  if (from.startsWith('@ratrace/core/')) return `@/${from.slice('@ratrace/core/'.length)}`;
  if (!from.startsWith('.')) return from;
  const target = relative(rootOf(path), join(dirname(path), from));
  return target.startsWith('..') ? from : `@/${target}`;
}

/**
 * Everything a file imports, however it is written: an import statement, a late `import()`, an import for its effects
 * alone, and Metro's `require()` (how the phone loads an asset, a font, or a module only when it is needed). `typeOnly`
 * is an `import type`: it leaves nothing in the app.
 */
function importsIn(path: string, source: string): Array<{ names: string; from: string; typeOnly: boolean }> {
  const named = [...source.matchAll(/import\s+(type\s+)?([^;'"]*?)\s+from\s+['"]([^'"]+)['"]/g)].map((m) => ({ names: m[2], from: m[3], typeOnly: m[1] !== undefined }));
  const late = [...source.matchAll(/\bimport\(\s*['"]([^'"]+)['"]\s*\)/g)].map((m) => ({ names: '*', from: m[1], typeOnly: false }));
  const bare = [...source.matchAll(/(?:^|[;\n])\s*import\s+['"]([^'"]+)['"]/g)].map((m) => ({ names: '', from: m[1], typeOnly: false }));
  const required = [...source.matchAll(/(?:const\s+([^=]+?)\s*=\s*)?\brequire\(\s*['"]([^'"]+)['"]\s*\)/g)].map((m) => ({ names: m[1] ?? '*', from: m[2], typeOnly: false }));
  return [...named, ...late, ...bare, ...required].map((one) => ({ ...one, from: placeOf(path, one.from) }));
}
const importsOf = (path: string) => importsIn(path, readFileSync(path, 'utf8'));

const all = ROOTS.flatMap((dir) => filesUnder(dir));
const mine = all.filter((path) => rootOf(path) === SRC);
/** What draws the game: the routes, the kit and the screens. The session and the one file that wires it are behind the wall. */
const screens = mine.filter((path) => /^(app|ui|game\/screens)\//.test(rel(path)));
const MOVES = /\b(applyCard|applyCards|applyRound|createGame)\b/;

/** A file by the place the rules name it, in whichever tree it lives. */
const fileAt = (place: string) => all.find((path) => rel(path) === place) as string;
/** What a screen may not take of the round store: anything but its types. The store is built where the game is wired, and read through `useGame`. */
const takesStoreInternals = (path: string, source: string): string[] =>
  importsIn(path, source).filter((i) => i.from === '@/game/store' && !i.typeOnly).map((i) => `${i.names} from the round store`);

/** What a screen may not reach on the device: the phone's stores, a browser's, and the session's internals (its types are free). */
const DEVICE = /^(expo-sqlite(\/.*)?|expo-secure-store|expo-file-system(\/.*)?|@react-native-async-storage\/.*|idb|fake-indexeddb|@\/kvStore)$/;
const touchesDevice = (path: string, source: string): string[] =>
  importsIn(path, source)
    .filter(({ from }) => DEVICE.test(from) || /^@\/session\/(?!types$)/.test(from))
    .map(({ from }) => `imports ${from}`);

/**
 * What a file takes of the cloud that it may not: the client library anywhere; more than the package's types (`@ratrace/online/*`) anywhere but
 * the phone's cloud (`online/*`) and the game context that wires it; and, in a screen, the phone's cloud itself.
 */
function reachesCloud(path: string, source: string): string[] {
  const place = rel(path);
  const wiring = place.startsWith('online/') || place === 'game/context.tsx';
  const screen = /^(app|ui|game\/screens)\//.test(place);
  return importsIn(path, source)
    .filter((i) => /^@supabase\//.test(i.from) || (!wiring && !i.typeOnly && /^@ratrace\/online(\/.*)?$/.test(i.from)) || (screen && /^@\/online(\/.*)?$/.test(i.from)))
    .map((i) => `${place}: ${i.from}`);
}

/** Every storage of the device, by name: the phone's SQLite and AsyncStorage, the browser's three. */
const namesStorage = (source: string): boolean => /\b(expo-sqlite|AsyncStorage|localStorage|sessionStorage|indexedDB)\b/.test(source);
/** The only files that may name one: the phone's store, the context that wires it into the game, and the stand-in for the phone's store in tests. */
const STORAGE_FILES = [join(SRC, 'kvStore.ts'), join(SRC, 'game/context.tsx'), join(SRC, 'testing/setup.ts')];

/** What reaches out of the phone: a request, a socket, a stream of events, a beacon. */
const SENDS = /\bfetch\s*\(|\bXMLHttpRequest\b|\bWebSocket\b|\bEventSource\b|\bsendBeacon\b/;
/** The rules the app plays older lives under (`src/rules/v*.js`, the engine and content of a shipped version): code the app runs too. */
const RULES = join(SRC, 'rules');
const bundles = readdirSync(RULES).filter((name) => name.endsWith('.js')).map((name) => join(RULES, name));
const REPO = fileURLToPath(new URL('../../..', import.meta.url));
/** The packages the app carries besides the core: the rules (engine), what they run on (content), the interface's words (i18n), the client of the servers (online). */
const CARRIED = ['engine', 'content', 'i18n', 'online'].map((name) => join(REPO, 'packages', name, 'src'));

/** Every file of code under `dir` that is not a test: TypeScript, and JavaScript of any kind (a bundle, or a stray `.js` beside the `.ts`). */
function codeUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return codeUnder(path);
    return /\.(tsx?|jsx?|mjs|cjs)$/.test(name) && !/\.test\.(tsx?|jsx?|mjs|cjs)$/.test(name) ? [path] : [];
  });
}
/** All the code the app runs or bundles: its own (the rules' bundles among it), the core's, and the packages it carries. */
const shipped = [SRC, CORE, ...CARRIED].flatMap(codeUnder);

describe('the wall between the phone\'s screens and the game', () => {
  it('sees an import however it is written', () => {
    const screen = join(SRC, 'game/screens/Anything.tsx');
    const found = (source: string) => importsIn(screen, source).map((one) => one.from);
    expect(found("import { KvStore } from '../../kvStore';")).toEqual(['@/kvStore']);
    expect(found("import type { Profile } from '@ratrace/core/session/types';")).toEqual(['@/session/types']);
    expect(found("const { LocalSessions } = await import('@ratrace/core/session/local');")).toEqual(['@/session/local']);
    expect(found("import 'expo-sqlite/kv-store';\nimport './Home';")).toEqual(['expo-sqlite/kv-store', '@/game/screens/Home']);
    expect(found("const { MemoryStore } = require('@ratrace/core/session/memory') as typeof import('x');")).toContain('@/session/memory');
    expect(importsIn(screen, "import {\n  applyRound,\n} from '@ratrace/engine';")[0].names).toContain('applyRound');
  });

  it('sees the core as the tree it came from', () => {
    expect(placeOf(join(SRC, 'game/screens/Anything.tsx'), '@ratrace/core/session/local')).toBe('@/session/local');
    expect(placeOf(join(CORE, 'game/store.ts'), '../session/memory')).toBe('@/session/memory');
    expect(placeOf(join(SRC, 'game/context.tsx'), '../kvStore')).toBe('@/kvStore');
    expect(rel(fileAt('game/present.ts'))).toBe('game/present.ts');
    expect(rootOf(fileAt('game/present.ts'))).toBe(CORE);
    expect(rootOf(fileAt('game/context.tsx'))).toBe(SRC);
  });

  it('finds the screens', () => {
    const names = screens.map(rel);
    for (const screen of ['app/_layout.tsx', 'app/index.tsx', 'app/kit.tsx', 'ui/kit.tsx', 'ui/Page.tsx', 'game/screens/Records.tsx']) expect(names).toContain(screen);
  });

  it('lets no screen change the game except through the session', () => {
    const broke = screens.flatMap((path) => importsOf(path).filter((i) => i.from === '@ratrace/engine' && MOVES.test(i.names)).map((i) => `${rel(path)}: ${i.names}`));
    expect(broke).toEqual([]);
  });

  it('lets the round store reach the game only through the session too', () => {
    for (const file of ['game/store.ts', 'game/present.ts', 'game/context.tsx']) {
      expect(fileAt(file), file).toBeDefined();
      const broke = importsOf(fileAt(file)).filter((i) => i.from === '@ratrace/engine' && MOVES.test(i.names));
      expect(broke, file).toEqual([]);
    }
  });

  it('lets no screen take anything of the round store but its types: the store is built where the game is wired, and read through useGame', () => {
    const screen = join(SRC, 'game/screens/Anything.tsx');
    expect(takesStoreInternals(screen, "import { createGameStore } from '@ratrace/core/game/store';")).toEqual(['{ createGameStore } from the round store']);
    expect(takesStoreInternals(screen, "import { PENDING_AFTER_MS, type Stage } from '@ratrace/core/game/store';")).toEqual(['{ PENDING_AFTER_MS, type Stage } from the round store']);
    expect(takesStoreInternals(screen, "const { createGameStore } = require('@ratrace/core/game/store');")).toEqual(['{ createGameStore } from the round store']);
    expect(takesStoreInternals(screen, "const { createGameStore } = await import('@ratrace/core/game/store');")).toEqual(['* from the round store']);
    expect(takesStoreInternals(screen, "import type { Stage } from '@ratrace/core/game/store';")).toEqual([]);
    expect(takesStoreInternals(screen, "import { useGame } from '@/game/context';\nimport { orderLabel } from '@ratrace/core/game/present';")).toEqual([]);
    expect(screens.flatMap((path) => takesStoreInternals(path, readFileSync(path, 'utf8')).map((one) => `${rel(path)}: ${one}`))).toEqual([]);
  });

  it('lets no screen touch the device: no store of the phone, no session internals', () => {
    const screen = join(SRC, 'game/screens/Anything.tsx');
    expect(touchesDevice(screen, "import 'expo-sqlite/kv-store';\nimport './Home';")).toEqual(['imports expo-sqlite/kv-store']);
    expect(touchesDevice(screen, "import Storage from 'expo-sqlite';")).toEqual(['imports expo-sqlite']);
    expect(touchesDevice(screen, "import AsyncStorage from '@react-native-async-storage/async-storage';")).toEqual(['imports @react-native-async-storage/async-storage']);
    expect(touchesDevice(screen, "import { KvStore } from '../../kvStore';")).toEqual(['imports @/kvStore']);
    expect(touchesDevice(screen, "const { LocalSessions } = await import('@ratrace/core/session/local');")).toEqual(['imports @/session/local']);
    expect(touchesDevice(screen, "import { openDB } from 'idb';")).toEqual(['imports idb']);
    expect(touchesDevice(screen, "import type { Profile } from '@ratrace/core/session/types';\nimport './Home';")).toEqual([]);
    const broke = screens.flatMap((path) => touchesDevice(path, readFileSync(path, 'utf8')).map((one) => `${rel(path)} ${one}`));
    expect(broke).toEqual([]);
  });

  it('keeps every storage of the device in three files: the phone\'s store, the game context that wires it, and the tests\' stand-in for the phone\'s store', () => {
    expect(namesStorage("import Storage from 'expo-sqlite/kv-store';")).toBe(true);
    expect(namesStorage("await AsyncStorage.getItem('x');")).toBe(true);
    expect(namesStorage("const saved = localStorage.getItem('x');")).toBe(true);
    expect(namesStorage("sessionStorage.clear();")).toBe(true);
    expect(namesStorage("indexedDB.open('x');")).toBe(true);
    expect(namesStorage("const storage = props.storage; // an IndexedDB on the web")).toBe(false);
    expect(STORAGE_FILES.map((file) => relative(SRC, file))).toEqual(['kvStore.ts', 'game/context.tsx', 'testing/setup.ts']);
    expect(all.filter((path) => namesStorage(readFileSync(path, 'utf8'))).filter((path) => !STORAGE_FILES.includes(path)).map(rel)).toEqual([]);
    // The two that may name it do (a rule that finds nothing in them would find nothing anywhere).
    expect(namesStorage(readFileSync(STORAGE_FILES[0], 'utf8'))).toBe(true);
  });

  it('keeps the account\'s session in the phone\'s store, under its own keys, and hands the client no other', () => {
    // The client is made in one file of the phone, with the store's session for its storage, and renews the session only when told to.
    const connecting = all.filter((path) => /\bconnectSupabase\s*\(/.test(readFileSync(path, 'utf8'))).map(rel);
    expect(connecting).toEqual(['online/index.ts']);
    const online = readFileSync(join(SRC, 'online/index.ts'), 'utf8');
    expect(online).toMatch(/connectSupabase\(url, key, \{[^}]*\bstorage: kvSession\b[^}]*\bautoRefresh: false\b[^}]*\}\)/);
    expect(importsOf(join(SRC, 'online/index.ts')).find((i) => i.from === '@/kvStore')?.names).toMatch(/\bkvSession\b/);
    expect(readFileSync(STORAGE_FILES[0], 'utf8')).toMatch(/export const kvSession\b/);
  });

  it('lets only the tests and their stand-ins (testing/*) name what is there for them alone: nothing the app runs starts its cloud, its game or its connection anew', () => {
    const TEST_ONLY: Record<string, string> = { forgetThePhone: 'online/index.ts', forgetTheGame: 'game/context.tsx', forgetConnection: 'online/page.ts' };
    for (const [name, home] of Object.entries(TEST_ONLY)) {
      const word = () => new RegExp(`\\b${name}\\b`, 'g');
      const naming = mine.filter((path) => !rel(path).startsWith('testing/') && word().test(readFileSync(path, 'utf8'))).map(rel);
      expect(naming, name).toEqual([home]);
      // Where it is made, it is only made: nothing there calls it.
      expect(readFileSync(join(SRC, home), 'utf8').match(word()), name).toHaveLength(1);
    }
  });

  it('keeps the engine and the content out of the phone\'s store', () => {
    const imports = importsOf(join(SRC, 'kvStore.ts')).map((i) => i.from);
    expect(imports).toContain('expo-sqlite/kv-store');
    expect(imports).not.toContain('@ratrace/engine');
    expect(imports).not.toContain('@ratrace/content');
  });

  it('lets no screen judge a badge, an unlock or what a life adds to the profile', () => {
    const JUDGES = /\b(badgesEarned|galleryBadges|unlockedLives|journalAfter|journalStart|profileAfter|recordStep)\b/;
    const broke = screens.flatMap((path) => importsOf(path).filter((i) => JUDGES.test(i.names)).map((i) => `${rel(path)}: ${i.names}`));
    expect(broke).toEqual([]);
  });

  it('wires the real session and the phone\'s store in one place', () => {
    const wires = mine.filter((path) => importsOf(path).some((i) => /^@\/session\/(local|memory|resilient)$/.test(i.from) || i.from === '@/kvStore')).map(rel);
    // The others: the basket (game/phoneBasket.ts) keeps the orders of the round in the phone's store, beside the life it
    // belongs to; the memory services (testing/memoryServices.ts) stand in for the context's services, as the web's do, for
    // the tests' render and for the route that draws a scene; and the development page's fixture (testing/olderLife.ts)
    // writes a life straight into the phone's store to see it finished under older rules. Development only; the one route
    // that reaches each of those two is its own: the development page for the fixture, the scene page for the scenes (which
    // reach the memory services through testing/scene.tsx, never the session itself).
    // And the timing probe's long life (testing/perfLife.ts), put on the phone by the probe's own route, in a build made with EXPO_PUBLIC_PERF=1 only
    // (ui/perf.test.ts holds that a build without the flag has none of it).
    // And the phone's cloud (online/index.ts), which keeps the account's session and the lists of lives the account is still to be told of in the
    // phone's store, as the web's keeps them in the browser's.
    expect(wires.sort()).toEqual(['game/context.tsx', 'game/phoneBasket.ts', 'online/index.ts', 'testing/memoryServices.ts', 'testing/olderLife.ts', 'testing/perfLife.ts']);
    expect(mine.filter((path) => importsOf(path).some((i) => i.from === '@/testing/olderLife')).map(rel)).toEqual(['app/dev.tsx']);
    expect(mine.filter((path) => importsOf(path).some((i) => i.from === '@/testing/perfLife')).map(rel)).toEqual(['app/perf.tsx']);
    expect(mine.filter((path) => importsOf(path).some((i) => i.from === '@/testing/scene')).map(rel)).toEqual(['app/scene.tsx']);
  });

  it('lets no screen reach the cloud, and only the phone\'s cloud (online/*) and the game context that wires it may ever take more of it than its types', () => {
    const screen = join(SRC, 'game/screens/Anything.tsx');
    expect(reachesCloud(screen, "import { connectSupabase } from '@ratrace/online/connect';")).toEqual(['game/screens/Anything.tsx: @ratrace/online/connect']);
    expect(reachesCloud(join(SRC, 'game/helper.ts'), "const { follow } = require('@ratrace/online/follow');")).toEqual(['game/helper.ts: @ratrace/online/follow']);
    expect(reachesCloud(join(SRC, 'ui/Thing.tsx'), "import type { Account } from '@ratrace/online/types';\nimport type { Cloud } from '@ratrace/online/supabase';")).toEqual([]);
    expect(reachesCloud(screen, "import type { Session } from '@supabase/supabase-js';")).toEqual(['game/screens/Anything.tsx: @supabase/supabase-js']);
    expect(reachesCloud(join(SRC, 'online/index.ts'), "import { connectSupabase } from '@ratrace/online/connect';")).toEqual([]);
    expect(reachesCloud(join(SRC, 'game/context.tsx'), "import { phoneOnline } from '../online';\nimport { follow } from '@ratrace/online/follow';")).toEqual([]);
    // A screen that takes the phone's cloud itself reaches it as much as one that takes the package.
    expect(reachesCloud(screen, "import { phoneOnline } from '../../online';")).toEqual(['game/screens/Anything.tsx: @/online']);
    expect(mine.flatMap((path) => reachesCloud(path, readFileSync(path, 'utf8')))).toEqual([]);
    // The rule finds what it is there for: the phone's cloud does take the package.
    expect(mine.filter((path) => rel(path).startsWith('online/') && importsOf(path).some((i) => !i.typeOnly && i.from.startsWith('@ratrace/online/'))).map(rel)).toContain('online/index.ts');
    // And the client library is named in no file of the phone or the core: only `@ratrace/online/connect` loads it.
    const named = all.filter((path) => importsOf(path).some((i) => i.from === '@supabase/supabase-js') || /import\('@supabase\/supabase-js'\)/.test(readFileSync(path, 'utf8'))).map(rel);
    expect(named).toEqual([]);
  });

  it('sends only what it means to: the game\'s servers, through the Supabase client (`@ratrace/online/connect`); a development scene telling the shots\' driver, on this machine, that it is ready; and the timing probe\'s, in its own build only', () => {
    expect(SENDS.test("const res = await fetch('https://example.com');")).toBe(true);
    expect(SENDS.test('const socket = new WebSocket(url);')).toBe(true);
    expect(SENDS.test('const request = new XMLHttpRequest();')).toBe(true);
    expect(SENDS.test('navigator.sendBeacon(url, body);')).toBe(true);
    expect(SENDS.test('new EventSource(url);')).toBe(true);
    // A word that only names one is not one.
    expect(SENDS.test('// what is fetched from the device: the profile')).toBe(false);
    expect(SENDS.test('const prefetched = rules.prefetch;')).toBe(false);
    // Read: everything of the app's own, any JavaScript in it (the rules' bundles, or a file that is not TypeScript), the core, and the engine, content
    // and words it carries.
    expect(bundles.length).toBeGreaterThan(0);
    expect(shipped).toEqual(expect.arrayContaining([...all, ...bundles]));
    for (const dir of CARRIED) expect(shipped.some((path) => path.startsWith(dir)), relative(REPO, dir)).toBe(true);
    expect(shipped.some((path) => path.endsWith('.json'))).toBe(false);
    const sending = shipped.filter((path) => SENDS.test(readFileSync(path, 'utf8'))).map((path) => relative(REPO, path));
    expect(sending.sort()).toEqual(['apps/mobile/src/testing/scene.tsx', 'apps/mobile/src/ui/perfProbe.tsx', 'packages/online/src/connect.ts']);
    // The Supabase client's: every request the client makes, through the one `fetch` it is handed (with a time it may take), and nothing else of the
    // package's own. The client itself is loaded by that file alone (the test above).
    const client = readFileSync(join(REPO, 'packages/online/src/connect.ts'), 'utf8');
    expect([...client.matchAll(/\bfetch\s*\(/g)]).toHaveLength(1);
    expect(client).toContain('const patient: typeof fetch = (input, init) => fetch(input, {');
    expect(client).toContain("await import('@supabase/supabase-js')");
    // The timing probe's, in a build made with EXPO_PUBLIC_PERF=1 only (ui/perf.test.ts: any other build has none of it): its lines to the collector on
    // this machine, one request.
    const probe = readFileSync(join(SRC, 'ui/perfProbe.tsx'), 'utf8');
    expect([...probe.matchAll(/\bfetch\s*\(/g)]).toHaveLength(1);
    expect(probe).toContain("export const COLLECTOR = 'http://127.0.0.1:8095/perf';");
    expect(probe).toContain('void fetch(COLLECTOR,');
    // That one: one request, to this machine only, with the address of the scene's own route; the route that draws a scene is for development only
    // (scripts/scenePages.test.ts) and says nothing unless it is opened for a shot.
    const scene = readFileSync(join(SRC, 'testing/scene.tsx'), 'utf8');
    expect([...scene.matchAll(/\bfetch\s*\(/g)]).toHaveLength(1);
    expect(scene).toContain('fetch(`http://127.0.0.1:${port}/ready?name=');
    expect(scene).toContain('if (port === undefined) return;');
  });

  it('lets one file only show a web page (react-native-webview), the captcha\'s (online/captcha.tsx): a page is a place that reaches the network', () => {
    // The library named however it is taken (an import, a type, a `require`, a late `import()`, a file of it), or the component drawn.
    const showsPage = (source: string): boolean => /['"]react-native-webview(\/[^'"]*)?['"]/.test(source) || /<WebView\b/.test(source);
    expect(showsPage("import WebView from 'react-native-webview';")).toBe(true);
    expect(showsPage("import type { WebViewMessageEvent } from 'react-native-webview';")).toBe(true);
    expect(showsPage("const { WebView } = require('react-native-webview');")).toBe(true);
    expect(showsPage("const lib = await import('react-native-webview/lib/WebView');")).toBe(true);
    expect(showsPage('return <WebView source={{ uri }} />;')).toBe(true);
    // A word that only names one is not one.
    expect(showsPage('// the captcha shows its page in a web view, react-native-webview')).toBe(false);
    const showing = shipped.filter((path) => showsPage(readFileSync(path, 'utf8'))).map((path) => relative(REPO, path));
    // And the tests' stand-in for the library (testing/setup.ts), which draws no page.
    expect(showing).toEqual(['apps/mobile/src/online/captcha.tsx', 'apps/mobile/src/testing/setup.ts']);
    // And that page is the game's site's own, with Turnstile's script in it, and nothing it may leave for.
    const captcha = readFileSync(join(SRC, 'online/captcha.tsx'), 'utf8');
    expect(captcha).toContain("export const TURNSTILE_SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';");
    expect(captcha).toContain('onShouldStartLoadWithRequest={mayLoad}');
    // Every load put to that gate: the library opens with the phone what its own list turns away.
    expect(captcha).toContain("originWhitelist={['*']}");
    expect(captcha).toContain('baseUrl: `${site()}/`');
  });

  it('lets one file only reach the phone\'s notices (expo-notifications), the push\'s (online/push.ts): what asks the player, holds the token and opens a tap\'s link', () => {
    // The library named however it is taken (an import, a type, a `require`, a late `import()`, a file of it).
    const reachesNotices = (source: string): boolean => /['"]expo-notifications(\/[^'"]*)?['"]/.test(source);
    expect(reachesNotices("import * as Notifications from 'expo-notifications';")).toBe(true);
    expect(reachesNotices("import type { NotificationResponse } from 'expo-notifications';")).toBe(true);
    expect(reachesNotices("const { getExpoPushTokenAsync } = require('expo-notifications');")).toBe(true);
    expect(reachesNotices("const tokens = await import('expo-notifications/build/getExpoPushTokenAsync');")).toBe(true);
    // A word that only names one is not one.
    expect(reachesNotices('// the notices come through expo-notifications, in online/push.ts')).toBe(false);
    const reaching = shipped.filter((path) => reachesNotices(readFileSync(path, 'utf8'))).map((path) => relative(REPO, path));
    // And the tests' stand-in for the library (testing/setup.ts).
    expect(reaching).toEqual(['apps/mobile/src/online/push.ts', 'apps/mobile/src/testing/setup.ts']);
    // The push opens only what `pageOf` lets through, and takes no store of the phone's: its note is handed in by the game's context.
    const push = readFileSync(join(SRC, 'online/push.ts'), 'utf8');
    expect(push).toMatch(/const path = pageOf\(/);
    expect(importsOf(join(SRC, 'online/push.ts')).map((i) => i.from)).not.toContain('@/kvStore');
    expect(readFileSync(join(SRC, 'game/context.tsx'), 'utf8')).toContain('phonePush(kvPush)');
  });

  it('gives a small thing that is pressed its 44 points in its own box (the kit\'s `reach`), never by a `hitSlop`: React Native looks for no touch past a parent\'s edge', () => {
    const slopping = mine.filter((path) => /\bhitSlop\b/.test(readFileSync(path, 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, ''))).map(rel);
    expect(slopping).toEqual([]);
    // A word that only names one, in a comment, is not one.
    expect(/\bhitSlop\b/.test('const a = 1; // no hitSlop here'.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, ''))).toBe(false);
  });

  it('plays the phone\'s own sounds: no file of the app takes `@/ui/sound`, which the tsconfig maps to the web\'s synth for one test (game/cues.test.ts)', () => {
    // `@/ui/sound` is not the phone's ui/sound.tsx: it is the web's Web Audio board, there only so a test can run the web's cues. Imported by the app,
    // it would type-check and then fail on the phone (no AudioContext). The phone's sounds are `ui/sound` by a relative path.
    // Read as written: a relative path to the phone's own `ui/sound` is placed as `@/ui/sound` by the wall's reader, and is the right one.
    const WEB_SOUND = /(?:from\s*|import\(\s*|require\(\s*|import\s+)['"]@\/ui\/sound['"]/;
    const webSound = mine.filter((path) => WEB_SOUND.test(readFileSync(path, 'utf8'))).map(rel);
    expect(webSound).toEqual([]);
    expect(WEB_SOUND.test("import { useSound } from '@/ui/sound';")).toBe(true);
    expect(WEB_SOUND.test("const s = require('@/ui/sound');")).toBe(true);
    expect(WEB_SOUND.test("import { useSound } from '../../ui/sound';")).toBe(false);
  });

  it('holds the one place a rule could hide: no screen reads the tables a price, a limit or a score is worked out from', () => {
    // The engine's quotes, previews and score breakdown give every figure. A screen that reads one of
    // these tables is working a figure out itself. (Tax rates are shown, not used: they come from `effectiveTax`.)
    const TABLES = /\b(mortgageMaxLtvBp|purchaseTaxBp|propertyTaxBp|personalLoanSpreadBp|moveCostPct|wealthBreakpoints|escapeBase|escapePerRoundLeft|resaleStartPct|insurancePremiumBp|lifestyleMultiplierPct|rentalOnly|rentPct)\b/;
    // The presenters, the round store and the other pure helpers of the game turn engine figures into words and
    // pictures; they are held to the same rule as the screens they serve.
    const helpers = all.filter((path) => /^game\/[a-z]+\.ts$/.test(rel(path)));
    expect(helpers.map(rel)).toEqual(expect.arrayContaining(['game/present.ts', 'game/store.ts', 'game/records.ts', 'game/guide.ts', 'game/share.ts']));
    const broke = [...screens, ...helpers].filter((path) => TABLES.test(readFileSync(path, 'utf8'))).map(rel);
    expect(broke).toEqual([]);
  });
});
