import type { Image } from './image';

/**
 * True for the magenta the sheets are drawn on, with room for the colour shifts of image compression.
 * Pinks and reds are not matched: their green or blue channel is too far off.
 */
export function isKey(r: number, g: number, b: number): boolean {
  return r > 150 && b > 150 && g < 120 && Math.abs(r - b) < 90;
}

/** One entry per pixel: 1 where the pixel belongs to an object, 0 where it is the key colour. */
export function keyMask(image: Image): Uint8Array {
  const mask = new Uint8Array(image.width * image.height);
  for (let i = 0; i < mask.length; i++) {
    const p = i * 4;
    mask[i] = isKey(image.data[p], image.data[p + 1], image.data[p + 2]) ? 0 : 1;
  }
  return mask;
}

/** Removes one pixel from the edge of every shape, which drops the tinted fringe compression leaves. */
export function erode(mask: Uint8Array, width: number, height: number): Uint8Array {
  const out = new Uint8Array(mask.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (mask[i] === 0) continue;
      const inside = x > 0 && x < width - 1 && y > 0 && y < height - 1;
      if (inside && mask[i - 1] && mask[i + 1] && mask[i - width] && mask[i + width]) out[i] = 1;
    }
  }
  return out;
}
