// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { focus } from '../testing/fakes';
import { useAskedWhenShown } from './askedWhenShown';

afterEach(cleanup);

/** A screen that draws the answer and counts its drawings. */
function harness<T>(ask: () => Promise<T>, initial: T, same?: (found: T, drawn: T) => boolean) {
  const seen: T[] = [];
  function Screen() {
    seen.push(useAskedWhenShown(ask, initial, same));
    return null;
  }
  render(<Screen />);
  return seen;
}

/** An ask whose answers come back when the test says, in any order. */
function held<T>() {
  const waiting: Array<(answer: T) => void> = [];
  return { ask: () => new Promise<T>((resolve) => void waiting.push(resolve)), waiting };
}

test('an answer to an older ask that comes after the screen was shown again is dropped: the newer one stays drawn', async () => {
  const { ask, waiting } = held<string>();
  const seen = harness(ask, 'none');
  await act(async () => focus.again());
  expect(waiting).toHaveLength(2);
  await act(async () => waiting[1]('newer'));
  await act(async () => waiting[0]('older'));
  expect(seen.at(-1)).toBe('newer');
  expect(seen).not.toContain('older');
});

test('asked again and told the same, by the given likeness, the screen is not drawn again', async () => {
  let answer = { count: 2 };
  const seen = harness(async () => answer, null as { count: number } | null, (found, drawn) => found?.count === drawn?.count);
  await act(async () => undefined);
  const drawn = seen.length;
  answer = { count: 2 };
  await act(async () => focus.again());
  expect(seen).toHaveLength(drawn);
  answer = { count: 3 };
  await act(async () => focus.again());
  expect(seen.at(-1)).toEqual({ count: 3 });
});

test('an ask that fails leaves the answer drawn, and says nothing', async () => {
  let fail = false;
  const seen = harness(async () => {
    if (fail) throw new Error('offline');
    return 7;
  }, 0);
  await act(async () => undefined);
  expect(seen.at(-1)).toBe(7);
  fail = true;
  await act(async () => focus.again());
  expect(seen.at(-1)).toBe(7);
});
