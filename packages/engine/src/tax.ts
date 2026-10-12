import { applyBp, clamp } from './money';
import type { Bp, Cents } from './money';
import { indexed } from './rates';
import type { CityDef, TaxProfile, WorldState } from './types';

/**
 * The tax profile a city applies in the given world: its own rates, moved by any reform so far,
 * with the tax-free allowance following the price level. A rate of zero is never moved.
 */
export function effectiveTax(city: CityDef, world: WorldState): TaxProfile {
  const shift = world.taxShiftBp[city.id] ?? 0;
  const moved = (rate: Bp): Bp => (rate === 0 ? 0 : clamp(rate + shift, 0, 10_000));
  const tax = city.tax;
  return {
    ...tax,
    incomeRatesBp: [moved(tax.incomeRatesBp[0]), moved(tax.incomeRatesBp[1]), moved(tax.incomeRatesBp[2])],
    capitalGainsBp: moved(tax.capitalGainsBp),
    dividendBp: moved(tax.dividendBp),
    rentBp: moved(tax.rentBp),
    investmentAllowance: indexed(tax.investmentAllowance, world),
  };
}

/** Amounts for one whole round. */
export interface TaxInput {
  salary: Cents;
  /** Business profit and similar. Taxed through the brackets, like salary. */
  otherIncome: Cents;
  pensionContribution: Cents;
  /** Net realised gain. Negative for a net loss. */
  realisedGains: Cents;
  /** Dividends, bond coupons and deposit interest. */
  dividends: Cents;
  rent: Cents;
  propertyValueOwned: Cents;
}

export interface TaxBill {
  income: Cents;
  investment: Cents;
  property: Cents;
  total: Cents;
}

/**
 * Tax on one year's income. The brackets start at 0.5, 1.5 and 4 times the median salary,
 * so they move with the price level when the caller passes an indexed median.
 */
export function incomeTaxAnnual(annual: Cents, medianSalaryAnnual: Cents, ratesBp: readonly [Bp, Bp, Bp]): Cents {
  const first = Math.floor(medianSalaryAnnual / 2);
  const second = Math.floor((medianSalaryAnnual * 3) / 2);
  const third = medianSalaryAnnual * 4;
  const [low, mid, high] = ratesBp;

  let tax = 0;
  if (annual > first) tax += applyBp(Math.min(annual, second) - first, low);
  if (annual > second) tax += applyBp(Math.min(annual, third) - second, mid);
  if (annual > third) tax += applyBp(annual - third, high);
  return tax;
}

/** The tax bill for one round, excluding the purchase tax, which is paid when a property is bought. */
export function computeTax(tax: TaxProfile, medianSalaryAnnual: Cents, years: number, input: TaxInput): TaxBill {
  const salaryAnnual = Math.floor(input.salary / years);
  const otherAnnual = Math.floor(input.otherIncome / years);
  const rentAnnual = tax.rentAsIncome ? Math.floor(input.rent / years) : 0;
  const deduction = Math.min(
    Math.floor(input.pensionContribution / years),
    applyBp(salaryAnnual, tax.pensionDeductionCapBp),
  );
  const taxableAnnual = Math.max(0, salaryAnnual + otherAnnual + rentAnnual - deduction);
  const income = incomeTaxAnnual(taxableAnnual, medianSalaryAnnual, tax.incomeRatesBp) * years;

  const gains = Math.max(0, input.realisedGains);
  const gainsTaxable = Math.max(0, gains - tax.investmentAllowance);
  const allowanceLeft = Math.max(0, tax.investmentAllowance - gains);
  const dividendsTaxable = Math.max(0, input.dividends - allowanceLeft);
  const rentTax = tax.rentAsIncome ? 0 : applyBp(input.rent, tax.rentBp);
  const investment = applyBp(gainsTaxable, tax.capitalGainsBp) + applyBp(dividendsTaxable, tax.dividendBp) + rentTax;

  const property = applyBp(input.propertyValueOwned, tax.propertyAnnualBp) * years;

  return { income, investment, property, total: income + investment + property };
}

/** One-off tax on buying a property. */
export function purchaseTax(tax: TaxProfile, price: Cents): Cents {
  return applyBp(price, tax.propertyPurchaseBp);
}
