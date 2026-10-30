// "A friend passed you": who a ranked life that has just ended puts its player above, in this week's
// ranking among friends (each player's best ranked life finished this week, weeks from Monday, UTC,
// as the database's `ranking` counts them), and telling each of them, once a day at most.
//
// Kept apart from the database and the push behind it (the ranked function), so that it is tested
// without a server.

import type { RunRow } from './finish.ts';
import type { NoticeAbout } from './notice.ts';

export interface OvertakenDeps {
  /** The player's friends. */
  friendsOf(userId: string): Promise<string[]>;
  /** The best ranked score of each of these players among the lives they finished from `since` on, leaving out the run `except`. A player with none is left out. */
  bestsSince(userIds: string[], since: string, except: string): Promise<Record<string, number>>;
  /** The names the players chose, by id; null or left out for a player with none. */
  names(userIds: string[]): Promise<Record<string, string | null>>;
  /** Takes a player's one notice of being passed on a day ("2026-10-13", UTC): false if they had it already. */
  claim(userId: string, day: string): Promise<boolean>;
  /** Tells a player something, on the browsers and phones they asked to be told on. */
  notify(userId: string, about: Extract<NoticeAbout, { kind: 'overtaken' }>): Promise<void>;
}

const DAY_MS = 86_400_000;

/** Monday 00:00 UTC of the week a moment falls in, as `ranking`'s `date_trunc('week', …)` gives it. */
export function weekStart(at: Date): string {
  const day = Math.floor(at.getTime() / DAY_MS);
  // 1970-01-01 was a Thursday: Monday is three days on from it.
  const monday = day - ((((day - 4) % 7) + 7) % 7);
  return new Date(monday * DAY_MS).toISOString();
}

/**
 * Tells each friend a ranked run has just passed: a friend whose best of the week was at least the
 * player's best before it (or any, if the player had none) and is below the new score. Only a run that
 * is its player's new best of the week passes anyone; a tie leaves the friend who got there first
 * above. Nobody is told of themselves, and a player is told once a day at most, whoever passes them.
 * Answers who was told.
 */
export async function tellOvertaken(deps: OvertakenDeps, run: Pick<RunRow, 'id' | 'user_id' | 'mode' | 'score' | 'finished_at'>, now: Date): Promise<string[]> {
  if (run.mode !== 'ranked') return [];
  const finished = new Date(run.finished_at);
  // A run of a week gone by changes nothing in this one.
  if (Number.isNaN(finished.getTime()) || weekStart(finished) !== weekStart(now)) return [];
  const friends = [...new Set(await deps.friendsOf(run.user_id))].filter((id) => id !== run.user_id);
  if (friends.length === 0) return [];
  const bests = await deps.bestsSince([run.user_id, ...friends], weekStart(finished), run.id);
  const before = Object.hasOwn(bests, run.user_id) ? bests[run.user_id] : null;
  if (before !== null && run.score <= before) return [];
  const passed = friends.filter((id) => Object.hasOwn(bests, id) && bests[id] < run.score && (before === null || bests[id] >= before));
  if (passed.length === 0) return [];
  const who = (await deps.names([run.user_id]))[run.user_id] ?? null;
  const day = now.toISOString().slice(0, 10);
  const told: string[] = [];
  for (const id of passed) {
    if (!(await deps.claim(id, day))) continue;
    await deps.notify(id, { kind: 'overtaken', who, score: run.score, theirs: bests[id] });
    told.push(id);
  }
  return told;
}
