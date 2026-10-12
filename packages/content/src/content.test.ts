import { applyRound, createGame, validateContent, validateStart } from '@ratrace/engine';
import { describe, expect, it } from 'vitest';
import { content } from './content';
import { lives } from './lives';

describe('the v1 content', () => {
  it('is valid', () => {
    expect(validateContent(content)).toEqual([]);
  });

  it('has the size the spec sets', () => {
    expect(content.cities.map((c) => c.id)).toEqual(['madrid', 'london', 'new_york', 'dubai', 'singapore', 'bangkok']);
    expect(content.assets).toHaveLength(19);
    expect(content.careers).toHaveLength(5);
    expect(content.items).toHaveLength(34);
    expect(content.propertyTypes).toHaveLength(5);
    expect(content.cards).toHaveLength(100);
    expect(lives).toHaveLength(6);
  });

  it('has the number of cards the spec sets for each category', () => {
    const count: Record<string, number> = {};
    for (const card of content.cards) count[card.category] = (count[card.category] ?? 0) + 1;
    expect(count).toEqual({
      career: 12, education: 6, business: 8, investing: 10, housing: 8, lifestyle: 10,
      family: 10, health: 5, luck: 8, world: 12, tax: 6, laterLife: 5,
    });
  });

  it('starts every life cleanly', () => {
    for (const life of lives) {
      expect(validateStart(content, life.start), life.id).toEqual([]);
      expect(life.start.life?.lifeId).toBe(life.id);
      const state = createGame({ content, start: life.start }, `start-${life.id}`);
      expect(state.hand.length, life.id).toBeGreaterThan(0);
      expect(applyRound(content, state, { orders: [] }).state.round).toBe(1);
    }
  });
});
