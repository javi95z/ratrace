import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { content, CONTENT_VERSION, lives } from '@ratrace/content';
import { applyCard, applyRound, createGame, ENGINE_VERSION, finalScore, stateHash } from '@ratrace/engine';
import type { GameState, LoggedRound } from '@ratrace/engine';
import { describe, expect, it } from 'vitest';
import { bundleGame, bundleName, fingerprint, GAME_DIR, mayWrite, registrySource, SHIPPED_FILE } from './bundle';

const current = bundleName(ENGINE_VERSION, CONTENT_VERSION);

/** A whole life played with the source of the game, taking the last choice of every card, and the log of it. */
function life(lifeId: string, seed: string): { state: GameState; log: LoggedRound[] } {
  const start = lives.find((one) => one.id === lifeId)?.start;
  if (!start) throw new Error(`no life ${lifeId}`);
  let state = createGame({ content, start }, seed);
  const log: LoggedRound[] = [];
  while (!state.finished) {
    const picks: number[] = [];
    while (state.phase === 'cards') {
      const card = content.cards.find((one) => one.id === state.hand[state.answered]);
      // The last choice that is open: a life that says yes to things touches more of the game.
      let pick = (card?.options.length ?? 1) - 1;
      for (; pick > 0; pick--) {
        try {
          applyCard(content, state, pick);
          break;
        } catch {
          continue;
        }
      }
      state = applyCard(content, state, pick).state;
      picks.push(pick);
    }
    state = applyRound(content, state, { orders: [] }).state;
    log.push({ picks, orders: [] });
  }
  return { state, log };
}

describe('the game as the server holds it', () => {
  it('has a bundle for the versions in this checkout, and it is not stale', async () => {
    expect(existsSync(join(GAME_DIR, current)), `run \`pnpm online:bundle\`: ${current} is missing`).toBe(true);
    const { code } = await bundleGame();
    // A change to the engine or the content without a new bundle would have the server play another game than the browser.
    expect(readFileSync(join(GAME_DIR, current), 'utf8') === code, `${current} is out of date: run \`pnpm online:bundle\`, or bump a version if games are already being played on it`).toBe(true);
  });

  it('holds the rules and nothing of how the game looks: a change of pictures or words is not a change of the server\'s copy', async () => {
    const { code } = await bundleGame();
    const sources = [...code.matchAll(/^\/\/ (packages\/[\w/.-]+)$/gm)].map((m) => m[1]);
    expect(sources).toContain('packages/content/src/record.ts');
    expect(sources).toContain('packages/content/src/badges.ts');
    for (const look of ['art.ts', 'names.ts', 'text/', 'text.ts']) expect(sources.filter((file) => file.includes(`content/src/${look}`)), look).toEqual([]);
  });

  it('never rewrites a bundle that has shipped, unless it is forced to', () => {
    const shipped = { '0.4.0/1.3.0': fingerprint('the game as it shipped') };
    // Versions that have not shipped are written freely: that is every change before a release.
    expect(mayWrite(shipped, '0.5.0/1.3.0', 'anything', false)).toBe('write');
    // The same bytes again change nothing.
    expect(mayWrite(shipped, '0.4.0/1.3.0', 'the game as it shipped', false)).toBe('same');
    // Other rules under versions that players' lives are saved on: refused, because the server would
    // play those lives to another end than the device that lived them.
    expect(mayWrite(shipped, '0.4.0/1.3.0', 'the game with a rule changed', false)).toBe('refuse');
    expect(mayWrite(shipped, '0.4.0/1.3.0', 'the game with a rule changed', true)).toBe('write');
  });

  it('holds every bundle that has shipped exactly as it shipped', () => {
    const shipped = JSON.parse(readFileSync(SHIPPED_FILE, 'utf8')) as Record<string, string>;
    expect(Object.keys(shipped).length).toBeGreaterThan(0);
    for (const [versions, print] of Object.entries(shipped)) {
      const [engine, pack] = versions.split('/');
      const file = join(GAME_DIR, bundleName(engine, pack));
      expect(existsSync(file), `${versions} has shipped and its bundle is gone: lives on it can no longer be finished`).toBe(true);
      expect(fingerprint(readFileSync(file, 'utf8')), `${versions} has shipped and its bundle was changed: bump ENGINE_VERSION or CONTENT_VERSION instead of changing the rules under players' saved lives`).toBe(print);
    }
  });

  it('lists every bundle in the folder under the versions it holds', () => {
    const files = readdirSync(GAME_DIR);
    expect(readFileSync(join(GAME_DIR, 'index.ts'), 'utf8')).toBe(registrySource(files));
    expect(registrySource(['v0.3.0-1.2.0.js', 'index.ts', 'types.ts', 'v0.4.0-1.3.0.js'])).toContain("'0.3.0/1.2.0': g0 as unknown as GameModule,\n  '0.4.0/1.3.0': g1 as unknown as GameModule,");
  });

  it('plays the same lives to the same end as the source does', { timeout: 60_000 }, async () => {
    const game = (await import(pathToFileURL(join(GAME_DIR, current)).href)) as typeof import('./entry');
    expect([game.ENGINE_VERSION, game.CONTENT_VERSION]).toEqual([ENGINE_VERSION, CONTENT_VERSION]);
    for (const [lifeId, seed] of [['nurse', 'parity-1'], ['engineer', 'parity-2'], ['civil_servant', 'parity-3']] as const) {
      const played = life(lifeId, seed);
      const start = game.lives.find((one) => one.id === lifeId)?.start;
      if (!start) throw new Error(`the bundle has no life ${lifeId}`);
      const again = game.replayLog(game.content, start, seed, played.log);
      expect(game.stateHash(again), lifeId).toBe(stateHash(played.state));
      expect(game.finalScore(game.content, again), lifeId).toBe(finalScore(content, played.state));
    }
  });
});
