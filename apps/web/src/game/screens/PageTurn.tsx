'use client';

import { useEffect } from 'react';
import { useT } from '@/game/context';

/** How long the calendar stays on screen: the old page torn away, the new one read, and all gone. */
export const PAGE_TURN_MS = 1500;

/** A page of a wall calendar, drawn in the game's pixels: a red band with its two rings, and an age. */
function Page({ age, className = '' }: { age: number; className?: string }) {
  const t = useT('play');
  return (
    <div className={`frame absolute inset-0 flex flex-col bg-cream text-ink-900 ${className}`}>
      <div className="relative h-6 shrink-0 bg-wine-500">
        <span className="absolute -top-1.5 left-6 h-3.5 w-2 bg-ink-900" />
        <span className="absolute -top-1.5 right-6 h-3.5 w-2 bg-ink-900" />
      </div>
      <div className="flex flex-1 flex-col items-center justify-center">
        <span className="pixel text-[52px] leading-none">{age}</span>
        <span className="pixel text-[14px] uppercase tracking-widest text-ink-700">{t('turnYears', { age })}</span>
      </div>
    </div>
  );
}

/**
 * Two years go by between rounds: the page of the old age is torn off the calendar and falls, and
 * the new one is there beneath it, then all of it goes. Decoration only, over the page and out of
 * the way of every tap; the stage heading already says where the player is. It is never drawn
 * where motion is left out.
 */
export function PageTurn({ from, to, onDone }: { from: number; to: number; onDone(): void }) {
  useEffect(() => {
    const timer = setTimeout(onDone, PAGE_TURN_MS);
    return () => clearTimeout(timer);
    // The calendar of one turn of the page: a later one is drawn by a new calendar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div aria-hidden data-motion-only className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center">
      <div className="relative h-44 w-36 animate-page">
        <Page age={to} />
        <Page age={from} className="origin-top-left animate-tear" />
      </div>
    </div>
  );
}
