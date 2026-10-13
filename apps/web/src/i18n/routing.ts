import { defineRouting } from 'next-intl/routing';

/** The game is played in English, Spanish or Russian. A first visit follows the browser and falls back to English. */
export const routing = defineRouting({
  locales: ['en', 'es', 'ru'],
  defaultLocale: 'en',
});

export type AppLocale = (typeof routing.locales)[number];
