import { describe, expect, it } from 'vitest';
import { applyRound, createGame } from './game';
import { cashflow, finalScore, netWorth } from './selectors';
import { fixtureContent, fixtureStart } from './testing/fixture';
import type { GameEvent, GameState, LedgerLine } from './types';

const content = fixtureContent();

const ledger = (events: GameEvent[], line: LedgerLine) => events.find((e) => e.kind === 'ledger' && e.line === line);

function withPlayer(state: GameState, over: Partial<GameState['player']>): GameState {
  return { ...state, player: { ...state.player, ...over } };
}

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

describe('applyRound', () => {
  it('pays salary, charges living costs and income tax', () => {
    const start = createGame({ content, start: fixtureStart() }, 'g1');
    const { state, events } = applyRound(content, start, { orders: [] });
    expect(state.round).toBe(1);
    expect(state.player.cash).toBe(1_830_000);
    expect(ledger(events, 'salary')).toEqual({ kind: 'ledger', line: 'salary', amount: 6_000_000 });
    expect(ledger(events, 'living')).toEqual({ kind: 'ledger', line: 'living', amount: -3_600_000 });
    expect(ledger(events, 'incomeTax')).toEqual({ kind: 'ledger', line: 'incomeTax', amount: -570_000 });
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
      { kind: 'orderRejected', order: { type: 'buy', assetId: 'fund_world', amount: 12.5 }, reason: 'amount must be a positive whole number of cents' },
    ]);
    expect(bad.state).toEqual(none.state);
  });

  it('rejects orders that are not orders', () => {
    const start = createGame({ content, start: { ...fixtureStart(), cash: 20_000_000 } }, 'g4b');
    const orders = JSON.parse(
      '[{"type":"teleport","amount":5},null,7,{"type":"buyProperty","typeId":"studio","downPayment":5000000,"mortgage":"weird","rented":"yes"}]',
    );
    const { state, events } = applyRound(content, start, { orders });
    const reasons = events.flatMap((e) => (e.kind === 'orderRejected' ? [e.reason] : []));
    expect(reasons).toEqual(['unknown order type', 'unknown order type', 'unknown order type', 'unknown mortgage type']);
    expect(state.player.properties).toEqual([]);
  });

  it('survives a life with no income: card debt, one bankruptcy lock, and still reaches the end', () => {
    let state = createGame({ content, start: { ...fixtureStart(), salaryAnnual: 0 } }, 'g5');
    const first = applyRound(content, state, { orders: [] });
    expect(first.state.player.debts).toEqual([{ id: 'debt-1', kind: 'creditCard', principal: 3_600_000, fixedRateBp: 0, roundsLeft: 0 }]);
    expect(ledger(first.events, 'creditCardDraw')).toEqual({ kind: 'ledger', line: 'creditCardDraw', amount: 3_600_000 });

    const second = applyRound(content, first.state, { orders: [] });
    expect(second.events).toContainEqual({ kind: 'bankrupt' });
    expect(second.state.player.debts).toEqual([]);
    expect(second.state.player.bankruptUntilRound).toBe(5);

    const third = applyRound(content, second.state, { orders: [{ type: 'borrow', amount: 100 }] });
    expect(third.events.find((e) => e.kind === 'orderRejected')).toMatchObject({ reason: 'no credit available after bankruptcy' });

    state = third.state;
    while (!state.finished) {
      state = applyRound(content, state, { orders: [] }).state;
      expect(state.player.cash).toBeGreaterThanOrEqual(0);
    }
    expect(state.round).toBe(20);
    expect(Number.isFinite(netWorth(state.player))).toBe(true);
  });

  it('settles an underwater property sale onto the credit card', () => {
    const start = createGame({ content, start: { ...fixtureStart(), cash: 5_000_000 } }, 'g6');
    const bought = applyRound(content, start, {
      orders: [{ type: 'buyProperty', typeId: 'studio', downPayment: 3_000_000, mortgage: 'variable', rented: false }],
    });
    expect(bought.state.player.properties).toHaveLength(1);
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
