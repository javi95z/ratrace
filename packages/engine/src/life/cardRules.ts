import { idAllowed, isCount, isRecord, isRecurring, isWhole, within } from '../checks';
import type { Content } from '../types';
import { INSURANCE_KINDS } from './derive';

const CATEGORIES: readonly string[] = [
  'career', 'education', 'business', 'investing', 'housing', 'lifestyle',
  'family', 'health', 'luck', 'world', 'tax', 'laterLife',
];
const REGIMES: readonly string[] = ['expansion', 'boom', 'slowdown', 'recession', 'recovery'];
const PHASES: readonly string[] = ['accumulation', 'bull', 'mania', 'winter'];
const HOLDINGS: readonly string[] = ['bond', 'equity', 'crypto', 'gold', 'deposit'];

const isFlag = (x: unknown): boolean => typeof x === 'boolean';

type Check = (value: unknown, key: string) => string | null;

/** Runs one check per known key and reports the keys nobody knows. Returns the problems, each without its prefix. */
function checkRecord(record: Record<string, unknown>, checks: Record<string, Check>, unknown: (key: string) => string): string[] {
  const problems: string[] = [];
  for (const key of Object.keys(record)) {
    if (!Object.hasOwn(checks, key)) {
      problems.push(unknown(key));
      continue;
    }
    if (record[key] === undefined) continue;
    const problem = checks[key](record[key], key);
    if (problem !== null) problems.push(problem);
  }
  return problems;
}

/** Every problem with the cards of the content. An empty list means they are usable. */
export function validateCards(c: Content): string[] {
  const errors: string[] = [];
  if (!within(c.world.quietWeight, 0, Number.MAX_VALUE)) errors.push('world.quietWeight must not be negative');
  if (!(isWhole(c.life.cardsPerRound) && c.life.cardsPerRound >= 0 && c.life.cardsPerRound <= 10)) {
    errors.push('life.cardsPerRound must be a whole number from 0 to 10');
  }

  const cities = c.cities.map((x) => x.id);
  const careers = c.careers.map((x) => x.id);
  const items = c.items.map((x) => x.id);
  const ladders = c.items.map((x) => x.ladder);
  const assets = c.assets.map((x) => x.id);
  const types = c.propertyTypes.map((x) => x.id);

  /** A check that the value is a list whose every entry is one of `known`. */
  const listOf = (known: readonly string[], what: string): Check => (value, key) => {
    if (!Array.isArray(value)) return `needs a list for ${key}`;
    const stranger = value.find((entry) => !known.includes(entry as string));
    return stranger === undefined ? null : `names an unknown ${what}: ${String(stranger)}`;
  };
  const oneOf = (known: readonly string[], what: string): Check => (value) =>
    known.includes(value as string) ? null : `names an unknown ${what}: ${String(value)}`;
  const flagList: Check = (value, key) => {
    if (!Array.isArray(value)) return `needs a list for ${key}`;
    const bad = value.find((entry) => !idAllowed(entry));
    return bad === undefined ? null : `has a flag that is not allowed: ${JSON.stringify(bad)}`;
  };
  const nameList: Check = (value, key) => {
    if (!Array.isArray(value)) return `needs a list for ${key}`;
    const bad = value.find((entry) => !idAllowed(entry));
    return bad === undefined ? null : `has a name that is not allowed in ${key}: ${JSON.stringify(bad)}`;
  };
  const count: Check = (value, key) => (isCount(value) ? null : `needs a whole, non-negative number for ${key}`);
  const whole: Check = (value, key) => (isWhole(value) ? null : `needs a whole number for ${key}`);
  const positive: Check = (value, key) => (isWhole(value) && value > 0 ? null : `needs a positive whole number for ${key}`);
  const flag: Check = (value, key) => (isFlag(value) ? null : `needs true or false for ${key}`);
  const skill: Check = (value, key) => ([0, 1, 2].includes(value as number) ? null : `needs 0, 1 or 2 for ${key}`);

  const conditionChecks: Record<string, Check> = {
    minRound: count, maxRound: count, minLevel: count, maxLevel: count, minChildren: count, maxChildren: count,
    cities: listOf(cities, 'city'), notCities: listOf(cities, 'city'), careers: listOf(careers, 'career'),
    employed: flag, partner: flag, ownsHome: flag, landlord: flag, hasMortgage: flag,
    minNetWorth: whole, maxNetWorth: whole, cityPropertyReturnAtMostBp: whole,
    minFinanceSkill: skill, maxFinanceSkill: skill,
    flags: flagList, notFlags: flagList,
    holds: oneOf(HOLDINGS, 'holding'), ownsLadder: oneOf(ladders, 'ladder'), notItems: listOf(items, 'item'),
    insured: oneOf(INSURANCE_KINDS, 'insurance'),
    regimes: listOf(REGIMES, 'regime'),
  };
  const triggerChecks: Record<string, Check> = {
    regimeBegan: listOf(REGIMES, 'regime'), regimes: listOf(REGIMES, 'regime'), cryptoBegan: listOf(PHASES, 'crypto phase'),
    rateChangeAtLeastBp: whole, rateChangeAtMostBp: whole, inflationAtLeastBp: whole, anyPropertyReturnAtMostBp: whole,
    taxReform: flag,
  };

  const jobCheck: Check = (value) => {
    if (!isRecord(value)) return 'has a job change that changes nothing';
    const stranger = Object.keys(value).find((key) => !['career', 'level', 'levelDelta', 'leave'].includes(key));
    if (stranger !== undefined) return `has a job change with an unknown part: ${stranger}`;
    if (value.leave === true) return null;
    if (value.career === undefined && value.level === undefined && value.levelDelta === undefined) {
      return 'has a job change that changes nothing';
    }
    if ((value.level !== undefined && !isCount(value.level)) || (value.levelDelta !== undefined && !isWhole(value.levelDelta))) {
      return 'needs whole numbers for a job level';
    }
    if (value.career !== undefined) {
      const career = c.careers.find((x) => x.id === value.career);
      if (!career) return `names an unknown career: ${String(value.career)}`;
      if (value.level !== undefined && (value.level as number) >= career.levels.length) {
        return `names level ${String(value.level)}, which career ${career.id} does not have`;
      }
    }
    return null;
  };

  const effectChecks: Record<string, Check> = {
    cash: whole, cashSalaryPct: whole, cashNetWorthPct: whole, salaryModPct: whole, salaryBoostPct: whole,
    careerSkill: whole, financeSkill: whole, status: whole,
    loan: positive, pension: positive, homeValue: positive,
    focus: (value) => (isWhole(value) && value >= 0 && value <= 10 ? null : 'needs focus from 0 to 10'),
    children: (value) => (isWhole(value) && value >= 1 && value <= 4 ? null : 'needs children from 1 to 4'),
    lifestyleFloor: (value) => ([0, 1, 2, 3].includes(value as number) ? null : 'has a lifestyle floor that is not 0, 1, 2 or 3'),
    sellHome: flag,
    refinance: (value) => (value === 'fixed' || value === 'variable' ? null : `has an unknown refinance kind: ${String(value)}`),
    protection: (value) => {
      if (!isRecord(value)) return 'has a protection that names neither an insurance nor a flag';
      if (value.insurance !== undefined && !INSURANCE_KINDS.includes(value.insurance as never)) {
        return `has a protection with an unknown insurance: ${String(value.insurance)}`;
      }
      if (value.flag !== undefined && !idAllowed(value.flag)) {
        return `has a protection with a flag that is not allowed: ${JSON.stringify(value.flag)}`;
      }
      if (value.insurance === undefined && value.flag === undefined) return 'has a protection that names neither an insurance nor a flag';
      return within(value.coverPct, 0, 100) ? null : 'has a protection cover outside 0..100';
    },
    recurring: (value, key) => {
      if (!Array.isArray(value)) return `needs a list for ${key}`;
      return value.every(isRecurring) ? null : 'has a recurring entry that is not valid';
    },
    endRecurring: nameList, setFlags: nameList, clearFlags: nameList,
    job: jobCheck,
    moveCity: oneOf(cities, 'city'),
    partner: (value) => (value === null || (isRecord(value) && isCount(value.salaryPct)) ? null : 'needs a whole, non-negative partner salary'),
    buyItem: (value) => {
      const deal = isRecord(value) ? value : {};
      if (!items.includes(deal.itemId as string)) return `names an unknown item: ${String(deal.itemId)}`;
      return within(deal.pricePct, 0, 200) ? null : 'has an item price outside 0..200 percent';
    },
    invest: (value) => {
      const deal = isRecord(value) ? value : {};
      if (!assets.includes(deal.assetId as string)) return `names an unknown asset: ${String(deal.assetId)}`;
      if (!(isWhole(deal.amount) && deal.amount > 0)) return 'needs a positive whole amount to invest';
      return deal.bonusPct === undefined || within(deal.bonusPct, 0, 10_000) ? null : 'has a negative investment bonus';
    },
    property: (value) => {
      const deal = isRecord(value) ? value : {};
      if (!types.includes(deal.typeId as string)) return `names an unknown property type: ${String(deal.typeId)}`;
      if (!within(deal.pricePct, 1, 200)) return 'has a property price outside 1..200 percent';
      if (!within(deal.downPct, 0, 100)) return 'has a down payment outside 0..100 percent';
      return isFlag(deal.rented) ? null : 'needs true or false for a property being rented';
    },
    lose: (value) => {
      const loss = isRecord(value) ? value : {};
      if (!HOLDINGS.includes(loss.what as string)) return `loses an unknown holding: ${String(loss.what)}`;
      return within(loss.pct, 0, 100) ? null : 'has a loss outside 0..100 percent';
    },
  };

  const checkCondition = (when: unknown, where: string): void => {
    if (when === undefined) return;
    if (!isRecord(when)) {
      errors.push(`${where} condition is not a record`);
      return;
    }
    for (const problem of checkRecord(when, conditionChecks, (key) => `has an unknown part: ${key}`)) {
      errors.push(`${where} condition ${problem}`);
    }
  };
  const checkEffects = (effects: unknown, where: string): void => {
    if (effects === undefined) return;
    if (!isRecord(effects)) {
      errors.push(`${where} has effects that are not a record`);
      return;
    }
    for (const problem of checkRecord(effects, effectChecks, (key) => `has an unknown effect: ${key}`)) {
      errors.push(`${where} ${problem}`);
    }
  };

  const seen = new Set<string>();
  for (const card of c.cards) {
    if (!idAllowed(card.id)) errors.push(`card id ${JSON.stringify(card.id)} is not allowed`);
    if (seen.has(card.id)) errors.push(`duplicate card id: ${card.id}`);
    seen.add(card.id);

    const name = `card ${card.id}`;
    if (!CATEGORIES.includes(card.category)) errors.push(`${name} has an unknown category: ${card.category}`);
    if (!(typeof card.weight === 'number' && Number.isFinite(card.weight) && card.weight > 0)) errors.push(`${name} needs a positive weight`);
    if (!isCount(card.cooldown)) errors.push(`${name} needs a whole, non-negative cooldown`);

    if (card.category === 'world') {
      if (!isRecord(card.trigger)) errors.push(`${name} is a world card and needs a trigger`);
      else {
        for (const problem of checkRecord(card.trigger as Record<string, unknown>, triggerChecks, (key) => `has an unknown part: ${key}`)) {
          errors.push(`${name} trigger ${problem}`);
        }
      }
    } else if (card.trigger !== undefined) {
      errors.push(`${name} has a trigger but is not a world card`);
    }
    checkCondition(card.when, name);

    if (!Array.isArray(card.options) || card.options.length < 2 || card.options.length > 3) {
      errors.push(`${name} needs two or three options`);
      continue;
    }
    card.options.forEach((option, i) => {
      const where = `${name} option ${i}`;
      if (i === 0) {
        if (option.when !== undefined) errors.push(`${where} is the default and cannot have a condition`);
        const fixed = isRecord(option.effects) ? option.effects : {};
        if (fixed.buyItem !== undefined || fixed.invest !== undefined || fixed.property !== undefined) {
          errors.push(`${where} is the default and cannot buy anything`);
        }
      } else {
        checkCondition(option.when, where);
      }
      checkEffects(option.effects, where);
      if (option.outcomes === undefined) return;
      if (!Array.isArray(option.outcomes) || option.outcomes.length === 0) {
        errors.push(`${where} has an empty list of outcomes`);
        return;
      }
      option.outcomes.forEach((outcome, k) => {
        const at = `${where} outcome ${k}`;
        if (!(typeof outcome.weight === 'number' && Number.isFinite(outcome.weight) && outcome.weight > 0)) {
          errors.push(`${at} needs a positive weight`);
        }
        checkEffects(outcome.effects, at);
      });
    });
  }
  return errors;
}
