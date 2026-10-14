import { describe, expect, it } from 'vitest';
import { auditBill, declaredTax, hiding } from './evasion';
import { applyRound, createGame, previewRound } from './game';
import { findInvariantBreaks } from './invariants';
import { deriveExpenses } from './life/derive';
import { mulDiv } from './money';
import { quoteEvasion, quoteItem } from './quotes';
import { indexed } from './rates';
import { computeTax, effectiveTax } from './tax';
import { fixtureContent, fixtureStart } from './testing/fixture';
import { withPlayer } from './testing/patch';
import type { Content, GameEvent, GameState, LifeStart, Order } from './types';
import { validateContent } from './validate';
import { viewOf } from './view';

const office: LifeStart = { lifeId: 'tester', career: { id: 'office', level: 2 }, careerSkill: 10, financeSkill: 0, focus: 3 };

/** The fixture with suspicion drawn by every way of hiding, and inspections as likely as asked. */
function contentWith(change: (c: Content) => void = () => {}): Content {
  const content = fixtureContent();
  Object.assign(content.evasion, {
    blackSuspicionPer100: 20,
    shellFeeAnnual: 5_000_00,
    shellSuspicion: 8,
    cryptoSuspicion: 6,
    cryptoReportRound: 3,
    noInvoiceLadders: ['watch'],
    noInvoiceSaleSuspicion: 15,
    auditMaxPct: 0,
  });
  change(content);
  return content;
}

const game = (content: Content, life: Partial<LifeStart> = {}, cash = 20_000_000): GameState =>
  createGame({ content, start: { ...fixtureStart(), cash, life: { ...office, ...life } } }, 'evasion');
const set = (order: Omit<Extract<Order, { type: 'setEvasion' }>, 'type'>): Order => ({ type: 'setEvasion', ...order });
const rejected = (events: GameEvent[]) => events.flatMap((e) => (e.kind === 'orderRejected' ? [e.reason] : []));
const ledger = (events: GameEvent[], line: string) => events.flatMap((e) => (e.kind === 'ledger' && e.line === line ? [e.amount] : []));
/** A holding bought for one amount and worth another. */
const holding = (assetId: string, basis: number, value: number) => ({ [assetId]: { basis, value } });

describe('what is declared', () => {
  it('leaves pay taken under the table out of the income tax, and says how much was saved', () => {
    const content = contentWith();
    const state = game(content);
    const honest = previewRound(content, state, { orders: [] });
    const black = previewRound(content, state, { orders: [set({ blackPct: 25 })] });
    expect(honest.evaded).toEqual({ black: 0, shell: 0, crypto: 0, total: 0 });
    expect(black.evaded.black).toBe(honest.tax.income - black.tax.income);
    expect(black.evaded.black).toBeGreaterThan(0);
    // The salary itself is all paid: only the tax on a share of it is not.
    expect(black.income.salary).toBe(honest.income.salary);
    expect(black.cashAfter - honest.cashAfter).toBe(black.evaded.black);
    // And the bill is exactly what a quarter less salary would pay.
    const city = content.cities[0];
    const now = state.timeline[0];
    const lower = computeTax(effectiveTax(city, now), indexed(city.medianSalaryAnnual, now), content.yearsPerRound, {
      salary: mulDiv(honest.income.salary, 75, 100), otherIncome: 0, pensionContribution: 0, realisedGains: 0, dividends: honest.income.dividends + honest.income.interest, rent: 0, propertyValueOwned: 0,
    });
    expect(black.tax.income).toBe(lower.income);
  });

  it('leaves crypto gains out when told, and taxes every other gain as before', () => {
    const content = contentWith();
    const rich = withPlayer(content, game(content), { positions: { ...holding('coin_major', 1_000_000, 3_000_000), ...holding('fund_world', 1_000_000, 3_000_000) } });
    const sellBoth: Order[] = [{ type: 'sell', assetId: 'coin_major', amount: 3_000_000 }, { type: 'sell', assetId: 'fund_world', amount: 3_000_000 }];
    const honest = previewRound(content, rich, { orders: sellBoth });
    const hidden = previewRound(content, rich, { orders: [set({ hideCrypto: true }), ...sellBoth] });
    const fundOnly = previewRound(content, rich, { orders: [{ type: 'sell', assetId: 'fund_world', amount: 3_000_000 }] });
    expect(hidden.evaded.crypto).toBe(honest.tax.investment - hidden.tax.investment);
    expect(hidden.evaded.crypto).toBeGreaterThan(0);
    // What is left is the tax on the fund alone.
    expect(hidden.tax.investment).toBe(fundOnly.tax.investment);
  });

  it('takes the offshore company\'s share off the investment tax that is left, and charges its fee every year', () => {
    const content = contentWith();
    const state = withPlayer(content, game(content, { financeSkill: 3 }), { positions: holding('fund_world', 1_000_000, 5_000_000) });
    const sell: Order = { type: 'sell', assetId: 'fund_world', amount: 5_000_000 };
    const honest = previewRound(content, state, { orders: [sell] });
    const shell = previewRound(content, state, { orders: [set({ shell: true }), sell] });
    expect(shell.evaded.shell).toBe(mulDiv(honest.tax.investment, 80, 100));
    expect(shell.tax.investment).toBe(honest.tax.investment - shell.evaded.shell);
    // The fee is a yearly cost like any upkeep, at today's prices.
    expect(deriveExpenses(shell.player, content) - deriveExpenses(honest.player, content)).toBe(content.evasion.shellFeeAnnual);
    expect(shell.expenses.other - honest.expenses.other).toBe(indexed(content.evasion.shellFeeAnnual, state.timeline[0]) * content.yearsPerRound);
  });

  it('is the honest bill exactly when nothing is hidden', () => {
    const content = contentWith();
    const state = game(content);
    const p = state.player;
    const city = content.cities[0];
    const now = state.timeline[0];
    const input = { salary: 10_000_000, otherIncome: 0, pensionContribution: 0, realisedGains: 500_000, dividends: 0, rent: 0, propertyValueOwned: 0 };
    const tax = effectiveTax(city, now);
    const median = indexed(city.medianSalaryAnnual, now);
    expect(declaredTax(content, p, tax, median, input, 500_000)).toEqual({ bill: computeTax(tax, median, content.yearsPerRound, input), evaded: { black: 0, shell: 0, crypto: 0, total: 0 } });
  });
});

describe('what may be hidden', () => {
  it('is set by order, part by part, and refused where it cannot be', () => {
    const content = contentWith();
    const state = game(content);
    const tried = (orders: Order[], s = state) => rejected(applyRound(content, s, { orders }).events);
    expect(tried([set({ blackPct: 30 })])).toEqual(['bad-share']);
    expect(tried([set({ shell: true })])).toEqual(['needs-finance-skill']);
    expect(tried([set({ blackPct: 25 })], withPlayer(content, state, {}, { career: null }))).toEqual(['no-job']);
    expect(tried([{ type: 'setEvasion', shell: 'yes' } as unknown as Order])).toEqual(['bad-order']);
    // Each part changes only itself.
    const after = applyRound(content, state, { orders: [set({ blackPct: 25 }), set({ hideCrypto: true })] }).state;
    expect(after.player.life.evasion).toMatchObject({ blackPct: 25, hideCrypto: true, shell: false });
    expect(applyRound(content, after, { orders: [set({ hideCrypto: false })] }).state.player.life.evasion).toMatchObject({ blackPct: 25, hideCrypto: false });
    // A company already open may be closed by anyone.
    const open = withPlayer(content, state, {}, { evasion: { ...state.player.life.evasion, shell: true } });
    expect(tried([set({ shell: false })], open)).toEqual([]);
  });
});

describe('suspicion', () => {
  it('rises each round with what is hidden, and eases with nothing hidden', () => {
    const content = contentWith();
    let state = game(content);
    state = applyRound(content, state, { orders: [set({ blackPct: 50 })] }).state;
    // Half the salary under the table: ten points a round.
    expect(state.player.life.evasion.suspicion).toBe(10);
    state = applyRound(content, state, { orders: [] }).state;
    expect(state.player.life.evasion.suspicion).toBe(20);
    state = applyRound(content, state, { orders: [set({ blackPct: 0 })] }).state;
    expect(state.player.life.evasion.suspicion).toBe(15);
    expect(findInvariantBreaks(content, state)).toEqual([]);
  });

  it('counts the coins twice once the exchanges report, and every question at the sale of something bought without an invoice', () => {
    const content = contentWith();
    const coins = withPlayer(content, game(content), { positions: holding('coin_major', 1_000_000, 2_000_000) });
    const early = applyRound(content, coins, { orders: [set({ hideCrypto: true }), { type: 'sell', assetId: 'coin_major', amount: 1_000_000 }] }).state;
    expect(early.player.life.evasion.suspicion).toBe(6);
    const late = withPlayer(content, { ...coins, round: 3 } as GameState, {});
    const reported = previewRound(content, late, { orders: [set({ hideCrypto: true }), { type: 'sell', assetId: 'coin_major', amount: 1_000_000 }] });
    expect(quoteEvasion(content, viewOf(late), reported.evaded, reported.noInvoiceSold).suspicionAfter).toBe(12);

    const watch = applyRound(content, game(content), { orders: [{ type: 'buyItem', itemId: 'watch_gold', noInvoice: true }] }).state;
    const sold = applyRound(content, watch, { orders: [{ type: 'sellItem', itemId: 'watch_gold' }] }).state;
    expect(sold.player.life.evasion.suspicion).toBe(15);
  });
});

describe('an inspection', () => {
  /** A life that has hidden for a while, with inspections certain from now on. */
  const caught = () => {
    const content = contentWith();
    let state = game(content, {}, 20_000_000);
    state = applyRound(content, state, { orders: [set({ blackPct: 25 }), { type: 'buyItem', itemId: 'watch_gold', noInvoice: true }] }).state;
    state = applyRound(content, state, { orders: [] }).state;
    // Suspected to the full, where nothing caps the chance: the next round is inspected.
    const certain = contentWith((c) => (c.evasion.auditMaxPct = 100));
    return { content: certain, state: withPlayer(certain, state, {}, { evasion: { ...state.player.life.evasion, suspicion: 100 } }) };
  };

  it('takes back what was hidden with its fine and a share of the goods, costs status, and ends every way of hiding', () => {
    const { content, state } = caught();
    const preview = previewRound(content, state, { orders: [] });
    const quote = quoteEvasion(content, viewOf(state), preview.evaded, preview.noInvoiceSold);
    expect(quote.auditChancePct).toBe(quote.suspicionAfter);
    const { state: after, events } = applyRound(content, state, { orders: [] });
    const audit = events.find((e) => e.kind === 'audit');
    expect(audit).toEqual({ kind: 'audit', evaded: quote.bill.evaded, fine: quote.bill.fine, goods: quote.bill.goods });
    expect(quote.bill.fine).toBe(mulDiv(quote.bill.evaded, 50, 100));
    expect(quote.bill.goods).toBeGreaterThan(0);
    expect(ledger(events, 'taxAudit')).toEqual([-quote.bill.total]);
    expect(after.player.life.bonusStatus - state.player.life.bonusStatus).toBe(content.evasion.auditStatus);
    expect(after.player.life.evasion).toEqual({ blackPct: 0, shell: false, hideCrypto: false, suspicion: 0, evaded: [] });
    // The watch is still the player's, and no longer a secret.
    expect(after.player.life.items.find((x) => x.itemId === 'watch_gold')?.noInvoice).toBeUndefined();
    expect(findInvariantBreaks(content, after)).toEqual([]);
  });

  it('can claim only what is not past the time limit', () => {
    const content = contentWith();
    const state = game(content);
    const old = withPlayer(content, state, {}, { evasion: { ...state.player.life.evasion, evaded: [{ round: 0, amount: 100 }], suspicion: 0 } });
    // Hidden in the first round, it can be claimed in that round and the next: two rounds, four years. Then it is forgotten.
    const next = applyRound(content, old, { orders: [] }).state;
    expect(auditBill(content, next.player).evaded).toBe(100);
    const later = applyRound(content, next, { orders: [] }).state;
    expect(later.player.life.evasion.evaded).toEqual([]);
    expect(auditBill(content, later.player).evaded).toBe(0);
    const fresh = withPlayer(content, { ...state, round: 1 } as GameState, {}, { evasion: { ...state.player.life.evasion, evaded: [{ round: 0, amount: 100 }] } });
    expect(quoteEvasion(content, viewOf(fresh), { black: 0, shell: 0, crypto: 0, total: 0 }, 0).bill.evaded).toBe(100);
  });

  it('leaves the dice of an honest life exactly as they were', () => {
    const plain = fixtureContent();
    const strict = contentWith((c) => (c.evasion.auditMaxPct = 60));
    let a = game(plain);
    let b = game(strict);
    for (let round = 0; round < 5; round++) {
      a = applyRound(plain, a, { orders: [] }).state;
      b = applyRound(strict, b, { orders: [] }).state;
      expect(b.rng).toEqual(a.rng);
      expect(b.hand).toEqual(a.hand);
      expect(hiding(b.player.life.evasion)).toBe(false);
    }
  });
});

describe('buying without an invoice', () => {
  it('sells a watch for less, in cash, worth the same share of what it cost, and marks it', () => {
    const content = contentWith();
    const state = game(content);
    const quote = quoteItem(content, viewOf(state), 'watch_gold');
    const watch = content.items.find((x) => x.id === 'watch_gold');
    if (!watch || !quote.noInvoice) throw new Error('a watch is sold without an invoice');
    expect(quote.noInvoice.price).toBe(mulDiv(quote.price, 85, 100));
    expect(quote.noInvoice.resale).toBe(mulDiv(quote.noInvoice.price, watch.resaleStartPct, 100));
    const { state: after, events } = applyRound(content, state, { orders: [{ type: 'buyItem', itemId: 'watch_gold', noInvoice: true }] });
    expect(ledger(events, 'itemPurchases')).toEqual([-quote.noInvoice.price]);
    expect(after.player.life.items[0]).toMatchObject({ itemId: 'watch_gold', noInvoice: true, paid: quote.noInvoice.price });
    expect(quoteItem(content, viewOf(after), 'watch_gold')).toMatchObject({ ownedNoInvoice: true, noInvoice: null });
    // Never for profit in the same round.
    const flip = applyRound(content, state, { orders: [{ type: 'buyItem', itemId: 'watch_gold', noInvoice: true }, { type: 'sellItem', itemId: 'watch_gold' }] }).state;
    expect(flip.player.cash).toBeLessThan(applyRound(content, state, { orders: [] }).state.player.cash);
  });

  it('is refused for what is not sold so, on instalments, second hand, or without the cash', () => {
    const content = contentWith();
    const state = game(content);
    const tried = (orders: Order[], s = state) => rejected(applyRound(content, s, { orders }).events);
    expect(tried([{ type: 'buyItem', itemId: 'car_basic', noInvoice: true }])).toEqual(['not-sold-without-invoice']);
    expect(tried([{ type: 'buyItem', itemId: 'watch_gold', noInvoice: true, financed: true }])).toEqual(['cannot-finance']);
    expect(tried([{ type: 'buyItem', itemId: 'watch_gold', noInvoice: true, used: true }])).toEqual(['not-sold-without-invoice']);
    expect(tried([{ type: 'buyItem', itemId: 'watch_gold', noInvoice: true }], game(content, {}, 100))).toEqual(['not-enough-cash']);
    expect(quoteItem(content, viewOf(game(content, {}, 100)), 'watch_gold').noInvoice?.lock).toBe('not-enough-cash');
  });
});

describe('the rules and the state', () => {
  it('are checked', () => {
    const bad = fixtureContent();
    Object.assign(bad.evasion, { blackPcts: [10, 5], shellTaxCutPct: 120, auditStatus: 3, noInvoiceLadders: ['membership'] });
    expect(validateContent(bad)).toEqual(
      expect.arrayContaining([
        'evasion.blackPcts must start at 0 and rise in whole percentages below 100',
        'evasion.shellTaxCutPct must be a whole number from 0 to 100',
        'evasion.auditStatus must be a whole number, zero or less',
        'evasion.noInvoiceLadders names a ladder that is not one of durables: membership',
      ]),
    );
    const content = contentWith();
    const state = game(content);
    const broken = withPlayer(content, state, {}, { evasion: { ...state.player.life.evasion, blackPct: 30, suspicion: 101 } });
    expect(findInvariantBreaks(content, broken)).toEqual(
      expect.arrayContaining(['life.evasion.blackPct is not a share the rules allow: 30', 'life.evasion.suspicion is not a whole number from 0 to 100: 101']),
    );
    const marked = withPlayer(content, state, {}, { items: [{ itemId: 'car_basic', value: 1, roundsLeft: null, paid: 1, age: 0, noInvoice: true }], collection: ['car_basic'] });
    expect(findInvariantBreaks(content, marked)).toContain('item car_basic is marked bought without an invoice, and it is not sold that way');
  });
});
