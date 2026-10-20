import { content, lives } from '@ratrace/content';
import { LocalSessions } from '@ratrace/core/session/local';
import { MemoryStore } from '@ratrace/core/session/memory';
import type { Locale } from '@ratrace/i18n';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { GameProvider } from '../game/context';
import type { Services } from '../game/context';

// What the tests of the game read of the phone's stand-ins (`fakes.ts`): the router's spies, the phone's languages and
// key-value store, the cues played, the edges of the screen.
export { device, heard, insets, kv, router } from './fakes';

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

/**
 * Draws a screen inside everything the real app gives it: the language, its words, and the game. The language is the
 * one asked for, whatever the phone speaks and whatever it kept, unless the services keep a language of their own.
 */
export function renderGame(ui: ReactElement, services: Services, locale: Locale = 'en') {
  let chosen: string = locale;
  const language = services.language ?? { read: () => chosen, write: (next: Locale) => void (chosen = next) };
  return render(<GameProvider services={{ ...services, language }}>{ui}</GameProvider>);
}
