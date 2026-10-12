import { describe, expect, it } from 'vitest';
import { applyRound, createGame } from './game';
import { PRICE_LEVEL_START } from './rates';
import { cashflow, finalScore, netWorth } from './selectors';
import { fixtureContent, fixtureStart } from './testing/fixture';
import type { GameEvent, GameState, LedgerLine } from './types';

const content = fixtureContent();

const ledger = (events: GameEvent[], line: LedgerLine): number | undefined => {
  const found = events.find((e) => e.kind === 'ledger' && e.line === line);
  return found && found.kind === 'ledger' ? found.amount : undefined;
};

const rejections = (events: GameEvent[]) => events.flatMap((e) => (e.kind === 'orderRejected' ? [e.reason] : []));

function withPlayer(state: GameState, over: Partial<GameState['player']>): GameState {
  return { ...state, player: { ...state.player, ...over } };
}

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
    const start = withPlayer(createGame({ content, start: fixtureStart() }, 't1'), { extraPassiveAnnual: 3_000_000 });
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

describe('applyRound: escape', () => {
  it('marks escape after two rounds in a row of passive income covering expenses', () => {
    const start = withPlayer(createGame({ content, start: fixtureStart() }, 'g7'), { extraPassiveAnnual: 5_000_000 });
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

  it('resets the streak when passive income falls short', () => {
    const start = withPlayer(createGame({ content, start: fixtureStart() }, 'g8'), { extraPassiveAnnual: 5_000_000 });
    const first = applyRound(content, start, { orders: [] });
    const second = applyRound(content, withPlayer(first.state, { extraPassiveAnnual: 0 }), { orders: [] });
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
    const state = withPlayer(createGame({ content, start: { ...fixtureStart(), cash: 100_000_000 } }, 'f'), {
      statusPoints: 50,
      escapedAtRound: 1,
    });
    expect(finalScore(content, state)).toBe(637);
  });

  it('reports annual cashflow at the current rates', () => {
    const state = withPlayer(createGame({ content, start: fixtureStart() }, 'c'), { deposit: 1_000_000 });
    expect(cashflow(content, state)).toEqual({ salaryAnnual: 3_000_000, passiveAnnual: 15_000, expensesAnnual: 1_800_000 });
  });
});
