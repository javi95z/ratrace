import type { Locale } from '@ratrace/i18n';
import { useCallback, useMemo, useState } from 'react';
import { deviceLanguages, localeOf, type GameLanguage, type LanguageKeep } from './locale';

/**
 * The language the game is played in, for the game's context. On the phone: the one the player chose, kept on the phone, else the phone's own
 * (`localeOf`); a change, chosen or followed, is kept and spoken at once, the screens where they are (the addresses of the stack keep the language the
 * app opened its pages in: `pages.ts`). The web's twin takes the page's address instead.
 */
export function useLanguage(keep: LanguageKeep): GameLanguage {
  const [locale, setLocale] = useState<Locale>(() => localeOf(keep.read(), deviceLanguages()));
  const choose = useCallback(
    (next: Locale) => {
      keep.write(next);
      setLocale(next);
    },
    [keep],
  );
  return useMemo(() => ({ locale, choose, follow: choose }), [locale, choose]);
}
