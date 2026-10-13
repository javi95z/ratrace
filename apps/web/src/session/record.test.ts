import { content, lives } from '@ratrace/content';
import { applyCard, applyRound, createGame, realNetWorth } from '@ratrace/engine';
import type { GameState } from '@ratrace/engine';
import { describe, expect, it } from 'vitest';
import { recordStart, recordStep } from './record';
import type { LifeRecord } from './record';

const nurse = lives[0].start;

/** Plays a life with the same answers and orders every round, keeping the record as a session would. */
function play(rounds: number, orders: Parameters<typeof applyRound>[2]['orders'] = []): { state: GameState; record: LifeRecord; earned: string[][] } {
  let state = createGame({ content, start: nurse }, 'record');
  let record = recordStart(content, state);
  const earned: string[][] = [];
  const take = (after: GameState, events: Parameters<typeof recordStep>[4]) => {
    const step = recordStep(content, record, state, after, events);
    record = step.record;
    earned.push(step.earned);
    state = after;
  };
  while (!state.finished && state.round < rounds) {
    while (state.phase === 'cards') {
      const card = applyCard(content, state, 0);
      take(card.state, card.events);
    }
    const round = applyRound(content, state, { orders });
    take(round.state, round.events);
  }
  return { state, record, earned };
}

describe('the record of a life', () => {
  it('starts with the net worth the life begins with, no bankruptcy, and a fresh journal', () => {
    const state = createGame({ content, start: nurse }, 'record');
    expect(recordStart(content, state)).toEqual({ history: [realNetWorth(state)], bankruptcies: 0, journal: { cities: ['madrid'], cardUsed: false, kinds: [], earned: [] } });
  });

  it('adds one net worth for every round played, and none for a card', () => {
    const { state, record } = play(3);
    expect(state.round).toBe(3);
    expect(record.history).toHaveLength(4);
    expect(record.history[3]).toBe(realNetWorth(state));
  });

  it('counts bankruptcies', () => {
    // A lavish life on a nurse's pay ends in bankruptcy within a few rounds.
    const { record, earned } = play(10, [{ type: 'setLifestyle', tier: 3 }]);
    expect(record.bankruptcies).toBeGreaterThan(0);
    expect(record.journal.cardUsed).toBe(true);
    expect(earned.flat()).toContain('bankrupt');
  });

  it('writes each badge into the journal the moment it is earned, and never twice', () => {
    const { record, earned } = play(20, [{ type: 'focus', action: 'studyCareer' }]);
    const all = earned.flat();
    expect(all.length).toBeGreaterThan(0);
    expect(new Set(all).size).toBe(all.length);
    expect(record.journal.earned).toEqual(all);
  });

  it('gives the same record for the same life, step for step', () => {
    expect(play(8).record).toEqual(play(8).record);
  });

  it('does not change the record it was given', () => {
    const state = createGame({ content, start: nurse }, 'record');
    const record = recordStart(content, state);
    const copy = structuredClone(record);
    const card = applyCard(content, state, 0);
    recordStep(content, record, state, card.state, card.events);
    expect(record).toEqual(copy);
  });
});
