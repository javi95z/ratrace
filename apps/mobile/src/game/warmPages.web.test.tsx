// @vitest-environment jsdom
import { act, render } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';

/*
 * The front door, once it is idle, starts loading the code of the two pages a tap on it most often opens (`/new` and `/play`), as the Next web's
 * links prefetch theirs: the tap then waits for no code. Loading them is all it does: nothing of them is drawn.
 */

const loaded = { new: 0, play: 0 };
const cards: string[] = [];
vi.mock('./languageWords', () => ({ loadCardWords: (locale: string) => (cards.push(locale), Promise.resolve()) }));
vi.mock('../app/[locale]/new', () => {
  loaded.new += 1;
  return { default: () => null };
});
vi.mock('../app/[locale]/play', () => {
  loaded.play += 1;
  return { default: () => null };
});

const { useWarmPages } = await import('./warmPages');

afterEach(() => {
  vi.unstubAllGlobals();
});

const { Language } = await import('../ui/text');

function FrontDoor() {
  useWarmPages();
  return null;
}

test('loads the code of New and Play once the page is idle, and the cards of its language a life is played with, and not before', async () => {
  const idle: Array<() => void> = [];
  vi.stubGlobal('requestIdleCallback', (run: () => void) => idle.push(run));
  vi.stubGlobal('cancelIdleCallback', () => undefined);
  render(
    <Language.Provider value="es">
      <FrontDoor />
    </Language.Provider>,
  );
  await act(async () => {
    await new Promise((settled) => setTimeout(settled, 0));
  });
  expect(loaded).toEqual({ new: 0, play: 0 });
  expect(cards).toEqual([]);
  await act(async () => {
    for (const run of idle.splice(0)) run();
    await new Promise((settled) => setTimeout(settled, 0));
  });
  expect(loaded).toEqual({ new: 1, play: 1 });
  expect(cards).toEqual(['es']);
});
