import { blank, paint } from './image';
import type { Image, Rgb } from './image';

/** Clear margin around every sprite on a contact sheet, in sprite pixels. */
const MARGIN = 1;

/**
 * Lays sprites out in a grid for review, each enlarged by a whole factor so pixels stay sharp.
 * The grid is repeated once per background, so both dark and light sprites can be judged.
 * All sprites must be the same size.
 */
export function composeContact(
  sprites: Image[],
  options: { columns: number; scale: number; backgrounds: Rgb[] },
): Image {
  const { columns, scale, backgrounds } = options;
  const cellW = (sprites[0].width + 2 * MARGIN) * scale;
  const cellH = (sprites[0].height + 2 * MARGIN) * scale;
  const rows = Math.ceil(sprites.length / columns);
  const blockH = rows * cellH;
  const sheet = blank(columns * cellW, blockH * backgrounds.length);

  backgrounds.forEach((background, b) => {
    paint(sheet, { x0: 0, y0: b * blockH, x1: sheet.width, y1: (b + 1) * blockH }, [...background, 255]);
    sprites.forEach((sprite, i) => {
      const left = (i % columns) * cellW + MARGIN * scale;
      const top = b * blockH + Math.floor(i / columns) * cellH + MARGIN * scale;
      for (let y = 0; y < sprite.height; y++) {
        for (let x = 0; x < sprite.width; x++) {
          const p = (y * sprite.width + x) * 4;
          if (sprite.data[p + 3] === 0) continue;
          paint(
            sheet,
            { x0: left + x * scale, y0: top + y * scale, x1: left + (x + 1) * scale, y1: top + (y + 1) * scale },
            [sprite.data[p], sprite.data[p + 1], sprite.data[p + 2], 255],
          );
        }
      }
    });
  });
  return sheet;
}
