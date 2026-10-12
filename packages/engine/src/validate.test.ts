import { describe, expect, it } from 'vitest';
import { fixtureContent, fixtureStart } from './testing/fixture';
import { validateContent, validateStart } from './validate';

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

  it('reports transition tables with missing rows, unknown targets or bad weights', () => {
    const c = fixtureContent();
    const without = Object.fromEntries(
      Object.entries(c.market.regimeTransitions).filter(([from]) => from !== 'boom'),
    ) as typeof c.market.regimeTransitions;
    expect(validateContent({ ...c, market: { ...c.market, regimeTransitions: without } })).toContain(
      'regime transitions are missing a row for boom',
    );

    const astray = JSON.parse(JSON.stringify(c.market.cryptoTransitions));
    astray.bull = [['mars', 1]];
    expect(validateContent({ ...c, market: { ...c.market, cryptoTransitions: astray } })).toContain(
      'crypto transitions from bull point at unknown state mars',
    );

    const negative = { ...c.market.regimeTransitions, boom: [['boom', -1], ['slowdown', 5]] as const };
    expect(validateContent({ ...c, market: { ...c.market, regimeTransitions: negative } })).toContain(
      'regime transitions from boom have a negative or non-finite weight',
    );
  });

  it('reports ids that are unsafe as object keys', () => {
    const c = fixtureContent();
    const asset = (id: string) => ({ id, class: 'equity' as const, betaPct: 100, idioVolBp: 0, yieldBp: 0 });
    for (const id of ['__proto__', 'constructor', '', 'Bad Id', '9lives']) {
      expect(validateContent({ ...c, assets: [...c.assets, asset(id)] })).toContain(`asset id ${JSON.stringify(id)} is not allowed`);
    }
    expect(validateContent({ ...c, cities: [{ ...c.cities[0], id: 'toString' }] })).toContain('city id "toString" is not allowed');
    expect(validateContent({ ...c, propertyTypes: [{ id: 'constructor', pricePct: 100, status: 0 }] })).toContain(
      'property type id "constructor" is not allowed',
    );
  });

  it('reports numbers out of range', () => {
    const c = fixtureContent();
    const errors = (over: Partial<typeof c>) => validateContent({ ...c, ...over });
    expect(errors({ lifestyleMultiplierPct: [70, 0, 140, 200] })).toContain('lifestyleMultiplierPct must be four positive integers');
    expect(errors({ housingSharePct: 120 })).toContain('housingSharePct must be between 0 and 100');
    expect(errors({ maxOrdersPerRound: 0 })).toContain('maxOrdersPerRound must be a positive integer');
    expect(errors({ pensionContributionCapBp: -1 })).toContain('pensionContributionCapBp must be between 0 and 10000');
    expect(errors({ market: { ...c.market, recessionWinterChancePct: 101 } })).toContain(
      'market.recessionWinterChancePct must be between 0 and 100',
    );
    expect(errors({ debt: { ...c.debt, mortgageMaxLtvBp: 12_000 } })).toContain('debt.mortgageMaxLtvBp must be between 0 and 10000');
    expect(errors({ debt: { ...c.debt, fireSaleDiscountBp: -5 } })).toContain('debt.fireSaleDiscountBp must be between 0 and 10000');
    expect(errors({ debt: { ...c.debt, mortgageTermRounds: 0 } })).toContain('debt terms must be positive integers');
    expect(errors({ debt: { ...c.debt, creditCardRateBp: -1 } })).toContain('debt rates, spreads and limits must not be negative');
    expect(errors({ cities: [{ ...c.cities[0], livingCostAnnual: 0 }] })).toContain(
      'city home needs a positive salary, living cost and flat price',
    );
    expect(errors({ assets: [...c.assets, { id: 'wild', class: 'crypto', betaPct: 100, idioVolBp: 0, yieldBp: 0, crashChancePct: 150 }] })).toContain(
      'asset wild has a crash chance outside 0..100',
    );
    expect(errors({ assets: [...c.assets, { id: 'odd', class: 'equity', betaPct: 100, idioVolBp: -1, yieldBp: 0 }] })).toContain(
      'asset odd has a negative volatility or yield',
    );
    expect(errors({ propertyTypes: [{ id: 'shed', pricePct: 0, status: 0 }] })).toContain('property type shed needs a positive price percentage');
    expect(errors({ assets: [...c.assets, { id: 'adrift', class: 'equity', betaPct: 100, idioVolBp: 0, yieldBp: 0, driftBp: NaN }] })).toContain(
      'asset adrift has a drift that is not a whole number',
    );
  });
});

describe('validateStart', () => {
  const content = fixtureContent();

  it('accepts the fixture start', () => {
    expect(validateStart(content, fixtureStart())).toEqual([]);
    expect(
      validateStart(content, { ...fixtureStart(), debts: [{ kind: 'personalLoan', principal: 900_000, fixedRateBp: 600, roundsLeft: 3 }] }),
    ).toEqual([]);
  });

  it('reports every problem with a start', () => {
    const bad = JSON.parse(JSON.stringify(fixtureStart()));
    bad.cityId = 'atlantis';
    bad.cash = -1;
    bad.salaryAnnual = 12.5;
    bad.lifestyleTier = 4;
    bad.debts = [
      { kind: 'bribe', principal: 100, fixedRateBp: 0, roundsLeft: 1 },
      { kind: 'personalLoan', principal: 0, fixedRateBp: 0, roundsLeft: 1 },
      { kind: 'personalLoan', principal: 100, fixedRateBp: -1, roundsLeft: 1 },
    ];
    expect(validateStart(content, bad)).toEqual([
      'unknown city: atlantis',
      'cash must be a non-negative whole number of cents',
      'salaryAnnual must be a non-negative whole number of cents',
      'lifestyleTier must be 0, 1, 2 or 3',
      'debt 0 has an unknown kind',
      'debt 1 needs a positive whole principal',
      'debt 2 needs a non-negative rate and term',
    ]);
  });
});
