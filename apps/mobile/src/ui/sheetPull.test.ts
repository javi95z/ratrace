import { expect, test } from 'vitest';
import { BACK_SPRING, CLOSE_SHARE, FLICK, FLICK_TRAVEL, RUBBER, SLIDE_MS, backSpring, dimOf, letGo, pulledTo, slideMs } from './sheetPull';

test('pulled down, the panel follows the finger point for point', () => {
  expect(pulledTo(0)).toBe(0);
  expect(pulledTo(37)).toBe(37);
  expect(pulledTo(400)).toBe(400);
});

test('pulled up past its rest, it resists: half the finger at first, and never more than RUBBER however far', () => {
  expect(pulledTo(-2)).toBeCloseTo(-1, 1);
  expect(pulledTo(-20)).toBeLessThan(0);
  expect(pulledTo(-20)).toBeGreaterThan(-10);
  expect(pulledTo(-80)).toBeLessThan(pulledTo(-20));
  expect(pulledTo(-10_000)).toBeGreaterThan(-RUBBER);
  expect(pulledTo(-10_000)).toBeLessThan(-RUBBER + 1);
});

test('let go past a third of its height, it closes; short of it, it goes back', () => {
  const height = 600;
  expect(CLOSE_SHARE).toBeCloseTo(1 / 3);
  expect(letGo(199, 0, height)).toBe('back');
  expect(letGo(201, 0, height)).toBe('close');
  expect(letGo(500, 0, height)).toBe('close');
  expect(letGo(-10, 0, height)).toBe('back');
});

test('a quick flick down closes it from anywhere below its rest; a flick back up keeps it, even past the third', () => {
  const height = 600;
  expect(letGo(30, FLICK, height)).toBe('close');
  expect(letGo(30, FLICK - 1, height)).toBe('back');
  // A flick down with the panel above its rest (pulled up, then flung) is a drag that never left it.
  expect(letGo(-5, FLICK * 2, height)).toBe('back');
  expect(letGo(300, -FLICK, height)).toBe('back');
  // Drifting back a little as the finger lifts is still a pull past the third.
  expect(letGo(300, -100, height)).toBe('close');
});

test('a panel not measured yet is never closed by its share: only a flick closes it', () => {
  expect(letGo(300, 0, 0)).toBe('back');
  expect(letGo(30, FLICK, 0)).toBe('close');
});

test('the dimmed page fades as the panel goes down, gone when it has gone its whole height, whole at rest and above it', () => {
  expect(dimOf(0, 600)).toBe(1);
  expect(dimOf(-12, 600)).toBe(1);
  expect(dimOf(300, 600)).toBeCloseTo(0.5);
  expect(dimOf(600, 600)).toBe(0);
  expect(dimOf(900, 600)).toBe(0);
  expect(dimOf(300, 0)).toBe(1);
});

test('the slide away keeps the finger\'s speed when it was quick, and is short either way', () => {
  // 400 points left at 4000 pt/s: 100 ms.
  expect(slideMs(400, 4000)).toBe(100);
  // Let go slowly (or not moving): it leaves at its own pace, never longer than SLIDE_MS.
  expect(slideMs(400, 0)).toBe(SLIDE_MS);
  expect(slideMs(10_000, 100)).toBe(SLIDE_MS);
  // Never so short it is not seen.
  expect(slideMs(5, 9000)).toBeGreaterThanOrEqual(60);
});

test('a flick closes only once the panel has travelled FLICK_TRAVEL: a twitch of the mouse or the finger past the slop is not a close', () => {
  expect(FLICK_TRAVEL).toBeGreaterThanOrEqual(20);
  expect(letGo(FLICK_TRAVEL - 1, FLICK * 3, 600)).toBe('back');
  expect(letGo(FLICK_TRAVEL, FLICK, 600)).toBe('close');
  expect(letGo(12, FLICK * 3, 0)).toBe('back');
});

test('a locked sheet (one that cannot be closed now) gives a little either way and never more than RUBBER', () => {
  expect(pulledTo(0, true)).toBe(0);
  expect(pulledTo(2, true)).toBeCloseTo(1, 1);
  expect(pulledTo(400, true)).toBeGreaterThan(0);
  expect(pulledTo(400, true)).toBeLessThan(RUBBER);
  expect(pulledTo(-400, true)).toBeLessThan(0);
  expect(pulledTo(-400, true)).toBeGreaterThan(-RUBBER);
  // Unlocked, down is the finger's own.
  expect(pulledTo(400, false)).toBe(400);
});

test('the spring back never carries an upward flick past the rest: no gap is ever shown under a panel standing on the foot of the screen', () => {
  expect(backSpring(-5000)).toEqual({ ...BACK_SPRING, velocity: 0, overshootClamping: true });
  expect(backSpring(800)).toEqual({ ...BACK_SPRING, velocity: 800, overshootClamping: true });
});
