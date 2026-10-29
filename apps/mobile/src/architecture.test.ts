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
/** The only files that may name one: the phone's store and its web twin (the browser's), the context that wires it into the game, and the stand-in for the phone's store in tests. */
const STORAGE_FILES = [join(SRC, 'kvStore.ts'), join(SRC, 'kvStore.web.ts'), join(SRC, 'game/context.tsx'), join(SRC, 'testing/setup.ts')];

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

/** The names a file exports: its declarations (values and types), `export { a, b as c }` and what it passes on with `export { a } from`. */
function exportsIn(source: string): Set<string> {
  const code = source.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
  const declared = [...code.matchAll(/\bexport\s+(?:declare\s+)?(?:default\s+)?(?:async\s+)?(?:abstract\s+)?(?:function\*?|const|let|var|class|interface|type|enum)\s+([A-Za-z_$][\w$]*)/g)].map((m) => m[1]);
  const listed = [...code.matchAll(/\bexport\s+(?:type\s+)?\{([^}]*)\}/g)].flatMap((m) =>
    m[1].split(',').map((one) => one.trim().replace(/^type\s+/, '').split(/\s+as\s+/).pop() ?? '').filter(Boolean),
  );
  const defaulted = /\bexport\s+default\b/.test(code) ? ['default'] : [];
  return new Set([...declared, ...listed, ...defaulted]);
}

/** The names an import takes, as `importsIn` gives them: `{ a, b as c, type T }`, a default (`default`), a `require`'s `{ a, b: c }`. None for `*`. */
function namesTaken(names: string): string[] {
  const braced = names.match(/\{([^}]*)\}/);
  const inside = braced
    ? braced[1].split(',').map((one) => one.trim().replace(/^type\s+/, '').split(/\s+as\s+|\s*:\s*/)[0].trim()).filter(Boolean)
    : [];
  const before = (braced ? names.slice(0, braced.index) : names).replace(/,\s*$/, '').trim();
  const defaulted = before !== '' && before !== '*' && !before.startsWith('*') ? ['default'] : [];
  return [...defaulted, ...inside];
}

/** What a file passes on from another (`export { a, b as c } from '…'`, `export type { T } from '…'`), as `importsIn` gives what it takes: the names as the other file has them. */
function reexportsIn(path: string, source: string): Array<{ names: string; from: string }> {
  return [...source.matchAll(/\bexport\s+(?:type\s+)?(\{[^}]*\}|\*(?:\s+as\s+\w+)?)\s+from\s+['"]([^'"]+)['"]/g)].map((m) => ({ names: m[1], from: placeOf(path, m[2]) }));
}

/**
 * What the shared files (every one that is not a `.web` twin) take from a module that has a web twin, and the twin does not export: on the web Metro
 * reads the twin, and a name it lacks is `undefined` there, with no build error (the type checker reads only the phone's file). `files` maps each
 * file's path to its source.
 */
function twinGaps(files: ReadonlyMap<string, string>): string[] {
  const placeOfFile = (path: string) => `@/${rel(path).replace(/\.(tsx?)$/, '')}`;
  const twins = new Map<string, Set<string>>();
  for (const [path, source] of files) {
    if (!/\.web\.tsx?$/.test(path)) continue;
    const place = placeOfFile(path).replace(/\.web$/, '');
    twins.set(place, exportsIn(source));
    // A twin named `index` is its directory's too: `'../online'` is `online/index.ts` on the phone, and `online/index.web.ts` on the web.
    if (place.endsWith('/index')) twins.set(place.slice(0, -'/index'.length), exportsIn(source));
  }
  const gaps: string[] = [];
  for (const [path, source] of files) {
    if (/\.web\.tsx?$/.test(path)) continue;
    for (const { names, from } of [...importsIn(path, source), ...reexportsIn(path, source)]) {
      const twin = twins.get(from);
      if (!twin) continue;
      for (const name of namesTaken(names)) if (!twin.has(name)) gaps.push(`${rel(path)} takes ${name} from ${from}, which its web twin does not export`);
    }
  }
  return gaps;
}

/** The pages of the game, and its languages: the first part of a page's address. */
const PAGE_PATH = /(['"`])\/(?:(?:en|es|ru|new|challenge|room|rankings|collection|records|play|player|legal)\b[^'"`\n]*)?\1|`\/\$\{/g;
/** A page's address written out in code (`'/play'`, `'/'`, `` `/${page}` ``), its comments left out. */
const pagePathsIn = (source: string): string[] => [...source.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '').matchAll(PAGE_PATH)].map((m) => m[0]);

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
    for (const screen of ['app/_layout.tsx', 'app/index.tsx', 'app/[locale]/index.tsx', 'app/+native-intent.tsx', 'app/kit.tsx', 'ui/kit.tsx', 'ui/Page.tsx', 'game/screens/Records.tsx']) expect(names).toContain(screen);
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

  it('keeps every storage of the device in four files: the phone\'s store and its web twin, the game context that wires it, and the tests\' stand-in for the phone\'s store', () => {
    expect(namesStorage("import Storage from 'expo-sqlite/kv-store';")).toBe(true);
    expect(namesStorage("await AsyncStorage.getItem('x');")).toBe(true);
    expect(namesStorage("const saved = localStorage.getItem('x');")).toBe(true);
    expect(namesStorage("sessionStorage.clear();")).toBe(true);
    expect(namesStorage("indexedDB.open('x');")).toBe(true);
    expect(namesStorage("const storage = props.storage; // an IndexedDB on the web")).toBe(false);
    expect(STORAGE_FILES.map((file) => relative(SRC, file))).toEqual(['kvStore.ts', 'kvStore.web.ts', 'game/context.tsx', 'testing/setup.ts']);
    expect(all.filter((path) => namesStorage(readFileSync(path, 'utf8'))).filter((path) => !STORAGE_FILES.includes(path)).map(rel)).toEqual([]);
    // The two stores that may name it do (a rule that finds nothing in them would find nothing anywhere).
    expect(namesStorage(readFileSync(STORAGE_FILES[0], 'utf8'))).toBe(true);
    expect(namesStorage(readFileSync(STORAGE_FILES[1], 'utf8'))).toBe(true);
  });

  it('keeps the account\'s session in the phone\'s store, under its own keys, and hands the client no other', () => {
    // The client is made in one file of the phone, with the store's session for its storage, and renews the session only when told to.
    const connecting = all.filter((path) => /\bconnectSupabase\s*\(/.test(readFileSync(path, 'utf8'))).map(rel);
    expect(connecting).toEqual(['online/index.ts', 'online/index.web.ts']);
    const online = readFileSync(join(SRC, 'online/index.ts'), 'utf8');
    expect(online).toMatch(/connectSupabase\(url, key, \{[^}]*\bstorage: kvSession\b[^}]*\bautoRefresh: false\b[^}]*\}\)/);
    // And its web twin, as the Next web makes it: no storage (supabase-js's own, the browser's, under the key the Next web's session is kept under),
    // its own renewal.
    const web = readFileSync(join(SRC, 'online/index.web.ts'), 'utf8');
    expect(web.match(/\bconnectSupabase\(.*\)/g)).toEqual(['connectSupabase(url, key, { region, captcha })']);
    expect(importsOf(join(SRC, 'online/index.ts')).find((i) => i.from === '@/kvStore')?.names).toMatch(/\bkvSession\b/);
    expect(readFileSync(STORAGE_FILES[0], 'utf8')).toMatch(/export const kvSession\b/);
  });

  it('lets only the tests and their stand-ins (testing/*) name what is there for them alone: nothing the app runs starts its cloud, its game or its connection anew', () => {
    // Each made in its file and, where the web has a twin of it, in the twin.
    const TEST_ONLY: Record<string, string[]> = { forgetThePhone: ['online/index.ts', 'online/index.web.ts'], forgetTheGame: ['game/context.tsx'], forgetConnection: ['online/page.ts', 'online/page.web.ts'] };
    for (const [name, homes] of Object.entries(TEST_ONLY)) {
      const word = () => new RegExp(`\\b${name}\\b`, 'g');
      const naming = mine.filter((path) => !rel(path).startsWith('testing/') && word().test(readFileSync(path, 'utf8'))).map(rel);
      expect(naming.sort(), name).toEqual(homes);
      // Where it is made, it is only made: nothing there calls it.
      for (const home of homes) expect(readFileSync(join(SRC, home), 'utf8').match(word()), name).toHaveLength(1);
    }
  });

  it('keeps the fake project of the device checks out of the app: nothing the app runs imports from scripts/, and nothing under src names the fake\'s address or key', () => {
    // The fake (scripts/fakeCloud.ts) is reached only through a build's EXPO_PUBLIC_SUPABASE_URL: never wired into the app's code, so no build carries it.
    // The tests and their stand-ins (testing/*, never in a release bundle: devRoutes.test) may read the scripts' tables (the fonts' advances).
    const FROM_SCRIPTS = /(?:from\s*|import\(\s*|require\(\s*|import\s+)['"](?:\.\.\/)+scripts\//;
    expect(FROM_SCRIPTS.test("import { FAKE_KEY } from '../scripts/fakeCloud';")).toBe(true);
    expect(FROM_SCRIPTS.test("const f = require('../../scripts/fakeCloud');")).toBe(true);
    const FAKE = /sb_publishable_fake_local_only|127\.0\.0\.1:54399|\bFAKE_CLOUD_PORT\b|\bFAKE_KEY\b/;
    // This file names them, to look for them.
    const runs = (path: string) => !rel(path).startsWith('testing/') && !/\.test\.tsx?$/.test(path);
    expect(mine.filter((path) => runs(path) && FROM_SCRIPTS.test(readFileSync(path, 'utf8'))).map(rel)).toEqual([]);
    expect(mine.filter((path) => rel(path) !== 'architecture.test.ts' && FAKE.test(readFileSync(path, 'utf8'))).map(rel)).toEqual([]);
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
    // belongs to, and the milestones' book (game/phoneMilestones.ts) the milestones of lives, as the basket does; the memory services (testing/memoryServices.ts) stand in for the context's services, as the web's do, for
    // the tests' render and for the route that draws a scene; and the development page's fixture (testing/olderLife.ts)
    // writes a life straight into the phone's store to see it finished under older rules. Development only; the one route
    // that reaches each of those two is its own: the development page for the fixture, the scene page for the scenes (which
    // reach the memory services through testing/scene.tsx, never the session itself).
    // And the timing probe's long life (testing/perfLife.ts), put on the phone by the probe's own route, in a build made with EXPO_PUBLIC_PERF=1 only
    // (ui/perf.test.ts holds that a build without the flag has none of it).
    // And the phone's cloud (online/index.ts), which keeps the account's session and the lists of lives the account is still to be told of in the
    // phone's store, as the web's keeps them in the browser's.
    // And the phone's store's web twin (kvStore.web.ts), which keeps the player's things in the browser's IndexedDB and takes the core's memory store
    // for a browser that has none, as the Next web does.
    // And its web twin (online/index.web.ts), which keeps those lists in the browser under the Next web's keys, through the store's twin.
    expect(wires.sort()).toEqual(['game/context.tsx', 'game/phoneBasket.ts', 'game/phoneMilestones.ts', 'kvStore.web.ts', 'online/index.ts', 'online/index.web.ts', 'testing/memoryServices.ts', 'testing/olderLife.ts', 'testing/perfLife.ts']);
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
    const reachesNotices = (source: string): boolean => /['"`]expo-notifications(\/[^'"`]*)?['"`]/.test(source);
    expect(reachesNotices("import * as Notifications from 'expo-notifications';")).toBe(true);
    expect(reachesNotices("import type { NotificationResponse } from 'expo-notifications';")).toBe(true);
    expect(reachesNotices("const { getExpoPushTokenAsync } = require('expo-notifications');")).toBe(true);
    expect(reachesNotices("const tokens = await import('expo-notifications/build/getExpoPushTokenAsync');")).toBe(true);
    expect(reachesNotices('const tokens = await import(`expo-notifications`);')).toBe(true);
    // A word that only names one is not one.
    expect(reachesNotices('// the notices come through expo-notifications, in online/push.ts')).toBe(false);
    const reaching = shipped.filter((path) => reachesNotices(readFileSync(path, 'utf8'))).map((path) => relative(REPO, path));
    // And the tests' stand-in for the library (testing/setup.ts).
    expect(reaching).toEqual(['apps/mobile/src/online/push.ts', 'apps/mobile/src/testing/setup.ts']);
    // The push opens only what `pageOf` lets through, and takes no store of the phone's: its note is handed in by the game's context.
    const push = readFileSync(join(SRC, 'online/push.ts'), 'utf8');
    expect(push).toMatch(/const to = pageOf\(/);
    // Loaded late, and only there: nothing of it is taken as the app loads (in Expo Go it warns as it loads), but its types.
    expect(importsOf(join(SRC, 'online/push.ts')).filter((i) => i.from === 'expo-notifications' && !i.typeOnly).map((i) => i.names)).toEqual(['*']);
    expect(push).toContain("import('expo-notifications')");
    expect(push).not.toMatch(/require\(\s*['"]expo-notifications/);
    expect(importsOf(join(SRC, 'online/push.ts')).map((i) => i.from)).not.toContain('@/kvStore');
    expect(readFileSync(join(SRC, 'game/context.tsx'), 'utf8')).toContain('phonePush(kvPush)');
  });

  it('keeps every web twin whole: each name a shared file takes from a module with a `.web` twin is exported by the twin too', () => {
    const sources = new Map(mine.map((path) => [path, readFileSync(path, 'utf8')] as const));
    expect([...sources.keys()].filter((path) => /\.web\.tsx?$/.test(path)).length).toBeGreaterThan(30);
    expect(twinGaps(sources)).toEqual([]);
    // How it is told: a shared screen taking a name its twin lacks (a value or a type, by any way of importing it), and not a twin taking from a twin.
    const made = new Map([
      [join(SRC, 'ui/Thing.tsx'), 'export const a = 1;\nexport function lost() {}\nexport type Kind = 1;'],
      [join(SRC, 'ui/Thing.web.tsx'), "export const a = 2;\nconst b = 3;\nexport { b as kept };\nexport default a;\n// export function lost() {}"],
      [join(SRC, 'game/screens/Uses.tsx'), "import Thing, { a, type Kind, kept } from '../../ui/Thing';\nconst { lost } = require('../../ui/Thing');"],
      [join(SRC, 'ui/Other.web.tsx'), "import { lost } from './Thing';"],
    ]);
    expect(twinGaps(made)).toEqual([
      'game/screens/Uses.tsx takes Kind from @/ui/Thing, which its web twin does not export',
      'game/screens/Uses.tsx takes lost from @/ui/Thing, which its web twin does not export',
    ]);
    // A twin named `index`, taken by its directory's name; and what a shared file passes on is taken as much as what it imports.
    const more = new Map([
      [join(SRC, 'online/index.ts'), 'export const phoneOnline = 1;\nexport const gone = 2;'],
      [join(SRC, 'online/index.web.ts'), 'export const phoneOnline = 3;'],
      [join(SRC, 'game/wires.ts'), "import { phoneOnline, gone } from '../online';\nimport { gone as also } from '../online/index';"],
      [join(SRC, 'ui/Thing.tsx'), 'export const a = 1;\nexport function lost() {}'],
      [join(SRC, 'ui/Thing.web.tsx'), 'export const a = 2;'],
      [join(SRC, 'game/passes.ts'), "export { a, lost as found } from '../ui/Thing';\nexport type { Kind } from '../ui/Thing';\nexport * from '../ui/Thing';"],
    ]);
    expect(twinGaps(more)).toEqual([
      'game/wires.ts takes gone from @/online, which its web twin does not export',
      'game/wires.ts takes gone from @/online/index, which its web twin does not export',
      'game/passes.ts takes lost from @/ui/Thing, which its web twin does not export',
      'game/passes.ts takes Kind from @/ui/Thing, which its web twin does not export',
    ]);
  });

  it('writes no page\'s address in the game or the kit but in `game/pages.ts`: every move between pages goes through `hrefOf` and `useGo`, in the language of the address', () => {
    const inTheGame = mine.filter((path) => /^(game|ui)\//.test(rel(path)) && rel(path) !== 'game/pages.ts');
    expect(inTheGame.length).toBeGreaterThan(50);
    expect(inTheGame.flatMap((path) => pagePathsIn(readFileSync(path, 'utf8')).map((one) => `${rel(path)}: ${one}`))).toEqual([]);
    // How one is told: a page's path in quotes, the front door's among them, or one made from a template; never a word in a comment, nor an address
    // that is not a page of the game.
    expect(pagePathsIn("router.push('/play');")).toEqual(["'/play'"]);
    expect(pagePathsIn('router.dismissTo("/");')).toEqual(['"/"']);
    expect(pagePathsIn("router.push('/rankings?tab=friends'); router.replace('/es/room?code=ABC123');")).toEqual(["'/rankings?tab=friends'", "'/es/room?code=ABC123'"]);
    expect(pagePathsIn('router.push(`/${page}?code=${code}`);')).toEqual(['`/${']);
    expect(pagePathsIn("go.push('play'); // not router.push('/play')\nconst rules = `/rules/${file}`;\nconst link = `${origin}/${locale}/room`;")).toEqual([]);
  });

  it('gives a small thing that is pressed its 44 points in its own box (the kit\'s `reach`), never by a `hitSlop`: React Native looks for no touch past a parent\'s edge', () => {
    const slopping = mine.filter((path) => /\bhitSlop\b/.test(readFileSync(path, 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, ''))).map(rel);
    expect(slopping).toEqual([]);
    // A word that only names one, in a comment, is not one.
    expect(/\bhitSlop\b/.test('const a = 1; // no hitSlop here'.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, ''))).toBe(false);
  });

  it('reads a card\'s text only through `useCards` (the web loads the cards apart, and leaves the words every page speaks without them), never from `text.cards`', () => {
    const CARDS = /\btext\??\.cards\b/;
    const code = (path: string) => readFileSync(path, 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
    expect(mine.filter((path) => !/\.test\.tsx?$/.test(path) && CARDS.test(code(path))).map(rel)).toEqual([]);
    expect(CARDS.test('const written = words.text.cards[def.id];')).toBe(true);
    expect(CARDS.test('const written = cards[def.id]; // not text.cards'.replace(/\/\/.*$/gm, ''))).toBe(false);
  });

  it('draws nothing with Skia in the game: no file under game/ names it or takes the kit\'s canvas, so the web export loads none of it for a screen (the share card, whose web twin comes later, is the one exception)', () => {
    const SKIA = /['"`]@shopify\/react-native-skia(\/[^'"`]*)?['"`]/;
    const CANVAS = /^@\/ui\/Canvas(\.web)?$/;
    const inTheGame = mine.filter((path) => rel(path).startsWith('game/') && rel(path) !== 'game/screens/ShareCard.tsx');
    expect(inTheGame.length).toBeGreaterThan(20);
    expect(inTheGame.filter((path) => SKIA.test(readFileSync(path, 'utf8'))).map(rel)).toEqual([]);
    expect(inTheGame.filter((path) => importsOf(path).some((i) => CANVAS.test(i.from))).map(rel)).toEqual([]);
    // How a file is told: a package's name in quotes (import, require, late import or export from), and the canvas by the place it lives at.
    expect(SKIA.test("import { Path } from '@shopify/react-native-skia';")).toBe(true);
    expect(SKIA.test("const { Rect } = require('@shopify/react-native-skia');")).toBe(true);
    expect(SKIA.test('// draws on a canvas, not with Skia')).toBe(false);
    expect(importsIn(join(SRC, 'game/screens/X.tsx'), "import { Canvas } from '../../ui/Canvas';").some((i) => CANVAS.test(i.from))).toBe(true);
    expect(importsIn(join(SRC, 'game/screens/X.tsx'), "import { DashedRule } from '../../ui/DashedRule';").some((i) => CANVAS.test(i.from))).toBe(false);
  });

  it('depends on nothing of `apps/web`: no file of the app (a test is not one) names a file of the web, by a path into it or by one of the tsconfig\'s `@/` aliases for the web\'s files', () => {
    // The tsconfig maps a few of the web's files by the web's own alias (`@/ui/sound`, `@/i18n/metadata`, `@/i18n/routing`, `@/lib/site`), only so the tests that
    // run the web's code (game/cues.test.ts, game/pageMeta.test.ts, scripts/sitePieces.test.ts) typecheck. Taken by the app they would typecheck and then fail
    // on the phone (`@/ui/sound` is the web's Web Audio board: no AudioContext there), and the app would depend on the web, which it never does: what it
    // shares with it is copied and held to the web's by a test. The phone's own `ui/sound` is taken by a relative path, which the wall's reader places as
    // `@/ui/sound` too, and is the right one: so this reads the import as written, comments left out.
    const WEB_NAMES = /(?:from\s*|import\(\s*|require\(\s*|import\s+)['"](?:@\/(?:ui\/sound|i18n\/metadata|i18n\/routing|lib\/site)|(?:\.\.\/)+web\/[^'"]*|[^'"]*apps\/web\/[^'"]*)['"]/;
    const code = (source: string) => source.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
    expect(mine.length).toBeGreaterThan(200);
    expect(mine.filter((path) => WEB_NAMES.test(code(readFileSync(path, 'utf8')))).map(rel)).toEqual([]);
    for (const named of [
      "import { useSound } from '@/ui/sound';",
      "const s = require('@/ui/sound');",
      "import { pageMetadata } from '@/i18n/metadata';",
      "import { routing } from '@/i18n/routing';",
      "export { SITE_URL } from '@/lib/site';",
      "const { roomServer } = await import('../../../web/src/testing/roomServer');",
      "import { x } from '../../../../apps/web/src/lib/site';",
      "import web from 'apps/web/src/game/context';",
    ]) {
      expect(WEB_NAMES.test(code(named)), named).toBe(true);
    }
    for (const fine of [
      "import { useSound } from '../../ui/sound';",
      "import { SITE_URL } from './site';",
      "import { LOCALES } from '@ratrace/i18n/locales';",
      "import { webSize } from '../scripts/webSize';",
      "import { x } from './web/thing';",
      "// the web's own (apps/web/src/lib/site.ts): import x from '../../web/src/lib/site'\nconst a = 1;",
      "/* import { x } from '@/ui/sound' */ const b = 2;",
    ]) {
      expect(WEB_NAMES.test(code(fine)), fine).toBe(false);
    }
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
