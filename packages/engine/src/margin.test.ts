import { describe, expect, it } from 'vitest';
import { debtRateBp } from './debt';
import { applyCard, applyRound, createGame, previewRound } from './game';
import { findInvariantBreaks } from './invariants';
import { quoteMargin } from './quotes';
import { netWorth } from './selectors';
import { fixtureContent, fixtureStart } from './testing/fixture';
import { withPlayer } from './testing/patch';
import type { CardDef, Content, FinanceSkill, GameEvent, GameState, Order } from './types';
import { validateContent } from './validate';
import { viewOf } from './view';

const content = fixtureContent();
const asset = 'fund_world';
const game = (cash: number, financeSkill: FinanceSkill = 3, c: Content = content, seed = 'margin'): GameState =>
  createGame({ content: c, start: { ...fixtureStart(), cash, life: { lifeId: 'tester', career: { id: 'office', level: 0 }, careerSkill: 0, financeSkill, focus: 3 } } }, seed);
const buy = (amount: number, margin?: number): Order => ({ type: 'buy', assetId: asset, amount, ...(margin === undefined ? {} : { margin }) });
const loanOn = (state: GameState) => state.player.debts.find((d) => d.kind === 'margin');
/** The state as the orders leave it, before the round moves any price. */
const after = (state: GameState, orders: Order[]) => previewRound(content, viewOf(state), { orders });

describe('buying with borrowed money', () => {
  it('buys twice what is put in, and owes the half that was not', () => {
    const start = game(5_000_000);
    const { player, rejected: refused } = after(start, [buy(1_000_000, 1_000_000)]);
    expect(refused).toEqual([]);
    expect(player.cash).toBe(4_000_000);
    expect(player.positions[asset]).toEqual({ value: 2_000_000, basis: 2_000_000 });
    expect(player.debts).toEqual([{ id: player.debts[0].id, kind: 'margin', principal: 1_000_000, fixedRateBp: 0, roundsLeft: 0, forAsset: asset }]);
    // Borrowed money is not wealth: the player is worth what they were.
    expect(netWorth(player)).toBe(netWorth(start.player));
  });

  it('adds to the one loan on a holding, and never lends more than the share of it the rules allow', () => {
    const start = game(50_000_000);
    const twice = after(start, [buy(1_000_000, 1_000_000), buy(500_000, 500_000)]);
    expect(twice.rejected).toEqual([]);
    expect(twice.player.debts.filter((d) => d.kind === 'margin')).toHaveLength(1);
    expect(twice.player.debts[0].principal).toBe(1_500_000);
    // Half of what is then held, to the cent, and not a cent more.
    expect(after(start, [buy(1_000_000, 1_000_000)]).rejected).toEqual([]);
    expect(after(start, [buy(1_000_000, 1_000_001)]).rejected.map((r) => r.reason)).toEqual(['over-margin-limit']);
    // What is already held unborrowed counts for the loan: 3 held, 1 put in, up to 4 more borrowed makes 8 held and 4 owed.
    const holding = withPlayer(content, start, { positions: { [asset]: { value: 3_000_000, basis: 3_000_000 } } });
    expect(after(holding, [buy(1_000_000, 4_000_000)]).rejected).toEqual([]);
    expect(after(holding, [buy(1_000_000, 4_000_001)]).rejected.map((r) => r.reason)).toEqual(['over-margin-limit']);
  });

  it('takes the skill for it, a broker willing to lend, the cash for the part put in, and a real amount', () => {
    for (const skill of [0, 1, 2] as const) expect(after(game(5_000_000, skill), [buy(1_000_000, 1_000_000)]).rejected.map((r) => r.reason)).toEqual(['needs-finance-skill']);
    const locked = withPlayer(content, game(5_000_000), { bankruptUntilRound: 4 });
    expect(after(locked, [buy(1_000_000, 1_000_000)]).rejected.map((r) => r.reason)).toEqual(['no-credit']);
    // Without the loan, a bankrupt buys as anyone does.
    expect(after(locked, [buy(1_000_000)]).rejected).toEqual([]);
    expect(after(game(500_000), [buy(1_000_000, 1_000_000)]).rejected.map((r) => r.reason)).toEqual(['not-enough-cash']);
    for (const bad of [-5, 0.5, Number.NaN]) expect(after(game(5_000_000), [buy(1_000_000, bad)]).rejected.map((r) => r.reason)).toEqual(['bad-amount']);
    // A refused purchase leaves nothing behind.
    const refused = after(game(500_000), [buy(1_000_000, 1_000_000)]).player;
    expect(refused.positions).toEqual({});
    expect(refused.debts).toEqual([]);
  });

  it('costs interest every round at the policy rate and the spread, and asks for no capital back', () => {
    const start = game(50_000_000);
    const state = applyRound(content, start, { orders: [buy(1_000_000, 1_000_000)] }).state;
    const loan = loanOn(state);
    if (!loan) throw new Error('the loan survives a round');
    const world = state.timeline[state.round];
    expect(debtRateBp(loan, content, world, state.player)).toBe(world.policyRateBp + content.debt.marginSpreadBp);
    const preview = previewRound(content, viewOf(state), { orders: [] });
    expect(preview.expenses.debtInterest).toBe(Math.floor((1_000_000 * (world.policyRateBp + content.debt.marginSpreadBp) * content.yearsPerRound) / 10_000));
    expect(preview.expenses.debtPrincipal).toBe(0);
    expect(loanOn(applyRound(content, state, { orders: [] }).state)?.principal ?? 1_000_000).toBe(1_000_000);
    expect(findInvariantBreaks(content, state)).toEqual([]);
  });

  it('pays the broker first when it is sold: his share of a part, and all of his loan with the last of it', () => {
    const start = game(50_000_000);
    const held = after(start, [buy(1_000_000, 1_000_000)]).player;
    const state = withPlayer(content, start, { cash: held.cash, positions: held.positions, debts: held.debts });
    // A quarter sold carries a quarter of the loan.
    const part = after(state, [{ type: 'sell', assetId: asset, amount: 500_000 }]).player;
    expect(part.debts[0].principal).toBe(750_000);
    expect(part.cash).toBe(state.player.cash + 500_000 - 250_000);
    expect(part.positions[asset].value).toBe(1_500_000);
    // All sold: the loan is gone, and the rest is the player's.
    const all = after(state, [{ type: 'sell', assetId: asset, amount: 2_000_000 }]).player;
    expect(all.debts).toEqual([]);
    expect(all.cash).toBe(state.player.cash + 1_000_000);
    expect(all.positions).toEqual({});
    // Paid down by hand, like any debt.
    const repaid = after(state, [{ type: 'repay', debtId: state.player.debts[0].id, amount: 1_000_000 }]).player;
    expect(repaid.debts).toEqual([]);
    expect(repaid.positions[asset].value).toBe(2_000_000);
  });

  it('leaves what a sale did not cover on the credit card, with nothing to secure it on', () => {
    // A holding worth less than its loan: sold by hand before the broker gets to it.
    const under = withPlayer(content, game(0), {
      positions: { [asset]: { value: 600_000, basis: 2_000_000 } },
      debts: [{ id: 'm', kind: 'margin', principal: 1_000_000, fixedRateBp: 0, roundsLeft: 0, forAsset: asset }],
    });
    const sold = after(under, [{ type: 'sell', assetId: asset, amount: 600_000 }]).player;
    expect(sold.cash).toBe(0);
    expect(sold.positions).toEqual({});
    expect(sold.debts.map((d) => [d.kind, d.principal])).toEqual([['creditCard', 400_000]]);
  });
});

describe('a margin call', () => {
  const leveraged = (value: number, owed: number, cash = 0) =>
    withPlayer(content, game(cash), {
      positions: { [asset]: { value, basis: value } },
      debts: [{ id: 'm', kind: 'margin', principal: owed, fixedRateBp: 0, roundsLeft: 0, forAsset: asset }],
    });
  const calls = (events: GameEvent[]) => events.filter((e): e is Extract<GameEvent, { kind: 'marginCall' }> => e.kind === 'marginCall');

  it('sells the whole holding once the loan is more than its share of it, and pays the loan first', () => {
    let seen = 0;
    for (const seed of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']) {
      const base = createGame({ content, start: { ...fixtureStart(), cash: 20_000_000, life: { lifeId: 'tester', career: { id: 'office', level: 0 }, careerSkill: 0, financeSkill: 3, focus: 3 } } }, seed);
      // Owed just under the call share today: any fall at all in the round crosses it.
      const state = withPlayer(content, base, { positions: { [asset]: { value: 1_000_000, basis: 1_000_000 } }, debts: [{ id: 'm', kind: 'margin', principal: 749_000, fixedRateBp: 0, roundsLeft: 0, forAsset: asset }] });
      const round = applyRound(content, state, { orders: [] });
      const moved = Math.max(0, 1_000_000 + Math.trunc((1_000_000 * (state.timeline[1].assetReturnBp[asset] ?? 0)) / 10_000));
      const due = 749_000 * 100 > moved * content.debt.marginCallPct;
      expect(calls(round.events), seed).toEqual(due ? [{ kind: 'marginCall', assetId: asset, sold: calls(round.events)[0]?.sold, repaid: 749_000 }] : []);
      if (due) {
        seen += 1;
        expect(round.state.player.positions).toEqual({});
        expect(round.state.player.debts.filter((d) => d.kind === 'margin')).toEqual([]);
      } else {
        expect(loanOn(round.state)?.principal).toBe(749_000);
      }
      expect(findInvariantBreaks(content, round.state)).toEqual([]);
    }
    // Some of those rounds fell and some did not.
    expect(seen).toBeGreaterThan(0);
    expect(seen).toBeLessThan(8);
  });

  it('leaves the player owing what the sale did not cover: first from savings, then on the card', () => {
    // Worth far less than is owed whatever the round does: the broker sells, and more is still to find than the round's pay leaves over.
    const state = withPlayer(content, leveraged(100_000, 6_000_000), { deposit: 100_000 });
    const round = applyRound(content, state, { orders: [] });
    expect(calls(round.events)).toHaveLength(1);
    expect(round.state.player.positions).toEqual({});
    expect(round.state.player.deposit).toBe(0);
    expect(round.events.some((e) => e.kind === 'bankrupt')).toBe(false);
    expect(round.state.player.debts.some((d) => d.kind === 'creditCard' && d.principal > 0)).toBe(true);
    expect(round.state.player.debts.some((d) => d.kind === 'margin')).toBe(false);
    expect(findInvariantBreaks(content, round.state)).toEqual([]);
  });

  it('is foretold by the quote: how far the price may fall before the broker sells', () => {
    const state = leveraged(2_000_000, 1_000_000, 5_000_000);
    const quote = quoteMargin(content, viewOf(state), asset);
    expect(quote).toMatchObject({ lock: null, minSkill: 3, maxPct: 50, callPct: 75, value: 2_000_000, owed: 1_000_000, canDouble: true });
    expect(quote.rateBp).toBe(state.timeline[0].policyRateBp + content.debt.marginSpreadBp);
    // Sold when 1,000,000 is more than 75% of the value: below 1,333,334, a fall of a third.
    expect(quote.dropToCallBp).toBe(3_333);
    const drop = (bp: number) => Math.floor((2_000_000 * (10_000 - bp)) / 10_000);
    expect(1_000_000 * 100 > drop(3_333) * 75).toBe(false);
    expect(1_000_000 * 100 > drop(3_334) * 75).toBe(true);
    // A holding past the half may be kept, but not added to with more borrowed money.
    expect(quoteMargin(content, viewOf(leveraged(1_500_000, 1_000_000)), asset)).toMatchObject({ canDouble: false });
    expect(quoteMargin(content, viewOf(game(1_000_000)), asset)).toMatchObject({ owed: 0, value: 0, dropToCallBp: null, canDouble: true });
    expect(quoteMargin(content, viewOf(game(1_000_000, 2)), asset).lock).toBe('needs-finance-skill');
    expect(quoteMargin(content, viewOf(withPlayer(content, game(1_000_000), { bankruptUntilRound: 5 })), asset).lock).toBe('no-credit');
  });
});

describe('the fourth level of finance skill', () => {
  it('comes from years of investing to someone at the third, and from nothing else', () => {
    const start = withPlayer(content, game(50_000_000, 2), { positions: { [asset]: { value: 1_000_000, basis: 1_000_000 } } });
    let state = start;
    const levels: number[] = [];
    for (let round = 0; round < content.life.financeMasterRounds + 1; round++) {
      state = applyRound(content, state, { orders: [] }).state;
      levels.push(state.player.life.financeSkill);
    }
    expect(levels.indexOf(3)).toBe(content.life.financeMasterRounds - 1);
    expect(levels.at(-1)).toBe(3);
    // Someone who reached the third level late gets there as soon as the years are behind them.
    const late = withPlayer(content, start, {}, { financeSkill: 2, investedRounds: 40 });
    expect(applyRound(content, late, { orders: [] }).state.player.life.financeSkill).toBe(3);
  });

  it('is not given by a card: a course takes someone to the third level and no further, and takes nothing from the fourth', () => {
    const course: CardDef = { id: 'course', category: 'education', weight: 10, cooldown: 0, options: [{}, { effects: { financeSkill: 1 } }] };
    const taught = fixtureContent();
    taught.cards = [course];
    const level = (from: FinanceSkill) => applyCard(taught, game(1_000_000, from, taught), 1).state.player.life.financeSkill;
    expect([0, 1, 2, 3].map((from) => level(from as FinanceSkill))).toEqual([1, 2, 2, 3]);
  });

  it('is checked in the rules: a call share above the lending share, and both below everything', () => {
    const bad = (change: (c: Content) => void) => {
      const c = fixtureContent();
      change(c);
      return validateContent(c);
    };
    expect(bad(() => {})).toEqual([]);
    expect(bad((c) => (c.debt.marginCallPct = 40))).toContain('debt.marginMaxPct must be a whole percentage below debt.marginCallPct, itself below 100');
    expect(bad((c) => (c.debt.marginCallPct = 100))).toContain('debt.marginMaxPct must be a whole percentage below debt.marginCallPct, itself below 100');
    expect(bad((c) => (c.debt.marginMinFinanceSkill = 5 as never))).toContain('debt.marginMinFinanceSkill must be 0, 1, 2 or 3');
    expect(bad((c) => (c.life.financeMasterRounds = 0))).toContain('life.financeMasterRounds must be a positive whole number');
  });
});
