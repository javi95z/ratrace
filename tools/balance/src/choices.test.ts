import { bots, content, lives } from '@ratrace/content';
import { applyCard, applyRound, createGame, previewCard, viewOf } from '@ratrace/engine';
import type { GameLimits } from '@ratrace/engine';
import { expect, it } from 'vitest';
import { slow } from './slow';
import { seedsFor } from './simulate';

/**
 * A card is a decision: the engine deals one only where it leaves the player two options at least (`dealOnlyChoices`), and takes back one
 * an answer has left with fewer. The engine's own test holds the rule on a card made for it; this holds it on the game's cards, as they are
 * met: every card shown in lives played by three bots far apart, from every starting life, free and under all the limits a week's challenge
 * can set.
 */
it('shows no card of the game with fewer than two options the player can take', () => {
  const asked: GameLimits[] = [{}, { noBorrowing: true, noProperty: true, noItems: true, noBusiness: true, noMoving: true, noEvasion: true, maxLifestyleTier: 1 }];
  // The bots whose lives go furthest apart: one that saves, one that gambles, one that picks at random.
  const playing = bots.filter((bot) => ['saver', 'gambler', 'random'].includes(bot.id));
  const short: string[] = [];
  let shown = 0;
  for (const limits of asked)
    for (const life of lives)
      for (const seed of seedsFor(1))
        for (const bot of playing) {
          let state = createGame({ content, start: { ...life.start, limits } }, seed);
          while (!state.finished) {
            while (state.phase === 'cards') {
              const view = viewOf(state);
              const id = state.hand[state.answered];
              const open = previewCard(content, view, id).filter((option) => option.available).length;
              shown += 1;
              if (open < 2) short.push(`${id}: ${open} open (${life.id}, ${bot.id}, round ${state.round}, ${JSON.stringify(limits)})`);
              state = applyCard(content, state, bot.pick(content, view)).state;
            }
            state = applyRound(content, state, { orders: bot.orders(content, viewOf(state)) }).state;
          }
        }
  expect(playing).toHaveLength(3);
  expect(shown).toBeGreaterThan(1_000);
  expect(short).toEqual([]);
}, slow(120_000));
