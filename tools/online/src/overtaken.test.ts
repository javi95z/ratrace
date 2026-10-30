import { describe, expect, it } from 'vitest';
import { tellOvertaken, weekStart } from '../../../supabase/functions/_shared/overtaken.ts';
import type { OvertakenDeps } from '../../../supabase/functions/_shared/overtaken.ts';
import type { NoticeAbout } from '../../../supabase/functions/_shared/notice.ts';

const ME = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ANA = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const BEA = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const STRANGER = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
/** A Tuesday: its week began on Monday the 12th. */
const NOW = new Date('2026-10-13T12:00:00.000Z');

interface Run {
  id: string;
  user_id: string;
  mode: 'casual' | 'ranked' | 'room';
  score: number;
  finished_at: string;
}

/** The database as the ranked function reads it for this notice: `runs`, `friendships`, the names and `overtaken_days`, as the migration's functions answer. */
function db() {
  const runs: Run[] = [];
  const friendships: Array<{ follower: string; followed: string }> = [];
  const days = new Map<string, string>();
  const told: Array<{ user: string; about: NoticeAbout }> = [];
  const deps: OvertakenDeps = {
    friendsOf: async (user) => friendships.filter((one) => one.follower === user).map((one) => one.followed),
    // `overtaken_bests`: the best ranked score of each, from `since`, the run just written left out.
    bestsSince: async (users, since, except) => {
      const bests: Record<string, number> = {};
      for (const run of runs) {
        if (run.mode !== 'ranked' || !users.includes(run.user_id) || run.finished_at < since || run.id === except) continue;
        bests[run.user_id] = Math.max(bests[run.user_id] ?? Number.NEGATIVE_INFINITY, run.score);
      }
      return bests;
    },
    names: async (ids) => Object.fromEntries(ids.map((id) => [id, id === ME ? 'Ana' : null])),
    // `overtaken_claim`: once a day.
    claim: async (user, day) => {
      const last = days.get(user);
      if (last !== undefined && last >= day) return false;
      days.set(user, day);
      return true;
    },
    notify: async (user, about) => void told.push({ user, about }),
  };
  const befriend = (a: string, b: string) => friendships.push({ follower: a, followed: b }, { follower: b, followed: a });
  let ids = 0;
  /** A run written now, as the ranked function writes one, and what telling of it did. */
  const finish = async (user: string, score: number, at = NOW, mode: Run['mode'] = 'ranked') => {
    const run = { id: `run-${(ids += 1)}`, user_id: user, mode, score, finished_at: at.toISOString() };
    runs.push(run);
    return tellOvertaken(deps, run, at);
  };
  return { runs, days, told, deps, befriend, finish };
}

describe('a friend passed you', () => {
  it('counts weeks from Monday, UTC, as the rankings do', () => {
    expect(weekStart(new Date('2026-10-12T00:00:00.000Z'))).toBe('2026-10-12T00:00:00.000Z');
    expect(weekStart(new Date('2026-10-18T23:59:59.999Z'))).toBe('2026-10-12T00:00:00.000Z');
    expect(weekStart(new Date('2026-10-19T00:00:00.000Z'))).toBe('2026-10-19T00:00:00.000Z');
    expect(weekStart(new Date('2027-01-01T08:00:00.000Z'))).toBe('2026-12-28T00:00:00.000Z');
  });

  it('tells a friend the player has just passed this week, once, by the player\'s name and both scores', async () => {
    const d = db();
    d.befriend(ME, ANA);
    await d.finish(ANA, 9215);
    expect(await d.finish(ME, 9840)).toEqual([ANA]);
    expect(d.told).toEqual([{ user: ANA, about: { kind: 'overtaken', who: 'Ana', score: 9840, theirs: 9215 } }]);
  });

  it('tells nobody twice in a day, whoever passes them; the next day, again', async () => {
    const d = db();
    d.befriend(ME, ANA);
    d.befriend(BEA, ANA);
    await d.finish(ANA, 5000);
    expect(await d.finish(ME, 6000)).toEqual([ANA]);
    await d.finish(ANA, 7000);
    expect(await d.finish(ME, 8000)).toEqual([]);
    expect(await d.finish(BEA, 9000)).toEqual([]);
    expect(d.told.filter((one) => one.user === ANA)).toHaveLength(1);
    await d.finish(ANA, 9500, new Date('2026-10-14T09:00:00.000Z'));
    expect(await d.finish(ME, 9900, new Date('2026-10-14T10:00:00.000Z'))).toEqual([ANA]);
  });

  it('tells nobody of a life that is not the player\'s new best of the week, nor of a friend still above, nor of a tie', async () => {
    const d = db();
    d.befriend(ME, ANA);
    d.befriend(ME, BEA);
    await d.finish(BEA, 12000);
    await d.finish(ME, 9000);
    await d.finish(ANA, 8000);
    // Lower than the player's best: their place does not move.
    expect(await d.finish(ME, 8500)).toEqual([]);
    // A friend already below the player's best was passed before: not again.
    expect(await d.finish(ME, 10000)).toEqual([]);
    // A tie leaves the one who got there first above.
    expect(await d.finish(ME, 12000)).toEqual([]);
    expect(d.told).toEqual([]);
  });

  it('tells no player who is not a friend, nor the player, nor a friend with no ranked life this week', async () => {
    const d = db();
    d.befriend(ME, ANA);
    await d.finish(STRANGER, 100);
    await d.finish(ANA, 100, new Date('2026-10-09T12:00:00.000Z'));
    await d.finish(ANA, 100, NOW, 'casual');
    expect(await d.finish(ME, 9000)).toEqual([]);
    expect(d.told).toEqual([]);
  });

  it('passes every friend between the player\'s old best and the new one, and only ranked lives do', async () => {
    const d = db();
    d.befriend(ME, ANA);
    d.befriend(ME, BEA);
    await d.finish(ME, 1000);
    await d.finish(ANA, 1000);
    await d.finish(BEA, 3000);
    expect(await d.finish(ME, 5000, NOW, 'casual')).toEqual([]);
    expect(await d.finish(ME, 5000)).toEqual([ANA, BEA]);
  });
});
