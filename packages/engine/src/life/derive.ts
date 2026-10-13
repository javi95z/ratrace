import { cityOf, itemOf, levelOf, propertyTypeOf } from '../lookup';
import { applyBp, mulDiv } from '../money';
import type { Cents } from '../money';
import type { Content, InsuranceKind, PlayerState, Property } from '../types';

export const INSURANCE_KINDS: readonly InsuranceKind[] = ['health', 'home', 'life', 'liability'];

/** The home the player lives in: a property they own in their city and have not rented out. The grandest, if several. */
export function homeOf(p: PlayerState, content: Content): Property | null {
  let home: Property | null = null;
  let best = -1;
  for (const property of p.properties) {
    if (property.cityId !== p.cityId || property.rented) continue;
    const status = propertyTypeOf(content, property.typeId).status;
    if (status > best) {
      home = property;
      best = status;
    }
  }
  return home;
}

/** Yearly salary in start-of-game dollars: the player's own pay, plus their partner's. */
export function deriveSalary(p: PlayerState, content: Content): Cents {
  const life = p.life;
  const median = cityOf(content, p.cityId).medianSalaryAnnual;
  const base = life.career ? mulDiv(median, levelOf(content, life.career).salaryPct, 100) : life.baseSalaryAnnual;
  const own = mulDiv(base, Math.max(0, 100 + life.salaryModPct + life.salaryBoostPct), 100);
  const partner = life.partner ? mulDiv(median, life.partnerSalaryPct, 100) : 0;
  return own + partner;
}

/** Yearly expenses beyond living cost and debt, in start-of-game dollars. */
export function deriveExpenses(p: PlayerState, content: Content): Cents {
  const life = p.life;
  const rules = content.life;
  const living = cityOf(content, p.cityId).livingCostAnnual;

  let total = life.children.length * mulDiv(living, rules.childCostPct, 100);
  if (life.partner) total += mulDiv(living, rules.partnerCostPct, 100);
  for (const kind of INSURANCE_KINDS) {
    if (life.insurance[kind]) total += applyBp(living, rules.insurancePremiumBp[kind]);
  }
  for (const owned of life.items) total += itemOf(content, owned.itemId).upkeepAnnual;
  for (const entry of life.recurring) {
    if (entry.kind === 'expense') total += entry.annual;
  }
  return total;
}

/** Yearly passive income from recurring entries such as a business, in start-of-game dollars. */
export function derivePassive(p: PlayerState): Cents {
  let total = 0;
  for (const entry of p.life.recurring) {
    if (entry.kind === 'passive') total += entry.annual;
  }
  return total;
}

/** Where status comes from. The parts can add up to less than zero; the status itself never does. */
export interface StatusParts {
  items: number;
  home: number;
  job: number;
  city: number;
  lifestyle: number;
  /** Lasting bonuses and losses from cards. */
  bonus: number;
}

/** Status by source. Within one ladder the best item counts in full and the others in part. */
export function statusParts(p: PlayerState, content: Content): StatusParts {
  const life = p.life;
  const rules = content.life;

  const ladders = new Map<string, number[]>();
  for (const owned of life.items) {
    const item = itemOf(content, owned.itemId);
    const group = ladders.get(item.ladder);
    if (group) group.push(item.status);
    else ladders.set(item.ladder, [item.status]);
  }
  let items = 0;
  for (const group of ladders.values()) {
    let best = 0;
    for (const status of group) best = Math.max(best, status);
    let lesser = -mulDiv(best, rules.lesserItemPct, 100);
    for (const status of group) lesser += mulDiv(status, rules.lesserItemPct, 100);
    items += best + lesser;
  }

  const home = homeOf(p, content);
  return {
    items,
    home: home ? propertyTypeOf(content, home.typeId).status : rules.rentTierStatus[life.rentTier],
    job: life.career ? levelOf(content, life.career).status : 0,
    city: cityOf(content, p.cityId).prestige,
    lifestyle: rules.lifestyleStatus[p.lifestyleTier],
    bonus: life.bonusStatus,
  };
}

/** Status points: items, home, job title, city, lifestyle and lasting bonuses from cards. Never negative. */
export function deriveStatus(p: PlayerState, content: Content): number {
  const parts = statusParts(p, content);
  return Math.max(0, parts.items + parts.home + parts.job + parts.city + parts.lifestyle + parts.bonus);
}

/** Brings the derived fields of the player back in step with their life. Call after anything changes it. */
export function refreshDerived(p: PlayerState, content: Content): void {
  p.salaryAnnual = deriveSalary(p, content);
  p.extraExpensesAnnual = deriveExpenses(p, content);
  p.extraPassiveAnnual = derivePassive(p);
  p.statusPoints = deriveStatus(p, content);
}
