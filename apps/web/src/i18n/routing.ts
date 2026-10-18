import { defineRouting } from 'next-intl/routing';

/** How long the language a player plays in is remembered: a year, renewed by every page they open. */
export const LOCALE_COOKIE_AGE = 60 * 60 * 24 * 365;

/**
 * The game is played in English, Spanish or Russian. A first visit follows the browser and falls back
 * to English; after that the bare address opens in the language last played, kept in a cookie that
 * outlives closing the app (by default it would last only as long as the browser's session).
 */
export const routing = defineRouting({
  locales: ['en', 'es', 'ru'],
  defaultLocale: 'en',
  localeCookie: { name: 'NEXT_LOCALE', maxAge: LOCALE_COOKIE_AGE, sameSite: 'lax' },
});

export type AppLocale = (typeof routing.locales)[number];
