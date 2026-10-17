import { growBusinesses } from './business';
import { applyDebtPayments, callMargins, checkBankruptcy, settleCash } from './debt';
import { dividendsByAsset } from './economy';
import type { RoundExpenses, RoundIncome } from './economy';
import { flowsOf } from './flows';
import { assertInvariants, assertViewInvariants } from './invariants';
import { answerNext, answerRest, drawHand } from './life/cards';
import { careerSwing, refreshDerived } from './life/derive';
import { FLAG_UNSTABLE_PAY, hasFlag } from './life/flags';
import { settleEvasion } from './evasion';
import { repairUsed } from './life/orders';
import { ageLife, turnPage } from './life/roundEnd';
import type { Bp, Cents } from './money';
import { executeOrder } from './orders';
import { newPlayer } from './player';
import { growPortfolio, pensionRoom, reinvestDividends, runPlans } from './portfolio';
import { growProperties } from './property';
import { Rng, seedRng } from './rng';
import { newTally } from './tally';
import type { TaxBill } from './tax';
import type { CardPicks, Content, Evaded, GameConfig, GameEvent, GameLimits, GameState, GameView, LedgerLine, OrderContext, PlayerState, RejectReason, RoundChoices, RoundTally, WorldState } from './types';
import { validateContent, validateStart } from './validate';
import { generateTimeline } from './world';

export function createGame(config: GameConfig, seed: string): GameState {
  const errors = validateContent(config.content);
  if (errors.length > 0) throw new Error(`invalid content: ${errors.join('; ')}`);
  const startErrors = validateStart(config.content, config.start);
  if (startErrors.length > 0) throw new Error(`invalid start: ${startErrors.join('; ')}`);
  const timeline = generateTimeline(seed, config.content, config.start.cityId);
  const state: GameState = {
    seed,
    round: 0,
    timeline,
    player: newPlayer(config.content, config.start, timeline[0]),
    finished: false,
    phase: 'finance',
    hand: [],
    answered: 0,
    rng: { cards: seedRng(seed, `cards:${config.playerKey ?? ''}`) },
    limits: structuredClone(config.start.limits ?? {}),
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
    refreshDerived(state.player, content, state.round);
  }
  // A trade that follows the economy, or that pays the young, is paid this round as the round finds it.
  const swing = careerSwing(state.player, content, state.timeline[state.round].regime, state.round);
  if (swing.cyclePct + swing.fadePct !== 0) {
    life.salaryBoostPct += swing.cyclePct + swing.fadePct;
    refreshDerived(state.player, content, state.round);
  }
  state.hand = drawHand(state, content, rng);
  state.answered = 0;
  state.phase = state.hand.length > 0 ? 'cards' : 'finance';
}

/** Answers, on `state` itself, the next card or every card still waiting, and moves on to the finance phase after the last. */
function resolveHand(content: Content, state: GameState, answer: { next: unknown } | { rest: CardPicks }, events: GameEvent[]): void {
  const rng = new Rng(state.rng.cards);
  if ('rest' in answer) answerRest(state, content, answer.rest, rng, events);
  else answerNext(state, content, answer.next, rng, events);
  state.rng.cards = rng.snapshot();
  if (state.answered >= state.hand.length) state.phase = 'finance';
}

function guardCards(caller: string, content: Content, state: GameState): void {
  if (state.finished) throw new Error(`${caller}: the game is already finished`);
  assertInvariants(content, state);
  if (state.phase !== 'cards') throw new Error(`${caller}: the cards of this round are already answered`);
}

/**
 * Answers the next card of the hand with the option given, and rolls its dice.
 * Cards are answered one at a time so that each is judged as the player stands after the ones
 * before it: an option shown as open is open. After the last card the round moves on to the finance phase.
 *
 * `option` may come from an untrusted client. Anything that is not the number of an open option
 * falls back to the first option. The state passed in is never changed.
 */
export function applyCard(content: Content, state: GameState, option: number | null): { state: GameState; events: GameEvent[] } {
  guardCards('applyCard', content, state);
  const next = structuredClone(state);
  const events: GameEvent[] = [];
  resolveHand(content, next, { next: option }, events);
  assertInvariants(content, next);
  return { state: next, events };
}

/**
 * Answers every card still waiting, each with the option `picks` gives for its id, and moves the
 * round on to the finance phase. A card that `picks` does not name takes its first option.
 * Dice are rolled here and in `applyCard`, so nothing random is left for `applyRound`,
 * and `previewRound` stays exact.
 *
 * The state passed in is never changed.
 */
export function applyCards(content: Content, state: GameState, picks: CardPicks): { state: GameState; events: GameEvent[] } {
  if (state.finished) throw new Error('applyCards: the game is already finished');
  if (typeof picks !== 'object' || picks === null || Array.isArray(picks)) {
    throw new Error('applyCards: picks must be a record of card id to option number');
  }
  guardCards('applyCards', content, state);
  const next = structuredClone(state);
  const events: GameEvent[] = [];
  resolveHand(content, next, { rest: picks }, events);
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
/** What a plan did, or would do, in a round: `reason` is null when it bought. */
export interface PlanRun {
  assetId: string;
  amount: Cents;
  reason: RejectReason | null;
}

export interface RoundPreview {
  /** The player as they will stand once the orders have executed, before the round resolves. */
  player: PlayerState;
  income: RoundIncome;
  expenses: Pick<RoundExpenses, 'living' | 'other' | 'debtInterest' | 'debtPrincipal'>;
  /** The tax bill at resolve. It is exact, not an estimate. */
  tax: TaxBill;
  /** What that bill leaves out that the honest one would have had. */
  evaded: Evaded;
  /** Things bought without an invoice that the orders sell: each one a question asked. */
  noInvoiceSold: number;
  /** Property purchase tax the orders paid from cash. */
  purchaseTaxPaid: Cents;
  /** Cash after income, expenses and tax. If negative, the deposit and then the credit card cover it. */
  cashAfter: Cents;
  /** What the investments pay that will be put back into them instead of kept: all of it, or nothing. Already taken off `cashAfter`. */
  reinvested: Cents;
  /** What each plan will do this round, after the orders: buy, or not and why. */
  plans: PlanRun[];
  /** How much more may be paid into the pension this round, after the orders so far. */
  pensionRoom: Cents;
  /**
   * The two sides of the escape test for this round. The player is out of the rat race once
   * passive income, after the tax it would bear with no salary, covers the outgoings two rounds running.
   */
  escape: { passiveAfterTax: Cents; outgoings: Cents };
  rejected: RejectedOrder[];
}

function guard(caller: string, state: GameView, choices: RoundChoices): void {
  if (state.finished) throw new Error(`${caller}: the game is already finished`);
  if (typeof choices !== 'object' || choices === null || !Array.isArray(choices.orders)) {
    throw new Error(`${caller}: choices.orders must be an array`);
  }
}

/** Executes the round's orders on `p` at the prices and rates of `now`. */
function executeChoices(
  content: Content,
  p: PlayerState,
  now: WorldState,
  round: number,
  choices: RoundChoices,
  limits: GameLimits,
): { tally: RoundTally; rejected: RejectedOrder[]; plans: PlanRun[] } {
  const tally = newTally();
  const ctx: OrderContext = { content, world: now, round, tally, limits };
  const rejected: RejectedOrder[] = [];
  choices.orders.forEach((order: unknown, index) => {
    const reason = index < content.maxOrdersPerRound ? executeOrder(p, order, ctx) : 'too-many-orders';
    if (reason !== null) rejected.push({ index, order, reason });
  });
  // The plans come last: what the player ordered by hand this round is served first, and a plan takes what is left.
  const plans = runPlans(p, ctx);
  refreshDerived(p, content, round);
  return { tally, rejected, plans };
}

/**
 * Shows what a round will pay and charge for the given choices, without playing it.
 * It reads only the current world, so it reveals nothing about next round's prices,
 * and a view of the game is all it needs.
 */
export function previewRound(content: Content, state: GameView, choices: RoundChoices): RoundPreview {
  guard('previewRound', state, choices);
  assertViewInvariants(content, state);
  if (state.phase === 'cards') throw new Error('previewRound: answer the cards first');
  const player = structuredClone(state.player);
  const now = state.timeline[state.round];
  const { tally, rejected, plans } = executeChoices(content, player, now, state.round, choices, state.limits);
  const { income, expenses, passive, outgoings, escape, bill, evaded } = flowsOf(content, player, now, tally);
  const cashAfter = player.cash + income.salary + passive - outgoings - bill.total;
  // The same rule the round then follows: all of it, if the cash is there once the bills are met.
  const reinvested = player.reinvest && income.dividends > 0 && cashAfter >= income.dividends ? income.dividends : 0;
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
    evaded,
    noInvoiceSold: tally.noInvoiceSold,
    purchaseTaxPaid: tally.purchaseTaxPaid,
    cashAfter: cashAfter - reinvested,
    reinvested,
    pensionRoom: pensionRoom(player, content, now, tally.pensionContribution),
    escape,
    rejected,
    plans,
  };
}

/**
 * Plays one round. Any card still unanswered first takes its first option.
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
  guard('applyRound', state, choices);
  assertInvariants(content, state);

  const next = structuredClone(state);
  const p = next.player;
  const now = next.timeline[next.round];
  const after = next.timeline[next.round + 1];
  const years = content.yearsPerRound;
  const completed = next.round + 1;
  const events: GameEvent[] = [];

  if (next.phase === 'cards') resolveHand(content, next, { rest: {} }, events);

  const { tally, rejected, plans } = executeChoices(content, p, now, next.round, choices, next.limits);
  for (const { order, reason } of rejected) events.push({ kind: 'orderRejected', order, reason });
  for (const plan of plans) events.push({ kind: 'planRan', ...plan });

  // The status this round was lived with: after the cards and the orders, before anything ages.
  p.statusSum += p.statusPoints;
  // What a tease gave or took was for this round alone.
  delete p.life.statusNudge;

  const { income, expenses, passive, outgoings, escape, bill, evaded } = flowsOf(content, p, now, tally);
  const paid = dividendsByAsset(p, content, now);

  growPortfolio(p, content, now, after);
  growProperties(p, after);
  for (const sale of tally.businessesSold) events.push({ kind: 'businessSold', ...sale });
  // The player's own dice: a new business may fail, and what was bought second hand may need a repair.
  const rng = new Rng(next.rng.cards);
  // What each business kept or lost this round goes into it now, at the economy the round was lived in.
  const grown = growBusinesses(p, content, now, after, rng);
  for (const typeId of grown.closed) events.push({ kind: 'businessClosed', typeId });
  for (const fail of grown.failed) events.push({ kind: 'businessFailed', ...fail });

  p.cash += income.salary + passive - outgoings - bill.total;
  applyDebtPayments(p, expenses.service);
  // What others owe comes back as their loans are paid: the same share, round by round.
  p.cash += collectLent(p);
  const repairs = repairUsed(p, content, now, rng);
  let repaired = 0;
  for (const repair of repairs) {
    repaired += repair.amount;
    events.push({ kind: 'repair', ...repair });
  }
  // What was hidden from the tax office is written down, and an inspection may come for it.
  const audited = settleEvasion(content, p, evaded, tally.noInvoiceSold, next.round, rng, events);
  // After every bill of the round, and before spare cash goes to the credit card: the player asked for this first.
  const reinvested = reinvestDividends(p, paid);
  // The round's prices are in: a holding bought with borrowed money that has fallen too far is sold now, loan first.
  for (const call of callMargins(p, content)) events.push({ kind: 'marginCall', ...call });
  const settled = settleCash(p);

  const lines: Array<[LedgerLine, Cents]> = [
    ['salary', income.salary],
    ['dividends', income.dividends],
    ['interest', income.interest],
    ['rent', income.rent],
    ['business', income.business],
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
    ['mortgageFee', -tally.mortgageFees],
    ['depositDraw', settled.fromDeposit],
    ['creditCardDraw', settled.drawn],
    ['creditCardRepay', -settled.repaid],
    ['dividendsReinvested', -reinvested],
    ['repairs', -repaired],
    ['taxAudit', -audited],
  ];
  for (const [line, amount] of lines) {
    if (amount !== 0) events.push({ kind: 'ledger', line, amount });
  }

  // Out of the rat race after two covering rounds in a row; back in it after the first that does not cover.
  const covered = escape.passiveAfterTax >= escape.outgoings;
  p.passiveStreak = covered ? p.passiveStreak + 1 : 0;
  if (p.escapedAtRound === null && p.passiveStreak >= 2) {
    p.escapedAtRound = completed - 1;
    events.push({ kind: 'escaped', round: completed - 1 });
  } else if (p.escapedAtRound !== null && !covered) {
    p.escapedAtRound = null;
    events.push({ kind: 'escapeLost' });
  }

  ageLife(p, content, now, after, tally, rng, events);

  // The card limit is set by what the player earned in the round that just ended.
  const annualIncome = Math.floor((income.salary + passive) / years);
  const bankruptcy = checkBankruptcy(p, content, now, annualIncome, completed);
  if (bankruptcy) events.push({ kind: 'bankrupt', ...bankruptcy });

  turnPage(p, content, events);
  // Judged as of the round now opening: this is the status the player starts it with.
  refreshDerived(p, content, completed);
  next.round = completed;
  next.finished = completed >= content.rounds;
  if (next.finished) {
    next.hand = [];
    next.answered = 0;
    next.phase = 'finance';
  } else {
    beginRound(content, next, rng);
  }
  next.rng.cards = rng.snapshot();
  assertInvariants(content, next);
  return { state: next, events };
}

/**
 * The principal that comes back this round on what the player lent, as `debtServiceForRound` has the
 * borrower pay it: a share by the rounds left, and the rest at the last. Paid-up loans are dropped.
 */
function collectLent(p: PlayerState): Cents {
  if (!p.lent) return 0;
  let back = 0;
  for (const loan of p.lent) {
    const due = loan.roundsLeft <= 1 ? loan.principal : Math.ceil(loan.principal / loan.roundsLeft);
    loan.principal -= due;
    loan.roundsLeft = Math.max(0, loan.roundsLeft - 1);
    back += due;
  }
  p.lent = p.lent.filter((loan) => loan.principal > 0);
  if (p.lent.length === 0) delete p.lent;
  return back;
}

/** Most a loan between players may be, and how long and how dear: a bound on what a log may hold, not a rule of the game. */
const PEER_MAX: Cents = 1_000_000_000_00;
const PEER_MAX_RATE: Bp = 2_000;
const PEER_MAX_ROUNDS = 10;
const isText = (x: unknown): x is string => typeof x === 'string' && x.length > 0 && x.length <= 64;
const isWhole = (x: unknown, max: number, min = 0): x is number => typeof x === 'number' && Number.isSafeInteger(x) && x >= min && x <= max;

/**
 * Plays what the other players of a game with friends did to this life in the round just played,
 * as the server wrote it into the log when the round turned. A tease takes status from the round
 * to come. Anything else is refused: the log is not one a game could have been played with.
 *
 * The state passed in is never changed.
 */
export function applyRoomEvents(content: Content, state: GameState, room: readonly unknown[]): { state: GameState; events: GameEvent[] } {
  if (state.phase === 'cards' && state.answered > 0) throw new Error('applyRoomEvents: a round is half answered');
  const next = structuredClone(state);
  const events: GameEvent[] = [];
  const p = next.player;
  for (const event of room) {
    const e = (typeof event === 'object' && event !== null ? event : {}) as Record<string, unknown>;
    if (e.kind === 'teased' && isText(e.by)) {
      if (next.finished) continue;
      p.life.statusNudge = (p.life.statusNudge ?? 0) - content.life.teasedStatus;
      events.push({ kind: 'teased', by: e.by, status: -content.life.teasedStatus });
    } else if ((e.kind === 'lent' || e.kind === 'borrowed') && isText(e.id) && isText(e.kind === 'lent' ? e.to : e.from) && isWhole(e.amount, PEER_MAX, 1) && isWhole(e.rateBp, PEER_MAX_RATE) && isWhole(e.rounds, PEER_MAX_ROUNDS, 1)) {
      const peer = (e.kind === 'lent' ? e.to : e.from) as string;
      const terms = { amount: e.amount, rateBp: e.rateBp, rounds: e.rounds };
      if (next.finished) continue;
      if (e.kind === 'lent') {
        // The server pays out only what the lender has: anything else is not a game that was played.
        if (p.cash < terms.amount || p.lent?.some((loan) => loan.id === e.id)) throw new Error('applyRoomEvents: a loan the lender cannot pay out');
        p.cash -= terms.amount;
        p.lent = [...(p.lent ?? []), { id: e.id, peer, principal: terms.amount, fixedRateBp: terms.rateBp, roundsLeft: terms.rounds }];
        events.push({ kind: 'lent', to: peer, ...terms });
      } else {
        if (p.debts.some((debt) => debt.id === e.id)) throw new Error('applyRoomEvents: a loan already owed');
        p.cash += terms.amount;
        p.debts.push({ id: e.id, kind: 'personalLoan', principal: terms.amount, fixedRateBp: terms.rateBp, roundsLeft: terms.rounds, peer });
        events.push({ kind: 'borrowed', from: peer, ...terms });
      }
    } else if (e.kind === 'defaulted' && isText(e.id)) {
      const loan = p.lent?.find((each) => each.id === e.id);
      if (!loan) continue;
      p.lent = p.lent?.filter((each) => each.id !== e.id);
      if (p.lent?.length === 0) delete p.lent;
      events.push({ kind: 'defaulted', by: loan.peer, lost: loan.principal });
    } else throw new Error('applyRoomEvents: not a room event');
  }
  if (events.length === 0) return { state: next, events };
  refreshDerived(next.player, content, next.round);
  assertInvariants(content, next);
  return { state: next, events };
}
