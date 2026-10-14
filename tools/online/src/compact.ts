/**
 * Makes every bundle the server holds smaller, without changing what it plays: whitespace and long
 * names go, and nothing else. An Edge Function is deployed with every bundle in it, and the platform
 * takes no more than 5 MB of code; each version adds a quarter of a megabyte.
 *
 * Before a bundle is replaced, both versions of it play every one of its lives on several seeds to
 * the end, and must end in the very same state, hash for hash. A shipped bundle is noted again in
 * `shipped.json` as it now is: what is deployed next is the compacted one.
 *
 *   pnpm --filter @ratrace/online-tools exec tsx src/compact.ts
 */
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { transform } from 'esbuild';
import { fingerprint, GAME_DIR, SHIPPED_FILE } from './bundle';
import type { GameModule, LoggedRound } from '../../../supabase/functions/_shared/game/types.ts';

const SEEDS = ['compact-1', 'compact-2', 'compact-3'];

/** How every life of a bundle ends on each seed, answering nothing and ordering nothing: a round at a time, to the end. */
function endings(game: GameModule): string[] {
  const rounds: LoggedRound[] = Array.from({ length: game.content.rounds }, () => ({ picks: [], orders: [] }));
  return game.lives.flatMap((life) => SEEDS.map((seed) => `${life.id}/${seed}: ${game.stateHash(game.replayLog(game.content, life.start, seed, rounds))}`));
}

/** Imports a bundle from its own copy of the code, so that the two being compared are never the same module. */
async function load(code: string, dir: string, name: string): Promise<GameModule> {
  const file = join(dir, name);
  writeFileSync(file, code);
  return (await import(pathToFileURL(file).href)) as GameModule;
}

const shipped = JSON.parse(readFileSync(SHIPPED_FILE, 'utf8')) as Record<string, string>;
const scratch = mkdtempSync(join(tmpdir(), 'ratrace-compact-'));
let before = 0;
let after = 0;
try {
  for (const name of readdirSync(GAME_DIR).filter((file) => /^v[\w.]+-[\w.]+\.js$/.test(file)).sort()) {
    const code = readFileSync(join(GAME_DIR, name), 'utf8');
    const banner = code.startsWith('//') ? code.slice(0, code.indexOf('\n') + 1) : '';
    const compact = banner + (await transform(code, { minify: true, format: 'esm', target: 'es2022', legalComments: 'none' })).code;
    before += code.length;
    if (compact.length >= code.length) {
      after += code.length;
      continue;
    }
    const was = endings(await load(code, scratch, `was-${name}`));
    const now = endings(await load(compact, scratch, `now-${name}`));
    if (was.length === 0 || was.join('\n') !== now.join('\n')) throw new Error(`${name} plays differently once compacted: left as it was`);
    writeFileSync(join(GAME_DIR, name), compact);
    after += compact.length;
    const versions = name.slice(1, -3).replace('-', '/');
    if (Object.hasOwn(shipped, versions)) shipped[versions] = fingerprint(compact);
    console.log(`${name}: ${Math.round(code.length / 1024)} KB → ${Math.round(compact.length / 1024)} KB, ${was.length} lives played the same`);
  }
  writeFileSync(SHIPPED_FILE, `${JSON.stringify(Object.fromEntries(Object.entries(shipped).sort()), null, 2)}\n`);
  console.log(`all bundles: ${Math.round(before / 1024)} KB → ${Math.round(after / 1024)} KB`);
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
