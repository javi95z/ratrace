// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest';
import { copy } from './copy.web';

afterEach(() => {
  delete (navigator as { clipboard?: unknown }).clipboard;
});

/** A browser whose clipboard takes the text, or says no. */
function clipboard(answer: 'takes' | Error) {
  const writeText = vi.fn<(text: string) => Promise<void>>(async () => {
    if (answer !== 'takes') throw answer;
  });
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
  return writeText;
}

test('copy writes the text to the browser\'s clipboard and then tells', async () => {
  const writeText = clipboard('takes');
  const told = vi.fn();
  await expect(copy('AB12CD34', told)).resolves.toBe(true);
  expect(writeText).toHaveBeenCalledWith('AB12CD34');
  expect(told).toHaveBeenCalledTimes(1);
});

test('where the browser keeps the clipboard to itself nothing is told: the code is on screen to be copied by hand', async () => {
  const told = vi.fn();
  clipboard(new DOMException('not allowed', 'NotAllowedError'));
  await expect(copy('AB12CD34', told)).resolves.toBe(false);
  expect(told).not.toHaveBeenCalled();
});

test('a browser with no clipboard at all (an address that is not secure) is the same', async () => {
  const told = vi.fn();
  await expect(copy('AB12CD34', told)).resolves.toBe(false);
  expect(told).not.toHaveBeenCalled();
});
