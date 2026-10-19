import en from '../messages/en.json';
import es from '../messages/es.json';
import ru from '../messages/ru.json';

/**
 * The words of the game's interface, in every language it is played in: the buttons, the screens,
 * the sheets. The words of the game itself (cards, careers, cities) are the content's. Kept apart
 * from any app, so that the web and an app of another kind say the same things.
 */
export const LOCALES = ['en', 'es', 'ru'] as const;
export type Locale = (typeof LOCALES)[number];

/** The language a first visit falls back to when the browser's is not one of these. */
export const DEFAULT_LOCALE: Locale = 'en';

/** The interface's words, by language: the same keys in all. */
export type Messages = typeof en;
export const MESSAGES: Record<Locale, Messages> = { en, es, ru };

/** True for a language the game is played in. */
export const isLocale = (value: unknown): value is Locale => typeof value === 'string' && (LOCALES as readonly string[]).includes(value);

/** The interface's words in a language, or in the default one for any other. */
export const messagesFor = (locale: string): Messages => (isLocale(locale) ? MESSAGES[locale] : MESSAGES[DEFAULT_LOCALE]);
