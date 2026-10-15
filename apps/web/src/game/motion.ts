'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { useSettings } from '@/game/context';

const QUERY = '(prefers-reduced-motion: reduce)';
const media = () => (typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(QUERY) : null);

function subscribe(notify: () => void): () => void {
  const query = media();
  query?.addEventListener('change', notify);
  return () => query?.removeEventListener('change', notify);
}

/**
 * True where motion is to be left out: asked for in the game's settings, or in the system's. What
 * only moves is then not drawn at all, and what counts shows where it ends at once.
 */
export function useStill(): boolean {
  const { reducedMotion } = useSettings();
  const system = useSyncExternalStore(subscribe, () => media()?.matches ?? false, () => false);
  return reducedMotion || system;
}

/**
 * A figure that runs from one value to another, once, fast at first and slowing to the last: a
 * score read out, cash coming in. It waits `delay` before it starts, and stands at its end at once
 * where motion is left out.
 */
export function useCountUp(target: number, { from = 0, ms = 900, delay = 0 }: { from?: number; ms?: number; delay?: number } = {}): number {
  const still = useStill();
  const [shown, setShown] = useState(still ? target : from);
  useEffect(() => {
    if (still) {
      setShown(target);
      return;
    }
    let frame = 0;
    setShown(from);
    const timer = setTimeout(() => {
      const start = performance.now();
      const step = (now: number) => {
        const done = Math.min(1, (now - start) / ms);
        setShown(Math.round(from + (target - from) * (1 - (1 - done) ** 3)));
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
