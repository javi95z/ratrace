import type { LayoutChangeEvent } from 'react-native';
import { expect, test } from 'vitest';
import { layoutTop } from './layoutTop.web';

/** A layout event as react-native-web gives it: its numbers whole (offsetTop), and the element it is of. */
const told = (y: number, top: number, parentTop: number): LayoutChangeEvent => {
  const parent = { getBoundingClientRect: () => ({ top: parentTop }) };
  const target = { parentElement: parent, getBoundingClientRect: () => ({ top }) };
  return { nativeEvent: { layout: { x: 0, y, width: 354, height: 100 }, target } } as unknown as LayoutChangeEvent;
};

test('how far down its parent a box stands, on the web, to the fraction Chrome lays it out at, where react-native-web says it in whole pixels', () => {
  // A grid under a pixel heading of 13 (its line 14.296875) and 6 of margin: 20.296875 down, which react-native-web's offsetTop says is 20.
  expect(layoutTop(told(20, 202.296875, 182))).toBe(20.296875);
});

test('an event with no element of its own is read as it is told', () => {
  expect(layoutTop({ nativeEvent: { layout: { x: 0, y: 20, width: 1, height: 1 } } } as unknown as LayoutChangeEvent)).toBe(20);
});
