import { describe, expect, it } from 'vitest';
import type { FinishedRun } from '@/session/types';
import { bestsOf, recordsOf } from './records';

const run = (runId: string, over: Partial<FinishedRun> = {}): FinishedRun => ({
  format: 1, runId, engineVersion: 'e', contentVersion: 'c', lifeId: 'nurse', seed: 's', log: [], finishedAt: 1, score: 300, netWorth: 50_000_000, status: 20,
  escapedAtRound: null, bankruptcies: 0, history: [0, 50_000_000], badges: [], cities: ['madrid'], verified: false, ...over,
});

describe('recordsOf', () => {
  it('has nothing to show before a life is finished', () => {
    expect(recordsOf([])).toEqual({ lives: 0, escaped: 0, bankruptcies: 0, bestScore: null, richest: null, youngestEscape: null, mostStatus: null });
  });

  it('finds the best of each kind among the lives lived', () => {
    const runs = [
      run('a', { score: 310, netWorth: 90_000_000, status: 15, escapedAtRound: 14 }),
      run('b', { score: 420, netWorth: 40_000_000, status: 60, bankruptcies: 2 }),
      run('c', { score: 380, netWorth: 70_000_000, status: 30, escapedAtRound: 9, bankruptcies: 1 }),
    ];
    const records = recordsOf(runs);
    expect(records.lives).toBe(3);
    expect(records.escaped).toBe(2);
    expect(records.bankruptcies).toBe(3);
    expect(records.bestScore?.runId).toBe('b');
    expect(records.richest?.runId).toBe('a');
    expect(records.youngestEscape?.runId).toBe('c');
    expect(records.mostStatus?.runId).toBe('b');
  });

  it('gives a tie to the life that got there first', () => {
    const runs = [run('late', { score: 400, finishedAt: 9 }), run('early', { score: 400, finishedAt: 2 })];
    expect(recordsOf(runs).bestScore?.runId).toBe('early');
  });

  it('counts nobody as having escaped who did not', () => {
    expect(recordsOf([run('a'), run('b')]).youngestEscape).toBeNull();
  });
});

describe('bestsOf', () => {
  const earlier = [run('a', { score: 310, netWorth: 90_000_000, status: 15, escapedAtRound: 14, finishedAt: 1 }), run('b', { score: 420, netWorth: 40_000_000, status: 60, finishedAt: 2 })];

  it('says which personal bests a life has set', () => {
    expect(bestsOf(run('c', { score: 421, netWorth: 100, status: 5, finishedAt: 3 }), earlier)).toEqual(['score']);
    expect(bestsOf(run('c', { score: 100, netWorth: 90_000_001, status: 61, escapedAtRound: 13, finishedAt: 3 }), earlier)).toEqual(['netWorth', 'escape', 'status']);
    expect(bestsOf(run('c', { score: 420, netWorth: 90_000_000, status: 60, escapedAtRound: 14, finishedAt: 3 }), earlier)).toEqual([]);
  });

  it('counts a first escape as a best, since nobody had escaped before', () => {
    expect(bestsOf(run('c', { escapedAtRound: 18, score: 1, netWorth: 1, status: 1 }), [run('a'), run('b')])).toEqual(['escape']);
  });

  it('celebrates nothing in a first life: there is nothing yet to beat', () => {
    expect(bestsOf(run('first', { score: 900, escapedAtRound: 3 }), [])).toEqual([]);
  });

  it('does not measure a life against itself', () => {
    const mine = run('c', { score: 500, finishedAt: 3 });
    expect(bestsOf(mine, [...earlier, mine])).toEqual(['score']);
  });
});
