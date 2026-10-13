// These tests corrupt cards and states on purpose, so they reach into them untyped.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from 'vitest';
import { createGame } from '../game';
import { assertInvariants, findInvariantBreaks } from '../invariants';
import { fixtureContent, fixtureStart } from '../testing/fixture';
import type { CardDef, GameState, LifeStart } from '../types';

const office: LifeStart = { lifeId: 'tester', career: { id: 'office', level: 0 }, careerSkill: 0, financeSkill: 0, focus: 3 };
const content = fixtureContent();
content.cards = ['a', 'b', 'c'].map((id): CardDef => ({ id, category: 'luck', weight: 1, cooldown: 0, options: [{}, {}] }));

function breaks(change: (state: Record<string, any>) => void): string[] {
  const state = JSON.parse(JSON.stringify(createGame({ content, start: { ...fixtureStart(), life: office } }, 'inv')));
  change(state);
  return findInvariantBreaks(content, state as GameState);
}

describe('invariants of the life', () => {
  it('finds nothing wrong with a fresh life', () => {
    expect(breaks(() => {})).toEqual([]);
  });

  it('checks the career', () => {
    expect(breaks((s) => (s.player.life.career = { id: 'pirate', level: 0 }))).toEqual(['life.career is not a known career: pirate']);
    expect(breaks((s) => (s.player.life.career.level = 9))).toEqual(['life.career level 9 does not exist in office']);
    expect(breaks((s) => (s.player.life.career.level = 0.5))).toEqual(['life.career level 0.5 does not exist in office']);
  });

  it('checks every number', () => {
    for (const field of ['baseSalaryAnnual', 'careerSkill', 'investedRounds', 'focusBase', 'focusUsed', 'partnerSalaryPct']) {
      expect(breaks((s) => (s.player.life[field] = -1))).toEqual([`life.${field} is not a non-negative whole number: -1`]);
      expect(breaks((s) => (s.player.life[field] = 1.5))).toEqual([`life.${field} is not a non-negative whole number: 1.5`]);
    }
    for (const field of ['salaryModPct', 'salaryBoostPct', 'bonusStatus']) {
      expect(breaks((s) => (s.player.life[field] = 0.5))).toEqual([`life.${field} is not a whole number: 0.5`]);
      expect(breaks((s) => (s.player.life[field] = null))).toEqual([`life.${field} is not a whole number: null`]);
    }
    expect(breaks((s) => (s.player.life.financeSkill = 3))).toEqual(['life.financeSkill is not 0, 1 or 2: 3']);
    expect(breaks((s) => (s.player.life.rentTier = 2))).toEqual(['life.rentTier is not 0 or 1: 2']);
    expect(breaks((s) => (s.player.life.minLifestyleTier = 4))).toEqual(['life.minLifestyleTier is not 0, 1, 2 or 3: 4']);
    expect(breaks((s) => (s.player.life.minLifestyleTier = 2))).toEqual(['lifestyleTier 1 is below the floor of the life, 2']);
  });

  it('checks the family and the insurance', () => {
    expect(breaks((s) => (s.player.life.partner = 'yes'))).toEqual(['life.partner is not true or false']);
    expect(breaks((s) => (s.player.life.children = [3, 0]))).toEqual(['life.children holds something other than rounds left: 0']);
    expect(breaks((s) => (s.player.life.children = 'two'))).toEqual(['life.children is not a list']);
    expect(breaks((s) => (s.player.life.insurance.health = 1))).toEqual(['life.insurance.health is not true or false']);
  });

  it('checks items and the collection', () => {
    const own = (item: unknown, collection: unknown = ['car_basic', 'trip', 'club']) => (s: Record<string, any>) => {
      s.player.life.items = [item];
      s.player.life.collection = collection;
    };
    expect(breaks(own({ itemId: 'jetpack', value: 0, roundsLeft: null, paid: 0 }))).toEqual(['item jetpack is not in the content']);
    expect(breaks(own({ itemId: 'car_basic', value: -1, roundsLeft: null, paid: 0 }))).toEqual(['item car_basic value is not a non-negative whole number: -1']);
    expect(breaks(own({ itemId: 'car_basic', value: 5, roundsLeft: 2, paid: 0 }))).toEqual(['item car_basic has the wrong shape for a durable']);
    expect(breaks(own({ itemId: 'club', value: 5, roundsLeft: null, paid: 0 }))).toEqual(['item club has the wrong shape for a membership']);
    expect(breaks(own({ itemId: 'trip', value: 0, roundsLeft: null, paid: 0 }))).toEqual(['item trip has the wrong shape for an experience']);
    expect(breaks(own({ itemId: 'trip', value: 0, roundsLeft: 0, paid: 0 }))).toEqual(['item trip has the wrong shape for an experience']);
    expect(breaks(own({ itemId: 'car_basic', value: 5, roundsLeft: null, paid: 0 }, []))).toEqual(['item car_basic is owned but not in the collection']);
    expect(breaks(own({ itemId: 'car_basic', value: 5, roundsLeft: null, paid: 0 }, ['car_basic', 'jetpack']))).toEqual(['collection holds an unknown item: jetpack']);
    expect(
      breaks((s) => {
        s.player.life.items = [{ itemId: 'car_basic', value: 5, roundsLeft: null, paid: 0 }, { itemId: 'car_basic', value: 5, roundsLeft: null, paid: 0 }];
        s.player.life.collection = ['car_basic'];
      }),
    ).toEqual(['item car_basic is owned twice']);
  });

  it('checks recurring entries, flags and the cards seen', () => {
    expect(breaks((s) => (s.player.life.recurring = [{ tag: 'bar', kind: 'passive', annual: -1, roundsLeft: null }]))).toEqual(['life.recurring entry 0 is not valid']);
    const twice = [{ tag: 'bar', kind: 'expense', annual: 0, roundsLeft: null }, { tag: 'bar', kind: 'expense', annual: 0, roundsLeft: 2 }];
    expect(breaks((s) => (s.player.life.recurring = twice))).toEqual(['life.recurring has two entries tagged bar']);
    expect(breaks((s) => (s.player.life.flags = { dating: -1 }))).toEqual(['life.flags.dating is not a round number: -1']);
    expect(breaks((s) => (s.player.life.seen.zzz = 0))).toEqual(['life.seen names an unknown card: zzz']);
    expect(breaks((s) => (s.player.life.seen.a = 0.5))).toEqual(['life.seen.a is not a round number: 0.5']);
  });

  it('checks a pending move', () => {
    expect(breaks((s) => (s.player.life.movingTo = 'atlantis'))).toEqual(['life.movingTo is not a known city: atlantis']);
    expect(breaks((s) => (s.player.life.movingTo = 'home'))).toEqual(['life.movingTo is the city the player already lives in']);
    expect(breaks((s) => (s.player.life.movingTo = 'haven'))).toEqual([]);
  });

  it('checks the phase, the hand and the random stream', () => {
    expect(breaks((s) => (s.phase = 'lunch'))).toEqual(['phase is neither cards nor finance: lunch']);
    expect(breaks((s) => (s.hand = ['a', 'zzz']))).toEqual(['hand holds an unknown card: zzz']);
    expect(breaks((s) => (s.hand = ['a', 'a']))).toEqual(['hand holds a twice']);
    expect(breaks((s) => (s.hand = []))).toEqual(['phase is cards but the hand is empty']);
    expect(breaks((s) => (s.hand = 'a'))).toEqual(['hand is not a list']);
    expect(breaks((s) => (s.rng.cards = [1, 2, 3]))).toEqual(['rng.cards is not a saved random stream']);
    expect(breaks((s) => (s.rng.cards = [1, 2, 3, -4]))).toEqual(['rng.cards is not a saved random stream']);
    expect(breaks((s) => (s.rng.cards = [1, 2, 3, 4.5]))).toEqual(['rng.cards is not a saved random stream']);
    expect(
      breaks((s) => {
        s.round = 20;
        s.finished = true;
      }),
    ).toEqual(['the game is finished but a hand is still drawn']);
  });

  it('refuses a save from before the life existed, with a clear error', () => {
    const state = JSON.parse(JSON.stringify(createGame({ content, start: fixtureStart() }, 'old')));
    delete state.player.life;
    expect(() => assertInvariants(content, state)).toThrow('invariant broken: the state is not a game state');
  });
});
