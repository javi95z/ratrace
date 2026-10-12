import { describe, expect, it } from 'vitest';
import { applyRound, createGame, previewRound } from './game';
import { fixtureContent, fixtureStart } from './testing/fixture';
import type { GameEvent, LedgerLine, RoundChoices } from './types';

const content = fixtureContent();
const ledger = (events: GameEvent[], line: LedgerLine): number => {
  const found = events.find((e) => e.kind === 'ledger' && e.line === line);
  return found && found.kind === 'ledger' ? found.amount : 0;
};

const busy: RoundChoices = {
  orders: [
    { type: 'buy', assetId: 'fund_world', amount: 2_000_000 },
    { type: 'buy', assetId: 'bond_long', amount: 1_000_000 },
    { type: 'depositIn', amount: 1_000_000 },
    { type: 'pensionIn', amount: 600_000 },
    { type: 'borrow', amount: 900_000 },
    { type: 'buyProperty', typeId: 'studio', downPayment: 4_000_000, mortgage: 'fixed', rented: true },
    { type: 'sell', assetId: 'fund_world', amount: 500_000 },
  ],
};

describe('previewRound', () => {
  it('predicts exactly what the round will pay and charge', () => {
    const start = createGame({ content, start: { ...fixtureStart(), cash: 20_000_000 } }, 'preview');
    const preview = previewRound(content, start, busy);
    const { events } = applyRound(content, start, busy);
    expect(preview.rejected).toEqual([]);
    expect(preview.income.salary).toBe(ledger(events, 'salary'));
    expect(preview.income.dividends).toBe(ledger(events, 'dividends'));
    expect(preview.income.interest).toBe(ledger(events, 'interest'));
    expect(preview.income.rent).toBe(ledger(events, 'rent'));
    expect(preview.expenses.living).toBe(-ledger(events, 'living'));
    expect(preview.expenses.debtInterest).toBe(-ledger(events, 'debtInterest'));
    expect(preview.expenses.debtPrincipal).toBe(-ledger(events, 'debtPrincipal'));
    expect(preview.tax.income).toBe(-ledger(events, 'incomeTax'));
    expect(preview.tax.investment).toBe(-ledger(events, 'investmentTax'));
    expect(preview.tax.property).toBe(-ledger(events, 'propertyTax'));
    expect(preview.purchaseTaxPaid).toBe(-ledger(events, 'purchaseTax'));
    expect(preview.tax.income).toBeGreaterThan(0);
    expect(preview.tax.investment).toBeGreaterThan(0);
    expect(preview.tax.property).toBeGreaterThan(0);
    expect(preview.expenses.debtInterest).toBeGreaterThan(0);
  });

  it('gives the cash the round leaves before settlement', () => {
    const start = createGame({ content, start: fixtureStart() }, 'preview-cash');
    expect(previewRound(content, start, { orders: [] }).cashAfter).toBe(1_830_000);
    const broke = createGame({ content, start: { ...fixtureStart(), salaryAnnual: 0 } }, 'preview-cash');
    expect(previewRound(content, broke, { orders: [] }).cashAfter).toBe(-3_600_000);
  });

  it('shows the holdings after the orders, and which orders were rejected', () => {
    const start = createGame({ content, start: { ...fixtureStart(), cash: 1_000_000 } }, 'preview-orders');
    const preview = previewRound(content, start, {
      orders: [
        { type: 'buy', assetId: 'gold', amount: 400_000 },
        { type: 'sell', assetId: 'fund_world', amount: 100 },
        { type: 'buy', assetId: 'gold', amount: 9_000_000 },
      ],
    });
    expect(preview.player.positions).toEqual({ gold: { value: 400_000, basis: 400_000 } });
    expect(preview.player.cash).toBe(600_000);
    expect(preview.rejected).toEqual([
      { index: 1, order: { type: 'sell', assetId: 'fund_world', amount: 100 }, reason: 'no-position' },
      { index: 2, order: { type: 'buy', assetId: 'gold', amount: 9_000_000 }, reason: 'not-enough-cash' },
    ]);
  });

  it('does not change the state it was given', () => {
    const start = createGame({ content, start: { ...fixtureStart(), cash: 20_000_000 } }, 'preview-pure');
    const before = JSON.stringify(start);
    previewRound(content, start, busy);
    expect(JSON.stringify(start)).toBe(before);
  });

  it('cannot see the future: changing the next world changes nothing', () => {
    const start = createGame({ content, start: { ...fixtureStart(), cash: 20_000_000 } }, 'preview-future');
    const altered = structuredClone(start);
    altered.timeline[1].assetReturnBp.fund_world = -9_500;
    altered.timeline[1].propertyReturnBp.home = 4_000;
    altered.timeline[1].policyRateBp = 800;
    altered.timeline[1].priceLevel = 5_000_000;
    expect(previewRound(content, altered, busy)).toEqual(previewRound(content, start, busy));
  });

  it('refuses a finished game and malformed choices, like applyRound', () => {
    let state = createGame({ content, start: fixtureStart() }, 'preview-end');
    expect(() => previewRound(content, state, {} as RoundChoices)).toThrow('previewRound: choices.orders must be an array');
    for (let i = 0; i < 20; i++) state = applyRound(content, state, { orders: [] }).state;
    expect(() => previewRound(content, state, { orders: [] })).toThrow('previewRound: the game is already finished');
  });
});
