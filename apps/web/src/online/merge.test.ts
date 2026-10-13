import { describe, expect, it } from 'vitest';
import { newProfile } from '@/session/types';
import type { FinishedRun, Profile } from '@/session/types';
import { chooseGame, mergeProgress, mergeRuns, progressOf, readProgress, sameProgress, stepsOf, withProgress } from './merge';
import type { CloudGame, Progress } from './merge';

const progress = (over: Partial<Progress> = {}): Progress => ({ badges: {}, gallery: [], unlocked: {}, guide: { seen: [], off: false }, ...over });
const earned = (at: number, gameId = 'g') => ({ at, gameId });

describe('what is unlocked, from two places', () => {
  it('keeps everything either side has: a badge earned anywhere is earned', () => {
    const device = progress({ badges: { first_100k: earned(10) }, gallery: ['watch_casio', 'car_seat_ibiza'], unlocked: { rider: earned(5) }, guide: { seen: ['news'], off: false } });
    const cloud = progress({ badges: { millionaire: earned(20) }, gallery: ['car_seat_ibiza', 'watch_rolex'], unlocked: { heir: earned(20) }, guide: { seen: ['cards', 'news'], off: true } });
    expect(mergeProgress(device, cloud)).toEqual({
      badges: { first_100k: earned(10), millionaire: earned(20) },
      // The device's order first, then what only the cloud had.
      gallery: ['watch_casio', 'car_seat_ibiza', 'watch_rolex'],
      unlocked: { rider: earned(5), heir: earned(20) },
      // A tip seen anywhere is seen; a guide turned off anywhere is off.
      guide: { seen: ['news', 'cards'], off: true },
    });
  });

  it('dates a badge both sides have by the day it was first earned', () => {
    const merged = mergeProgress(progress({ badges: { mba: earned(50, 'later') } }), progress({ badges: { mba: earned(7, 'first') } }));
    expect(merged.badges.mba).toEqual(earned(7, 'first'));
    expect(mergeProgress(progress({ unlocked: { heir: earned(3, 'a') } }), progress({ unlocked: { heir: earned(9, 'b') } })).unlocked.heir).toEqual(earned(3, 'a'));
  });

  it('is the same whichever side is named first, but for the order of the gallery, and changes neither', () => {
    const a = progress({ badges: { x: earned(1) }, gallery: ['one'], guide: { seen: ['news'], off: false } });
    const b = progress({ badges: { y: earned(2) }, gallery: ['two'], unlocked: { heir: earned(2) } });
    const before = JSON.stringify([a, b]);
    const ab = mergeProgress(a, b);
    const ba = mergeProgress(b, a);
    expect(sameProgress(ab, ba)).toBe(true);
    expect(JSON.stringify([a, b])).toBe(before);
    // Merging what is already merged changes nothing: it can be done as often as two devices meet.
    expect(sameProgress(mergeProgress(ab, a), ab)).toBe(true);
    expect(sameProgress(mergeProgress(ab, b), ab)).toBe(true);
  });

  it('tells two that hold the same from two that do not, whatever the order they keep it in', () => {
    expect(sameProgress(progress({ gallery: ['a', 'b'] }), progress({ gallery: ['b', 'a'] }))).toBe(true);
    expect(sameProgress(progress({ gallery: ['a'] }), progress({ gallery: ['a', 'b'] }))).toBe(false);
    expect(sameProgress(progress({ badges: { x: earned(1) } }), progress({ badges: { x: earned(2) } }))).toBe(false);
    expect(sameProgress(progress({ guide: { seen: [], off: true } }), progress())).toBe(false);
  });

  it('reads what the cloud holds, and makes nothing of what is not progress', () => {
    expect(readProgress(null)).toEqual(progress());
    expect(readProgress('nonsense')).toEqual(progress());
    expect(readProgress({ badges: { ok: earned(1), bad: { at: 'yesterday' } }, gallery: ['a', 7, 'a'], unlocked: [], guide: { seen: ['news', null], off: 'yes' } })).toEqual(
      progress({ badges: { ok: earned(1) }, gallery: ['a'], guide: { seen: ['news'], off: false } }),
    );
  });

  it('is the profile without what belongs to the device, and goes back into it leaving the settings alone', () => {
    const profile: Profile = { ...newProfile(), settings: { reducedMotion: true, sound: false }, badges: { x: earned(1) }, gallery: ['a'] };
    expect(progressOf(profile)).toEqual(progress({ badges: { x: earned(1) }, gallery: ['a'] }));
    const back = withProgress(profile, progress({ badges: { x: earned(1), y: earned(2) }, gallery: ['a', 'b'] }));
    expect(back.settings).toEqual({ reducedMotion: true, sound: false });
    expect(back.gallery).toEqual(['a', 'b']);
    expect(Object.keys(back.badges)).toEqual(['x', 'y']);
  });
});

const run = (runId: string, finishedAt: number, over: Partial<FinishedRun> = {}): FinishedRun => ({
  format: 1, runId, engineVersion: 'e', contentVersion: 'c', lifeId: 'nurse', seed: 's', log: [], finishedAt, score: 1, netWorth: 1, status: 1, escapedAtRound: null, bankruptcies: 0, history: [1], badges: [], cities: ['madrid'], verified: false, ...over,
});

describe('finished lives, from two places', () => {
  it('joins them by id, the latest first, and says which the device did not have', () => {
    const merged = mergeRuns([run('a', 10), run('b', 30)], [run('b', 31, { score: 99 }), run('c', 20)]);
    expect(merged.all.map((one) => one.runId)).toEqual(['b', 'c', 'a']);
    expect(merged.added.map((one) => one.runId)).toEqual(['c']);
    // The device's own copy of a life it has is kept: it holds the seed and the log.
    expect(merged.all[0].score).toBe(1);
  });

  it('adds nothing when the device has them all', () => {
    expect(mergeRuns([run('a', 1)], [run('a', 1)]).added).toEqual([]);
    expect(mergeRuns([], []).all).toEqual([]);
  });
});

const VERSIONS = { engine: '0.4.0', content: '1.3.0' };
const cloudGame = (id: string, steps: number, over: Partial<CloudGame> = {}): CloudGame => ({
  id, lifeId: 'nurse', engineVersion: '0.4.0', contentVersion: '1.3.0', seed: 'seed', round: steps, status: 'playing',
  log: Array.from({ length: steps }, () => ({ picks: [], orders: [] })), updatedAt: '2026-10-13T10:00:00Z', ...over,
});

describe('the life in progress, from two places', () => {
  it('counts how much of a life has been played: every card answered and every round', () => {
    expect(stepsOf([])).toBe(0);
    expect(stepsOf([{ picks: [0, 1], orders: [] }, { picks: [0], orders: null }])).toBe(4);
    expect(stepsOf('not a log')).toBe(0);
  });

  it('takes the account\'s life when the device has none', () => {
    expect(chooseGame(null, [cloudGame('x', 3)], VERSIONS)).toEqual({ take: 'cloud', game: cloudGame('x', 3) });
  });

  it('leaves a life that is over on the device, where its score can still be looked at, and offers the account\'s', () => {
    expect(chooseGame({ gameId: 'old', steps: 40, finished: true }, [cloudGame('x', 3)], VERSIONS)).toEqual({ take: 'device', offer: cloudGame('x', 3) });
    expect(chooseGame({ gameId: 'old', steps: 40, finished: true }, [], VERSIONS)).toEqual({ take: 'device', offer: null });
  });

  it('keeps the device\'s life when the account has none', () => {
    expect(chooseGame({ gameId: 'mine', steps: 2, finished: false }, [], VERSIONS)).toEqual({ take: 'device', offer: null });
    expect(chooseGame(null, [], VERSIONS)).toEqual({ take: 'device', offer: null });
  });

  it('of two copies of the same life, takes the one with more of it played, and never mixes them', () => {
    const device = { gameId: 'same', steps: 5, finished: false };
    expect(chooseGame(device, [cloudGame('same', 9)], VERSIONS)).toEqual({ take: 'cloud', game: cloudGame('same', 9) });
    expect(chooseGame(device, [cloudGame('same', 5)], VERSIONS)).toEqual({ take: 'device', offer: null });
    expect(chooseGame(device, [cloudGame('same', 2)], VERSIONS)).toEqual({ take: 'device', offer: null });
  });

  it('never replaces a different life behind the player\'s back: it offers the account\'s instead', () => {
    const device = { gameId: 'mine', steps: 1, finished: false };
    expect(chooseGame(device, [cloudGame('other', 30)], VERSIONS)).toEqual({ take: 'device', offer: cloudGame('other', 30) });
    // The same life is not an offer, further along or not; another one still is.
    expect(chooseGame(device, [cloudGame('mine', 1), cloudGame('other', 30)], VERSIONS)).toEqual({ take: 'device', offer: cloudGame('other', 30) });
  });

  it('leaves alone what it could not play: other versions, a life that is over, a game with no seed', () => {
    const none = { take: 'device', offer: null };
    expect(chooseGame(null, [cloudGame('x', 3, { engineVersion: '0.3.0' })], VERSIONS)).toEqual(none);
    expect(chooseGame(null, [cloudGame('x', 3, { contentVersion: '9.9.9' })], VERSIONS)).toEqual(none);
    expect(chooseGame(null, [cloudGame('x', 3, { status: 'finished' })], VERSIONS)).toEqual(none);
    expect(chooseGame(null, [cloudGame('x', 3, { status: 'abandoned' })], VERSIONS)).toEqual(none);
    expect(chooseGame(null, [cloudGame('x', 3, { seed: null })], VERSIONS)).toEqual(none);
    // The first it can play is the one it takes: they come the latest first.
    expect(chooseGame(null, [cloudGame('old-version', 9, { engineVersion: '0.3.0' }), cloudGame('good', 2)], VERSIONS)).toEqual({ take: 'cloud', game: cloudGame('good', 2) });
  });
});
