import { isLocale, type Locale } from '@ratrace/i18n';
import { usePathname, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { deviceLanguages, localeOf, type GameLanguage, type LanguageKeep } from './locale';
import { hrefOf, pageAt, useLocaleParam } from './pages';

/**
 * The web export's twin of `useLanguage.ts` (Metro picks it for the web): a page's language is its address's (`/es/play` speaks Spanish), as the Next
 * web's `[locale]`; the cookie (`keep`, NEXT_LOCALE) is written again for each page opened in one, as the Next web's middleware writes it, and only
 * chooses where an address with no language leads (the bare `/`, a development route): the cookie's, else the browser's, else English.
 *
 * Choosing a language opens the same page in it (the Next web's `Link locale={code}`), the cookie written for the next visit. Following an account's
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
  useEffect(() => {
    if (isLocale(param)) keep.write(param);
  }, [keep, param]);
  const choose = useCallback(
    (next: Locale) => {
      keep.write(next);
      setChosen(next);
      const page = pageAt(now.current.path);
      if (next !== now.current.locale && page !== null) router.push(hrefOf(page, { locale: next }));
    },
    [keep, router],
  );
  const follow = useCallback(
    (next: Locale) => {
      keep.write(next);
      setChosen(next);
      // The page in the browser's address bar when the account's answer comes, whichever the player has moved to since.
      const page = pageAt(window.location.pathname);
      if (next !== now.current.locale && page !== null) router.replace(`${hrefOf(page, { locale: next })}${window.location.search}${window.location.hash}`);
    },
    [keep, router],
  );
  return useMemo(() => ({ locale, choose, follow }), [locale, choose, follow]);
}
