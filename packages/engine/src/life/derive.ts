import { careerOf, cityOf, itemOf, levelOf, propertyTypeOf } from '../lookup';
import { applyBp, BP, mulDiv } from '../money';
import type { Cents } from '../money';
import { ITEM_PERKS } from '../types';
import type { Content, InsuranceKind, ItemDef, ItemPerks, PlayerState, Property, Regime, StatusStep } from '../types';
import { skillLevel } from './skills';

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

/**
 * The status a thing gives, held for `age` rounds. In a ladder that ages, each round takes the
 * item's own loss of resale value off its status as well, down to the floor: a ten-year-old car is
 * worth less at the lights as well as at the dealer's. Whatever holds or gains value keeps what it gave.
 */
export function itemStatus(item: ItemDef, age: number, content: Content): number {
  if (item.resaleDriftBp >= 0 || !content.life.agingLadders.includes(item.ladder)) return item.status;
  const floor = content.life.agingFloorPct * 100;
  let share = BP;
  for (let round = 0; round < age && share > floor; round++) share = mulDiv(share, BP + item.resaleDriftBp, BP);
  return Math.floor((item.status * Math.max(share, floor) + BP / 2) / BP);
}

/**
 * What the things the player owns are good for, added up. Within a ladder only the best of each
 * perk counts, so a second car moves no more boxes than the first; across ladders they add.
 */
export function perksOf(p: PlayerState, content: Content): Required<ItemPerks> {
  const total: Required<ItemPerks> = { moveCostOffPct: 0, studySkill: 0, salaryPct: 0, jobHuntPct: 0, focus: 0, healthCoverOffPct: 0 };
  const best = new Map<string, Required<ItemPerks>>();
  for (const owned of p.life.items) {
    const item = itemOf(content, owned.itemId);
    if (item.perks === undefined) continue;
    let ladder = best.get(item.ladder);
    if (!ladder) best.set(item.ladder, (ladder = { moveCostOffPct: 0, studySkill: 0, salaryPct: 0, jobHuntPct: 0, focus: 0, healthCoverOffPct: 0 }));
    for (const perk of ITEM_PERKS) ladder[perk] = Math.max(ladder[perk], item.perks[perk] ?? 0);
  }
  for (const ladder of best.values()) for (const perk of ITEM_PERKS) total[perk] += ladder[perk];
  return total;
}

/**
 * What the player's career does to their pay in a round, in percent: what the economy adds or takes
 * in a trade that follows it, and what age takes in a trade for the young. Nothing without a career.
 */
export function careerSwing(p: PlayerState, content: Content, regime: Regime, round: number): { cyclePct: number; fadePct: number } {
  const job = p.life.career;
  if (job === null) return { cyclePct: 0, fadePct: 0 };
  const career = careerOf(content, job.id);
  const fade = career.fade;
  return {
    cyclePct: career.cyclePct?.[regime] ?? 0,
    fadePct: fade && round >= fade.fromRound ? -Math.min(fade.maxPct, fade.pctPerRound * (round - fade.fromRound + 1)) : 0,
  };
}

/** Focus on top in a round: what the things held give, and what the career leaves over. */
export function focusBonusOf(p: PlayerState, content: Content): number {
  const fit = skillLevel(p, 'health', content) >= content.life.skills.healthFocusFrom ? 1 : 0;
  return perksOf(p, content).focus + (p.life.career ? (careerOf(content, p.life.career.id).focus ?? 0) : 0) + fit;
}

/**
 * The player's own yearly pay in start-of-game dollars, without a partner's: the rung of the career
 * in their city, with every lasting and passing change to it. `level` asks what another rung of
 * the same career would pay them as they stand.
 */
export function ownPay(p: PlayerState, content: Content, level?: number): Cents {
  const life = p.life;
  const median = cityOf(content, p.cityId).medianSalaryAnnual;
  const rung = life.career ? levelOf(content, level === undefined ? life.career : { id: life.career.id, level }) : null;
  // A trade is paid by where it is plied: finance in a city of banks, more than the same desk elsewhere.
  const here = life.career ? (cityOf(content, p.cityId).careerPayPct?.[life.career.id] ?? 100) : 100;
  const base = rung ? mulDiv(mulDiv(median, rung.salaryPct, 100), here, 100) : life.baseSalaryAnnual;
  return mulDiv(base, Math.max(0, 100 + life.salaryModPct + life.salaryBoostPct + perksOf(p, content).salaryPct), 100);
}

/** Yearly salary in start-of-game dollars: the player's own pay, plus their partner's. */
export function deriveSalary(p: PlayerState, content: Content): Cents {
  const median = cityOf(content, p.cityId).medianSalaryAnnual;
  // A partner who has just followed the player to a new city earns nothing until they have found work there.
  const partner = p.life.partner && p.life.partnerSettling === 0 ? mulDiv(median, p.life.partnerSalaryPct, 100) : 0;
  return ownPay(p, content) + partner;
}

/** Yearly expenses beyond living cost and debt, in start-of-game dollars. */
export function deriveExpenses(p: PlayerState, content: Content): Cents {
  const life = p.life;
  const rules = content.life;
  const living = cityOf(content, p.cityId).livingCostAnnual;

  let total = life.children.length * mulDiv(living, rules.childCostPct, 100);
  if (life.partner) total += mulDiv(living, rules.partnerCostPct, 100);
  for (const kind of INSURANCE_KINDS) {
    if (!life.insurance[kind]) continue;
    const premium = applyBp(living, rules.insurancePremiumBp[kind]);
    // A body looked after is cheaper to insure, and so is one that goes to the gym.
    const off = kind === 'health' ? skillLevel(p, 'health', content) * rules.skills.healthPremiumOffPct + perksOf(p, content).healthCoverOffPct : 0;
    total += mulDiv(premium, Math.max(0, 100 - off), 100);
  }
  for (const owned of life.items) total += itemOf(content, owned.itemId).upkeepAnnual;
  // An offshore company has its fee, year after year, whatever it saves.
  if (life.evasion.shell) total += content.evasion.shellFeeAnnual;
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
  /** Who the player knows. */
  network: number;
}

/** Status by source. Within one ladder the best item counts in full and the others in part. */
/** The status of a step list in a round: the last step that has begun. */
export function statusStepAt(steps: readonly StatusStep[], round: number): number {
  let status = steps[0]?.status ?? 0;
  for (const step of steps) if (round >= step.fromRound) status = step.status;
  return status;
}

/** The next step of a list after a round, or null when none is left. */
export function nextStatusStep(steps: readonly StatusStep[], round: number): StatusStep | null {
  return steps.find((step) => step.fromRound > round) ?? null;
}

/** The status each way of renting gives in a round: a room costs more of it the older the player is. */
export function rentStatusAt(content: Content, round: number): [number, number] {
  return [statusStepAt(content.life.agedStatus.room, round), content.life.rentTierStatus[1]];
}

/** The status each way of living gives in a round: the frugal way costs more of it the older the player is. */
export function lifestyleStatusAt(content: Content, round: number): [number, number, number, number] {
  const [, normal, comfortable, lavish] = content.life.lifestyleStatus;
  return [statusStepAt(content.life.agedStatus.frugal, round), normal, comfortable, lavish];
}

export function statusParts(p: PlayerState, content: Content, round: number): StatusParts {
  const life = p.life;
  const rules = content.life;

  const ladders = new Map<string, number[]>();
  for (const owned of life.items) {
    const item = itemOf(content, owned.itemId);
    const status = itemStatus(item, owned.age, content);
    const group = ladders.get(item.ladder);
    if (group) group.push(status);
    else ladders.set(item.ladder, [status]);
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
    home: home ? propertyTypeOf(content, home.typeId).status : rentStatusAt(content, round)[life.rentTier],
    job: life.career ? levelOf(content, life.career).status : 0,
    city: cityOf(content, p.cityId).prestige,
    lifestyle: lifestyleStatusAt(content, round)[p.lifestyleTier],
    bonus: life.bonusStatus,
    network: skillLevel(p, 'network', content) * rules.skills.networkStatus,
  };
}

/** Status points: items, home, job title, city, lifestyle and lasting bonuses from cards. Never negative. */
export function deriveStatus(p: PlayerState, content: Content, round: number): number {
  const parts = statusParts(p, content, round);
  return Math.max(0, parts.items + parts.home + parts.job + parts.city + parts.lifestyle + parts.bonus + parts.network);
}

/** Brings the derived fields of the player back in step with their life. Call after anything changes it. */
export function refreshDerived(p: PlayerState, content: Content, round: number): void {
  p.salaryAnnual = deriveSalary(p, content);
  p.extraExpensesAnnual = deriveExpenses(p, content);
  p.extraPassiveAnnual = derivePassive(p);
  p.statusPoints = deriveStatus(p, content, round);
}
