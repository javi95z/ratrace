import { content, lives } from '@ratrace/content';
import { LocalSessions } from '@ratrace/core/session/local';
import { MemoryStore } from '@ratrace/core/session/memory';
import type { Locale } from '@ratrace/i18n';
import type { Services } from '../game/context';

/**
 * The game's services with nothing behind them but memory, and ids, seeds and a clock that never change.
 * No tap is ever too soon, unless a test asks for the guard; and saving works, unless a test says it does not.
 * (The web's testing/render.tsx makes the same, and so does the core's `fixedDeps` for the scenes: a life begun
 * with any of them is the same life.) Kept apart from the render of the tests so the development route that draws
 * a scene (`scene.tsx`) can have it without a test library.
 */
export function memoryServices(store = new MemoryStore(), options: { tapGuardMs?: number; savingOff?: boolean } = {}): Services & { store: MemoryStore; sessions: LocalSessions } {
  let ids = 0;
  let clock = 1_000;
  const sessions = new LocalSessions(store, content, lives, { newId: () => `id-${(ids += 1)}`, newSeed: () => `screen-seed-${ids}`, now: () => (clock += 1) });
  return { sessions, store, tapGuardMs: options.tapGuardMs ?? 0, saving: { degraded: () => options.savingOff === true, subscribe: () => () => {} } };
}

/**
 * The services in a language: the one asked for, whatever the phone speaks and whatever it kept, unless the services
 * keep a language of their own. A language chosen afterwards is kept in memory, and nowhere else.
 */
export function speaking<S extends Services>(services: S, locale: Locale): S {
  let chosen: string = locale;
  return { ...services, language: services.language ?? { read: () => chosen, write: (next: Locale) => void (chosen = next) } };
}
