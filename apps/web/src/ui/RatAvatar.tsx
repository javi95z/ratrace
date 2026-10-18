'use client';

import { ratSprite } from '@/game/avatar';
import type { RatColour, RatLayer, RatLook } from '@/game/avatar';
import { Sprite, spriteOf } from './Sprite';

/** Each colour as the ground the rat stands on: bright enough to tell players apart, dark enough for the rat to read on it. */
export const GROUND: Record<RatColour, string> = {
  gold: 'bg-gold-500',
  teal: 'bg-teal-300',
  wine: 'bg-wine-300',
  sky: 'bg-sky-300',
  coral: 'bg-skin-500',
  emerald: 'bg-teal-600',
  cream: 'bg-cream',
  slate: 'bg-ink-300',
};

/** The pieces of a look, back to front, that have art: one not drawn yet is left off, never shown as a hole. */
function piecesOf(look: RatLook): string[] {
  const order: Array<[RatLayer, string | null]> = [['backdrop', look.backdrop], ['body', look.body], ['outfit', look.outfit], ['eyes', look.eyes], ['hat', look.hat]];
  return order.flatMap(([layer, piece]) => (piece !== null && spriteOf(ratSprite(layer, piece)) ? [ratSprite(layer, piece)] : []));
}

/**
 * A player's rat, its layers one over another on its ground, all at one size. `className` sizes and
 * places the stack; the box around it crops it.
 */
export function RatLayers({ look, className = '' }: { look: RatLook; className?: string }) {
  return (
    <span aria-hidden className={`relative block ${className}`}>
      {piecesOf(look).map((id) => (
        <Sprite key={id} id={id} fallback={{ w: 128, h: 128 }} className="absolute inset-0 !h-full !w-full" />
      ))}
    </span>
  );
}

/**
 * A player's rat cut to a box: the head and shoulders at the sizes of a list (`sm`) or a heading
 * (`md`), the whole bust on the profile (`lg`).
 */
export function RatAvatar({ look, size = 'sm', className = '' }: { look: RatLook; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const box = size === 'lg' ? 'size-24' : size === 'md' ? 'size-11' : 'size-8';
  // Small, the whole head shows: a little larger than the box, only the shoulders cut off below.
  const stack = size === 'lg' ? 'size-full shrink-0' : size === 'md' ? 'size-12 shrink-0 -ml-0.5' : 'size-9 shrink-0 -ml-0.5';
  return (
    <span aria-hidden className={`inline-flex shrink-0 overflow-hidden border-2 border-night-900 ${GROUND[look.colour]} ${box} ${className}`}>
      <RatLayers look={look} className={stack} />
    </span>
  );
}
