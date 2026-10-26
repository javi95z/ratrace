import { previewRound } from '@ratrace/engine';
import type { Cents, Content, GameView, Order } from '@ratrace/engine';

/**
 * What a choice does to the escape test, a year at a time: the passive income after the tax it would bear with no salary, and
 * the outgoings, once it is made. `back` when the choice is what turns a life that was covered into one that is not: the
 * purchase whose upkeep sends the player back into the rat race.
 */
export interface EscapeShift {
  passiveAnnual: Cents;
  outgoingsAnnual: Cents;
  back: boolean;
}

/** Passive income this share of the outgoings or more: out of the rat race, or close enough for a choice to matter to it. */
const CLOSE_PCT = 50;

/**
 * The escape test with the basket as `before`, and as `after`, both as the engine's own preview of the round works them out (no rule
 * of the game here). Null where there is nothing worth saying: outside the finances, for a life far from the way out, for a choice
 * that changes neither side, or for one the round would refuse.
 */
export function escapeShift(content: Content, view: GameView, before: readonly Order[], after: readonly Order[]): EscapeShift | null {
  if (view.finished || view.phase !== 'finance') return null;
  const was = previewRound(content, view, { orders: [...before] });
  if (was.rejected.length > 0) return null;
  if (was.escape.outgoings <= 0 || was.escape.passiveAfterTax * 100 < was.escape.outgoings * CLOSE_PCT) return null;
  const now = previewRound(content, view, { orders: [...after] });
  if (now.rejected.length > 0) return null;
  if (now.escape.passiveAfterTax === was.escape.passiveAfterTax && now.escape.outgoings === was.escape.outgoings) return null;
  const covered = (escape: { passiveAfterTax: Cents; outgoings: Cents }) => escape.passiveAfterTax >= escape.outgoings;
  const years = content.yearsPerRound;
  return {
    passiveAnnual: Math.floor(now.escape.passiveAfterTax / years),
    outgoingsAnnual: Math.floor(now.escape.outgoings / years),
    back: covered(was.escape) && !covered(now.escape),
  };
}
