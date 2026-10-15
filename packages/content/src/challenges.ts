import type { GameLimits, StartConfig } from '@ratrace/engine';
import { assets, market } from './assets';
import { assetKind } from './kinds';
import type { LifeDef } from './lives';
import { usd } from './money';
import { debt } from './rules';

/**
 * The weekly challenge: one life and one rule for everyone, for a week. Which life and which rule
 * follow from the week alone, so the device and the server agree on them without asking each other;
 * the world and the cards follow from a seed only the server holds, the same for every player.
 */
export type ChallengeRule = 'indexOnly' | 'noLoans' | 'noMoving' | 'noProperty' | 'startInDebt';
export const CHALLENGE_RULES: readonly ChallengeRule[] = ['indexOnly', 'noLoans', 'noMoving', 'noProperty', 'startInDebt'];

export interface Challenge {
  /** The ISO week, as "2026-W42": weeks begin on Monday, in UTC. */
  week: string;
  lifeId: string;
  rule: ChallengeRule;
}

/** The debt a challenge that starts in debt starts with, at the prices of the start. */
export const CHALLENGE_DEBT = usd(30_000);

const DAY_MS = 86_400_000;
const WEEK = /^(\d{4})-W(\d{2})$/;

/** The ISO week a moment falls in, in UTC: the year of its Thursday, and the week of that year. */
export function weekOf(ms: number): string {
  const day = Math.floor(ms / DAY_MS);
  // 1 January 1970 was a Thursday: day 0 is weekday 4, counting Monday as 1 and Sunday as 7.
  const weekday = ((day + 3) % 7 + 7) % 7 + 1;
  const thursday = new Date((day - weekday + 4) * DAY_MS);
  const year = thursday.getUTCFullYear();
  const week = Math.floor((thursday.getTime() - Date.UTC(year, 0, 1)) / DAY_MS / 7) + 1;
  return `${year}-W${String(week).padStart(2, '0')}`;
}

/** When an ISO week begins: its Monday at midnight, UTC. Null for something that is not a week. */
export function weekStart(week: string): number | null {
  const match = WEEK.exec(week);
  if (!match) return null;
  const year = Number(match[1]);
  const number = Number(match[2]);
  // The first week of a year is the one with 4 January in it.
  const fourth = Date.UTC(year, 0, 4);
  const fourthWeekday = ((new Date(fourth).getUTCDay() + 6) % 7) + 1;
  const start = fourth - (fourthWeekday - 1) * DAY_MS + (number - 1) * 7 * DAY_MS;
  return number >= 1 && weekOf(start) === week ? start : null;
}

/**
 * The challenge of a week, or null for something that is not a week. The life moves on every week
 * and the rule with it, so that the same pair comes back only after many weeks.
 */
export function challengeOf(week: string, all: readonly LifeDef[]): Challenge | null {
  const start = weekStart(week);
  if (start === null) return null;
  // A life added later joins from the week it names: the weeks before it keep the challenge they had.
  const lives = all.filter((life) => life.challengeFrom === undefined || start >= (weekStart(life.challengeFrom) ?? Infinity));
  if (lives.length === 0) return null;
  // Weeks counted from the Monday of 5 January 1970.
  const n = Math.round((start - Date.UTC(1970, 0, 5)) / (7 * DAY_MS));
  const life = lives[((n % lives.length) + lives.length) % lives.length];
  const rule = CHALLENGE_RULES[(((n + Math.floor(n / lives.length)) % CHALLENGE_RULES.length) + CHALLENGE_RULES.length) % CHALLENGE_RULES.length];
  return { week, lifeId: life.id, rule };
}

/** What a rule forbids for the whole game. */
export function challengeLimits(rule: ChallengeRule): GameLimits {
  switch (rule) {
    case 'indexOnly':
      return { onlyAssets: assets.filter((asset) => assetKind(asset) === 'fund').map((asset) => asset.id) };
    case 'noLoans':
      return { noBorrowing: true };
    case 'noMoving':
      return { noMoving: true };
    case 'noProperty':
      return { noProperty: true };
    case 'startInDebt':
      return {};
  }
}

/** How a challenge begins: its life as it always begins, under the rule of the week. */
export function challengeStart(challenge: Challenge, life: LifeDef): StartConfig {
  const start = structuredClone(life.start);
  const limits = challengeLimits(challenge.rule);
  if (challenge.rule === 'startInDebt') {
    // A loan taken out before the game, at the rate of the start, paid off over the usual term.
    start.debts.push({ kind: 'personalLoan', principal: CHALLENGE_DEBT, fixedRateBp: market.start.policyRateBp + debt.personalLoanSpreadBp, roundsLeft: debt.personalLoanTermRounds });
  }
  return Object.keys(limits).length > 0 ? { ...start, limits } : start;
}
