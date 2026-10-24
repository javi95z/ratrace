import { MESSAGES } from '@ratrace/i18n';
import type { Locale } from '@ratrace/i18n/locales';
import { FAULT_KEYS } from './faultWords';

/**
 * The words of the page of a fault in a page's language (`faultWords.ts`), as the JSON the HTML's script holds and runs nothing of: for the document
 * (`app/+html.tsx`), drawn on the build's machine only, which has every language's words. `<` is written as its escape, so nothing in them ends
 * the script. Never imported by what the browser runs: it carries every language.
 */
export function faultWordsJson(lang: Locale): string {
  const play = MESSAGES[lang].play;
  return JSON.stringify(Object.fromEntries(FAULT_KEYS.map((key) => [key, play[key]]))).replace(/</g, '\\u003c');
}
