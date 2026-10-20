import type { FinishedRun } from '@ratrace/core/session/types';
import { newProfile } from '@ratrace/core/session/types';
import { expect, test } from 'vitest';
import { sameProfile, sameRuns } from './keep';

const run = (runId: string) => ({ runId }) as FinishedRun;

test('a profile read again that says what the one held says is the same: nothing to tell a screen of', () => {
  const held = newProfile();
  expect(sameProfile(held, held)).toBe(true);
  expect(sameProfile(held, structuredClone(held))).toBe(true);
});

test('a profile that has changed anywhere is another: a setting, the guide, a badge, a rank', () => {
  const held = newProfile();
  expect(sameProfile(held, { ...held, settings: { ...held.settings, sound: !held.settings.sound } })).toBe(false);
  expect(sameProfile(held, { ...held, guide: { ...held.guide, seen: [...held.guide.seen, 'news'] } })).toBe(false);
  expect(sameProfile(held, { ...held, rank: { ...held.rank, lives: { ...held.rank.lives, 'run-1': 3 } } } as never)).toBe(false);
});

test('the finished lives read again are the same when there are as many and the latest is the same one', () => {
  expect(sameRuns([], [])).toBe(true);
  expect(sameRuns([run('b'), run('a')], [run('b'), run('a')])).toBe(true);
});

test('they are another list when one more has finished, or one has gone, or the latest is another; and nothing held yet is never the same', () => {
  expect(sameRuns([run('a')], [run('b'), run('a')])).toBe(false);
  expect(sameRuns([run('b'), run('a')], [run('a')])).toBe(false);
  expect(sameRuns([run('b'), run('a')], [run('c'), run('a')])).toBe(false);
  expect(sameRuns(null, [])).toBe(false);
});
