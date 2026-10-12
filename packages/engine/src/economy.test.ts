import { describe, expect, it } from 'vitest';
import { expensesForRound, incomeForRound, livingCostAnnual, outgoingsOf, passiveOf } from './economy';
import { newPlayer } from './player';
import { fixtureContent, fixtureStart } from './testing/fixture';
import type { Property } from './types';
import { generateTimeline } from './world';

const content = fixtureContent();
const world = generateTimeline('economy', content)[0];

const flat = (over: Partial<Property>): Property => ({
  id: 'property-1', cityId: 'home', typeId: 'flat', value: 25_000_000, basis: 25_000_000, rented: false, mortgageId: null, ...over,
});

describe('living cost', () => {
  it('scales with the lifestyle tier', () => {
    expect(livingCostAnnual(newPlayer({ ...fixtureStart(), lifestyleTier: 0 }), content)).toBe(1_260_000);
    expect(livingCostAnnual(newPlayer({ ...fixtureStart(), lifestyleTier: 1 }), content)).toBe(1_800_000);
    expect(livingCostAnnual(newPlayer({ ...fixtureStart(), lifestyleTier: 3 }), content)).toBe(3_600_000);
  });

  it('drops the housing share for an owner-occupier only', () => {
    const p = newPlayer(fixtureStart());
    p.properties.push(flat({}));
    expect(livingCostAnnual(p, content)).toBe(1_170_000);
    p.properties[0].rented = true;
    expect(livingCostAnnual(p, content)).toBe(1_800_000);
    p.properties[0] = flat({ cityId: 'haven' });
    expect(livingCostAnnual(p, content)).toBe(1_800_000);
  });
});

describe('income for a round', () => {
  it('pays salary, dividends, coupons, deposit interest, rent and other passive income', () => {
    const p = newPlayer(fixtureStart());
    p.positions.fund_world = { value: 1_000_000, basis: 1_000_000 };
    p.positions.bond_long = { value: 1_000_000, basis: 1_000_000 };
    p.deposit = 1_000_000;
    p.properties.push(flat({ rented: true }));
    p.extraPassiveAnnual = 100_000;
    const income = incomeForRound(p, content, world);
    expect(income).toEqual({ salary: 6_000_000, dividends: 36_000 + 60_000, interest: 30_000, rent: 2_250_000, otherPassive: 200_000 });
    expect(passiveOf(income)).toBe(96_000 + 30_000 + 2_250_000 + 200_000);
  });

  it('pays no rent on a home and no interest when the policy rate is under the spread', () => {
    const p = newPlayer(fixtureStart());
    p.deposit = 1_000_000;
    p.properties.push(flat({ rented: false }));
    const income = incomeForRound(p, content, { ...world, policyRateBp: 50 });
    expect(income.rent).toBe(0);
    expect(income.interest).toBe(0);
  });
});

describe('expenses for a round', () => {
  it('adds living cost, other expenses and debt service', () => {
    const p = newPlayer(fixtureStart());
    p.extraExpensesAnnual = 250_000;
    p.debts.push({ id: 'debt-1', kind: 'personalLoan', principal: 900_000, fixedRateBp: 750, roundsLeft: 3 });
    const expenses = expensesForRound(p, content, world);
    expect(expenses.living).toBe(3_600_000);
    expect(expenses.other).toBe(500_000);
    expect(expenses.debtInterest).toBe(135_000);
    expect(expenses.debtPrincipal).toBe(300_000);
    expect(outgoingsOf(expenses)).toBe(4_535_000);
  });
});
