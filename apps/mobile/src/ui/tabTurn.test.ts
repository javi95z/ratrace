import { expect, test } from 'vitest';
import { draggedTo, EDGE_GIVE, TURN_FLICK, turnOf } from './tabTurn';

test('the panel follows the finger towards a tab there is, and gives only a little towards none', () => {
  expect(draggedTo(-120, true, true)).toBe(-120);
  expect(draggedTo(120, true, true)).toBe(120);
  const give = draggedTo(-400, true, false);
  expect(give).toBeLessThan(0);
  expect(give).toBeGreaterThan(-EDGE_GIVE);
  expect(Math.abs(draggedTo(400, false, true))).toBeLessThan(EDGE_GIVE);
});

test('let go past a quarter of the panel, a drag to the left brings the next tab and one to the right the tab before', () => {
  expect(turnOf(-101, 0, 400, true, true)).toBe(1);
  expect(turnOf(101, 0, 400, true, true)).toBe(-1);
  expect(turnOf(-99, 0, 400, true, true)).toBe(0);
});

test('a flick turns the tab however short the drag; a flick back the other way keeps it however far it went', () => {
  expect(turnOf(-30, -TURN_FLICK, 400, true, true)).toBe(1);
  expect(turnOf(30, TURN_FLICK, 400, true, true)).toBe(-1);
  expect(turnOf(-300, TURN_FLICK, 400, true, true)).toBe(0);
});

test('never turns to a side with no tab, nor for a panel at rest', () => {
  expect(turnOf(-300, -2000, 400, true, false)).toBe(0);
  expect(turnOf(300, 2000, 400, false, true)).toBe(0);
  expect(turnOf(0, 0, 400, true, true)).toBe(0);
});
