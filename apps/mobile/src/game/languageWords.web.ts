import { textFor, type ContentText, type Names } from '@ratrace/content';
import { addText } from '@ratrace/content/text/languages';
import type { Messages } from '@ratrace/i18n';
import type { Locale } from '@ratrace/i18n/locales';
import { use, useMemo } from 'react';

/*
 * The web export's twin of `languageWords.ts` (Metro picks it for the web). The browser is given the words of its page's language only, as the Next
 * web's page is (next-intl's messages of its `[locale]`): each language is a chunk of its own (`languages/<locale>.ts`), fetched when a page first
 * speaks it, and the others when the player turns to them (`useLanguage.web.ts` loads a language before it opens a page in it). Until its words are
 * in, a page that speaks it waits (`use`): while the page hydrates, React keeps the HTML the build drew, whole, and takes it over once they are
 * (the Suspense round the game in `app/_layout.tsx`). On the build's machine, which draws every page in its language at once, every language is
 * there from the start, and never in the browser's code (`process.env.EXPO_SERVER` is false there, and the branch is dropped).
 */

/** One language's chunk, as `languages/<locale>.ts` gives it. */
type Language = typeof import('./languages/en');

const CHUNKS: Readonly<Record<Locale, () => Promise<Language>>> = {
  en: () => import('./languages/en'),
  es: () => import('./languages/es'),
  ru: () => import('./languages/ru'),
};

/**
 * A load as React's `use` reads one: its outcome written on it as it settles (`status`, React's own convention), so a page that asks for a language
 * already in is drawn at once, never made to wait a turn for a promise React has not seen before.
 */
type Load = Promise<void>;

function readable(load: Load): Load {
  const read = load as Load & { status?: 'pending' | 'fulfilled' | 'rejected'; reason?: unknown };
  read.status = 'pending';
  load.then(
    () => {
      read.status = 'fulfilled';
    },
    (reason: unknown) => {
      read.status = 'rejected';
      read.reason = reason;
    },
  );
  return load;
}

/** The interface's words of each language in, by language (the content's are in `@ratrace/content`'s, `addText`). */
const messages = new Map<Locale, Messages>();
/** Each language asked for: one fetch for every place that asks. A fetch that failed is kept as it failed, until it is asked for again (`loadLanguageWords`). */
const loading = new Map<Locale, Load>();

function add(locale: Locale, language: Language): void {
  addText(locale, language.text, language.after);
  messages.set(locale, language.messages as Messages);
}

if (process.env.EXPO_SERVER) {
  // Required, not imported: on the build's machine only (each page's HTML speaks its language at once), and so never in the browser's chunks.
  add('en', require('./languages/en') as Language);
  add('es', require('./languages/es') as Language);
  add('ru', require('./languages/ru') as Language);
}

/** The interface's words in a language, where they are in; nothing until then (nothing waits for them: the page of a fault, `PageFault.web.tsx`). */
export function loadedMessages(locale: Locale): Messages | undefined {
  return messages.get(locale);
}

/** Whether a language's words can be read at once (they are in). */
export function languageReady(locale: Locale): boolean {
  return messages.has(locale);
}

/** Whether a load has failed (React's `status`, as `readable` writes it). */
const failed = (load: Load): boolean => (load as Load & { status?: string }).status === 'rejected';

/**
 * The load a page drawn in a language waits on: the one under way or done, a failed one among them. A page drawn while its language cannot be had
 * is told so (`use` throws the failure, to the root's page of a fault, `PageFault.web.tsx`), once: were a failed load forgotten here, the page,
 * drawn again for the next, would fetch the chunk again and again and never be told.
 */
function wordsLoad(locale: Locale): Load {
  return loading.get(locale) ?? loadLanguageWords(locale);
}

/**
 * Loads a language's words (its chunk), once: what every place that asks for it waits on. One whose fetch failed is asked again by whoever asks
 * for it next this way (a language chosen, another try from the page of a fault); a page drawn meanwhile is told it failed (`wordsLoad`).
 */
export function loadLanguageWords(locale: Locale): Load {
  const known = loading.get(locale);
  if (known && !failed(known)) return known;
  const load: Load = languageReady(locale)
    ? Object.assign(Promise.resolve(), { status: 'fulfilled' as const })
    : readable(CHUNKS[locale]().then((language) => add(locale, language)));
  loading.set(locale, load);
  return load;
}

/** The interface's words in a language, once they are in: until then the page that asks waits for them. */
export function useMessages(locale: Locale): Messages {
  use(wordsLoad(locale));
  return messages.get(locale)!;
}

/** The content's words in a language, once they are in (the page waits until then): made again only when the language changes. */
export function useContentText(locale: Locale): { text: ContentText; names: Names } {
  use(wordsLoad(locale));
  return useMemo(() => textFor(locale), [locale]);
}
