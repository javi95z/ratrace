import { debtServiceForRound } from './debt';
import type { DebtService } from './debt';
import { cityOf } from './lookup';
import { applyBp, mulDiv } from './money';
import type { Cents } from './money';
import { ownsHome } from './property';
import type { Content, PlayerState, WorldState } from './types';

/** Amounts for one whole round. */
export interface RoundIncome {
  salary: Cents;
  dividends: Cents;
  interest: Cents;
  rent: Cents;
  otherPassive: Cents;
}

export interface RoundExpenses {
  living: Cents;
  other: Cents;
  debtInterest: Cents;
  debtPrincipal: Cents;
  service: DebtService;
}

export function livingCostAnnual(p: PlayerState, content: Content): Cents {
  const city = cityOf(content, p.cityId);
  const base = mulDiv(city.livingCostAnnual, content.lifestyleMultiplierPct[p.lifestyleTier], 100);
  return ownsHome(p) ? base - mulDiv(base, content.housingSharePct, 100) : base;
}

/** Income earned on what the player holds, at the rates of the given world. */
export function incomeForRound(p: PlayerState, content: Content, world: WorldState): RoundIncome {
  const years = content.yearsPerRound;

  let dividends = 0;
  for (const asset of content.assets) {
    if (!Object.hasOwn(p.positions, asset.id)) continue;
    const yieldBp =
      asset.class === 'bond' ? Math.max(0, world.policyRateBp + (asset.yieldSpreadBp ?? 0)) : asset.yieldBp;
    dividends += applyBp(p.positions[asset.id].value, yieldBp * years);
  }

  const depositRateBp = Math.max(0, world.policyRateBp - content.market.depositSpreadBp);
  const interest = applyBp(p.deposit, depositRateBp * years);

  let rent = 0;
  for (const property of p.properties) {
    if (property.rented) rent += applyBp(property.value, cityOf(content, property.cityId).rentYieldBp * years);
  }

  return {
    salary: p.salaryAnnual * years,
    dividends,
    interest,
    rent,
    otherPassive: p.extraPassiveAnnual * years,
  };
}

export function expensesForRound(p: PlayerState, content: Content, world: WorldState): RoundExpenses {
  const years = content.yearsPerRound;
  const service = debtServiceForRound(p, content, world);
  return {
    living: livingCostAnnual(p, content) * years,
    other: p.extraExpensesAnnual * years,
    debtInterest: service.interest,
    debtPrincipal: service.principal,
    service,
  };
}

export function passiveOf(income: RoundIncome): Cents {
  return income.dividends + income.interest + income.rent + income.otherPassive;
}

export function outgoingsOf(expenses: RoundExpenses): Cents {
  return expenses.living + expenses.other + expenses.debtInterest + expenses.debtPrincipal;
}
