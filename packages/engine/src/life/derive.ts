import { careerOf, cityOf, itemOf, levelOf, propertyTypeOf } from '../lookup';
import { applyBp, BP, mulDiv } from '../money';
import type { Cents } from '../money';
import { ITEM_PERKS } from '../types';
import type { CityDef, Content, InsuranceKind, ItemDef, ItemPerks, PctStep, PlayerState, Property, Regime, StatusStep, WorkMode, WorkModeRule } from '../types';
import { FLAG_REMOTE_WORK, hasFlag } from './flags';
import { skillLevel } from './skills';

export const INSURANCE_KINDS: readonly InsuranceKind[] = ['health', 'home', 'life'];

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

/** Focus on top in a round: what the things held give, what the career leaves over, and the time retirement gives. */
export function focusBonusOf(p: PlayerState, content: Content): number {
  const fit = skillLevel(p, 'health', content) >= content.life.skills.healthFocusFrom ? 1 : 0;
  const retired = isRetired(p) ? content.life.retiredFocus : 0;
  const ownBoss = p.businesses.some((business) => business.fullTime === true) ? content.life.fullTime.focus : 0;
  return perksOf(p, content).focus + (p.life.career ? (careerOf(content, p.life.career.id).focus ?? 0) : 0) + fit + retired + workModeRule(p, content).focus + ownBoss;
}

/** The tax residency the player holds where they live, or null: one held is lost by leaving the city that gave it. */
export function residencyOf(p: PlayerState, content: Content): NonNullable<CityDef['residency']> | null {
  return p.life.residency ? (cityOf(content, p.cityId).residency ?? null) : null;
}

/** True while a lodger lives in the spare room: there must still be a home of the player's own with one. */
export function lodgerOf(p: PlayerState, content: Content): boolean {
  if (!p.life.lodger) return false;
  const home = homeOf(p, content);
  return home !== null && propertyTypeOf(content, home.typeId).spareRoom === true;
}

/** The status of running one's own business for a living, by the largest run full time; null for someone who does not. */
export function ownBossStatus(p: PlayerState, content: Content): number | null {
  let capital = -1;
  for (const business of p.businesses) if (business.fullTime === true) capital = Math.max(capital, business.capital);
  if (capital < 0) return null;
  let status = 0;
  for (const [from, points] of content.life.fullTime.status) if (capital >= from) status = points;
  return status;
}

/**
 * How the player works as things stand: the way they chose, while there is a job that allows it.
 * Without a job, in prison, or in a job that cannot be done from home, it is at the workplace.
 */
export function workModeOf(p: PlayerState, content: Content): WorkMode {
  const mode = p.life.workMode;
  if ((mode !== 'remote' && mode !== 'partTime') || p.life.career === null || p.life.jailRounds > 0) return 'office';
  // The boss's word, given on a card, opens home to any job at any rung.
  if (mode === 'remote' && hasFlag(p.life.flags, FLAG_REMOTE_WORK)) return mode;
  if (mode === 'remote' && careerOf(content, p.life.career.id).remote !== true) return 'office';
  // A step down the ladder and the trust goes with it.
  if (p.life.career.level < content.life.workModes[mode].fromLevel) return 'office';
  return mode;
}

const AT_WORK: WorkModeRule = { focus: 0, payPct: 100, jobStatusPct: 100, workSkill: true, fromLevel: 0, huntOffPct: 0 };

/** What the way the player works changes: nothing at the workplace. */
export function workModeRule(p: PlayerState, content: Content): WorkModeRule {
  const mode = workModeOf(p, content);
  return mode === 'office' ? AT_WORK : content.life.workModes[mode];
}

/**
 * The player's own yearly pay in start-of-game dollars, without a partner's: the rung of the career
 * in their city, with every lasting and passing change to it. `level` asks what another rung of
 * the same career would pay them as they stand.
 */
export function ownPay(p: PlayerState, content: Content, level?: number): Cents {
  const life = p.life;
  // Nobody is paid from a cell.
  if (life.jailRounds > 0 && level === undefined) return 0;
  // From home the pay is the one of the city the job is in, not the one the player lives in.
  const remote = workModeOf(p, content) === 'remote';
  const paidFrom = remote ? life.workCityId : p.cityId;
  const median = cityOf(content, paidFrom).medianSalaryAnnual;
  const rung = life.career ? levelOf(content, level === undefined ? life.career : { id: life.career.id, level }) : null;
  // A trade is paid by where it is plied: finance in a city of banks, more than the same desk elsewhere.
  const here = life.career ? (cityOf(content, paidFrom).careerPayPct?.[life.career.id] ?? 100) : 100;
  const base = rung ? mulDiv(mulDiv(median, rung.salaryPct, 100), here, 100) : life.baseSalaryAnnual;
  // Languages pay abroad, and knowing how to run things pays where people are led.
  const skills = content.life.skills;
  const abroad = p.cityId !== life.homeCityId ? skillLevel(p, 'languages', content) * skills.languagesAbroadPayPct : 0;
  const leads = rung && life.career && (level ?? life.career.level) >= skills.managementPayFromLevel ? skillLevel(p, 'management', content) * skills.managementPayPct : 0;
  const full = mulDiv(base, Math.max(0, 100 + life.salaryModPct + life.salaryBoostPct + perksOf(p, content).salaryPct + abroad + leads), 100);
  const kept = mulDiv(full, workModeRule(p, content).payPct, 100);
  if (!remote || paidFrom === p.cityId) return kept;
  // A job paid from a dearer city, done from a cheaper one: paid less, and never more than a multiple of what the city pays.
  const rules = content.life.remoteAbroad;
  return Math.min(mulDiv(kept, rules.payPct, 100), mulDiv(cityOf(content, p.cityId).medianSalaryAnnual, rules.capPct, 100));
}

/** Yearly salary in start-of-game dollars: the player's own pay, plus their partner's. */
export function deriveSalary(p: PlayerState, content: Content): Cents {
  const median = cityOf(content, p.cityId).medianSalaryAnnual;
  // A partner who has just followed the player to a new city earns nothing until they have found work there.
  const partner = p.life.partner && p.life.partnerSettling === 0 ? mulDiv(median, p.life.partnerSalaryPct, 100) : 0;
  return ownPay(p, content) + partner;
}

/**
 * The yearly premium of a cover, in start-of-game dollars, for cover taken out in the round `since`.
 * Health cover is dearer the older it is taken out, and cheaper for a body looked after and one that
 * goes to the gym.
 */
export function insurancePremium(p: PlayerState, content: Content, kind: InsuranceKind, since: number): Cents {
  const rules = content.life;
  const premium = applyBp(cityOf(content, p.cityId).livingCostAnnual, rules.insurancePremiumBp[kind]);
  if (kind !== 'health') return premium;
  const aged = mulDiv(premium, pctStepAt(rules.healthPremiumByAge, since), 100);
  const off = skillLevel(p, 'health', content) * rules.skills.healthPremiumOffPct + perksOf(p, content).healthCoverOffPct;
  return mulDiv(aged, Math.max(0, 100 - off), 100);
}

/** True for a player who has retired and taken up no career since. */
export function isRetired(p: PlayerState): boolean {
  return p.life.retiredAtRound !== null && p.life.career === null;
}

/** Yearly expenses beyond living cost and debt, in start-of-game dollars. */
export function deriveExpenses(p: PlayerState, content: Content): Cents {
  const life = p.life;
  const rules = content.life;
  const living = cityOf(content, p.cityId).livingCostAnnual;

  let total = life.children.length * mulDiv(living, rules.childCostPct, 100);
  if (life.partner) total += mulDiv(living, rules.partnerCostPct, 100);
  for (const kind of INSURANCE_KINDS) {
    if (life.insurance[kind]) total += insurancePremium(p, content, kind, life.healthCoverSince ?? 0);
  }
  for (const owned of life.items) total += itemOf(content, owned.itemId).upkeepAnnual;
  // An offshore company has its fee, year after year, whatever it saves; so has a residency.
  if (life.evasion.shell) total += content.evasion.shellFeeAnnual;
  total += residencyOf(p, content)?.feeAnnual ?? 0;
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

/** The percent of a step list in a round: the last step that has begun, or 100 before any. */
export function pctStepAt(steps: readonly PctStep[], round: number): number {
  let pct = 100;
  for (const step of steps) if (round >= step.fromRound) pct = step.pct;
  return pct;
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
    // A lodger in the spare room is a flat shared.
    home: home ? propertyTypeOf(content, home.typeId).status - (lodgerOf(p, content) ? rules.lodger.statusLost : 0) : rentStatusAt(content, round)[life.rentTier],
    // A life of one's own after work is a standing too.
    job: life.career ? mulDiv(levelOf(content, life.career).status, workModeRule(p, content).jobStatusPct, 100) : (ownBossStatus(p, content) ?? (isRetired(p) ? rules.retiredStatus : 0)),
    city: cityOf(content, p.cityId).prestige,
    lifestyle: lifestyleStatusAt(content, round)[p.lifestyleTier],
    bonus: life.bonusStatus + (life.statusNudge ?? 0),
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
