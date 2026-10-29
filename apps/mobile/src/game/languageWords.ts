import { cardsFor, textFor, type ContentText, type Names } from '@ratrace/content';
import { messagesFor, type Messages } from '@ratrace/i18n';
import type { Locale } from '@ratrace/i18n/locales';
import { useMemo } from 'react';

/*
 * The words of a language as the game speaks it: the interface's (`@ratrace/i18n`'s messages, read by use-intl) and the content's (cards, careers,
 * cities, with their names filled in). The phone carries every language, so each is there the moment it is asked for. The web loads only its page's
 * (`languageWords.web.ts`).
 */

/** The interface's words in a language. */
export function useMessages(locale: Locale): Messages {
  return messagesFor(locale);
}

/** The content's words in a language: its sentences, every name filled in, and its names. Made again only when the language changes. */
export function useContentText(locale: Locale): { text: ContentText; names: Names } {
  return useMemo(() => textFor(locale), [locale]);
}

/** The interface's words in a language, where they can be read at once: always, on the phone. */
export function loadedMessages(locale: Locale): Messages | undefined {
  return messagesFor(locale);
}

/** Whether a language's words can be read at once: always, on the phone. */
export function languageReady(locale: Locale): boolean {
  void locale;
  return true;
}

/** Loads a language's words ahead of the game speaking it: nothing to load on the phone. */
export function loadLanguageWords(locale: Locale): Promise<void> {
  void locale;
  return Promise.resolve();
}

/** The cards' text of each language, every name filled in, made once each. */
const cards = new Map<Locale, ContentText['cards']>();

/** The cards' text in a language, every name filled in: there at once, on the phone (the web loads it where a life is played). */
export function useCardText(locale: Locale): ContentText['cards'] {
  let known = cards.get(locale);
  if (known === undefined) {
    known = cardsFor(locale);
    cards.set(locale, known);
  }
  return known;
}

/** Whether a language's cards can be read at once: always, on the phone. */
export function cardWordsReady(locale: Locale): boolean {
  void locale;
  return true;
}

/** Loads a language's cards ahead of a life in play: nothing to load on the phone. */
export function loadCardWords(locale: Locale): Promise<void> {
  void locale;
  return Promise.resolve();
}
