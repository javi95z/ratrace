import { describe, expect, it } from 'vitest';
import { applyRound, createGame, previewRound } from './game';
import { findInvariantBreaks } from './invariants';
import { quotePlans } from './quotes';
import { fixtureContent, fixtureStart } from './testing/fixture';
import { withPlayer } from './testing/patch';
import type { Content, GameEvent, GameState, Order } from './types';
import { viewOf } from './view';

const content = fixtureContent();
const asset = content.assets[0].id;
const other = content.assets[1].id;
const game = (cash: number, c: Content = content): GameState => createGame({ content: c, start: { ...fixtureStart(), cash } }, 'plans');
const plan = (assetId: string, amount: number): Order => ({ type: 'setPlan', assetId, amount });
const ran = (events: GameEvent[]) => events.filter((e): e is Extract<GameEvent, { kind: 'planRan' }> => e.kind === 'planRan');
const rejected = (events: GameEvent[]) => events.filter((e) => e.kind === 'orderRejected').map((e) => (e.kind === 'orderRejected' ? e.reason : ''));

describe('a plan to invest every round', () => {
  it('buys in the round it is set and in every round after, without being asked again', () => {
    const first = applyRound(content, game(50_000_000), { orders: [plan(asset, 200_000)] });
    expect(ran(first.events)).toEqual([{ kind: 'planRan', assetId: asset, amount: 200_000, reason: null }]);
    expect(first.state.player.plans).toEqual([{ assetId: asset, amount: 200_000, invested: 200_000, rounds: 1 }]);
    expect(findInvariantBreaks(content, first.state)).toEqual([]);

    let state = first.state;
    for (let round = 2; round <= 4; round++) {
      const next = applyRound(content, state, { orders: [] });
      expect(ran(next.events)).toEqual([{ kind: 'planRan', assetId: asset, amount: 200_000, reason: null }]);
      expect(next.state.player.plans[0]).toMatchObject({ invested: 200_000 * round, rounds: round });
      state = next.state;
    }
    // Everything it put in is in what was paid for the position.
    expect(state.player.positions[asset].basis).toBe(800_000);
  });

  it('buys exactly as a purchase by hand would: the same position for the same money', () => {
    const start = game(50_000_000);
    const byPlan = applyRound(content, start, { orders: [plan(asset, 300_000)] }).state.player;
    const byHand = applyRound(content, start, { orders: [{ type: 'buy', assetId: asset, amount: 300_000 }] }).state.player;
    expect(byPlan.positions).toEqual(byHand.positions);
    expect(byPlan.cash).toBe(byHand.cash);
  });

  it('is changed by setting it again, and ended by setting it to nothing', () => {
    let state = applyRound(content, game(50_000_000), { orders: [plan(asset, 200_000), plan(other, 100_000)] }).state;
    expect(state.player.plans.map((x) => [x.assetId, x.amount])).toEqual([[asset, 200_000], [other, 100_000]]);
    // A new amount keeps what the plan has done so far, and its place among the plans.
    state = applyRound(content, state, { orders: [plan(asset, 500_000)] }).state;
    expect(state.player.plans[0]).toEqual({ assetId: asset, amount: 500_000, invested: 700_000, rounds: 2 });
    const ended = applyRound(content, state, { orders: [plan(asset, 0)] });
    expect(ended.state.player.plans.map((x) => x.assetId)).toEqual([other]);
    expect(ran(ended.events).map((e) => e.assetId)).toEqual([other]);
    // What it bought stays bought.
    expect(ended.state.player.positions[asset].basis).toBe(700_000);
    // Ending a plan that is not there is no fault.
    expect(rejected(applyRound(content, ended.state, { orders: [plan(asset, 0)] }).events)).toEqual([]);
  });

  it('buys nothing in a round that cannot pay for it, borrows nothing, and tries again the next', () => {
    const poor = withPlayer(content, applyRound(content, game(50_000_000), { orders: [plan(asset, 200_000)] }).state, { cash: 150_000 });
    const short = applyRound(content, poor, { orders: [] });
    expect(ran(short.events)).toEqual([{ kind: 'planRan', assetId: asset, amount: 200_000, reason: 'not-enough-cash' }]);
    expect(short.state.player.plans[0]).toMatchObject({ amount: 200_000, invested: 200_000, rounds: 1 });
    expect(short.state.player.positions[asset].basis).toBe(200_000);
    expect(short.state.player.debts).toEqual([]);
    const rich = withPlayer(content, short.state, { cash: 10_000_000 });
    expect(ran(applyRound(content, rich, { orders: [] }).events)[0].reason).toBeNull();
  });

  it('comes after what the player orders by hand, and serves the plans in the order they were made', () => {
    const start = withPlayer(content, applyRound(content, game(50_000_000), { orders: [plan(asset, 300_000), plan(other, 300_000)] }).state, { cash: 700_000 });
    // By hand first: 200,000 of the 700,000. The first plan gets its 300,000; the second finds 200,000 and waits.
    const round = applyRound(content, start, { orders: [{ type: 'buy', assetId: other, amount: 200_000 }] });
    expect(rejected(round.events)).toEqual([]);
    expect(ran(round.events).map((e) => [e.assetId, e.reason])).toEqual([[asset, null], [other, 'not-enough-cash']]);
  });

  it('shows in the preview exactly what the round then does', () => {
    const start = withPlayer(content, applyRound(content, game(50_000_000), { orders: [plan(asset, 300_000)] }).state, { cash: 400_000 });
    const orders = [plan(other, 300_000)];
    const preview = previewRound(content, viewOf(start), { orders });
    const round = applyRound(content, start, { orders });
    expect(preview.plans).toEqual(ran(round.events).map(({ assetId, amount, reason }) => ({ assetId, amount, reason })));
    expect(preview.plans.map((x) => x.reason)).toEqual([null, 'not-enough-cash']);
    expect(preview.player.cash).toBe(100_000);
    // Looking changes nothing.
    expect(start.player.plans).toHaveLength(1);
  });

  it('refuses a plan for an asset that does not exist, one beyond the player\'s skill, and an amount that is not one', () => {
    const skilled = fixtureContent();
    skilled.assets = skilled.assets.map((a, i) => (i === 1 ? { ...a, minFinanceSkill: 2 } : a));
    const round = applyRound(skilled, game(50_000_000, skilled), {
      orders: [plan('nope', 100_000), plan('__proto__', 100_000), plan(other, 100_000), plan(asset, -5), plan(asset, 0.5), { type: 'setPlan', assetId: 7, amount: 100_000 } as never],
    });
    expect(rejected(round.events)).toEqual(['unknown-asset', 'unknown-asset', 'needs-finance-skill', 'bad-amount', 'bad-amount', 'bad-order']);
    expect(round.state.player.plans).toEqual([]);
    expect(ran(round.events)).toEqual([]);
  });

  it('ends with a bankruptcy: nothing starts buying again unasked', () => {
    const set = applyRound(content, game(50_000_000), { orders: [plan(asset, 200_000)] }).state;
    // Everything owed, far past what could ever be paid.
    const ruined = withPlayer(content, set, { cash: 0, debts: [{ id: 'd', kind: 'creditCard', principal: 900_000_000, fixedRateBp: 0, roundsLeft: 0 }] });
    const after = applyRound(content, ruined, { orders: [] });
    expect(after.events.some((e) => e.kind === 'bankrupt')).toBe(true);
    expect(after.state.player.plans).toEqual([]);
    expect(findInvariantBreaks(content, after.state)).toEqual([]);
  });
});

describe('what a plan has built', () => {
  it('sets what it put in beside what is held, and says how today\'s price stands to the average paid', () => {
    let state = applyRound(content, game(50_000_000), { orders: [plan(asset, 200_000)] }).state;
    for (let i = 0; i < 4; i++) state = applyRound(content, state, { orders: [] }).state;
    const [quote] = quotePlans(viewOf(state));
    const held = state.player.positions[asset];
    expect(quote).toMatchObject({ assetId: asset, amount: 200_000, invested: 1_000_000, rounds: 5, value: held.value, basis: held.basis });
    expect(quote.priceVsAverageBp).toBe(Math.trunc(((held.value - held.basis) * 10_000) / held.basis));
    // A plan that has not bought yet has no average to speak of.
    const fresh = withPlayer(content, game(0), { plans: [{ assetId: other, amount: 100_000, invested: 0, rounds: 0 }] });
    expect(quotePlans(viewOf(fresh))).toEqual([{ assetId: other, amount: 100_000, invested: 0, rounds: 0, value: 0, basis: 0, priceVsAverageBp: null }]);
  });
});
