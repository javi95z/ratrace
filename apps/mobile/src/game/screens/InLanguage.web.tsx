import { isLocale } from '@ratrace/i18n/locales';
import { useLocalSearchParams } from 'expo-router';
import { lazy, type ReactNode } from 'react';

/**
 * The web export's twin of `InLanguage.tsx` (Metro picks it for the web): the same, but the page of nothing it shows for a language the game does
 * not have (`/de/play`, which the site's middleware never lets through) is fetched only then, the 404's own chunk, so no page of the game carries
 * it in the scripts its HTML loads (`webSize.ts` holds the front door to it).
 */
const NotFound = lazy(() => import('./NotFound').then((page) => ({ default: page.NotFound })));

export function InLanguage({ children }: { children: ReactNode }) {
  const { locale } = useLocalSearchParams<{ locale?: string }>();
  return isLocale(locale) ? children : <NotFound />;
}
