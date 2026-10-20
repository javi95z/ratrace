import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { AccessibilityInfo } from 'react-native';
import {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { KEYFRAMES, countUpValue, frameFor, type KeyframeName } from './motion';

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

/**
 * Plays `name` as the web's CSS animation does: progress 0 to 1 over its duration, read through
 * `steps()` by `frameFor`. Under reduced motion it is at its end at once (a looping one stands in its
 * first frame). Returns an animated style to put on an `Animated.View`.
 */
export function useKeyframes(name: KeyframeName, { play = true, reduced }: { play?: boolean; reduced?: boolean } = {}) {
  const still = useReducedMotion(reduced);
  const { ms, loop } = KEYFRAMES[name];
  // -1: not started. 0 to 1: running. Looped ones never pass 1.
  const progress = useSharedValue(play && still ? (loop ? 0 : 1) : -1);
  useEffect(() => {
    cancelAnimation(progress);
    if (!play) {
      progress.value = -1;
    } else if (still) {
      progress.value = loop ? 0 : 1;
    } else {
      progress.value = 0;
      const run = withTiming(1, { duration: ms, easing: Easing.linear });
      progress.value = loop ? withRepeat(run, -1, false) : run;
    }
    return () => cancelAnimation(progress);
  }, [play, still, loop, ms, progress]);
  return useAnimatedStyle(() => {
    const p = progress.value;
    const f = frameFor(name, p < 0 ? 'before' : !loop && p >= 1 ? 'after' : 'running', p);
    return { opacity: f.opacity, transform: [{ translateY: f.translateY }, { scale: f.scale }] };
  });
}

/** Sheet, Toast: comes up 8 px while it fades in. */
export const useRise = (opts?: { play?: boolean }) => useKeyframes('rise', opts);
/** Loading text: on for half a second, off for half. */
export const useBlink = (opts?: { play?: boolean }) => useKeyframes('blink', opts);
/** A brand mark bought: it jumps and lands. */
export const usePop = (opts?: { play?: boolean }) => useKeyframes('pop', opts);
/** A brand mark sold: it shrinks and comes back. */
export const useSink = (opts?: { play?: boolean }) => useKeyframes('sink', opts);

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
  return shown;
}
