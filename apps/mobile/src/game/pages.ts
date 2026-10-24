import { DEFAULT_LOCALE, isLocale, LOCALES } from '@ratrace/i18n/locales';
import { useGlobalSearchParams, useLocalSearchParams, useRouter } from 'expo-router';
import { useContext, useMemo } from 'react';
import { Language } from '../ui/text';

/*
 * The pages of the game and their addresses, as the Next web's: the language first, then the page (`/es/room?code=K7Q2XM`, `/en/rankings#friends`,
 * `/ru` for the front door). The routes are `app/[locale]/*` on the phone as on the web. Every move from page to page goes through here (`useGo`),
 * and no other file of the game or the kit writes a page's address (architecture.test.ts): on the web the address is the page the player can share,
 * bookmark and come back to; on the phone it is only the router's, and its language is the one the app opened its pages in.
 */

/** A page of the game: the front door (`''`) and every page after it, as the Next web's `app/[locale]/*`. */
export type Page = '' | 'new' | 'challenge' | 'room' | 'rankings' | 'collection' | 'records' | 'play' | 'player' | 'legal';

/** Every page, the front door first. */
export const PAGES: readonly Page[] = ['', 'new', 'challenge', 'room', 'rankings', 'collection', 'records', 'play', 'player', 'legal'];

/** What may follow a page in its address: a query (`?code=`), a hash (`#friends`), and the language, English unless one is named. */
export interface PageOptions {
  query?: Record<string, string>;
  hash?: string;
  locale?: string;
}

/** The address of a page: `/{locale}`, `/{locale}/{page}`, then its query and its hash, each value written as an address carries it. */
export function hrefOf(page: Page, options: PageOptions = {}): string {
  const { query = {}, hash, locale = DEFAULT_LOCALE } = options;
  const asked = Object.entries(query).map(([name, value]) => `${encodeURIComponent(name)}=${encodeURIComponent(value)}`).join('&');
  return `/${locale}${page === '' ? '' : `/${page}`}${asked === '' ? '' : `?${asked}`}${hash === undefined ? '' : `#${hash}`}`;
}

/** The page a path of the router shows (`/es/room` is `room`, `/en` the front door), or null for a path outside the pages of a language (`/scene`). */
export function pageAt(path: string): Page | null {
  const [, locale = '', page = '', ...more] = path.split('/');
  if (!isLocale(locale) || more.length > 0) return null;
  return PAGES.find((one) => one === page) ?? null;
}

/** The languages the pages are made in, for the web export (expo-router's `generateStaticParams`): each page once in each, as the Next web's. */
export function generateStaticParams(): Array<{ locale: string }> {
  return LOCALES.map((locale) => ({ locale }));
}

/**
 * The language of the address the player is on (`/es/play` is `es`), as the router has it from anywhere (the game's context, round every route): what
 * is there, whatever it is (a page of the game checks it is one of its languages), or `''` outside the pages of a language. On the web it is the
 * language of the page; on the phone, of the stack. It changes with every move of the router, and draws its reader again with each: a page reads
 * its own (`useGo`).
 */
export function useLocaleParam(): string {
  const { locale } = useGlobalSearchParams<{ locale?: string | string[] }>();
  return typeof locale === 'string' ? locale : '';
}

/** How to go from page to page. */
export interface Go {
  /** Opens a page over the one in front. */
  push(page: Page, options?: PageOptions): void;
  /** Opens a page in place of the one in front. */
  replace(page: Page, options?: PageOptions): void;
  /** Back to the front door, every page over it dismissed (never a second front door over the first). */
  home(): void;
}

/** The moves, in `param`'s language if it is one of the game's, else in the language of the game (`speaking`). */
function useGoIn(param: unknown, speaking: string): Go {
  const router = useRouter();
  const locale = isLocale(param) ? param : speaking;
  return useMemo<Go>(
    () => ({
      push: (page, options) => router.push(hrefOf(page, { locale, ...options })),
      replace: (page, options) => router.replace(hrefOf(page, { locale, ...options })),
      home: () => router.dismissTo(hrefOf('', { locale })),
    }),
    [router, locale],
  );
}

/**
 * The way from page to page, for a page of the game (inside a route): in the language of its own address (else of the game, outside the pages of a
 * language), which no move to another page changes. Every page of a stack is in one language, and so is the front door it goes home to. A page is
 * named, never its address (`go.push('room', { query: { code } })`). Where sheets may be open, close them first (`sheetsGone()`), as before any move of
 * the router.
 */
export function useGo(): Go {
  const { locale } = useLocalSearchParams<{ locale?: string | string[] }>();
  return useGoIn(locale, useContext(Language));
}

/** The same, from outside the routes (the game's context, round every one): in the language of the address in front, read anew at every move. */
export function useGoFromAnywhere(): Go {
  return useGoIn(useLocaleParam(), useContext(Language));
}

/** The phone's own pages, outside the languages: Google's way back (`theratrace://auth`), and the development routes. */
const OUTSIDE = new Set(['auth', 'scene', 'kit', 'dev', 'perf']);

/**
 * The page of the game a link of the phone's opens (`theratrace://room?code=K7Q2XM`, or Expo Go's `exp://…/--/room?code=K7Q2XM`): the same page, in
 * `locale`, its query and hash kept (`/es/room?code=K7Q2XM`, `/en/rankings#friends`); the app's bare address is the front door (`/en`). Anything else
 * (Google's way back, the development routes, a page already in a language, a page the game does not have) is left as it came.
 */
export function pageOfLink(link: string, locale: string): string {
  const expoGo = /^exps?:\/\/[^/]*\/--\/(.*)$/.exec(link);
  const scheme = /^[a-z][a-z0-9+.-]*:\/\/(.*)$/i.exec(link);
  if (scheme !== null && expoGo === null && /^exps?:/i.test(link)) return link;
  const rest = expoGo?.[1] ?? scheme?.[1] ?? link;
  const [, path = '', after = ''] = /^\/*([^?#]*?)\/*([?#].*)?$/.exec(rest) ?? [];
  if (path.includes('/') || OUTSIDE.has(path) || isLocale(path)) return link;
  const page = PAGES.find((one) => one === path);
  return page === undefined ? link : `${hrefOf(page, { locale })}${after}`;
}
