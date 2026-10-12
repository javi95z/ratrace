import { defineRouting } from 'next-intl/routing';

/** The game is played in English or Spanish. A first visit follows the browser and falls back to English. */
export const routing = defineRouting({
  locales: ['en', 'es'],
  defaultLocale: 'en',
});

export type AppLocale = (typeof routing.locales)[number];
