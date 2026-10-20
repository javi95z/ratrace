import { content, lives } from '@ratrace/content';
import { LocalSessions } from './local';
import type { SessionDeps } from './local';
import { MemoryStore } from './memory';

export type { MemoryStore };

/*
 * A device with nothing on it but memory, and the game on it with ids, seeds and a clock that never change: what the
 * tests of every screen begin their lives with (`memoryServices`, the web's and the phone's), and what the scenes
 * (`testing/scenes.ts`) are built on. Here, in the session's own folder, so that what draws a scene can have a game
 * to draw it on without reaching for the session's internals: it asks for them from here.
 */

/** The ids, seeds and clock of a life: `id-1`, `screen-seed-1`, and a clock that ticks from 1,000 by one at each save. */
export function fixedDeps(): SessionDeps {
  let ids = 0;
  let clock = 1_000;
  return { newId: () => `id-${(ids += 1)}`, newSeed: () => `screen-seed-${ids}`, now: () => (clock += 1) };
}

/** A device that holds nothing, and forgets everything when it is let go. */
export const memoryDevice = (): MemoryStore => new MemoryStore();

/** The game on a device, with the ids, seeds and clock of `fixedDeps`. */
export const fixedSessions = (store: MemoryStore): LocalSessions => new LocalSessions(store, content, lives, fixedDeps());
