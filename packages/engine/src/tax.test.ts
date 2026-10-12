import { describe, expect, it } from 'vitest';
import { cityOf } from './lookup';
import { computeTax, incomeTaxAnnual } from './tax';
import type { TaxInput } from './tax';
import { fixtureContent } from './testing/fixture';

const content = fixtureContent();
const home = cityOf(content, 'home');
const haven = cityOf(content, 'haven');

const none: TaxInput = {
  salary: 0,
  pensionContribution: 0,
  realisedGains: 0,
  dividends: 0,
  rent: 0,
  propertyValueOwned: 0,
  propertyPurchases: 0,
};

describe('income tax', () => {
  it('charges nothing below half the median salary', () => {
    expect(incomeTaxAnnual(1_400_000, home)).toBe(0);
    expect(incomeTaxAnnual(1_500_000, home)).toBe(0);
  });

  it('charges each bracket at its own rate', () => {
    expect(incomeTaxAnnual(6_000_000, home)).toBe(570_000 + 450_000);
    expect(incomeTaxAnnual(20_000_000, home)).toBe(570_000 + 2_250_000 + 3_600_000);
  });

  it('bills a whole round as years times the annual tax', () => {
    expect(computeTax(home, 2, { ...none, salary: 12_000_000 }).income).toBe(2_040_000);
  });

  it('deducts pension contributions up to the cap', () => {
    expect(computeTax(home, 2, { ...none, salary: 12_000_000, pensionContribution: 600_000 }).income).toBe(1_860_000);
    const capped = computeTax(home, 2, { ...none, salary: 12_000_000, pensionContribution: 9_000_000 });
    expect(capped.income).toBe(2 * incomeTaxAnnual(6_000_000 - 600_000, home));
  });

  it('charges nothing in a zero-tax city', () => {
    const bill = computeTax(haven, 2, { ...none, salary: 40_000_000, realisedGains: 5_000_000, dividends: 1_000_000, rent: 2_000_000 });
    expect(bill.income).toBe(0);
    expect(bill.investment).toBe(0);
  });
});

describe('investment tax', () => {
  it('taxes gains, dividends and rent', () => {
    const bill = computeTax(home, 2, { ...none, realisedGains: 1_000_000, dividends: 200_000, rent: 300_000 });
    expect(bill.investment).toBe(210_000 + 42_000 + 63_000);
  });

  it('does not tax a net loss', () => {
    const bill = computeTax(home, 2, { ...none, realisedGains: -500_000, dividends: 200_000 });
    expect(bill.investment).toBe(42_000);
  });

  it('applies the allowance to gains first, then dividends', () => {
    const city = { ...home, tax: { ...home.tax, investmentAllowance: 600_000 } };
    const bill = computeTax(city, 2, { ...none, realisedGains: 400_000, dividends: 500_000 });
    expect(bill.investment).toBe(63_000);
  });

  it('taxes rent through the brackets when the city says so', () => {
    const city = { ...home, tax: { ...home.tax, rentAsIncome: true } };
    const bill = computeTax(city, 2, { ...none, salary: 6_000_000, rent: 6_000_000 });
    expect(bill.investment).toBe(0);
    expect(bill.income).toBe(2 * incomeTaxAnnual(6_000_000, home));
  });
});

describe('property tax', () => {
  it('charges the annual rate on value owned and the purchase rate on purchases', () => {
    const bill = computeTax(home, 2, { ...none, propertyValueOwned: 25_000_000, propertyPurchases: 25_000_000 });
    expect(bill.property).toBe(150_000 + 2_000_000);
  });

  it('totals the three parts', () => {
    const bill = computeTax(home, 2, { ...none, salary: 12_000_000, dividends: 200_000, propertyValueOwned: 25_000_000 });
    expect(bill.total).toBe(bill.income + bill.investment + bill.property);
  });
});
