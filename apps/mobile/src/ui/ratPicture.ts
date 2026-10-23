import { BlendMode, FilterMode, MipmapMode, Skia, type SkImage } from '@shopify/react-native-skia';
import type { RatPiece } from './rat';

/*
 * A rat (or a backdrop) of a grid of choices put together once, at the art's own size, into one picture: its pieces back to front, the body cut by
 * its clip (`dstIn`), and a prize not won yet drawn through `faint` (the web's `opacity-40 grayscale`). Drawn by the grid's canvas as one picture
 * at the choice's place, with the same nearest sampling as each piece was, it is the same picture: every piece is the same 128-px square drawn into
 * the same place, so cutting and fading them before they are scaled or after is the same thing, a pixel at a time. Only the rounding differs (the
 * CPU's here, the GPU's on the canvas): `player-editor-wear` shot again, 19,985 pixels a level apart (a few up to 5 of 255), its score unchanged.
 *
 * Why: the grid drew each choice through layers of its own (one for the cut, one for the fading), forty-odd in one frame on the UI thread, with GPU
 * programs no other canvas of the app uses (compiled the first time they are drawn: a frame of 200 ms on the simulator with the app's shader cache
 * empty, 986 ms measured in Task 14). Put together here, on the JS thread, on a surface of the CPU's, the grid is plain pictures only.
 */

/** What is put together: the pieces of one rat, or one backdrop alone, each with its picture (the grid draws nothing until every one is in). */
export interface Composed {
  pieces: readonly RatPiece[];
  faint: boolean;
}

/**
 * The pictures put together, by what they are made of: shared by every grid that draws the same choice, kept while the app runs, in the order they
 * were last asked for. Outside the sprites' budget: at most `COMPOSED_KEPT` of 64 KiB, 4 MiB.
 */
const made = new Map<string, SkImage>();
/** At most this many are kept: a tab's cut or faint choices (about twenty) for a few looks. Past it, the one asked for longest ago is let go (a grid still drawing it keeps its own reference). */
export const COMPOSED_KEPT = 64;

const keyOf = ({ pieces, faint }: Composed): string => `${pieces.map((piece) => (piece.clip ? `${piece.id}/${piece.clip}` : piece.id)).join('+')}${faint ? '~faint' : ''}`;

/** Tests only: everything put together is forgotten. */
export function forgetComposed(): void {
  made.clear();
}

/**
 * The picture of `what`, put together from `imageOf` (each piece's picture and its clip), or null where one of them is missing or no surface can be
 * had: the grid then draws the pieces as before.
 */
export function composedPicture(what: Composed, imageOf: (id: string) => SkImage | null | undefined, faintMatrix: readonly number[]): SkImage | null {
  const key = keyOf(what);
  const known = made.get(key);
  if (known) {
    // The last asked for: the grid on screen is the last to lose its pictures.
    made.delete(key);
    made.set(key, known);
    return known;
  }
  const parts = what.pieces.map((piece) => ({ image: imageOf(piece.id), clip: piece.clip === null ? null : imageOf(piece.clip), cut: piece.clip !== null }));
  if (parts.length === 0 || parts.some((part) => !part.image || (part.cut && !part.clip))) return null;
  const first = parts[0].image as SkImage;
  const [w, h] = [first.width(), first.height()];
  const surface = Skia.Surface.Make(w, h);
  if (!surface) return null;
  const canvas = surface.getCanvas();
  const whole = Skia.XYWHRect(0, 0, w, h);
  const draw = (image: SkImage, paint?: ReturnType<typeof Skia.Paint>) =>
    canvas.drawImageRectOptions(image, Skia.XYWHRect(0, 0, image.width(), image.height()), whole, FilterMode.Nearest, MipmapMode.None, paint ?? null);
  if (what.faint) {
    const fading = Skia.Paint();
    fading.setColorFilter(Skia.ColorFilter.MakeMatrix([...faintMatrix]));
    canvas.saveLayer(fading);
  }
  for (const part of parts) {
    if (!part.cut) {
      draw(part.image as SkImage);
      continue;
    }
    canvas.saveLayer();
    draw(part.image as SkImage);
    const cutting = Skia.Paint();
    cutting.setBlendMode(BlendMode.DstIn);
    draw(part.clip as SkImage, cutting);
    canvas.restore();
  }
  if (what.faint) canvas.restore();
  surface.flush();
  const picture = surface.makeImageSnapshot();
  surface.dispose?.();
  made.set(key, picture);
  if (made.size > COMPOSED_KEPT) made.delete(made.keys().next().value as string);
  return picture;
}
