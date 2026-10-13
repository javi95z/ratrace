import { describe, expect, it } from 'vitest';
import { expensesForRound, incomeForRound, livingCostAnnual, outgoingsOf, passiveOf } from './economy';
import { fixtureContent, fixturePlayer } from './testing/fixture';
import type { Property } from './types';
import { generateTimeline } from './world';

const content = fixtureContent();
const world = generateTimeline('economy', content)[0];
const dearer = { ...world, priceLevel: 1_500_000 };

const flat = (over: Partial<Property>): Property => ({
  id: 'property-1', cityId: 'home', typeId: 'flat', value: 25_000_000, basis: 25_000_000, rented: false, mortgageId: null, ...over,
});

describe('living cost', () => {
  it('scales with the lifestyle tier', () => {
    expect(livingCostAnnual(fixturePlayer({ lifestyleTier: 0 }), content, world)).toBe(1_260_000);
    expect(livingCostAnnual(fixturePlayer({ lifestyleTier: 1 }), content, world)).toBe(1_800_000);
    expect(livingCostAnnual(fixturePlayer({ lifestyleTier: 3 }), content, world)).toBe(3_600_000);
  });

  it('rises with the price level', () => {
    expect(livingCostAnnual(fixturePlayer(), content, dearer)).toBe(2_700_000);
  });

  it('drops the housing share for an owner-occupier only', () => {
    const p = fixturePlayer();
    p.properties.push(flat({}));
    expect(livingCostAnnual(p, content, world)).toBe(1_170_000);
    p.properties[0].rented = true;
    expect(livingCostAnnual(p, content, world)).toBe(1_800_000);
    p.properties[0] = flat({ cityId: 'haven' });
    expect(livingCostAnnual(p, content, world)).toBe(1_800_000);
  });
});

describe('income for a round', () => {
  it('pays salary, dividends, coupons, deposit interest, rent and other passive income', () => {
    const p = fixturePlayer();
    p.positions.fund_world = { value: 1_000_000, basis: 1_000_000 };
    p.positions.bond_long = { value: 1_000_000, basis: 1_000_000 };
    p.deposit = 1_000_000;
    p.properties.push(flat({ rented: true }));
    p.extraPassiveAnnual = 100_000;
    const income = incomeForRound(p, content, world);
    expect(income).toEqual({ salary: 6_000_000, dividends: 36_000 + 60_000, interest: 30_000, rent: 2_250_000, business: 0, otherPassive: 200_000 });
    expect(passiveOf(income)).toBe(96_000 + 30_000 + 2_250_000 + 200_000);
  });

  it('raises wages and other passive income with the price level, but not investment income', () => {
    const p = fixturePlayer();
    p.positions.fund_world = { value: 1_000_000, basis: 1_000_000 };
    p.deposit = 1_000_000;
    p.extraPassiveAnnual = 100_000;
    const income = incomeForRound(p, content, dearer);
    expect(income.salary).toBe(9_000_000);
    expect(income.otherPassive).toBe(300_000);
    expect(income.dividends).toBe(36_000);
    expect(income.interest).toBe(30_000);
  });

  it('pays no rent on a home and no interest when the policy rate is under the spread', () => {
    const p = fixturePlayer();
    p.deposit = 1_000_000;
    p.properties.push(flat({ rented: false }));
    const income = incomeForRound(p, content, { ...world, policyRateBp: 50 });
    expect(income.rent).toBe(0);
    expect(income.interest).toBe(0);
  });
});

describe('expenses for a round', () => {
  it('adds living cost, other expenses and debt service', () => {
    const p = fixturePlayer();
    p.extraExpensesAnnual = 250_000;
    p.debts.push({ id: 'debt-1', kind: 'personalLoan', principal: 900_000, fixedRateBp: 750, roundsLeft: 3 });
    const expenses = expensesForRound(p, content, world);
    expect(expenses.living).toBe(3_600_000);
    expect(expenses.other).toBe(500_000);
    expect(expenses.debtInterest).toBe(135_000);
    expect(expenses.debtPrincipal).toBe(300_000);
    expect(outgoingsOf(expenses)).toBe(4_535_000);
  });

  it('raises living cost and other expenses with the price level, but not debt service', () => {
    const p = fixturePlayer();
    p.extraExpensesAnnual = 250_000;
    p.debts.push({ id: 'debt-1', kind: 'personalLoan', principal: 900_000, fixedRateBp: 750, roundsLeft: 3 });
    const expenses = expensesForRound(p, content, dearer);
    expect(expenses.living).toBe(5_400_000);
    expect(expenses.other).toBe(750_000);
    expect(expenses.debtInterest).toBe(135_000);
    expect(expenses.debtPrincipal).toBe(300_000);
  });
});
