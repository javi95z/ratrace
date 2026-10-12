import { expensesForRound, incomeForRound, outgoingsOf, passiveOf } from './economy';
import type { Cents } from './money';
import { scoreOf } from './scoring';
import type { Content, GameState, PlayerState } from './types';

export function netWorth(p: PlayerState): Cents {
  let total = p.cash + p.deposit + p.pension;
  for (const held of Object.values(p.positions)) total += held.value;
  for (const property of p.properties) total += property.value;
  for (const debt of p.debts) total -= debt.principal;
  return total;
}

export function finalScore(content: Content, state: GameState): number {
  const p = state.player;
  return scoreOf(netWorth(p), p.statusPoints, p.escapedAtRound, content);
}

/** Yearly figures at the current world's rates, for the HUD. */
export function cashflow(
  content: Content,
  state: GameState,
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
