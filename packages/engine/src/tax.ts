import { applyBp } from './money';
import type { Cents } from './money';
import type { CityDef } from './types';

/** Amounts for one whole round. */
export interface TaxInput {
  salary: Cents;
  pensionContribution: Cents;
  /** Net realised gain. Negative for a net loss. */
  realisedGains: Cents;
  /** Dividends, bond coupons and deposit interest. */
  dividends: Cents;
  rent: Cents;
  propertyValueOwned: Cents;
  propertyPurchases: Cents;
}

export interface TaxBill {
  income: Cents;
  investment: Cents;
  property: Cents;
  total: Cents;
}

export function incomeTaxAnnual(annual: Cents, city: CityDef): Cents {
  const median = city.medianSalaryAnnual;
  const first = Math.floor(median / 2);
  const second = Math.floor((median * 3) / 2);
  const third = median * 4;
  const [low, mid, high] = city.tax.incomeRatesBp;

  let tax = 0;
  if (annual > first) tax += applyBp(Math.min(annual, second) - first, low);
  if (annual > second) tax += applyBp(Math.min(annual, third) - second, mid);
  if (annual > third) tax += applyBp(annual - third, high);
  return tax;
}

export function computeTax(city: CityDef, years: number, input: TaxInput): TaxBill {
  const t = city.tax;

  const salaryAnnual = Math.floor(input.salary / years);
  const rentAnnual = t.rentAsIncome ? Math.floor(input.rent / years) : 0;
  const deduction = Math.min(
    Math.floor(input.pensionContribution / years),
    applyBp(salaryAnnual, t.pensionDeductionCapBp),
  );
  const taxableAnnual = Math.max(0, salaryAnnual + rentAnnual - deduction);
  const income = incomeTaxAnnual(taxableAnnual, city) * years;

  const gains = Math.max(0, input.realisedGains);
  const gainsTaxable = Math.max(0, gains - t.investmentAllowance);
  const allowanceLeft = Math.max(0, t.investmentAllowance - gains);
  const dividendsTaxable = Math.max(0, input.dividends - allowanceLeft);
  const rentTax = t.rentAsIncome ? 0 : applyBp(input.rent, t.rentBp);
  const investment = applyBp(gainsTaxable, t.capitalGainsBp) + applyBp(dividendsTaxable, t.dividendBp) + rentTax;

  const property =
    applyBp(input.propertyValueOwned, t.propertyAnnualBp) * years +
    applyBp(input.propertyPurchases, t.propertyPurchaseBp);

  return { income, investment, property, total: income + investment + property };
}
