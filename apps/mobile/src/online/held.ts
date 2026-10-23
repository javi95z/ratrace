import type { Cloud } from '@ratrace/online/supabase';

/*
 * The account's lives in progress, handed to the mirror after the game's first screen. A start that meets an account holding lives the phone must
 * play back (another device's, or finished ones left "playing" by a finish that failed) had the mirror play each back through the engine on the JS
 * thread before the screen was up: the front door drawn at 2.2 s instead of 1.3 (Task 14c). The finished lives and the lives in progress are asked
 * at once, during the start; the list of lives in progress is handed back only once the first screen is drawn, and the rest of the mirror's
 * meeting (the progress, a ranked life) follows it. The mirror then plays the lives back one at a time, the JS thread free between them
 * (`pacedLives`, the mirror's `pace`). The mirror (`@ratrace/online/mirror`) asks the same things in the same order.
 */

/** The cloud, its answer to `playingGames` handed back only once `until` has resolved. The request itself goes at once. */
export function heldSaves(cloud: Cloud, until: () => Promise<void>): Cloud {
  return {
    ...cloud,
    async playingGames() {
      const answer = cloud.playingGames();
      // Asked now; a failure is the mirror's to hear once it is handed back, never an unheard rejection meanwhile.
      answer.catch(() => undefined);
      await until();
      return answer;
    },
  };
}

/** A turn of the JS thread between two lives played back: what is waiting (a touch, a frame's work) goes first. */
export const pacedLives = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

/** How long the lives wait at most for the first screen: a start whose screen never says so still reads them. */
export const FIRST_SCREEN_AT_MOST = 5000;

/**
 * A door the lives in progress wait at (`wait`) until the game's first screen is drawn (`open`), or `FIRST_SCREEN_AT_MOST` after they first came to
 * it. Once open it stays open.
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
