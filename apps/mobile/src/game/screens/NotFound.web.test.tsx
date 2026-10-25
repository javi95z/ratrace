// @vitest-environment jsdom
import { messagesFor } from '@ratrace/i18n';
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import NotFoundRoute from '../../app/+not-found';
import RecordsRoute from '../../app/[locale]/records';
import { kvLanguage } from '../../kvStore';
import { device, params, pathname } from '../../testing/fakes';
import { memoryServices, renderGame } from '../../testing/render';
import { GameProvider } from '../context';

/*
 * The web's page of nothing: an address the game has no page at (`/es/nowhere`; the site answers it with its `404.html`, the export's `+not-found`)
 * shows, in the game's look and in the address's language, a line and the ways back (a new life, home), as the Next web answers an unknown page
 * with its 404. Its words are its own (`notFound.title`, `notFound.body`) and the error page's links (`play.newLife`, `home`). The site has one
 * such HTML for every language, drawn in English: the browser takes it over as it was drawn, then speaks the address's language once its words are
 * in; its ways back lead to pages of the address's language from the start.
 */

/** The words of a language held back from the page until the test lets them in (`release`), as a chunk not fetched yet; every other language is in. */
const words = vi.hoisted(() => ({ held: null as string | null, release: () => undefined as void }));
vi.mock('../languageWords', async (original) => {
  const real = await original<typeof import('../languageWords')>();
  let waiting: Promise<void> | null = null;
  return {
    ...real,
    languageReady: (locale: 'en' | 'es' | 'ru') => locale !== words.held && real.languageReady(locale),
    loadLanguageWords: (locale: 'en' | 'es' | 'ru') =>
      locale === words.held
        ? (waiting ??= new Promise<void>((resolve) => {
            words.release = () => {
              words.held = null;
              waiting = null;
              resolve();
            };
          }))
        : real.loadLanguageWords(locale),
  };
});

const opened = vi.hoisted(() => [] as Array<{ address: string; how: string }>);
vi.mock('../openDocument', () => ({ openDocument: (address: string, how: string) => opened.push({ address, how }) }));

/** The page's words in a language: its own title and line, and the error page's links. */
const play = (locale: 'en' | 'es' | 'ru') => {
  const all = messagesFor(locale) as unknown as { play: Record<string, string>; notFound: Record<string, string> };
  return { title: all.notFound.title, body: all.notFound.body, newLife: all.play.newLife, home: all.play.home };
};

beforeEach(() => {
  opened.length = 0;
  delete params.locale;
  document.cookie = 'NEXT_LOCALE=; path=/; max-age=0';
});
afterEach(() => {
  cleanup();
  words.held = null;
  vi.restoreAllMocks();
  document.body.innerHTML = '';
  pathname.now = '/';
});

describe('the page of nothing', () => {
  it.each(['en', 'es', 'ru'] as const)('at /%s/nowhere speaks its address\'s language: one heading, its line, and the ways back to a new life and home', async (locale) => {
    pathname.now = `/${locale}/nowhere`;
    renderGame(<NotFoundRoute />, { ...memoryServices(), language: kvLanguage });
    const said = play(locale);
    // Its title the page's one h1 (read whole: a run of letters may be drawn on its own), its line under it.
    await waitFor(() => expect(document.querySelector('h1')?.textContent).toBe(said.title));
    expect(document.querySelectorAll('h1')).toHaveLength(1);
    expect(document.body.textContent).toContain(said.body);
    // No router's page: no sitemap, no address said back.
    expect(screen.queryByText(/sitemap/i)).toBeNull();
    const links = screen.getAllByRole('link');
    expect(links.map((link) => link.textContent)).toEqual([said.newLife, said.home]);
    for (const link of links) fireEvent.click(link);
    expect(opened).toEqual([
      { address: `/${locale}/new`, how: 'push' },
      { address: `/${locale}`, how: 'push' },
    ]);
  });

  it('speaks the address\'s language whatever the cookie says', async () => {
    document.cookie = 'NEXT_LOCALE=ru; path=/';
    pathname.now = '/es/nowhere';
    renderGame(<NotFoundRoute />, { ...memoryServices(), language: kvLanguage });
    await waitFor(() => expect(document.querySelector('h1')?.textContent).toBe(play('es').title));
  });

  it('leads to pages of the address\'s language even before its words are in: a tap then never opens another language\'s page', async () => {
    words.held = 'es';
    pathname.now = '/es/nowhere';
    renderGame(<NotFoundRoute />, { ...memoryServices(), language: kvLanguage });
    // Still in English, as its HTML was drawn: Spanish is on its way.
    await waitFor(() => expect(document.querySelector('h1')?.textContent).toBe(play('en').title));
    for (const link of screen.getAllByRole('link')) fireEvent.click(link);
    expect(opened.map((one) => one.address)).toEqual(['/es/new', '/es']);
    await act(async () => words.release());
    await waitFor(() => expect(document.querySelector('h1')?.textContent).toBe(play('es').title));
  });

  it('is what a page in a language the game does not have shows (/de/records), in English', async () => {
    params.locale = 'de';
    pathname.now = '/de/records';
    renderGame(<RecordsRoute />, memoryServices());
    expect(await screen.findByRole('heading', { name: play('en').title })).toBeTruthy();
  });

  it('is taken over in the browser as its one HTML was drawn, in English, and then speaks the address\'s language', async () => {
    // As the export draws it: the route of nothing, at no address of a language, with no cookie (the build's machine has no browser to speak another
    // language: `serverRender.web.test.tsx`).
    pathname.now = '/+not-found';
    const html = renderToString(
      <GameProvider services={{ ...memoryServices(), language: kvLanguage }}>
        <NotFoundRoute />
      </GameProvider>,
    );
    expect(html).toContain(play('en').title);
    // As the site serves it: at /es/nowhere, its language in the cookie (the middleware writes it for a page opened in a language).
    document.cookie = 'NEXT_LOCALE=es; path=/';
    device.languages = ['ru'];
    pathname.now = '/es/nowhere';
    const page = document.createElement('div');
    page.innerHTML = html;
    document.body.append(page);
    const mismatches: unknown[] = [];
    // React says an attribute that differs only on the console: anything said there while the page is taken over is a fault too.
    const said = vi.spyOn(console, 'error');
    let root: ReturnType<typeof hydrateRoot> | null = null;
    await act(async () => {
      root = hydrateRoot(
        page,
        <GameProvider services={{ ...memoryServices(), language: kvLanguage }}>
          <NotFoundRoute />
        </GameProvider>,
        { onRecoverableError: (error) => mismatches.push(error) },
      );
    });
    expect(mismatches).toEqual([]);
    expect(said).not.toHaveBeenCalled();
    await waitFor(() => expect(page.querySelector('h1')?.textContent).toBe(play('es').title));
    act(() => root?.unmount());
  });
});
