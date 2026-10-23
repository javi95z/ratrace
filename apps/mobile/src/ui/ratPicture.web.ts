import type { RatPiece } from './rat';
import type { SpritePicture } from './spriteImages.web';

/*
 * The web export's twin of `ratPicture.ts` (Metro picks it for the web). The phone puts a grid's cut or faded rats together into one picture to spare
 * its GPU a layer each. The web has no such cost: the browser cuts a body by its clip with a CSS mask and fades a choice with `opacity` and `grayscale`,
 * so a rat is never composed here and the grid draws its layers (RatAvatar.web.tsx).
 */

/** What would be put together: the pieces of one rat, or one backdrop alone. */
export interface Composed {
  pieces: readonly RatPiece[];
  faint: boolean;
}

/** How many are kept: none on the web. */
export const COMPOSED_KEPT = 0;

/** Tests only: nothing is put together on the web, so nothing is forgotten. */
export function forgetComposed(): void {}

/** Nothing is put together on the web: always null, and the grid draws the pieces one over another. */
export const composedPicture: (what: Composed, imageOf: (id: string) => SpritePicture | null | undefined, faintMatrix: readonly number[]) => null = () => null;
