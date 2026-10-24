/**
 * The languages the game is played in, apart from their words (`index.ts` holds those): what a page's address, a cookie or a picker is checked
 * against, without carrying the words of every language with it (the app's web loads only its page's: apps/mobile/src/game/languageWords.web.ts).
 */
export const LOCALES = ['en', 'es', 'ru'] as const;
export type Locale = (typeof LOCALES)[number];

/** The language a first visit falls back to when the browser's is not one of these. */
export const DEFAULT_LOCALE: Locale = 'en';

/** True for a language the game is played in. */
export const isLocale = (value: unknown): value is Locale => typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
