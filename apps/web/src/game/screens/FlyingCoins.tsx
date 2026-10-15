'use client';

import { useEffect, useState } from 'react';
import type { CSSProperties, RefObject } from 'react';
import { useSound } from '@/game/context';
import { useStill } from '@/game/motion';
import { Loop } from './Loop';

/** Coins flown from each line, and in all: a handful says "money came in" without burying the screen. */
const PER_SOURCE = 3;
const MAX_COINS = 12;
const STAGGER_MS = 90;
const FLIGHT_MS = 700;

interface Coin {
  x: number;
  y: number;
  dx: number;
  dy: number;
  delay: number;
}

/**
 * Coins that fly, once, from every element marked `data-coin-from` inside `area` to the one marked
 * `data-coin-to`, after `startMs`: money that came in on its own going where it is kept. The places
 * are read from the page when the flight begins, so they are where the lines have settled.
 * Decoration only; nothing at all where motion is left out.
 */
export function FlyingCoins({ area, startMs }: { area: RefObject<HTMLElement | null>; startMs: number }) {
  const still = useStill();
  const sound = useSound();
  const [coins, setCoins] = useState<Coin[]>([]);
  useEffect(() => {
    if (still) return;
    const take = setTimeout(() => {
      const box = area.current;
      const target = box?.querySelector('[data-coin-to]');
      if (!box || !target) return;
      const origin = box.getBoundingClientRect();
      const to = target.getBoundingClientRect();
      const tx = to.left + to.width / 2 - origin.left;
      const ty = to.top + to.height / 2 - origin.top;
      const flown: Coin[] = [];
      for (const source of box.querySelectorAll('[data-coin-from]')) {
        const from = source.getBoundingClientRect();
        const x = from.left + from.width / 2 - origin.left;
        const y = from.top + from.height / 2 - origin.top;
        for (let i = 0; i < PER_SOURCE && flown.length < MAX_COINS; i++) flown.push({ x, y, dx: tx - x, dy: ty - y, delay: flown.length * STAGGER_MS });
      }
      if (flown.length === 0) return;
      setCoins(flown);
      sound('coin');
    }, startMs);
    // Gone once the last has landed, so nothing is left in the page.
    const clear = setTimeout(() => setCoins([]), startMs + MAX_COINS * STAGGER_MS + FLIGHT_MS + 200);
    return () => {
      clearTimeout(take);
      clearTimeout(clear);
    };
    // Once for the round on screen: the area and the start do not change while it is shown.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [still]);

  if (coins.length === 0) return null;
  return (
    <div aria-hidden data-motion-only className="pointer-events-none absolute inset-0 z-10 overflow-visible">
      {coins.map((coin, i) => (
        <span
          key={i}
          className="absolute -ml-3 -mt-3 animate-fly"
          style={{ left: coin.x, top: coin.y, animationDelay: `${coin.delay}ms`, '--dx': `${coin.dx}px`, '--dy': `${coin.dy}px` } as CSSProperties}
        >
          <span className="inline-flex size-6">
            <Loop name="coin" ms={90} className="!h-full !w-full" />
          </span>
        </span>
      ))}
    </div>
  );
}
