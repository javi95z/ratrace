import type { GameModule } from './game/types.ts';

const WEEK = /^\d{4}-W\d{2}$/;

/** True for something that has the shape of a week, as "2026-W42". */
export const isWeek = (x: unknown): x is string => typeof x === 'string' && WEEK.test(x);

/**
 * How a life begins on the server: as that life always begins, or under the rule of a week's
 * challenge, which the game's own code says. Null when it cannot: an unknown life, a version from
 * before the challenges, or a week whose challenge is another life.
 */
export function startOf(game: GameModule, lifeId: string, challenge: string | null): unknown | null {
  const life = game.lives.find((one) => one.id === lifeId);
  if (!life) return null;
  if (challenge === null) return life.start;
  if (!game.challengeOf || !game.challengeStart) return null;
  const week = game.challengeOf(challenge, game.lives);
  if (week === null || week.lifeId !== lifeId) return null;
  return game.challengeStart(week, life);
}
