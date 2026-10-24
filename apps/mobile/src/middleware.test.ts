import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { DEFAULT_LOCALE, LOCALES } from '@ratrace/i18n/locales';
import { describe, expect, it } from 'vitest';
import webProxy, { config as webConfig } from '../../web/src/proxy';
import { LOCALE_COOKIE_AGE as WEB_COOKIE_AGE } from '../../web/src/i18n/routing';
import middleware, { browserLocale, config, cookieLocale, DEFAULT, LANGUAGES, LOCALE_COOKIE_AGE, localeCookie, localeOfPath } from '../middleware';

/*
 * The site's Routing Middleware (apps/mobile/middleware.ts), what Vercel runs before the export's files are served: the bare address leads to a
 * language's front door, and a page opened in a language writes it into `NEXT_LOCALE`, as the Next web's proxy does (apps/web/src/proxy.ts,
 * next-intl's middleware under it), which these tests run beside it on the same requests.
 */

/** Next's request, as the Next web's proxy is handed it (the app does not depend on Next: it is the web's). */
const { NextRequest } = createRequire(new URL('../../web/package.json', import.meta.url))('next/server') as {
  NextRequest: new (url: URL, init: { headers: Record<string, string> }) => Parameters<typeof webProxy>[0];
};

const SITE = 'https://ratrace.test';
/** A browser's headers for a page it opens (`Sec-Fetch-Dest: document`), with `headers` over them; one given as undefined is left out. */
type Asked = Record<string, string | undefined>;
const headersOf = (headers: Asked) =>
  Object.fromEntries(Object.entries({ 'sec-fetch-dest': 'document', ...headers }).filter((one): one is [string, string] => one[1] !== undefined));
/** The app's middleware asked for `path` as a browser asks for it. */
const ours = (path: string, headers: Asked = {}) => middleware(new Request(new URL(path, SITE), { headers: headersOf(headers) }));
/** The Next web's proxy asked the same. */
const theirs = (path: string, headers: Asked = {}) => webProxy(new NextRequest(new URL(path, SITE), { headers: headersOf(headers) }));
/** A Set-Cookie's attributes, without the moment its Expires is written at. */
const attributes = (cookie: string | null) => cookie?.split('; ').filter((part) => !part.startsWith('Expires=')).join('; ') ?? null;

describe('the bare address', () => {
  it('leads to the language last played (the cookie), over the browser\'s', async () => {
    const response = await ours('/', { cookie: 'NEXT_LOCALE=es', 'accept-language': 'en-GB,en;q=0.9' });
    expect([response.status, response.headers.get('location')]).toEqual([307, `${SITE}/es`]);
  });

  it('leads to the browser\'s language on a first visit, and to English for a language the game is not played in', async () => {
    expect((await ours('/', { 'accept-language': 'ru-RU' })).headers.get('location')).toBe(`${SITE}/ru`);
    expect((await ours('/', { 'accept-language': 'de-DE,de;q=0.9' })).headers.get('location')).toBe(`${SITE}/en`);
    expect((await ours('/')).headers.get('location')).toBe(`${SITE}/en`);
  });

  it('is answered as the Next web answers it, whatever the cookie and the browser say, its query kept', async () => {
    const cookies = [undefined, 'NEXT_LOCALE=es', 'NEXT_LOCALE=ru', 'NEXT_LOCALE=de', 'other=1; NEXT_LOCALE=es; more=2', 'NEXT_LOCALE='];
    const browsers = [undefined, 'ru-RU', 'es-MX,es;q=0.9,en;q=0.8', 'de-DE,de;q=0.9', 'en-US;q=0.5, ru;q=0.9', '*', 'fr, es;q=0.1', 'pt-BR, ES', 'ru;q=0, es'];
    for (const path of ['/', '/?code=ABC123', '/?tab=challenge&x=1']) {
      for (const cookie of cookies) {
        for (const browser of browsers) {
          const headers = { ...(cookie ? { cookie } : {}), ...(browser ? { 'accept-language': browser } : {}) };
          const [mine, web] = [await ours(path, headers), theirs(path, headers)];
          expect([mine.status, mine.headers.get('location')], `${path} cookie ${cookie} accept-language ${browser}`).toEqual([web.status, web.headers.get('location')]);
        }
      }
    }
  });
});

describe('a page opened in a language', () => {
  it('writes the language into the cookie for a year, as the Next web\'s inventory says: path /, max-age 31536000, SameSite lax', async () => {
    const response = await ours('/es/play', { cookie: 'NEXT_LOCALE=es' });
    expect(response.headers.get('x-middleware-next')).toBe('1');
    expect(attributes(response.headers.get('set-cookie'))).toBe('NEXT_LOCALE=es; Path=/; Max-Age=31536000; SameSite=lax');
    expect(response.headers.get('set-cookie')).toMatch(/; Expires=\w{3}, \d{2} \w{3} \d{4} \d{2}:\d{2}:\d{2} GMT; /);
  });

  it('writes it as the Next web writes it, for every page, a front door and an address with a query among them', async () => {
    for (const path of ['/en', '/es/play', '/ru/room?code=ABC123', '/es/rankings?tab=challenge', '/en/legal', '/en/nowhere']) {
      for (const dest of ['document', undefined]) {
        // A browser that does not say what it fetches (no Sec-Fetch-Dest) is taken to open a page.
        const headers = { 'sec-fetch-dest': dest };
        const [mine, web] = [await ours(path, headers), theirs(path, headers)];
        expect(attributes(mine.headers.get('set-cookie')), `${path} (${dest})`).toBe(attributes(web.headers.get('set-cookie')));
      }
    }
  });

  it('leaves the cookie alone for what the page fetches (a script, a prefetch), and for an address with no language', async () => {
    for (const dest of ['empty', 'script', 'image']) expect((await ours('/ru/play', { 'sec-fetch-dest': dest, cookie: 'NEXT_LOCALE=es' })).headers.get('set-cookie')).toBeNull();
    expect((await ours('/de/play')).headers.get('set-cookie')).toBeNull();
    expect((await ours('/esp')).headers.get('set-cookie')).toBeNull();
    // Each is let through to the site's files, unchanged.
    expect((await ours('/de/play')).headers.get('x-middleware-next')).toBe('1');
  });

  it('is the same cookie the page writes itself (game/useLanguage.web.ts): its name and its year', () => {
    expect(LOCALE_COOKIE_AGE).toBe(WEB_COOKIE_AGE);
    expect(localeCookie('ru', new Date(Date.UTC(2026, 9, 25, 12)))).toBe('NEXT_LOCALE=ru; Path=/; Expires=Mon, 25 Oct 2027 12:00:00 GMT; Max-Age=31536000; SameSite=lax');
    const page = readFileSync(new URL('./game/useLanguage.web.ts', import.meta.url), 'utf8');
    expect(page).toContain('NEXT_LOCALE');
  });
});

describe('what the middleware is asked', () => {
  /** The matcher as Vercel reads it: a path-to-regexp pattern which, with no named parts, is a regular expression of the whole path. */
  const matches = (path: string) => new RegExp(`^${config.matcher}$`).test(path);

  it('is every page, as the Next web\'s proxy is asked, and none of the export\'s files', () => {
    for (const path of ['/', '/en', '/es/play', '/ru/room', '/de/play']) expect(matches(path), path).toBe(true);
    for (const path of ['/sw.js', '/offline.html', '/manifest.webmanifest', '/_expo/static/js/web/entry-abc.js', '/assets/__node_modules/.pnpm/x/face.ttf', '/sprites/a/b.png', '/rules/v0.40.0-1.44.0.js', '/_vercel/insights/script.js']) {
      expect(matches(path), path).toBe(false);
    }
    // The Next web's, with Next's own folder named as the export's is (`_expo`).
    expect(config.matcher).toBe(webConfig.matcher.replace('_next', '_expo'));
  });

  it('knows the game\'s languages, held to @ratrace/i18n (the middleware is built alone, with nothing of the workspace)', () => {
    expect([...LANGUAGES]).toEqual([...LOCALES]);
    expect(DEFAULT).toBe(DEFAULT_LOCALE);
    expect(localeOfPath('/es/play')).toBe('es');
    expect(localeOfPath('/es')).toBe('es');
    expect(localeOfPath('/')).toBeNull();
    expect(localeOfPath('/esp')).toBeNull();
  });

  it('reads the cookie and the browser\'s languages as the Next web does', () => {
    expect(cookieLocale('a=1; NEXT_LOCALE=ru')).toBe('ru');
    expect(cookieLocale('NEXT_LOCALE=de')).toBeNull();
    expect(cookieLocale(null)).toBeNull();
    expect(browserLocale('es-MX,es;q=0.9')).toBe('es');
    expect(browserLocale('en;q=0.2, ru;q=0.8')).toBe('ru');
    expect(browserLocale('ru;q=0, es')).toBe('es');
    expect(browserLocale('de, fr')).toBeNull();
    expect(browserLocale(null)).toBeNull();
  });
});
