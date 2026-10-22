import { useEffect, useLayoutEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
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
 *   then a hop to the UI thread queued after the commit's mounting, one frame there (`requestAnimationFrame` of the UI runtime), and back: the
 *   time from the touch to that (`drawnMs`) has the mounting of the native views and one frame in it. Then `settledMs`: until the UI thread draws
 *   two frames in a row at its pace again (the pictures drawn into their canvases, whatever the mounting set going), and its longest frame between.
 * - **Frames**: every frame of the UI thread (Reanimated's frame callback, on the display link) and of the JS thread (`requestAnimationFrame`),
 *   summed a second at a time: how many, the longest, and how many were missed at 60 a second; and each slow frame of the UI thread as it
 *   comes, with the touches' starts and ends, so a frame missed during a drag is told from one missed as its answer is drawn.
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
  tell({ kind: 'touch', phase: 'end' });
}

export function touchStarted(): void {
  tell({ kind: 'touch', phase: 'start' });
}

/** A frame of the UI thread that took longer than a smooth one, told as it is heard (the wall clock places it among the touches). */
function slowFrame(ms: number): void {
  tell({ kind: 'slow', ms: +ms.toFixed(1) });
}

export function start(what: string): void {
  from = { at: performance.now(), what };
}

/** A frame of the UI thread that came this soon after the one before is one of a thread that is drawing at its pace again. */
const SMOOTH_MS = 25;

/**
 * After the UI thread has drawn a frame past everything queued to it so far (the mounting of the last commit), `drawn` is called on the JS thread;
 * then, once the UI thread draws two frames in a row again at its pace (what it does after the mounting, the pictures drawn into their canvases,
 * is over), `settled`, with how long the longest frame in between took.
 */
function afterFrames(drawn: () => void, settled: (longest: number) => void): void {
  scheduleOnUI(() => {
    'worklet';
    let last = -1;
    let longest = 0;
    const next = (at: number) => {
      if (last < 0) scheduleOnRN(drawn);
      else {
        const took = at - last;
        if (took <= SMOOTH_MS) {
          scheduleOnRN(settled, longest);
          return;
        }
        longest = Math.max(longest, took);
      }
      last = at;
      requestAnimationFrame(next);
    };
    requestAnimationFrame(next);
  });
}

export function Drawn({ name }: { name: string }): null {
  useLayoutEffect(() => {
    const since = from;
    const committed = performance.now();
    let drawnAt = 0;
    afterFrames(
      () => {
        drawnAt = performance.now();
      },
      (longest) => {
        const settledAt = performance.now();
        const ms = (at: number) => (since ? +(at - since.at).toFixed(1) : null);
        tell({ kind: 'drawn', name, what: since?.what ?? null, commitMs: ms(committed), drawnMs: ms(drawnAt), settledMs: ms(settledAt), longestFrameMs: +longest.toFixed(1) });
      },
    );
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
    if (dt > SMOOTH_MS) scheduleOnRN(slowFrame, dt);
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
    let handle: number | null = null;
    const loop = () => {
      const now = performance.now();
      const dt = now - last;
      last = now;
      js.frames += 1;
      if (dt > js.worst) js.worst = dt;
      js.missed += missedIn(dt);
      handle = requestAnimationFrame(loop);
    };
    // Only while the app is in front: in the background React Native's frames come as fast as the thread can run them, a core kept busy for
    // nothing (seen: 98 000 "frames" a second from the probe's build behind Expo Go).
    const run = (state: AppStateStatus) => {
      if (state === 'active' && handle === null) {
        last = performance.now();
        handle = requestAnimationFrame(loop);
      } else if (state !== 'active' && handle !== null) {
        cancelAnimationFrame(handle);
        handle = null;
      }
    };
    run((AppState.currentState as AppStateStatus | null) ?? 'active');
    const watch = AppState.addEventListener('change', run);
    return () => {
      watch.remove();
      if (handle !== null) cancelAnimationFrame(handle);
    };
  }, []);
  return null;
}

/** When each sheet was told to close, by its title, until its Modal says it has dismissed. */
const closing = new Map<string, number>();

export function sheet(phase: 'closing' | 'gone', name: string): void {
  if (phase === 'closing') {
    closing.set(name, performance.now());
    return;
  }
  const since = closing.get(name);
  if (since === undefined) return;
  closing.delete(name);
  tell({ kind: 'dismiss', name, ms: +(performance.now() - since).toFixed(1) });
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

/**
 * A store, each of its calls timed and told under `layer`'s name: the device's (`device`: what a step of the game waits for on the phone's storage), and
 * the one the game asks (`saved`: the device's with what the resilient store does over it, its copies).
 */
export function timedStore<T extends object>(store: T, layer: string): T {
  return new Proxy(store, {
    get(target, key, receiver) {
      const value = Reflect.get(target, key, receiver) as unknown;
      if (typeof value !== 'function') return value;
      return (...args: unknown[]) => {
        const began = performance.now();
        const done = (value as (...a: unknown[]) => unknown).apply(target, args);
        if (done instanceof Promise) void done.then(() => tell({ kind: 'store', layer, op: String(key), ms: +(performance.now() - began).toFixed(1) }), () => undefined);
        return done;
      };
    },
  });
}
