import { residencyOf } from './life/derive';
import { expensesForRound, incomeForRound, outgoingsOf, passiveOf } from './economy';
import type { RoundExpenses, RoundIncome } from './economy';
import { cityOf } from './lookup';
import { applyBp, mulDiv } from './money';
import type { Cents } from './money';
import { depositRateBp, indexed } from './rates';
import { computeTax, effectiveTax } from './tax';
import type { TaxBill } from './tax';
import { declaredTax } from './evasion';
import type { Content, Evaded, PlayerState, RoundTally, WorldState } from './types';

/**
 * The two sides of the escape test. On one side, passive income less the tax it would bear if the
 * player had no salary: what they could live on without working. On the other, everything the
 * round costs them, with the property tax on what they own counted as a cost of living.
 */
export interface EscapeMeasure {
  passiveAfterTax: Cents;
  outgoings: Cents;
  /**
   * What the passive side leaves out of the deposit's interest, after its tax: the deposit counts
   * only in part (`market.depositEscapePct`), so savings alone are not a way out.
   */
  savingsUncounted: Cents;
}

export interface Flows {
  income: RoundIncome;
  expenses: RoundExpenses;
  passive: Cents;
  outgoings: Cents;
  escape: EscapeMeasure;
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
  // A residency taxes what is earned abroad at its own rate, while it stays abroad.
  const residency = residencyOf(p, content);
  const tax = residency ? { ...effectiveTax(city, now), dividendBp: residency.dividendBp } : effectiveTax(city, now);
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
    {
      ...earned,
      salary: income.salary,
      // What was taken out of the pension early is taxed as income, in the round it came out.
      otherIncome: earned.otherIncome + tally.pensionWithdrawn,
      pensionContribution: tally.pensionContribution,
      realisedGains: tally.realisedGains,
    },
    tally.realisedCryptoGains,
  );
  // The same income with no salary and nothing sold: the tax a life of leisure would pay.
  const idle = computeTax(tax, median, content.yearsPerRound, { ...earned, salary: 0, pensionContribution: 0, realisedGains: 0 });
  const passive = passiveOf(income);
  const outgoings = outgoingsOf(expenses);
  // The deposit's own interest, after the tax it adds, counts only in part towards the escape.
  // Interest on loans to other players, coupons and dividends count in full.
  const depositInterest = applyBp(p.deposit, depositRateBp(content, now) * content.yearsPerRound);
  const withoutDeposit = computeTax(tax, median, content.yearsPerRound, {
    ...earned,
    dividends: earned.dividends - depositInterest,
    salary: 0,
    pensionContribution: 0,
    realisedGains: 0,
  });
  const depositAfterTax = depositInterest - (idle.investment - withoutDeposit.investment);
  const uncounted = depositAfterTax - mulDiv(depositAfterTax, content.market.depositEscapePct, 100);
  const escape = {
    passiveAfterTax: passive - idle.income - idle.investment - uncounted,
    outgoings: outgoings + idle.property,
    savingsUncounted: uncounted,
  };
  return { income, expenses, passive, outgoings, escape, bill, evaded };
}
