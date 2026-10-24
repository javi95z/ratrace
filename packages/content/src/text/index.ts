import { names } from '../names';
import type { Locale, Names } from '../names';
import { en } from './en';
import { after as enAfter } from './en.after';
import { es } from './es';
import { after as esAfter } from './es.after';
import { filled, withAfter } from './fill';
import { ru } from './ru';
import { after as ruAfter } from './ru.after';
import type { ContentText } from './types';

export type { CardText, ContentText } from './types';
export { fillNames, homeName } from './fill';

const raw: Record<Locale, ContentText> = { en: withAfter(en, enAfter), es: withAfter(es, esAfter), ru: withAfter(ru, ruAfter) };

/** The text exactly as written, with its placeholders. For tools that check it. */
export function rawText(locale: Locale): ContentText {
  return raw[locale];
}

/** Everything the interface shows about the content in one language: the sentences, with every name filled in, and the names. */
export function textFor(locale: Locale, pack: Names = names[locale]): { text: ContentText; names: Names } {
  return { text: filled(raw[locale], pack), names: pack };
}
