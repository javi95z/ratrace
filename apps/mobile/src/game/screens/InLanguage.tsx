import { isLocale } from '@ratrace/i18n/locales';
import { Unmatched, useLocalSearchParams } from 'expo-router';
import type { ReactNode } from 'react';

/**
 * A page of the game, under the language of its address (`app/[locale]/*`): drawn in one of the game's languages, and for any other first part of
 * the address (`/de/play`) the router's own page of nothing, as the Next web's `notFound()` answers a language it does not have.
 */
export function InLanguage({ children }: { children: ReactNode }) {
  const { locale } = useLocalSearchParams<{ locale?: string }>();
  return isLocale(locale) ? children : <Unmatched />;
}
