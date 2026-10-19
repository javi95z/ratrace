import { businessStageArt } from '@ratrace/content';
import type { Milestone } from '@ratrace/content';
import { describe, expect, it } from 'vitest';
import { routeOf } from './screens/LifeMap';
import { milestoneOf } from '@ratrace/core/game/milestones';

describe('the milestone of a round', () => {
  it('tells the first of each, from the cards of the round to its end, the biggest first', () => {
    const story: Milestone[] = [
      { round: 3, kind: 'home', typeId: 'flat' },
      { round: 4, kind: 'partner' },
      { round: 5, kind: 'child', first: true },
      { round: 5, kind: 'home', typeId: 'house' },
      { round: 8, kind: 'promoted', careerId: 'tech', level: 4, top: true },
      { round: 8, kind: 'child', first: false },
    ];
    expect(milestoneOf(story, 2, 3)).toBe('home');
    expect(milestoneOf(story, 3, 4)).toBe('home');
    expect(milestoneOf(story, 4, 4)).toBe('wedding');
    // A second home is no milestone; a first child is.
    expect(milestoneOf(story, 5, 5)).toBe('child');
    expect(milestoneOf(story, 7, 8)).toBe('promotion');
    expect(milestoneOf(story, 9, 10)).toBeNull();
  });
});

describe('the way a life went', () => {
  it('starts where the life does and follows every move, once each step', () => {
    expect(routeOf('nurse', [{ round: 2, kind: 'moved', cityId: 'london' }, { round: 5, kind: 'moved', cityId: 'madrid' }])).toEqual(['madrid', 'london', 'madrid']);
    expect(routeOf('nurse', [])).toEqual(['madrid']);
  });
});

describe('a business as big as it has grown', () => {
  it('is drawn at three sizes by its capital against its full size', () => {
    expect([0, 32, 34, 66, 67, 100].map((capital) => businessStageArt('bar', capital, 100))).toEqual(['business.bar.1', 'business.bar.1', 'business.bar.2', 'business.bar.2', 'business.bar.3', 'business.bar.3']);
  });
});
