import { idAllowed, isCount, isFiniteNumber, isRecord, isRecurring, isWhole, notNegative, within } from './checks';
import { validateCards } from './life/cardRules';
import { INSURANCE_KINDS } from './life/derive';
import type { Content, CryptoPhase, DebtKind, Regime, StartConfig } from './types';

type Transitions = Record<string, ReadonlyArray<readonly [string, number]>>;

const REGIMES: readonly Regime[] = ['expansion', 'boom', 'slowdown', 'recession', 'recovery'];
const PHASES: readonly CryptoPhase[] = ['accumulation', 'bull', 'mania', 'winter'];
export const DEBT_KINDS: readonly DebtKind[] = ['mortgageFixed', 'mortgageVariable', 'personalLoan', 'creditCard'];

export const ITEM_KINDS: readonly string[] = ['durable', 'membership', 'experience'];

/** Returns a list of problems. An empty list means the content is usable. */
export function validateContent(c: Content): string[] {
  const errors: string[] = [];

  const checkIds = (ids: string[], what: string) => {
    const seen = new Set<string>();
    for (const id of ids) {
      if (!idAllowed(id)) errors.push(`${what} id ${JSON.stringify(id)} is not allowed`);
      if (seen.has(id)) errors.push(`duplicate ${what} id: ${id}`);
      seen.add(id);
    }
  };

  const checkTransitions = (name: string, states: readonly string[], table: Transitions) => {
    for (const from of states) {
      if (!Object.hasOwn(table, from)) {
        errors.push(`${name} transitions are missing a row for ${from}`);
        continue;
      }
      let total = 0;
      let badWeight = false;
      for (const [to, weight] of table[from]) {
        if (!states.includes(to)) errors.push(`${name} transitions from ${from} point at unknown state ${to}`);
        if (notNegative(weight)) total += weight;
        else badWeight = true;
      }
      if (badWeight) errors.push(`${name} transitions from ${from} have a negative or non-finite weight`);
      else if (total <= 0) errors.push(`${name} transitions from ${from} have no weight`);
    }
  };

  if (!Number.isInteger(c.rounds) || c.rounds < 1) errors.push('rounds must be a positive integer');
  if (!Number.isInteger(c.yearsPerRound) || c.yearsPerRound < 1) errors.push('yearsPerRound must be a positive integer');
  if (c.cities.length === 0) errors.push('at least one city is required');

  checkIds(c.assets.map((a) => a.id), 'asset');
  checkIds(c.cities.map((x) => x.id), 'city');
  checkIds(c.propertyTypes.map((x) => x.id), 'property type');
  checkIds(c.careers.map((x) => x.id), 'career');
  checkIds(c.items.map((x) => x.id), 'item');

  if (c.lifestyleMultiplierPct.length !== 4 || c.lifestyleMultiplierPct.some((x) => !isWhole(x) || x <= 0)) {
    errors.push('lifestyleMultiplierPct must be four positive integers');
  }
  if (!within(c.housingSharePct, 0, 100)) errors.push('housingSharePct must be between 0 and 100');
  if (!isWhole(c.maxOrdersPerRound) || c.maxOrdersPerRound < 1) errors.push('maxOrdersPerRound must be a positive integer');
  if (!within(c.pensionContributionCapBp, 0, 10_000)) errors.push('pensionContributionCapBp must be between 0 and 10000');

  for (const a of c.assets) {
    if (a.class === 'bond' && (a.durationYears === undefined || a.yieldSpreadBp === undefined)) {
      errors.push(`bond ${a.id} needs durationYears and yieldSpreadBp`);
    }
    if (a.crashChancePct !== undefined && !within(a.crashChancePct, 0, 100)) {
      errors.push(`asset ${a.id} has a crash chance outside 0..100`);
    }
    if (!notNegative(a.idioVolBp) || !notNegative(a.yieldBp)) errors.push(`asset ${a.id} has a negative volatility or yield`);
    if (!isFiniteNumber(a.betaPct)) errors.push(`asset ${a.id} has a beta that is not a finite number`);
    if (a.driftBp !== undefined && !isWhole(a.driftBp)) errors.push(`asset ${a.id} has a drift that is not a whole number`);
    if (a.minFinanceSkill !== undefined && ![0, 1, 2].includes(a.minFinanceSkill)) {
      errors.push(`asset ${a.id} needs a finance skill of 0, 1 or 2`);
    }
  }
  if (!c.assets.some((a) => a.id === c.pensionAssetId)) {
    errors.push(`pensionAssetId ${c.pensionAssetId} is not an asset`);
  }

  checkTransitions('regime', REGIMES, c.market.regimeTransitions);
  checkTransitions('crypto', PHASES, c.market.cryptoTransitions);
  if (!within(c.market.recessionWinterChancePct, 0, 100)) {
    errors.push('market.recessionWinterChancePct must be between 0 and 100');
  }
  const m = c.market;
  const tables: Array<[string, Record<string, unknown>, readonly string[]]> = [
    ['equityMeanBp', m.equityMeanBp, REGIMES],
    ['goldMeanBp', m.goldMeanBp, REGIMES],
    ['rateDriftBp', m.rateDriftBp, REGIMES],
    ['inflationTargetBp', m.inflationTargetBp, REGIMES],
    ['cryptoMeanBp', m.cryptoMeanBp, PHASES],
    ['classVolBp', m.classVolBp, ['equity', 'crypto', 'gold']],
  ];
  for (const [name, table, keys] of tables) {
    for (const key of keys) {
      const value = isRecord(table) ? table[key] : undefined;
      if (!isFiniteNumber(value)) errors.push(`market.${name}.${key} must be a finite number`);
      else if (name === 'classVolBp' && value < 0) errors.push(`market.${name}.${key} must not be negative`);
    }
  }
  for (const name of ['rateNoiseBp', 'inflationNoiseBp', 'depositSpreadBp'] as const) {
    if (!isFiniteNumber(m[name])) errors.push(`market.${name} must be a finite number`);
  }
  if (!REGIMES.includes(m.start.regime)) errors.push(`market.start.regime is not a regime: ${m.start.regime}`);
  if (!PHASES.includes(m.start.cryptoPhase)) errors.push(`market.start.cryptoPhase is not a crypto phase: ${m.start.cryptoPhase}`);
  for (const name of ['policyRateBp', 'inflationBp'] as const) {
    if (!isFiniteNumber(m.start[name])) errors.push(`market.start.${name} must be a finite number`);
  }

  for (const city of c.cities) {
    const rates = [...city.tax.incomeRatesBp, city.tax.capitalGainsBp, city.tax.dividendBp, city.tax.rentBp];
    if (rates.some((r) => !within(r, 0, 10_000))) errors.push(`city ${city.id} has a tax rate outside 0..10000 bp`);
    const sizes = [city.medianSalaryAnnual, city.livingCostAnnual, city.flatPrice];
    if (sizes.some((x) => !isWhole(x) || x <= 0)) {
      errors.push(`city ${city.id} needs a positive salary, living cost and flat price`);
    }
    if (!isCount(city.prestige)) errors.push(`city ${city.id} needs a whole, non-negative prestige`);
  }

  for (const type of c.propertyTypes) {
    if (!(typeof type.pricePct === 'number' && Number.isFinite(type.pricePct) && type.pricePct > 0)) {
      errors.push(`property type ${type.id} needs a positive price percentage`);
    }
    if (!isCount(type.status)) errors.push(`property type ${type.id} needs a whole, non-negative status`);
  }

  for (const career of c.careers) {
    if (!notNegative(career.overtimePct)) errors.push(`career ${career.id} has a negative overtime percentage`);
    if (career.levels.length === 0) {
      errors.push(`career ${career.id} needs at least one level`);
      continue;
    }
    if (career.levels[0].minSkill !== 0) errors.push(`career ${career.id} must start at skill 0`);
    career.levels.forEach((level, i) => {
      const name = `career ${career.id} level ${i}`;
      if (!(isFiniteNumber(level.salaryPct) && level.salaryPct > 0)) errors.push(`${name} needs a positive salary percentage`);
      if (!isCount(level.status)) errors.push(`${name} needs a whole, non-negative status`);
      if (!isCount(level.minSkill)) errors.push(`${name} needs a whole, non-negative skill`);
      else if (i > 0 && level.minSkill <= career.levels[i - 1].minSkill) {
        errors.push(`${name} must need more skill than the level below`);
      }
    });
  }

  for (const item of c.items) {
    if (!ITEM_KINDS.includes(item.kind)) errors.push(`item ${item.id} has an unknown kind`);
    if (!idAllowed(item.ladder)) errors.push(`item ${item.id} has a ladder name that is not allowed`);
    if (!isCount(item.price) || !isCount(item.upkeepAnnual)) errors.push(`item ${item.id} needs a whole, non-negative price and upkeep`);
    if (!isCount(item.status)) errors.push(`item ${item.id} needs a whole, non-negative status`);
    if (!within(item.resaleStartPct, 0, 200)) errors.push(`item ${item.id} has a resale percentage outside 0..200`);
    if (!isWhole(item.resaleDriftBp) || item.resaleDriftBp <= -10_000) {
      errors.push(`item ${item.id} has a resale drift that is not a whole number above -10000`);
    }
    if (item.kind === 'experience' && !(isWhole(item.boostRounds) && item.boostRounds >= 1)) {
      errors.push(`experience ${item.id} needs at least one round of boost`);
    }
  }

  const life = c.life as unknown as Record<string, unknown>;
  for (const field of ['childCostPct', 'partnerCostPct', 'moveCostPct', 'workSkill', 'studySkill', 'jobHuntRaisePct', 'cheapMortgageBp']) {
    if (!isCount(life[field])) errors.push(`life.${field} must be a whole, non-negative number`);
  }
  for (const field of ['childRounds', 'financeExperienceRounds']) {
    if (!(isWhole(life[field]) && life[field] >= 1)) errors.push(`life.${field} must be a positive whole number`);
  }
  for (const field of ['jobHuntChancePct', 'lesserItemPct', 'unstablePayPct']) {
    if (!within(life[field], 0, 100)) errors.push(`life.${field} must be between 0 and 100`);
  }
  const listOf = (x: unknown, length: number, ok: (v: unknown) => boolean) => Array.isArray(x) && x.length === length && x.every(ok);
  if (!listOf(life.rentTierHousingPct, 2, (v) => within(v, 0, 100))) {
    errors.push('life.rentTierHousingPct must be two numbers between 0 and 100');
  }
  if (!listOf(life.rentTierStatus, 2, isCount)) errors.push('life.rentTierStatus must be two whole, non-negative numbers');
  if (!listOf(life.lifestyleStatus, 4, isCount)) errors.push('life.lifestyleStatus must be four whole, non-negative numbers');
  for (const kind of INSURANCE_KINDS) {
    const premiums = life.insurancePremiumBp;
    if (!isRecord(premiums) || !isCount(premiums[kind])) {
      errors.push(`life.insurancePremiumBp needs a whole, non-negative number for ${kind}`);
    }
  }
  if (![0, 1, 2].includes(life.rentOutMinFinanceSkill as number)) errors.push('life.rentOutMinFinanceSkill must be 0, 1 or 2');

  const w = c.world;
  if (!(isWhole(w.headlinesPerRound) && w.headlinesPerRound >= 0 && w.headlinesPerRound <= 5)) {
    errors.push('world.headlinesPerRound must be a whole number from 0 to 5');
  }
  if (!within(w.newsTruthPct, 0, 100)) errors.push('world.newsTruthPct must be between 0 and 100');
  if (!isCount(w.flatBandBp)) errors.push('world.flatBandBp must be a whole, non-negative number');
  if (!within(w.taxReformChancePct, 0, 100)) errors.push('world.taxReformChancePct must be between 0 and 100');
  if (!isCount(w.taxReformsPerGame)) errors.push('world.taxReformsPerGame must be a whole, non-negative number');
  if (!Array.isArray(w.taxReformStepsBp) || w.taxReformStepsBp.some((step) => !isWhole(step) || step === 0)) {
    errors.push('world.taxReformStepsBp must be whole numbers other than zero');
  } else if (w.taxReformStepsBp.length === 0 && w.taxReformChancePct > 0 && w.taxReformsPerGame > 0) {
    errors.push('world.taxReformStepsBp is empty but reforms can happen');
  }

  const d = c.debt;
  if (!within(d.mortgageMaxLtvBp, 0, 10_000)) errors.push('debt.mortgageMaxLtvBp must be between 0 and 10000');
  if (!within(d.fireSaleDiscountBp, 0, 10_000)) errors.push('debt.fireSaleDiscountBp must be between 0 and 10000');
  if ([d.mortgageTermRounds, d.personalLoanTermRounds, d.bankruptcyLockRounds].some((x) => !isWhole(x) || x < 1)) {
    errors.push('debt terms must be positive integers');
  }
  const amounts = [d.personalLoanSpreadBp, d.mortgageSpreadBp, d.creditCardRateBp, d.personalLoanMaxIncomePct, d.bankruptcyIncomeMultiple];
  if (amounts.some((x) => !notNegative(x))) errors.push('debt rates, spreads and limits must not be negative');

  const points = c.scoring.wealthBreakpoints;
  if (points.length < 2) errors.push('scoring needs at least two wealth breakpoints');
  for (let i = 1; i < points.length; i++) {
    if (points[i][0] <= points[i - 1][0]) {
      errors.push('wealth breakpoints must be strictly increasing');
      break;
    }
  }

  errors.push(...validateCards(c));
  return errors;
}

/** Returns a list of problems with the way a life starts. An empty list means it is usable. */
export function validateStart(content: Content, start: StartConfig): string[] {
  const errors: string[] = [];
  if (!content.cities.some((city) => city.id === start.cityId)) errors.push(`unknown city: ${start.cityId}`);
  if (!isWhole(start.cash) || start.cash < 0) errors.push('cash must be a non-negative whole number of cents');
  if (!isWhole(start.salaryAnnual) || start.salaryAnnual < 0) {
    errors.push('salaryAnnual must be a non-negative whole number of cents');
  }
  if (![0, 1, 2, 3].includes(start.lifestyleTier)) errors.push('lifestyleTier must be 0, 1, 2 or 3');
  if (!Array.isArray(start.debts)) {
    errors.push('debts must be a list');
    return errors;
  }
  start.debts.forEach((debt, i) => {
    if (!DEBT_KINDS.includes(debt.kind)) errors.push(`debt ${i} has an unknown kind`);
    if (!isWhole(debt.principal) || debt.principal <= 0) errors.push(`debt ${i} needs a positive whole principal`);
    if (!notNegative(debt.fixedRateBp) || !isWhole(debt.roundsLeft) || debt.roundsLeft < 0) {
      errors.push(`debt ${i} needs a non-negative rate and term`);
    }
  });
  if (start.life !== undefined) errors.push(...lifeStartErrors(content, start));
  return errors;
}

function lifeStartErrors(content: Content, start: StartConfig): string[] {
  const life = start.life as unknown;
  if (!isRecord(life)) return ['life must be a record'];
  const errors: string[] = [];

  if (!idAllowed(life.lifeId)) errors.push(`life.lifeId ${JSON.stringify(life.lifeId)} is not allowed`);
  if (life.career !== null) {
    const job = isRecord(life.career) ? life.career : {};
    const career = content.careers.find((x) => x.id === job.id);
    if (!career) errors.push(`life.career is unknown: ${String(job.id)}`);
    else if (!isCount(job.level) || job.level >= career.levels.length) {
      errors.push(`life.career level ${String(job.level)} does not exist in ${career.id}`);
    }
  }
  if (!isCount(life.careerSkill)) errors.push('life.careerSkill must be a whole, non-negative number');
  if (![0, 1, 2].includes(life.financeSkill as number)) errors.push('life.financeSkill must be 0, 1 or 2');
  if (!(isWhole(life.focus) && life.focus >= 1 && life.focus <= 10)) errors.push('life.focus must be a whole number from 1 to 10');
  if (life.minLifestyleTier !== undefined) {
    const floor = life.minLifestyleTier as number;
    if (![0, 1, 2, 3].includes(floor) || floor > start.lifestyleTier) {
      errors.push('life.minLifestyleTier must be 0, 1, 2 or 3 and no higher than lifestyleTier');
    }
  }
  if (life.rentTier !== undefined && life.rentTier !== 0 && life.rentTier !== 1) errors.push('life.rentTier must be 0 or 1');

  const list = (x: unknown): unknown[] => (Array.isArray(x) ? x : []);
  list(life.properties).forEach((home, i) => {
    const entry = isRecord(home) ? home : {};
    if (!content.propertyTypes.some((t) => t.id === entry.typeId)) {
      errors.push(`life property ${i} has an unknown type: ${String(entry.typeId)}`);
    }
    if (typeof entry.rented !== 'boolean') errors.push(`life property ${i} needs rented to be true or false`);
  });
  list(life.recurring).forEach((entry, i) => {
    if (!isRecurring(entry)) errors.push(`life recurring entry ${i} is not valid`);
  });
  for (const flag of list(life.flags)) {
    if (!idAllowed(flag)) errors.push(`life flag ${JSON.stringify(flag)} is not allowed`);
  }
  return errors;
}
