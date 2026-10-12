import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { applyRound, createGame, previewRound } from './game';
import { stateHash } from './hash';
import { findInvariantBreaks } from './invariants';
import { netWorth } from './selectors';
import { fixtureContent, fixtureStart } from './testing/fixture';
import type { GameState, LedgerLine, Order } from './types';

const content = fixtureContent();

/** A fixed seed, so a failure here is the same failure on every machine and every run. */
const SEED = 20261012;

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

type Game = { seed: string; cash: number; salary: number; tier: 0 | 1 | 2 | 3; rounds: Order[][] };

const begin = (input: Game): GameState =>
  createGame({ content, start: { ...fixtureStart(), cash: input.cash, salaryAnnual: input.salary, lifestyleTier: input.tier } }, input.seed);

function play(input: Game): GameState {
  let state = begin(input);
  for (const orders of input.rounds) {
    state = applyRound(content, state, { orders }).state;
    expect(findInvariantBreaks(content, state)).toEqual([]);
  }
  return state;
}

/** Ledger lines that only move money between the player's own pockets. */
const TRANSFERS: ReadonlySet<LedgerLine> = new Set<LedgerLine>(['debtPrincipal', 'depositDraw', 'creditCardDraw', 'creditCardRepay']);

/** The rule for a price move, written out here so the test does not lean on the engine's own helper. */
const moved = (value: number, returnBp: number) => Math.max(0, value + Math.round((value * returnBp) / 10_000)) - value;

describe('engine invariants under arbitrary orders', () => {
  it('keeps money whole, non-negative and consistent for any seed and any orders', () => {
    fc.assert(
      fc.property(game, (input) => {
        const state = play(input);
        expect(state.round).toBe(20);
        expect(state.finished).toBe(true);
      }),
      { numRuns: 200, seed: SEED },
    );
  });

  it('replays any game to the same hash', () => {
    fc.assert(
      fc.property(game, (input) => {
        expect(stateHash(play(input))).toBe(stateHash(play(input)));
      }),
      { numRuns: 50, seed: SEED },
    );
  });

  it('changes net worth by exactly the ledger flows plus the price moves, in every round', () => {
    let roundsChecked = 0;
    fc.assert(
      fc.property(game, (input) => {
        let state = begin(input);
        for (const orders of input.rounds) {
          const before = netWorth(state.player);
          const held = previewRound(content, state, { orders }).player;
          const now = state.timeline[state.round];
          const after = state.timeline[state.round + 1];
          const result = applyRound(content, state, { orders });

          if (!result.events.some((e) => e.kind === 'bankrupt')) {
            let flows = 0;
            for (const e of result.events) {
              if (e.kind === 'ledger' && !TRANSFERS.has(e.line)) flows += e.amount;
            }
            let moves = 0;
            for (const [id, position] of Object.entries(held.positions)) moves += moved(position.value, after.assetReturnBp[id]);
            for (const property of held.properties) moves += moved(property.value, after.propertyReturnBp[property.cityId]);
            const pensionYieldBp = 180 * content.yearsPerRound;
            moves += moved(held.pension, after.assetReturnBp.fund_world) + Math.round((held.pension * pensionYieldBp) / 10_000);

            expect(now.round).toBe(state.round);
            expect(netWorth(result.state.player) - before).toBe(flows + moves);
            roundsChecked += 1;
          }
          state = result.state;
        }
      }),
      { numRuns: 150, seed: SEED },
    );
    expect(roundsChecked).toBeGreaterThan(2_500);
  });

  it('leaves Object.prototype untouched', () => {
    expect(Object.keys(Object.prototype)).toEqual([]);
  });
});
