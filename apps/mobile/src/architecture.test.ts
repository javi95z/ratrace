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
/** The packages the app carries besides the core: the rules (engine), what they run on (content), the interface's words (i18n). */
const CARRIED = ['engine', 'content', 'i18n'].map((name) => join(REPO, 'packages', name, 'src'));

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
    for (const screen of ['app/_layout.tsx', 'app/index.tsx', 'app/kit.tsx', 'ui/kit.tsx', 'ui/Page.tsx', 'game/screens/Placeholder.tsx']) expect(names).toContain(screen);
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
    expect(wires.sort()).toEqual(['game/context.tsx', 'game/phoneBasket.ts', 'testing/memoryServices.ts', 'testing/olderLife.ts']);
    expect(mine.filter((path) => importsOf(path).some((i) => i.from === '@/testing/olderLife')).map(rel)).toEqual(['app/dev.tsx']);
    expect(mine.filter((path) => importsOf(path).some((i) => i.from === '@/testing/scene')).map(rel)).toEqual(['app/scene.tsx']);
  });

  it('lets no screen reach the cloud, and only the game context may ever wire it', () => {
    const reaches = (path: string) => importsOf(path).filter((i) => /^@supabase\//.test(i.from) || /^@ratrace\/online(\/(?!types$).*)?$/.test(i.from));
    expect(screens.flatMap((path) => reaches(path).map((i) => `${rel(path)}: ${i.from}`))).toEqual([]);
    const wires = mine.filter((path) => reaches(path).length > 0).map(rel);
    expect(wires.filter((file) => file !== 'game/context.tsx')).toEqual([]);
    // And the client library is named in no file of the phone or the core: only `@ratrace/online/connect` loads it.
    const named = all.filter((path) => importsOf(path).some((i) => i.from === '@supabase/supabase-js') || /import\('@supabase\/supabase-js'\)/.test(readFileSync(path, 'utf8'))).map(rel);
    expect(named).toEqual([]);
  });

  it('sends nothing from the phone, as its legal notice says (`phone.legal`): the one request in the app is a development scene telling the shots\' driver, on this machine, that it is ready', () => {
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
    expect(sending).toEqual(['apps/mobile/src/testing/scene.tsx']);
    // That one: one request, to this machine only, with the address of the scene's own route; the route that draws a scene is for development only
    // (scripts/scenePages.test.ts) and says nothing unless it is opened for a shot.
    const scene = readFileSync(join(SRC, 'testing/scene.tsx'), 'utf8');
    expect([...scene.matchAll(/\bfetch\s*\(/g)]).toHaveLength(1);
    expect(scene).toContain('fetch(`http://127.0.0.1:${port}/ready?name=');
    expect(scene).toContain('if (port === undefined) return;');
  });

  it('gives a small thing that is pressed its 44 points in its own box (the kit\'s `reach`), never by a `hitSlop`: React Native looks for no touch past a parent\'s edge', () => {
    const slopping = mine.filter((path) => /\bhitSlop\b/.test(readFileSync(path, 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, ''))).map(rel);
    expect(slopping).toEqual([]);
    // A word that only names one, in a comment, is not one.
    expect(/\bhitSlop\b/.test('const a = 1; // no hitSlop here'.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, ''))).toBe(false);
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
