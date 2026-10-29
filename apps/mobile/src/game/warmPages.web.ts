import { isLocale } from '@ratrace/i18n/locales';
import { useContext, useEffect } from 'react';
import { Language } from '../ui/text';
import { loadCardWords } from './languageWords';

/** How long the front door waits for an idle moment in a browser that has no `requestIdleCallback` (Safari): a moment after it is drawn. */
const NO_IDLE_WAIT_MS = 1_000;

/**
 * The web export's twin of `warmPages.ts` (Metro picks it for the web): once the front door is idle, the code of `/new` and `/play` starts loading
 * (each page of the export loads its own, `app.json`'s chunks), as the Next web's links prefetch theirs, so that New or Continue tapped then waits
 * for no code. The routes' own modules are loaded, the chunks the router would fetch for them; nothing of them is drawn. So are the cards' words of
 * the page's language, which a life in play reads and the first page never carries (`languageWords.web.ts`).
 */
export function useWarmPages(): void {
  const locale = useContext(Language);
  useEffect(() => {
    const warm = () => {
      void import('../app/[locale]/new').catch(() => undefined);
      void import('../app/[locale]/play').catch(() => undefined);
      if (isLocale(locale)) void loadCardWords(locale).catch(() => undefined);
    };
    if (typeof requestIdleCallback === 'function') {
      const id = requestIdleCallback(warm);
      return () => cancelIdleCallback(id);
    }
    const timer = setTimeout(warm, NO_IDLE_WAIT_MS);
    return () => clearTimeout(timer);
  }, [locale]);
}
