import { describe, expect, it } from 'vitest';
import { fixtureContent, fixtureStart } from '../testing/fixture';
import type { Content, LifeStart } from '../types';
import { validateContent, validateStart } from '../validate';

const errors = (over: Partial<Content>) => validateContent({ ...fixtureContent(), ...over });
const c = fixtureContent();

describe('validateContent: life data', () => {
  it('accepts the fixture', () => {
    expect(validateContent(fixtureContent())).toEqual([]);
  });

  it('checks the cities an item is sold in', () => {
    const item = c.items[0];
    expect(errors({ items: [{ ...item, cities: [] }] })).toContain(`item ${item.id} needs at least one city, or none at all`);
    expect(errors({ items: [{ ...item, cities: ['atlantis'] }] })).toContain(`item ${item.id} names an unknown city: atlantis`);
    expect(errors({ items: [{ ...item, cities: [c.cities[0].id] }] })).toEqual([]);
  });

  it('checks crises, and the cards that wait for one', () => {
    const crisis = { id: 'crash', weight: 1, phases: [{ equityBp: -500 }, {}] };
    const world = { ...c.world, crisisChancePct: 50 };
    expect(errors({ crises: [crisis], world })).toEqual([]);
    expect(errors({ world })).toContain('world.crisisChancePct is above zero but there is no crisis');
    expect(errors({ crises: [{ ...crisis, weight: 0 }], world })).toContain('crisis crash needs a positive weight');
    expect(errors({ crises: [{ ...crisis, phases: [] }], world })).toContain('crisis crash needs at least one round');
    expect(errors({ crises: [{ ...crisis, phases: [{ equityBp: 0.5 }] }], world })).toContain('crisis crash has a equityBp that is not a whole number');
    expect(errors({ crises: [{ ...crisis, phases: Array.from({ length: c.rounds }, () => ({})) }], world })).toContain('crisis crash does not fit in a life');
    expect(errors({ crises: [crisis, crisis], world })).toContain('duplicate crisis id: crash');

    const waiting = (trigger: object) => errors({ crises: [crisis], world, cards: [{ id: 'omen', category: 'world' as const, weight: 1, cooldown: 0, trigger, options: [{}, {}] }] });
    expect(waiting({ crisis: { id: 'crash', year: 2 } })).toEqual([]);
    expect(waiting({ crisis: { id: 'crash', year: 3 } })).toContain('card omen trigger names a round crisis crash does not have: 3');
    expect(waiting({ crisis: { id: 'plague', year: 1 } })).toContain('card omen trigger names an unknown crisis: plague');
  });

  it('checks careers', () => {
    const career = c.careers[0];
    expect(errors({ careers: [{ ...career, levels: [] }] })).toContain('career office needs at least one level');
    expect(errors({ careers: [{ ...career, id: 'Bad Id' }] })).toContain('career id "Bad Id" is not allowed');
    expect(errors({ careers: [career, career] })).toContain('duplicate career id: office');
    expect(errors({ careers: [{ ...career, overtimePct: -1 }] })).toContain('career office has a negative overtime percentage');
    const withLevels = (levels: typeof career.levels) => errors({ careers: [{ ...career, levels }] });
    expect(withLevels([{ salaryPct: 80, minSkill: 1, status: 0 }])).toContain('career office must start at skill 0');
    expect(withLevels([{ salaryPct: 80, minSkill: 0, status: 0 }, { salaryPct: 90, minSkill: 0, status: 0 }])).toContain(
      'career office level 1 must need more skill than the level below',
    );
    expect(withLevels([{ salaryPct: 0, minSkill: 0, status: 0 }])).toContain('career office level 0 needs a positive salary percentage');
    expect(withLevels([{ salaryPct: 80, minSkill: 0, status: -1 }])).toContain('career office level 0 needs a whole, non-negative status');
    expect(withLevels([{ salaryPct: 80, minSkill: 0, status: 0 }, { salaryPct: 90, minSkill: 2.5, status: 0 }])).toContain(
      'career office level 1 needs a whole, non-negative skill',
    );
  });

  it('checks items', () => {
    const item = c.items[0];
    const withItem = (over: Record<string, unknown>) => errors({ items: [{ ...item, ...over } as never] });
    expect(withItem({ id: 'constructor' })).toContain('item id "constructor" is not allowed');
    expect(withItem({ kind: 'loan' })).toContain('item car_basic has an unknown kind');
    expect(withItem({ ladder: 'Not Ok' })).toContain('item car_basic has a ladder name that is not allowed');
    expect(withItem({ price: -1 })).toContain('item car_basic needs a whole, non-negative price and upkeep');
    expect(withItem({ upkeepAnnual: 0.5 })).toContain('item car_basic needs a whole, non-negative price and upkeep');
    expect(withItem({ status: 1.5 })).toContain('item car_basic needs a whole, non-negative status');
    expect(withItem({ resaleStartPct: 101 })).toContain('item car_basic has a resale percentage outside 0..100');
    expect(withItem({ resaleDriftBp: -10_000 })).toContain('item car_basic has a resale drift that is not a whole number above -10000');
    expect(withItem({ resaleDriftBp: NaN })).toContain('item car_basic has a resale drift that is not a whole number above -10000');
    expect(withItem({ kind: 'experience', boostRounds: 0 })).toContain('experience car_basic needs at least one round of boost');
    expect(errors({ items: [item, item] })).toContain('duplicate item id: car_basic');
  });

  it('checks status numbers on cities and property types, and the skill an asset needs', () => {
    expect(errors({ cities: [{ ...c.cities[0], prestige: -2 }] })).toContain('city home needs a whole, non-negative prestige');
    expect(errors({ propertyTypes: [{ id: 'shed', pricePct: 10, status: 0.5 }] })).toContain('property type shed needs a whole, non-negative status');
    expect(errors({ assets: [...c.assets, { id: 'odd', class: 'equity', betaPct: 100, idioVolBp: 0, yieldBp: 0, minFinanceSkill: 3 as never }] })).toContain(
      'asset odd needs a finance skill of 0, 1 or 2',
    );
  });

  it('checks the life rules', () => {
    const life = (over: Record<string, unknown>) => errors({ life: { ...c.life, ...over } as never });
    for (const field of ['childCostPct', 'partnerCostPct', 'moveCostPct', 'workSkill', 'studySkill', 'jobHuntRaisePct', 'cheapMortgageBp']) {
      expect(life({ [field]: -1 })).toContain(`life.${field} must be a whole, non-negative number`);
      expect(life({ [field]: NaN })).toContain(`life.${field} must be a whole, non-negative number`);
    }
    expect(life({ childRounds: 0 })).toContain('life.childRounds must be a positive whole number');
    expect(life({ financeExperienceRounds: 0.5 })).toContain('life.financeExperienceRounds must be a positive whole number');
    expect(life({ jobHuntChancePct: 101 })).toContain('life.jobHuntChancePct must be between 0 and 100');
    expect(life({ lesserItemPct: -1 })).toContain('life.lesserItemPct must be between 0 and 100');
    expect(life({ unstablePayPct: 120 })).toContain('life.unstablePayPct must be a whole number from 0 to 100');
    expect(life({ rentTierHousingPct: [60] })).toContain('life.rentTierHousingPct must be two numbers between 0 and 100');
    expect(life({ rentTierHousingPct: [60, 140] })).toContain('life.rentTierHousingPct must be two numbers between 0 and 100');
    expect(life({ rentTierStatus: [0, -1] })).toContain('life.rentTierStatus must be two whole, non-negative numbers');
    expect(life({ lifestyleStatus: [0, 0, 0] })).toContain('life.lifestyleStatus must be four whole numbers');
    expect(life({ lifestyleStatus: [0, 0.5, 0, 0] })).toContain('life.lifestyleStatus must be four whole numbers');
    // A way of living may take status away.
    expect(life({ lifestyleStatus: [-3, 0, 3, 8] })).toEqual([]);
    expect(life({ roomLateRound: -1 })).toContain('life.roomLateRound must be a whole, non-negative number');
    expect(life({ roomLateStatus: 0.5 })).toContain('life.roomLateStatus must be a whole number');
    expect(life({ roomLateStatus: -3 })).toEqual([]);
    expect(life({ itemFinanceDownPct: 101 })).toContain('life.itemFinanceDownPct must be a whole number from 0 to 100');
    expect(life({ itemFinanceMinPrice: -1 })).toContain('life.itemFinanceMinPrice must be a whole, non-negative amount');
    expect(life({ insurancePremiumBp: { health: 400, home: 300, life: 200 } })).toContain(
      'life.insurancePremiumBp needs a whole, non-negative number for liability',
    );
    expect(life({ rentOutMinFinanceSkill: 5 })).toContain('life.rentOutMinFinanceSkill must be 0, 1 or 2');
  });

  it('checks the status a bankruptcy costs', () => {
    expect(errors({ debt: { ...c.debt, bankruptcyStatusPenalty: -1 } })).toContain('debt.bankruptcyStatusPenalty must be a whole, non-negative number');
    expect(errors({ debt: { ...c.debt, bankruptcyStatusPenalty: 2.5 } })).toContain('debt.bankruptcyStatusPenalty must be a whole, non-negative number');
  });

  it('checks the world rules', () => {
    const world = (over: Record<string, unknown>) => errors({ world: { ...c.world, ...over } as never });
    expect(world({ headlinesPerRound: 6 })).toContain('world.headlinesPerRound must be a whole number from 0 to 5');
    expect(world({ newsTruthPct: 130 })).toContain('world.newsTruthPct must be between 0 and 100');
    expect(world({ flatBandBp: -1 })).toContain('world.flatBandBp must be a whole, non-negative number');
    expect(world({ taxReformChancePct: -5 })).toContain('world.taxReformChancePct must be between 0 and 100');
    expect(world({ taxReformsPerGame: 1.5 })).toContain('world.taxReformsPerGame must be a whole, non-negative number');
    expect(world({ taxReformStepsBp: [200, 0] })).toContain('world.taxReformStepsBp must be whole numbers other than zero');
    expect(world({ taxReformChancePct: 10, taxReformStepsBp: [] })).toContain('world.taxReformStepsBp is empty but reforms can happen');
  });

  it('checks that every market number is a finite number', () => {
    const market = (over: Record<string, unknown>) => errors({ market: { ...c.market, ...over } as never });
    expect(market({ equityMeanBp: { ...c.market.equityMeanBp, boom: NaN } })).toContain('market.equityMeanBp.boom must be a finite number');
    expect(market({ cryptoMeanBp: { accumulation: 0, bull: 0, mania: 0 } })).toContain('market.cryptoMeanBp.winter must be a finite number');
    expect(market({ classVolBp: { equity: 1, crypto: -1, gold: 1 } })).toContain('market.classVolBp.crypto must not be negative');
    expect(market({ rateNoiseBp: Infinity })).toContain('market.rateNoiseBp must be a finite number');
    expect(market({ depositSpreadBp: undefined })).toContain('market.depositSpreadBp must be a finite number');
    expect(market({ start: { ...c.market.start, regime: 'panic' } })).toContain('market.start.regime is not a regime: panic');
    expect(market({ start: { ...c.market.start, cryptoPhase: 'moon' } })).toContain('market.start.cryptoPhase is not a crypto phase: moon');
    expect(market({ start: { ...c.market.start, policyRateBp: NaN } })).toContain('market.start.policyRateBp must be a finite number');
    expect(errors({ assets: [...c.assets, { id: 'odd', class: 'equity', betaPct: NaN, idioVolBp: 0, yieldBp: 0 }] })).toContain(
      'asset odd has a beta that is not a finite number',
    );
    expect(errors({ assets: [...c.assets, { id: 'odd', class: 'equity', betaPct: 100, idioVolBp: 0, yieldBp: 0, driftBp: 0.5 }] })).toContain(
      'asset odd has a drift that is not a whole number',
    );
  });
});

describe('validateStart: the life', () => {
  const good: LifeStart = { lifeId: 'tester', career: { id: 'office', level: 1 }, careerSkill: 4, financeSkill: 1, focus: 3 };
  const check = (life: Record<string, unknown>, over: Record<string, unknown> = {}) =>
    validateStart(c, { ...fixtureStart(), ...over, life: { ...good, ...life } as never });

  it('accepts a full life', () => {
    expect(
      check({
        minLifestyleTier: 1,
        rentTier: 0,
        properties: [{ typeId: 'flat', rented: false }],
        recurring: [{ tag: 'remittance', kind: 'expense', annual: 240_000, roundsLeft: null }],
        flags: ['layoff_proof'],
      }),
    ).toEqual([]);
  });

  it('reports every problem with a life', () => {
    expect(check({ lifeId: 'Not Ok' })).toEqual(['life.lifeId "Not Ok" is not allowed']);
    expect(check({ career: { id: 'pirate', level: 0 } })).toEqual(['life.career is unknown: pirate']);
    expect(check({ career: { id: 'office', level: 3 } })).toEqual(['life.career level 3 does not exist in office']);
    expect(check({ career: { id: 'office', level: 0.5 } })).toEqual(['life.career level 0.5 does not exist in office']);
    expect(check({ careerSkill: -1 })).toEqual(['life.careerSkill must be a whole, non-negative number']);
    expect(check({ financeSkill: 4 as never })).toEqual(['life.financeSkill must be 0, 1, 2 or 3']);
    expect(check({ financeSkill: 3 })).toEqual([]);
    expect(check({ focus: 0 })).toEqual(['life.focus must be a whole number from 1 to 10']);
    expect(check({ focus: 11 })).toEqual(['life.focus must be a whole number from 1 to 10']);
    expect(check({ minLifestyleTier: 2 })).toEqual(['life.minLifestyleTier must be 0, 1, 2 or 3 and no higher than lifestyleTier']);
    expect(check({ minLifestyleTier: 2 }, { lifestyleTier: 2 })).toEqual([]);
    expect(check({ rentTier: 2 })).toEqual(['life.rentTier must be 0 or 1']);
    expect(check({ properties: [{ typeId: 'castle', rented: false }] })).toEqual(['life property 0 has an unknown type: castle']);
    expect(check({ properties: [{ typeId: 'flat', rented: 'yes' }] })).toEqual(['life property 0 needs rented to be true or false']);
    expect(check({ holdings: [{ assetId: 'tulips', value: 100 }] })).toEqual(['life holding 0 has an unknown asset: tulips']);
    expect(check({ holdings: [{ assetId: 'bond_long', value: 0 }] })).toEqual(['life holding 0 needs a positive whole value']);
    expect(check({ holdings: [{ assetId: 'bond_long', value: 100 }, { assetId: 'bond_long', value: 100 }] })).toEqual(['life holding 1 repeats an asset: bond_long']);
    expect(check({ holdings: [{ assetId: 'bond_long', value: 100 }] })).toEqual([]);
    expect(check({ recurring: [{ tag: 'x', kind: 'bribe', annual: 1, roundsLeft: null }] })).toEqual(['life recurring entry 0 is not valid']);
    expect(check({ recurring: [{ tag: 'x', kind: 'expense', annual: -1, roundsLeft: null }] })).toEqual(['life recurring entry 0 is not valid']);
    expect(check({ recurring: [{ tag: 'x', kind: 'expense', annual: 1, roundsLeft: 0 }] })).toEqual(['life recurring entry 0 is not valid']);
    expect(check({ recurring: [{ tag: '__proto__', kind: 'expense', annual: 1, roundsLeft: null }] })).toEqual(['life recurring entry 0 is not valid']);
    expect(check({ flags: ['toString'] })).toEqual(['life flag "toString" is not allowed']);
  });

  it('refuses a life that is not a record', () => {
    expect(validateStart(c, { ...fixtureStart(), life: 'nurse' as never })).toEqual(['life must be a record']);
  });
});
