import { describe, expect, it } from 'vitest';
import { DEFAULT_LOCALE, isLocale, LOCALES, MESSAGES, messagesFor } from './index';

/** Every key of a tree of words, as a dotted path. */
const keys = (tree: object, at = ''): string[] =>
  Object.entries(tree).flatMap(([key, value]) => (typeof value === 'object' && value !== null ? keys(value, `${at}${key}.`) : [`${at}${key}`]));

describe('the words of the interface', () => {
  it('are in every language the game is played in, with the same keys in all', () => {
    expect(LOCALES).toEqual(['en', 'es', 'ru']);
    const english = keys(MESSAGES.en).sort();
    for (const locale of LOCALES) expect(keys(MESSAGES[locale]).sort(), locale).toEqual(english);
  });

  it('fall back to the default language for one the game does not speak', () => {
    expect(isLocale('es')).toBe(true);
    expect(isLocale('fr')).toBe(false);
    expect(messagesFor('ru')).toBe(MESSAGES.ru);
    expect(messagesFor('fr')).toBe(MESSAGES[DEFAULT_LOCALE]);
  });
});
