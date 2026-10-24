import { names } from '../names';
import type { Locale, Names } from '../names';
import { filled } from './fill';
import { addedText } from './languages';
import type { ContentText } from './types';

/*
 * The app's web's twin of `index.ts` (Metro picks it for the web, never the Next web, the phone or the tools): the same functions, over the languages
 * loaded so far (`languages.ts`) instead of every language at once, so the web's first page carries the words of none but its own (the app's
 * `game/languageWords.web.ts` adds each before the game speaks it).
 */

export type { CardText, ContentText } from './types';
export { fillNames, homeName } from './fill';

/** The text exactly as written, with its placeholders. A language not loaded yet is an error: the game never speaks one before it is in. */
export function rawText(locale: Locale): ContentText {
  const text = addedText(locale);
  if (text === undefined) throw new Error(`the text of ${locale} is not loaded`);
  return text;
}

/** Everything the interface shows about the content in one language: the sentences, with every name filled in, and the names. */
export function textFor(locale: Locale, pack: Names = names[locale]): { text: ContentText; names: Names } {
  return { text: filled(rawText(locale), pack), names: pack };
}
