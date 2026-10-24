/*
 * The words of the web's page of a fault (`PageFault.web.tsx`), written into each page's HTML in its language by the document (`app/+html.tsx`): the
 * page of a fault must speak when the fault is that the language's own words could not be had (its chunk, `languageWords.web.ts`). Nothing of a
 * language's words is here: the document, drawn on the build's machine only, reads them from `@ratrace/i18n`.
 */

/** The id of the HTML's script that holds them, as JSON. */
export const FAULT_WORDS = 'ratrace-fault-words';

/** The Next web's error page's words (`play.faultTitle`, `faultBody`, `retry`, `newLife`, `home`), as the HTML holds them. */
export interface FaultWords {
  faultTitle: string;
  faultBody: string;
  retry: string;
  newLife: string;
  home: string;
}

/** The keys of `play` they are. */
export const FAULT_KEYS: readonly (keyof FaultWords)[] = ['faultTitle', 'faultBody', 'retry', 'newLife', 'home'];
