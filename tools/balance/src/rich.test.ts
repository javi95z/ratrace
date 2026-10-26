import { bots, content, lives } from '@ratrace/content';
import { applyCard, applyRound, createGame, realNetWorth, viewOf } from '@ratrace/engine';
import { expect, it } from 'vitest';
import { seedsFor } from './simulate';

/**
 * The troubles of a fortune (`rich_*`) are dealt only to someone worth a million in start-of-game dollars as the hand is drawn,
 * and they are met: the indexer, who gets rich, sees some; the status chaser, who never does, sees none.
 */
it('deals the troubles of a fortune to the rich, and never to the poor', () => {
  const RICH = 100_000_000;
  const playing = bots.filter((bot) => ['indexer', 'chaser'].includes(bot.id));
  const starting = lives.filter((life) => ['nurse', 'engineer', 'civil_servant'].includes(life.id));
  const dealt: Record<string, number> = { indexer: 0, chaser: 0 };
  const poor: string[] = [];
  for (const life of starting)
    for (const seed of seedsFor(8))
      for (const bot of playing) {
        let state = createGame({ content, start: life.start }, seed);
        while (!state.finished) {
          // What the player is worth as the hand is drawn, before any card of it is answered.
          const worth = state.phase === 'cards' ? realNetWorth(state) : 0;
          for (const id of state.phase === 'cards' ? state.hand : []) {
            if (!id.startsWith('rich_')) continue;
            dealt[bot.id] += 1;
            if (worth < RICH) poor.push(`${id}: ${worth} (${life.id}, ${bot.id}, round ${state.round})`);
          }
          while (state.phase === 'cards') state = applyCard(content, state, bot.pick(content, viewOf(state))).state;
          state = applyRound(content, state, { orders: bot.orders(content, viewOf(state)) }).state;
        }
      }
  expect(playing).toHaveLength(2);
  expect(poor).toEqual([]);
  expect(dealt.indexer).toBeGreaterThan(10);
  expect(dealt.chaser).toBe(0);
}, 120_000);
