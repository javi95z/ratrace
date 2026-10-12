import { describe, expect, it } from 'vitest';
import { cityOf } from './lookup';
import { computeTax, incomeTaxAnnual, purchaseTax } from './tax';
import type { TaxInput } from './tax';
import { fixtureContent } from './testing/fixture';
import type { TaxProfile } from './types';

const content = fixtureContent();
const home = cityOf(content, 'home');
const haven = cityOf(content, 'haven');
const MEDIAN = home.medianSalaryAnnual;
const rates = home.tax.incomeRatesBp;

const none: TaxInput = {
  salary: 0,
  otherIncome: 0,
  pensionContribution: 0,
  realisedGains: 0,
  dividends: 0,
  rent: 0,
  propertyValueOwned: 0,
};

const bill = (input: Partial<TaxInput>, tax: TaxProfile = home.tax, median = MEDIAN) =>
  computeTax(tax, median, 2, { ...none, ...input });

describe('income tax', () => {
  it('charges nothing below half the median salary', () => {
    expect(incomeTaxAnnual(1_400_000, MEDIAN, rates)).toBe(0);
    expect(incomeTaxAnnual(1_500_000, MEDIAN, rates)).toBe(0);
  });

  it('charges each bracket at its own rate', () => {
    expect(incomeTaxAnnual(6_000_000, MEDIAN, rates)).toBe(570_000 + 450_000);
    expect(incomeTaxAnnual(20_000_000, MEDIAN, rates)).toBe(570_000 + 2_250_000 + 3_600_000);
  });

  it('moves the brackets with the median salary', () => {
    expect(incomeTaxAnnual(12_000_000, MEDIAN * 2, rates)).toBe(2 * incomeTaxAnnual(6_000_000, MEDIAN, rates));
    expect(bill({ salary: 24_000_000 }, home.tax, MEDIAN * 2).income).toBe(2 * bill({ salary: 12_000_000 }).income);
  });

  it('bills a whole round as years times the annual tax', () => {
    expect(bill({ salary: 12_000_000 }).income).toBe(2_040_000);
  });

  it('taxes other income through the brackets together with salary', () => {
    expect(bill({ salary: 6_000_000, otherIncome: 6_000_000 }).income).toBe(2_040_000);
    expect(bill({ otherIncome: 12_000_000 }).income).toBe(2_040_000);
  });

  it('deducts pension contributions up to the cap', () => {
    expect(bill({ salary: 12_000_000, pensionContribution: 600_000 }).income).toBe(1_860_000);
    expect(bill({ salary: 12_000_000, pensionContribution: 9_000_000 }).income).toBe(
      2 * incomeTaxAnnual(6_000_000 - 600_000, MEDIAN, rates),
    );
  });

  it('bases the pension cap on salary alone', () => {
    const capped = bill({ salary: 6_000_000, otherIncome: 6_000_000, pensionContribution: 9_000_000 });
    expect(capped.income).toBe(2 * incomeTaxAnnual(6_000_000 - 300_000, MEDIAN, rates));
  });

  it('charges nothing in a zero-tax city', () => {
    const result = bill(
      { salary: 40_000_000, otherIncome: 4_000_000, realisedGains: 5_000_000, dividends: 1_000_000, rent: 2_000_000 },
      haven.tax,
      haven.medianSalaryAnnual,
    );
    expect(result.income).toBe(0);
    expect(result.investment).toBe(0);
  });
});

describe('investment tax', () => {
  it('taxes gains, dividends and rent', () => {
    expect(bill({ realisedGains: 1_000_000, dividends: 200_000, rent: 300_000 }).investment).toBe(210_000 + 42_000 + 63_000);
  });

  it('does not tax a net loss', () => {
    expect(bill({ realisedGains: -500_000, dividends: 200_000 }).investment).toBe(42_000);
  });

  it('applies the allowance to gains first, then dividends', () => {
    const tax = { ...home.tax, investmentAllowance: 600_000 };
    expect(bill({ realisedGains: 400_000, dividends: 500_000 }, tax).investment).toBe(63_000);
  });

  it('taxes rent through the brackets when the city says so', () => {
    const result = bill({ salary: 6_000_000, rent: 6_000_000 }, { ...home.tax, rentAsIncome: true });
    expect(result.investment).toBe(0);
    expect(result.income).toBe(2_040_000);
  });
});

describe('property tax', () => {
  it('charges the annual rate on value owned for each year of the round', () => {
    expect(bill({ propertyValueOwned: 25_000_000 }).property).toBe(150_000);
  });

  it('charges the purchase rate once, at purchase', () => {
    expect(purchaseTax(home.tax, 25_000_000)).toBe(2_000_000);
    expect(purchaseTax(haven.tax, 40_000_000)).toBe(1_600_000);
  });

  it('totals the three parts', () => {
    const result = bill({ salary: 12_000_000, dividends: 200_000, propertyValueOwned: 25_000_000 });
    expect(result.total).toBe(result.income + result.investment + result.property);
    expect(result.total).toBe(2_040_000 + 42_000 + 150_000);
  });
});
