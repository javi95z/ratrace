import { useEffect, useState } from 'react';
import { scheduleOnRN, scheduleOnUI } from 'react-native-worklets';

/** A frame of the UI thread that came this soon after the one before is one of a thread drawing at its pace (the display's 16.7, give or take). */
const SMOOTH_MS = 25;
/** How many frames at most it waits for one at that pace: a screen that never calms down still gets the rest of its page. */
const MOST_FRAMES = 8;

/**
 * Calls `then` once what was committed before this call is on the screen and the UI thread is drawing at its pace again: a hop to the UI thread
 * (queued after the commit's mounting), its frames from there until one comes as soon as a smooth one does, and back. The next part of a long page
 * is put in only then, so the frames that put in one part never follow those of the part before without a frame of the display's between (a part
 * put in at once the frame after left the UI thread busy for every part in a row: the shop's shelves, measured). Returns what calls it off (a
 * component gone before then is not told).
 */
export function whenShown(then: () => void): () => void {
  let live = true;
  const told = () => {
    if (live) then();
  };
  scheduleOnUI(() => {
    'worklet';
    let last = -1;
    let frames = 0;
    const next = (at: number) => {
      frames += 1;
      if (last >= 0 && (at - last <= SMOOTH_MS || frames >= MOST_FRAMES)) {
        scheduleOnRN(told);
        return;
      }
      last = at;
      requestAnimationFrame(next);
    };
    requestAnimationFrame(next);
  });
  return () => {
    live = false;
  };
}

/**
 * Whether what the calling component drew with its first commit is on the screen: false at first, true once that commit's views are in and the UI
 * thread draws at its pace again (`whenShown`).
 *
 * For a panel taller than a phone's screen: it draws the part a player sees first, and the rest once that part is on screen. Each native view
 * and each picture's canvas costs the UI thread its making and its first drawing, and all of a long tab at once kept the tab from the screen
 * for every one of them (the Lifestyle tab, measured: perf in the parity report); the part below the screen's edge is put in while the player
 * reads the top.
 */
export function useDrawnFirst(): boolean {
  const [shown, setShown] = useState(false);
  useEffect(() => whenShown(() => setShown(true)), []);
  return shown;
}
