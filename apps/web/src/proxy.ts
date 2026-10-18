import createMiddleware from 'next-intl/middleware';
import type { NextRequest } from 'next/server';
import { LOCALE_COOKIE_AGE, routing } from './i18n/routing';

const intl = createMiddleware(routing);

/** The language of an address, when it begins with one. */
export function localeOfPath(pathname: string): string | null {
  const first = pathname.split('/')[1] ?? '';
  return (routing.locales as readonly string[]).includes(first) ? first : null;
}

/**
 * Sends a visitor to `/en/...`, `/es/...` or `/ru/...`, following their browser on the first visit
 * and the language they last played in after that.
 *
 * Every page opened in a language writes it again from the server, with a year to run. next-intl
 * writes it only when it changes, and a change made in the page itself is written by script, which
 * Safari keeps for seven days at most: a player who came back after a week found the game in English.
 */
export default function proxy(request: NextRequest) {
  const response = intl(request);
  const locale = localeOfPath(request.nextUrl.pathname);
  const fetching = request.headers.get('sec-fetch-dest');
  // Only a page the player opens, not the router's prefetches, which may be of another language.
  if (locale !== null && (fetching === null || fetching === 'document') && response.status < 300) {
    response.cookies.set('NEXT_LOCALE', locale, { path: '/', maxAge: LOCALE_COOKIE_AGE, sameSite: 'lax' });
  }
  return response;
}

export const config = {
  // Everything except Next.js internals and files with an extension, such as sprites.
  matcher: '/((?!_next|_vercel|.*\\..*).*)',
};
