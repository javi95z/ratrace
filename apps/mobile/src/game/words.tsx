import { messagesFor, type Locale } from '@ratrace/i18n';
import type { Translate } from '@ratrace/core/game/present';
import type { ReactNode } from 'react';
import { IntlProvider, useTranslations } from 'use-intl';
import { Language } from '../ui/text';

/**
 * The interface's words in `locale`: the web's own messages, read by use-intl (the ICU engine next-intl is
 * built on), so every key and plural says on the phone what it says on the web. The text of the kit is told the
 * language too, as the web's `<html lang>` tells its CSS.
 */
export function WordsProvider({ locale, timeZone, children }: { locale: Locale; timeZone?: string; children: ReactNode }) {
  return (
    <IntlProvider locale={locale} messages={messagesFor(locale)} timeZone={timeZone}>
      <Language.Provider value={locale}>{children}</Language.Provider>
    </IntlProvider>
  );
}

/** A translator for one section of the interface text, as the web's `useT`. */
export const useT = (section: string): Translate => useTranslations(section) as unknown as Translate;
