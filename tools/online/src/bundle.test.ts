import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { content, CONTENT_VERSION, lives } from '@ratrace/content';
import { applyCard, applyRound, createGame, ENGINE_VERSION, finalScore, stateHash } from '@ratrace/engine';
import type { GameState, LoggedRound } from '@ratrace/engine';
import { describe, expect, it } from 'vitest';
import { bundleGame, bundleName, GAME_DIR, registrySource } from './bundle';

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
