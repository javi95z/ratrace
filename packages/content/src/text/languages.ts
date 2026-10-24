import type { Locale } from '../names';
import { withAfter } from './fill';
import type { ContentText } from './types';

/*
 * The text of the languages the app's web has loaded so far (`index.web.ts` reads it): the web carries none at first, and each language's text is
 * added here once its own chunk is in (apps/mobile/src/game/languageWords.web.ts). The phone and the Next web never use it: they carry every language
 * (`index.ts`).
 */
const added: Partial<Record<Locale, ContentText>> = {};

/** Adds a language's text, as its files have it (`<locale>.ts` and `<locale>.after.ts`). */
export function addText(locale: Locale, text: ContentText, after: Record<string, ReadonlyArray<string | null>>): void {
  added[locale] = withAfter(text, after);
}

/** A language's text once it is added, else undefined. */
export function addedText(locale: Locale): ContentText | undefined {
  return added[locale];
}
