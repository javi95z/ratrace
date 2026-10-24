import { messagesFor } from '@ratrace/i18n';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ErrorBoundaryProps } from 'expo-router';
import { Component, type ComponentType, type ReactNode } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { params, pathname } from '../testing/fakes';
import { FAULT_WORDS } from './faultWords';
import { faultWordsJson } from './faultWordsHtml';
import { ErrorBoundary } from './PageFault.web';

/*
 * The web's page of a fault, the Next web's `[locale]/error.tsx`: a page of the game that cannot be drawn shows, in its place, what went wrong, another
 * try, a new life and the way home, in the page's language, where the export would otherwise leave a blank page (React takes the tree out of
 * `#root`). It is expo-router's `ErrorBoundary` of the root layout, drawn by the router's own boundary (`Try`), so a language whose words cannot be
 * had (its chunk, `languageWords.web.ts`) shows it too, in that language's words as the page's HTML holds them (`app/+html.tsx`).
 */

/** Whether the Russian chunk can be had: offline, never fetched before, it cannot. */
const chunk = vi.hoisted(() => ({ fails: false }));

/** The documents the page opens (`openDocument`): a test's browser goes nowhere. */
const opened = vi.hoisted(() => [] as Array<{ address: string; how: string }>);
vi.mock('./openDocument', () => ({ openDocument: (address: string, how: string) => opened.push({ address, how }) }));

/**
 * The router's own boundary round a route that exports one (expo-router's `views/Try.js`, as `useScreens.js` wraps the route): the route's
 * `ErrorBoundary` drawn with what was thrown, and `retry` drawing the route again. Its file reaches the native modules a test cannot load, so it is
 * written out here as it is there, on the React it is given.
 */
function routerTry(Base: typeof Component) {
  return class Try extends Base<{ catch: ComponentType<ErrorBoundaryProps>; children: ReactNode }, { error?: Error }> {
    state: { error?: Error } = { error: undefined };
    static getDerivedStateFromError(error: Error) {
      return { error };
    }
    retry = () => new Promise<void>((resolve) => this.setState({ error: undefined }, () => resolve()));
    render() {
      const { catch: Caught, children } = this.props;
      return this.state.error ? <Caught error={this.state.error} retry={this.retry} /> : children;
    }
  };
}
const Try = routerTry(Component);

/** Puts the HTML's words of a page's fault where the export's page has them: the page at `path`, in `locale`. */
function pageIn(locale: 'en' | 'es' | 'ru', path: string) {
  window.history.replaceState(null, '', path);
  document.documentElement.lang = locale;
  const held = document.createElement('script');
  held.id = FAULT_WORDS;
  held.type = 'application/json';
  held.textContent = faultWordsJson(locale);
  document.body.append(held);
}

const quiet = () => vi.spyOn(console, 'error').mockImplementation(() => undefined);

beforeEach(() => {
  opened.length = 0;
  chunk.fails = false;
});
afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

it('shows in place of a page that cannot be drawn: the fault, another try, a new life and home, in the page\'s language', async () => {
  pageIn('es', '/es/play');
  const said = quiet();
  const broken = { now: true };
  function Page() {
    if (broken.now) throw new Error('a screen broke');
    return <p>la partida</p>;
  }
  render(
    <Try catch={ErrorBoundary}>
      <Page />
    </Try>,
  );
  const es = messagesFor('es').play;
  expect(screen.getByRole('alert').textContent).toContain(es.faultTitle);
  expect(screen.getByRole('alert').textContent).toContain(es.faultBody);
  // Heard by the page's error watch, as the Next web's error page says it.
  expect(said).toHaveBeenCalledWith('a screen could not be drawn:', expect.objectContaining({ message: 'a screen broke' }));
  fireEvent.click(screen.getByRole('link', { name: es.newLife }));
  fireEvent.click(screen.getByRole('link', { name: es.home }));
  expect(opened).toEqual([
    { address: '/es/new', how: 'push' },
    { address: '/es', how: 'push' },
  ]);
  // Another try draws the page again.
  broken.now = false;
  await act(async () => fireEvent.click(screen.getByRole('button', { name: es.retry })));
  expect(screen.getByText('la partida')).toBeTruthy();
  expect(screen.queryByRole('alert')).toBeNull();
});

it('shows when the page\'s language cannot be had, in its words as the HTML holds them, and another try draws the game once they can', async () => {
  // A page as a browser first has it: no language in yet (a test's setup has them all in), the Russian chunk not to be had.
  vi.resetModules();
  vi.doMock('./languages/ru', async (original) => {
    if (chunk.fails) throw new Error('Loading chunk ru failed (offline)');
    return original();
  });
  const fresh = {
    react: await import('react'),
    dom: await import('@testing-library/react'),
    game: await import('./context'),
    words: await import('./languageWords'),
    services: await import('../testing/memoryServices'),
    fault: await import('./PageFault.web'),
  };
  expect(fresh.words.languageReady('ru')).toBe(false);
  pageIn('ru', '/ru');
  // The router's stand-in is the setup's, made before the modules were fresh.
  params.locale = 'ru';
  pathname.now = '/ru';
  quiet();
  chunk.fails = true;
  const FreshTry = routerTry(fresh.react.Component);
  function Front() {
    return <p>{fresh.game.useT('home')('language')}</p>;
  }
  await fresh.dom.act(async () => {
    fresh.dom.render(
    <FreshTry catch={fresh.fault.ErrorBoundary}>
      <fresh.react.Suspense fallback={null}>
        <fresh.game.GameProvider services={fresh.services.memoryServices()}>
          <Front />
        </fresh.game.GameProvider>
      </fresh.react.Suspense>
    </FreshTry>,
    );
  });
  const ru = messagesFor('ru');
  const play = ru.play;
  await fresh.dom.waitFor(() => expect(fresh.dom.screen.getByRole('alert').textContent).toContain(play.faultTitle));
  expect(fresh.dom.screen.getByRole('alert').textContent).toContain(play.faultBody);
  // Back online: another try asks for the language again, and the game speaks it.
  chunk.fails = false;
  await fresh.dom.act(async () => fresh.dom.fireEvent.click(fresh.dom.screen.getByRole('button', { name: play.retry })));
  await fresh.dom.waitFor(() => expect(fresh.dom.screen.getByText((ru.home).language)).toBeTruthy());
  expect(fresh.dom.screen.queryByRole('alert')).toBeNull();
  fresh.dom.cleanup();
  vi.doUnmock('./languages/ru');
});

it('is given its words by each page\'s HTML in the page\'s language, and only that one\'s, with nothing that ends its script', () => {
  for (const locale of ['en', 'es', 'ru'] as const) {
    const play = messagesFor(locale).play;
    expect(JSON.parse(faultWordsJson(locale))).toEqual({ faultTitle: play.faultTitle, faultBody: play.faultBody, retry: play.retry, newLife: play.newLife, home: play.home });
    expect(faultWordsJson(locale)).not.toContain('<');
  }
});

it('speaks the game\'s words of the page\'s language where they are in, the HTML holding none', () => {
  window.history.replaceState(null, '', '/en/records');
  quiet();
  render(
    <Try catch={ErrorBoundary}>
      <Thrower />
    </Try>,
  );
  expect(screen.getByRole('alert').textContent).toContain((messagesFor('en').play).faultTitle);
});

function Thrower(): null {
  throw new Error('a screen broke');
}
