import { describe, expect, it } from 'vitest';
import { applyCard, applyRound, createGame } from './game';
import { stateHash } from './hash';
import { replayLog } from './replayLog';
import type { LoggedRound } from './replayLog';
import { fixtureContent, fixtureStart } from './testing/fixture';
import type { GameState } from './types';

const content = fixtureContent();
const start = fixtureStart();

/** Plays `rounds` rounds answering every card with its first choice, and keeps the log of it. */
function play(seed: string, rounds: number, answeredInLast = -1): { state: GameState; log: LoggedRound[] } {
  let state = createGame({ content, start }, seed);
  const log: LoggedRound[] = [];
  for (let i = 0; i < rounds; i++) {
    const picks: number[] = [];
    while (state.phase === 'cards') {
      state = applyCard(content, state, 0).state;
      picks.push(0);
    }
    state = applyRound(content, state, { orders: [] }).state;
    log.push({ picks, orders: [] });
  }
  if (answeredInLast >= 0) {
    const picks: number[] = [];
    while (state.phase === 'cards' && picks.length < answeredInLast) {
      state = applyCard(content, state, 0).state;
      picks.push(0);
    }
    log.push({ picks, orders: null });
  }
  return { state, log };
}

describe('replayLog', () => {
  it('gives back exactly the game that was played, from its seed and what was chosen', () => {
    for (const rounds of [0, 1, 5, content.rounds]) {
      const { state, log } = play('replay-me', rounds);
      expect(stateHash(replayLog(content, start, 'replay-me', log)), `${rounds} rounds`).toBe(stateHash(state));
    }
  });

  it('stops in the middle of a hand when the last round was never played', () => {
    const { state, log } = play('mid-hand', 2, 1);
    const again = replayLog(content, start, 'mid-hand', log);
    expect(again.round).toBe(2);
    expect(again.answered).toBe(state.answered);
    expect(stateHash(again)).toBe(stateHash(state));
  });

  it('tells whoever asks about each step, so a record can be kept alongside', () => {
    const { log } = play('steps', 2);
    const steps: Array<{ cards: boolean; round: number }> = [];
    replayLog(content, start, 'steps', log, (before, result, orders) => steps.push({ cards: orders === null, round: before.round }));
    const cards = log.reduce((sum, entry) => sum + entry.picks.length, 0);
    expect(steps.filter((step) => step.cards)).toHaveLength(cards);
    expect(steps.filter((step) => !step.cards).map((step) => step.round)).toEqual([0, 1]);
  });

  it('refuses a log that cannot have been played', () => {
    const { log } = play('bad', 2);
    const tooLong = Array.from({ length: content.rounds + 1 }, () => ({ picks: [], orders: [] }));
    expect(() => replayLog(content, start, 'bad', tooLong)).toThrow('the log is longer than a life');
    expect(() => replayLog(content, start, 'bad', [{ ...log[0], picks: [...log[0].picks, 0, 0, 0, 0, 0, 0] }])).toThrow('the log answers more cards than the round had');
    expect(() => replayLog(content, start, 'bad', [{ picks: [], orders: null }, log[1]])).toThrow('the log goes on after a round that was never played');
  });

  it('is a different game under a different seed', () => {
    const { log, state } = play('one', 3);
    const other = (() => {
      try {
        return stateHash(replayLog(content, start, 'two', log));
      } catch {
        return 'refused';
      }
    })();
    expect(other).not.toBe(stateHash(state));
  });
});
