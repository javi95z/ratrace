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

describe('the pension room of a preview', () => {
  const rejectedWith = (state: ReturnType<typeof createGame>, orders: RoundChoices['orders']) => previewRound(content, state, { orders }).rejected.map((r) => r.reason);

  it('is the most the pension will take this round: that much goes in, a cent more is refused', () => {
    for (const cash of [50_000, 400_000, 20_000_000]) {
      const start = createGame({ content, start: { ...fixtureStart(), cash } }, 'pension-room');
      const room = previewRound(content, start, { orders: [] }).pensionRoom;
      expect(room, String(cash)).toBeGreaterThan(0);
      expect(room, String(cash)).toBeLessThanOrEqual(cash);
      expect(rejectedWith(start, [{ type: 'pensionIn', amount: room }]), String(cash)).toEqual([]);
      expect(rejectedWith(start, [{ type: 'pensionIn', amount: room + 1 }]), String(cash)).toHaveLength(1);
    }
  });

  it('is never more than the cash in hand, however much is owned elsewhere', () => {
    const start = createGame({ content, start: { ...fixtureStart(), cash: 20_000_000 } }, 'pension-room');
    // Nearly everything goes into savings first: plenty is still owned, but little of it is cash.
    const saved = { type: 'depositIn' as const, amount: 19_900_000 };
    expect(previewRound(content, start, { orders: [saved] }).pensionRoom).toBe(100_000);
    expect(rejectedWith(start, [saved, { type: 'pensionIn', amount: 100_000 }])).toEqual([]);
    expect(rejectedWith(start, [saved, { type: 'pensionIn', amount: 100_001 }])).toEqual(['not-enough-cash']);
  });

  it('shrinks by what the orders so far have already paid in, down to nothing', () => {
    const start = createGame({ content, start: { ...fixtureStart(), cash: 20_000_000 } }, 'pension-room');
    const room = previewRound(content, start, { orders: [] }).pensionRoom;
    expect(previewRound(content, start, { orders: [{ type: 'pensionIn', amount: 100_000 }] }).pensionRoom).toBe(room - 100_000);
    const full = previewRound(content, start, { orders: [{ type: 'pensionIn', amount: room }] });
    expect(full.rejected).toEqual([]);
    expect(full.pensionRoom).toBe(0);
  });

  it('is nothing for someone who owes more than they own outside it, however much cash they hold', () => {
    const debt = { kind: 'personalLoan' as const, principal: 9_000_000, fixedRateBp: 600, roundsLeft: 4 };
    const start = createGame({ content, start: { ...fixtureStart(), cash: 2_000_000, debts: [debt] } }, 'pension-room');
    expect(previewRound(content, start, { orders: [] }).pensionRoom).toBe(0);
    expect(rejectedWith(start, [{ type: 'pensionIn', amount: 1 }])).toEqual(['would-be-insolvent']);
    // Clear of debt, the same cash has room again.
    const clear = createGame({ content, start: { ...fixtureStart(), cash: 2_000_000 } }, 'pension-room');
    expect(previewRound(content, clear, { orders: [] }).pensionRoom).toBeGreaterThan(0);
  });
});
