import { describe, expect, it } from 'vitest';
import { debtServiceForRound } from './debt';
import { applyRound, createGame, previewRound } from './game';
import { executeOrder } from './orders';
import { quoteItem, quoteLiving, quoteLoan, quoteMove, quoteOwnedProperty, quoteProperty } from './quotes';
import { statusBreakdown } from './selectors';
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
  const reason = executeOrder(player, order, { content, world: state.timeline[state.round], round: state.round, tally: newTally(), limits: {} });
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

describe('quoteOwnedProperty', () => {
  it('says of a home what the sale, the rent and the mortgage orders will then do', () => {
    const start = game(20_000_000, { financeSkill: 2 });
    const terms = quoteProperty(content, viewOf(start), 'studio');
    const bought = applyRound(content, start, { orders: [{ type: 'buyProperty', typeId: 'studio', downPayment: terms.minDown, mortgage: 'fixed', rented: false }] }).state;
    const [property] = bought.player.properties;
    const quote = quoteOwnedProperty(content, viewOf(bought), property.id);
    if (!quote) throw new Error('no quote');

    const debt = bought.player.debts.find((d) => d.id === property.mortgageId);
    expect(quote).toMatchObject({ value: property.value, paid: terms.price, rented: false, livedIn: true, letOnly: false });
    expect(quote.mortgage).toEqual({ principal: debt?.principal, rateBp: debt?.fixedRateBp, roundsLeft: debt?.roundsLeft, variable: false });

    // Selling leaves exactly what the quote says, before tax.
    const sold = tryOrder(bought, { type: 'sellProperty', propertyId: property.id });
    expect(sold.player.cash - bought.player.cash).toBe(quote.netOnSale);

    // Let for a round, it brings what the quote says for each of its years, to the cent the rounding allows.
    const let_ = previewRound(content, bought, { orders: [{ type: 'setRented', propertyId: property.id, rented: true }] });
    expect(Math.abs(let_.income.rent - quote.rentAnnual * content.yearsPerRound)).toBeLessThanOrEqual(1);
    expect(quote.rentAnnual).toBeGreaterThan(0);
  });

  it('has no mortgage to tell of a home owned outright, and nothing at all for a home not owned', () => {
    const start = createGame({ content, start: { ...fixtureStart(), cash: 0, life: { ...office, properties: [{ typeId: 'studio', rented: true }] } } }, 'owned');
    const quote = quoteOwnedProperty(content, viewOf(start), start.player.properties[0].id);
    expect(quote).toMatchObject({ mortgage: null, rented: true, livedIn: false, netOnSale: start.player.properties[0].value });
    expect(quoteOwnedProperty(content, viewOf(start), 'property-99')).toBeNull();
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
    expect(quoteItem(content, viewOf(game(0)), 'car_basic')).toMatchObject({ price: 1_200_000, resale: 960_000, upkeepAnnual: 120_000, owned: false, paid: null, forSale: true, soldHere: true, local: false, sellable: false });
  });

  it('quotes the instalments exactly as the order will take them, and why they are refused when they are', () => {
    for (const state of [game(5_000_000), later(game(5_000_000))]) {
      const view = viewOf(state);
      const plan = quoteItem(content, view, 'car_basic').finance;
      if (plan === null) throw new Error('a car is sold on instalments');
      const world = state.timeline[state.round];
      expect(plan.down + plan.loan).toBe(quoteItem(content, view, 'car_basic').price);
      expect(plan).toMatchObject({ rateBp: quoteLoan(content, view).rateBp, termRounds: content.debt.personalLoanTermRounds, lock: null });

      const buy = (cash: number) => tryOrder(withPlayer(content, state, { cash }), { type: 'buyItem', itemId: 'car_basic', financed: true });
      expect(buy(plan.down - 1).reason).toBe('not-enough-cash');
      const bought = buy(plan.down);
      expect(bought.reason).toBeNull();
      expect(bought.player.cash).toBe(0);
      const debt = bought.player.debts[bought.player.debts.length - 1];
      expect(debt).toMatchObject({ kind: 'personalLoan', principal: plan.loan, fixedRateBp: plan.rateBp, roundsLeft: plan.termRounds, forItem: 'car_basic' });
      // What is owed on it is named with the thing, and still is once the thing is sold.
      const owning = { ...state, player: bought.player };
      expect(quoteItem(content, viewOf(owning), 'car_basic').owed).toBe(plan.loan);
      const sold = tryOrder(owning, { type: 'sellItem', itemId: 'car_basic' });
      expect(quoteItem(content, viewOf({ ...state, player: sold.player }), 'car_basic')).toMatchObject({ owned: false, owed: plan.loan });
      expect(quoteItem(content, view, 'car_basic').owed).toBe(0);

      // What a year of it costs is what the first round then charges for that debt, spread over its years.
      const service = debtServiceForRound({ ...bought.player, debts: [debt] }, content, world);
      expect(plan.annual).toBe(Math.round((service.interest + service.principal) / content.yearsPerRound));

      // The lock the quote names is the reason the order gives.
      for (const [over, reason] of [
        [{ cash: plan.down - 1 }, 'not-enough-cash'],
        [{ bankruptUntilRound: state.round + 2 }, 'no-credit'],
        [{ debts: [{ id: 'old', kind: 'personalLoan', principal: 900_000_000, fixedRateBp: 500, roundsLeft: 3 }] }, 'over-loan-limit'],
      ] as Array<[Partial<PlayerState>, RejectReason]>) {
        const stuck = withPlayer(content, state, over);
        expect(quoteItem(content, viewOf(stuck), 'car_basic').finance?.lock, reason).toBe(reason);
        expect(tryOrder(stuck, { type: 'buyItem', itemId: 'car_basic', financed: true }).reason).toBe(reason);
      }
    }
  });

  it('has no instalments for what does not last, for what is already owned, or for what a card gives', () => {
    const view = viewOf(game(5_000_000));
    expect(quoteItem(content, view, 'club').finance).toBeNull();
    expect(quoteItem(content, view, 'trip').finance).toBeNull();
    const owner = withPlayer(content, game(0), {}, { items: [{ itemId: 'car_basic', value: 700_000, roundsLeft: null, paid: 0, age: 0 }], collection: ['car_basic'] });
    expect(quoteItem(content, viewOf(owner), 'car_basic').finance).toBeNull();
    const special = fixtureContent();
    special.items = special.items.map((item) => (item.id === 'car_basic' ? { ...item, cardOnly: true } : item));
    expect(quoteItem(special, viewOf(createGame({ content: special, start: fixtureStart() }, 'quotes')), 'car_basic').finance).toBeNull();
  });

  it('says whether the owner may sell it, exactly as the sell order will decide', () => {
    const special = fixtureContent();
    special.items = special.items.map((item) => (item.id === 'watch_gold' ? { ...item, cardOnly: true } : item));
    const base = createGame({ content: special, start: fixtureStart() }, 'quotes');
    const owning = (itemId: string, roundsLeft: number | null) => withPlayer(special, base, {}, { items: [{ itemId, value: 100_000, roundsLeft, paid: 150_000, age: 0 }], collection: [itemId] });
    const cases: Array<[GameState, string]> = [
      [owning('car_basic', null), 'car_basic'],
      [owning('club', null), 'club'],
      [owning('trip', 2), 'trip'],
      [owning('watch_gold', null), 'watch_gold'],
      [base, 'car_basic'],
    ];
    const answers = cases.map(([state, itemId]) => {
      const sold = executeOrder(structuredClone(state.player), { type: 'sellItem', itemId }, { content: special, world: state.timeline[0], round: 0, tally: newTally(), limits: {} });
      expect(quoteItem(special, viewOf(state), itemId).sellable, itemId).toBe(sold === null);
      return sold;
    });
    // A car and a membership go; a trip already taken and a thing only a card gives do not; nor does what is not owned.
    expect(answers).toEqual([null, null, 'cannot-sell', 'cannot-sell', 'not-owned']);
  });

  it('says what an item already owned would sell for, and what a card-only item is', () => {
    const owner = withPlayer(content, game(0), {}, { items: [{ itemId: 'car_basic', value: 700_000, roundsLeft: null, paid: 0, age: 0 }], collection: ['car_basic'] });
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
    expect(quoteMove(content, viewOf(game(0)), 'haven')).toMatchObject({ cost: 800_000, lapses: [], rungsLost: 0, partnerIdleRounds: 0 });
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
    for (const insurance of ['health', 'home', 'life'] as const) {
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
      rentStatus: [0, 2],
      lifestyleStatus: [0, 0, 0, 9],
      worse: { room: null, frugal: null },
      insurance: { health: 72_000, home: 54_000, life: 36_000 },
      health: { since: null, dearerFrom: null, refused: false },
    });
  });

  it('says what a rented room gives now and when it next gives less, exactly as the status then counts it', () => {
    const late = fixtureContent();
    late.life.agedStatus.room = [{ fromRound: 0, status: 0 }, { fromRound: 2, status: -3 }, { fromRound: 3, status: -6 }];
    let state = createGame({ content: late, start: { ...fixtureStart(), cash: 5_000_000, life: { ...office, rentTier: 0 } } }, 'room');
    const seen: Array<[number, number | null, number]> = [];
    for (let round = 0; round < 4; round++) {
      const quote = quoteLiving(late, viewOf(state));
      seen.push([quote.rentStatus[0], quote.worse.room?.fromRound ?? null, statusBreakdown(late, viewOf(state)).home]);
      expect(quote.rentStatus[1]).toBe(2);
      state = applyRound(late, state, { orders: [] }).state;
    }
    // Neutral for two rounds, warned of from the start; then it costs more at each step, and the warning moves on to the next.
    expect(seen).toEqual([[0, 2, 0], [0, 2, 0], [-3, 3, -3], [-6, null, -6]]);
  });
});
