import { expensesForRound, incomeForRound, outgoingsOf, passiveOf } from './economy';
import type { RoundExpenses, RoundIncome } from './economy';
import { cityOf } from './lookup';
import type { Cents } from './money';
import { indexed } from './rates';
import { computeTax, effectiveTax } from './tax';
import type { TaxBill } from './tax';
import type { Content, PlayerState, RoundTally, WorldState } from './types';

export interface Flows {
  income: RoundIncome;
  expenses: RoundExpenses;
  passive: Cents;
  /** Passive income less the tax it would bear if the player had no salary: what they could live on without working. */
  passiveAfterTax: Cents;
  outgoings: Cents;
  bill: TaxBill;
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
    otherIncome: income.otherPassive,
    dividends: income.dividends + income.interest,
    rent: income.rent,
    propertyValueOwned,
  };
  const bill = computeTax(tax, median, content.yearsPerRound, {
    ...earned,
    salary: income.salary,
    pensionContribution: tally.pensionContribution,
    realisedGains: tally.realisedGains,
  });
  // The same income with no salary and nothing sold: the tax a life of leisure would pay.
  const idle = computeTax(tax, median, content.yearsPerRound, { ...earned, salary: 0, pensionContribution: 0, realisedGains: 0 });
  const passive = passiveOf(income);
  return { income, expenses, passive, passiveAfterTax: passive - idle.total, outgoings: outgoingsOf(expenses), bill };
}
