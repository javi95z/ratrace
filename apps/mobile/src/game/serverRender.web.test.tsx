// @vitest-environment node
import { messagesFor } from '@ratrace/i18n';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { device, params, pathname } from '../testing/fakes';

// The web's own sprites (the setup of the phone's tests stands a fake in for them), each file at its address as the export serves it.
vi.unmock('../ui/Sprite');
vi.unmock('../ui/Sprite.web');
vi.mock('../sprites/sources', () => ({
  SOURCES: new Proxy(
    {},
    {
      get: (_, id) => ({ uri: `/sprites/${String(id)}.png` }),
      getOwnPropertyDescriptor: (_, id) => ({ value: { uri: `/sprites/${String(id)}.png` }, configurable: true, enumerable: true }),
    },
  ),
}));

const { default: HomeRoute } = await import('../app/[locale]/index');
const { default: NotFoundRoute } = await import('../app/+not-found');
const { forgetTheGame, GameProvider } = await import('./context');
const { phoneTrack } = await import('../online/track');
const { forgetThePhone } = await import('../online/index.web');

/*
 * The web export is HTML first (`web.output: "static"`): each page is drawn on the build's machine, where there is no window, no document and no
 * storage, and the browser then takes over the page it was given. Here the front door is drawn so, as the export draws it: the real game (no services
 * handed in, so the browser's own twins of the store, the cloud and the page, offline as the export is built), in Node with nothing of a browser.
 * It draws what a first visit shows, in the page's language, and nothing on the way throws: neither a reach for the browser while drawing, nor a
 * store read with no answer for the server (`useSyncExternalStore` without its server snapshot, which React refuses on the server).
 */

vi.setConfig({ testTimeout: 120_000 });

/** The text of some HTML, as a browser shows it: the tags gone, the characters the server wrote as entities written out again. */
const textOf = (html: string): string =>
  html
    .replace(/<[^>]+>/g, '')
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');

afterEach(() => {
  forgetTheGame();
  forgetThePhone();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

/** Draws the front door in `locale` as the export draws it, and gives back what a reader of the page reads. */
function frontDoor(locale: 'en' | 'es' | 'ru'): string {
  params.locale = locale;
  pathname.now = `/${locale}`;
  return textOf(
    renderToString(
      <GameProvider>
        <HomeRoute />
      </GameProvider>,
    ),
  );
}

describe('the front door drawn on the server', () => {
  it('has no browser to reach for', () => {
    expect(typeof window).toBe('undefined');
    expect(typeof document).toBe('undefined');
    expect(typeof localStorage).toBe('undefined');
  });

  it.each(['en', 'es', 'ru'] as const)('draws the game\'s name and what it is, in %s, with nothing thrown', async (locale) => {
    const warned = vi.spyOn(console, 'warn');
    params.locale = locale;
    pathname.now = `/${locale}`;
    const html = renderToString(
      <GameProvider>
        <HomeRoute />
      </GameProvider>,
    );
    // What a reader of the page reads: its text, the runs a line is set in (one for each typeface, `ui/text.tsx`) put together.
    const read = textOf(html);
    const meta = messagesFor(locale).meta as { title: string; description: string };
    expect(read).toContain(meta.title);
    expect(read).toContain(meta.description);
    // Its pictures are left for the browser to fetch: none is read, nor judged lost, where there is no browser to read it (a read would end later).
    await new Promise((settled) => setTimeout(settled, 50));
    expect(warned.mock.calls.flat().filter((said) => String(said).startsWith('sprite '))).toEqual([]);
  });

  it('holds the mascot\'s <img> in its HTML, its address, size and name there before any script runs (the page\'s largest picture)', () => {
    params.locale = 'en';
    pathname.now = '/en';
    const html = renderToString(
      <GameProvider>
        <HomeRoute />
      </GameProvider>,
    );
    const mascot = /<img [^>]*src="\/sprites\/brand\.mascot\.png"[^>]*>/.exec(html)?.[0] ?? '';
    expect(mascot).not.toBe('');
    expect(mascot).toContain('width="256"');
    expect(mascot).toContain('height="256"');
    expect(mascot).toContain('alt=""');
  });

  it('counts nothing and listens to nothing there, in a release build too', () => {
    // A release build listens to the connection for as long as the app lasts (`online/track.ts`): drawn with no browser, there is none to hear.
    const account = { subscribe: () => () => undefined };
    const kept = { getItem: () => null, setItem: () => undefined };
    expect(() => phoneTrack(account, kept, { release: true, platform: 'web' })).not.toThrow();
  });
});

describe('the front door drawn on the server of a build with a project', () => {
  /*
   * The export the site serves is built with its project's settings (EXPO_PUBLIC_SUPABASE_*), in production. Drawn on the build's machine, the game is
   * offline all the same: no client is made, nothing is asked of the cloud or of the browser's storage, no error is watched. A project of nobody's
   * here, on a closed port of this machine: never the live one.
   */
  it.each([['development'], ['production']])('draws it with nothing thrown and nothing asked of the network (%s)', async (mode) => {
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', 'http://127.0.0.1:9');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_fake_local_only');
    vi.stubEnv('NODE_ENV', mode);
    const asked = vi.spyOn(globalThis, 'fetch');
    const read = frontDoor('es');
    expect(read).toContain((messagesFor('es').meta as { description: string }).description);
    await new Promise((settled) => setTimeout(settled, 50));
    expect(asked).not.toHaveBeenCalled();
  });
});

describe('the page of nothing drawn on the server', () => {
  /*
   * The site's one `404.html`, for every language: drawn in English (the `lang` its document says), whatever language the build's machine speaks, so
   * the browser, which takes it over in English before it speaks the address's language, finds what it draws (`useLanguage.web.ts`).
   */
  it('is drawn in English whatever the machine speaks, its line and its ways back', () => {
    device.languages = ['ru'];
    delete params.locale;
    pathname.now = '/+not-found';
    const read = textOf(
      renderToString(
        <GameProvider>
          <NotFoundRoute />
        </GameProvider>,
      ),
    );
    const { play, notFound } = messagesFor('en') as unknown as Record<'play' | 'notFound', Record<string, string>>;
    for (const words of [notFound.title, notFound.body, play.newLife, play.home]) expect(read).toContain(words);
  });
});
