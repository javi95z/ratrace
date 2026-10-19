import { challengeOf, challengeStart } from '@ratrace/content';
import type { LifeDef } from '@ratrace/content';
import type { StartConfig } from '@ratrace/engine';

const WEEK = /^\d{4}-W\d{2}$/;

/** True for something that has the shape of a week, as "2026-W42". */
export const isWeek = (x: unknown): x is string => typeof x === 'string' && WEEK.test(x);

/**
 * How a life begins: as it always does, or, for a week's challenge, under that week's rule. Null
 * when the week's challenge is another life, or the week is no week: such a life was never begun.
 */
export function startFor(lives: ReadonlyArray<LifeDef>, life: LifeDef, challenge?: string): StartConfig | null {
  if (challenge === undefined) return life.start;
  const week = challengeOf(challenge, lives);
  return week !== null && week.lifeId === life.id ? challengeStart(week, life) : null;
}
