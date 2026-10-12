// These tests corrupt cards and states on purpose, so they reach into them untyped.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from 'vitest';
import { fixtureContent } from '../testing/fixture';
import type { CardDef, Content } from '../types';
import { validateContent } from '../validate';

const good: CardDef = {
  id: 'offer',
  category: 'career',
  weight: 10,
  cooldown: 3,
  once: true,
  when: {
    minRound: 2, maxRound: 18, cities: ['home'], notCities: ['haven'], employed: true, careers: ['office'], minLevel: 0, maxLevel: 2,
    partner: false, minChildren: 0, maxChildren: 3, ownsHome: false, landlord: false, hasMortgage: false, minNetWorth: -500_000,
    maxNetWorth: 900_000_000, minFinanceSkill: 0, maxFinanceSkill: 2, flags: ['asked'], notFlags: ['retired'], holds: 'deposit',
    ownsLadder: 'car', notItems: ['watch_gold'], regimes: ['boom'], cityPropertyReturnAtMostBp: -500,
  },
  options: [
    { effects: { cash: -10_000, protection: { insurance: 'health', coverPct: 50 } } },
    {
      when: { minFinanceSkill: 1 },
      effects: {
        cash: 1, cashSalaryPct: 10, cashNetWorthPct: -5, protection: { flag: 'prenup', coverPct: 100 }, salaryModPct: 5, salaryBoostPct: -50,
        careerSkill: 2, financeSkill: 1, status: -3, focus: 1, recurring: [{ tag: 'bar', kind: 'passive', annual: 100, roundsLeft: null }],
        endRecurring: ['shop'], setFlags: ['asked'], clearFlags: ['dating'], job: { career: 'office', level: 1, levelDelta: 1 }, moveCity: 'haven',
        partner: { salaryPct: 80 }, children: 1, buyItem: { itemId: 'car_basic', pricePct: 60 },
        invest: { assetId: 'gold', amount: 100_000, bonusPct: 10 }, pension: 1_000, loan: 5_000,
        property: { typeId: 'studio', pricePct: 90, downPct: 20, rented: false }, refinance: 'fixed', sellHome: true, homeValuePct: 8,
        lose: { what: 'crypto', pct: 30 }, lifestyleFloor: 2,
      },
      outcomes: [{ weight: 3, effects: { cash: 5 } }, { weight: 1, effects: { partner: null, job: { leave: true } } }],
    },
    {},
  ],
};

function problems(change: (card: Record<string, any>) => void, alter: (c: Content) => void = () => {}): string[] {
  const card = structuredClone(good) as Record<string, any>;
  change(card);
  const content = fixtureContent();
  content.cards = [card as CardDef];
  alter(content);
  return validateContent(content);
}

describe('validateContent: cards', () => {
  it('accepts a card that uses every condition and every effect', () => {
    expect(problems(() => {})).toEqual([]);
  });

  it('checks the card itself', () => {
    expect(problems((c) => (c.id = 'Bad Id'))).toEqual(['card id "Bad Id" is not allowed']);
    expect(problems(() => {}, (c) => (c.cards = [...c.cards, c.cards[0]]))).toEqual(['duplicate card id: offer']);
    expect(problems((c) => (c.category = 'sports'))).toEqual(['card offer has an unknown category: sports']);
    expect(problems((c) => (c.weight = 0))).toEqual(['card offer needs a positive weight']);
    expect(problems((c) => (c.weight = NaN))).toEqual(['card offer needs a positive weight']);
    expect(problems((c) => (c.cooldown = -1))).toEqual(['card offer needs a whole, non-negative cooldown']);
    expect(problems((c) => (c.cooldown = 1.5))).toEqual(['card offer needs a whole, non-negative cooldown']);
    expect(problems((c) => (c.options = [{}]))).toEqual(['card offer needs two or three options']);
    expect(problems((c) => (c.options = [{}, {}, {}, {}]))).toEqual(['card offer needs two or three options']);
    expect(problems((c) => (c.options = 'none'))).toEqual(['card offer needs two or three options']);
  });

  it('keeps the first option safe for an absent player', () => {
    expect(problems((c) => (c.options[0].when = { partner: true }))).toEqual(['card offer option 0 is the default and cannot have a condition']);
    for (const effects of [
      { buyItem: { itemId: 'car_basic', pricePct: 0 } },
      { invest: { assetId: 'gold', amount: 1 } },
      { property: { typeId: 'studio', pricePct: 90, downPct: 20, rented: false } },
    ]) {
      expect(problems((c) => (c.options[0].effects = effects))).toEqual(['card offer option 0 is the default and cannot buy anything']);
    }
  });

  it('ties triggers to world cards', () => {
    expect(problems((c) => (c.category = 'world'))).toEqual(['card offer is a world card and needs a trigger']);
    expect(problems((c) => (c.trigger = {}))).toEqual(['card offer has a trigger but is not a world card']);
    const world = (trigger: unknown) =>
      problems((c) => {
        c.category = 'world';
        c.trigger = trigger;
      });
    expect(world({ regimeBegan: ['recession'], regimes: ['boom'], cryptoBegan: ['winter'], rateChangeAtLeastBp: 75, rateChangeAtMostBp: -75,
      inflationAtLeastBp: 400, anyPropertyReturnAtMostBp: -500, taxReform: true })).toEqual([]);
    expect(world({ weather: 'rain' })).toEqual(['card offer trigger has an unknown part: weather']);
    expect(world({ regimeBegan: ['panic'] })).toEqual(['card offer trigger names an unknown regime: panic']);
    expect(world({ regimes: 'boom' })).toEqual(['card offer trigger needs a list for regimes']);
    expect(world({ cryptoBegan: ['moon'] })).toEqual(['card offer trigger names an unknown crypto phase: moon']);
    expect(world({ rateChangeAtLeastBp: NaN })).toEqual(['card offer trigger needs a whole number for rateChangeAtLeastBp']);
    expect(world({ taxReform: 'yes' })).toEqual(['card offer trigger needs true or false for taxReform']);
  });

  it('checks conditions, on the card and on an option', () => {
    const when = (over: Record<string, unknown>) => problems((c) => Object.assign(c.when, over));
    expect(when({ mood: 'sad' })).toEqual(['card offer condition has an unknown part: mood']);
    expect(problems((c) => (c.options[1].when = { mood: 'sad' }))).toEqual(['card offer option 1 condition has an unknown part: mood']);
    expect(when({ cities: ['atlantis'] })).toEqual(['card offer condition names an unknown city: atlantis']);
    expect(when({ notCities: ['atlantis'] })).toEqual(['card offer condition names an unknown city: atlantis']);
    expect(when({ cities: 'home' })).toEqual(['card offer condition needs a list for cities']);
    expect(when({ careers: ['pirate'] })).toEqual(['card offer condition names an unknown career: pirate']);
    expect(when({ ownsLadder: 'boat' })).toEqual(['card offer condition names an unknown ladder: boat']);
    expect(when({ notItems: ['jetpack'] })).toEqual(['card offer condition names an unknown item: jetpack']);
    expect(when({ holds: 'land' })).toEqual(['card offer condition names an unknown holding: land']);
    expect(when({ regimes: ['panic'] })).toEqual(['card offer condition names an unknown regime: panic']);
    expect(when({ flags: ['x y'] })).toEqual(['card offer condition has a flag that is not allowed: "x y"']);
    expect(when({ notFlags: ['__proto__'] })).toEqual(['card offer condition has a flag that is not allowed: "__proto__"']);
    for (const field of ['minRound', 'maxRound', 'minLevel', 'maxLevel', 'minChildren', 'maxChildren']) {
      expect(when({ [field]: -1 })).toEqual([`card offer condition needs a whole, non-negative number for ${field}`]);
      expect(when({ [field]: 0.5 })).toEqual([`card offer condition needs a whole, non-negative number for ${field}`]);
    }
    for (const field of ['minNetWorth', 'maxNetWorth', 'cityPropertyReturnAtMostBp']) {
      expect(when({ [field]: 0.5 })).toEqual([`card offer condition needs a whole number for ${field}`]);
    }
    for (const field of ['minFinanceSkill', 'maxFinanceSkill']) {
      expect(when({ [field]: 3 })).toEqual([`card offer condition needs 0, 1 or 2 for ${field}`]);
    }
    for (const field of ['employed', 'partner', 'ownsHome', 'landlord', 'hasMortgage']) {
      expect(when({ [field]: 1 })).toEqual([`card offer condition needs true or false for ${field}`]);
    }
    expect(problems((c) => (c.when = 'always'))).toEqual(['card offer condition is not a record']);
  });

  it('checks the numbers in effects', () => {
    const effect = (over: Record<string, unknown>) => problems((c) => Object.assign(c.options[1].effects, over));
    expect(effect({ fame: 5 })).toEqual(['card offer option 1 has an unknown effect: fame']);
    expect(problems((c) => (c.options[1].outcomes[0].effects = { fame: 5 }))).toEqual(['card offer option 1 outcome 0 has an unknown effect: fame']);
    for (const field of ['cash', 'cashSalaryPct', 'cashNetWorthPct', 'salaryModPct', 'salaryBoostPct', 'careerSkill', 'financeSkill', 'status', 'homeValuePct']) {
      expect(effect({ [field]: 0.5 })).toEqual([`card offer option 1 needs a whole number for ${field}`]);
      expect(effect({ [field]: '5' })).toEqual([`card offer option 1 needs a whole number for ${field}`]);
    }
    for (const field of ['loan', 'pension']) {
      expect(effect({ [field]: 0 })).toEqual([`card offer option 1 needs a positive whole number for ${field}`]);
      expect(effect({ [field]: -5 })).toEqual([`card offer option 1 needs a positive whole number for ${field}`]);
    }
    expect(effect({ focus: -1 })).toEqual(['card offer option 1 needs focus from 0 to 10']);
    expect(effect({ focus: 11 })).toEqual(['card offer option 1 needs focus from 0 to 10']);
    expect(effect({ children: 0 })).toEqual(['card offer option 1 needs children from 1 to 4']);
    expect(effect({ children: 5 })).toEqual(['card offer option 1 needs children from 1 to 4']);
    expect(effect({ lifestyleFloor: 4 })).toEqual(['card offer option 1 has a lifestyle floor that is not 0, 1, 2 or 3']);
    expect(effect({ sellHome: 'yes' })).toEqual(['card offer option 1 needs true or false for sellHome']);
    expect(effect({ refinance: 'floating' })).toEqual(['card offer option 1 has an unknown refinance kind: floating']);
    expect(problems((c) => (c.options[1].effects = 'money'))).toEqual(['card offer option 1 has effects that are not a record']);
  });

  it('checks what effects refer to', () => {
    const effect = (over: Record<string, unknown>) => problems((c) => Object.assign(c.options[1].effects, over));
    expect(effect({ protection: { insurance: 'pet', coverPct: 50 } })).toEqual(['card offer option 1 has a protection with an unknown insurance: pet']);
    expect(effect({ protection: { flag: 'x y', coverPct: 50 } })).toEqual(['card offer option 1 has a protection with a flag that is not allowed: "x y"']);
    expect(effect({ protection: { coverPct: 50 } })).toEqual(['card offer option 1 has a protection that names neither an insurance nor a flag']);
    expect(effect({ protection: { insurance: 'health', coverPct: 120 } })).toEqual(['card offer option 1 has a protection cover outside 0..100']);
    expect(effect({ recurring: [{ tag: 'bar', kind: 'tip', annual: 1, roundsLeft: null }] })).toEqual(['card offer option 1 has a recurring entry that is not valid']);
    expect(effect({ recurring: 'bar' })).toEqual(['card offer option 1 needs a list for recurring']);
    for (const field of ['endRecurring', 'setFlags', 'clearFlags']) {
      expect(effect({ [field]: ['x y'] })).toEqual([`card offer option 1 has a name that is not allowed in ${field}: "x y"`]);
      expect(effect({ [field]: 'x' })).toEqual([`card offer option 1 needs a list for ${field}`]);
    }
    expect(effect({ job: { career: 'pirate' } })).toEqual(['card offer option 1 names an unknown career: pirate']);
    expect(effect({ job: { career: 'office', level: 3 } })).toEqual(['card offer option 1 names level 3, which career office does not have']);
    expect(effect({ job: {} })).toEqual(['card offer option 1 has a job change that changes nothing']);
    expect(effect({ job: { levelDelta: 0.5 } })).toEqual(['card offer option 1 needs whole numbers for a job level']);
    expect(effect({ job: { rank: 2 } })).toEqual(['card offer option 1 has a job change with an unknown part: rank']);
    expect(effect({ moveCity: 'atlantis' })).toEqual(['card offer option 1 names an unknown city: atlantis']);
    expect(effect({ partner: { salaryPct: -1 } })).toEqual(['card offer option 1 needs a non-negative partner salary']);
    expect(effect({ buyItem: { itemId: 'jetpack', pricePct: 100 } })).toEqual(['card offer option 1 names an unknown item: jetpack']);
    expect(effect({ buyItem: { itemId: 'car_basic', pricePct: 201 } })).toEqual(['card offer option 1 has an item price outside 0..200 percent']);
    expect(effect({ invest: { assetId: 'tulips', amount: 5 } })).toEqual(['card offer option 1 names an unknown asset: tulips']);
    expect(effect({ invest: { assetId: 'gold', amount: 0 } })).toEqual(['card offer option 1 needs a positive whole amount to invest']);
    expect(effect({ invest: { assetId: 'gold', amount: 5, bonusPct: -1 } })).toEqual(['card offer option 1 has a negative investment bonus']);
    expect(effect({ property: { typeId: 'castle', pricePct: 90, downPct: 20, rented: false } })).toEqual(['card offer option 1 names an unknown property type: castle']);
    expect(effect({ property: { typeId: 'studio', pricePct: 0, downPct: 20, rented: false } })).toEqual(['card offer option 1 has a property price outside 1..200 percent']);
    expect(effect({ property: { typeId: 'studio', pricePct: 90, downPct: 101, rented: false } })).toEqual(['card offer option 1 has a down payment outside 0..100 percent']);
    expect(effect({ property: { typeId: 'studio', pricePct: 90, downPct: 20, rented: 'no' } })).toEqual(['card offer option 1 needs true or false for a property being rented']);
    expect(effect({ lose: { what: 'land', pct: 10 } })).toEqual(['card offer option 1 loses an unknown holding: land']);
    expect(effect({ lose: { what: 'deposit', pct: 101 } })).toEqual(['card offer option 1 has a loss outside 0..100 percent']);
  });

  it('checks outcomes', () => {
    expect(problems((c) => (c.options[1].outcomes = []))).toEqual(['card offer option 1 has an empty list of outcomes']);
    expect(problems((c) => (c.options[1].outcomes[0].weight = 0))).toEqual(['card offer option 1 outcome 0 needs a positive weight']);
    expect(problems((c) => (c.options[1].outcomes = 'luck'))).toEqual(['card offer option 1 has an empty list of outcomes']);
  });

  it('checks the hand size and the weight of a quiet round', () => {
    expect(problems(() => {}, (c) => (c.life.cardsPerRound = 11))).toEqual(['life.cardsPerRound must be a whole number from 0 to 10']);
    expect(problems(() => {}, (c) => (c.life.cardsPerRound = 1.5))).toEqual(['life.cardsPerRound must be a whole number from 0 to 10']);
    expect(problems(() => {}, (c) => (c.world.quietWeight = -1))).toEqual(['world.quietWeight must not be negative']);
  });
});
