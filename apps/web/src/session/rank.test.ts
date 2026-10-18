import { describe, expect, it } from 'vitest';
import { MemoryStore } from './memory';
import { readProfile, settleRank } from './profile';
import { rankAfter, runPoints } from './rank';
import { newProfile } from './types';
import type { FinishedRun } from './types';

const run = (id: string, over: Partial<FinishedRun> = {}): FinishedRun => ({
  format: 1, runId: id, engineVersion: 'e', contentVersion: 'c', lifeId: 'l', seed: 's', log: [], finishedAt: 1, score: 0, netWorth: 0, status: 0,
  escapedAtRound: null, bankruptcies: 0, history: [], badges: [], cities: [], verified: false, ...over,
});

describe('rat rank points', () => {
  it('gives a bad life some points, and a good one more', () => {
    expect(runPoints(run('a', { netWorth: -1e7 }))).toBeGreaterThan(0);
    expect(runPoints(run('b', { netWorth: 2e8, escapedAtRound: 30, badges: ['escaped'], challenge: '2026-W10' }))).toBeGreaterThan(runPoints(run('a')));
  });

  it('counts every life once and keeps points of a run later removed', async () => {
    const store = new MemoryStore();
    await store.addRun(run('a'));
    await store.addRun(run('b', { escapedAtRound: 3 }));
    const first = await settleRank(store);
    expect(Object.keys(first.rank.lives).sort()).toEqual(['a', 'b']);
    expect(first.rank.points).toBe(runPoints(run('a')) + runPoints(run('b', { escapedAtRound: 3 })));
    expect((await settleRank(store)).rank).toEqual(first.rank);
    await store.removeRun('a');
    expect((await settleRank(store)).rank).toEqual(first.rank);
  });

  it('backfills a profile from before ranks without touching the rest', () => {
    const old = readProfile({ format: 1, settings: { reducedMotion: true, sound: false }, badges: { millionaire: { at: 1, gameId: 'g' } } });
    expect(old.rank).toEqual({ points: 0, lives: {} });
    const filled = rankAfter(old, [run('a')]);
    expect(filled.rank.points).toBe(runPoints(run('a')));
    expect({ ...filled, rank: old.rank }).toEqual(old);
    expect(rankAfter(filled, [run('a')])).toBe(filled);
  });

  it('reads a stored rank part by part and trusts the lives over the total', () => {
    const read = readProfile({ ...newProfile(), rank: { points: 9999, lives: { a: 12, b: -3, c: 'x', d: 1.5, e: 8 } } });
    expect(read.rank).toEqual({ points: 20, lives: { a: 12, e: 8 } });
    expect(readProfile({ ...newProfile(), rank: 'junk' }).rank).toEqual({ points: 0, lives: {} });
  });
});
