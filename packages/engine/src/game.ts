import { applyDebtPayments, checkBankruptcy, settleCash } from './debt';
import { expensesForRound, incomeForRound, outgoingsOf, passiveOf } from './economy';
import { cityOf } from './lookup';
import type { Cents } from './money';
import { executeOrder } from './orders';
import { newPlayer } from './player';
import { growPortfolio } from './portfolio';
import type { OrderContext, RoundTally } from './portfolio';
import { growProperties } from './property';
import { computeTax } from './tax';
import type { Content, GameConfig, GameEvent, GameState, LedgerLine, RoundChoices } from './types';
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

export function applyRound(
  content: Content,
  state: GameState,
  choices: RoundChoices,
): { state: GameState; events: GameEvent[] } {
  if (state.finished) throw new Error('applyRound: the game is already finished');

  const next = structuredClone(state);
  const p = next.player;
  const events: GameEvent[] = [];
  const now = next.timeline[next.round];
  const after = next.timeline[next.round + 1];
  const years = content.yearsPerRound;
  const completed = next.round + 1;

  const tally: RoundTally = { realisedGains: 0, pensionContribution: 0, propertyPurchases: 0 };
  const ctx: OrderContext = { content, world: now, round: next.round, tally };
  for (const order of choices.orders) {
    const reason = executeOrder(p, order, ctx);
    if (reason !== null) events.push({ kind: 'orderRejected', order, reason });
  }

  const income = incomeForRound(p, content, now);
  const expenses = expensesForRound(p, content, now);
  const passive = passiveOf(income);
  const outgoings = outgoingsOf(expenses);

  growPortfolio(p, content, after);
  growProperties(p, after);

  p.cash += income.salary + passive - outgoings;
  applyDebtPayments(p, expenses.service);

  let propertyValueOwned = 0;
  for (const property of p.properties) propertyValueOwned += property.value;
  const bill = computeTax(cityOf(content, p.cityId), years, {
    salary: income.salary,
    pensionContribution: tally.pensionContribution,
    realisedGains: tally.realisedGains,
    dividends: income.dividends + income.interest,
    rent: income.rent,
    propertyValueOwned,
    propertyPurchases: tally.propertyPurchases,
  });
  p.cash -= bill.total;

  const drawn = settleCash(p);

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
    ['creditCardDraw', drawn],
  ];
  for (const [line, amount] of lines) {
    if (amount !== 0) events.push({ kind: 'ledger', line, amount });
  }

  p.passiveStreak = passive >= outgoings ? p.passiveStreak + 1 : 0;
  if (p.escapedAtRound === null && p.passiveStreak >= 2) {
    p.escapedAtRound = completed - 1;
    events.push({ kind: 'escaped', round: completed - 1 });
  }

  const annualIncome = p.salaryAnnual + Math.floor(passive / years);
  if (checkBankruptcy(p, content, annualIncome, completed)) events.push({ kind: 'bankrupt' });

  next.round = completed;
  next.finished = completed >= content.rounds;
  return { state: next, events };
}
