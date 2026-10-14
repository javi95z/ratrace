import { describe, expect, it } from 'vitest';
import { applyRound, createGame } from '../game';
import { findInvariantBreaks } from '../invariants';
import { fixtureContent, fixtureStart } from '../testing/fixture';
import type { GameState, LifeStart, LifeState } from '../types';
import { deriveExpenses, derivePassive, deriveSalary, deriveStatus, itemStatus, refreshDerived, statusParts } from './derive';

const content = fixtureContent();
const office: LifeStart = { lifeId: 'tester', career: { id: 'office', level: 0 }, careerSkill: 0, financeSkill: 0, focus: 3 };

function life(start: Partial<LifeStart> = {}, patch: Partial<LifeState> = {}, over: Partial<ReturnType<typeof fixtureStart>> = {}): GameState {
  const state = createGame({ content, start: { ...fixtureStart(), ...over, life: { ...office, ...start } } }, 'derive');
  Object.assign(state.player.life, patch);
  refreshDerived(state.player, content, 0);
  return state;
}

describe('salary', () => {
  it('comes from the career level and the city median', () => {
    expect(deriveSalary(life().player, content)).toBe(2_400_000);
    expect(deriveSalary(life({ career: { id: 'office', level: 2 } }).player, content)).toBe(4_500_000);
    expect(deriveSalary(life({}, {}, { cityId: 'haven' }).player, content)).toBe(4_800_000);
  });

  it("applies lasting raises and this round's boost", () => {
    expect(deriveSalary(life({}, { salaryModPct: 10 }).player, content)).toBe(2_640_000);
    expect(deriveSalary(life({}, { salaryModPct: 10, salaryBoostPct: 15 }).player, content)).toBe(3_000_000);
    expect(deriveSalary(life({}, { salaryModPct: -150 }).player, content)).toBe(0);
  });

  it('adds a working partner, and is zero with no career and no fixed salary', () => {
    expect(deriveSalary(life({}, { partner: true, partnerSalaryPct: 100 }).player, content)).toBe(2_400_000 + 3_000_000);
    expect(deriveSalary(life({ career: null }, {}, { salaryAnnual: 0 }).player, content)).toBe(0);
    expect(deriveSalary(life({ career: null }, { partner: true, partnerSalaryPct: 50 }, { salaryAnnual: 0 }).player, content)).toBe(1_500_000);
  });

  it('is the fixed salary of a life with no career, with the same raises and boosts', () => {
    const state = createGame({ content, start: fixtureStart() }, 'plain');
    expect(state.player.life.career).toBeNull();
    expect(state.player.salaryAnnual).toBe(3_000_000);
    expect(deriveSalary(life({ career: null }, { salaryModPct: -20, salaryBoostPct: 30 }).player, content)).toBe(3_300_000);
  });
});

describe('other expenses and passive income', () => {
  it('adds children, partner, insurance, item upkeep and recurring expenses', () => {
    const state = life({}, {
      partner: true,
      children: [11, 4],
      insurance: { health: true, home: false, life: true, liability: false },
      items: [{ itemId: 'car_basic', value: 0, roundsLeft: null, paid: 0, age: 0 }, { itemId: 'club', value: 0, roundsLeft: null, paid: 0, age: 0 }],
      recurring: [
        { tag: 'school', kind: 'expense', annual: 100_000, roundsLeft: 3 },
        { tag: 'bar', kind: 'passive', annual: 700_000, roundsLeft: null },
      ],
    });
    // Two children 900,000; partner 900,000; health 72,000; life 36,000; car 120,000; club 240,000; school 100,000.
    expect(deriveExpenses(state.player, content)).toBe(2_368_000);
    expect(derivePassive(state.player)).toBe(700_000);
  });

  it('is zero for a single player who owns nothing', () => {
    expect(deriveExpenses(life().player, content)).toBe(0);
    expect(derivePassive(life().player)).toBe(0);
  });
});

describe('status', () => {
  it('counts the best item of a ladder in full and the rest in part', () => {
    const one = life({}, { items: [{ itemId: 'car_basic', value: 0, roundsLeft: null, paid: 0, age: 0 }] });
    const two = life({}, { items: [{ itemId: 'car_basic', value: 0, roundsLeft: null, paid: 0, age: 0 }, { itemId: 'car_sports', value: 0, roundsLeft: null, paid: 0, age: 0 }] });
    expect(deriveStatus(one.player, content, 0)).toBe(4 + 2);
    expect(deriveStatus(two.player, content, 0)).toBe(40 + 1 + 2);
  });

  it('adds job, home, rent tier, lifestyle, city and lasting bonuses, and experiences while they last', () => {
    const base = life({ career: { id: 'office', level: 2 }, rentTier: 0 });
    expect(deriveStatus(base.player, content, 0)).toBe(6);
    const fancy = life({ career: { id: 'office', level: 2 } }, {
      bonusStatus: 7,
      items: [{ itemId: 'trip', value: 0, roundsLeft: 2, paid: 0, age: 0 }],
    }, { cityId: 'haven', lifestyleTier: 3 });
    expect(deriveStatus(fancy.player, content, 0)).toBe(6 + 2 + 5 + 9 + 7 + 10);
  });

  it('is never negative', () => {
    expect(deriveStatus(life({}, { bonusStatus: -50 }).player, content, 0)).toBe(0);
  });

  it('counts a rented room as neutral while the player is young, and against them more at each step the rules name', () => {
    const late = fixtureContent();
    late.life.agedStatus.room = [{ fromRound: 0, status: 0 }, { fromRound: 3, status: -4 }, { fromRound: 9, status: -9 }];
    const room = life({ career: { id: 'office', level: 2 }, rentTier: 0 }).player;
    const flat = life({ career: { id: 'office', level: 2 }, rentTier: 1 }).player;
    expect([2, 3, 9].map((round) => deriveStatus(room, late, round))).toEqual([6, 2, 0]);
    expect(statusParts(room, late, 9).home).toBe(-9);
    expect([2, 3].map((round) => statusParts(room, late, round).home)).toEqual([0, -4]);
    // A flat is a flat at any age, and so is a home of one's own.
    expect([2, 3].map((round) => statusParts(flat, late, round).home)).toEqual([2, 2]);
    const owner = life({ properties: [{ typeId: 'house', rented: false }] }).player;
    expect(statusParts(owner, late, 0).home).toBe(statusParts(owner, late, 9).home);
  });

  it('takes status off a thing that ages as it takes value off it, down to a floor, and off nothing else', () => {
    const aging = fixtureContent();
    aging.life.agingLadders = ['car'];
    aging.life.agingFloorPct = 25;
    const car = aging.items.find((item) => item.id === 'car_basic')!;
    const watch = aging.items.find((item) => item.id === 'watch_gold')!;
    // The car loses a fifth of its value a round, and of its status with it: 4, 3.2, 2.56, 2.05, 1.64, 1.31, and then the floor of a quarter.
    expect([0, 1, 2, 3, 4, 5, 6, 7, 20].map((age) => itemStatus(car, age, aging))).toEqual([4, 3, 3, 2, 2, 1, 1, 1, 1]);
    const sports = aging.items.find((item) => item.id === 'car_sports')!;
    expect(itemStatus(sports, 0, aging)).toBe(40);
    expect(itemStatus(sports, 4, aging)).toBe(Math.round(40 * 0.85 ** 4));
    expect(itemStatus(sports, 50, aging)).toBe(10);
    // A watch that gains value gains no status, and loses none; nor does a thing in a ladder that does not age.
    expect([0, 5, 20].map((age) => itemStatus(watch, age, aging))).toEqual([12, 12, 12]);
    aging.life.agingLadders = ['car', 'watch'];
    expect(itemStatus(watch, 20, aging)).toBe(12);
    expect(itemStatus(car, 5, content)).toBe(4);
  });

  it('counts an aged thing for what it gives now, in the status of the player and round after round', () => {
    const aging = fixtureContent();
    aging.life.agingLadders = ['car'];
    let state = createGame({ content: aging, start: { ...fixtureStart(), cash: 500_000_000 } }, 'aging');
    const before = state.player.statusPoints;
    state = applyRound(aging, state, { orders: [{ type: 'buyItem', itemId: 'car_sports' }] }).state;
    const seen: number[] = [];
    for (let round = 0; round < 4; round++) {
      seen.push(statusParts(state.player, aging, state.round).items);
      expect(findInvariantBreaks(aging, state)).toEqual([]);
      state = applyRound(aging, state, { orders: [] }).state;
    }
    // Bought in the first round, it is a round old when the next opens.
    expect(seen).toEqual([1, 2, 3, 4].map((age) => itemStatus(aging.items.find((item) => item.id === 'car_sports')!, age, aging)));
    expect(seen[0]).toBeLessThan(40);
    expect(before).toBeLessThan(state.player.statusPoints);
    // Sold and bought again, it is new again.
    const renewed = applyRound(aging, state, { orders: [{ type: 'sellItem', itemId: 'car_sports' }, { type: 'buyItem', itemId: 'car_sports' }] }).state;
    expect(renewed.player.life.items[0].age).toBe(1);
  });

  it('loses what a way of living below the ordinary takes, more as the years go by, and shows that part as it is', () => {
    const lean = fixtureContent();
    lean.life.lifestyleStatus = [-4, 0, 0, 9];
    lean.life.agedStatus.frugal = [{ fromRound: 0, status: -4 }, { fromRound: 3, status: -7 }];
    const at = (lifestyleTier: 0 | 1) => {
      const p = structuredClone(life({ career: { id: 'office', level: 2 }, rentTier: 0 }).player);
      p.lifestyleTier = lifestyleTier;
      return p;
    };
    expect(deriveStatus(at(1), lean, 0)).toBe(6);
    expect(deriveStatus(at(0), lean, 0)).toBe(2);
    expect(statusParts(at(0), lean, 0).lifestyle).toBe(-4);
    expect(statusParts(at(0), lean, 3).lifestyle).toBe(-7);
    // The ordinary way of living costs nothing at any age.
    expect(statusParts(at(1), lean, 9).lifestyle).toBe(0);
  });

  it('says where it comes from, part by part', () => {
    const fancy = life({ career: { id: 'office', level: 2 } }, {
      bonusStatus: 7,
      items: [{ itemId: 'trip', value: 0, roundsLeft: 2, paid: 0, age: 0 }],
    }, { cityId: 'haven', lifestyleTier: 3 });
    expect(statusParts(fancy.player, content, 0)).toEqual({ job: 6, home: 2, city: 5, lifestyle: 9, bonus: 7, items: 10, network: 0 });
    // A loss from a card shows as it is, though the status itself stops at zero.
    expect(statusParts(life({}, { bonusStatus: -50 }).player, content, 0).bonus).toBe(-50);
  });

  it('counts the home the player owns and lives in, instead of the rent tier', () => {
    const owner = life({ properties: [{ typeId: 'house', rented: false }, { typeId: 'villa', rented: true }] });
    expect(owner.player.properties).toHaveLength(2);
    expect(deriveStatus(owner.player, content, 0)).toBe(10);
  });
});

describe('starting a life', () => {
  it('gives the starting homes at the opening price with no mortgage', () => {
    const state = life({ properties: [{ typeId: 'studio', rented: false }] });
    expect(state.player.properties).toEqual([
      { id: 'property-1', cityId: 'home', typeId: 'studio', value: 15_000_000, basis: 15_000_000, rented: false, mortgageId: null },
    ]);
    expect(state.player.debts).toEqual([]);
  });

  it('starts with the derived fields in step with the life', () => {
    const state = life({ career: { id: 'office', level: 1 }, recurring: [{ tag: 'home', kind: 'expense', annual: 60_000, roundsLeft: null }] });
    expect(state.player.salaryAnnual).toBe(3_300_000);
    expect(state.player.extraExpensesAnnual).toBe(60_000);
    expect(state.player.statusPoints).toBe(3 + 2);
    expect(findInvariantBreaks(content, state)).toEqual([]);
  });

  it('fails the invariant check when a derived field is out of step', () => {
    const state = life();
    state.player.salaryAnnual += 1;
    state.player.statusPoints = 99;
    expect(findInvariantBreaks(content, state)).toEqual([
      'salaryAnnual is out of step with the life: 2400001, expected 2400000',
      'statusPoints is out of step with the life: 99, expected 2',
    ]);
  });
});
