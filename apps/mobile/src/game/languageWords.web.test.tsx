// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest';

/*
 * On the web a page carries the words of its own language only, as the Next web's: each language is a chunk of its own, fetched when a page first speaks
 * it, and a page that speaks one waits for it. (The build's machine, which draws every page in its language, has them all from the start: the export's
 * pages and serverRender.web.test.tsx show it.)
 */

afterEach(() => {
  vi.resetModules();
});

/** The module as a browser's first visit finds it, no language in yet (the test setup's are another copy's), with React and the renderer of that copy. */
async function freshWords() {
  vi.resetModules();
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

test('a page that speaks a language not in yet waits for it, then speaks it', async () => {
  const { useMessages, useContentText, languageReady, Suspense, act, render, screen } = await freshWords();
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
  expect(drawn).toEqual(['waits', 'speaks']);
  expect(screen.getByTestId('speaks').textContent).toMatch(/^[А-Яа-я]+ · [А-Яа-я]+$/);
});
