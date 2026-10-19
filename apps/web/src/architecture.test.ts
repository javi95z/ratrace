import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * The wall of spec 8.9: a screen talks to the game through `GameSession` and to the device through
 * `PlayerStore`, and to nothing else. So moving the game to a server later changes no screen.
 *
 * The game's logic lives in `@ratrace/core` and its client of the servers in `@ratrace/online`, laid out
 * as they were here: `@ratrace/core/session/local` is the `@/session/local` it once was,
 * `@ratrace/online/mirror` the `@/online/mirror`, and the rules below hold over all three as one tree.
 */
const SRC = fileURLToPath(new URL('.', import.meta.url));
const CORE = fileURLToPath(new URL('../../../packages/core/src', import.meta.url));
const ONLINE = fileURLToPath(new URL('../../../packages/online/src', import.meta.url));
/** Each tree, and where it stands in the one the rules name. */
const ROOTS: Array<{ dir: string; at: string }> = [
  { dir: SRC, at: '' },
  { dir: CORE, at: '' },
  { dir: ONLINE, at: 'online/' },
];
const PACKAGES: Record<string, string> = { '@ratrace/core/': '', '@ratrace/online/': 'online/' };

/** The tree a file belongs to. */
const treeOf = (path: string) => ROOTS.find(({ dir }) => !relative(dir, path).startsWith('..')) as { dir: string; at: string };
const rootOf = (path: string) => treeOf(path).dir;

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return filesUnder(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

/** Where an import leads, as the rules below name places: a path beside the file, or one into the core, becomes the `@/` path it stands for. */
function placeOf(path: string, from: string): string {
  const inPackage = Object.keys(PACKAGES).find((name) => from.startsWith(name));
  if (inPackage !== undefined) return `@/${PACKAGES[inPackage]}${from.slice(inPackage.length)}`;
  if (!from.startsWith('.')) return from;
  const { dir, at } = treeOf(path);
  const target = relative(dir, join(dirname(path), from));
  return target.startsWith('..') ? from : `@/${at}${target}`;
}

/**
 * Everything a file imports: what, and from where, for each import statement, each `import()`
 * made while the game runs, and each import made only for its effects. However a file reaches
 * another, it is found here: a relative path or a late import is no way round the wall.
 */
function importsIn(path: string, source: string): Array<{ names: string; from: string }> {
  const named = [...source.matchAll(/import\s+(?:type\s+)?([^;'"]*?)\s+from\s+['"]([^'"]+)['"]/g)].map((m) => ({ names: m[1], from: m[2] }));
  const late = [...source.matchAll(/\bimport\(\s*['"]([^'"]+)['"]\s*\)/g)].map((m) => ({ names: '*', from: m[1] }));
  const bare = [...source.matchAll(/(?:^|[;\n])\s*import\s+['"]([^'"]+)['"]/g)].map((m) => ({ names: '', from: m[1] }));
  return [...named, ...late, ...bare].map((one) => ({ names: one.names, from: placeOf(path, one.from) }));
}
const importsOf = (path: string) => importsIn(path, readFileSync(path, 'utf8'));

const rel = (path: string) => `${treeOf(path).at}${relative(rootOf(path), path)}`;
const all = ROOTS.flatMap(({ dir }) => filesUnder(dir));
/** A file by the place the rules name it, in whichever tree it lives. */
const fileAt = (place: string) => all.find((path) => rel(path) === place) as string;
/** What draws the game: the pages, the screens, the UI kit. The session and the one file that wires it are behind the wall. */
const screens = all.filter((path) => /^(app|ui|game\/screens)\//.test(rel(path)));
const WIRING = ['game/context.tsx', 'testing/render.tsx'];

describe('the wall between the screens and the game', () => {
  it('sees an import however it is written', () => {
    const screen = join(SRC, 'game/screens/Anything.tsx');
    const found = (source: string) => importsIn(screen, source).map((one) => one.from);
    expect(found("import { MirroredStore } from '@/online/mirror';")).toEqual(['@/online/mirror']);
    expect(found("import type { Cloud } from '../../online/supabase';")).toEqual(['@/online/supabase']);
    expect(found("const { connectSupabase } = await import('../../online/connect');")).toEqual(['@/online/connect']);
    expect(found("import '@/session/indexeddb';\nimport './Home';")).toEqual(['@/session/indexeddb', '@/game/screens/Home']);
    expect(found("import {\n  applyRound,\n  netWorth,\n} from '@ratrace/engine';")).toEqual(['@ratrace/engine']);
    expect(importsIn(screen, "import {\n  applyRound,\n} from '@ratrace/engine';")[0].names).toContain('applyRound');
  });

  it('sees the core as the tree it came from', () => {
    expect(placeOf(join(SRC, 'game/screens/Anything.tsx'), '@ratrace/core/session/local')).toBe('@/session/local');
    expect(placeOf(join(CORE, 'game/store.ts'), '../session/memory')).toBe('@/session/memory');
    expect(rel(fileAt('game/present.ts'))).toBe('game/present.ts');
    expect(rootOf(fileAt('game/present.ts'))).toBe(CORE);
    expect(placeOf(join(SRC, 'game/context.tsx'), '@ratrace/online/mirror')).toBe('@/online/mirror');
    expect(placeOf(join(ONLINE, 'mirror.ts'), './merge')).toBe('@/online/merge');
    expect(rel(fileAt('online/connect.ts'))).toBe('online/connect.ts');
    expect(rootOf(fileAt('online/connect.ts'))).toBe(ONLINE);
    expect(rootOf(fileAt('online/index.ts'))).toBe(SRC);
  });

  it('finds the screens', () => {
    expect(screens.length).toBeGreaterThan(20);
    for (const screen of ['game/screens/Collection.tsx', 'game/screens/Records.tsx', 'game/screens/ShareCard.tsx', 'game/screens/Guide.tsx']) expect(screens.map(rel)).toContain(screen);
    expect(screens.map(rel)).toContain('game/screens/Play.tsx');
    expect(screens.map(rel)).toContain('game/screens/Finance.tsx');
  });

  it('lets no screen change the game except through the session', () => {
    const MOVES = /\b(applyCard|applyCards|applyRound|createGame)\b/;
    const broke = screens.flatMap((path) => importsOf(path).filter((i) => i.from === '@ratrace/engine' && MOVES.test(i.names)).map((i) => `${rel(path)}: ${i.names}`));
    expect(broke).toEqual([]);
  });

  it('lets the round store reach the game only through the session too', () => {
    const MOVES = /\b(applyCard|applyCards|applyRound|createGame)\b/;
    for (const file of ['game/store.ts', 'game/present.ts', 'game/context.tsx']) {
      expect(fileAt(file), file).toBeDefined();
      const broke = importsOf(fileAt(file)).filter((i) => i.from === '@ratrace/engine' && MOVES.test(i.names));
      expect(broke, file).toEqual([]);
    }
  });

  it('lets no screen touch the device: no database, no session internals', () => {
    const broke: string[] = [];
    for (const path of screens) {
      const source = readFileSync(path, 'utf8');
      for (const { from } of importsOf(path)) {
        if (from === 'idb' || from === 'fake-indexeddb') broke.push(`${rel(path)} imports ${from}`);
        if (/^@\/session\/(?!types$)/.test(from)) broke.push(`${rel(path)} imports ${from}`);
      }
      if (/\b(indexedDB|localStorage|sessionStorage)\b/.test(source)) broke.push(`${rel(path)} names a browser store`);
    }
    expect(broke).toEqual([]);
  });

  it('lets no screen judge a badge, an unlock or what a life adds to the profile', () => {
    // Whoever runs the game judges these: the session today, a server later. A screen shows what it is told.
    const JUDGES = /\b(badgesEarned|galleryBadges|unlockedLives|journalAfter|journalStart|profileAfter|recordStep)\b/;
    const broke = screens.flatMap((path) => importsOf(path).filter((i) => JUDGES.test(i.names)).map((i) => `${rel(path)}: ${i.names}`));
    expect(broke).toEqual([]);
  });

  it('wires the real session and store in one place', () => {
    const wires = all.filter((path) => importsOf(path).some((i) => /^@\/session\/(local|indexeddb|memory|resilient)$/.test(i.from))).map(rel);
    expect(wires.filter((file) => !file.startsWith('session/')).sort()).toEqual(WIRING);
  });

  it('lets no screen reach the cloud: who is playing comes through the account, and the account is wired in one place', () => {
    // A screen may know the shape of an account. The client that talks to Supabase is behind it.
    const reaches = (path: string) => importsOf(path).filter((i) => i.from === '@supabase/supabase-js' || /^@\/online(\/(?!types$).*)?$/.test(i.from));
    expect(screens.flatMap((path) => reaches(path).map((i) => `${rel(path)}: ${i.from}`))).toEqual([]);
    const wires = all.filter((path) => !rel(path).startsWith('online/') && reaches(path).length > 0).map(rel);
    // One file wires the cloud into the game. Two more stand in for the servers of ranked lives and of rooms in tests.
    expect(wires.sort()).toEqual(['game/context.tsx', 'testing/rankedServer.ts', 'testing/roomServer.ts']);
    // And the client library is named in exactly one file, which loads it only when an account starts.
    const named = all.filter((path) => importsOf(path).some((i) => i.from === '@supabase/supabase-js') || /import\('@supabase\/supabase-js'\)/.test(readFileSync(path, 'utf8'))).map(rel);
    expect(named).toEqual(['online/connect.ts']);
  });

  it('keeps the engine and the content out of the browser database code', () => {
    const idb = importsOf(fileAt('session/indexeddb.ts')).map((i) => i.from);
    expect(idb).not.toContain('@ratrace/engine');
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
