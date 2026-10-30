import { expect, test } from 'vitest';
import { drawnScale, PIXEL_SCALE_MAX, READ_SCALE_MAX, scaleMax } from './fontScale';

test('a sentence grows with the phone\'s text size to 1.3 times, the pixel face to 1.15, and both follow it below 1', () => {
  expect(scaleMax('read')).toBe(READ_SCALE_MAX);
  expect(scaleMax('pixel')).toBe(PIXEL_SCALE_MAX);
  expect(drawnScale(1, 'read')).toBe(1);
  expect(drawnScale(1.2, 'read')).toBe(1.2);
  expect(drawnScale(2, 'read')).toBe(1.3);
  expect(drawnScale(1.2, 'pixel')).toBe(1.15);
  expect(drawnScale(0.85, 'pixel')).toBe(0.85);
  expect(drawnScale(0.85, 'read')).toBe(0.85);
});

test('a phone that says nothing of its text size, or nonsense, is taken at its own size', () => {
  expect(drawnScale(Number.NaN, 'read')).toBe(1);
  expect(drawnScale(0, 'pixel')).toBe(1);
});
