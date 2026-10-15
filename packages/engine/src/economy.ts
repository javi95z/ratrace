import { businessIncome } from './business';
import { debtServiceForRound } from './debt';
import type { DebtService } from './debt';
import { cityOf } from './lookup';
import { applyBp, mulDiv } from './money';
import type { Cents } from './money';
import { homeOf, lodgerOf } from './life/derive';
import { ownsHome, rentYieldBp } from './property';
import { assetYieldBp, depositRateBp, indexed } from './rates';
import type { Content, PlayerState, WorldState } from './types';

/** Amounts for one whole round. */
export interface RoundIncome {
  salary: Cents;
  dividends: Cents;
  interest: Cents;
  rent: Cents;
  /** What the player's businesses pay out. */
  business: Cents;
  otherPassive: Cents;
}

export interface RoundExpenses {
  living: Cents;
  other: Cents;
  debtInterest: Cents;
  debtPrincipal: Cents;
  service: DebtService;
}

/**
 * One year of living cost at the given world's prices.
 * An owner-occupier does not pay the housing share; a tenant pays the part of it their rent tier sets.
 */
export function livingCostAnnual(p: PlayerState, content: Content, world: WorldState): Cents {
  const city = cityOf(content, p.cityId);
  const atTier = mulDiv(city.livingCostAnnual, content.lifestyleMultiplierPct[p.lifestyleTier], 100);
  const base = indexed(atTier, world);
  const housing = mulDiv(base, content.housingSharePct, 100);
  if (ownsHome(p)) return base - housing;
  return base - housing + mulDiv(housing, content.life.rentTierHousingPct[p.life.rentTier], 100);
}

/** What each investment held pays in the round, at the rates of the given world. Nothing is listed for one that pays nothing. */
export function dividendsByAsset(p: PlayerState, content: Content, world: WorldState): Array<{ assetId: string; amount: Cents }> {
  const paid: Array<{ assetId: string; amount: Cents }> = [];
  for (const asset of content.assets) {
    if (!Object.hasOwn(p.positions, asset.id)) continue;
    const amount = applyBp(p.positions[asset.id].value, assetYieldBp(asset, world) * content.yearsPerRound);
    if (amount > 0) paid.push({ assetId: asset.id, amount });
  }
  return paid;
}

/**
 * Income earned on what the player holds, at the rates and prices of the given world.
 * Wages and other passive income follow the price level; investment income does not.
 */
export function incomeForRound(p: PlayerState, content: Content, world: WorldState): RoundIncome {
  const years = content.yearsPerRound;

  let dividends = 0;
  for (const paid of dividendsByAsset(p, content, world)) dividends += paid.amount;

  const interest = applyBp(p.deposit, depositRateBp(content, world) * years);

  let rent = 0;
  for (const property of p.properties) {
    if (property.rented) rent += applyBp(property.value, rentYieldBp(content, property.cityId, property.typeId) * years);
  }
  // A lodger pays for a room: a share of what the whole home would let for.
  const home = lodgerOf(p, content) ? homeOf(p, content) : null;
  if (home) rent += mulDiv(applyBp(home.value, rentYieldBp(content, home.cityId, home.typeId) * years), content.life.lodger.rentPct, 100);

  return {
    salary: indexed(p.salaryAnnual, world) * years,
    dividends,
    interest,
    rent,
    business: businessIncome(p, content, world),
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
  return income.dividends + income.interest + income.rent + income.business + income.otherPassive;
}

export function outgoingsOf(expenses: RoundExpenses): Cents {
  return expenses.living + expenses.other + expenses.debtInterest + expenses.debtPrincipal;
}
