import { rarityOf } from './rarity';

/**
 * Rat ranks: a player level that rises with every life finished, won or not. It is presentation
 * and progression only. It reads what a finished life already holds and gives the player a title;
 * it touches no score, no ranking and no rule of the engine, and a change to it is not a new
 * version of the game.
 */

/** The ranks from the lowest, by id. The words for each are in the messages. */
export const RANKS = ['sewer', 'office', 'stock', 'wall_street', 'tycoon', 'king'] as const;
export type RankId = (typeof RANKS)[number];

/** The points each rank begins at, in the order of `RANKS`. */
export const RANK_FROM: Record<RankId, number> = { sewer: 0, office: 50, stock: 150, wall_street: 350, tycoon: 700, king: 1200 };

/** What a finished life gives: a life lived to the end, however it went. */
export const POINTS_FINISHED = 10;
/** The most a life's badges can give, so that a long gallery of common ones is not worth more than a great life. */
export const POINTS_BADGES_MAX = 60;
export const POINTS_ESCAPED = 25;
export const POINTS_CHALLENGE = 15;
/** What each badge gives, by how rare it is. */
export const POINTS_BADGE = { common: 2, uncommon: 4, rare: 8, legendary: 16 } as const;
/** Net worth reached at the end, in whole currency units, and the points for the highest mark it has reached. */
export const WORTH_POINTS: ReadonlyArray<readonly [number, number]> = [
  [10_000, 2],
  [100_000, 6],
  [1_000_000, 12],
  [10_000_000, 20],
  [100_000_000, 30],
];

/** What of a finished life counts. `netWorth` is in start-of-game cents, as a finished run holds it. */
export interface RankedLife {
  netWorth: number;
  badges: readonly string[];
  escaped: boolean;
  /** The life was an attempt or a practice of a weekly challenge. */
  challenge: boolean;
}

/** The points a finished life gives. Never below the points for finishing, and never fractional. */
export function lifePoints(life: RankedLife): number {
  const units = Number.isFinite(life.netWorth) ? life.netWorth / 100 : 0;
  let worth = 0;
  for (const [mark, points] of WORTH_POINTS) if (units >= mark) worth = points;
  let badges = 0;
  for (const id of new Set(life.badges)) badges += POINTS_BADGE[rarityOf(id)];
  return POINTS_FINISHED + worth + Math.min(POINTS_BADGES_MAX, badges) + (life.escaped ? POINTS_ESCAPED : 0) + (life.challenge ? POINTS_CHALLENGE : 0);
}

/** The rank that points reach. */
export function rankOf(points: number): RankId {
  let found: RankId = RANKS[0];
  for (const id of RANKS) if (points >= RANK_FROM[id]) found = id;
  return found;
}

/** Where a player stands in their rank: the rank, the next one, and how far along (`share` is 0 to 1; 1 and `next` null at the top). */
export interface RankProgress {
  rank: RankId;
  next: RankId | null;
  points: number;
  /** Points still needed for the next rank, 0 at the top. */
  toNext: number;
  share: number;
}

export function progressOf(points: number): RankProgress {
  const total = Number.isFinite(points) ? Math.max(0, Math.trunc(points)) : 0;
  const rank = rankOf(total);
  const next = RANKS[RANKS.indexOf(rank) + 1] ?? null;
  if (next === null) return { rank, next, points: total, toNext: 0, share: 1 };
  const span = RANK_FROM[next] - RANK_FROM[rank];
  return { rank, next, points: total, toNext: RANK_FROM[next] - total, share: (total - RANK_FROM[rank]) / span };
}

/** True when a life took the player to a higher rank than they had. */
export const promoted = (before: number, after: number): boolean => RANKS.indexOf(rankOf(after)) > RANKS.indexOf(rankOf(before));
