import { expensesForRound, incomeForRound, outgoingsOf, passiveOf } from './economy';
import { flowsOf } from './flows';
import type { Cents } from './money';
import { PRICE_LEVEL_START } from './rates';
import { scoreOf } from './scoring';
import { newTally } from './tally';
import type { Content, GameView, PlayerState } from './types';

/** Everything owned, with status items at what they would sell for, less everything owed. */
export function netWorth(p: PlayerState): Cents {
  let total = p.cash + p.deposit + p.pension;
  for (const held of Object.values(p.positions)) total += held.value;
  for (const property of p.properties) total += property.value;
  for (const owned of p.life.items) total += owned.value;
  for (const debt of p.debts) total -= debt.principal;
  return total;
}

/** Net worth in start-of-game dollars, so that lives played through different inflation can be compared. */
export function realNetWorth(state: GameView): Cents {
  const world = state.timeline[state.round];
  return Math.floor((netWorth(state.player) * PRICE_LEVEL_START) / world.priceLevel);
}

export function finalScore(content: Content, state: GameView): number {
  const p = state.player;
  return scoreOf(realNetWorth(state), p.statusPoints, p.escapedAtRound, content);
}

/**
 * The two sides of the escape test as the player stands now, before any order: passive income after
 * the tax it would bear with no salary, and outgoings, both for one round. Unlike `previewRound`,
 * this can be asked while the cards are still unanswered, so the rat-race bar always has a figure.
 */
export function escapeProgress(content: Content, state: GameView): { passiveAfterTax: Cents; outgoings: Cents } {
  const { passiveAfterTax, outgoings } = flowsOf(content, state.player, state.timeline[state.round], newTally());
  return { passiveAfterTax, outgoings };
}

/** Yearly figures at the current world's rates, for the HUD. */
export function cashflow(
  content: Content,
  state: GameView,
): { salaryAnnual: Cents; passiveAnnual: Cents; expensesAnnual: Cents } {
  const world = state.timeline[state.round];
  const years = content.yearsPerRound;
  const income = incomeForRound(state.player, content, world);
  const expenses = expensesForRound(state.player, content, world);
  return {
    salaryAnnual: Math.floor(income.salary / years),
    passiveAnnual: Math.floor(passiveOf(income) / years),
    expensesAnnual: Math.floor(outgoingsOf(expenses) / years),
  };
}
