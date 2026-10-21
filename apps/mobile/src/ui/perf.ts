import type { ComponentType } from 'react';

/*
 * The timing probe's switch. A build made with `EXPO_PUBLIC_PERF=1` carries the probe (ui/perfProbe.tsx: the times of what the player waits for, and the
 * frames, told to `scripts/perf.ts` on this machine); any other build has none of it. Expo writes `process.env.EXPO_PUBLIC_*` into the bundle as its
 * value when it is built for release (`undefined` when it is not set), and Metro then folds the conditions below: in a build without the flag
 * `PERF` is `false`, the `require` of the probe is cut out before the bundle's files are gathered, and every name here is the no-op beside it.
 * `perf.test.ts` holds both: the transform of this file without the flag names no probe, with it it does.
 */

/** Whether this build carries the timing probe: only one built with `EXPO_PUBLIC_PERF=1`. */
export const PERF = process.env.EXPO_PUBLIC_PERF === '1';

type Probe = typeof import('./perfProbe');

const nothing = (): void => undefined;
const none = (): null => null;

// Cut out of a build without the flag: the condition is the flag itself, written into it, so Metro folds it to `null` before the bundle's files are
// gathered (a condition on `PERF`, an export, would not be folded once the file is a CommonJS module).
const probe: Probe | null = process.env.EXPO_PUBLIC_PERF === '1' ? (require('./perfProbe') as Probe) : null;

/** A touch let go anywhere on the screen or a sheet (`onTouchEnd`): what the player waits from. */
export const perfTouched: (() => void) | undefined = probe ? probe.touched : undefined;
/** A touch begun (`onTouchStart`): told, to place the frames of a drag. */
export const perfTouchStarted: (() => void) | undefined = probe ? probe.touchStarted : undefined;
/** Something started by the phone, not by a touch (a swipe let go, told from the UI thread): what the player waits from. */
export const perfStart: (what: string) => void = probe ? probe.start : nothing;
/** Drawn on the screen once mounted, and again each time `name` changes: told when it is on screen (its commit, and a frame of the UI thread after it). */
export const PerfDrawn: ComponentType<{ name: string }> = probe ? probe.Drawn : none;
/** Put once round the whole app: the frames of the UI and JS threads, and the app's launch, told to the collector. */
export const PerfFrames: ComponentType = probe ? probe.Frames : none;
/** A step of a counting figure (`useCountUp`): when its value was set, and its cost on the JS thread once it is drawn. */
export const perfCountSet: () => void = probe ? probe.countSet : nothing;
export const usePerfCounted: (shown: number) => void = probe ? probe.useCounted : nothing;
/** The device's store, its calls timed (the probe's build only; any other gives the store itself). */
export const perfStore: <T extends object>(store: T) => T = probe ? probe.timedStore : (store) => store;
