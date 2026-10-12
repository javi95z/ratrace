import { describe, expect, it } from 'vitest';
import { applyRound, createGame, previewRound } from './game';
import { executeOrder } from './orders';
import { quoteItem, quoteLiving, quoteLoan, quoteMove, quoteProperty } from './quotes';
import { newTally } from './tally';
import { fixtureContent, fixtureStart } from './testing/fixture';
import { withPlayer } from './testing/patch';
import type { GameState, LifeStart, Order, PlayerState, RejectReason } from './types';
import { viewOf } from './view';

const content = fixtureContent();
const office: LifeStart = { lifeId: 'tester', career: { id: 'office', level: 0 }, careerSkill: 0, financeSkill: 0, focus: 3 };
const game = (cash: number, life: Partial<LifeStart> = {}): GameState =>
  createGame({ content, start: { ...fixtureStart(), cash, life: { ...office, ...life } } }, 'quotes');

/** Runs one order on a copy of the player and says how it went. */
function tryOrder(state: GameState, order: Order): { reason: RejectReason | null; player: PlayerState } {
  const player = structuredClone(state.player);
  const reason = executeOrder(player, order, { content, world: state.timeline[state.round], round: state.round, tally: newTally() });
  return { reason, player };
}

/** A later round of the same game, where prices have moved. */
const later = (state: GameState, rounds = 3): GameState => {
  let s = state;
  for (let i = 0; i < rounds; i++) s = applyRound(content, s, { orders: [] }).state;
  return s;
};

describe('quoteProperty', () => {
  it('quotes exactly what a purchase costs: the price, the smallest down payment and the tax', () => {
    for (const state of [game(20_000_000), later(game(20_000_000))]) {
      const quote = quoteProperty(content, viewOf(state), 'studio');
      const buy = (downPayment: number, cash: number) =>
        tryOrder(withPlayer(content, state, { cash }), { type: 'buyProperty', typeId: 'studio', downPayment, mortgage: 'fixed', rented: false });

      expect(buy(quote.minDown, quote.minDown + quote.purchaseTax).reason).toBeNull();
      expect(buy(quote.minDown, quote.minDown + quote.purchaseTax - 1).reason).toBe('not-enough-cash');
      expect(buy(quote.minDown - 1, 50_000_000).reason).toBe('down-payment-too-low');
      const bought = buy(quote.minDown, 50_000_000).player;
      expect(bought.properties[0].value).toBe(quote.price);
      expect(bought.debts[0]).toMatchObject({ principal: quote.price - quote.minDown, fixedRateBp: quote.fixedRateBp });
    }
  });

  it('quotes the mortgage rates this player would get, and whether a bank will lend or a tenant may be taken', () => {
    const plain = quoteProperty(content, viewOf(game(0)), 'flat');
    expect(plain).toMatchObject({ price: 25_000_000, minDown: 5_000_000, purchaseTax: 2_000_000, fixedRateBp: 400, variableRateBp: 400, canBorrow: true, canRentOut: true });
    const perk = quoteProperty(content, viewOf(game(0, { flags: ['cheap_mortgage'] })), 'flat');
    expect(perk).toMatchObject({ fixedRateBp: 350, variableRateBp: 350 });
    const locked = quoteProperty(content, viewOf(withPlayer(content, game(0), { bankruptUntilRound: 3 })), 'flat');
    expect(locked.canBorrow).toBe(false);

    const strict = fixtureContent();
    strict.life.rentOutMinFinanceSkill = 2;
    const novice = createGame({ content: strict, start: { ...fixtureStart(), life: office } }, 'quotes');
    expect(quoteProperty(strict, viewOf(novice), 'flat').canRentOut).toBe(false);
  });

  it('refuses a kind of home that does not exist', () => {
    expect(() => quoteProperty(content, viewOf(game(0)), 'castle')).toThrow('unknown property type: castle');
  });
});

describe('quoteItem', () => {
  it('quotes exactly what an item costs today and what it would resell for', () => {
    for (const state of [game(5_000_000), later(game(5_000_000))]) {
      const quote = quoteItem(content, viewOf(state), 'car_basic');
      const buy = (cash: number) => tryOrder(withPlayer(content, state, { cash }), { type: 'buyItem', itemId: 'car_basic' });
      expect(buy(quote.price).reason).toBeNull();
      expect(buy(quote.price - 1).reason).toBe('not-enough-cash');
      expect(buy(quote.price).player.life.items[0].value).toBe(quote.resale);
      expect(quote).toMatchObject({ owned: false, forSale: true });
    }
    expect(quoteItem(content, viewOf(game(0)), 'car_basic')).toEqual({ price: 1_200_000, resale: 960_000, upkeepAnnual: 120_000, owned: false, forSale: true, sellable: false });
  });

  it('says whether the owner may sell it, exactly as the sell order will decide', () => {
    const special = fixtureContent();
    special.items = special.items.map((item) => (item.id === 'watch_gold' ? { ...item, cardOnly: true } : item));
    const base = createGame({ content: special, start: fixtureStart() }, 'quotes');
    const owning = (itemId: string, roundsLeft: number | null) => withPlayer(special, base, {}, { items: [{ itemId, value: 100_000, roundsLeft }], collection: [itemId] });
    const cases: Array<[GameState, string]> = [
      [owning('car_basic', null), 'car_basic'],
      [owning('club', null), 'club'],
      [owning('trip', 2), 'trip'],
      [owning('watch_gold', null), 'watch_gold'],
      [base, 'car_basic'],
    ];
    const answers = cases.map(([state, itemId]) => {
      const sold = executeOrder(structuredClone(state.player), { type: 'sellItem', itemId }, { content: special, world: state.timeline[0], round: 0, tally: newTally() });
      expect(quoteItem(special, viewOf(state), itemId).sellable, itemId).toBe(sold === null);
      return sold;
    });
    // A car and a membership go; a trip already taken and a thing only a card gives do not; nor does what is not owned.
    expect(answers).toEqual([null, null, 'cannot-sell', 'cannot-sell', 'not-owned']);
  });

  it('says what an item already owned would sell for, and what a card-only item is', () => {
    const owner = withPlayer(content, game(0), {}, { items: [{ itemId: 'car_basic', value: 700_000, roundsLeft: null }], collection: ['car_basic'] });
    expect(quoteItem(content, viewOf(owner), 'car_basic')).toMatchObject({ owned: true, resale: 700_000 });
    const special = fixtureContent();
    special.items = special.items.map((item) => (item.id === 'trip' ? { ...item, cardOnly: true } : item));
    const state = createGame({ content: special, start: fixtureStart() }, 'quotes');
    expect(quoteItem(special, viewOf(state), 'trip')).toMatchObject({ forSale: false, resale: 0 });
    expect(() => quoteItem(content, viewOf(game(0)), 'jetpack')).toThrow('unknown item: jetpack');
  });
});

describe('quoteMove', () => {
  it('quotes exactly what moving costs today', () => {
    for (const state of [game(5_000_000), later(game(5_000_000))]) {
      const { cost } = quoteMove(content, viewOf(state), 'haven');
      const move = (cash: number) => tryOrder(withPlayer(content, state, { cash }), { type: 'moveCity', cityId: 'haven' });
      expect(move(cost).reason).toBeNull();
      expect(move(cost - 1).reason).toBe('not-enough-cash');
    }
    expect(quoteMove(content, viewOf(game(0)), 'haven')).toEqual({ cost: 800_000 });
  });
});

describe('quoteLoan', () => {
  it('quotes exactly how much more a bank will lend, and on what terms', () => {
    const state = withPlayer(content, later(game(0)), {
      debts: [{ id: 'debt-1', kind: 'personalLoan', principal: 400_000, fixedRateBp: 700, roundsLeft: 2 }],
      nextId: 1,
    });
    const quote = quoteLoan(content, viewOf(state));
    expect(tryOrder(state, { type: 'borrow', amount: quote.room }).reason).toBeNull();
    expect(tryOrder(state, { type: 'borrow', amount: quote.room + 1 }).reason).toBe('over-loan-limit');
    const loan = tryOrder(state, { type: 'borrow', amount: quote.room }).player.debts[1];
    expect(loan).toMatchObject({ fixedRateBp: quote.rateBp, roundsLeft: quote.termRounds });
    expect(quote.lockedUntilRound).toBeNull();
  });

  it('quotes nothing during the bankruptcy lock, and never less than nothing', () => {
    const locked = withPlayer(content, game(0), { bankruptUntilRound: 3 });
    expect(quoteLoan(content, viewOf(locked))).toMatchObject({ room: 0, lockedUntilRound: 3 });
    const over = withPlayer(content, game(0), { debts: [{ id: 'debt-1', kind: 'personalLoan', principal: 99_000_000, fixedRateBp: 700, roundsLeft: 2 }], nextId: 1 });
    expect(quoteLoan(content, viewOf(over)).room).toBe(0);
    expect(quoteLoan(content, viewOf(game(0)))).toEqual({ room: 2_400_000, rateBp: 750, termRounds: 3, lockedUntilRound: null });
  });
});

describe('quoteLiving', () => {
  it('quotes the yearly living cost of every lifestyle and every way of renting, exactly as a round charges them', () => {
    const state = later(game(1_000_000));
    const view = viewOf(state);
    const quote = quoteLiving(content, view);
    for (const tier of [0, 1, 2, 3] as const) {
      expect(previewRound(content, view, { orders: [{ type: 'setLifestyle', tier }] }).expenses.living).toBe(quote.tiers[tier] * 2);
    }
    for (const tier of [0, 1] as const) {
      expect(previewRound(content, view, { orders: [{ type: 'setRentTier', tier }] }).expenses.living).toBe((quote.rentTiers?.[tier] ?? 0) * 2);
    }
    for (const insurance of ['health', 'home', 'life', 'liability'] as const) {
      const other = previewRound(content, view, { orders: [{ type: 'setInsurance', insurance, on: true }] }).expenses.other;
      expect(other).toBe(quote.insurance[insurance] * 2);
    }
  });

  it('has no rent to quote for someone who lives in a home they own', () => {
    const owner = createGame({ content, start: { ...fixtureStart(), life: { ...office, properties: [{ typeId: 'flat', rented: false }] } } }, 'quotes');
    const quote = quoteLiving(content, viewOf(owner));
    expect(quote.rentTiers).toBeNull();
    expect(quote.tiers).toEqual([819_000, 1_170_000, 1_638_000, 2_340_000]);
    expect(quoteLiving(content, viewOf(game(0)))).toEqual({
      tiers: [1_260_000, 1_800_000, 2_520_000, 3_600_000],
      rentTiers: [1_548_000, 1_800_000],
      insurance: { health: 72_000, home: 54_000, life: 36_000, liability: 18_000 },
    });
  });
});
