import { describe, expect, it } from 'vitest';
import { fixtureContent, fixturePlayer } from '../testing/fixture';
import type { Effects, LifeStart, PlayerState, WorldState } from '../types';
import { generateTimeline } from '../world';
import { deriveExpenses, derivePassive, deriveSalary, deriveStatus } from './derive';
import { applyEffects } from './effects';
import { propertyPrice } from '../property';

const content = fixtureContent();
const world0 = generateTimeline('effects', content)[0];
const dearer: WorldState = { ...world0, priceLevel: 1_100_000 };
const office: LifeStart = { lifeId: 'tester', career: { id: 'office', level: 0 }, careerSkill: 0, financeSkill: 0, focus: 3 };

function player(change: (p: PlayerState) => void = () => {}, life: Partial<LifeStart> = {}): PlayerState {
  const p = fixturePlayer({ cash: 10_000_000, life: { ...office, ...life } }, content);
  change(p);
  return p;
}

/** Applies the effects at round 4 and returns the player. */
function after(effects: Effects | undefined, p: PlayerState = player(), world: WorldState = world0): PlayerState {
  applyEffects(p, effects, { content, world, round: 4 });
  expect(p.salaryAnnual).toBe(deriveSalary(p, content));
  expect(p.extraExpensesAnnual).toBe(deriveExpenses(p, content));
  expect(p.extraPassiveAnnual).toBe(derivePassive(p));
  expect(p.statusPoints).toBe(deriveStatus(p, content, 4));
  return p;
}

const mortgage = (p: PlayerState) => {
  p.debts.push({ id: 'debt-1', kind: 'mortgageFixed', principal: 9_000_000, fixedRateBp: 300, roundsLeft: 10 });
  p.properties.push({ id: 'property-2', cityId: 'home', typeId: 'flat', value: 25_000_000, basis: 20_000_000, rented: false, mortgageId: 'debt-1' });
  p.nextId = 2;
};

describe('applyEffects: money', () => {
  it('does nothing without effects', () => {
    const before = JSON.stringify(player());
    expect(JSON.stringify(after(undefined))).toBe(before);
    expect(JSON.stringify(after({}))).toBe(before);
  });

  it('pays and charges cash at the price level of the round', () => {
    expect(after({ cash: 50_000 }).cash).toBe(10_050_000);
    expect(after({ cash: -50_000 }).cash).toBe(9_950_000);
    expect(after({ cash: 50_000 }, player(), dearer).cash).toBe(10_055_000);
  });

  it('pays a share of one year of salary', () => {
    expect(after({ cashSalaryPct: 10 }).cash).toBe(10_240_000);
    expect(after({ cashSalaryPct: -50 }).cash).toBe(8_800_000);
    expect(after({ cashSalaryPct: 10 }, player(), dearer).cash).toBe(10_264_000);
  });

  it('takes a share of net worth, and nothing from someone who has none', () => {
    expect(after({ cashNetWorthPct: -30 }).cash).toBe(7_000_000);
    const broke = player((p) => {
      p.cash = 100;
      p.debts.push({ id: 'debt-1', kind: 'personalLoan', principal: 500, fixedRateBp: 0, roundsLeft: 1 });
    });
    expect(after({ cashNetWorthPct: -30 }, broke).cash).toBe(100);
  });

  it('lets an insurance or a flag absorb part of a loss, and never touches a gain', () => {
    const hit: Effects = { cash: -1_000_000, protection: { insurance: 'health', coverPct: 80 } };
    expect(after(hit).cash).toBe(9_000_000);
    expect(after(hit, player((p) => (p.life.insurance.health = true))).cash).toBe(9_800_000);
    expect(after(hit, player((p) => (p.life.insurance.home = true))).cash).toBe(9_000_000);
    const audit: Effects = { cashSalaryPct: -50, cash: -300_000, protection: { flag: 'tax_advisor', coverPct: 100 } };
    expect(after(audit).cash).toBe(8_500_000);
    expect(after(audit, player((p) => (p.life.flags.tax_advisor = 1))).cash).toBe(10_000_000);
    const win: Effects = { cash: 1_000_000, protection: { insurance: 'health', coverPct: 80 } };
    expect(after(win, player((p) => (p.life.insurance.health = true))).cash).toBe(11_000_000);
  });

  it('pays out a personal loan whatever the limit', () => {
    const p = after({ loan: 9_000_000 });
    expect(p.cash).toBe(19_000_000);
    expect(p.debts).toEqual([{ id: 'debt-1', kind: 'personalLoan', principal: 9_000_000, fixedRateBp: 750, roundsLeft: 3 }]);
    expect(after({ loan: 1_000_000 }, player(), dearer).debts[0].principal).toBe(1_100_000);
  });

  it('adds to the pension without touching cash', () => {
    const p = after({ pension: 400_000, cash: -200_000 });
    expect(p.pension).toBe(400_000);
    expect(p.cash).toBe(9_800_000);
  });

  it('takes a share of the deposit or of one asset class', () => {
    const rich = () =>
      player((p) => {
        p.deposit = 1_000_000;
        p.positions.coin_major = { value: 800_000, basis: 500_000 };
        p.positions.coin_meme = { value: 3, basis: 300_000 };
        p.positions.gold = { value: 700_000, basis: 700_000 };
      });
    expect(after({ lose: { what: 'deposit', pct: 20 } }, rich()).deposit).toBe(800_000);
    const frozen = after({ lose: { what: 'crypto', pct: 50 } }, rich());
    expect(frozen.positions).toEqual({
      coin_major: { value: 400_000, basis: 500_000 },
      coin_meme: { value: 2, basis: 300_000 },
      gold: { value: 700_000, basis: 700_000 },
    });
    expect(frozen.deposit).toBe(1_000_000);
    expect(after({ lose: { what: 'crypto', pct: 100 } }, rich()).positions).toEqual({ gold: { value: 700_000, basis: 700_000 } });
  });
});

describe('applyEffects: work and skills', () => {
  it('changes pay for good or for this round, and the salary follows', () => {
    const p = after({ salaryModPct: 10, salaryBoostPct: -50 });
    expect(p.life.salaryModPct).toBe(10);
    expect(p.life.salaryBoostPct).toBe(-50);
    expect(p.salaryAnnual).toBe(1_440_000);
  });

  it('raises and lowers skills within their bounds', () => {
    expect(after({ careerSkill: 3 }).life.careerSkill).toBe(3);
    expect(after({ careerSkill: -5 }).life.careerSkill).toBe(0);
    expect(after({ financeSkill: 1 }).life.financeSkill).toBe(1);
    expect(after({ financeSkill: 5 }).life.financeSkill).toBe(2);
    expect(after({ financeSkill: -1 }).life.financeSkill).toBe(0);
  });

  it('spends focus and grants lasting status', () => {
    const p = after({ focus: 2, status: 7 });
    expect(p.life.focusUsed).toBe(2);
    expect(p.life.bonusStatus).toBe(7);
    expect(p.statusPoints).toBe(9);
  });

  it('promotes and demotes within the ladder, lifting skill to match', () => {
    const up = after({ job: { levelDelta: 1 } });
    expect(up.life.career).toEqual({ id: 'office', level: 1 });
    expect(up.life.careerSkill).toBe(4);
    expect(up.salaryAnnual).toBe(3_300_000);
    expect(after({ job: { levelDelta: 5 } }).life.career).toEqual({ id: 'office', level: 2 });
    expect(after({ job: { levelDelta: -1 } }).life.career).toEqual({ id: 'office', level: 0 });
    const skilled = after({ job: { level: 2 } }, player((p) => (p.life.careerSkill = 30)));
    expect(skilled.life.career).toEqual({ id: 'office', level: 2 });
    expect(skilled.life.careerSkill).toBe(30);
  });

  it('gives a job to someone without one, and ignores a promotion for them', () => {
    const jobless = () => player(() => {}, { career: null });
    expect(after({ job: { levelDelta: 1 } }, jobless()).life.career).toBeNull();
    expect(after({ job: { career: 'office' } }, jobless()).life.career).toEqual({ id: 'office', level: 0 });
    expect(after({ job: { career: 'office', level: 1 } }, jobless()).life.career).toEqual({ id: 'office', level: 1 });
  });

  it('ends a career for good', () => {
    const fixed = fixturePlayer({ salaryAnnual: 3_000_000 }, content);
    expect(after({ job: { leave: true } }, fixed).salaryAnnual).toBe(0);
    const retired = after({ job: { leave: true } });
    expect(retired.life.career).toBeNull();
    expect(retired.life.baseSalaryAnnual).toBe(0);
    expect(retired.salaryAnnual).toBe(0);
  });

  it('plans a move to another city', () => {
    expect(after({ moveCity: 'haven' }).life.movingTo).toBe('haven');
    expect(after({ moveCity: 'home' }).life.movingTo).toBeNull();
  });
});

describe('applyEffects: recurring entries and flags', () => {
  it('adds entries, replaces one with the same tag, and ends them by tag', () => {
    const p = after({
      recurring: [
        { tag: 'bar', kind: 'passive', annual: 500_000, roundsLeft: null },
        { tag: 'school', kind: 'expense', annual: 100_000, roundsLeft: 6 },
      ],
    });
    expect(p.extraPassiveAnnual).toBe(500_000);
    expect(p.extraExpensesAnnual).toBe(100_000);
    after({ recurring: [{ tag: 'bar', kind: 'passive', annual: 900_000, roundsLeft: null }], endRecurring: ['school', 'nothing'] }, p);
    expect(p.life.recurring).toEqual([{ tag: 'bar', kind: 'passive', annual: 900_000, roundsLeft: null }]);
  });

  it('stores its own copy of an entry', () => {
    const entry = { tag: 'bar', kind: 'passive' as const, annual: 500_000, roundsLeft: 3 };
    const p = after({ recurring: [entry] });
    entry.roundsLeft = 99;
    expect(p.life.recurring[0].roundsLeft).toBe(3);
  });

  it('sets a flag with the round, and clears it', () => {
    const p = after({ setFlags: ['dating', 'fit'] });
    expect(p.life.flags).toEqual({ dating: 4, fit: 4 });
    expect(after({ clearFlags: ['dating', 'unknown'] }, p).life.flags).toEqual({ fit: 4 });
  });
});

describe('applyEffects: family and lifestyle', () => {
  it('starts and ends a partnership', () => {
    const p = after({ partner: { salaryPct: 80 } });
    expect(p.life.partner).toBe(true);
    expect(p.salaryAnnual).toBe(2_400_000 + 2_400_000);
    expect(p.extraExpensesAnnual).toBe(900_000);
    after({ partner: null }, p);
    expect(p.life.partner).toBe(false);
    expect(p.life.partnerSalaryPct).toBe(0);
    expect(p.salaryAnnual).toBe(2_400_000);
  });

  it('adds children who depend on the player for a set number of rounds', () => {
    const p = after({ children: 2 });
    expect(p.life.children).toEqual([9, 9]);
    expect(p.extraExpensesAnnual).toBe(900_000);
  });

  it('takes out an insurance, kept and paid for from then on as one the player took out', () => {
    const p = after({ insure: 'home' });
    expect(p.life.insurance.home).toBe(true);
    expect(p.life.insurance.life).toBe(false);
    expect(p.extraExpensesAnnual).toBeGreaterThan(player().extraExpensesAnnual);
  });

  it('raises the lifestyle floor, pulling the tier up with it', () => {
    const p = after({ lifestyleFloor: 2 });
    expect(p.life.minLifestyleTier).toBe(2);
    expect(p.lifestyleTier).toBe(2);
    const lavish = after({ lifestyleFloor: 1 }, player((x) => {
      x.lifestyleTier = 3;
      x.life.minLifestyleTier = 2;
    }));
    expect(lavish.life.minLifestyleTier).toBe(2);
    expect(lavish.lifestyleTier).toBe(3);
  });
});

describe('applyEffects: things bought through a card', () => {
  it('buys an item at a share of its price, worth its usual resale value', () => {
    const p = after({ buyItem: { itemId: 'car_basic', pricePct: 50 } });
    expect(p.cash).toBe(10_000_000 - 600_000);
    expect(p.life.items).toEqual([{ itemId: 'car_basic', value: 960_000, roundsLeft: null, paid: 600_000, age: 0 }]);
    expect(p.life.collection).toEqual(['car_basic']);
    expect(p.statusPoints).toBe(4 + 2);
  });

  it('gives an item for nothing, and does not charge for one already owned', () => {
    const p = after({ buyItem: { itemId: 'trip', pricePct: 0 } });
    expect(p.cash).toBe(10_000_000);
    expect(p.life.items).toEqual([{ itemId: 'trip', value: 0, roundsLeft: 2, paid: 0, age: 0 }]);
    after({ buyItem: { itemId: 'trip', pricePct: 100 } }, p);
    expect(p.cash).toBe(10_000_000);
    expect(p.life.items).toHaveLength(1);
  });

  it('invests in an asset whatever the finance skill, with free units on top', () => {
    const gated = fixtureContent();
    gated.assets = gated.assets.map((a) => ({ ...a, minFinanceSkill: 2 as const }));
    const p = fixturePlayer({ cash: 1_000_000 }, gated);
    applyEffects(p, { invest: { assetId: 'coin_meme', amount: 100_000 } }, { content: gated, world: world0, round: 0 });
    applyEffects(p, { invest: { assetId: 'coin_meme', amount: 200_000, bonusPct: 15 } }, { content: gated, world: world0, round: 0 });
    expect(p.cash).toBe(700_000);
    expect(p.positions.coin_meme).toEqual({ value: 330_000, basis: 300_000 });
  });

  it('buys a property below the market with a fixed mortgage', () => {
    const p = after({ property: { typeId: 'studio', pricePct: 90, downPct: 20, rented: false } });
    // Market 15,000,000; price 13,500,000; 20% down 2,700,000; purchase tax 8% of the price 1,080,000.
    expect(p.cash).toBe(10_000_000 - 2_700_000 - 1_080_000);
    expect(p.debts).toEqual([{ id: 'debt-1', kind: 'mortgageFixed', principal: 10_800_000, fixedRateBp: 400, roundsLeft: 12 }]);
    expect(p.properties).toEqual([
      { id: 'property-2', cityId: 'home', typeId: 'studio', value: 13_500_000, basis: 13_500_000, rented: false, mortgageId: 'debt-1' },
    ]);
    expect(p.statusPoints).toBe(3);
  });

  it('buys a property outright, and gives the mortgage perk its discount', () => {
    const rich = player((p) => (p.cash = 50_000_000));
    after({ property: { typeId: 'studio', pricePct: 100, downPct: 100, rented: true } }, rich);
    expect(rich.debts).toEqual([]);
    expect(rich.cash).toBe(50_000_000 - 15_000_000 - 1_200_000);
    expect(rich.properties[0]).toMatchObject({ rented: true, mortgageId: null, value: 15_000_000, basis: 15_000_000 });
    const perk = after({ property: { typeId: 'studio', pricePct: 100, downPct: 50, rented: false } }, player(() => {}, { flags: ['cheap_mortgage'] }));
    expect(perk.debts[0].fixedRateBp).toBe(350);
  });

  it('hands over an inherited property for nothing, and charges its upkeep and gives its standing while it is owned', () => {
    const keep = { ...content, propertyTypes: [...content.propertyTypes, { id: 'castle', pricePct: 40, status: 8, cardOnly: true, upkeepBp: 400, ownedStatus: 5 }] };
    const p = player();
    applyEffects(p, { property: { typeId: 'castle', pricePct: 100, downPct: 100, rented: false, inherited: true } }, { content: keep, world: dearer, round: 4 });
    // Nothing paid, no purchase tax, nothing borrowed: worth the market price, 40% of the 25,000,000 flat at today's prices.
    expect(p.cash).toBe(10_000_000);
    expect(p.debts).toEqual([]);
    const market = propertyPrice(keep, dearer, 'home', 'castle');
    expect(market).toBe(10_000_000);
    expect(p.properties).toEqual([{ id: 'property-1', cityId: 'home', typeId: 'castle', value: market, basis: market, rented: false, mortgageId: null }]);
    // Four percent a year of its price at the start, 10,000,000, as an expense of the life, lived in, let or empty.
    expect(p.extraExpensesAnnual).toBe(deriveExpenses(player(), keep) + 400_000);
    // Let, it is no home, and still gives the status it gives merely owned.
    p.properties[0].rented = true;
    expect(deriveExpenses(p, keep)).toBe(deriveExpenses(player(), keep) + 400_000);
    expect(deriveStatus(p, keep, 4)).toBe(deriveStatus(player(), keep, 4) + 5);
    p.properties = [];
    expect(deriveExpenses(p, keep)).toBe(deriveExpenses(player(), keep));
    expect(deriveStatus(p, keep, 4)).toBe(deriveStatus(player(), keep, 4));
  });
});

describe('applyEffects: the home', () => {
  it('turns every mortgage into the other kind at today’s rate', () => {
    const p = player((x) => {
      mortgage(x);
      x.debts.push({ id: 'debt-3', kind: 'personalLoan', principal: 100, fixedRateBp: 900, roundsLeft: 2 });
    });
    after({ refinance: 'variable' }, p);
    expect(p.debts[0]).toEqual({ id: 'debt-1', kind: 'mortgageVariable', principal: 9_000_000, fixedRateBp: 0, roundsLeft: 10 });
    expect(p.debts[1].fixedRateBp).toBe(900);
    after({ refinance: 'fixed' }, p);
    expect(p.debts[0]).toEqual({ id: 'debt-1', kind: 'mortgageFixed', principal: 9_000_000, fixedRateBp: 400, roundsLeft: 10 });
  });

  it('sells the home, repays its mortgage and makes the player a tenant', () => {
    const p = after({ sellHome: true }, player((x) => {
      mortgage(x);
      x.life.rentTier = 0;
    }));
    expect(p.cash).toBe(10_000_000 + 25_000_000 - 9_000_000);
    expect(p.properties).toEqual([]);
    expect(p.debts).toEqual([]);
    expect(p.life.rentTier).toBe(1);
    expect(p.statusPoints).toBe(2);
  });

  it('adds a fixed amount to the value of the home', () => {
    expect(after({ homeValue: 2_500_000 }, player(mortgage)).properties[0].value).toBe(27_500_000);
    expect(after({ homeValue: 2_500_000 }, player(mortgage), dearer).properties[0].value).toBe(27_750_000);
  });

  it('leaves a tenant untouched by effects on a home', () => {
    const before = JSON.stringify(player());
    expect(JSON.stringify(after({ sellHome: true, homeValue: 1_000_000, refinance: 'fixed' }))).toBe(before);
  });
});
