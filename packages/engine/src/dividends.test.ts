import { describe, expect, it } from 'vitest';
import { incomeForRound } from './economy';
import { applyRound, createGame, previewRound } from './game';
import { findInvariantBreaks } from './invariants';
import { CONCENTRATION_PCT, quotePortfolio } from './quotes';
import { fixtureContent, fixtureStart } from './testing/fixture';
import { withPlayer } from './testing/patch';
import type { Content, GameEvent, GameState, LedgerLine } from './types';
import { viewOf } from './view';

const content = fixtureContent();
const paying = content.assets.filter((asset) => asset.yieldBp > 0).map((asset) => asset.id);
const [first, second] = paying;
const game = (cash: number, c: Content = content): GameState => createGame({ content: c, start: { ...fixtureStart(), cash } }, 'dividends');
const holding = (state: GameState, positions: Record<string, number>, over: Partial<GameState['player']> = {}) =>
  withPlayer(content, state, { positions: Object.fromEntries(Object.entries(positions).map(([id, value]) => [id, { value, basis: value }])), ...over });
const ledger = (events: GameEvent[], line: LedgerLine) => {
  const found = events.find((e) => e.kind === 'ledger' && e.line === line);
  return found && found.kind === 'ledger' ? found.amount : 0;
};

describe('what the investments pay', () => {
  it('is listed asset by asset, and adds up to the dividends the round pays', () => {
    const state = holding(game(1_000_000), { [first]: 5_000_000, [second]: 2_000_000 });
    const quote = quotePortfolio(content, viewOf(state));
    expect(quote.dividends.map((paid) => paid.assetId).sort()).toEqual([first, second].sort());
    for (const paid of quote.dividends) expect(paid.amount).toBeGreaterThan(0);
    const income = incomeForRound(state.player, content, state.timeline[0]);
    expect(quote.dividendsTotal).toBe(income.dividends);
    expect(quote.interest).toBe(income.interest);
    expect(ledger(applyRound(content, state, { orders: [] }).events, 'dividends')).toBe(quote.dividendsTotal);
    // Nothing is listed for what pays nothing, nor for someone who holds nothing.
    expect(quotePortfolio(content, viewOf(game(1_000_000))).dividends).toEqual([]);
  });
});

describe('putting the dividends back', () => {
  it('buys more of each thing with what it paid, and leaves the cash as if they had never been paid', () => {
    const state = holding(game(50_000_000), { [first]: 5_000_000, [second]: 2_000_000 });
    const paid = quotePortfolio(content, viewOf(state)).dividends;
    const kept = applyRound(content, state, { orders: [] });
    const back = applyRound(content, state, { orders: [{ type: 'setReinvest', on: true }] });
    expect(back.state.player.reinvest).toBe(true);
    expect(ledger(back.events, 'dividendsReinvested')).toBe(-quotePortfolio(content, viewOf(state)).dividendsTotal);
    expect(ledger(kept.events, 'dividendsReinvested')).toBe(0);
    expect(back.state.player.cash).toBe(kept.state.player.cash - quotePortfolio(content, viewOf(state)).dividendsTotal);
    for (const each of paid) {
      // Each into itself: what it is worth after the round, and what it cost, are up by exactly what it paid.
      expect(back.state.player.positions[each.assetId].value).toBe(kept.state.player.positions[each.assetId].value + each.amount);
      expect(back.state.player.positions[each.assetId].basis).toBe(kept.state.player.positions[each.assetId].basis + each.amount);
    }
    expect(findInvariantBreaks(content, back.state)).toEqual([]);
    // It goes on by itself until it is switched off.
    const next = applyRound(content, back.state, { orders: [] });
    expect(ledger(next.events, 'dividendsReinvested')).toBeLessThan(0);
    const off = applyRound(content, back.state, { orders: [{ type: 'setReinvest', on: false }] });
    expect(ledger(off.events, 'dividendsReinvested')).toBe(0);
    expect(off.state.player.reinvest).toBe(false);
  });

  it('does nothing in a round whose bills leave no cash for it: nothing is borrowed to reinvest', () => {
    // No cash, and a living that the pay does not cover.
    const broke = holding(game(0), { [first]: 5_000_000 }, { reinvest: true, lifestyleTier: 3 });
    const round = applyRound(content, broke, { orders: [] });
    expect(ledger(round.events, 'dividendsReinvested')).toBe(0);
    expect(round.state.player.positions[first].basis).toBe(5_000_000);
  });

  it('shows in the preview exactly what the round then does', () => {
    for (const [cash, over] of [[50_000_000, {}], [0, { lifestyleTier: 3 as const }]] as const) {
      const state = holding(game(cash), { [first]: 5_000_000, [second]: 2_000_000 }, { reinvest: true, ...over });
      const preview = previewRound(content, viewOf(state), { orders: [] });
      const round = applyRound(content, state, { orders: [] });
      expect(preview.reinvested).toBe(Math.abs(ledger(round.events, 'dividendsReinvested')));
      if (preview.cashAfter >= 0) expect(round.state.player.cash + ledger(round.events, 'creditCardRepay') * -1).toBe(preview.cashAfter);
    }
    expect(previewRound(content, viewOf(holding(game(50_000_000), { [first]: 5_000_000 })), { orders: [] }).reinvested).toBe(0);
  });

  it('refuses a switch that is not a flag, and ends with a bankruptcy', () => {
    const round = applyRound(content, game(1_000_000), { orders: [{ type: 'setReinvest', on: 'yes' } as never] });
    expect(round.events.filter((e) => e.kind === 'orderRejected').map((e) => (e.kind === 'orderRejected' ? e.reason : ''))).toEqual(['bad-order']);
    const ruined = withPlayer(content, game(0), { reinvest: true, debts: [{ id: 'd', kind: 'creditCard', principal: 900_000_000, fixedRateBp: 0, roundsLeft: 0 }] });
    const after = applyRound(content, ruined, { orders: [] });
    expect(after.events.some((e) => e.kind === 'bankrupt')).toBe(true);
    expect(after.state.player.reinvest).toBe(false);
  });
});

describe('wealth at a glance', () => {
  it('says what it is held in, largest first, in shares that add up to all of it', () => {
    const state = holding(game(1_000_000), { [first]: 5_000_000, [second]: 2_000_000 }, { deposit: 3_000_000, pension: 500_000 });
    const quote = quotePortfolio(content, viewOf(state));
    expect(quote.total).toBe(1_000_000 + 3_000_000 + 500_000 + 7_000_000);
    expect(quote.slices.map((slice) => slice.value)).toEqual([...quote.slices.map((slice) => slice.value)].sort((a, b) => b - a));
    let sum = 0;
    for (const slice of quote.slices) {
      sum += slice.value;
      expect(slice.shareBp).toBe(Math.floor((slice.value * 10_000) / quote.total));
    }
    expect(sum).toBe(quote.total);
    expect(quote.slices.find((slice) => slice.kind === 'cash')).toEqual({ kind: 'cash', value: 1_000_000, shareBp: 869 });
    // Kinds with nothing in them are not there at all.
    expect(quote.slices.some((slice) => slice.kind === 'property' || slice.kind === 'things')).toBe(false);
  });

  it('names the one thing most of what is put to work hangs on, and warns only past the mark', () => {
    const spread = quotePortfolio(content, viewOf(holding(game(0), { [first]: 5_000_000, [second]: 5_000_000 })));
    expect(spread).toMatchObject({ invested: 10_000_000, concentrated: false });
    expect(spread.largest?.shareBp).toBe(5_000);
    const tilted = quotePortfolio(content, viewOf(holding(game(0), { [first]: 5_100_000, [second]: 4_900_000 })));
    expect(tilted.largest).toEqual({ kind: 'asset', id: first, value: 5_100_000, shareBp: 5_100 });
    expect(tilted.concentrated).toBe(true);
    expect(CONCENTRATION_PCT).toBe(50);
    // A single holding is a beginning, not a warning; and cash is not put to work.
    expect(quotePortfolio(content, viewOf(holding(game(90_000_000), { [first]: 5_000_000 })))).toMatchObject({ concentrated: false, invested: 5_000_000 });
    expect(quotePortfolio(content, viewOf(game(1_000_000)))).toMatchObject({ largest: null, concentrated: false, invested: 0 });
  });

  it('counts a property among what is put to work, and can name it the largest', () => {
    const owner = createGame({ content, start: { ...fixtureStart(), cash: 0, life: { lifeId: 'tester', career: { id: 'office', level: 0 }, careerSkill: 0, financeSkill: 0, focus: 3, properties: [{ typeId: 'flat', rented: false }] } } }, 'owner');
    const quote = quotePortfolio(content, viewOf(holding(owner, { [first]: 1_000_000 })));
    expect(quote.largest).toMatchObject({ kind: 'property', id: owner.player.properties[0].id });
    expect(quote.concentrated).toBe(true);
    expect(quote.slices[0].kind).toBe('property');
  });
});
