import { applyDebtPayments, checkBankruptcy, settleCash } from './debt';
import { expensesForRound, incomeForRound, outgoingsOf, passiveOf } from './economy';
import type { RoundExpenses, RoundIncome } from './economy';
import { assertInvariants } from './invariants';
import { refreshDerived } from './life/derive';
import { finishRound } from './life/roundEnd';
import { cityOf } from './lookup';
import type { Cents } from './money';
import { executeOrder } from './orders';
import { newPlayer } from './player';
import { growPortfolio } from './portfolio';
import { growProperties } from './property';
import { indexed } from './rates';
import { seedRng } from './rng';
import { newTally } from './tally';
import { computeTax } from './tax';
import type { TaxBill } from './tax';
import type {
  Content,
  GameConfig,
  GameEvent,
  GameState,
  LedgerLine,
  OrderContext,
  PlayerState,
  RejectReason,
  RoundChoices,
  RoundTally,
  WorldState,
} from './types';
import { validateContent, validateStart } from './validate';
import { generateTimeline } from './world';

export function createGame(config: GameConfig, seed: string): GameState {
  const errors = validateContent(config.content);
  if (errors.length > 0) throw new Error(`invalid content: ${errors.join('; ')}`);
  const startErrors = validateStart(config.content, config.start);
  if (startErrors.length > 0) throw new Error(`invalid start: ${startErrors.join('; ')}`);
  const timeline = generateTimeline(seed, config.content);
  const state: GameState = {
    seed,
    round: 0,
    timeline,
    player: newPlayer(config.content, config.start, timeline[0]),
    finished: false,
    phase: 'finance',
    hand: [],
    rng: { cards: seedRng(seed, `cards:${config.playerKey ?? ''}`) },
  };
  return state;
}

export interface RejectedOrder {
  /** Position of the order in `choices.orders`. */
  index: number;
  order: unknown;
  reason: RejectReason;
}

/** What a round will pay and charge, worked out without moving prices. */
export interface RoundPreview {
  /** The player as they will stand once the orders have executed, before the round resolves. */
  player: PlayerState;
  income: RoundIncome;
  expenses: Pick<RoundExpenses, 'living' | 'other' | 'debtInterest' | 'debtPrincipal'>;
  /** The tax bill at resolve. It is exact, not an estimate. */
  tax: TaxBill;
  /** Property purchase tax the orders paid from cash. */
  purchaseTaxPaid: Cents;
  /** Cash after income, expenses and tax. If negative, the deposit and then the credit card cover it. */
  cashAfter: Cents;
  rejected: RejectedOrder[];
}

function guard(caller: string, content: Content, state: GameState, choices: RoundChoices): void {
  if (state.finished) throw new Error(`${caller}: the game is already finished`);
  if (typeof choices !== 'object' || choices === null || !Array.isArray(choices.orders)) {
    throw new Error(`${caller}: choices.orders must be an array`);
  }
  assertInvariants(content, state);
}

/** Executes the round's orders on `p` at the prices and rates of `now`. */
function executeChoices(
  content: Content,
  p: PlayerState,
  now: WorldState,
  round: number,
  choices: RoundChoices,
): { tally: RoundTally; rejected: RejectedOrder[] } {
  const tally = newTally();
  const ctx: OrderContext = { content, world: now, round, tally };
  const rejected: RejectedOrder[] = [];
  choices.orders.forEach((order: unknown, index) => {
    const reason = index < content.maxOrdersPerRound ? executeOrder(p, order, ctx) : 'too-many-orders';
    if (reason !== null) rejected.push({ index, order, reason });
  });
  refreshDerived(p, content);
  return { tally, rejected };
}

interface Flows {
  income: RoundIncome;
  expenses: RoundExpenses;
  passive: Cents;
  outgoings: Cents;
  bill: TaxBill;
}

/**
 * Income, expenses and tax for the round, from what the player holds after their orders.
 * Everything is valued at `now`, before prices move, so the player is never charged
 * on the basis of something they could not see when they decided.
 */
function flowsOf(content: Content, p: PlayerState, now: WorldState, tally: RoundTally): Flows {
  const income = incomeForRound(p, content, now);
  const expenses = expensesForRound(p, content, now);
  let propertyValueOwned = 0;
  for (const property of p.properties) propertyValueOwned += property.value;
  const city = cityOf(content, p.cityId);
  const bill = computeTax(city.tax, indexed(city.medianSalaryAnnual, now), content.yearsPerRound, {
    salary: income.salary,
    otherIncome: income.otherPassive,
    pensionContribution: tally.pensionContribution,
    realisedGains: tally.realisedGains,
    dividends: income.dividends + income.interest,
    rent: income.rent,
    propertyValueOwned,
  });
  return { income, expenses, passive: passiveOf(income), outgoings: outgoingsOf(expenses), bill };
}

/**
 * Shows what a round will pay and charge for the given choices, without playing it.
 * It reads only the current world, so it reveals nothing about next round's prices.
 */
export function previewRound(content: Content, state: GameState, choices: RoundChoices): RoundPreview {
  guard('previewRound', content, state, choices);
  const player = structuredClone(state.player);
  const now = state.timeline[state.round];
  const { tally, rejected } = executeChoices(content, player, now, state.round, choices);
  const { income, expenses, passive, outgoings, bill } = flowsOf(content, player, now, tally);
  return {
    player,
    income,
    expenses: {
      living: expenses.living,
      other: expenses.other,
      debtInterest: expenses.debtInterest,
      debtPrincipal: expenses.debtPrincipal,
    },
    tax: bill,
    purchaseTaxPaid: tally.purchaseTaxPaid,
    cashAfter: player.cash + income.salary + passive - outgoings - bill.total,
    rejected,
  };
}

/**
 * Plays one round. The steps run in a fixed order:
 *
 * 1. Orders execute at the prices and rates of this round.
 * 2. Income, expenses and tax are worked out from what the player now holds.
 * 3. Prices move to the next world state.
 * 4. Income is paid; expenses, debt payments and tax are charged.
 * 5. Cash is settled: a shortfall comes from the deposit, then the credit card.
 * 6. Escape and bankruptcy are checked.
 *
 * The state passed in is never changed.
 */
export function applyRound(
  content: Content,
  state: GameState,
  choices: RoundChoices,
): { state: GameState; events: GameEvent[] } {
  guard('applyRound', content, state, choices);

  const next = structuredClone(state);
  const p = next.player;
  const now = next.timeline[next.round];
  const after = next.timeline[next.round + 1];
  const years = content.yearsPerRound;
  const completed = next.round + 1;
  const events: GameEvent[] = [];

  const { tally, rejected } = executeChoices(content, p, now, next.round, choices);
  for (const { order, reason } of rejected) events.push({ kind: 'orderRejected', order, reason });

  const { income, expenses, passive, outgoings, bill } = flowsOf(content, p, now, tally);

  growPortfolio(p, content, now, after);
  growProperties(p, after);

  p.cash += income.salary + passive - outgoings - bill.total;
  applyDebtPayments(p, expenses.service);
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
    ['itemPurchases', -tally.itemsBought],
    ['itemSales', tally.itemsSold],
    ['moving', -tally.movingCost],
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

  finishRound(p, content, events);
  refreshDerived(p, content);
  next.round = completed;
  next.finished = completed >= content.rounds;
  assertInvariants(content, next);
  return { state: next, events };
}
