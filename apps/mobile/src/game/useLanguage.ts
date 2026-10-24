import type { Locale } from '@ratrace/i18n';
import { useCallback, useState } from 'react';
import { deviceLanguages, localeOf, type LanguageKeep } from './locale';

/**
 * The language the game is played in, and how the player changes it, for the game's context. On the phone: the one the player chose, kept on the
 * phone, else the phone's own (`localeOf`); a change is kept and spoken at once, the screens where they are (the addresses of the stack keep the
 * language the app opened its pages in: `pages.ts`). The web's twin takes the page's address instead.
 */
export function useLanguage(keep: LanguageKeep): readonly [Locale, (next: Locale) => void] {
  const [locale, setLocale] = useState<Locale>(() => localeOf(keep.read(), deviceLanguages()));
  const choose = useCallback(
    (next: Locale) => {
      keep.write(next);
      setLocale(next);
    },
    [keep],
  );
  return [locale, choose] as const;
}
