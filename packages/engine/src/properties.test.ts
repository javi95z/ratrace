import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { applyRound, createGame } from './game';
import { stateHash } from './hash';
import { findInvariantBreaks } from './invariants';
import { fixtureContent, fixtureStart } from './testing/fixture';
import type { GameState, Order } from './types';

const content = fixtureContent();

const amount = fc.oneof(
  fc.integer({ min: -1_000, max: 50_000_000 }),
  fc.constantFrom(0, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER, 1e300),
);
const assetId = fc.constantFrom('fund_world', 'bond_long', 'stock_growth', 'coin_meme', 'gold', 'nope', '__proto__', 'constructor');
const debtId = fc.constantFrom('debt-1', 'debt-2', 'debt-3', 'debt-4', 'gone');
const propertyId = fc.constantFrom('property-1', 'property-2', 'property-3', 'property-4', 'gone');

const order: fc.Arbitrary<Order> = fc.oneof(
  fc.record({ type: fc.constant('buy' as const), assetId, amount }),
  fc.record({ type: fc.constant('sell' as const), assetId, amount }),
  fc.record({ type: fc.constant('depositIn' as const), amount }),
  fc.record({ type: fc.constant('depositOut' as const), amount }),
  fc.record({ type: fc.constant('pensionIn' as const), amount }),
  fc.record({ type: fc.constant('borrow' as const), amount }),
  fc.record({ type: fc.constant('repay' as const), debtId, amount }),
  fc.record({
    type: fc.constant('buyProperty' as const),
    typeId: fc.constantFrom('studio', 'flat', 'villa', 'castle'),
    downPayment: amount,
    mortgage: fc.constantFrom('fixed' as const, 'variable' as const, 'none' as const),
    rented: fc.boolean(),
  }),
  fc.record({ type: fc.constant('sellProperty' as const), propertyId }),
  fc.record({ type: fc.constant('setRented' as const), propertyId, rented: fc.boolean() }),
);

const game = fc.record({
  seed: fc.string({ maxLength: 12 }),
  cash: fc.integer({ min: 0, max: 100_000_000 }),
  salary: fc.integer({ min: 0, max: 20_000_000 }),
  tier: fc.constantFrom(0 as const, 1 as const, 2 as const, 3 as const),
  rounds: fc.array(fc.array(order, { maxLength: 6 }), { minLength: 20, maxLength: 20 }),
});

function play(input: { seed: string; cash: number; salary: number; tier: 0 | 1 | 2 | 3; rounds: Order[][] }): GameState {
  const start = { ...fixtureStart(), cash: input.cash, salaryAnnual: input.salary, lifestyleTier: input.tier };
  let state = createGame({ content, start }, input.seed);
  for (const orders of input.rounds) {
    state = applyRound(content, state, { orders }).state;
    expect(findInvariantBreaks(content, state)).toEqual([]);
  }
  return state;
}

describe('engine invariants under arbitrary orders', () => {
  it('keeps money whole, non-negative and consistent for any seed and any orders', () => {
    fc.assert(
      fc.property(game, (input) => {
        const state = play(input);
        expect(state.round).toBe(20);
        expect(state.finished).toBe(true);
      }),
      { numRuns: 200 },
    );
  });

  it('replays any game to the same hash', () => {
    fc.assert(
      fc.property(game, (input) => {
        expect(stateHash(play(input))).toBe(stateHash(play(input)));
      }),
      { numRuns: 50 },
    );
  });

  it('leaves Object.prototype untouched', () => {
    expect(Object.keys(Object.prototype)).toEqual([]);
  });
});
