import { lifePoints } from '@ratrace/content';
import type { FinishedRun, Profile } from './types';

/** The points a finished life gives, from what the run already holds. */
export const runPoints = (run: FinishedRun): number =>
  lifePoints({ netWorth: run.netWorth, badges: run.badges, escaped: run.escapedAtRound !== null, challenge: run.challenge !== undefined });

/**
 * The profile with every finished life counted once. A life already counted keeps its points, so a
 * run taken out of the history later takes nothing from the rank, and a profile from before ranks
 * is filled from the lives on the device. Nothing it is given is changed.
 */
export function rankAfter(profile: Profile, runs: readonly FinishedRun[]): Profile {
  const lives = { ...profile.rank.lives };
  let changed = false;
  for (const run of runs) {
    if (Object.hasOwn(lives, run.runId)) continue;
    lives[run.runId] = runPoints(run);
    changed = true;
  }
  if (!changed) return profile;
  return { ...profile, rank: { points: Object.values(lives).reduce((sum, points) => sum + points, 0), lives } };
}
