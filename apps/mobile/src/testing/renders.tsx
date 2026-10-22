import { act } from '@testing-library/react';
import { Profiler } from 'react';
import type { ReactNode } from 'react';

/*
 * What a test of "this screen is not drawn again for a change it does not draw" needs, written once so that every screen's render-count
 * test is the same test: a counter round the screen, and a wait for everything the game does after a step (its reads of the device and the
 * state they set, which is what a screen is drawn again for, and which a test that asserts at once cannot see).
 */

/** How many times what is inside has been drawn: every commit that drew anything under it. */
export interface Renders {
  count: number;
}

/** Counts the drawings of what is inside it, into `into`. */
export function Counted({ into, children }: { into: Renders; children: ReactNode }) {
  return (
    <Profiler
      id="counted"
      onRender={() => {
        into.count += 1;
      }}
    >
      {children}
    </Profiler>
  );
}

/** Long enough for the reads and writes the game makes after a step to land and be drawn, on a machine that is busy. */
export const SETTLE_MS = 50;

/** Does `work` (a step of the game, by the actions a probe took from it) and waits for what the game does after it to settle. */
export async function settled(work: () => void | Promise<unknown> = () => undefined, ms = SETTLE_MS): Promise<void> {
  await act(async () => {
    await work();
    await new Promise((done) => setTimeout(done, ms));
  });
}

/**
 * Waits, a settling at a time, until what `read` reads of the drawings is the same twice running: the baseline of a render-count test, taken once the
 * game has stopped drawing, however long that takes on a busy machine (not after a fixed wait). Fails if it never stops.
 */
export async function steady(read: () => unknown, tries = 40): Promise<void> {
  let was = JSON.stringify(read());
  for (let i = 0; i < tries; i++) {
    await settled();
    const now = JSON.stringify(read());
    if (now === was) return;
    was = now;
  }
  throw new Error(`the drawings never settled: ${was}`);
}
