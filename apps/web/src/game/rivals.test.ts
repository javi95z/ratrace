import { content, lives } from '@ratrace/content';
import { createGame } from '@ratrace/engine';
import { describe, expect, it } from 'vitest';
import { rivalNews, rivalsOf } from './rivals';

const timeline = createGame({ content, start: lives[0].start }, 'rivals').timeline;
const history = timeline.map((_, r) => 10_000_00 + r * 20_000_00);

describe('rivals', () => {
  it('live a whole life beside the player, the same each time for one life and another for the next', () => {
    const rivals = rivalsOf(content, timeline, history, 'madrid', 'a', 6);
    expect(rivals.map((rival) => rival.id)).toEqual(['classmate', 'cousin', 'ex']);
    for (const rival of rivals) {
      expect(rival.worth).toHaveLength(timeline.length);
      expect(rival.worth.every((worth) => Number.isSafeInteger(worth) && worth >= 0)).toBe(true);
      expect(rival.name).toBeGreaterThanOrEqual(0);
      expect(rival.name).toBeLessThan(6);
    }
    // The classmate starts where the player did; the cousin with more.
    expect(rivals[0].worth[0]).toBe(history[0]);
    expect(rivals[1].worth[0]).toBeGreaterThan(history[0]);
    expect(rivalsOf(content, timeline, history, 'madrid', 'a', 6)).toEqual(rivals);
    expect(rivalsOf(content, timeline, history, 'madrid', 'b', 6)).not.toEqual(rivals);
  });

  it('only know the rounds already played', () => {
    const early = rivalsOf(content, timeline.slice(0, 5), history.slice(0, 5), 'madrid', 'a', 6);
    const whole = rivalsOf(content, timeline, history, 'madrid', 'a', 6);
    for (let i = 0; i < 3; i++) expect(early[i].worth).toEqual(whole[i].worth.slice(0, 5));
  });

  it('make the paper when one overtakes the player, and say nothing in the first round', () => {
    const rivals = rivalsOf(content, timeline, history, 'madrid', 'a', 6);
    expect(rivalNews(rivals, history, 0)).toBeNull();
    const rich = { ...rivals[2], worth: rivals[2].worth.map((worth, r) => (r === 3 ? history[3] + 1 : 0)), surprises: {} };
    expect(rivalNews([rich], history, 3)).toEqual({ rival: rich, story: 'passedYou' });
  });
});
