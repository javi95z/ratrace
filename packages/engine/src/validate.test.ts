import { describe, expect, it } from 'vitest';
import { fixtureContent } from './testing/fixture';
import { validateContent } from './validate';

describe('validateContent', () => {
  it('accepts the fixture', () => {
    expect(validateContent(fixtureContent())).toEqual([]);
  });

  it('reports duplicate ids', () => {
    const c = fixtureContent();
    expect(validateContent({ ...c, assets: [...c.assets, c.assets[0]] })).toContain('duplicate asset id: bond_long');
    expect(validateContent({ ...c, cities: [...c.cities, c.cities[0]] })).toContain('duplicate city id: home');
  });

  it('reports a bond without duration', () => {
    const c = fixtureContent();
    const broken = { ...c, assets: [...c.assets, { id: 'b', class: 'bond' as const, betaPct: 100, idioVolBp: 0, yieldBp: 0 }] };
    expect(validateContent(broken)).toContain('bond b needs durationYears and yieldSpreadBp');
  });

  it('reports an unknown pension asset', () => {
    expect(validateContent({ ...fixtureContent(), pensionAssetId: 'nope' })).toContain('pensionAssetId nope is not an asset');
  });

  it('reports a transition row with no weight', () => {
    const c = fixtureContent();
    const market = { ...c.market, regimeTransitions: { ...c.market.regimeTransitions, boom: [] } };
    expect(validateContent({ ...c, market })).toContain('regime transitions from boom have no weight');
  });

  it('reports wealth breakpoints that do not increase', () => {
    const c = fixtureContent();
    const scoring = { ...c.scoring, wealthBreakpoints: [[0, 0], [0, 100]] as const };
    expect(validateContent({ ...c, scoring })).toContain('wealth breakpoints must be strictly increasing');
  });

  it('reports a tax rate out of range and a game with no cities or rounds', () => {
    const c = fixtureContent();
    const city = { ...c.cities[0], tax: { ...c.cities[0].tax, capitalGainsBp: 12_000 } };
    expect(validateContent({ ...c, cities: [city] })).toContain('city home has a tax rate outside 0..10000 bp');
    expect(validateContent({ ...c, cities: [] })).toContain('at least one city is required');
    expect(validateContent({ ...c, rounds: 0 })).toContain('rounds must be a positive integer');
  });
});
