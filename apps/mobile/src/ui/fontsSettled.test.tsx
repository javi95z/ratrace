// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { useFontsSettled } from './fonts';

afterEach(() => vi.restoreAllMocks());

test('the splash waits while the fonts load, and lifts once they are in', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const { result, rerender } = renderHook(({ state }) => useFontsSettled(state), { initialProps: { state: [false, null] as [boolean, Error | null] } });
  expect(result.current).toBe(false);
  rerender({ state: [true, null] });
  expect(result.current).toBe(true);
  expect(warn).not.toHaveBeenCalled();
});

test('fonts that fail to load never hold the splash: the game goes on in the system font, and the failure is told once', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const failure = new Error('no Jersey');
  const { result, rerender } = renderHook(({ state }) => useFontsSettled(state), { initialProps: { state: [false, failure] as [boolean, Error | null] } });
  expect(result.current).toBe(true);
  rerender({ state: [false, failure] });
  expect(warn).toHaveBeenCalledTimes(1);
  expect(warn.mock.calls[0]).toContain(failure);
});
