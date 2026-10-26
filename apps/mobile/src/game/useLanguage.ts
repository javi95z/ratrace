import type { Locale } from '@ratrace/i18n/locales';
import { useLocales } from 'expo-localization';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { deviceLanguages, localeOf, type GameLanguage, type LanguageKeep } from './locale';

/**
 * The language the game is played in, for the game's context. On the phone: the one the player chose, kept on the phone, else the phone's own
 * (`localeOf`); a change, chosen or followed, is kept and spoken at once, the screens where they are (the addresses of the stack keep the language the
 * app opened its pages in: `pages.ts`). A change of the phone's languages while the app runs is followed too: the phone's own, or the app's in the
 * phone's settings (Android's per-app language, which the keep reads: `kvLanguage`). The web's twin takes the page's address instead.
 */
export function useLanguage(keep: LanguageKeep): GameLanguage {
  const [locale, setLocale] = useState<Locale>(() => localeOf(keep.read(), deviceLanguages()));
  const phone = useLocales();
  useEffect(() => {
    setLocale(localeOf(keep.read(), deviceLanguages()));
  }, [phone, keep]);
  const choose = useCallback(
    (next: Locale) => {
      keep.write(next);
      setLocale(next);
    },
    [keep],
  );
  return useMemo(() => ({ locale, choose, follow: choose }), [locale, choose]);
}
