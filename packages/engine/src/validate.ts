import type { Content } from './types';

type Transitions = Record<string, ReadonlyArray<readonly [string, number]>>;

/** Returns a list of problems. An empty list means the content is usable. */
export function validateContent(c: Content): string[] {
  const errors: string[] = [];

  const checkUnique = (ids: string[], what: string) => {
    const seen = new Set<string>();
    for (const id of ids) {
      if (seen.has(id)) errors.push(`duplicate ${what} id: ${id}`);
      seen.add(id);
    }
  };

  const checkTransitions = (name: string, table: Transitions) => {
    for (const from of Object.keys(table)) {
      let total = 0;
      for (const [, weight] of table[from]) total += weight;
      if (total <= 0) errors.push(`${name} transitions from ${from} have no weight`);
    }
  };

  if (!Number.isInteger(c.rounds) || c.rounds < 1) errors.push('rounds must be a positive integer');
  if (!Number.isInteger(c.yearsPerRound) || c.yearsPerRound < 1) errors.push('yearsPerRound must be a positive integer');
  if (c.cities.length === 0) errors.push('at least one city is required');

  checkUnique(c.assets.map((a) => a.id), 'asset');
  checkUnique(c.cities.map((x) => x.id), 'city');
  checkUnique(c.propertyTypes.map((x) => x.id), 'property type');

  for (const a of c.assets) {
    if (a.class === 'bond' && (a.durationYears === undefined || a.yieldSpreadBp === undefined)) {
      errors.push(`bond ${a.id} needs durationYears and yieldSpreadBp`);
    }
  }
  if (!c.assets.some((a) => a.id === c.pensionAssetId)) {
    errors.push(`pensionAssetId ${c.pensionAssetId} is not an asset`);
  }

  checkTransitions('regime', c.market.regimeTransitions);
  checkTransitions('crypto', c.market.cryptoTransitions);

  for (const city of c.cities) {
    const rates = [...city.tax.incomeRatesBp, city.tax.capitalGainsBp, city.tax.dividendBp, city.tax.rentBp];
    if (rates.some((r) => r < 0 || r > 10_000)) errors.push(`city ${city.id} has a tax rate outside 0..10000 bp`);
  }

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
