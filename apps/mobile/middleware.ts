import { next } from '@vercel/functions/middleware';

/*
 * The site's Routing Middleware: what Vercel runs before it serves a file of the web export (the file convention of a project that is not Next's,
 * `middleware.ts` beside the app's `package.json`). It does what the Next web's proxy does (apps/web/src/proxy.ts, next-intl's middleware under it):
 * the bare address leads to a language's front door, the one last played (the cookie `NEXT_LOCALE`), else the browser's, else English; and every
 * page opened in a language writes it into the cookie again from the server, with a year to run (Safari keeps a cookie written by script seven days
 * at most). Every other address is let through to the export's files as it came.
 *
 * It is built alone, apart from the app and the workspace, so it names nothing of either: the languages are written here, and held to
 * `@ratrace/i18n` by its test (src/middleware.test.ts), which also runs the Next web's proxy beside it on the same requests. The site served on this
 * machine by the checks applies it too (`scripts/webLife.ts`, `serveExport`).
 */

/** The languages the game is played in (`@ratrace/i18n`'s `LOCALES`). */
export const LANGUAGES = ['en', 'es', 'ru'] as const;
export type Language = (typeof LANGUAGES)[number];
/** The language of a first visit whose browser speaks none of them (`DEFAULT_LOCALE`). */
export const DEFAULT: Language = 'en';
/** The cookie the language last played is kept in, the Next web's (next-intl's name). */
export const LOCALE_COOKIE = 'NEXT_LOCALE';
/** How long it is kept: a year, renewed by every page opened (the Next web's `LOCALE_COOKIE_AGE`). */
export const LOCALE_COOKIE_AGE = 60 * 60 * 24 * 365;

const isLanguage = (value: string): value is Language => (LANGUAGES as readonly string[]).includes(value);

/** The language of an address, when it begins with one (`/es/play` is Spanish; `/esp` and `/` are none). */
export function localeOfPath(pathname: string): Language | null {
  const first = pathname.split('/')[1] ?? '';
  return isLanguage(first) ? first : null;
}

/** The language a `Cookie` header keeps as the one last played, or null. */
export function cookieLocale(cookie: string | null): Language | null {
  for (const part of (cookie ?? '').split(';')) {
    const at = part.indexOf('=');
    if (at < 0 || part.slice(0, at).trim() !== LOCALE_COOKIE) continue;
    let value = part.slice(at + 1).trim();
    try {
      value = decodeURIComponent(value);
    } catch {
      // Not a value a page wrote: none.
    }
    return isLanguage(value) ? value : null;
  }
  return null;
}

/**
 * The first of the game's languages an `Accept-Language` header asks for, in the order of its weights (an equal weight in the header's order; a weight
 * of 0 is a refusal), each tag by itself or by its language (`es-MX` is Spanish), or null: as next-intl matches them.
 */
export function browserLocale(accept: string | null): Language | null {
  const asked = (accept ?? '')
    .split(',')
    .map((part, order) => {
      const [tag, ...rest] = part.trim().split(';');
      const weight = rest.map((one) => /^\s*q=([0-9.]+)\s*$/.exec(one)?.[1]).find((one) => one !== undefined);
      return { tag: tag.trim().toLowerCase(), weight: weight === undefined ? 1 : Number(weight), order };
    })
    .filter((one) => one.tag !== '' && one.tag !== '*' && one.weight > 0)
    .sort((a, b) => b.weight - a.weight || a.order - b.order);
  for (const { tag } of asked) {
    const language = tag.split('-')[0];
    if (isLanguage(language)) return language;
  }
  return null;
}

/** The language the bare address leads to: the one last played, else the browser's, else English. */
export const localeFor = (headers: Headers): Language => cookieLocale(headers.get('cookie')) ?? browserLocale(headers.get('accept-language')) ?? DEFAULT;

/** The `Set-Cookie` that keeps `locale` as the language last played, written as Next writes the Next web's (its Expires a year from `now`). */
export function localeCookie(locale: Language, now: Date = new Date()): string {
  const expires = new Date(now.getTime() + LOCALE_COOKIE_AGE * 1000).toUTCString();
  return `${LOCALE_COOKIE}=${locale}; Path=/; Expires=${expires}; Max-Age=${LOCALE_COOKIE_AGE}; SameSite=lax`;
}

/**
 * Whether a request is a page the player opens, not what a page fetches (a script, a prefetch of another language's page): `Sec-Fetch-Dest`, a
 * browser that does not send it taken to open one.
 */
const isPageOpened = (headers: Headers): boolean => {
  const dest = headers.get('sec-fetch-dest');
  return dest === null || dest === 'document';
};

/**
 * What the site answers before its files: the bare address a redirect (307, as next-intl's) to the front door of `localeFor`, its query kept; a page
 * of a language let through with that language written into the cookie when the player opened it; anything else let through as it came.
 */
export default function middleware(request: Request): Response {
  const url = new URL(request.url);
  if (url.pathname === '/') {
    url.pathname = `/${localeFor(request.headers)}`;
    return Response.redirect(url, 307);
  }
  const locale = localeOfPath(url.pathname);
  if (locale !== null && isPageOpened(request.headers)) return next({ headers: { 'set-cookie': localeCookie(locale) } });
  return next();
}

/** The addresses the middleware is asked about: every page, none of the export's files (anything with an ending) nor its own folders, as the Next web's. */
export const config = {
  matcher: '/((?!_expo|_vercel|.*\\..*).*)',
};
