import { debtServiceForRound } from './debt';
import type { DebtService } from './debt';
import { cityOf } from './lookup';
import { applyBp, mulDiv } from './money';
import type { Cents } from './money';
import { ownsHome } from './property';
import { assetYieldBp, depositRateBp, indexed } from './rates';
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

/** One year of living cost at the given world's prices. An owner-occupier does not pay the housing share. */
export function livingCostAnnual(p: PlayerState, content: Content, world: WorldState): Cents {
  const city = cityOf(content, p.cityId);
  const atTier = mulDiv(city.livingCostAnnual, content.lifestyleMultiplierPct[p.lifestyleTier], 100);
  const base = indexed(atTier, world);
  return ownsHome(p) ? base - mulDiv(base, content.housingSharePct, 100) : base;
}

/**
 * Income earned on what the player holds, at the rates and prices of the given world.
 * Wages and other passive income follow the price level; investment income does not.
 */
export function incomeForRound(p: PlayerState, content: Content, world: WorldState): RoundIncome {
  const years = content.yearsPerRound;

  let dividends = 0;
  for (const asset of content.assets) {
    if (!Object.hasOwn(p.positions, asset.id)) continue;
    dividends += applyBp(p.positions[asset.id].value, assetYieldBp(asset, world) * years);
  }

  const interest = applyBp(p.deposit, depositRateBp(content, world) * years);

  let rent = 0;
  for (const property of p.properties) {
    if (property.rented) rent += applyBp(property.value, cityOf(content, property.cityId).rentYieldBp * years);
  }

  return {
    salary: indexed(p.salaryAnnual, world) * years,
    dividends,
    interest,
    rent,
    otherPassive: indexed(p.extraPassiveAnnual, world) * years,
  };
}

/** Living cost and other expenses follow the price level; debt service is nominal. */
export function expensesForRound(p: PlayerState, content: Content, world: WorldState): RoundExpenses {
  const years = content.yearsPerRound;
  const service = debtServiceForRound(p, content, world);
  return {
    living: livingCostAnnual(p, content, world) * years,
    other: indexed(p.extraExpensesAnnual, world) * years,
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
