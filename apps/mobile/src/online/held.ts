import type { SyncCloud } from '@ratrace/online/mirror';
import type { Cloud } from '@ratrace/online/supabase';

/*
 * The account's saves, put after the game's first screen. A start that meets an account lacking lives the phone finished (the first starts after
 * signing in, or a life whose finish failed) has the mirror read the account, play its lives in progress again and send the finished ones, a second
 * or so of the JS thread (measured: the front door drawn at 2.2 s instead of 1.3). None of it is what the player waits for: it waits until the first
 * screen is drawn, and each ask then goes at a moment the JS thread has nothing else to do. The mirror (`@ratrace/online/mirror`) is the web's, and
 * unchanged: it asks the same things in the same order, one at a time, a little later.
 */

/** What the mirror asks of the account: every one of these waits. Nothing else of the cloud does (signing in, the rooms, the rankings, the friends). */
const SAVES = ['playingGames', 'pushGame', 'abandonGame', 'loadProgress', 'saveProgress', 'listRuns', 'rankedLife', 'giveUpRanked', 'finishRun'] as const satisfies readonly (keyof SyncCloud)[];

/** The cloud, its saves each asked only once `until` has resolved, then at a moment the JS thread is free (`idle`). */
export function heldSaves(cloud: Cloud, until: () => Promise<void>, idle: () => Promise<void> = whenIdle): Cloud {
  const held: Partial<SyncCloud> = {};
  for (const name of SAVES) {
    const ask = cloud[name] as (...args: unknown[]) => Promise<unknown>;
    (held as Record<string, unknown>)[name] = async (...args: unknown[]) => {
      await until();
      await idle();
      return ask.apply(cloud, args);
    };
  }
  return { ...cloud, ...held };
}

/** How long an ask waits at most for the JS thread to be free: a thread that is never free still saves. */
const IDLE_AT_MOST = 1000;

/** Resolved when the JS thread has nothing else to do (React Native's `requestIdleCallback`), or at most a second later; a turn later without it. */
export function whenIdle(): Promise<void> {
  const g = globalThis as { requestIdleCallback?: (run: () => void, options?: { timeout: number }) => unknown };
  return new Promise((resolve) => {
    if (typeof g.requestIdleCallback === 'function') g.requestIdleCallback(() => resolve(), { timeout: IDLE_AT_MOST });
    else setTimeout(resolve, 0);
  });
}

/** How long the saves wait at most for the first screen: a start whose screen never says so still saves. */
export const FIRST_SCREEN_AT_MOST = 5000;

/**
 * A door the saves wait at (`wait`) until the game's first screen is drawn (`open`), or `FIRST_SCREEN_AT_MOST` after they first came to it. Once
 * open it stays open: what the player does later is saved as before, a moment later.
 */
export function firstScreenDoor(schedule: (run: () => void, ms: number) => unknown = setTimeout): { open(): void; wait(): Promise<void>; isOpen(): boolean } {
  let opened = false;
  let release: () => void = () => undefined;
  const door = new Promise<void>((resolve) => {
    release = resolve;
  });
  let timed = false;
  const open = () => {
    opened = true;
    release();
  };
  return {
    open,
    isOpen: () => opened,
    wait() {
      if (!opened && !timed) {
        timed = true;
        schedule(open, FIRST_SCREEN_AT_MOST);
      }
      return door;
    },
  };
}
