import { AlphaType, ColorType, Skia, type SkData, type SkImage, type ImageInfo } from '@shopify/react-native-skia';
import type { ImageSourcePropType } from 'react-native';

/**
 * A sprite of a group packed on one sheet (scripts/sprites.ts: EAS Update takes at most 1000 files an update, and the art alone is more): the
 * sheet's file, and where the sprite lies on it.
 */
export interface SpritePiece {
  sheet: ImageSourcePropType;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** What the phone bundles for a sprite (src/sprites/sources.ts): its own file, or its piece of a sheet. */
export type SpriteSource = ImageSourcePropType | SpritePiece;

export const isPiece = (source: SpriteSource): source is SpritePiece => typeof source === 'object' && source !== null && 'sheet' in source;

/** How long a sheet is kept once its last piece is cut: the next row of a list, the next tab of the rat editor, cut from it without reading it again. */
export const LINGER_MS = 2000;

/** What Skia is asked to make a piece of: its pixels as the sheet's file holds them, not premultiplied. */
interface MakeFrom {
  fromBytes(bytes: Uint8Array): SkData;
  make(info: ImageInfo, data: SkData, bytesPerRow: number): SkImage | null;
}
const SKIA: MakeFrom = {
  fromBytes: (bytes) => Skia.Data.fromBytes(bytes),
  make: (info, data, bytesPerRow) => Skia.Image.MakeImage(info, data, bytesPerRow),
};

/** A piece cut out of its decoded sheet as a picture of its own, pixel for pixel: null where its pixels cannot be read. */
export function cutPiece(sheet: SkImage, { x, y, w, h }: SpritePiece, skia: MakeFrom = SKIA): SkImage | null {
  const info: ImageInfo = { width: w, height: h, colorType: ColorType.RGBA_8888, alphaType: AlphaType.Unpremul };
  const pixels = sheet.readPixels(x, y, info);
  if (!(pixels instanceof Uint8Array)) return null;
  return skia.make(info, skia.fromBytes(pixels), w * 4);
}

interface Open {
  image: Promise<SkImage | null>;
  /** The pieces being cut from it right now. */
  cutting: number;
  /** When it is let go, once nothing is cut from it. */
  timer: ReturnType<typeof setTimeout> | null;
}

/**
 * Reads pieces of sheets: a sheet read and decoded once for every piece asked of it while it is open, each piece cut out as a picture of its own (the
 * shared cache keeps and lets go of pieces as of any sprite: ui/spriteImages.ts), the sheet let go LINGER_MS after the last. A sheet that does not
 * decode gives no piece; one whose read is refused fails each piece, and is tried again the next time.
 */
export function sheetReader(read: (file: ImageSourcePropType) => Promise<SkImage | null>, cut: (sheet: SkImage, piece: SpritePiece) => SkImage | null = cutPiece) {
  const open = new Map<ImageSourcePropType, Open>();
  const letGo = (file: ImageSourcePropType, held: Open) => {
    if (open.get(file) === held) open.delete(file);
    void held.image.then((image) => image?.dispose(), () => {});
  };
  return async (piece: SpritePiece): Promise<SkImage | null> => {
    let held = open.get(piece.sheet);
    if (!held) {
      held = { image: read(piece.sheet), cutting: 0, timer: null };
      open.set(piece.sheet, held);
    }
    const mine = held;
    if (mine.timer) clearTimeout(mine.timer);
    mine.timer = null;
    mine.cutting++;
    try {
      const image = await mine.image;
      return image ? cut(image, piece) : null;
    } catch (error) {
      if (open.get(piece.sheet) === mine) open.delete(piece.sheet);
      throw error;
    } finally {
      mine.cutting--;
      if (mine.cutting === 0 && open.get(piece.sheet) === mine) mine.timer = setTimeout(() => letGo(piece.sheet, mine), LINGER_MS);
    }
  };
}
