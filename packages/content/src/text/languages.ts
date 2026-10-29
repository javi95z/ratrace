import type { Locale } from '../names';
import { withAfter } from './fill';
import type { AfterText, ContentText, WordsText } from './types';

/*
 * The text of the languages the app's web has loaded so far (`index.web.ts` reads it): the web carries none at first, and each language's text is
 * added here once its own chunk is in (apps/mobile/src/game/languageWords.web.ts), its cards' once their chunk is (they are read only in a life in
 * play, and weigh the most). The phone and the Next web never use it: they carry every language (`index.ts`).
 */
const added: Partial<Record<Locale, WordsText>> = {};
const addedCards: Partial<Record<Locale, ContentText['cards']>> = {};

/** Adds a language's text but its cards, as its file has it (`<locale>.ts`). */
export function addText(locale: Locale, text: WordsText): void {
  added[locale] = text;
}

/** Adds a language's cards, as their files have them (`<locale>.cards.ts` and `<locale>.after.ts`). */
export function addCards(locale: Locale, cards: ContentText['cards'], after: AfterText): void {
  addedCards[locale] = withAfter(cards, after);
}

/** A language's text once it is added, else undefined: with its cards once they are added too, and none until then. */
export function addedText(locale: Locale): ContentText | undefined {
  const text = added[locale];
  return text === undefined ? undefined : { ...text, cards: addedCards[locale] ?? {} };
}

/** A language's cards once they are added, else undefined. */
export function addedCardText(locale: Locale): ContentText['cards'] | undefined {
  return addedCards[locale];
}
