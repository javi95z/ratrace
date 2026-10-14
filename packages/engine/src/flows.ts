import { expensesForRound, incomeForRound, outgoingsOf, passiveOf } from './economy';
import type { RoundExpenses, RoundIncome } from './economy';
import { cityOf } from './lookup';
import type { Cents } from './money';
import { indexed } from './rates';
import { computeTax, effectiveTax } from './tax';
import type { TaxBill } from './tax';
import { declaredTax } from './evasion';
import type { Content, Evaded, PlayerState, RoundTally, WorldState } from './types';

export interface Flows {
  income: RoundIncome;
  expenses: RoundExpenses;
  passive: Cents;
  outgoings: Cents;
  /**
   * The two sides of the escape test. On one side, passive income less the tax it would bear if the
   * player had no salary: what they could live on without working. On the other, everything the
   * round costs them, with the property tax on what they own counted as a cost of living.
   */
  escape: { passiveAfterTax: Cents; outgoings: Cents };
  bill: TaxBill;
  /** What the bill leaves out that the honest one would have had, by way of leaving it out. */
  evaded: Evaded;
}

/**
 * Income, expenses and tax for the round, from what the player holds after their orders.
 * Everything is valued at `now`, before prices move, so the player is never charged
 * on the basis of something they could not see when they decided.
 */
export function flowsOf(content: Content, p: PlayerState, now: WorldState, tally: RoundTally): Flows {
  const income = incomeForRound(p, content, now);
  const expenses = expensesForRound(p, content, now);
  let propertyValueOwned = 0;
  for (const property of p.properties) propertyValueOwned += property.value;
  const city = cityOf(content, p.cityId);
  const tax = effectiveTax(city, now);
  const median = indexed(city.medianSalaryAnnual, now);
  const earned = {
    // What a business pays its owner is income like a salary, and taxed as one.
    otherIncome: income.otherPassive + income.business,
    dividends: income.dividends + income.interest,
    rent: income.rent,
    propertyValueOwned,
  };
  // The tax as declared: what is hidden from the office is left out of it.
  const { bill, evaded } = declaredTax(
    content,
    p,
    tax,
    median,
    { ...earned, salary: income.salary, pensionContribution: tally.pensionContribution, realisedGains: tally.realisedGains },
    tally.realisedCryptoGains,
  );
  // The same income with no salary and nothing sold: the tax a life of leisure would pay.
  const idle = computeTax(tax, median, content.yearsPerRound, { ...earned, salary: 0, pensionContribution: 0, realisedGains: 0 });
  const passive = passiveOf(income);
  const outgoings = outgoingsOf(expenses);
  const escape = { passiveAfterTax: passive - idle.income - idle.investment, outgoings: outgoings + idle.property };
  return { income, expenses, passive, outgoings, escape, bill, evaded };
}
