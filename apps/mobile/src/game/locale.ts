import { DEFAULT_LOCALE, isLocale, type Locale } from '@ratrace/i18n';
import { getLocales } from 'expo-localization';

/**
 * The language the game is played in: the one the player chose, kept on the phone (the web keeps it in
 * its NEXT_LOCALE cookie); else the first of the phone's languages, in its order of preference, that the
 * game speaks (as the web reads a browser's); else English. On the web, a page's own language comes first:
 * its address's (`useLanguage.web.ts`).
 */
export function localeOf(chosen: string | null | undefined, phone: readonly string[]): Locale {
  if (isLocale(chosen)) return chosen;
  return phone.find(isLocale) ?? DEFAULT_LOCALE;
}

/** The phone's languages (a browser's, on the web), in its order of preference. */
export const deviceLanguages = (): string[] => getLocales().map((locale) => locale.languageCode ?? '');

/** Where the language the player chose is kept. */
export interface LanguageKeep {
  read(): string | null;
  write(locale: Locale): void;
}
