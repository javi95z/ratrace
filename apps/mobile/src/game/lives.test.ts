import { lives } from '@ratrace/content';
import { describe, expect, it } from 'vitest';
import { anotherLife, lifeRows } from './lives';

describe('the rows the open lives are laid in', () => {
  it('lays the chosen life across a row of its own and the others two to a row, as the web\'s dense grid does', () => {
    expect(lifeRows(['a', 'b', 'c'], 'a')).toEqual([['a'], ['b', 'c']]);
    expect(lifeRows(['a', 'b', 'c', 'd', 'e'], 'a')).toEqual([['a'], ['b', 'c'], ['d', 'e']]);
  });

  it('lets the lives after the chosen one fill the gap it leaves in the row above, instead of leaving a hole', () => {
    // One before it: the chosen life cannot sit in the row of that one, so the next life takes the second place beside it.
    expect(lifeRows(['a', 'b', 'c'], 'b')).toEqual([['a', 'c'], ['b']]);
    expect(lifeRows(['a', 'b', 'c', 'd', 'e'], 'd')).toEqual([['a', 'b'], ['c', 'e'], ['d']]);
    // The last life, chosen: nothing is left to fill the gap above it, and that life stands alone in its row.
    expect(lifeRows(['a', 'b', 'c'], 'c')).toEqual([['a', 'b'], ['c']]);
    expect(lifeRows(['a', 'b', 'c', 'd'], 'd')).toEqual([['a', 'b'], ['c'], ['d']]);
    // An even number before it leaves no gap.
    expect(lifeRows(['a', 'b', 'c', 'd'], 'c')).toEqual([['a', 'b'], ['c'], ['d']]);
  });

  it('keeps a life alone in its row when the lives run out in the middle of one', () => {
    expect(lifeRows(['a'], 'a')).toEqual([['a']]);
    expect(lifeRows(['a', 'b', 'c', 'd'], 'a')).toEqual([['a'], ['b', 'c'], ['d']]);
  });

  it('lays out a list in which nothing is chosen two to a row', () => {
    expect(lifeRows(['a', 'b', 'c'], 'z')).toEqual([['a', 'b'], ['c']]);
    expect(lifeRows([], 'a')).toEqual([]);
  });

  it('shows every life once, whichever of the twenty is chosen, in rows of one chosen or at most two', () => {
    const ids = lives.map((life) => life.id);
    for (const chosen of ids) {
      const rows = lifeRows(ids, chosen);
      expect(rows.flat().sort(), chosen).toEqual([...ids].sort());
      expect(rows.every((row) => row.length >= 1 && row.length <= 2), chosen).toBe(true);
      expect(rows.filter((row) => row.includes(chosen)), chosen).toEqual([[chosen]]);
      // No row is left half empty but the last, and the one the chosen life stands in the middle of.
      expect(rows.filter((row) => row.length === 1).length, chosen).toBeLessThanOrEqual(2);
    }
  });
});

describe('the life the dice picks', () => {
  const ids = ['a', 'b', 'c', 'd'];

  it('is one of the others, chosen by the random number given', () => {
    expect(anotherLife(ids, 'b', () => 0)).toBe('a');
    expect(anotherLife(ids, 'b', () => 0.34)).toBe('c');
    expect(anotherLife(ids, 'b', () => 0.99)).toBe('d');
  });

  it('is never the life already chosen, whatever the random number', () => {
    for (const chosen of ids) {
      for (let step = 0; step <= 20; step++) expect(anotherLife(ids, chosen, () => step / 20), chosen).not.toBe(chosen);
    }
  });

  it('keeps to the lives there are, even for a random number at the very top', () => {
    expect(anotherLife(ids, 'a', () => 1)).toBe('d');
  });

  it('has no other to pick when there is only one, and then stays on it', () => {
    expect(anotherLife(['a'], 'a', () => 0.5)).toBe('a');
  });

  it('uses the platform\'s random when none is given', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) seen.add(anotherLife(ids, 'a'));
    expect([...seen].sort()).toEqual(['b', 'c', 'd']);
  });
});
