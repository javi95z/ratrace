import { expensesForRound, incomeForRound, outgoingsOf, passiveOf } from './economy';
import { flowsOf } from './flows';
import { statusParts } from './life/derive';
import type { StatusParts } from './life/derive';
import type { Cents } from './money';
import { PRICE_LEVEL_START } from './rates';
import { escapeMultiplier, wealthPoints } from './scoring';
import { newTally } from './tally';
import type { Content, GameView, PlayerState } from './types';

/** Everything owned, with status items at what they would sell for, less everything owed. */
export function netWorth(p: PlayerState): Cents {
  let total = p.cash + p.deposit + p.pension;
  for (const held of Object.values(p.positions)) total += held.value;
  for (const property of p.properties) total += property.value;
  for (const owned of p.life.items) total += owned.value;
  for (const business of p.businesses) total += business.capital;
  for (const debt of p.debts) total -= debt.principal;
  return total;
}

/** Net worth in start-of-game dollars, so that lives played through different inflation can be compared. */
export function realNetWorth(state: GameView): Cents {
  const world = state.timeline[state.round];
  return Math.floor((netWorth(state.player) * PRICE_LEVEL_START) / world.priceLevel);
}

/** The status the score counts: the average over the rounds played, or the status held now before the first. */
export function livedStatus(state: GameView): number {
  const p = state.player;
  return state.round === 0 ? p.statusPoints : Math.floor(p.statusSum / state.round);
}

export interface ScoreBreakdown {
  /** Points for net worth in start-of-game dollars. */
  wealth: number;
  /** Status, averaged over the life. */
  status: number;
  /** 100 means no escape bonus. */
  multiplierPct: number;
  total: number;
}

/** The score and the three parts it is made of, so that no interface has to work them out again. */
export function scoreBreakdown(content: Content, state: GameView): ScoreBreakdown {
  const wealth = wealthPoints(realNetWorth(state), content.scoring.wealthBreakpoints);
  const status = livedStatus(state);
  const multiplierPct = escapeMultiplier(state.player.escapedAtRound, content.rounds, content.scoring);
  return { wealth, status, multiplierPct, total: Math.floor(((wealth + status) * multiplierPct) / 100) };
}

export function finalScore(content: Content, state: GameView): number {
  return scoreBreakdown(content, state).total;
}

/**
 * The two sides of the escape test as the player stands now, before any order: passive income after
 * the tax it would bear with no salary, and outgoings, both for one round. Unlike `previewRound`,
 * this can be asked while the cards are still unanswered, so the rat-race bar always has a figure.
 */
export function escapeProgress(content: Content, state: GameView): { passiveAfterTax: Cents; outgoings: Cents } {
  return flowsOf(content, state.player, state.timeline[state.round], newTally()).escape;
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

export interface CashflowLines {
  salary: Cents;
  dividends: Cents;
  interest: Cents;
  rent: Cents;
  otherPassive: Cents;
  living: Cents;
  /** Family, insurance, upkeep and whatever else recurs. */
  other: Cents;
  /** Interest and repayment together. */
  debt: Cents;
}

/** The yearly figures of `cashflow`, line by line, so that an interface can show what they are made of. */
export function cashflowLines(content: Content, state: GameView): CashflowLines {
  const world = state.timeline[state.round];
  const years = content.yearsPerRound;
  const income = incomeForRound(state.player, content, world);
  const expenses = expensesForRound(state.player, content, world);
  const yearly = (cents: Cents) => Math.floor(cents / years);
  return {
    salary: yearly(income.salary),
    dividends: yearly(income.dividends),
    interest: yearly(income.interest),
    rent: yearly(income.rent),
    otherPassive: yearly(income.otherPassive),
    living: yearly(expenses.living),
    other: yearly(expenses.other),
    debt: yearly(expenses.debtInterest + expenses.debtPrincipal),
  };
}

/** Status as it stands now, by where it comes from, beside the status the score counts. */
export function statusBreakdown(content: Content, state: GameView): StatusParts & { total: number; lived: number } {
  return { ...statusParts(state.player, content, state.round), total: state.player.statusPoints, lived: livedStatus(state) };
}
