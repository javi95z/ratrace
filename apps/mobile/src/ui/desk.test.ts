import { expect, test } from 'vitest';
import { useIsDesk, useIsWide, WIDE_COLUMN } from './desk';
import { SHELL_WIDTH } from './theme';

test('the phone has no desk and no wider page: one column of 448 at every width, as it has always been', () => {
  expect(useIsDesk()).toBe(false);
  expect(useIsWide()).toBe(false);
  expect(WIDE_COLUMN).toBe(SHELL_WIDTH);
});
