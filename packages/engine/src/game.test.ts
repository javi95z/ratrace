import { describe, expect, it } from 'vitest';
import { applyRound, createGame, previewRound } from './game';
import { PRICE_LEVEL_START } from './rates';
import { cashflow, cashflowLines, finalScore, livedStatus, netWorth, realNetWorth, statusBreakdown } from './selectors';
import { taxAnnual } from './flowTax';
import { fixtureContent, fixtureStart } from './testing/fixture';
import { passive, withPlayer as patched } from './testing/patch';
import type { GameEvent, GameState, LedgerLine } from './types';

const content = fixtureContent();

const ledger = (events: GameEvent[], line: LedgerLine): number | undefined => {
  const found = events.find((e) => e.kind === 'ledger' && e.line === line);
  return found && found.kind === 'ledger' ? found.amount : undefined;
};

const rejections = (events: GameEvent[]) => events.flatMap((e) => (e.kind === 'orderRejected' ? [e.reason] : []));

const withPlayer = (state: GameState, over: Partial<GameState['player']>, life: Partial<GameState['player']['life']> = {}) =>
  patched(content, state, over, life);

/** An amount in start-of-game dollars, at the price level of the given round. */
const atRound = (state: GameState, round: number, amount: number) =>
  Math.floor((amount * state.timeline[round].priceLevel) / PRICE_LEVEL_START);

describe('createGame', () => {
  it('builds the timeline and the player', () => {
    const state = createGame({ content, start: fixtureStart() }, 'new');
    expect(state.round).toBe(0);
    expect(state.finished).toBe(false);
    expect(state.timeline).toHaveLength(21);
    expect(state.player.cityId).toBe('home');
  });

  it('refuses invalid content and unknown cities', () => {
    expect(() => createGame({ content: { ...content, rounds: 0 }, start: fixtureStart() }, 's')).toThrow('invalid content: rounds must be a positive integer');
    expect(() => createGame({ content, start: { ...fixtureStart(), cityId: 'atlantis' } }, 's')).toThrow('unknown city: atlantis');
  });
});

describe('applyRound: the basic round', () => {
  it('pays salary, charges living costs and income tax', () => {
    const start = createGame({ content, start: fixtureStart() }, 'g1');
    const { state, events } = applyRound(content, start, { orders: [] });
    expect(state.round).toBe(1);
    expect(state.player.cash).toBe(1_830_000);
    expect(ledger(events, 'salary')).toBe(6_000_000);
    expect(ledger(events, 'living')).toBe(-3_600_000);
    expect(ledger(events, 'incomeTax')).toBe(-570_000);
    expect(ledger(events, 'dividends')).toBeUndefined();
  });

  it('does not change the state it was given', () => {
    const start = createGame({ content, start: { ...fixtureStart(), cash: 500_000 } }, 'g2');
    const before = JSON.stringify(start);
    applyRound(content, start, { orders: [{ type: 'buy', assetId: 'gold', amount: 100_000 }] });
    expect(JSON.stringify(start)).toBe(before);
  });

  it('executes orders now and applies the next world step to them', () => {
    const start = createGame({ content, start: { ...fixtureStart(), cash: 1_000_000 } }, 'g3');
    const { state } = applyRound(content, start, { orders: [{ type: 'buy', assetId: 'fund_world', amount: 1_000_000 }] });
    const ret = start.timeline[1].assetReturnBp.fund_world;
    expect(state.player.positions.fund_world).toEqual({ value: 1_000_000 + 100 * ret, basis: 1_000_000 });
  });

  it('reports a rejected order and carries on as if it was not there', () => {
    const start = createGame({ content, start: fixtureStart() }, 'g4');
    const bad = applyRound(content, start, { orders: [{ type: 'buy', assetId: 'fund_world', amount: 12.5 }] });
    const none = applyRound(content, start, { orders: [] });
    expect(bad.events.filter((e) => e.kind === 'orderRejected')).toEqual([
      { kind: 'orderRejected', order: { type: 'buy', assetId: 'fund_world', amount: 12.5 }, reason: 'bad-amount' },
    ]);
    expect(bad.state).toEqual(none.state);
  });

  it('gives the same result after a JSON round trip of the state', () => {
    const start = createGame({ content, start: { ...fixtureStart(), cash: 2_000_000 } }, 'g9');
    const orders = [{ type: 'buy' as const, assetId: 'coin_meme', amount: 500_000 }];
    const direct = applyRound(content, applyRound(content, start, { orders }).state, { orders: [] });
    const reloaded = JSON.parse(JSON.stringify(applyRound(content, start, { orders }).state)) as GameState;
    expect(applyRound(content, reloaded, { orders: [] })).toEqual(direct);
  });

  it('finishes after the last round and then refuses to continue', () => {
    let state = createGame({ content, start: fixtureStart() }, 'g10');
    for (let i = 0; i < 20; i++) state = applyRound(content, state, { orders: [] }).state;
    expect(state.finished).toBe(true);
    expect(() => applyRound(content, state, { orders: [] })).toThrow('applyRound: the game is already finished');
  });
});

describe('applyRound: corrupt input', () => {
  it('refuses a state that breaks an invariant instead of computing with it', () => {
    const good = createGame({ content, start: fixtureStart() }, 'bad');
    const tier = JSON.parse(JSON.stringify(good));
    tier.player.lifestyleTier = 4;
    expect(() => applyRound(content, tier, { orders: [] })).toThrow(
      /^invariant broken at round 0 \(state [0-9a-f]{16}\): lifestyleTier is not 0, 1, 2 or 3: 4$/,
    );
    const cash = JSON.parse(JSON.stringify(good));
    cash.player.cash = null;
    expect(() => applyRound(content, cash, { orders: [] })).toThrow('cash is not a non-negative whole number: null');
  });

  it('refuses a start that makes no sense', () => {
    expect(() => createGame({ content, start: { ...fixtureStart(), cash: -5 } }, 's')).toThrow(
      'invalid start: cash must be a non-negative whole number of cents',
    );
  });
});

describe('applyRound: inflation', () => {
  it('raises salary, living cost and the tax brackets with the price level from the second round on', () => {
    const start = createGame({ content, start: fixtureStart() }, 'inflation');
    const first = applyRound(content, start, { orders: [] });
    const second = applyRound(content, first.state, { orders: [] });
    expect(start.timeline[1].priceLevel).not.toBe(PRICE_LEVEL_START);
    expect(ledger(second.events, 'salary')).toBe(atRound(start, 1, 3_000_000) * 2);
    expect(ledger(second.events, 'living')).toBe(-atRound(start, 1, 1_800_000) * 2);
    const median = atRound(start, 1, 3_000_000);
    const taxable = atRound(start, 1, 3_000_000) - Math.floor(median / 2);
    expect(ledger(second.events, 'incomeTax')).toBe(-Math.round((taxable * 1_900) / 10_000) * 2);
  });
});

describe('applyRound: tax inputs', () => {
  it('taxes other passive income as income', () => {
    const start = withPlayer(createGame({ content, start: fixtureStart() }, 't1'), {}, { recurring: passive(3_000_000) });
    const { events } = applyRound(content, start, { orders: [] });
    expect(ledger(events, 'otherPassive')).toBe(6_000_000);
    expect(ledger(events, 'incomeTax')).toBe(-2_040_000);
  });

  it('taxes a realised gain, and not an unrealised one', () => {
    const base = createGame({ content, start: fixtureStart() }, 't2');
    const start = withPlayer(base, { positions: { gold: { value: 2_000_000, basis: 500_000 } } });
    const held = applyRound(content, start, { orders: [] });
    expect(ledger(held.events, 'investmentTax')).toBeUndefined();
    const sold = applyRound(content, start, { orders: [{ type: 'sell', assetId: 'gold', amount: 1_000_000 }] });
    expect(ledger(sold.events, 'investmentTax')).toBe(-157_500);
  });

  it('taxes dividends and deposit interest together', () => {
    const base = createGame({ content, start: fixtureStart() }, 't3');
    const start = withPlayer(base, { deposit: 1_000_000, positions: { fund_world: { value: 1_000_000, basis: 1_000_000 } } });
    const { events } = applyRound(content, start, { orders: [] });
    expect(ledger(events, 'dividends')).toBe(36_000);
    expect(ledger(events, 'interest')).toBe(30_000);
    expect(ledger(events, 'investmentTax')).toBe(-13_860);
  });

  it('deducts a pension contribution from taxable income', () => {
    const start = createGame({ content, start: { ...fixtureStart(), cash: 1_000_000 } }, 't4');
    const { events, state } = applyRound(content, start, { orders: [{ type: 'pensionIn', amount: 600_000 }] });
    expect(ledger(events, 'incomeTax')).toBe(-456_000);
    expect(state.player.pension).toBeGreaterThan(0);
  });

  it('taxes rent and charges the yearly property tax on a rental', () => {
    const base = createGame({ content, start: fixtureStart() }, 't5');
    const start = withPlayer(base, {
      properties: [{ id: 'property-1', cityId: 'home', typeId: 'flat', value: 25_000_000, basis: 25_000_000, rented: true, mortgageId: null }],
      nextId: 1,
    });
    const { events } = applyRound(content, start, { orders: [] });
    expect(ledger(events, 'rent')).toBe(2_250_000);
    expect(ledger(events, 'investmentTax')).toBe(-472_500);
    expect(ledger(events, 'propertyTax')).toBe(-150_000);
  });

  it('charges the purchase tax when a property is bought, and shows it on its own line', () => {
    const start = createGame({ content, start: { ...fixtureStart(), cash: 20_000_000 } }, 't6');
    const { events, state } = applyRound(content, start, {
      orders: [{ type: 'buyProperty', typeId: 'studio', downPayment: 0, mortgage: 'none', rented: true }],
    });
    expect(ledger(events, 'purchaseTax')).toBe(-1_200_000);
    expect(ledger(events, 'propertyTax')).toBe(-90_000);
    expect(state.player.properties).toHaveLength(1);
    expect(state.player.debts).toEqual([]);
  });
});

describe('applyRound: shortfalls and bankruptcy', () => {
  it('covers a shortfall from the deposit before the credit card', () => {
    const start = withPlayer(createGame({ content, start: { ...fixtureStart(), salaryAnnual: 0 } }, 's1'), { deposit: 5_000_000 });
    const { state, events } = applyRound(content, start, { orders: [] });
    expect(ledger(events, 'interest')).toBe(150_000);
    expect(ledger(events, 'investmentTax')).toBe(-31_500);
    expect(ledger(events, 'depositDraw')).toBe(3_481_500);
    expect(ledger(events, 'creditCardDraw')).toBeUndefined();
    expect(state.player.deposit).toBe(5_000_000 - 3_481_500);
    expect(state.player.cash).toBe(0);
    expect(state.player.debts).toEqual([]);
  });

  it('pays the card down from the next surplus and says so in the ledger', () => {
    const base = createGame({ content, start: fixtureStart() }, 's2');
    const start = withPlayer(base, {
      debts: [{ id: 'debt-1', kind: 'creditCard', principal: 500_000, fixedRateBp: 0, roundsLeft: 0 }],
      nextId: 1,
    });
    const { state, events } = applyRound(content, start, { orders: [] });
    expect(ledger(events, 'debtInterest')).toBe(-220_000);
    expect(ledger(events, 'creditCardRepay')).toBe(-500_000);
    expect(state.player.debts).toEqual([]);
    expect(state.player.cash).toBe(1_830_000 - 220_000 - 500_000);
  });

  it('survives a life with no income: card debt, repeated bankruptcy while insolvent, and still reaches the end', () => {
    let state = createGame({ content, start: { ...fixtureStart(), salaryAnnual: 0 } }, 'g5');
    const first = applyRound(content, state, { orders: [] });
    expect(first.state.player.debts).toEqual([{ id: 'debt-1', kind: 'creditCard', principal: 3_600_000, fixedRateBp: 0, roundsLeft: 0 }]);
    expect(ledger(first.events, 'creditCardDraw')).toBe(3_600_000);
    expect(first.events.some((e) => e.kind === 'bankrupt')).toBe(false);

    const second = applyRound(content, first.state, { orders: [] });
    const owed = 3_600_000 + 1_584_000 + atRound(state, 1, 1_800_000) * 2;
    expect(second.events).toContainEqual({ kind: 'bankrupt', proceeds: 0, debtsCleared: owed });
    expect(second.state.player.debts).toEqual([]);
    expect(second.state.player.bankruptUntilRound).toBe(5);

    const third = applyRound(content, second.state, { orders: [{ type: 'borrow', amount: 100 }] });
    expect(rejections(third.events)).toEqual(['no-credit']);
    expect(third.state.player.debts.map((d) => d.kind)).toEqual(['creditCard']);

    let bankruptcies = 1;
    state = third.state;
    while (!state.finished) {
      const next = applyRound(content, state, { orders: [] });
      state = next.state;
      if (next.events.some((e) => e.kind === 'bankrupt')) bankruptcies += 1;
      expect(state.player.cash).toBeGreaterThanOrEqual(0);
    }
    expect(bankruptcies).toBe(10);
    expect(state.round).toBe(20);
    expect(Number.isFinite(netWorth(state.player))).toBe(true);
  });

  it('settles an underwater property sale onto the credit card', () => {
    const start = createGame({ content, start: { ...fixtureStart(), cash: 5_000_000 } }, 'g6');
    const bought = applyRound(content, start, {
      orders: [{ type: 'buyProperty', typeId: 'studio', downPayment: 3_000_000, mortgage: 'variable', rented: false }],
    });
    expect(bought.state.player.properties).toHaveLength(1);
    expect(rejections(bought.events)).toEqual([]);
    const crashed = structuredClone(bought.state);
    crashed.player.properties[0].value = 5_000_000;
    const sold = applyRound(content, crashed, {
      orders: [{ type: 'sellProperty', propertyId: crashed.player.properties[0].id }],
    });
    const p = sold.state.player;
    expect(p.properties).toEqual([]);
    expect(p.debts.some((d) => d.kind === 'mortgageVariable')).toBe(false);
    expect(p.debts.some((d) => d.kind === 'creditCard')).toBe(true);
    expect(p.cash).toBe(0);
    expect(ledger(sold.events, 'investmentTax')).toBeUndefined();
  });
});

describe('applyRound: bankruptcy uses this round\'s prices', () => {
  it('measures income at the current price level when setting the card limit', () => {
    const base = createGame({ content, start: fixtureStart() }, 'limit');
    const start = structuredClone(base);
    start.timeline[0].priceLevel = 2_000_000;
    start.player.debts = [{ id: 'debt-1', kind: 'creditCard', principal: 12_000_000, fixedRateBp: 0, roundsLeft: 0 }];
    start.player.nextId = 1;
    const { state, events } = applyRound(content, start, { orders: [] });
    expect(ledger(events, 'salary')).toBe(12_000_000);
    expect(state.player.debts[0].principal).toBeGreaterThan(3 * 3_600_000);
    expect(state.player.debts[0].principal).toBeLessThan(3 * 6_000_000);
    expect(events.some((e) => e.kind === 'bankrupt')).toBe(false);
  });

  it('takes the living-cost floor from the current world, not the next one', () => {
    const base = createGame({ content, start: { ...fixtureStart(), salaryAnnual: 0 } }, 'floor');
    const start = structuredClone(base);
    start.timeline[1].priceLevel = 500_000;
    const { state, events } = applyRound(content, start, { orders: [] });
    expect(state.player.debts.map((d) => d.principal)).toEqual([3_600_000]);
    expect(events.some((e) => e.kind === 'bankrupt')).toBe(false);
  });
});

describe('applyRound: escape', () => {
  it('marks escape after two rounds in a row of passive income covering expenses', () => {
    const start = withPlayer(createGame({ content, start: fixtureStart() }, 'g7'), {}, { recurring: passive(5_000_000) });
    const first = applyRound(content, start, { orders: [] });
    expect(first.state.player.passiveStreak).toBe(1);
    expect(first.state.player.escapedAtRound).toBeNull();
    const second = applyRound(content, first.state, { orders: [] });
    expect(second.state.player.escapedAtRound).toBe(1);
    expect(second.events).toContainEqual({ kind: 'escaped', round: 1 });
    const third = applyRound(content, second.state, { orders: [] });
    expect(third.state.player.escapedAtRound).toBe(1);
    expect(third.events.some((e) => e.kind === 'escaped')).toBe(false);
  });

  it('counts passive income after the tax it would bear on its own', () => {
    // Living costs 3,600,000 a round. Passive income of 3,700,000 covers it before tax,
    // but the 133,000 of income tax it would bear without a salary leaves it short.
    const taxed = withPlayer(createGame({ content, start: fixtureStart() }, 'after-tax'), {}, { recurring: passive(1_850_000) });
    expect(previewRound(content, taxed, { orders: [] }).escape).toEqual({ passiveAfterTax: 3_567_000, outgoings: 3_600_000, savingsUncounted: 0 });
    expect(applyRound(content, taxed, { orders: [] }).state.player.passiveStreak).toBe(0);

    const enough = withPlayer(createGame({ content, start: fixtureStart() }, 'after-tax'), {}, { recurring: passive(1_900_000) });
    expect(previewRound(content, enough, { orders: [] }).escape).toEqual({ passiveAfterTax: 3_648_000, outgoings: 3_600_000, savingsUncounted: 0 });
    expect(applyRound(content, enough, { orders: [] }).state.player.passiveStreak).toBe(1);
  });

  it('judges escape as if the salary were gone, so a high earner is not held back by the bracket their salary puts them in', () => {
    const rich = withPlayer(createGame({ content, start: { ...fixtureStart(), salaryAnnual: 50_000_000 } }, 'after-tax'), {}, { recurring: passive(1_900_000) });
    expect(previewRound(content, rich, { orders: [] }).escape).toEqual({ passiveAfterTax: 3_648_000, outgoings: 3_600_000, savingsUncounted: 0 });
    expect(applyRound(content, rich, { orders: [] }).state.player.passiveStreak).toBe(1);
  });

  it('is easier to reach where passive income is not taxed', () => {
    // In the zero-tax city living costs 8,000,000 a round, and 8,100,000 of passive income is all kept.
    const start = withPlayer(createGame({ content, start: { ...fixtureStart(), cityId: 'haven' } }, 'no-tax'), {}, { recurring: passive(4_050_000) });
    expect(previewRound(content, start, { orders: [] }).escape).toEqual({ passiveAfterTax: 8_100_000, outgoings: 8_000_000, savingsUncounted: 0 });
    expect(applyRound(content, start, { orders: [] }).state.player.passiveStreak).toBe(1);
  });

  it("counts the deposit's interest at half, after its tax, so savings alone do not get a player out", () => {
    // The deposit pays 1.5 % a year: 3,000,000 a round on 100,000,000, 630,000 of it tax.
    // Half of the 2,370,000 left counts; the player still receives all of it.
    const saver = withPlayer(createGame({ content, start: fixtureStart() }, 'saver'), { deposit: 100_000_000 });
    expect(previewRound(content, saver, { orders: [] }).escape.passiveAfterTax).toBe(1_185_000);
    expect(ledger(applyRound(content, saver, { orders: [] }).events, 'interest')).toBe(3_000_000);
  });

  it("counts in full what another player pays on a loan, and a bond's coupon", () => {
    const lender = withPlayer(createGame({ content, start: fixtureStart() }, 'lender'), {
      lent: [{ id: 'lent-1', peer: 'p2', principal: 100_000_000, fixedRateBp: 150, roundsLeft: 5 }],
    });
    expect(previewRound(content, lender, { orders: [] }).escape.passiveAfterTax).toBe(2_370_000);
    // The long bond pays the policy rate and its spread: 3 % a year, 6,000,000 a round.
    const holder = withPlayer(createGame({ content, start: fixtureStart() }, 'holder'), { positions: { bond_long: { value: 100_000_000, basis: 100_000_000 } } });
    expect(previewRound(content, holder, { orders: [] }).escape.passiveAfterTax).toBe(4_740_000);
  });

  it('resets the streak when passive income falls short', () => {
    const start = withPlayer(createGame({ content, start: fixtureStart() }, 'g8'), {}, { recurring: passive(5_000_000) });
    const first = applyRound(content, start, { orders: [] });
    const second = applyRound(content, withPlayer(first.state, {}, { recurring: [] }), { orders: [] });
    expect(second.state.player.passiveStreak).toBe(0);
    expect(second.state.player.escapedAtRound).toBeNull();
  });
});

describe('selectors', () => {
  it('nets assets against debts', () => {
    const state = createGame({ content, start: { ...fixtureStart(), cash: 1_000 } }, 'n');
    const p = state.player;
    p.deposit = 2_000;
    p.pension = 3_000;
    p.positions.gold = { value: 4_000, basis: 1 };
    p.properties.push({ id: 'property-1', cityId: 'home', typeId: 'flat', value: 5_000, basis: 1, rented: true, mortgageId: null });
    p.debts.push({ id: 'debt-2', kind: 'personalLoan', principal: 6_000, fixedRateBp: 0, roundsLeft: 1 });
    expect(netWorth(p)).toBe(9_000);
  });

  it('scores a finished state', () => {
    // Status is 50: 48 from cards and 2 for the rented flat.
    const state = withPlayer(
      createGame({ content, start: { ...fixtureStart(), cash: 100_000_000 } }, 'f'),
      { escapedAtRound: 1 },
      { bonusStatus: 48 },
    );
    expect(finalScore(content, state)).toBe(637);
  });

  it('reports cashflow at the price level of the current round', () => {
    const start = createGame({ content, start: fixtureStart() }, 'c2');
    const after = applyRound(content, start, { orders: [] }).state;
    expect(cashflow(content, after).salaryAnnual).toBe(atRound(start, 1, 3_000_000));
    expect(cashflow(content, after).salaryAnnual).not.toBe(3_000_000);
  });

  it('scores net worth in start-of-game dollars', () => {
    const base = withPlayer(createGame({ content, start: { ...fixtureStart(), cash: 200_000_000 } }, 'real'), {}, { bonusStatus: 48 });
    const inflated = structuredClone(base);
    inflated.timeline[0].priceLevel = 2_000_000;
    expect(realNetWorth(inflated)).toBe(100_000_000);
    expect(finalScore(content, inflated)).toBe(350);
    expect(finalScore(content, base)).toBeGreaterThan(350);
  });

  it('reports annual cashflow at the current rates', () => {
    const state = withPlayer(createGame({ content, start: fixtureStart() }, 'c'), { deposit: 1_000_000 });
    expect(cashflow(content, state)).toEqual({ salaryAnnual: 3_000_000, passiveAnnual: 15_000, expensesAnnual: 1_800_000 });
  });

  it('reports the same cashflow line by line', () => {
    const state = withPlayer(createGame({ content, start: fixtureStart() }, 'c'), { deposit: 1_000_000 });
    const lines = cashflowLines(content, state);
    expect(lines).toEqual({ salary: 3_000_000, dividends: 0, interest: 15_000, rent: 0, otherPassive: 0, living: 1_800_000, other: 0, debt: 0 });
    const whole = cashflow(content, state);
    expect(lines.dividends + lines.interest + lines.rent + lines.otherPassive).toBe(whole.passiveAnnual);
    expect(lines.living + lines.other + lines.debt).toBe(whole.expensesAnnual);
  });

  it('reports status by source, beside the status the score counts', () => {
    const state = withPlayer(createGame({ content, start: fixtureStart() }, 'c'), {}, { bonusStatus: 48 });
    const status = statusBreakdown(content, state);
    expect(status.bonus).toBe(48);
    expect(status.items + status.home + status.job + status.city + status.lifestyle + status.bonus).toBe(status.total);
    expect(status.total).toBe(state.player.statusPoints);
    expect(status.lived).toBe(livedStatus(state));
  });
});

describe('the yearly tax beside the cashflow', () => {
  it('makes the flow what a round leaves in cash, tax and all', () => {
    const state = withPlayer(createGame({ content, start: fixtureStart() }, 'c'), { deposit: 1_000_000 });
    const flow = cashflow(content, state);
    const tax = taxAnnual(content, state);
    expect(tax).toBeGreaterThan(0);
    const yearly = flow.salaryAnnual + flow.passiveAnnual - flow.expensesAnnual - tax;
    const round = previewRound(content, state, { orders: [] });
    // Each figure is rounded down to a cent a year on its own.
    expect(Math.abs(yearly * content.yearsPerRound - (round.cashAfter + round.reinvested - state.player.cash))).toBeLessThanOrEqual(4 * content.yearsPerRound);
  });
});
