// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest';

/*
 * On the web a page carries the words of its own language only, as the Next web's: each language is a chunk of its own, fetched when a page first speaks
 * it, and a page that speaks one waits for it. (The build's machine, which draws every page in its language, has them all from the start: the export's
 * pages and serverRender.web.test.tsx show it.)
 */

afterEach(() => {
  vi.doUnmock('./languages/ru');
  vi.resetModules();
});

/**
 * The module as a browser's first visit finds it, no language in yet (the test setup's are another copy's), with React and the renderer of that copy.
 * With `slowRussian`, the Russian chunk comes that many milliseconds late, as a slow network (or a machine under load) brings it.
 */
async function freshWords(slowRussian = 0) {
  vi.resetModules();
  if (slowRussian > 0) {
    vi.doMock('./languages/ru', async (original) => {
      await new Promise((arrived) => setTimeout(arrived, slowRussian));
      return original();
    });
  }
  const words = await import('./languageWords');
  const content = await import('@ratrace/content');
  const { Suspense } = await import('react');
  const { act, render, screen } = await import('@testing-library/react');
  return { ...words, textFor: content.textFor, Suspense, act, render, screen };
}

test('a language is not in until it is asked for, then in once, for everyone who asks', async () => {
  const { languageReady, loadLanguageWords, textFor } = await freshWords();
  expect(languageReady('es')).toBe(false);
  expect(() => textFor('es')).toThrow(/not loaded/);
  const first = loadLanguageWords('es');
  expect(loadLanguageWords('es')).toBe(first);
  await first;
  expect(languageReady('es')).toBe(true);
  const { es } = await import('@ratrace/content/text/es');
  expect(textFor('es').text.cities.madrid.tagline).toBe(es.cities.madrid.tagline);
  // The others are still out.
  expect(languageReady('ru')).toBe(false);
  expect(languageReady('en')).toBe(false);
});

test('a page that speaks a language not in yet waits for it, however long it takes to come, then speaks it', async () => {
  const { useMessages, useContentText, languageReady, loadLanguageWords, Suspense, act, render, screen } = await freshWords(300);
  const drawn: string[] = [];
  function Waits() {
    drawn.push('waits');
    return null;
  }
  function Speaks() {
    const messages = useMessages('ru');
    const { names } = useContentText('ru');
    drawn.push('speaks');
    return <p data-testid="speaks">{`${(messages.meta as { titles: { room: string } }).titles.room} · ${names.cities.moscow}`}</p>;
  }
  expect(languageReady('ru')).toBe(false);
  await act(async () => {
    render(
      <Suspense fallback={<Waits />}>
        <Speaks />
      </Suspense>,
    );
  });
  // Drawn, it waits: what it waits for is the language's chunk, the load the page started (the same one, asked again), however long it takes.
  expect(drawn).toEqual(['waits']);
  await act(async () => {
    await loadLanguageWords('ru');
  });
  expect(drawn).toEqual(['waits', 'speaks']);
  expect(screen.getByTestId('speaks').textContent).toMatch(/^[А-Яа-я]+ · [А-Яа-я]+$/);
});
