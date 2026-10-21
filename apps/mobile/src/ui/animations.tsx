import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { AccessibilityInfo } from 'react-native';
import {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import type { ViewStyle } from 'react-native';
import { KEYFRAMES, countUpValue, frameFor, styleOf, type Frame, type KeyframeName } from './motion';
import { perfCountSet, usePerfCounted } from './perf';

/** The game's own "reduce motion" setting, handed down once; the OS asks for it on its own. */
const GameReducedMotion = createContext(false);

export function ReducedMotionProvider({ value, children }: { value: boolean; children: ReactNode }) {
  return <GameReducedMotion.Provider value={value}>{children}</GameReducedMotion.Provider>;
}

/**
 * The OS's "reduce motion", kept at module level: read once when the module loads and held current
 * by the change event, so a first render already knows it and nothing plays a frame before it stops.
 */
let osReduced = false;
let watching = false;
const watchers = new Set<() => void>();

function setOsReduced(on: boolean) {
  if (on === osReduced) return;
  osReduced = on;
  watchers.forEach((notify) => notify());
}

/** Reads the OS setting (again) and, the first time, starts following its changes. */
export function refreshSystemMotion(): void {
  if (!watching) {
    watching = true;
    AccessibilityInfo.addEventListener?.('reduceMotionChanged', setOsReduced);
  }
  try {
    AccessibilityInfo.isReduceMotionEnabled?.()?.then(setOsReduced, () => {});
  } catch {
    // an OS that cannot say leaves motion on
  }
}
refreshSystemMotion();

function subscribeOs(notify: () => void): () => void {
  watchers.add(notify);
  return () => void watchers.delete(notify);
}

/**
 * True where motion is to be left out: the OS asks for it, the game's setting says so (the
 * `setting` given, else the one the `ReducedMotionProvider` holds). What only moves is then not
 * drawn, and what counts shows where it ends at once.
 */
export function useReducedMotion(setting?: boolean): boolean {
  const fromGame = useContext(GameReducedMotion);
  const system = useSyncExternalStore(subscribeOs, () => osReduced, () => false);
  return system || (setting ?? fromGame);
}

/** What an effect can be told, beyond which one it is. */
export interface KeyframeOptions {
  /** False holds it on the frame it shows before it starts; true (the default) plays it. */
  play?: boolean;
  /** The game's own "reduce motion", where the caller knows it better than the provider does. */
  reduced?: boolean;
  /** The web's `animation-delay`: the time before it begins, in milliseconds. */
  delayMs?: number;
  /** The web's `animation-iteration-count: 1` on an effect that loops: it plays through once and stops. */
  once?: boolean;
  /** How far a coin or a spark goes (`--dx`, `--dy`; a spark's `--sx`, `--sy`), in points. */
  dx?: number;
  dy?: number;
  /** What the box looks like outside the run, where that is not an element left alone (the web's `opacity-0`). */
  rest?: Partial<Frame>;
  /**
   * Plays it again from its first frame whenever this changes, on the same box (the web remounts the element, `key`, which would draw what is
   * inside it anew: a mark's picture, its canvas): a holding's mark answering each new order.
   */
  replay?: number;
}

/**
 * Plays `name` as the web's CSS animation does: progress 0 to 1 over its duration, read through
 * `steps()` by `frameFor`. Under reduced motion it is at its end at once (a looping one stands in its
 * first frame). `useFrame` is the frame it is at, as a shared value; `useKeyframes` is that as an animated style to
 * put on an `Animated.View`.
 *
 * A delay runs on the same clock: progress starts below zero, which is "not started", and reaches 0 when the
 * delay is out, so that one linear run of `delay + duration` is all the animation there is. A loop with a delay
 * (the web waits once, then repeats without waiting) holds off, then starts its repeats from the first frame.
 */
function useFrame(name: KeyframeName, { play = true, reduced, delayMs = 0, once = false, dx = 0, dy = 0, rest, replay = 0 }: KeyframeOptions = {}) {
  const still = useReducedMotion(reduced);
  const { ms, loop: loops } = KEYFRAMES[name];
  const loop = loops && !once;
  const lead = still ? 0 : Math.max(0, delayMs);
  // -1: not started. Between -1 and 0: waiting out a delay. 0 to 1: running. Looped ones never pass 1.
  const progress = useSharedValue(play && still ? (loop ? 0 : 1) : -1);
  useEffect(() => {
    cancelAnimation(progress);
    if (!play) {
      progress.value = -1;
    } else if (still) {
      progress.value = loop ? 0 : 1;
    } else {
      const run = withTiming(1, { duration: ms, easing: Easing.linear });
      if (lead === 0) {
        progress.value = 0;
        progress.value = loop ? withRepeat(run, -1, false) : run;
      } else if (loop) {
        progress.value = -1;
        progress.value = withDelay(lead, withSequence(withTiming(0, { duration: 0 }), withRepeat(run, -1, false)));
      } else {
        progress.value = -lead / ms;
        progress.value = withTiming(1, { duration: lead + ms, easing: Easing.linear });
      }
    }
    return () => cancelAnimation(progress);
  }, [play, still, loop, ms, lead, progress, replay]);
  return useDerivedValue(() => {
    const p = progress.value;
    return frameFor(name, p < 0 ? 'before' : !loop && p >= 1 ? 'after' : 'running', p, { dx, dy }, rest);
  });
}

/** `useFrame` as a style, to put on an `Animated.View`. */
export function useKeyframes(name: KeyframeName, opts: KeyframeOptions = {}) {
  const frame = useFrame(name, opts);
  return useAnimatedStyle(() => styleOf(name, frame.value) as ViewStyle);
}

/** Sheet, Toast: comes up 8 px while it fades in. */
export const useRise = (opts?: KeyframeOptions) => useKeyframes('rise', opts);
/** Loading text: on for half a second, off for half. */
export const useBlink = (opts?: KeyframeOptions) => useKeyframes('blink', opts);
/** A brand mark bought: it jumps and lands. */
export const usePop = (opts?: KeyframeOptions) => useKeyframes('pop', opts);
/** A brand mark sold: it shrinks and comes back. */
export const useSink = (opts?: KeyframeOptions) => useKeyframes('sink', opts);
/** The news of a round: a newspaper thrown spinning onto the table, settling flat. */
export const usePaper = (opts?: KeyframeOptions) => useKeyframes('paper', opts);
/** A legendary card turning over into view. */
export const useLegend = (opts?: KeyframeOptions) => useKeyframes('legend', opts);
/**
 * The rainbow of a legendary card, sliding across it for as long as it is on screen. It is no style (nothing of a view
 * moves, a gradient does), so this is how far it has slid, in percent of the card's width, 0 to 200, as a shared
 * value; `Holo` draws it.
 */
export function useHolo(opts: KeyframeOptions = {}) {
  const frame = useFrame('holo', opts);
  return useDerivedValue(() => frame.value.bgX);
}
/** A band of light that crosses a rare card now and then. */
export const useGlint = (opts?: KeyframeOptions) => useKeyframes('glint', opts);
/** A badge won: it spins in from nothing and settles. */
export const useMedal = (opts?: KeyframeOptions) => useKeyframes('medal', opts);
/** A coin flown from where money came in to the cash it lands in, in an arc: `dx` and `dy` are how far. */
export const useFly = (opts?: KeyframeOptions) => useKeyframes('fly', opts);
/** One piece of confetti: it falls the height of the sheet once, turning, and is gone. */
export const useFall = (opts?: KeyframeOptions) => useKeyframes('fall', opts);
/** A picture uncovered from the left in eight steps (a style for the box that clips it: its width is the part shown). */
export const useReveal = (opts?: KeyframeOptions) => useKeyframes('reveal', opts);
/** A lamp that pulses: something is wrong and still going on. */
export const useAlarm = (opts?: KeyframeOptions) => useKeyframes('alarm', opts);
/** The page of the calendar torn off as a round turns (it turns about its top left corner). */
export const useTear = (opts?: KeyframeOptions) => useKeyframes('tear', opts);
/** The new page of the calendar, shown and then put away. */
export const usePageTurn = (opts?: KeyframeOptions) => useKeyframes('page', opts);
/** A mark on the line of a life, lit as the rat goes by. */
export const useLight = (opts?: KeyframeOptions) => useKeyframes('light', opts);
/** A spark thrown out from a centre, and gone: `dx` and `dy` are where it goes. */
export const useSpark = (opts?: KeyframeOptions) => useKeyframes('spark', opts);

/**
 * A figure that runs from one value to another, once, fast at first and slowing to the last (ease-out
 * cubic, not stepped): a score read out, cash coming in. It waits `delay` before it starts, and
 * stands at its end at once where motion is left out.
 */
export function useCountUp(target: number, { from = 0, ms = 900, delay = 0 }: { from?: number; ms?: number; delay?: number } = {}): number {
  const still = useReducedMotion();
  const [shown, setShown] = useState(still ? target : from);
  useEffect(() => {
    if (still) {
      setShown(target);
      return;
    }
    let frame = 0;
    setShown(from);
    const timer = setTimeout(() => {
      const start = Date.now();
      const step = () => {
        const done = Math.min(1, (Date.now() - start) / ms);
        perfCountSet();
        setShown(countUpValue(from, target, done));
        if (done < 1) frame = requestAnimationFrame(step);
      };
      frame = requestAnimationFrame(step);
    }, delay);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(frame);
    };
  }, [target, from, ms, delay, still]);
  // The timing probe's measure of a step's cost on the JS thread (EXPO_PUBLIC_PERF=1 builds only; a no-op in any other).
  usePerfCounted(shown);
  return shown;
}
