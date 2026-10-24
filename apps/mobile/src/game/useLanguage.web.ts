import { isLocale, type Locale } from '@ratrace/i18n';
import { usePathname, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { deviceLanguages, localeOf, type LanguageKeep } from './locale';
import { hrefOf, pageAt, useLocaleParam } from './pages';

/**
 * The web export's twin of `useLanguage.ts` (Metro picks it for the web): a page's language is its address's (`/es/play` speaks Spanish), as the Next
 * web's `[locale]`; the cookie (`keep`, NEXT_LOCALE) is written again for each page opened in one, as the Next web's middleware writes it, and only
 * chooses where an address with no language leads (the bare `/`, a development route): the cookie's, else the browser's, else English. Choosing a
 * language opens the same page in it (the Next web's `Link locale={code}`), the cookie written for the next visit.
 */
export function useLanguage(keep: LanguageKeep): readonly [Locale, (next: Locale) => void] {
  const param = useLocaleParam();
  const router = useRouter();
  const path = usePathname();
  const [chosen, setChosen] = useState<Locale>(() => localeOf(keep.read(), deviceLanguages()));
  const locale = isLocale(param) ? param : chosen;
  useEffect(() => {
    if (isLocale(param)) keep.write(param);
  }, [keep, param]);
  const choose = useCallback(
    (next: Locale) => {
      keep.write(next);
      setChosen(next);
      const page = pageAt(path);
      if (next !== locale && page !== null) router.push(hrefOf(page, { locale: next }));
    },
    [keep, locale, path, router],
  );
  return [locale, choose] as const;
}
