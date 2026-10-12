import { describe, expect, it } from 'vitest';
import { createGame } from './game';
import { assertInvariants, findInvariantBreaks } from './invariants';
import { fixtureContent, fixtureStart } from './testing/fixture';

const content = fixtureContent();

describe('invariants', () => {
  it('finds nothing wrong with a fresh game', () => {
    const state = createGame({ content, start: fixtureStart() }, 'i');
    expect(findInvariantBreaks(content, state)).toEqual([]);
    expect(() => assertInvariants(content, state)).not.toThrow();
  });

  it('names each broken rule', () => {
    const state = createGame({ content, start: fixtureStart() }, 'i');
    state.player.cash = 0.5;
    state.player.deposit = NaN;
    state.player.positions.nope = { value: 0, basis: -1 };
    state.player.debts.push({ id: 'debt-1', kind: 'personalLoan', principal: 0, fixedRateBp: 0, roundsLeft: 1 });
    state.player.properties.push({
      id: 'property-2', cityId: 'home', typeId: 'flat', value: 1, basis: 1, rented: false, mortgageId: 'debt-9',
    });
    expect(findInvariantBreaks(content, state)).toEqual([
      'cash is not a non-negative whole number: 0.5',
      'deposit is not a non-negative whole number: NaN',
      'position nope basis is not a non-negative whole number: -1',
      'debt debt-1 is fully paid but still listed',
      'position nope is empty but still listed',
      'position nope is not a known asset',
      'property property-2 points at a missing mortgage',
    ]);
  });

  it('checks the fields the life systems will write', () => {
    const state = JSON.parse(JSON.stringify(createGame({ content, start: fixtureStart() }, 'i')));
    state.player.lifestyleTier = 4;
    state.player.cityId = 'atlantis';
    state.player.salaryAnnual = -1;
    state.player.extraExpensesAnnual = 0.5;
    state.player.statusPoints = NaN;
    state.player.escapedAtRound = 99;
    state.player.debts.push({ id: 'debt-1', kind: 'bribe', principal: 5, fixedRateBp: 0, roundsLeft: -1 });
    state.player.properties.push({ id: 'property-2', cityId: 'mars', typeId: 'castle', value: 1, basis: 1, rented: false, mortgageId: null });
    state.timeline.pop();
    expect(findInvariantBreaks(content, state)).toEqual([
      'lifestyleTier is not 0, 1, 2 or 3: 4',
      'city atlantis is not in the content',
      'salaryAnnual is not a non-negative whole number: -1',
      'extraExpensesAnnual is not a non-negative whole number: 0.5',
      'statusPoints is not a non-negative whole number: NaN',
      'escapedAtRound is neither null nor a round number: 99',
      'debt debt-1 has an unknown kind',
      'debt debt-1 roundsLeft is not a non-negative whole number: -1',
      'property property-2 is in an unknown city',
      'property property-2 has an unknown type',
      'timeline has 20 states, expected 21',
    ]);
  });

  it('throws with the round and the state hash', () => {
    const state = createGame({ content, start: fixtureStart() }, 'i');
    state.player.cash = -1;
    expect(() => assertInvariants(content, state)).toThrow(
      /^invariant broken at round 0 \(state [0-9a-f]{16}\): cash is not a non-negative whole number: -1$/,
    );
  });
});
