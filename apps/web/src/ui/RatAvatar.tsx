'use client';

import { ratSprite } from '@ratrace/core/game/avatar';
import type { RatColour, RatLayer, RatLook } from '@ratrace/core/game/avatar';
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
  const order: Array<[RatLayer, string | null]> = [['backdrop', look.backdrop], ['body', look.body], ['face', look.face], ['outfit', look.outfit], ['eyes', look.eyes], ['hat', look.hat]];
  return order.flatMap(([layer, piece]) => (piece !== null && spriteOf(ratSprite(layer, piece)) ? [ratSprite(layer, piece)] : []));
}

/**
 * A player's rat, its layers one over another, all at one size. Under clothes, the body is cut to
 * what they let show of it, so no fur shows down its back past them. `className` sizes and places the
 * stack; the box around it crops it.
 */
export function RatLayers({ look, className = '' }: { look: RatLook; className?: string }) {
  const clip = look.outfit === null ? null : spriteOf(`rat.clip.${look.outfit}`);
  const body = ratSprite('body', look.body);
  return (
    <span aria-hidden className={`relative block ${className}`}>
      {piecesOf(look).map((id) => {
        const drawn = <Sprite key={id} id={id} fallback={{ w: 128, h: 128 }} className="absolute inset-0 !h-full !w-full" />;
        if (id !== body || clip === null) return drawn;
        const mask = `url("/sprites/${clip.src}")`;
        return (
          <span key={id} className="absolute inset-0" style={{ maskImage: mask, WebkitMaskImage: mask, maskSize: '100% 100%', WebkitMaskSize: '100% 100%', maskRepeat: 'no-repeat', WebkitMaskRepeat: 'no-repeat' }}>
            {drawn}
          </span>
        );
      })}
    </span>
  );
}

/**
 * A player's rat in a box: at the size of a line of a list (`sm`), a heading (`md`) or the profile (`lg`).
 */
export function RatAvatar({ look, size = 'sm', className = '' }: { look: RatLook; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const box = size === 'lg' ? 'size-24' : size === 'md' ? 'size-11' : 'size-8';
  // The whole rat at every size, its box filled to the border: a hat, the nose and the backdrop all show.
  const stack = 'size-full shrink-0';
  return (
    <span aria-hidden className={`inline-flex shrink-0 overflow-hidden border-2 border-night-900 ${GROUND[look.colour]} ${box} ${className}`}>
      <RatLayers look={look} className={stack} />
    </span>
  );
}
