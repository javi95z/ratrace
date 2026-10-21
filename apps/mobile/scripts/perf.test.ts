import { expect, test } from 'vitest';
import { lineOf, median } from './perf';

test('a budget is the median of its runs: the middle one, or the mean of the middle two', () => {
  expect(median([300, 120, 180, 150, 200])).toBe(180);
  expect(median([4, 1, 3, 2])).toBe(2.5);
  expect(median([])).toBeNaN();
});

test('a line the probe tells is printed with what it measured: a stage drawn from the touch, or the frames of a second', () => {
  expect(lineOf({ kind: 'drawn', name: 'stage: cards', wall: 0, drawnMs: 123.4, commitMs: 80.2, what: 'touch' })).toBe(`drawn  ${'stage: cards'.padEnd(28)} 123 ms (commit 80 ms) from touch`);
  expect(lineOf({ kind: 'drawn', name: 'home', wall: 0, drawnMs: null, commitMs: null, what: null })).toContain('(no touch before it)');
  expect(lineOf({ kind: 'drawn', name: 'tab: shop', wall: 0, drawnMs: 90, commitMs: 60, settledMs: 240.4, longestFrameMs: 120, what: 'touch' })).toContain('90 ms (commit 60 ms), settled 240 ms (longest frame 120 ms) from touch');
  expect(lineOf({ kind: 'frames', wall: 0, ui: { frames: 60, worstMs: 17.1, missed: 0 }, js: { frames: 58, worstMs: 40, missed: 2 } })).toBe('frames ui 60 (worst 17.1 ms, missed 0)  js 58 (worst 40 ms, missed 2)');
});
