import { describe, expect, it } from 'vitest';
import { createGame } from '../game';
import { findInvariantBreaks } from '../invariants';
import { fixtureContent, fixtureStart } from '../testing/fixture';
import type { GameState, LifeStart, LifeState } from '../types';
import { deriveExpenses, derivePassive, deriveSalary, deriveStatus, refreshDerived, statusParts } from './derive';

const content = fixtureContent();
const office: LifeStart = { lifeId: 'tester', career: { id: 'office', level: 0 }, careerSkill: 0, financeSkill: 0, focus: 3 };

function life(start: Partial<LifeStart> = {}, patch: Partial<LifeState> = {}, over: Partial<ReturnType<typeof fixtureStart>> = {}): GameState {
  const state = createGame({ content, start: { ...fixtureStart(), ...over, life: { ...office, ...start } } }, 'derive');
  Object.assign(state.player.life, patch);
  refreshDerived(state.player, content);
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
      items: [{ itemId: 'car_basic', value: 0, roundsLeft: null }, { itemId: 'club', value: 0, roundsLeft: null }],
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
    const one = life({}, { items: [{ itemId: 'car_basic', value: 0, roundsLeft: null }] });
    const two = life({}, { items: [{ itemId: 'car_basic', value: 0, roundsLeft: null }, { itemId: 'car_sports', value: 0, roundsLeft: null }] });
    expect(deriveStatus(one.player, content)).toBe(4 + 2);
    expect(deriveStatus(two.player, content)).toBe(40 + 1 + 2);
  });

  it('adds job, home, rent tier, lifestyle, city and lasting bonuses, and experiences while they last', () => {
    const base = life({ career: { id: 'office', level: 2 }, rentTier: 0 });
    expect(deriveStatus(base.player, content)).toBe(6);
    const fancy = life({ career: { id: 'office', level: 2 } }, {
      bonusStatus: 7,
      items: [{ itemId: 'trip', value: 0, roundsLeft: 2 }],
    }, { cityId: 'haven', lifestyleTier: 3 });
    expect(deriveStatus(fancy.player, content)).toBe(6 + 2 + 5 + 9 + 7 + 10);
  });

  it('is never negative', () => {
    expect(deriveStatus(life({}, { bonusStatus: -50 }).player, content)).toBe(0);
  });

  it('says where it comes from, part by part', () => {
    const fancy = life({ career: { id: 'office', level: 2 } }, {
      bonusStatus: 7,
      items: [{ itemId: 'trip', value: 0, roundsLeft: 2 }],
    }, { cityId: 'haven', lifestyleTier: 3 });
    expect(statusParts(fancy.player, content)).toEqual({ job: 6, home: 2, city: 5, lifestyle: 9, bonus: 7, items: 10 });
    // A loss from a card shows as it is, though the status itself stops at zero.
    expect(statusParts(life({}, { bonusStatus: -50 }).player, content).bonus).toBe(-50);
  });

  it('counts the home the player owns and lives in, instead of the rent tier', () => {
    const owner = life({ properties: [{ typeId: 'house', rented: false }, { typeId: 'villa', rented: true }] });
    expect(owner.player.properties).toHaveLength(2);
    expect(deriveStatus(owner.player, content)).toBe(10);
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
