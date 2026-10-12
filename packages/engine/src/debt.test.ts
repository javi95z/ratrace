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
import { newTally } from './tally';
import { fixtureContent, fixturePlayer } from './testing/fixture';
import type { Debt, OrderContext } from './types';
import { generateTimeline } from './world';

function setup(cash = 0) {
  const content = fixtureContent();
  const world = generateTimeline('debt', content)[0];
  const p = fixturePlayer({ cash });
  const ctx: OrderContext = {
    content,
    world,
    round: 0,
    tally: newTally(),
  };
  return { content, world, p, ctx };
}

const debt = (over: Partial<Debt>): Debt => ({ id: 'd', kind: 'personalLoan', principal: 900_000, fixedRateBp: 750, roundsLeft: 3, ...over });
const card = (principal: number): Debt => debt({ id: 'card', kind: 'creditCard', principal, fixedRateBp: 0, roundsLeft: 0 });

describe('debt rates and service', () => {
  it('uses the right rate for each kind', () => {
    const { content, world, p } = setup();
    expect(debtRateBp(debt({ kind: 'personalLoan' }), content, world, p)).toBe(750);
    expect(debtRateBp(debt({ kind: 'mortgageFixed', fixedRateBp: 400 }), content, world, p)).toBe(400);
    expect(debtRateBp(debt({ kind: 'mortgageVariable', fixedRateBp: 0 }), content, world, p)).toBe(250 + 150);
    expect(debtRateBp(card(1), content, world, p)).toBe(2_200);
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
    p.debts.push(card(1_000_000));
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
    expect(executeBorrow(p, { type: 'borrow', amount: 3_000_001 }, ctx)).toBe('over-loan-limit');
    p.bankruptUntilRound = 3;
    expect(executeBorrow(p, { type: 'borrow', amount: 100 }, ctx)).toBe('no-credit');
    expect(p.debts).toEqual([]);
  });

  it('raises the loan limit with the price level', () => {
    const { p, ctx } = setup();
    const dearer = { ...ctx, world: { ...ctx.world, priceLevel: 2_000_000 } };
    expect(executeBorrow(p, { type: 'borrow', amount: 6_000_001 }, dearer)).toBe('over-loan-limit');
    expect(executeBorrow(p, { type: 'borrow', amount: 6_000_000 }, dearer)).toBeNull();
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
      expect(executeBorrow(p, { type: 'borrow', amount }, ctx)).toBe('bad-amount');
      expect(executeRepay(p, { type: 'repay', debtId: 'debt-9', amount })).toBe('bad-amount');
    }
    expect(executeRepay(p, { type: 'repay', debtId: 'gone', amount: 100 })).toBe('unknown-debt');
    expect(executeRepay(p, { type: 'repay', debtId: '__proto__', amount: 100 })).toBe('unknown-debt');
    expect(executeRepay(p, { type: 'repay', debtId: 'debt-9', amount: 900_001 })).toBe('exceeds-debt');
    p.cash = 50;
    expect(executeRepay(p, { type: 'repay', debtId: 'debt-9', amount: 100 })).toBe('not-enough-cash');
    p.cash = 1_000_000;
    expect(JSON.stringify(p)).toBe(before);
  });
});

describe('cash settlement', () => {
  it('puts a shortfall on the credit card when there are no savings', () => {
    const { p } = setup();
    p.cash = -250_000;
    expect(settleCash(p)).toEqual({ fromDeposit: 0, drawn: 250_000, repaid: 0 });
    expect(p.cash).toBe(0);
    expect(p.debts).toEqual([{ id: 'debt-1', kind: 'creditCard', principal: 250_000, fixedRateBp: 0, roundsLeft: 0 }]);
    p.cash = -50_000;
    expect(settleCash(p)).toEqual({ fromDeposit: 0, drawn: 50_000, repaid: 0 });
    expect(p.debts[0].principal).toBe(300_000);
  });

  it('draws on the deposit before the credit card', () => {
    const { p } = setup();
    p.cash = -250_000;
    p.deposit = 100_000;
    expect(settleCash(p)).toEqual({ fromDeposit: 100_000, drawn: 150_000, repaid: 0 });
    expect(p.cash).toBe(0);
    expect(p.deposit).toBe(0);
    expect(p.debts.map((d) => d.principal)).toEqual([150_000]);
  });

  it('leaves the card alone when the deposit covers the whole shortfall', () => {
    const { p } = setup();
    p.cash = -50_000;
    p.deposit = 80_000;
    expect(settleCash(p)).toEqual({ fromDeposit: 50_000, drawn: 0, repaid: 0 });
    expect(p.deposit).toBe(30_000);
    expect(p.debts).toEqual([]);
  });

  it('pays the card down from spare cash, never from the deposit', () => {
    const { p } = setup();
    p.debts.push(card(300_000));
    p.cash = 100_000;
    p.deposit = 900_000;
    expect(settleCash(p)).toEqual({ fromDeposit: 0, drawn: 0, repaid: 100_000 });
    expect(p.cash).toBe(0);
    expect(p.deposit).toBe(900_000);
    expect(p.debts[0].principal).toBe(200_000);
    p.cash = 500_000;
    expect(settleCash(p)).toEqual({ fromDeposit: 0, drawn: 0, repaid: 200_000 });
    expect(p.debts).toEqual([]);
    expect(p.cash).toBe(300_000);
  });

  it('does nothing when cash is zero or positive and there is no card', () => {
    const { p } = setup(700);
    expect(settleCash(p)).toEqual({ fromDeposit: 0, drawn: 0, repaid: 0 });
    expect(p.cash).toBe(700);
  });
});

describe('bankruptcy', () => {
  it('needs card debt over three times annual income', () => {
    const { content, world, p } = setup();
    p.debts.push(card(9_000_000));
    expect(checkBankruptcy(p, content, world, 3_000_000, 5)).toBeNull();
    expect(p.debts).toHaveLength(1);
  });

  it('wipes an insolvent player: sells at a discount, clears every debt, locks credit, keeps the pension', () => {
    const { content, world, p } = setup();
    p.debts.push(card(9_000_001));
    p.debts.push(debt({ id: 'loan', principal: 400_000 }));
    p.positions.gold = { value: 1_000_000, basis: 1_000_000 };
    p.deposit = 200_000;
    p.pension = 777;
    expect(checkBankruptcy(p, content, world, 3_000_000, 5)).toEqual({ proceeds: 900_000, debtsCleared: 9_400_001 });
    expect(p.debts).toEqual([]);
    expect(p.positions).toEqual({});
    expect(p.properties).toEqual([]);
    expect(p.deposit).toBe(0);
    expect(p.cash).toBe(0);
    expect(p.pension).toBe(777);
    expect(p.bankruptUntilRound).toBe(8);
  });

  it('never liquidates a player who owns more than they owe', () => {
    const { content, world, p } = setup();
    p.debts.push(card(9_000_001));
    p.positions.fund_world = { value: 9_000_001, basis: 1 };
    expect(checkBankruptcy(p, content, world, 3_000_000, 5)).toBeNull();
    expect(p.positions.fund_world.value).toBe(9_000_001);
    p.positions.fund_world.value = 9_000_000;
    expect(checkBankruptcy(p, content, world, 3_000_000, 5)).not.toBeNull();
  });

  it('counts property and deposit as assets, and the mortgage as debt', () => {
    const { content, world, p } = setup();
    p.debts.push(card(9_000_001));
    p.debts.push(debt({ id: 'debt-7', kind: 'mortgageFixed', principal: 5_000_000, fixedRateBp: 400, roundsLeft: 10 }));
    p.properties.push({ id: 'property-8', cityId: 'home', typeId: 'studio', value: 14_000_000, basis: 15_000_000, rented: true, mortgageId: 'debt-7' });
    expect(checkBankruptcy(p, content, world, 3_000_000, 5)).not.toBeNull();
    p.debts = [card(9_000_001), debt({ id: 'debt-7', kind: 'mortgageFixed', principal: 5_000_000, fixedRateBp: 400, roundsLeft: 10 })];
    p.properties = [{ id: 'property-8', cityId: 'home', typeId: 'studio', value: 14_000_000, basis: 15_000_000, rented: true, mortgageId: 'debt-7' }];
    p.deposit = 1;
    expect(checkBankruptcy(p, content, world, 3_000_000, 5)).toBeNull();
  });

  it('counts the forced sale of property in the proceeds', () => {
    const { content, world, p } = setup();
    p.debts.push(card(30_000_000));
    p.properties.push({ id: 'property-8', cityId: 'home', typeId: 'studio', value: 10_000_000, basis: 15_000_000, rented: true, mortgageId: null });
    expect(checkBankruptcy(p, content, world, 3_000_000, 5)).toEqual({ proceeds: 7_000_000, debtsCleared: 30_000_000 });
    expect(p.properties).toEqual([]);
  });

  it('does not count the pension as an asset', () => {
    const { content, world, p } = setup();
    p.debts.push(card(9_000_001));
    p.pension = 50_000_000;
    expect(checkBankruptcy(p, content, world, 3_000_000, 5)).toEqual({ proceeds: 0, debtsCleared: 9_000_001 });
    expect(p.pension).toBe(50_000_000);
  });

  it('uses living cost as the income floor, at the current price level', () => {
    const { content, world, p } = setup();
    p.debts.push(card(5_400_000));
    expect(checkBankruptcy(p, content, world, 0, 1)).toBeNull();
    p.debts[0].principal = 5_400_001;
    expect(checkBankruptcy(p, content, world, 0, 1)).not.toBeNull();

    const dearer = { ...world, priceLevel: 2_000_000 };
    p.debts = [card(10_800_000)];
    expect(checkBankruptcy(p, content, dearer, 0, 1)).toBeNull();
    p.debts[0].principal = 10_800_001;
    expect(checkBankruptcy(p, content, dearer, 0, 1)).not.toBeNull();
  });
});
