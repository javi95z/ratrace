import type { Content, CryptoPhase, DebtKind, Regime, StartConfig } from './types';

type Transitions = Record<string, ReadonlyArray<readonly [string, number]>>;

const REGIMES: readonly Regime[] = ['expansion', 'boom', 'slowdown', 'recession', 'recovery'];
const PHASES: readonly CryptoPhase[] = ['accumulation', 'bull', 'mania', 'winter'];
export const DEBT_KINDS: readonly DebtKind[] = ['mortgageFixed', 'mortgageVariable', 'personalLoan', 'creditCard'];

/** Ids become object keys in state, so they must be plain lower-case names and never a built-in property name. */
const SAFE_ID = /^[a-z][a-z0-9_]*$/;
const idAllowed = (id: unknown): boolean => typeof id === 'string' && SAFE_ID.test(id) && !(id in Object.prototype);

const isWhole = (x: unknown): x is number => typeof x === 'number' && Number.isSafeInteger(x);
const within = (x: unknown, lo: number, hi: number): boolean =>
  typeof x === 'number' && Number.isFinite(x) && x >= lo && x <= hi;
const notNegative = (x: unknown): boolean => typeof x === 'number' && Number.isFinite(x) && x >= 0;

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
    if (a.driftBp !== undefined && !Number.isFinite(a.driftBp)) errors.push(`asset ${a.id} has a drift that is not a finite number`);
  }
  if (!c.assets.some((a) => a.id === c.pensionAssetId)) {
    errors.push(`pensionAssetId ${c.pensionAssetId} is not an asset`);
  }

  checkTransitions('regime', REGIMES, c.market.regimeTransitions);
  checkTransitions('crypto', PHASES, c.market.cryptoTransitions);
  if (!within(c.market.recessionWinterChancePct, 0, 100)) {
    errors.push('market.recessionWinterChancePct must be between 0 and 100');
  }

  for (const city of c.cities) {
    const rates = [...city.tax.incomeRatesBp, city.tax.capitalGainsBp, city.tax.dividendBp, city.tax.rentBp];
    if (rates.some((r) => !within(r, 0, 10_000))) errors.push(`city ${city.id} has a tax rate outside 0..10000 bp`);
    const sizes = [city.medianSalaryAnnual, city.livingCostAnnual, city.flatPrice];
    if (sizes.some((x) => !isWhole(x) || x <= 0)) {
      errors.push(`city ${city.id} needs a positive salary, living cost and flat price`);
    }
  }

  for (const type of c.propertyTypes) {
    if (!(typeof type.pricePct === 'number' && Number.isFinite(type.pricePct) && type.pricePct > 0)) {
      errors.push(`property type ${type.id} needs a positive price percentage`);
    }
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
  return errors;
}
