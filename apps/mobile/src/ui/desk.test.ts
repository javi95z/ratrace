import { expect, test, vi } from 'vitest';

// The window a test says, in points.
const screen = vi.hoisted(() => ({ width: 393, height: 852 }));
vi.mock('react-native', () => ({ useWindowDimensions: () => screen }));
const { DESK_WIDTH, useIsDesk, useIsWide, WIDE_COLUMN, WIDE_WIDTH } = await import('./desk');

test('a phone, upright or sideways, is one column: no desk and no wider page', () => {
  // Read as a screen reads it, once a drawing: here a drawing at each size.
  const useDeskAt = (width: number, height: number) => (Object.assign(screen, { width, height }), useIsDesk());
  expect([useDeskAt(393, 852), useDeskAt(852, 393), useDeskAt(430, 932), useDeskAt(932, 430)]).toEqual([false, false, false, false]);
  Object.assign(screen, { width: 393, height: 852 });
  expect(useIsWide()).toBe(false);
});

test('a tablet held sideways has the game\'s three columns; upright, its lists two to a row in the wider page', () => {
  Object.assign(screen, { width: 1210, height: 834 });
  expect(useIsDesk()).toBe(true);
  expect(useIsWide()).toBe(true);
  Object.assign(screen, { width: 834, height: 1210 });
  expect(useIsDesk()).toBe(false);
  expect(useIsWide()).toBe(true);
  expect([DESK_WIDTH, WIDE_WIDTH, WIDE_COLUMN]).toEqual([1024, 640, 672]);
});
