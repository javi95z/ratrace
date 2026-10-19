import { lives } from '@ratrace/content';
import { describe, expect, it } from 'vitest';
import { DIFFICULTY } from './difficulty';

describe('the difficulty of the lives', () => {
  it('is judged for every life there is, and for no other', () => {
    expect(Object.keys(DIFFICULTY).sort()).toEqual(lives.map((life) => life.id).sort());
  });

  it('has easy, middling and hard lives among those open from the start', () => {
    const open = lives.filter((life) => life.unlock === 'default').map((life) => DIFFICULTY[life.id]);
    expect(open).toContain(1);
    expect(new Set(Object.values(DIFFICULTY))).toEqual(new Set([1, 2, 3]));
  });
});
