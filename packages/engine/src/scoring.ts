import { mulDiv } from './money';
import type { Cents } from './money';
import type { Content, ScoringParams } from './types';

export function wealthPoints(netWorth: Cents, breakpoints: ReadonlyArray<readonly [Cents, number]>): number {
  if (netWorth <= breakpoints[0][0]) return breakpoints[0][1];
  for (let i = 1; i < breakpoints.length; i++) {
    const [x0, y0] = breakpoints[i - 1];
    const [x1, y1] = breakpoints[i];
    if (netWorth <= x1) return y0 + mulDiv(netWorth - x0, y1 - y0, x1 - x0);
  }
  return breakpoints[breakpoints.length - 1][1];
}

/** In percent: 100 means no bonus. */
export function escapeMultiplier(escapedAtRound: number | null, rounds: number, scoring: ScoringParams): number {
  if (escapedAtRound === null) return 100;
  return scoring.escapeBase + scoring.escapePerRoundLeft * (rounds - escapedAtRound);
}

export function scoreOf(netWorth: Cents, statusPoints: number, escapedAtRound: number | null, content: Content): number {
  const wealth = wealthPoints(netWorth, content.scoring.wealthBreakpoints);
  const multiplier = escapeMultiplier(escapedAtRound, content.rounds, content.scoring);
  return Math.floor(((wealth + statusPoints) * multiplier) / 100);
}
