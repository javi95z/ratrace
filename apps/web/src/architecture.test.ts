import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * The wall of spec 8.9: a screen talks to the game through `GameSession` and to the device through
 * `PlayerStore`, and to nothing else. So moving the game to a server later changes no screen.
 */
const SRC = fileURLToPath(new URL('.', import.meta.url));

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return filesUnder(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

/** Everything a file imports: `[what, from]` for each import statement. */
function importsOf(path: string): Array<{ names: string; from: string }> {
  const source = readFileSync(path, 'utf8');
  return [...source.matchAll(/import\s+(?:type\s+)?([^;]*?)\s+from\s+['"]([^'"]+)['"]/g)].map((m) => ({ names: m[1], from: m[2] }));
}

const rel = (path: string) => relative(SRC, path);
const all = filesUnder(SRC);
/** What draws the game: the pages, the screens, the UI kit. The session and the one file that wires it are behind the wall. */
const screens = all.filter((path) => /^(app|ui|game\/screens)\//.test(rel(path)));
const WIRING = ['game/context.tsx', 'testing/render.tsx'];

describe('the wall between the screens and the game', () => {
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
      const broke = importsOf(join(SRC, file)).filter((i) => i.from === '@ratrace/engine' && MOVES.test(i.names));
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

  it('keeps the engine and the content out of the browser database code', () => {
    const idb = importsOf(join(SRC, 'session/indexeddb.ts')).map((i) => i.from);
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
