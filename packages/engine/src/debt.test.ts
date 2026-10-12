import { describe, expect, it } from 'vitest';
import {
  applyDebtPayments,
  checkBankruptcy,
  debtRateBp,
  debtServiceForRound,
  executeBorrow,
  executeRepay,
  settleCash,
} from './debt';
import { newPlayer } from './player';
import type { OrderContext } from './portfolio';
import { fixtureContent, fixtureStart } from './testing/fixture';
import type { Debt } from './types';
import { generateTimeline } from './world';

function setup(cash = 0) {
  const content = fixtureContent();
  const world = generateTimeline('debt', content)[0];
  const p = newPlayer({ ...fixtureStart(), cash });
  const ctx: OrderContext = {
    content,
    world,
    round: 0,
    tally: { realisedGains: 0, pensionContribution: 0, propertyPurchases: 0 },
  };
  return { content, world, p, ctx };
}

const debt = (over: Partial<Debt>): Debt => ({ id: 'd', kind: 'personalLoan', principal: 900_000, fixedRateBp: 750, roundsLeft: 3, ...over });

describe('debt rates and service', () => {
  it('uses the right rate for each kind', () => {
    const { content, world } = setup();
    expect(debtRateBp(debt({ kind: 'personalLoan' }), content, world)).toBe(750);
    expect(debtRateBp(debt({ kind: 'mortgageFixed', fixedRateBp: 400 }), content, world)).toBe(400);
    expect(debtRateBp(debt({ kind: 'mortgageVariable', fixedRateBp: 0 }), content, world)).toBe(250 + 150);
    expect(debtRateBp(debt({ kind: 'creditCard', fixedRateBp: 0 }), content, world)).toBe(2_200);
  });

  it('charges simple interest and an equal principal slice', () => {
    const { content, world, p } = setup();
    p.debts.push(debt({}));
    const service = debtServiceForRound(p, content, world);
    expect(service.interest).toBe(135_000);
    expect(service.principal).toBe(300_000);
  });

  it('pays a loan off over its term and then removes it', () => {
    const { content, world, p } = setup();
    p.debts.push(debt({}));
    for (let i = 0; i < 3; i++) applyDebtPayments(p, debtServiceForRound(p, content, world));
    expect(p.debts).toEqual([]);
  });

  it('charges a credit card interest only', () => {
    const { content, world, p } = setup();
    p.debts.push(debt({ kind: 'creditCard', principal: 1_000_000, fixedRateBp: 0, roundsLeft: 0 }));
    const service = debtServiceForRound(p, content, world);
    expect(service.interest).toBe(440_000);
    expect(service.principal).toBe(0);
    applyDebtPayments(p, service);
    expect(p.debts[0].principal).toBe(1_000_000);
  });
});

describe('borrow and repay', () => {
  it('borrows at the policy rate plus the spread', () => {
    const { p, ctx } = setup();
    expect(executeBorrow(p, { type: 'borrow', amount: 1_000_000 }, ctx)).toBeNull();
    expect(p.cash).toBe(1_000_000);
    expect(p.debts).toEqual([{ id: 'debt-1', kind: 'personalLoan', principal: 1_000_000, fixedRateBp: 750, roundsLeft: 3 }]);
  });

  it('refuses a loan over the income limit or during the bankruptcy lock', () => {
    const { p, ctx } = setup();
    expect(executeBorrow(p, { type: 'borrow', amount: 3_000_001 }, ctx)).toBe('over your personal loan limit');
    p.bankruptUntilRound = 3;
    expect(executeBorrow(p, { type: 'borrow', amount: 100 }, ctx)).toBe('no credit available after bankruptcy');
    expect(p.debts).toEqual([]);
  });

  it('repays in part and in full', () => {
    const { p } = setup(1_000_000);
    p.debts.push(debt({ id: 'debt-9' }));
    expect(executeRepay(p, { type: 'repay', debtId: 'debt-9', amount: 400_000 })).toBeNull();
    expect(p.debts[0].principal).toBe(500_000);
    expect(executeRepay(p, { type: 'repay', debtId: 'debt-9', amount: 500_000 })).toBeNull();
    expect(p.debts).toEqual([]);
    expect(p.cash).toBe(100_000);
  });

  it('rejects malformed amounts, unknown debts and overpayment, changing nothing', () => {
    const { p, ctx } = setup(1_000_000);
    p.debts.push(debt({ id: 'debt-9' }));
    const before = JSON.stringify(p);
    for (const amount of [0, -5, 12.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 2]) {
      expect(executeBorrow(p, { type: 'borrow', amount }, ctx)).toBe('amount must be a positive whole number of cents');
      expect(executeRepay(p, { type: 'repay', debtId: 'debt-9', amount })).toBe('amount must be a positive whole number of cents');
    }
    expect(executeRepay(p, { type: 'repay', debtId: 'gone', amount: 100 })).toBe('unknown debt: gone');
    expect(executeRepay(p, { type: 'repay', debtId: '__proto__', amount: 100 })).toBe('unknown debt: __proto__');
    expect(executeRepay(p, { type: 'repay', debtId: 'debt-9', amount: 900_001 })).toBe('cannot repay more than you owe');
    p.cash = 50;
    expect(executeRepay(p, { type: 'repay', debtId: 'debt-9', amount: 100 })).toBe('not enough cash');
    p.cash = 1_000_000;
    expect(JSON.stringify(p)).toBe(before);
  });
});

describe('cash settlement and bankruptcy', () => {
  it('puts a shortfall on the credit card', () => {
    const { p } = setup();
    p.cash = -250_000;
    expect(settleCash(p)).toBe(250_000);
    expect(p.cash).toBe(0);
    expect(p.debts).toEqual([{ id: 'debt-1', kind: 'creditCard', principal: 250_000, fixedRateBp: 0, roundsLeft: 0 }]);
    p.cash = -50_000;
    expect(settleCash(p)).toBe(50_000);
    expect(p.debts[0].principal).toBe(300_000);
  });

  it('pays the card down from spare cash', () => {
    const { p } = setup();
    p.debts.push(debt({ id: 'card', kind: 'creditCard', principal: 300_000, fixedRateBp: 0, roundsLeft: 0 }));
    p.cash = 100_000;
    expect(settleCash(p)).toBe(0);
    expect(p.cash).toBe(0);
    expect(p.debts[0].principal).toBe(200_000);
    p.cash = 500_000;
    settleCash(p);
    expect(p.debts).toEqual([]);
    expect(p.cash).toBe(300_000);
  });

  it('does not bankrupt a player under the threshold', () => {
    const { content, p } = setup();
    p.debts.push(debt({ id: 'card', kind: 'creditCard', principal: 9_000_000, fixedRateBp: 0, roundsLeft: 0 }));
    expect(checkBankruptcy(p, content, 3_000_000, 5)).toBe(false);
    expect(p.debts).toHaveLength(1);
  });

  it('bankrupts over the threshold: sells at a discount, clears debts, locks credit, keeps the pension', () => {
    const { content, p } = setup();
    p.debts.push(debt({ id: 'card', kind: 'creditCard', principal: 9_000_001, fixedRateBp: 0, roundsLeft: 0 }));
    p.positions.gold = { value: 1_000_000, basis: 1_000_000 };
    p.deposit = 200_000;
    p.pension = 777;
    expect(checkBankruptcy(p, content, 3_000_000, 5)).toBe(true);
    expect(p.debts).toEqual([]);
    expect(p.positions).toEqual({});
    expect(p.properties).toEqual([]);
    expect(p.deposit).toBe(0);
    expect(p.cash).toBe(0);
    expect(p.pension).toBe(777);
    expect(p.bankruptUntilRound).toBe(8);
  });

  it('uses living cost as the floor when income is zero', () => {
    const { content, p } = setup();
    p.debts.push(debt({ id: 'card', kind: 'creditCard', principal: 5_400_000, fixedRateBp: 0, roundsLeft: 0 }));
    expect(checkBankruptcy(p, content, 0, 1)).toBe(false);
    p.debts[0].principal = 5_400_001;
    expect(checkBankruptcy(p, content, 0, 1)).toBe(true);
  });
});
