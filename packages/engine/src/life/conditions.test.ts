import { describe, expect, it } from 'vitest';
import { fixtureContent, fixturePlayer } from '../testing/fixture';
import type { Condition, LifeStart, PlayerState, WorldState, WorldTrigger } from '../types';
import { generateTimeline } from '../world';
import { conditionHolds, triggerHolds } from './conditions';

const content = fixtureContent();
const world0 = generateTimeline('conditions', content)[0];
const office: LifeStart = { lifeId: 'tester', career: { id: 'office', level: 1 }, careerSkill: 4, financeSkill: 1, focus: 3 };

const player = (change: (p: PlayerState) => void = () => {}, life: Partial<LifeStart> = {}): PlayerState => {
  const p = fixturePlayer({ cash: 1_000_000, life: { ...office, ...life } }, content);
  change(p);
  return p;
};
const world = (over: Partial<WorldState> = {}): WorldState => ({ ...world0, ...over });
const holds = (when: Condition | undefined, p: PlayerState = player(), now: WorldState = world0, round = 4) =>
  conditionHolds(when, p, { content, world: now, round });

describe('conditionHolds', () => {
  it('holds when there is no condition', () => {
    expect(holds(undefined)).toBe(true);
    expect(holds({})).toBe(true);
  });

  it('checks the round', () => {
    expect(holds({ minRound: 4 })).toBe(true);
    expect(holds({ minRound: 5 })).toBe(false);
    expect(holds({ maxRound: 4 })).toBe(true);
    expect(holds({ maxRound: 3 })).toBe(false);
  });

  it('checks the city', () => {
    expect(holds({ cities: ['haven', 'home'] })).toBe(true);
    expect(holds({ cities: ['haven'] })).toBe(false);
    expect(holds({ notCities: ['haven'] })).toBe(true);
    expect(holds({ notCities: ['home'] })).toBe(false);
  });

  it('checks the job', () => {
    const jobless = player(() => {}, { career: null });
    expect(holds({ employed: true })).toBe(true);
    expect(holds({ employed: false })).toBe(false);
    expect(holds({ employed: true }, jobless)).toBe(false);
    expect(holds({ employed: false }, jobless)).toBe(true);
    expect(holds({ careers: ['office'] })).toBe(true);
    expect(holds({ careers: ['pirate'] })).toBe(false);
    expect(holds({ careers: ['office'] }, jobless)).toBe(false);
    expect(holds({ minLevel: 1 })).toBe(true);
    expect(holds({ minLevel: 2 })).toBe(false);
    expect(holds({ maxLevel: 1 })).toBe(true);
    expect(holds({ maxLevel: 0 })).toBe(false);
    expect(holds({ minLevel: 0 }, jobless)).toBe(false);
    expect(holds({ maxLevel: 9 }, jobless)).toBe(false);
  });

  it('checks the family', () => {
    const family = player((p) => {
      p.life.partner = true;
      p.life.children = [9, 4];
    });
    expect(holds({ partner: true }, family)).toBe(true);
    expect(holds({ partner: false }, family)).toBe(false);
    expect(holds({ partner: false })).toBe(true);
    expect(holds({ minChildren: 2 }, family)).toBe(true);
    expect(holds({ minChildren: 3 }, family)).toBe(false);
    expect(holds({ maxChildren: 2 }, family)).toBe(true);
    expect(holds({ maxChildren: 1 }, family)).toBe(false);
    expect(holds({ maxChildren: 0 })).toBe(true);
  });

  it('checks homes, tenants and mortgages', () => {
    const home = { id: 'property-1', cityId: 'home', typeId: 'flat', value: 100, basis: 100, rented: false, mortgageId: null };
    const owner = player((p) => p.properties.push({ ...home }));
    const landlord = player((p) => p.properties.push({ ...home, rented: true }));
    const abroad = player((p) => p.properties.push({ ...home, cityId: 'haven' }));
    const mortgaged = player((p) => p.debts.push({ id: 'debt-1', kind: 'mortgageVariable', principal: 5, fixedRateBp: 0, roundsLeft: 3 }));
    const carded = player((p) => p.debts.push({ id: 'debt-1', kind: 'creditCard', principal: 5, fixedRateBp: 0, roundsLeft: 0 }));
    expect(holds({ ownsHome: true }, owner)).toBe(true);
    expect(holds({ ownsHome: true }, landlord)).toBe(false);
    expect(holds({ ownsHome: true }, abroad)).toBe(false);
    expect(holds({ ownsHome: false }, owner)).toBe(false);
    expect(holds({ ownsHome: false })).toBe(true);
    expect(holds({ landlord: true }, landlord)).toBe(true);
    expect(holds({ landlord: true }, owner)).toBe(false);
    expect(holds({ landlord: false }, landlord)).toBe(false);
    expect(holds({ hasMortgage: true }, mortgaged)).toBe(true);
    expect(holds({ hasMortgage: true }, carded)).toBe(false);
    expect(holds({ hasMortgage: false }, mortgaged)).toBe(false);
  });

  it('checks net worth in start-of-game dollars', () => {
    expect(holds({ minNetWorth: 1_000_000 })).toBe(true);
    expect(holds({ minNetWorth: 1_000_001 })).toBe(false);
    expect(holds({ maxNetWorth: 1_000_000 })).toBe(true);
    expect(holds({ maxNetWorth: 999_999 })).toBe(false);
    const dearer = world({ priceLevel: 2_000_000 });
    expect(holds({ minNetWorth: 500_000 }, player(), dearer)).toBe(true);
    expect(holds({ minNetWorth: 500_001 }, player(), dearer)).toBe(false);
  });

  it('checks finance skill', () => {
    expect(holds({ minFinanceSkill: 1 })).toBe(true);
    expect(holds({ minFinanceSkill: 2 })).toBe(false);
    expect(holds({ maxFinanceSkill: 1 })).toBe(true);
    expect(holds({ maxFinanceSkill: 0 })).toBe(false);
  });

  it('checks flags', () => {
    const flagged = player((p) => {
      p.life.flags = { dating: 2, fit: 3 };
    });
    expect(holds({ flags: ['dating', 'fit'] }, flagged)).toBe(true);
    expect(holds({ flags: ['dating', 'married'] }, flagged)).toBe(false);
    expect(holds({ notFlags: ['married'] }, flagged)).toBe(true);
    expect(holds({ notFlags: ['married', 'fit'] }, flagged)).toBe(false);
    expect(holds({ flags: ['toString'] }, flagged)).toBe(false);
  });

  it('checks what the player holds and owns', () => {
    const p = player((x) => {
      x.deposit = 5;
      x.positions.coin_major = { value: 5, basis: 5 };
      x.life.items.push({ itemId: 'car_basic', value: 1, roundsLeft: null, paid: 0, age: 0 });
    });
    expect(holds({ holds: 'deposit' }, p)).toBe(true);
    expect(holds({ holds: 'deposit' })).toBe(false);
    expect(holds({ holds: 'crypto' }, p)).toBe(true);
    expect(holds({ holds: 'gold' }, p)).toBe(false);
    expect(holds({ ownsLadder: 'car' }, p)).toBe(true);
    expect(holds({ ownsLadder: 'watch' }, p)).toBe(false);
    expect(holds({ lacksLadder: 'car' }, p)).toBe(false);
    expect(holds({ lacksLadder: 'watch' }, p)).toBe(true);
    expect(holds({ lacksLadder: 'car' })).toBe(true);
    expect(holds({ notItems: ['watch_gold'] }, p)).toBe(true);
    expect(holds({ notItems: ['watch_gold', 'car_basic'] }, p)).toBe(false);
  });

  it('checks the world the player lives in', () => {
    expect(holds({ regimes: ['expansion'] })).toBe(true);
    expect(holds({ regimes: ['recession', 'slowdown'] })).toBe(false);
    const crash = world({ propertyReturnBp: { home: -600, haven: 900 } });
    expect(holds({ cityPropertyReturnAtMostBp: -500 }, player(), crash)).toBe(true);
    expect(holds({ cityPropertyReturnAtMostBp: -700 }, player(), crash)).toBe(false);
  });

  it('needs every part to hold', () => {
    const partnered = player((p) => {
      p.life.partner = true;
    });
    expect(holds({ partner: true, maxChildren: 0, cities: ['home'] }, partnered)).toBe(true);
    expect(holds({ partner: true, minChildren: 1 }, partnered)).toBe(false);
  });
});

describe('triggerHolds', () => {
  const fires = (trigger: WorldTrigger | undefined, prev: Partial<WorldState>, now: Partial<WorldState>) =>
    triggerHolds(trigger, world(prev), world(now));

  it('never fires without a trigger, and always with an empty one', () => {
    expect(fires(undefined, {}, {})).toBe(false);
    expect(fires({}, {}, {})).toBe(true);
  });

  it('fires when a regime or a crypto phase begins', () => {
    expect(fires({ regimeBegan: ['recession'] }, { regime: 'slowdown' }, { regime: 'recession' })).toBe(true);
    expect(fires({ regimeBegan: ['recession'] }, { regime: 'recession' }, { regime: 'recession' })).toBe(false);
    expect(fires({ regimeBegan: ['boom'] }, { regime: 'slowdown' }, { regime: 'recession' })).toBe(false);
    expect(fires({ cryptoBegan: ['bull', 'mania'] }, { cryptoPhase: 'accumulation' }, { cryptoPhase: 'bull' })).toBe(true);
    expect(fires({ cryptoBegan: ['bull', 'mania'] }, { cryptoPhase: 'bull' }, { cryptoPhase: 'bull' })).toBe(false);
  });

  it('fires while a regime lasts', () => {
    expect(fires({ regimes: ['recession', 'slowdown'] }, { regime: 'recession' }, { regime: 'recession' })).toBe(true);
    expect(fires({ regimes: ['recession'] }, {}, { regime: 'boom' })).toBe(false);
  });

  it('fires on moves in rates, inflation and property', () => {
    expect(fires({ rateChangeAtLeastBp: 75 }, { policyRateBp: 200 }, { policyRateBp: 275 })).toBe(true);
    expect(fires({ rateChangeAtLeastBp: 75 }, { policyRateBp: 200 }, { policyRateBp: 274 })).toBe(false);
    expect(fires({ rateChangeAtMostBp: -75 }, { policyRateBp: 300 }, { policyRateBp: 225 })).toBe(true);
    expect(fires({ rateChangeAtMostBp: -75 }, { policyRateBp: 300 }, { policyRateBp: 226 })).toBe(false);
    expect(fires({ inflationAtLeastBp: 450 }, {}, { inflationBp: 450 })).toBe(true);
    expect(fires({ inflationAtLeastBp: 450 }, {}, { inflationBp: 449 })).toBe(false);
    expect(fires({ anyPropertyReturnAtMostBp: -500 }, {}, { propertyReturnBp: { home: 300, haven: -500 } })).toBe(true);
    expect(fires({ anyPropertyReturnAtMostBp: -500 }, {}, { propertyReturnBp: { home: 300, haven: -499 } })).toBe(false);
  });

  it('fires on a tax reform', () => {
    expect(fires({ taxReform: true }, { taxShiftBp: { home: 0, haven: 0 } }, { taxShiftBp: { home: 200, haven: 0 } })).toBe(true);
    expect(fires({ taxReform: true }, { taxShiftBp: { home: 200, haven: 0 } }, { taxShiftBp: { home: 200, haven: 0 } })).toBe(false);
  });

  it('needs every part to hold', () => {
    expect(fires({ regimes: ['boom'], inflationAtLeastBp: 400 }, {}, { regime: 'boom', inflationBp: 500 })).toBe(true);
    expect(fires({ regimes: ['boom'], inflationAtLeastBp: 400 }, {}, { regime: 'boom', inflationBp: 300 })).toBe(false);
  });
});
