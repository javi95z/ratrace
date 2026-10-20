import { ratSprite } from '@ratrace/core/game/avatar';
import type { RatColour, RatLayer, RatLook } from '@ratrace/core/game/avatar';
import { spriteOf } from './sprites';
import type { ColorToken } from './theme';

/** Each colour as the ground the rat stands on (the web's RatAvatar.tsx GROUND). */
export const RAT_GROUND: Record<RatColour, ColorToken> = {
  gold: 'gold-500',
  teal: 'teal-300',
  wine: 'wine-300',
  sky: 'sky-300',
  coral: 'skin-500',
  emerald: 'teal-600',
  cream: 'cream',
  slate: 'ink-300',
};

/** The avatar's box at each size (the web's size-8 / size-11 / size-24) and its border-2, inside the box. */
export const AVATAR_BOX = { sm: 32, md: 44, lg: 96, border: 2 } as const;

/** Back to front. */
export const RAT_ORDER: readonly RatLayer[] = ['backdrop', 'body', 'face', 'outfit', 'eyes', 'hat'];

export interface RatPiece {
  layer: RatLayer;
  id: string;
  /** The sprite that cuts this piece to what the outfit lets show of it: the body's, under an outfit. */
  clip: string | null;
}

const hasArt = (id: string) => spriteOf(id) !== null;

/** The pieces of a look, back to front, that have art: one not drawn yet is left off, never shown as a hole. */
export function piecesOf(look: RatLook, has: (id: string) => boolean = hasArt): RatPiece[] {
  const clip = look.outfit === null ? null : `rat.clip.${look.outfit}`;
  return RAT_ORDER.flatMap((layer) => {
    const piece = look[layer];
    if (piece === null) return [];
    const id = ratSprite(layer, piece);
    if (!has(id)) return [];
    return [{ layer, id, clip: layer === 'body' && clip !== null && has(clip) ? clip : null }];
  });
}
