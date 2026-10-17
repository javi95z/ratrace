'use client';

import type { RatColour } from '@/game/avatar';
import { Sprite } from './Sprite';

/** Each colour as the ground the rat stands on: bright enough to tell players apart, dark enough for the rat to read on it. */
const GROUND: Record<RatColour, string> = {
  gold: 'bg-gold-500',
  teal: 'bg-teal-300',
  wine: 'bg-wine-300',
  sky: 'bg-sky-300',
  coral: 'bg-skin-500',
  emerald: 'bg-teal-600',
  cream: 'bg-cream',
  slate: 'bg-ink-300',
};

/**
 * A player's rat: the mascot's face on the player's colour, cut out at a size the pixels divide into
 * evenly. `sm` for a line of a list, `md` for a heading, `lg` for the profile.
 */
export function RatAvatar({ colour, size = 'sm', className = '' }: { colour: RatColour; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const box = size === 'lg' ? 'size-24' : size === 'md' ? 'size-11' : 'size-8';
  const face = size === 'lg' ? '!h-[128px] !w-[128px] -ml-4 -mt-1' : size === 'md' ? '!h-16 !w-16 -ml-2.5 -mt-1' : '!h-16 !w-16 -ml-4 -mt-2';
  return (
    <span aria-hidden className={`inline-flex shrink-0 overflow-hidden border-2 border-night-900 ${GROUND[colour]} ${box} ${className}`}>
      <Sprite id="brand.mascot" fallback={{ w: 256, h: 256 }} className={`max-w-none ${face}`} />
    </span>
  );
}
