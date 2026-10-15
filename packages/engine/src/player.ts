import { openBusiness } from './business';
import { newId } from './ids';
import { focusBonusOf, refreshDerived } from './life/derive';
import { honestEvasion } from './evasion';
import { pointsOfLevel } from './life/skills';
import { propertyPrice } from './property';
import { indexed } from './rates';
import { SKILLS } from './types';
import type { Content, LifeState, PlayerState, StartConfig, WorldState } from './types';

/** Focus points of a life that does not say. */
export const DEFAULT_FOCUS = 3;

/** The player on day one. `world` is the opening world state, which prices the homes a life starts with. */
export function newPlayer(content: Content, start: StartConfig, world: WorldState): PlayerState {
  const from = start.life;
  const life: LifeState = {
    lifeId: from?.lifeId ?? 'plain',
    career: from?.career ? { id: from.career.id, level: from.career.level } : null,
    baseSalaryAnnual: start.salaryAnnual,
    salaryModPct: 0,
    salaryBoostPct: 0,
    careerSkill: from?.careerSkill ?? 0,
    financeSkill: from?.financeSkill ?? 0,
    skills: Object.fromEntries(SKILLS.map((skill) => [skill, from?.skills?.[skill] ?? 0])) as LifeState['skills'],
    homeCityId: start.cityId,
    evasion: honestEvasion(),
    investedRounds: 0,
    financePoints: pointsOfLevel(from?.financeSkill ?? 0, content),
    focusBase: from?.focus ?? DEFAULT_FOCUS,
    focusBonus: 0,
    focusUsed: 0,
    focusLost: 0,
    jailRounds: 0,
    overtimeStreak: 0,
    huntMisses: 0,
    huntRest: 0,
    workMode: 'office',
    raiseRest: 0,
    formerCareer: null,
    lodger: false,
    rungStudy: 0,
    partner: false,
    partnerSalaryPct: 0,
    children: [],
    insurance: { health: false, home: false, life: false, liability: false },
    healthCoverSince: null,
    retiredAtRound: null,
    legacy: 0,
    rentTier: from?.rentTier ?? 1,
    minLifestyleTier: from?.minLifestyleTier ?? 0,
    items: [],
    collection: [],
    recurring: (from?.recurring ?? []).map((entry) => ({ ...entry })),
    flags: Object.fromEntries((from?.flags ?? []).map((flag) => [flag, 0])),
    seen: {},
    bonusStatus: 0,
    movingTo: null,
    movingTransfer: false,
    partnerSettling: 0,
  };
  const p: PlayerState = {
    cityId: start.cityId,
    cash: start.cash,
    deposit: 0,
    pension: 0,
    positions: {},
    businesses: [],
    plans: [],
    reinvest: false,
    properties: [],
    debts: [],
    lifestyleTier: start.lifestyleTier,
    life,
    salaryAnnual: 0,
    extraExpensesAnnual: 0,
    extraPassiveAnnual: 0,
    statusPoints: 0,
    statusSum: 0,
    nextId: 0,
    passiveStreak: 0,
    escapedAtRound: null,
    bankruptUntilRound: 0,
  };
  for (const debt of start.debts) p.debts.push({ id: newId(p, 'debt'), ...debt });
  for (const home of from?.properties ?? []) {
    const price = propertyPrice(content, world, start.cityId, home.typeId);
    p.properties.push({
      id: newId(p, 'property'),
      cityId: start.cityId,
      typeId: home.typeId,
      value: price,
      basis: price,
      rented: home.rented,
      mortgageId: null,
    });
  }
  for (const held of from?.holdings ?? []) p.positions[held.assetId] = { value: held.value, basis: held.value };
  for (const owned of from?.businesses ?? []) openBusiness(p, owned.typeId, indexed(owned.capital, world), content);
  // A job that leaves time over leaves it from the first day.
  p.life.focusBonus = focusBonusOf(p, content);
  refreshDerived(p, content, 0);
  return p;
}
