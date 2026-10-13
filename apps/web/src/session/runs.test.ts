import { describe, expect, it } from 'vitest';
import { readRun } from './runs';

const run = { format: 1, runId: 'r', engineVersion: 'e', contentVersion: 'c', lifeId: 'nurse', seed: 's', log: [], finishedAt: 1_700_000_000_000, score: 300, netWorth: 5, status: 1, escapedAtRound: null, bankruptcies: 0, history: [1, 5], badges: ['first_100k'], cities: ['madrid'], verified: false };

describe('reading a finished life', () => {
  it('takes a sound record as it is', () => {
    expect(readRun(run)).toEqual(run);
  });

  it('opens a life finished before badges and cities were recorded, with none', () => {
    const old: Record<string, unknown> = { ...run };
    delete old.badges;
    delete old.cities;
    expect(readRun(old)).toEqual({ ...run, badges: [], cities: [] });
  });

  it('mends the small things: figures that are no figures, lists that are no lists', () => {
    const read = readRun({ ...run, score: 'high', netWorth: Number.NaN, status: null, bankruptcies: -2, escapedAtRound: 'never', badges: ['a', 3, 'a'], cities: 'madrid', history: [1, 'x', 5], log: 'none' });
    expect(read).toMatchObject({ score: 0, netWorth: 0, status: 0, bankruptcies: 0, escapedAtRound: null, badges: ['a'], cities: [], history: [1, 5], log: [] });
  });

  it('drops what cannot be shown at all: no id, no life, or a day that is no day', () => {
    for (const broken of [null, 'run', 7, [], {}, { ...run, runId: 5 }, { ...run, lifeId: null }, { ...run, finishedAt: Number.NaN }, { ...run, finishedAt: 1e17 }, { ...run, finishedAt: 'today' }]) {
      expect(readRun(broken), JSON.stringify(broken)).toBeNull();
    }
  });
});
