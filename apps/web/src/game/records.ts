import type { FinishedRun } from '@/session/types';

/** The personal bests among the lives lived to the end. Each is the run that holds it, or null. */
export interface Records {
  lives: number;
  /** Lives that ended out of the rat race. */
  escaped: number;
  bankruptcies: number;
  bestScore: FinishedRun | null;
  /** By net worth at the end, in start-of-game dollars. */
  richest: FinishedRun | null;
  youngestEscape: FinishedRun | null;
  mostStatus: FinishedRun | null;
}

export type Best = 'score' | 'netWorth' | 'escape' | 'status';

/** The run that holds a best. A tie goes to the life that got there first. */
function best(runs: readonly FinishedRun[], better: (a: FinishedRun, b: FinishedRun) => boolean): FinishedRun | null {
  let holder: FinishedRun | null = null;
  for (const run of [...runs].sort((a, b) => a.finishedAt - b.finishedAt)) {
    if (holder === null || better(run, holder)) holder = run;
  }
  return holder;
}

const escapedRound = (run: FinishedRun) => run.escapedAtRound ?? Number.POSITIVE_INFINITY;

export function recordsOf(runs: readonly FinishedRun[]): Records {
  const escaped = runs.filter((run) => run.escapedAtRound !== null);
  let bankruptcies = 0;
  for (const run of runs) bankruptcies += run.bankruptcies;
  return {
    lives: runs.length,
    escaped: escaped.length,
    bankruptcies,
    bestScore: best(runs, (a, b) => a.score > b.score),
    richest: best(runs, (a, b) => a.netWorth > b.netWorth),
    youngestEscape: best(escaped, (a, b) => escapedRound(a) < escapedRound(b)),
    mostStatus: best(runs, (a, b) => a.status > b.status),
  };
}

/**
 * The personal bests a life has set, measured against the lives finished before it.
 * A first life sets none: there is nothing yet to beat.
 */
export function bestsOf(run: FinishedRun, runs: readonly FinishedRun[]): Best[] {
  const earlier = runs.filter((other) => other.runId !== run.runId);
  if (earlier.length === 0) return [];
  const before = recordsOf(earlier);
  const bests: Best[] = [];
  if (run.score > (before.bestScore?.score ?? 0)) bests.push('score');
  if (run.netWorth > (before.richest?.netWorth ?? 0)) bests.push('netWorth');
  if (run.escapedAtRound !== null && run.escapedAtRound < (before.youngestEscape ? escapedRound(before.youngestEscape) : Number.POSITIVE_INFINITY)) bests.push('escape');
  if (run.status > (before.mostStatus?.status ?? 0)) bests.push('status');
  return bests;
}
