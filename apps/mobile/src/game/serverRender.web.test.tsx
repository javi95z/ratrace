// @vitest-environment node
import { messagesFor } from '@ratrace/i18n';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { params, pathname } from '../testing/fakes';

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
const { forgetTheGame, GameProvider } = await import('./context');
const { phoneTrack } = await import('../online/track');

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
  vi.restoreAllMocks();
});

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

  it('counts nothing and listens to nothing there, in a release build too', () => {
    // A release build listens to the connection for as long as the app lasts (`online/track.ts`): drawn with no browser, there is none to hear.
    const account = { subscribe: () => () => undefined };
    const kept = { getItem: () => null, setItem: () => undefined };
    expect(() => phoneTrack(account, kept, { release: true, platform: 'web' })).not.toThrow();
  });
});
