import { applyDebtPayments, checkBankruptcy, settleCash } from './debt';
import { expensesForRound, incomeForRound, outgoingsOf, passiveOf } from './economy';
import type { RoundExpenses, RoundIncome } from './economy';
import { assertInvariants } from './invariants';
import { answerCards, drawHand } from './life/cards';
import { refreshDerived } from './life/derive';
import { FLAG_UNSTABLE_PAY, hasFlag } from './life/flags';
import { ageLife, turnPage } from './life/roundEnd';
import { cityOf } from './lookup';
import type { Cents } from './money';
import { executeOrder } from './orders';
import { newPlayer } from './player';
import { growPortfolio } from './portfolio';
import { growProperties } from './property';
import { indexed } from './rates';
import { Rng, seedRng } from './rng';
import { newTally } from './tally';
import { computeTax, effectiveTax } from './tax';
import type { TaxBill } from './tax';
import type {
  CardPicks,
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
  const rng = new Rng(state.rng.cards);
  beginRound(config.content, state, rng);
  state.rng.cards = rng.snapshot();
  return state;
}

/**
 * Opens the round the state is at: a gig worker's pay swings, the hand is drawn,
 * and the phase is set. Both use the player's own random stream.
 */
function beginRound(content: Content, state: GameState, rng: Rng): void {
  const life = state.player.life;
  if (hasFlag(life.flags, FLAG_UNSTABLE_PAY)) {
    const range = content.life.unstablePayPct;
    life.salaryBoostPct += rng.int(2 * range + 1) - range;
    refreshDerived(state.player, content);
  }
  state.hand = drawHand(state, content, rng);
  state.phase = state.hand.length > 0 ? 'cards' : 'finance';
}

/** Answers the hand on `state` itself and moves it to the finance phase. */
function resolveHand(content: Content, state: GameState, picks: CardPicks, events: GameEvent[]): void {
  const rng = new Rng(state.rng.cards);
  answerCards(state, content, picks, rng, events);
  state.rng.cards = rng.snapshot();
  state.phase = 'finance';
}

/**
 * Answers the cards in the player's hand and moves the round on to the finance phase.
 * `picks` maps a card id to the number of the chosen option. It may come from an untrusted client:
 * a card that is missing, a number that is not an option, or an option the player cannot take
 * all fall back to the first option. Dice are rolled here, so nothing random is left for
 * `applyRound`, and `previewRound` stays exact.
 *
 * The state passed in is never changed.
 */
export function applyCards(content: Content, state: GameState, picks: CardPicks): { state: GameState; events: GameEvent[] } {
  if (state.finished) throw new Error('applyCards: the game is already finished');
  if (typeof picks !== 'object' || picks === null || Array.isArray(picks)) {
    throw new Error('applyCards: picks must be a record of card id to option number');
  }
  assertInvariants(content, state);
  if (state.phase !== 'cards') throw new Error('applyCards: the cards of this round are already answered');

  const next = structuredClone(state);
  const events: GameEvent[] = [];
  resolveHand(content, next, picks, events);
  assertInvariants(content, next);
  return { state: next, events };
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
  const bill = computeTax(effectiveTax(city, now), indexed(city.medianSalaryAnnual, now), content.yearsPerRound, {
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
  if (state.phase === 'cards') throw new Error('previewRound: answer the cards first');
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
 * Plays one round. If the hand is still unanswered, every card first takes its first option.
 * Then the steps run in a fixed order:
 *
 * 1. Orders execute at the prices and rates of this round.
 * 2. Income, expenses and tax are worked out from what the player now holds.
 * 3. Prices move to the next world state.
 * 4. Income is paid; expenses, debt payments and tax are charged.
 * 5. Cash is settled: a shortfall comes from the deposit, then the credit card.
 * 6. Escape is checked. The life ages: skills, promotion, item values, family and other clocks.
 * 7. Bankruptcy is checked. A pending move happens. The next hand is drawn.
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

  if (next.phase === 'cards') resolveHand(content, next, {}, events);

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

  const rng = new Rng(next.rng.cards);
  ageLife(p, content, now, after, tally, rng, events);

  // The card limit is set by what the player earned in the round that just ended.
  const annualIncome = Math.floor((income.salary + passive) / years);
  const bankruptcy = checkBankruptcy(p, content, now, annualIncome, completed);
  if (bankruptcy) events.push({ kind: 'bankrupt', ...bankruptcy });

  turnPage(p, events);
  refreshDerived(p, content);
  next.round = completed;
  next.finished = completed >= content.rounds;
  if (next.finished) {
    next.hand = [];
    next.phase = 'finance';
  } else {
    beginRound(content, next, rng);
  }
  next.rng.cards = rng.snapshot();
  assertInvariants(content, next);
  return { state: next, events };
}
