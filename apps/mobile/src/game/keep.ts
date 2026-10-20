import type { FinishedRun, Profile } from '@ratrace/core/session/types';

/*
 * What the game does not tell a screen of: the device is read again after every step (what was earned is in the profile), and nearly always
 * says what it said. A value read again that is the one already held is never put in place of it, so nothing that reads it is drawn again.
 */

/** Whether the profile read says what the one held says. */
export function sameProfile(held: Profile, read: Profile): boolean {
  return held === read || JSON.stringify(held) === JSON.stringify(read);
}

/**
 * Whether the finished lives read are the ones held: as many, and the latest the same (they are listed latest first, and a life that has finished
 * is never changed after, so one more, one less or another latest is every way the list can be another).
 */
export function sameRuns(held: readonly FinishedRun[] | null, read: readonly FinishedRun[]): boolean {
  return held !== null && held.length === read.length && (read.length === 0 || held[0].runId === read[0].runId);
}
