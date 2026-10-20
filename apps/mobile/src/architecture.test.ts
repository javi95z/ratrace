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
 * alone, and Metro's `require()` (how the phone loads an asset, a font, or a module only when it is needed).
 */
function importsIn(path: string, source: string): Array<{ names: string; from: string }> {
  const named = [...source.matchAll(/import\s+(?:type\s+)?([^;'"]*?)\s+from\s+['"]([^'"]+)['"]/g)].map((m) => ({ names: m[1], from: m[2] }));
  const late = [...source.matchAll(/\bimport\(\s*['"]([^'"]+)['"]\s*\)/g)].map((m) => ({ names: '*', from: m[1] }));
  const bare = [...source.matchAll(/(?:^|[;\n])\s*import\s+['"]([^'"]+)['"]/g)].map((m) => ({ names: '', from: m[1] }));
  const required = [...source.matchAll(/(?:const\s+([^=]+?)\s*=\s*)?\brequire\(\s*['"]([^'"]+)['"]\s*\)/g)].map((m) => ({ names: m[1] ?? '*', from: m[2] }));
  return [...named, ...late, ...bare, ...required].map((one) => ({ names: one.names, from: placeOf(path, one.from) }));
}
const importsOf = (path: string) => importsIn(path, readFileSync(path, 'utf8'));

const all = ROOTS.flatMap((dir) => filesUnder(dir));
const mine = all.filter((path) => rootOf(path) === SRC);
/** What draws the game: the routes, the kit and the screens. The session and the one file that wires it are behind the wall. */
const screens = mine.filter((path) => /^(app|ui|game\/screens)\//.test(rel(path)));
const MOVES = /\b(applyCard|applyCards|applyRound|createGame)\b/;

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

  it('finds the screens', () => {
    const names = screens.map(rel);
    for (const screen of ['app/_layout.tsx', 'app/index.tsx', 'app/kit.tsx', 'ui/kit.tsx', 'ui/Page.tsx', 'game/screens/Placeholder.tsx']) expect(names).toContain(screen);
  });

  it('lets no screen change the game except through the session', () => {
    const broke = screens.flatMap((path) => importsOf(path).filter((i) => i.from === '@ratrace/engine' && MOVES.test(i.names)).map((i) => `${rel(path)}: ${i.names}`));
    expect(broke).toEqual([]);
    const wiring = importsOf(join(SRC, 'game/context.tsx')).filter((i) => i.from === '@ratrace/engine' && MOVES.test(i.names));
    expect(wiring).toEqual([]);
  });

  it('lets no screen touch the device: no store of the phone, no session internals', () => {
    const DEVICE = /^(expo-sqlite(\/.*)?|expo-secure-store|expo-file-system(\/.*)?|@react-native-async-storage\/.*|@\/kvStore)$/;
    const broke = screens.flatMap((path) =>
      importsOf(path)
        .filter(({ from }) => DEVICE.test(from) || /^@\/session\/(?!types$)/.test(from))
        .map(({ from }) => `${rel(path)} imports ${from}`),
    );
    expect(broke).toEqual([]);
  });

  it('lets no screen judge a badge, an unlock or what a life adds to the profile', () => {
    const JUDGES = /\b(badgesEarned|galleryBadges|unlockedLives|journalAfter|journalStart|profileAfter|recordStep)\b/;
    const broke = screens.flatMap((path) => importsOf(path).filter((i) => JUDGES.test(i.names)).map((i) => `${rel(path)}: ${i.names}`));
    expect(broke).toEqual([]);
  });

  it('wires the real session and the phone\'s store in one place', () => {
    const wires = mine.filter((path) => importsOf(path).some((i) => /^@\/session\/(local|memory|resilient)$/.test(i.from) || i.from === '@/kvStore')).map(rel);
    expect(wires.sort()).toEqual(['game/context.tsx']);
  });

  it('lets no screen reach the cloud, and only the game context may ever wire it', () => {
    const reaches = (path: string) => importsOf(path).filter((i) => /^@supabase\//.test(i.from) || /^@ratrace\/online(\/(?!types$).*)?$/.test(i.from));
    expect(screens.flatMap((path) => reaches(path).map((i) => `${rel(path)}: ${i.from}`))).toEqual([]);
    const wires = mine.filter((path) => reaches(path).length > 0).map(rel);
    expect(wires.filter((file) => file !== 'game/context.tsx')).toEqual([]);
  });

  it('holds the one place a rule could hide: no screen reads the tables a price, a limit or a score is worked out from', () => {
    const TABLES = /\b(mortgageMaxLtvBp|purchaseTaxBp|propertyTaxBp|personalLoanSpreadBp|moveCostPct|wealthBreakpoints|escapeBase|escapePerRoundLeft|resaleStartPct|insurancePremiumBp|lifestyleMultiplierPct|rentalOnly|rentPct)\b/;
    expect(screens.filter((path) => TABLES.test(readFileSync(path, 'utf8'))).map(rel)).toEqual([]);
  });
});
