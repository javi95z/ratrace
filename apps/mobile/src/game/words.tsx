import { messagesFor, type Locale } from '@ratrace/i18n';
import type { Translate } from '@ratrace/core/game/present';
import type { ReactNode } from 'react';
import { IntlProvider, useTranslations } from 'use-intl';

/**
 * The interface's words in `locale`: the web's own messages, read by use-intl (the ICU engine next-intl is
 * built on), so every key and plural says on the phone what it says on the web.
 */
export function WordsProvider({ locale, timeZone, children }: { locale: Locale; timeZone?: string; children: ReactNode }) {
  return (
    <IntlProvider locale={locale} messages={messagesFor(locale)} timeZone={timeZone}>
      {children}
    </IntlProvider>
  );
}

/** A translator for one section of the interface text, as the web's `useT`. */
export const useT = (section: string): Translate => useTranslations(section) as unknown as Translate;
