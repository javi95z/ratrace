import { names } from '../names';
import type { Locale, Names } from '../names';
import { en } from './en';
import { cards as enCards } from './en.cards';
import { after as enAfter } from './en.after';
import { es } from './es';
import { cards as esCards } from './es.cards';
import { after as esAfter } from './es.after';
import { filled, withAfter } from './fill';
import { ru } from './ru';
import { cards as ruCards } from './ru.cards';
import { after as ruAfter } from './ru.after';
import type { ContentText } from './types';

export type { AfterText, CardText, ContentText, WordsText } from './types';
export { fillNames, homeName } from './fill';

const raw: Record<Locale, ContentText> = {
  en: { ...en, cards: withAfter(enCards, enAfter) },
  es: { ...es, cards: withAfter(esCards, esAfter) },
  ru: { ...ru, cards: withAfter(ruCards, ruAfter) },
};

/** The text exactly as written, with its placeholders. For tools that check it. */
export function rawText(locale: Locale): ContentText {
  return raw[locale];
}

/** Everything the interface shows about the content in one language: the sentences, with every name filled in, and the names. */
export function textFor(locale: Locale, pack: Names = names[locale]): { text: ContentText; names: Names } {
  return { text: filled(raw[locale], pack), names: pack };
}

/** The cards' text in one language, every name filled in: the part of `textFor`'s text a life in play reads (the app's web loads it apart). */
export function cardsFor(locale: Locale, pack: Names = names[locale]): ContentText['cards'] {
  return filled(raw[locale].cards, pack);
}
