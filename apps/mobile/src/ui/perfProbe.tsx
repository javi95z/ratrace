import { useEffect, useLayoutEffect } from 'react';
import { useFrameCallback, useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN, scheduleOnUI } from 'react-native-worklets';

/*
 * The timing probe, in a build made with `EXPO_PUBLIC_PERF=1` only (ui/perf.ts requires this file behind that flag; a build without it has none
 * of this). It measures what the player waits for, from the touch that asked for it to the frame that shows it, and the frames of both threads,
 * and tells each to the collector on this machine (`scripts/perf.ts`, which the simulator reaches as its own 127.0.0.1): nothing leaves the machine.
 *
 * - **From**: the last touch let go anywhere (the root's and each sheet's `onTouchEnd`), or what the phone started itself (`start`: a swipe let go,
 *   told from the UI thread). Times are the JS thread's `performance.now()`, read when the JS thread hears of it.
 * - **Drawn**: a `Drawn` mounted with what it marks (a screen, a stage, a tab, a sheet) and its name changed with it: its commit (a layout effect),
 *   then a hop to the UI thread queued after the commit's mounting, one frame there (`requestAnimationFrame` of the UI runtime), and back. What
 *   is told is the time from the touch to that, so the mounting of the native views and one frame are in it.
 * - **Frames**: every frame of the UI thread (Reanimated's frame callback, on the display link) and of the JS thread (`requestAnimationFrame`),
 *   summed a second at a time: how many, the longest, and how many were missed at 60 a second.
 * - **Counting**: the JS thread's work for each step of a counting figure (`useCountUp`): from its value set to its drawing committed.
 */

/** Where the collector listens (scripts/perf.ts). */
export const COLLECTOR = 'http://127.0.0.1:8095/perf';
/** A frame at 60 a second. */
const FRAME_MS = 1000 / 60;

let told = 0;
/** Tells the collector one line, with the wall clock (the collector's own, on the same machine) for what is timed from outside the app: its launch. */
function tell(line: Record<string, unknown>): void {
  told += 1;
  void fetch(COLLECTOR, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...line, n: told, wall: Date.now() }) }).catch(() => undefined);
}

/** What the player is waiting from. */
let from: { at: number; what: string } | null = null;

export function touched(): void {
  from = { at: performance.now(), what: 'touch' };
}

export function start(what: string): void {
  from = { at: performance.now(), what };
}

/** Calls `done` on the JS thread after the UI thread has drawn a frame past everything queued to it so far (the mounting of the last commit). */
function afterAFrame(done: () => void): void {
  scheduleOnUI(() => {
    'worklet';
    requestAnimationFrame(() => {
      scheduleOnRN(done);
    });
  });
}

export function Drawn({ name }: { name: string }): null {
  useLayoutEffect(() => {
    const since = from;
    const committed = performance.now();
    afterAFrame(() => {
      const drawn = performance.now();
      tell({ kind: 'drawn', name, what: since?.what ?? null, commitMs: since ? committed - since.at : null, drawnMs: since ? drawn - since.at : null });
    });
  }, [name]);
  return null;
}

/** The JS thread's frames of the second under way. */
const js = { frames: 0, worst: 0, missed: 0 };

function reportSecond(uiFrames: number, uiWorst: number, uiMissed: number, spanMs: number): void {
  tell({ kind: 'frames', spanMs: Math.round(spanMs), ui: { frames: uiFrames, worstMs: +uiWorst.toFixed(1), missed: uiMissed }, js: { frames: js.frames, worstMs: +js.worst.toFixed(1), missed: js.missed } });
  js.frames = 0;
  js.worst = 0;
  js.missed = 0;
}

const missedIn = (ms: number): number => Math.max(0, Math.round(ms / FRAME_MS) - 1);

export function Frames(): null {
  const count = useSharedValue(0);
  const worst = useSharedValue(0);
  const missed = useSharedValue(0);
  const since = useSharedValue(-1);
  useFrameCallback((frame) => {
    'worklet';
    const dt = frame.timeSincePreviousFrame;
    if (since.value < 0 || dt === null) {
      since.value = frame.timestamp;
      return;
    }
    count.value += 1;
    if (dt > worst.value) worst.value = dt;
    missed.value += Math.max(0, Math.round(dt / (1000 / 60)) - 1);
    const span = frame.timestamp - since.value;
    if (span >= 1000) {
      scheduleOnRN(reportSecond, count.value, worst.value, missed.value, span);
      count.value = 0;
      worst.value = 0;
      missed.value = 0;
      since.value = frame.timestamp;
    }
  });
  useEffect(() => {
    // The app's launch, as React Native times it (from the process's start to the bundle run), once.
    const timing = (performance as { rnStartupTiming?: Record<string, unknown> }).rnStartupTiming;
    tell({ kind: 'launch', startup: timing ? { ...timing } : null, now: performance.now() });
    let last = performance.now();
    let handle = 0;
    const loop = () => {
      const now = performance.now();
      const dt = now - last;
      last = now;
      js.frames += 1;
      if (dt > js.worst) js.worst = dt;
      js.missed += missedIn(dt);
      handle = requestAnimationFrame(loop);
    };
    handle = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(handle);
  }, []);
  return null;
}

/** The counting figures' steps: the first value set in a frame, and what each frame cost from it to its commit. */
let setAt: number | null = null;
const steps: number[] = [];
let flush: ReturnType<typeof setTimeout> | null = null;

export function countSet(): void {
  setAt ??= performance.now();
}

export function useCounted(shown: number): void {
  useLayoutEffect(() => {
    if (setAt === null) return;
    steps.push(performance.now() - setAt);
    setAt = null;
    if (flush !== null) clearTimeout(flush);
    // Told once the counting is over: a second with no step.
    flush = setTimeout(() => {
      flush = null;
      const sorted = [...steps].sort((a, b) => a - b);
      const total = sorted.reduce((sum, ms) => sum + ms, 0);
      tell({ kind: 'count', steps: sorted.length, totalMs: +total.toFixed(1), meanMs: +(total / sorted.length).toFixed(2), medianMs: +sorted[Math.floor(sorted.length / 2)].toFixed(2), worstMs: +sorted[sorted.length - 1].toFixed(2) });
      steps.length = 0;
    }, 1000);
  }, [shown]);
}
