import { applyDebtPayments, checkBankruptcy, settleCash } from './debt';
import { expensesForRound, incomeForRound, outgoingsOf, passiveOf } from './economy';
import { cityOf } from './lookup';
import type { Cents } from './money';
import { executeOrder } from './orders';
import { newPlayer } from './player';
import { growPortfolio } from './portfolio';
import { growProperties } from './property';
import { indexed } from './rates';
import { computeTax } from './tax';
import type {
  Content,
  GameConfig,
  GameEvent,
  GameState,
  LedgerLine,
  OrderContext,
  RoundChoices,
  RoundTally,
} from './types';
import { validateContent } from './validate';
import { generateTimeline } from './world';

export function createGame(config: GameConfig, seed: string): GameState {
  const errors = validateContent(config.content);
  if (errors.length > 0) throw new Error(`invalid content: ${errors.join('; ')}`);
  cityOf(config.content, config.start.cityId);
  return {
    seed,
    round: 0,
    timeline: generateTimeline(seed, config.content),
    player: newPlayer(config.start),
    finished: false,
  };
}

/**
 * Plays one round. The steps run in a fixed order:
 *
 * 1. Orders execute at the prices and rates of this round.
 * 2. Income, expenses and tax are worked out from what the player now holds, at this round's rates.
 * 3. Prices move to the next world state.
 * 4. Income is paid, expenses and debt payments are charged, tax is charged.
 * 5. Cash is settled: a shortfall comes from the deposit, then the credit card.
 * 6. Escape and bankruptcy are checked.
 *
 * Everything in step 2 uses values from before prices move, so nothing the player is charged
 * depends on information they could not see when they decided.
 */
export function applyRound(
  content: Content,
  state: GameState,
  choices: RoundChoices,
): { state: GameState; events: GameEvent[] } {
  if (state.finished) throw new Error('applyRound: the game is already finished');
  if (typeof choices !== 'object' || choices === null || !Array.isArray(choices.orders)) {
    throw new Error('applyRound: choices.orders must be an array');
  }

  const next = structuredClone(state);
  const p = next.player;
  const events: GameEvent[] = [];
  const now = next.timeline[next.round];
  const after = next.timeline[next.round + 1];
  const years = content.yearsPerRound;
  const completed = next.round + 1;

  const tally: RoundTally = { realisedGains: 0, pensionContribution: 0, purchaseTaxPaid: 0 };
  const ctx: OrderContext = { content, world: now, round: next.round, tally };
  choices.orders.forEach((order: unknown, i) => {
    const reason = i < content.maxOrdersPerRound ? executeOrder(p, order, ctx) : 'too-many-orders';
    if (reason !== null) events.push({ kind: 'orderRejected', order, reason });
  });

  const income = incomeForRound(p, content, now);
  const expenses = expensesForRound(p, content, now);
  const passive = passiveOf(income);
  const outgoings = outgoingsOf(expenses);
  let propertyValueOwned = 0;
  for (const property of p.properties) propertyValueOwned += property.value;
  const city = cityOf(content, p.cityId);
  const bill = computeTax(city.tax, indexed(city.medianSalaryAnnual, now), years, {
    salary: income.salary,
    otherIncome: income.otherPassive,
    pensionContribution: tally.pensionContribution,
    realisedGains: tally.realisedGains,
    dividends: income.dividends + income.interest,
    rent: income.rent,
    propertyValueOwned,
  });

  growPortfolio(p, content, now, after);
  growProperties(p, after);

  p.cash += income.salary + passive - outgoings;
  applyDebtPayments(p, expenses.service);
  p.cash -= bill.total;
  const settled = settleCash(p);

  const lines: Array<[LedgerLine, Cents]> = [
    ['salary', income.salary],
    ['dividends', income.dividends],
    ['interest', income.interest],
    ['rent', income.rent],
    ['otherPassive', income.otherPassive],
    ['living', -expenses.living],
    ['otherExpenses', -expenses.other],
    ['debtInterest', -expenses.debtInterest],
    ['debtPrincipal', -expenses.debtPrincipal],
    ['incomeTax', -bill.income],
    ['investmentTax', -bill.investment],
    ['propertyTax', -bill.property],
    ['purchaseTax', -tally.purchaseTaxPaid],
    ['depositDraw', settled.fromDeposit],
    ['creditCardDraw', settled.drawn],
    ['creditCardRepay', -settled.repaid],
  ];
  for (const [line, amount] of lines) {
    if (amount !== 0) events.push({ kind: 'ledger', line, amount });
  }

  p.passiveStreak = passive >= outgoings ? p.passiveStreak + 1 : 0;
  if (p.escapedAtRound === null && p.passiveStreak >= 2) {
    p.escapedAtRound = completed - 1;
    events.push({ kind: 'escaped', round: completed - 1 });
  }

  const annualIncome = indexed(p.salaryAnnual, now) + Math.floor(passive / years);
  const bankruptcy = checkBankruptcy(p, content, now, annualIncome, completed);
  if (bankruptcy) events.push({ kind: 'bankrupt', ...bankruptcy });

  next.round = completed;
  next.finished = completed >= content.rounds;
  return { state: next, events };
}
