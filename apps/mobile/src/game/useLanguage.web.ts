import { isLocale, type Locale } from '@ratrace/i18n/locales';
import { usePathname, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { languageReady, loadLanguageWords } from './languageWords';
import { deviceLanguages, localeOf, type GameLanguage, type LanguageKeep } from './locale';
import { hrefOf, pageAt, useLocaleParam } from './pages';

/**
 * The web export's twin of `useLanguage.ts` (Metro picks it for the web): a page's language is its address's (`/es/play` speaks Spanish), as the Next
 * web's `[locale]`; the cookie (`keep`, NEXT_LOCALE) is written again for each page opened in one (also as the router moves between pages), as the Next web's middleware writes it for each page, and only
 * chooses where an address with no language leads (the bare `/`, a development route): the cookie's, else the browser's, else English.
 *
 * Choosing a language opens the same page in it (the Next web's `Link locale={code}`), the cookie written for the next visit, once its words are in (each
 * language is a chunk of its own: `languageWords.web.ts`), so the page in front stays as it is until the next can speak; of two asked for in turn,
 * the last is the one opened, whichever's words come in first. Following an account's
 * language as someone signs in puts the same page in it in place of this one, its query and hash kept, as the Next web's `online/language.ts` does
 * (`location.replace`): Back does not lead to the language the account left. Both keep their identity from page to page (the address is read when they
 * are called), so nothing that holds them starts again, nor is drawn again, as the player moves.
 */
export function useLanguage(keep: LanguageKeep): GameLanguage {
  const param = useLocaleParam();
  const router = useRouter();
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
  // The language last asked for (chosen, or the account's): a language whose words come in after another was asked for is not opened.
  const asked = useRef<Locale | null>(null);
  const choose = useCallback(
    (next: Locale) => {
      keep.write(next);
      asked.current = next;
      onceSpoken(next, () => {
        if (asked.current !== next) return;
        setChosen(next);
        const page = pageAt(now.current.path);
        if (next !== now.current.locale && page !== null) router.push(hrefOf(page, { locale: next }));
      });
    },
    [keep, router],
  );
  const follow = useCallback(
    (next: Locale) => {
      keep.write(next);
      asked.current = next;
      onceSpoken(next, () => {
        if (asked.current !== next) return;
        setChosen(next);
        // The page in the browser's address bar when the account's answer comes (and the words of its language are in), whichever the player has
        // moved to since.
        const page = pageAt(window.location.pathname);
        if (next !== now.current.locale && page !== null) router.replace(`${hrefOf(page, { locale: next })}${window.location.search}${window.location.hash}`);
      });
    },
    [keep, router],
  );
  return useMemo(() => ({ locale, choose, follow }), [locale, choose, follow]);
}

/**
 * Runs `then` once a language's words are in: at once where they are, else when its chunk is (nothing, where it cannot be had: the page stays in the
 * language it speaks, rather than open one it cannot draw).
 */
function onceSpoken(locale: Locale, then: () => void): void {
  if (languageReady(locale)) then();
  else loadLanguageWords(locale).then(then, () => undefined);
}
