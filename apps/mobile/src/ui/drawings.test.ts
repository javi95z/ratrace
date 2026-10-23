import { expect, test } from 'vitest';
import { dashesOf, raysOf, routeLights, ruleOf } from './drawings';
import { COLORS } from './theme';

test('a rule not yet measured has no dashes; a measured one has a box of 3 by 1 at each place Chrome puts a dash', () => {
  expect(ruleOf(null)).toBe('');
  const path = ruleOf(100);
  const places = dashesOf(100);
  expect(path.match(/Z/g)).toHaveLength(places.length);
  expect(path.startsWith('M0 0h3v1h-3Z')).toBe(true);
  expect(path).toContain(`M${places[places.length - 1]} 0h3v1h-3Z`);
});

test('the rays are eighteen paths from the middle of the foot, and the lights one for each city, the last the largest', () => {
  expect(raysOf(40, 40).match(/M/g)).toHaveLength(18);
  const { line, lights } = routeLights([{ x: 0.2, y: 0.3 }, { x: 0.6, y: 0.5 }], 100, 0.5);
  expect(line).toMatchObject({ path: 'M20 15 L60 25', color: COLORS['gold-500'] });
  expect(lights.map((light) => light.size)).toEqual([1.8, 2.8]);
});
