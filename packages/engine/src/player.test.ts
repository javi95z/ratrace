import { describe, expect, it } from 'vitest';
import { cityOf } from './lookup';
import { newId, newPlayer } from './player';
import { fixtureContent, fixtureStart } from './testing/fixture';

describe('player', () => {
  it('starts from the start config with nothing owned', () => {
    const p = newPlayer({ ...fixtureStart(), cash: 500 });
    expect(p.cash).toBe(500);
    expect(p.cityId).toBe('home');
    expect(p.positions).toEqual({});
    expect(p.properties).toEqual([]);
    expect(p.debts).toEqual([]);
    expect(p.escapedAtRound).toBeNull();
  });

  it('gives starting debts ids', () => {
    const p = newPlayer({
      ...fixtureStart(),
      debts: [{ kind: 'personalLoan', principal: 900_000, fixedRateBp: 600, roundsLeft: 3 }],
    });
    expect(p.debts).toEqual([{ id: 'debt-1', kind: 'personalLoan', principal: 900_000, fixedRateBp: 600, roundsLeft: 3 }]);
  });

  it('mints increasing ids', () => {
    const p = newPlayer(fixtureStart());
    expect(newId(p, 'property')).toBe('property-1');
    expect(newId(p, 'debt')).toBe('debt-2');
  });

  it('finds a city and throws for an unknown one', () => {
    expect(cityOf(fixtureContent(), 'haven').id).toBe('haven');
    expect(() => cityOf(fixtureContent(), 'atlantis')).toThrow('unknown city: atlantis');
  });
});
