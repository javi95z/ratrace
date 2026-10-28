import { idAllowed, isCount, isFiniteNumber, isRecord, isRecurring, isWhole, notNegative, within } from './checks';
import { validateCards } from './life/cardRules';
import { INSURANCE_KINDS } from './life/derive';
import { ITEM_PERKS, SKILLS } from './types';
import type { Content, CryptoPhase, DebtKind, Regime, StartConfig } from './types';

type Transitions = Record<string, ReadonlyArray<readonly [string, number]>>;

const REGIMES: readonly Regime[] = ['expansion', 'boom', 'slowdown', 'recession', 'recovery'];
const PHASES: readonly CryptoPhase[] = ['accumulation', 'bull', 'mania', 'winter'];
export const DEBT_KINDS: readonly DebtKind[] = ['mortgageFixed', 'mortgageVariable', 'personalLoan', 'creditCard', 'margin'];

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
  if (c.luxuryIncomePct !== undefined && (!isWhole(c.luxuryIncomePct) || c.luxuryIncomePct < 0 || c.luxuryIncomePct > 100)) {
    errors.push('luxuryIncomePct must be a whole number from 0 to 100');
  }
  if (!within(c.housingSharePct, 0, 100)) errors.push('housingSharePct must be between 0 and 100');
  if (!isWhole(c.maxOrdersPerRound) || c.maxOrdersPerRound < 1) errors.push('maxOrdersPerRound must be a positive integer');
  if (!within(c.pensionContributionCapBp, 0, 10_000)) errors.push('pensionContributionCapBp must be between 0 and 10000');
  if (!within(c.pensionEarlyPenaltyBp, 0, 10_000)) errors.push('pensionEarlyPenaltyBp must be between 0 and 10000');

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
  if (!within(c.market.depositEscapePct, 0, 100)) {
    errors.push('market.depositEscapePct must be between 0 and 100');
  }
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
    // Distances, when given, are to other cities only, whole and positive, and the same both ways.
    for (const [other, km] of Object.entries(city.distanceKm ?? {})) {
      const there = c.cities.find((x) => x.id === other);
      if (!there || other === city.id) errors.push(`city ${city.id} has a distance to ${other}, which is not another city`);
      else if (!(isWhole(km) && km > 0)) errors.push(`city ${city.id} needs a whole, positive distance to ${other}`);
      else if (there.distanceKm !== undefined && there.distanceKm[city.id] !== km) errors.push(`city ${city.id} and ${other} disagree on how far apart they are`);
    }
    if (city.residency !== undefined && !(isCount(city.residency.feeAnnual) && isCount(city.residency.dividendBp) && city.residency.dividendBp <= 10_000)) errors.push(`city ${city.id} offers a residency without a fee and a rate`);
    const rates = [...city.tax.incomeRatesBp, city.tax.capitalGainsBp, city.tax.dividendBp, city.tax.rentBp];
    if (rates.some((r) => !within(r, 0, 10_000))) errors.push(`city ${city.id} has a tax rate outside 0..10000 bp`);
    const sizes = [city.medianSalaryAnnual, city.livingCostAnnual, city.flatPrice];
    if (sizes.some((x) => !isWhole(x) || x <= 0)) {
      errors.push(`city ${city.id} needs a positive salary, living cost and flat price`);
    }
    if (!isCount(city.prestige)) errors.push(`city ${city.id} needs a whole, non-negative prestige`);
    if (city.taxOfficePct !== undefined && !(isCount(city.taxOfficePct) && city.taxOfficePct <= 300)) errors.push(`city ${city.id} needs a tax office of 0 to 300 percent`);
    if (city.careerPayPct !== undefined) {
      if (!isRecord(city.careerPayPct)) errors.push(`city ${city.id} needs its career pay as a record`);
      else {
        for (const [career, pct] of Object.entries(city.careerPayPct)) {
          if (!c.careers.some((x) => x.id === career)) errors.push(`city ${city.id} pays for an unknown career: ${career}`);
          if (!(isWhole(pct) && pct > 0)) errors.push(`city ${city.id} needs a whole, positive pay percentage for ${career}`);
        }
      }
    }
    if (city.propertyRentPct !== undefined) {
      if (!isRecord(city.propertyRentPct)) errors.push(`city ${city.id} needs its property rents as a record`);
      else {
        for (const [type, pct] of Object.entries(city.propertyRentPct)) {
          if (!c.propertyTypes.some((x) => x.id === type)) errors.push(`city ${city.id} lets an unknown kind of property: ${type}`);
          if (!(isWhole(pct) && pct > 0)) errors.push(`city ${city.id} needs a whole, positive rent percentage for ${type}`);
        }
      }
    }
  }

  for (const type of c.propertyTypes) {
    if (!(typeof type.pricePct === 'number' && Number.isFinite(type.pricePct) && type.pricePct > 0)) {
      errors.push(`property type ${type.id} needs a positive price percentage`);
    }
    if (!isCount(type.status)) errors.push(`property type ${type.id} needs a whole, non-negative status`);
    if (type.rentalOnly === true && type.status !== 0) errors.push(`property type ${type.id} cannot be lived in, so it gives no status`);
    if (type.rentPct !== undefined && !(isCount(type.rentPct) && type.rentPct > 0)) errors.push(`property type ${type.id} needs a whole, positive rent percentage`);
    for (const field of ['cities', 'notIn'] as const) {
      const ids = type[field];
      if (ids === undefined) continue;
      if (!Array.isArray(ids) || ids.length === 0) errors.push(`property type ${type.id} needs ${field} as a list of cities, or none`);
      else for (const id of ids) if (!c.cities.some((city) => city.id === id)) errors.push(`property type ${type.id} names an unknown city in ${field}: ${String(id)}`);
    }
    // Sold somewhere: a kind no city sells is a mistake, not a rule.
    if (!c.cities.some((city) => (type.cities === undefined || type.cities.includes(city.id)) && !(type.notIn ?? []).includes(city.id))) errors.push(`property type ${type.id} is sold in no city`);
  }

  const business = c.business;
  if (!(isWhole(business.maxBusinesses) && business.maxBusinesses >= 1)) errors.push('business.maxBusinesses must be a positive whole number');
  if (!Array.isArray(business.payouts) || business.payouts.length === 0 || business.payouts.some((share, i) => !isCount(share) || share > 100 || (i > 0 && share <= business.payouts[i - 1]))) {
    errors.push('business.payouts must be whole percentages from 0 to 100, rising');
  }
  if (!Array.isArray(business.rampPct) || business.rampPct.some((pct) => !(isCount(pct) && pct <= 100))) errors.push('business.rampPct must be whole percentages up to 100');
  if (!isCount(business.managementFailOffPct) || !(isCount(business.failRecoverPct) && business.failRecoverPct <= 100)) errors.push('business needs whole numbers for the management off a failure and what a failure gives back');
  for (const type of business.types ?? []) if (!(isCount(type.failPct) && type.failPct <= 100)) errors.push(`business type ${type.id} needs a chance of failing from 0 to 100`);
  if (!within(business.neglectProfitPct, 0, 100) || !within(business.neglectDecayBp, 0, 10_000)) errors.push('business neglect must take a share of the profit and of the capital, no more than all of either');
  for (const regime of REGIMES) {
    // Above 100, a business could be opened and sold in one round for a profit, all day.
    if (!(isCount(business.salePct[regime]) && business.salePct[regime] <= 100)) errors.push(`business.salePct needs a whole percentage up to 100 for ${regime}`);
  }
  for (const type of business.types) {
    if (!idAllowed(type.id)) errors.push(`business type has an id that is not allowed: ${JSON.stringify(type.id)}`);
    if (!(isWhole(type.minCapital) && type.minCapital > 0 && isWhole(type.scale) && type.scale > 0)) errors.push(`business ${type.id} needs a positive whole least capital and scale`);
    if (!(isCount(type.yieldBp) && isCount(type.managerPct) && type.managerPct <= 100)) errors.push(`business ${type.id} needs a whole yield and a manager's share up to 100`);
    if (![0, 1, 2, 3].includes(type.minFinanceSkill as number)) errors.push(`business ${type.id} needs a finance skill of 0, 1, 2 or 3`);
    if (type.careers !== undefined && (!Array.isArray(type.careers) || type.careers.length === 0 || type.careers.some((id) => !c.careers.some((career) => career.id === id)))) errors.push(`business ${type.id} names careers that do not exist`);
    for (const [regime, pct] of Object.entries(type.cyclePct)) {
      if (!(REGIMES as readonly string[]).includes(regime) || !isWhole(pct)) errors.push(`business ${type.id} has a swing that is not a whole percentage for a known state of the economy`);
    }
  }
  if (new Set(business.types.map((type) => type.id)).size !== business.types.length) errors.push('two business types have the same id');
  for (const career of c.careers) {
    if (!notNegative(career.overtimePct)) errors.push(`career ${career.id} has a negative overtime percentage`);
    if (career.focus !== undefined && !isCount(career.focus)) errors.push(`career ${career.id} needs a whole, non-negative focus`);
    if (career.cyclePct !== undefined) {
      for (const [regime, pct] of Object.entries(career.cyclePct)) {
        if (!(REGIMES as readonly string[]).includes(regime) || !isWhole(pct) || pct < -100) errors.push(`career ${career.id} has a swing that is not a whole percentage for a known state of the economy`);
      }
    }
    if (career.fade !== undefined) {
      const { fromRound, pctPerRound, maxPct } = career.fade;
      if (!isCount(fromRound) || !isCount(pctPerRound) || !isCount(maxPct) || maxPct > 100) errors.push(`career ${career.id} needs a fade of whole rounds and percentages, at most 100 in all`);
    }
    if (career.levels.length === 0) {
      errors.push(`career ${career.id} needs at least one level`);
      continue;
    }
    if (career.levels[0].minSkill !== 0) errors.push(`career ${career.id} must start at skill 0`);
    const moveIds = new Set<string>();
    for (const move of career.moves ?? []) {
      const name = `career ${career.id} move ${move.id}`;
      if (moveIds.has(move.id)) errors.push(`${name} is named twice`);
      moveIds.add(move.id);
      if (!isCount(move.fromLevel) || !isCount(move.toLevel) || move.fromLevel > move.toLevel || move.toLevel >= career.levels.length) errors.push(`${name} needs rungs of its ladder, the first not after the last`);
      if (!isCount(move.rounds) || move.rounds < 1 || !isCount(move.restRounds)) errors.push(`${name} needs at least a round, and whole rounds of rest`);
      if (move.outcomes.length === 0 || move.outcomes.some((outcome) => !isCount(outcome.weight)) || move.outcomes.every((outcome) => outcome.weight === 0)) errors.push(`${name} needs outcomes of whole, non-negative weights, not all nothing`);
      for (const { result } of move.outcomes) {
        if ((result.rungs !== undefined && !isCount(result.rungs)) || (result.passiveAnnual !== undefined && !isCount(result.passiveAnnual))) errors.push(`${name} has an outcome of rungs or income that is not a whole, non-negative number`);
        for (const figure of [result.status, result.salaryPct, result.health]) if (figure !== undefined && !isWhole(figure)) errors.push(`${name} has an outcome that is not whole`);
      }
      if ((move.skill === undefined) !== (move.pctPerSkillLevel === undefined) || (move.pctPerSkillLevel !== undefined && !isCount(move.pctPerSkillLevel))) errors.push(`${name} needs a skill and its weight together`);
    }
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
    // Never above 100: an item worth more than it cost the moment it is bought could be bought and sold for a profit all day.
    if (!within(item.resaleStartPct, 0, 100)) errors.push(`item ${item.id} has a resale percentage outside 0..100`);
    if (!isWhole(item.resaleDriftBp) || item.resaleDriftBp <= -10_000) {
      errors.push(`item ${item.id} has a resale drift that is not a whole number above -10000`);
    }
    if (item.kind === 'experience' && !(isWhole(item.boostRounds) && item.boostRounds >= 1)) {
      errors.push(`experience ${item.id} needs at least one round of boost`);
    }
    if (item.perks !== undefined) {
      if (!isRecord(item.perks) || Object.keys(item.perks).some((key) => !(ITEM_PERKS as readonly string[]).includes(key))) errors.push(`item ${item.id} has a perk the game does not know`);
      else if (Object.values(item.perks).some((value) => !isCount(value) || value > 100)) errors.push(`item ${item.id} needs each perk to be a whole number from 0 to 100`);
    }
    if (item.cities !== undefined) {
      if (!Array.isArray(item.cities) || item.cities.length === 0) errors.push(`item ${item.id} needs at least one city, or none at all`);
      else for (const cityId of item.cities) if (!c.cities.some((city) => city.id === cityId)) errors.push(`item ${item.id} names an unknown city: ${String(cityId)}`);
    }
  }

  const life = c.life as unknown as Record<string, unknown>;
  for (const field of ['childCostPct', 'partnerCostPct', 'moveCostPct', 'workSkill', 'studySkill', 'jobHuntRaisePct', 'cheapMortgageBp', 'teaseStatus', 'teasedStatus', 'familyTimeStatus', 'restHealthPoints']) {
    if (!isCount(life[field])) errors.push(`life.${field} must be a whole, non-negative number`);
  }
  if (typeof life.dealOnlyChoices !== 'boolean') errors.push('life.dealOnlyChoices must be true or false');
  const abroad = isRecord(life.remoteAbroad) ? life.remoteAbroad : {};
  if (!(isCount(abroad.payPct) && abroad.payPct <= 100)) errors.push('life.remoteAbroad.payPct must be a whole number from 0 to 100');
  if (!(isCount(abroad.capPct) && abroad.capPct > 0)) errors.push('life.remoteAbroad.capPct must be a positive whole number');
  const modes = isRecord(life.workModes) ? life.workModes : {};
  for (const mode of ['remote', 'partTime']) {
    const rule = isRecord(modes[mode]) ? modes[mode] : {};
    if (!isCount(rule.focus)) errors.push(`life.workModes.${mode}.focus must be a whole, non-negative number`);
    for (const field of ['payPct', 'jobStatusPct']) if (!(isCount(rule[field]) && (rule[field] as number) <= 100)) errors.push(`life.workModes.${mode}.${field} must be a whole number from 0 to 100`);
    if (typeof rule.workSkill !== 'boolean') errors.push(`life.workModes.${mode}.workSkill must be true or false`);
    if (!isCount(rule.fromLevel)) errors.push(`life.workModes.${mode}.fromLevel must be a whole, non-negative number`);
    if (!(isCount(rule.huntOffPct) && (rule.huntOffPct as number) <= 100)) errors.push(`life.workModes.${mode}.huntOffPct must be a whole number from 0 to 100`);
  }
  const fullTime = isRecord(life.fullTime) ? life.fullTime : {};
  for (const field of ['strongPct', 'profitPct', 'strongRounds', 'focus', 'rungsLost']) if (!isCount(fullTime[field])) errors.push(`life.fullTime.${field} must be a whole, non-negative number`);
  if (!Array.isArray(fullTime.status) || fullTime.status.length === 0 || fullTime.status.some((step) => !Array.isArray(step) || !isCount(step[0]) || !isCount(step[1]))) errors.push('life.fullTime.status must be steps of capital and status');
  const lodger = isRecord(life.lodger) ? life.lodger : {};
  if (!(isCount(lodger.rentPct) && (lodger.rentPct as number) <= 100) || !isCount(lodger.statusLost)) errors.push('life.lodger needs a share of the rent from 0 to 100 and the status lost');
  const homecoming = isRecord(life.homecoming) ? life.homecoming : {};
  for (const field of ['helpBelowWorth', 'helpPct', 'networkPoints', 'status']) if (!isCount(homecoming[field])) errors.push(`life.homecoming.${field} must be a whole, non-negative number`);
  const raise = isRecord(life.raise) ? life.raise : {};
  for (const field of ['chancePct', 'perNegotiationPct', 'pct']) if (!(isCount(raise[field]) && (raise[field] as number) <= 100)) errors.push(`life.raise.${field} must be a whole number from 0 to 100`);
  if (!(isWhole(raise.restRounds) && (raise.restRounds as number) >= 1)) errors.push('life.raise.restRounds must be a whole number from 1 up');
  const limits = isRecord(life.focusLimits) ? life.focusLimits : {};
  for (const field of ['overtimeTiredFrom', 'overtimeBurnoutFrom', 'huntRestRounds', 'studyPerRung', 'overtimeHealthPoints', 'burnoutHealthPoints', 'burnoutFocus']) {
    if (!isCount(limits[field])) errors.push(`life.focusLimits.${field} must be a whole, non-negative number`);
  }
  for (const field of ['burnoutChancePct', 'huntMissPct', 'huntFloorPct']) {
    if (!(isCount(limits[field]) && (limits[field] as number) <= 100)) errors.push(`life.focusLimits.${field} must be a whole number from 0 to 100`);
  }
  if (isCount(limits.overtimeTiredFrom) && isCount(limits.overtimeBurnoutFrom) && limits.overtimeBurnoutFrom < limits.overtimeTiredFrom) errors.push('life.focusLimits.overtimeBurnoutFrom must not come before overtimeTiredFrom');
  for (const field of ['childRounds']) {
    if (!(isWhole(life[field]) && life[field] >= 1)) errors.push(`life.${field} must be a positive whole number`);
  }
  for (const field of ['jobHuntChancePct', 'lesserItemPct']) {
    if (!within(life[field], 0, 100)) errors.push(`life.${field} must be between 0 and 100`);
  }
  if (life.moveDistancePctPer1000Km !== undefined && !isCount(life.moveDistancePctPer1000Km)) errors.push('life.moveDistancePctPer1000Km must be a whole number from 0');
  const estates = life.estates as { minStatus?: unknown; pct?: unknown; counted?: unknown } | undefined;
  if (estates !== undefined) {
    if (!isCount(estates.minStatus)) errors.push('life.estates.minStatus must be a whole number from 0');
    if (!within(estates.pct, 0, 100)) errors.push('life.estates.pct must be between 0 and 100');
    if (!(isWhole(estates.counted) && (estates.counted as number) >= 1)) errors.push('life.estates.counted must be a positive whole number');
  }
  for (const [ladder, rule] of Object.entries((life.lesserItems ?? {}) as Record<string, { pct?: unknown; counted?: unknown }>)) {
    if (!within(rule.pct, 0, 100)) errors.push(`life.lesserItems.${ladder}.pct must be between 0 and 100`);
    if (rule.counted !== undefined && !(isWhole(rule.counted) && (rule.counted as number) >= 1)) errors.push(`life.lesserItems.${ladder}.counted must be a positive whole number`);
  }
  // It is added to a whole-number percentage of pay, so it must be whole too.
  if (!(isCount(life.unstablePayPct) && life.unstablePayPct <= 100)) errors.push('life.unstablePayPct must be a whole number from 0 to 100');
  const listOf = (x: unknown, length: number, ok: (v: unknown) => boolean) => Array.isArray(x) && x.length === length && x.every(ok);
  if (!listOf(life.rentTierHousingPct, 2, (v) => within(v, 0, 100))) {
    errors.push('life.rentTierHousingPct must be two numbers between 0 and 100');
  }
  if (!listOf(life.rentTierStatus, 2, isCount)) errors.push('life.rentTierStatus must be two whole, non-negative numbers');
  for (const field of ['movePartnerPct', 'moveChildPct', 'moveRungsLost', 'moveSettlingPayPct', 'partnerSettlingRounds'] as const) {
    if (!isCount(life[field])) errors.push(`life.${field} must be a whole, non-negative number`);
  }
  if (!Array.isArray(life.agingLadders) || life.agingLadders.some((ladder) => !c.items.some((item) => item.ladder === ladder))) errors.push('life.agingLadders must name ladders that exist');
  if (!(isCount(life.agingFloorPct) && life.agingFloorPct <= 100)) errors.push('life.agingFloorPct must be a whole number from 0 to 100');
  const aged = isRecord(life.agedStatus) ? life.agedStatus : {};
  const starts = { room: (life.rentTierStatus as unknown[] | undefined)?.[0], frugal: (life.lifestyleStatus as unknown[] | undefined)?.[0] };
  for (const kind of ['room', 'frugal'] as const) {
    const steps = aged[kind] as unknown;
    const ok =
      Array.isArray(steps) &&
      steps.length > 0 &&
      steps.every((step, i) => isRecord(step) && isCount(step.fromRound) && isWhole(step.status) && (i === 0 ? step.fromRound === 0 : step.fromRound > (steps[i - 1] as { fromRound: number }).fromRound && step.status <= (steps[i - 1] as { status: number }).status));
    if (!ok) errors.push(`life.agedStatus.${kind} must be steps from round 0, later and never better`);
    else if ((steps as Array<{ status: number }>)[0].status !== starts[kind]) errors.push(`life.agedStatus.${kind} must start at the status of the start`);
  }
  if (!listOf(life.lifestyleStatus, 4, isWhole)) errors.push('life.lifestyleStatus must be four whole numbers');
  // Steps of a share: from round 0 at 100, each later and never lower.
  const pctSteps = (steps: unknown) =>
    Array.isArray(steps) &&
    steps.length > 0 &&
    steps.every((step, i) => isRecord(step) && isCount(step.fromRound) && isWhole(step.pct) && (i === 0 ? step.fromRound === 0 && step.pct === 100 : step.fromRound > (steps[i - 1] as { fromRound: number }).fromRound && step.pct >= (steps[i - 1] as { pct: number }).pct));
  const risks = isRecord(life.riskByAge) ? life.riskByAge : {};
  for (const risk of ['health', 'job', 'scam'] as const) {
    if (!pctSteps(risks[risk])) errors.push(`life.riskByAge.${risk} must be steps from round 0 at 100, later and never lower`);
  }
  if (!pctSteps(life.healthPremiumByAge)) errors.push('life.healthPremiumByAge must be steps from round 0 at 100, later and never lower');
  if (!(isCount(life.retireFromRound) && (life.retireFromRound as number) < c.rounds)) errors.push('life.retireFromRound must be a round of the game');
  for (const field of ['retiredFocus', 'retiredStatus'] as const) {
    if (!isCount(life[field])) errors.push(`life.${field} must be a whole, non-negative number`);
  }
  if (!(isCount(life.giftTaxPct) && (life.giftTaxPct as number) <= 100)) errors.push('life.giftTaxPct must be a whole number from 0 to 100');
  if (!(isCount(life.itemFinanceDownPct) && life.itemFinanceDownPct <= 100)) errors.push('life.itemFinanceDownPct must be a whole number from 0 to 100');
  if (!isCount(life.itemFinanceMinPrice)) errors.push('life.itemFinanceMinPrice must be a whole, non-negative amount');
  for (const kind of INSURANCE_KINDS) {
    const premiums = life.insurancePremiumBp;
    if (!isRecord(premiums) || !isCount(premiums[kind])) {
      errors.push(`life.insurancePremiumBp needs a whole, non-negative number for ${kind}`);
    }
  }
  if (![0, 1, 2].includes(life.rentOutMinFinanceSkill as number)) errors.push('life.rentOutMinFinanceSkill must be 0, 1 or 2');
  const evasion = c.evasion as unknown as Record<string, unknown>;
  if (!isRecord(evasion)) errors.push('evasion must be a record');
  else {
    const shares = evasion.blackPcts as unknown;
    if (!(Array.isArray(shares) && shares[0] === 0 && shares.every((x, i) => isWhole(x) && x >= 0 && x < 100 && (i === 0 || x > shares[i - 1])))) {
      errors.push('evasion.blackPcts must start at 0 and rise in whole percentages below 100');
    }
    for (const field of ['blackSuspicionPer100', 'shellFeeAnnual', 'shellSuspicion', 'cryptoSuspicion', 'cryptoReportRound', 'noInvoiceSaleSuspicion', 'suspicionDecay', 'limitationRounds']) {
      if (!isCount(evasion[field])) errors.push(`evasion.${field} must be a whole, non-negative number`);
    }
    for (const field of ['shellTaxCutPct', 'noInvoiceDiscountPct', 'auditMaxPct', 'auditGoodsPct']) {
      if (!(isWhole(evasion[field]) && within(evasion[field], 0, 100))) errors.push(`evasion.${field} must be a whole number from 0 to 100`);
    }
    if (!isCount(evasion.auditFinePct)) errors.push('evasion.auditFinePct must be a whole, non-negative number');
    if (!(isWhole(evasion.auditStatus) && (evasion.auditStatus as number) <= 0)) errors.push('evasion.auditStatus must be a whole number, zero or less');
    if (![0, 1, 2, 3].includes(evasion.shellMinFinanceSkill as number)) errors.push('evasion.shellMinFinanceSkill must be 0, 1, 2 or 3');
    for (const ladder of Array.isArray(evasion.noInvoiceLadders) ? evasion.noInvoiceLadders : [null]) {
      const things = c.items.filter((item) => item.ladder === ladder);
      if (things.length === 0 || things.some((item) => item.kind !== 'durable')) errors.push(`evasion.noInvoiceLadders names a ladder that is not one of durables: ${String(ladder)}`);
    }
  }
  const used = life.used;
  if (!isRecord(used)) errors.push('life.used must be a record');
  else {
    for (const [ladder, rule] of Object.entries(used)) {
      const things = c.items.filter((item) => item.ladder === ladder);
      if (things.length === 0 || things.some((item) => item.kind !== 'durable')) errors.push(`life.used names a ladder that is not one of durables: ${ladder}`);
      const r = isRecord(rule) ? rule : {};
      if (!(isWhole(r.pricePct) && (r.pricePct as number) >= 1 && (r.pricePct as number) <= 99)) errors.push(`life.used.${ladder}.pricePct must be a whole number from 1 to 99`);
      if (!isCount(r.ageRounds)) errors.push(`life.used.${ladder}.ageRounds must be a whole, non-negative number`);
      if (!within(r.repairChancePct, 0, 100) || !isWhole(r.repairChancePct)) errors.push(`life.used.${ladder}.repairChancePct must be a whole number from 0 to 100`);
      if (!within(r.repairPct, 0, 100) || !isWhole(r.repairPct)) errors.push(`life.used.${ladder}.repairPct must be a whole number from 0 to 100`);
    }
  }
  const skills = life.skills;
  if (!isRecord(skills)) errors.push('life.skills must be a record');
  else {
    const steps = skills.levelPoints as unknown;
    if (!(Array.isArray(steps) && steps.length === 3 && steps.every((x, i) => isWhole(x) && x > (i === 0 ? 0 : steps[i - 1])))) {
      errors.push('life.skills.levelPoints must be three rising positive whole numbers');
    }
    for (const field of ['studyPoints', 'practicePoints', 'investingPoints', 'negotiationHuntRaisePct', 'negotiationPromotionPct', 'negotiationSalePct', 'languagesMoveOffPct', 'languagesAbroadPayPct', 'managementPayPct', 'managementPayFromLevel', 'networkHuntPct', 'networkStatus', 'managementProfitPct', 'managementManagerOffPct', 'healthPremiumOffPct', 'healthRiskOffPct', 'jobRiskOffPct', 'scamRiskOffPct'] as const) {
      if (!(isWhole(skills[field]) && (skills[field] as number) >= 0)) errors.push(`life.skills.${field} must be a non-negative whole number`);
    }
    for (const field of ['languagesKeepRungFrom', 'languagesPartnerFrom', 'managementExtraFrom', 'healthFocusFrom'] as const) {
      if (![1, 2, 3].includes(skills[field] as number)) errors.push(`life.skills.${field} must be 1, 2 or 3`);
    }
    for (const [skill, things] of Object.entries(isRecord(skills.practiceItems) ? skills.practiceItems : {})) {
      if (!(SKILLS as readonly string[]).includes(skill)) errors.push(`life.skills.practiceItems names an unknown skill: ${skill}`);
      for (const id of Array.isArray(things) ? things : []) if (!c.items.some((item) => item.id === id)) errors.push(`life.skills.practiceItems names an unknown item: ${String(id)}`);
    }
    for (const [skill, careers] of Object.entries(isRecord(skills.practiceCareers) ? skills.practiceCareers : {})) {
      if (!(SKILLS as readonly string[]).includes(skill)) errors.push(`life.skills.practiceCareers names an unknown skill: ${skill}`);
      for (const id of Array.isArray(careers) ? careers : []) if (!c.careers.some((career) => career.id === id)) errors.push(`life.skills.practiceCareers names an unknown career: ${String(id)}`);
    }
  }

  const w = c.world;
  if (!(isWhole(w.headlinesPerRound) && w.headlinesPerRound >= 0 && w.headlinesPerRound <= 9)) {
    errors.push('world.headlinesPerRound must be a whole number from 0 to 9');
  }
  if (!isCount(w.noiseHeadlines)) errors.push('world.noiseHeadlines must be a whole, non-negative number');
  if (!isCount(w.governmentHeadlines)) errors.push('world.governmentHeadlines must be a whole, non-negative number');
  if (!within(w.newsTruthPct, 0, 100)) errors.push('world.newsTruthPct must be between 0 and 100');
  if (!isCount(w.flatBandBp)) errors.push('world.flatBandBp must be a whole, non-negative number');
  if (!within(w.taxReformChancePct, 0, 100)) errors.push('world.taxReformChancePct must be between 0 and 100');
  if (!within(w.crisisChancePct, 0, 100)) errors.push('world.crisisChancePct must be between 0 and 100');
  if (!isWhole(w.crisisEarliestRound) || w.crisisEarliestRound < 1) errors.push('world.crisisEarliestRound must be a whole number from 1 up');
  if (!Array.isArray(c.crises)) errors.push('crises must be a list');
  else {
    checkIds(c.crises.map((x) => x.id), 'crisis');
    for (const crisis of c.crises) {
      if (!(crisis.weight > 0)) errors.push(`crisis ${crisis.id} needs a positive weight`);
      if (!Array.isArray(crisis.phases) || crisis.phases.length === 0) errors.push(`crisis ${crisis.id} needs at least one round`);
      else if (w.crisisEarliestRound + crisis.phases.length > c.rounds) errors.push(`crisis ${crisis.id} does not fit in a life`);
      else {
        for (const phase of crisis.phases) {
          for (const key of ['rateBp', 'inflationBp', 'equityBp', 'cryptoBp', 'goldBp', 'propertyBp'] as const) {
            if (phase[key] !== undefined && !isWhole(phase[key])) errors.push(`crisis ${crisis.id} has a ${key} that is not a whole number`);
          }
        }
      }
    }
    if (w.crisisChancePct > 0 && c.crises.length === 0) errors.push('world.crisisChancePct is above zero but there is no crisis');
  }
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
  if (!isCount(d.bankruptcyStatusPenalty)) errors.push('debt.bankruptcyStatusPenalty must be a whole, non-negative number');
  if (!(isCount(d.marginMaxPct) && isCount(d.marginCallPct) && d.marginMaxPct < d.marginCallPct && d.marginCallPct < 100)) {
    errors.push('debt.marginMaxPct must be a whole percentage below debt.marginCallPct, itself below 100');
  }
  if (![0, 1, 2, 3].includes(d.marginMinFinanceSkill as number)) errors.push('debt.marginMinFinanceSkill must be 0, 1, 2 or 3');
  const amounts = [d.marginSpreadBp, d.personalLoanSpreadBp, d.mortgageSpreadBp, d.creditCardRateBp, d.personalLoanMaxIncomePct, d.bankruptcyIncomeMultiple];
  if (amounts.some((x) => !notNegative(x))) errors.push('debt rates, spreads and limits must not be negative');
  if (!isCount(c.debt.switchFeePct?.toFixed) || !isCount(c.debt.switchFeePct?.toVariable) || !isCount(c.debt.switchRestRounds)) errors.push('debt needs whole fees for switching a mortgage and the rounds before switching again');

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
  if (start.limits !== undefined) {
    const limits = start.limits as unknown as Record<string, unknown>;
    if (!isRecord(limits)) errors.push('limits must be a record');
    else {
      const only = limits.onlyAssets;
      if (only !== undefined && !(Array.isArray(only) && only.length > 0 && only.every((id) => content.assets.some((asset) => asset.id === id)))) errors.push('limits.onlyAssets must name assets that exist');
      if (limits.maxLifestyleTier !== undefined && ![0, 1, 2, 3].includes(limits.maxLifestyleTier as number)) errors.push('limits.maxLifestyleTier must be a tier from 0 to 3');
      for (const flag of ['noBorrowing', 'noMoving', 'noProperty', 'noBusiness', 'noItems', 'noEvasion']) {
        if (limits[flag] !== undefined && typeof limits[flag] !== 'boolean') errors.push(`limits.${flag} must be true or false`);
      }
      for (const key of Object.keys(limits)) if (!['onlyAssets', 'noBorrowing', 'noMoving', 'noProperty', 'noBusiness', 'maxLifestyleTier', 'noItems', 'noEvasion'].includes(key)) errors.push(`limits has an unknown limit: ${key}`);
    }
  }
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
  if (![0, 1, 2, 3].includes(life.financeSkill as number)) errors.push('life.financeSkill must be 0, 1, 2 or 3');
  if (life.skills !== undefined) {
    if (!isRecord(life.skills)) errors.push('life.skills must be a record');
    else {
      for (const [skill, points] of Object.entries(life.skills)) {
        if (!(SKILLS as readonly string[]).includes(skill)) errors.push(`life.skills names an unknown skill: ${skill}`);
        else if (!isCount(points)) errors.push(`life.skills.${skill} must be a whole, non-negative number`);
      }
    }
  }
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
    if (entry.rented === false && content.propertyTypes.some((t) => t.id === entry.typeId && t.rentalOnly === true)) {
      errors.push(`life property ${i} is a ${String(entry.typeId)}, which nobody can live in`);
    }
  });
  const held = new Set<unknown>();
  list(life.holdings).forEach((holding, i) => {
    const entry = isRecord(holding) ? holding : {};
    if (!content.assets.some((asset) => asset.id === entry.assetId)) errors.push(`life holding ${i} has an unknown asset: ${String(entry.assetId)}`);
    else if (held.has(entry.assetId)) errors.push(`life holding ${i} repeats an asset: ${String(entry.assetId)}`);
    held.add(entry.assetId);
    if (!isWhole(entry.value) || entry.value <= 0) errors.push(`life holding ${i} needs a positive whole value`);
  });
  const owned = list(life.businesses);
  if (owned.length > content.business.maxBusinesses) errors.push('life starts with more businesses than the rules allow');
  owned.forEach((business, i) => {
    const entry = isRecord(business) ? business : {};
    if (!content.business.types.some((type) => type.id === entry.typeId)) errors.push(`life business ${i} is of an unknown kind: ${String(entry.typeId)}`);
    if (!isWhole(entry.capital) || entry.capital <= 0) errors.push(`life business ${i} needs a positive whole capital`);
  });
  list(life.recurring).forEach((entry, i) => {
    if (!isRecurring(entry)) errors.push(`life recurring entry ${i} is not valid`);
  });
  for (const flag of list(life.flags)) {
    if (!idAllowed(flag)) errors.push(`life flag ${JSON.stringify(flag)} is not allowed`);
  }
  return errors;
}
