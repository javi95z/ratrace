import { expect, test } from 'vitest';
import { AWAY_FLICK, AWAY_SHARE, awayOf, pastAway, RIGHT_GIVE, swipedTo } from './rowSwipe';

test('a row follows the finger to the left, and only gives a little to the right, where nothing is', () => {
  expect(swipedTo(-120)).toBe(-120);
  expect(swipedTo(0)).toBe(0);
  expect(swipedTo(24)).toBeCloseTo(8);
  expect(swipedTo(10_000)).toBeLessThan(RIGHT_GIVE);
});

test('let go past the line (four tenths of its width) it goes, short of it it comes back', () => {
  expect(AWAY_SHARE).toBe(0.4);
  expect(pastAway(-161, 400)).toBe(true);
  expect(pastAway(-159, 400)).toBe(false);
  expect(awayOf(-161, 0, 400)).toBe(true);
  expect(awayOf(-159, 0, 400)).toBe(false);
  // Never measured, no line to cross: only a flick takes it.
  expect(pastAway(-500, 0)).toBe(false);
});

test('flicked to the left it goes however short the drag; flicked back, it stays however far it went', () => {
  expect(awayOf(-30, -AWAY_FLICK, 400)).toBe(true);
  expect(awayOf(-30, -AWAY_FLICK, 0)).toBe(true);
  expect(awayOf(-300, AWAY_FLICK, 400)).toBe(false);
  // To the right, never.
  expect(awayOf(20, -2000, 400)).toBe(false);
});
