import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { KEYFRAMES, REST, countUpValue, frameAt, frameFor, isBuilt, stepped } from './motion';

test('steps(n, end) holds each value to the end of its slice and is 1 at t = 1', () => {
  expect(stepped(0, 4)).toBe(0);
  expect(stepped(0.24, 4)).toBe(0);
  expect(stepped(0.26, 4)).toBe(0.25);
  expect(stepped(0.99, 4)).toBe(0.75);
  expect(stepped(1, 4)).toBe(1);
  expect(stepped(0.26, 4, 'end')).toBe(0.25);
});

test('steps(n, start) jumps at the start of each slice and is 0 only at t = 0', () => {
  expect(stepped(0, 2, 'start')).toBe(0);
  expect(stepped(0.01, 2, 'start')).toBe(0.5);
  expect(stepped(0.5, 2, 'start')).toBe(0.5);
  expect(stepped(0.51, 2, 'start')).toBe(1);
  expect(stepped(1, 2, 'start')).toBe(1);
});

test('KEYFRAMES matches every --animate-* declaration of globals.css', () => {
  const css = readFileSync(new URL('../../../web/src/app/globals.css', import.meta.url), 'utf8');
  const declared = [...css.matchAll(/--animate-([a-z]+):\s*([a-z]+)\s+([\d.]+)s\s+steps\((\d+),\s*(start|end)\)(?:\s+(none|backwards|forwards|both))?(?:\s+(infinite))?;/g)];
  expect(declared.length).toBe(Object.keys(KEYFRAMES).length);
  for (const [, name, frames, secs, steps, jump, fill, infinite] of declared) {
    expect(frames).toBe(name);
    const k = (KEYFRAMES as Record<string, (typeof KEYFRAMES)['rise']>)[name];
    expect(k, name).toBeDefined();
    expect(k.ms, name).toBe(Math.round(Number(secs) * 1000));
    expect(k.steps, name).toBe(Number(steps));
    expect(k.jump, name).toBe(jump);
    expect(k.fill, name).toBe(fill ?? 'none');
    expect(k.loop, name).toBe(infinite === 'infinite');
  }
});

test('rise climbs 8 px and fades in over four steps', () => {
  expect(frameAt('rise', 0)).toEqual({ opacity: 0, translateY: 8, scale: 1 });
  expect(frameAt('rise', 0.3)).toEqual({ opacity: 0.25, translateY: 6, scale: 1 });
  expect(frameAt('rise', 0.99)).toEqual({ opacity: 0.75, translateY: 2, scale: 1 });
  expect(frameAt('rise', 1)).toEqual(REST);
});

test('blink is shown for the first half of its second and hidden for the rest', () => {
  expect(frameAt('blink', 0).opacity).toBe(1);
  expect(frameAt('blink', 0.4).opacity).toBe(1);
  expect(frameAt('blink', 0.5).opacity).toBe(1);
  expect(frameAt('blink', 0.51).opacity).toBe(0);
  expect(frameAt('blink', 0.99).opacity).toBe(0);
});

test('pop jumps and lands, stepping inside each of its three intervals', () => {
  expect(frameAt('pop', 0)).toEqual(REST);
  expect(frameAt('pop', 0.35)).toEqual({ opacity: 1, translateY: -6, scale: 1.15 });
  expect(frameAt('pop', 0.7)).toEqual({ opacity: 1, translateY: 0, scale: 0.94 });
  expect(frameAt('pop', 1)).toEqual(REST);
  // half way up: three of six steps
  expect(frameAt('pop', 0.35 / 2 + 0.001).translateY).toBeCloseTo(-3);
});

test('sink shrinks to 0.7 at the middle and comes back', () => {
  expect(frameAt('sink', 0)).toEqual(REST);
  expect(frameAt('sink', 0.5)).toEqual({ opacity: 0.5, translateY: 0, scale: 0.7 });
  expect(frameAt('sink', 1)).toEqual(REST);
});

test('fill modes decide what is shown before the start and after the end', () => {
  // rise is `backwards`: its first frame before it starts, its own state after
  expect(frameFor('rise', 'before', 0)).toEqual({ opacity: 0, translateY: 8, scale: 1 });
  expect(frameFor('rise', 'after', 1)).toEqual(REST);
  // pop has no fill: nothing is held before it starts
  expect(frameFor('pop', 'before', 0)).toEqual(REST);
  expect(frameFor('pop', 'running', 0.35)).toEqual(frameAt('pop', 0.35));
});

test('only the effects the kit needs now have frames', () => {
  const built = Object.keys(KEYFRAMES).filter((n) => isBuilt(n as keyof typeof KEYFRAMES));
  expect(built.sort()).toEqual(['blink', 'pop', 'rise', 'sink']);
});

test('a count-up runs ease-out cubic from its start to its target and rounds', () => {
  expect(countUpValue(0, 1000, 0)).toBe(0);
  expect(countUpValue(0, 1000, 0.5)).toBe(875);
  expect(countUpValue(0, 1000, 1)).toBe(1000);
  expect(countUpValue(100, 0, 1)).toBe(0);
  expect(countUpValue(0, 10, 2)).toBe(10);
});
