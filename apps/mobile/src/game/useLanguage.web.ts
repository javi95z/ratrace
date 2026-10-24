import { isLocale, type Locale } from '@ratrace/i18n/locales';
import { usePathname } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { closeAllSheets, sheetsGone } from '../ui/back';
import { languageReady, loadLanguageWords } from './languageWords';
import { deviceLanguages, localeOf, type GameLanguage, type LanguageKeep } from './locale';
import { openDocument } from './openDocument';
import { hrefOf, pageAt, useLocaleParam } from './pages';

/**
 * The web export's twin of `useLanguage.ts` (Metro picks it for the web): a page's language is its address's (`/es/play` speaks Spanish), as the Next
 * web's `[locale]`; the cookie (`keep`, NEXT_LOCALE) is written again for each page opened in one (also as the router moves between pages), as the Next web's middleware writes it for each page, and only
 * chooses where an address with no language leads (the bare `/`, a development route): the cookie's, else the browser's, else English.
 *
 * Choosing a language opens the same page in it (the Next web's `Link locale={code}`), the cookie written for the next visit, once its words are in (each
 * language is a chunk of its own: `languageWords.web.ts`), so the page in front stays as it is until the next can speak; of two asked for in turn,
 * the last is the one opened, whichever's words come in first, and one asked for twice is opened once. Following an account's
 * language as someone signs in puts the same page in it in place of this one, its query and hash kept, as the Next web's `online/language.ts` does
 * (`location.replace`): Back does not lead to the language the account left. Both keep their identity from page to page (the address is read when they
 * are called), so nothing that holds them starts again, nor is drawn again, as the player moves.
 *
 * The page in the other language is a new document (`openDocument`), as the Next web's language link leaves its `[locale]` page for another: the
 * export has each page's HTML in each language, `<html lang>` and all, so the old screen goes with its document (no screen of one language left
 * mounted under the other's, nor its marks and focus targets twice in the page), the stack starts again from the page opened, and Back still leads
 * to the language left (the router's push would stack the page over the old one; its replace would leave the screens under it in the old language
 * and lose Back). The sheets open over the page are closed first, as the player would close them, and their entries of the history taken out
 * (`closeAllSheets`, `sheetsGone`), so Back from the new page is the old page, not one of its sheets. The `lang` of the page follows the language
 * spoken where it changes in place (a page with no language in its address).
 */
export function useLanguage(keep: LanguageKeep): GameLanguage {
  const param = useLocaleParam();
  const path = usePathname();
  const [chosen, setChosen] = useState<Locale>(() => localeOf(keep.read(), deviceLanguages()));
  const locale = isLocale(param) ? param : chosen;
  // The address as it is now, for a change asked for later.
  const now = useRef({ path, locale });
  now.current = { path, locale };
  // Written again for each page opened, whichever way (a full load, or the router's move to another page): a cookie a script writes lives a week at
  // most in some browsers, and a visit within that week is a year more.
  useEffect(() => {
    if (isLocale(param)) keep.write(param);
  }, [keep, param, path]);
  // The page's language is the document's, for whoever reads it aloud: the export's HTML says it, and a change in place says it again.
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  // The language last asked for (chosen, or the account's) and not opened yet: a language whose words come in after another was asked for is not
  // opened, and one asked for again while on its way is not asked for twice.
  const asked = useRef<Locale | null>(null);
  /** Speaks `next` once its words are in, and opens `address()` in it (read then) as `how` says, unless it is the page's own language already. */
  const speak = useCallback(
    (next: Locale, how: 'push' | 'replace', address: () => string | null) => {
      keep.write(next);
      if (asked.current === next) return;
      asked.current = next;
      onceSpoken(
        next,
        async () => {
          if (asked.current !== next) return;
          setChosen(next);
          const opened = next === now.current.locale ? null : address();
          if (opened === null) {
            asked.current = null;
            return;
          }
          closeAllSheets();
          await sheetsGone();
          // Another language asked for while the sheets went: that one is opened instead.
          if (asked.current === next) openDocument(opened, how);
        },
        () => {
          if (asked.current === next) asked.current = null;
        },
      );
    },
    [keep],
  );
  const choose = useCallback(
    (next: Locale) => {
      speak(next, 'push', () => {
        const page = pageAt(now.current.path);
        return page === null ? null : hrefOf(page, { locale: next });
      });
    },
    [speak],
  );
  const follow = useCallback(
    (next: Locale) => {
      // The page in the browser's address bar when the account's answer comes (and the words of its language are in), whichever the player has
      // moved to since, its query and hash kept.
      speak(next, 'replace', () => {
        const page = pageAt(window.location.pathname);
        return page === null ? null : `${hrefOf(page, { locale: next })}${window.location.search}${window.location.hash}`;
      });
    },
    [speak],
  );
  return useMemo(() => ({ locale, choose, follow }), [locale, choose, follow]);
}

/**
 * Runs `then` once a language's words are in: at once where they are, else when its chunk is (`failed`, where it cannot be had: the page stays in
 * the language it speaks, rather than open one it cannot draw).
 */
function onceSpoken(locale: Locale, then: () => unknown, failed: () => void): void {
  if (languageReady(locale)) void then();
  else loadLanguageWords(locale).then(then, failed);
}
