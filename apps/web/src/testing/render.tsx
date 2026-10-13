import { content, lives } from '@ratrace/content';
import { render } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactElement } from 'react';
import { GameProvider } from '@/game/context';
import type { Services } from '@/game/context';
import { LocalSessions } from '@/session/local';
import { MemoryStore } from '@/session/memory';
import en from '../../messages/en.json';
import es from '../../messages/es.json';
import ru from '../../messages/ru.json';

/**
 * The game's services with nothing behind them but memory, and ids, seeds and a clock that never change.
 * No tap is ever too soon, unless a test asks for the guard; and saving works, unless a test says it does not.
 */
export function memoryServices(store = new MemoryStore(), options: { tapGuardMs?: number; savingOff?: boolean } = {}): Services & { store: MemoryStore; sessions: LocalSessions } {
  let ids = 0;
  let clock = 1_000;
  const sessions = new LocalSessions(store, content, lives, { newId: () => `id-${(ids += 1)}`, newSeed: () => `screen-seed-${ids}`, now: () => (clock += 1) });
  return { sessions, store, tapGuardMs: options.tapGuardMs ?? 0, saving: { degraded: () => options.savingOff === true, subscribe: () => () => {} } };
}

/** Draws a screen inside everything the real pages give it: the language, its text, and the game. */
const MESSAGES = { en, es, ru };

export function renderGame(ui: ReactElement, services: Services, locale: keyof typeof MESSAGES = 'en') {
  return render(
    <NextIntlClientProvider locale={locale} messages={MESSAGES[locale]} timeZone="UTC">
      <GameProvider services={services}>{ui}</GameProvider>
    </NextIntlClientProvider>,
  );
}

/** Makes the page as wide as a desktop, or as narrow as a phone, for components that ask. */
export function setWidth(kind: 'phone' | 'desk') {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (query: string) => ({
      matches: kind === 'desk' && query.includes('min-width'),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }),
  });
}
