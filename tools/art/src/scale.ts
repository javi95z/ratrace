import { blank } from './image';
import type { Box, Image } from './image';

/**
 * Shrinks a rectangle of `src` to `width` × `height` by averaging the source pixels each target pixel covers.
 * With a mask, pixels outside it count as transparent and never tint their neighbours.
 * A target pixel becomes opaque when at least half of what it covers is object.
 */
function shrink(src: Image, mask: Uint8Array | null, box: Box, width: number, height: number): Image {
  const out = blank(width, height);
  const scaleX = (box.x1 - box.x0) / width;
  const scaleY = (box.y1 - box.y0) / height;

  for (let ty = 0; ty < height; ty++) {
    const sy0 = box.y0 + ty * scaleY;
    const sy1 = box.y0 + (ty + 1) * scaleY;
    for (let tx = 0; tx < width; tx++) {
      const sx0 = box.x0 + tx * scaleX;
      const sx1 = box.x0 + (tx + 1) * scaleX;
      let r = 0;
      let g = 0;
      let b = 0;
      let covered = 0;
      let total = 0;

      for (let y = Math.floor(sy0); y < Math.ceil(sy1); y++) {
        if (y < 0 || y >= src.height) continue;
        const wy = Math.min(sy1, y + 1) - Math.max(sy0, y);
        if (wy <= 0) continue;
        for (let x = Math.floor(sx0); x < Math.ceil(sx1); x++) {
          if (x < 0 || x >= src.width) continue;
          const wx = Math.min(sx1, x + 1) - Math.max(sx0, x);
          if (wx <= 0) continue;
          const weight = wx * wy;
          const i = y * src.width + x;
          total += weight;
          if (mask !== null && mask[i] === 0) continue;
          covered += weight;
          r += src.data[i * 4] * weight;
          g += src.data[i * 4 + 1] * weight;
          b += src.data[i * 4 + 2] * weight;
        }
      }

      if (total > 0 && covered / total >= 0.5) {
        const o = (ty * width + tx) * 4;
        out.data[o] = Math.round(r / covered);
        out.data[o + 1] = Math.round(g / covered);
        out.data[o + 2] = Math.round(b / covered);
        out.data[o + 3] = 255;
      }
    }
  }
  return out;
}

/** Shrinks a whole rectangle to an exact size, keeping only what the mask covers. Used for layers that must stay where they were drawn. */
export function shrinkMasked(src: Image, mask: Uint8Array, box: Box, width: number, height: number): Image {
  return shrink(src, mask, box, width, height);
}

/** Shrinks a whole rectangle to an exact size, with no transparency. Used for scenes. */
export function resample(src: Image, box: Box, width: number, height: number): Image {
  return shrink(src, null, box, width, height);
}

/**
 * Shrinks an object to fit inside a `width` × `height` sprite, keeping its proportions.
 * The object is never enlarged. `padding` is the clear margin kept on every side.
 */
export function fitInto(
  src: Image,
  mask: Uint8Array,
  box: Box,
  width: number,
  height: number,
  options: { padding: number; anchor: 'center' | 'bottom' },
): Image {
  const boxWidth = box.x1 - box.x0;
  const boxHeight = box.y1 - box.y0;
  const room = { w: width - 2 * options.padding, h: height - 2 * options.padding };
  const scale = Math.min(1, room.w / boxWidth, room.h / boxHeight);
  const w = Math.max(1, Math.round(boxWidth * scale));
  const h = Math.max(1, Math.round(boxHeight * scale));
  const small = shrink(src, mask, box, w, h);

  const out = blank(width, height);
  const left = Math.floor((width - w) / 2);
  const top = options.anchor === 'bottom' ? height - h - options.padding : Math.floor((height - h) / 2);
  for (let y = 0; y < h; y++) {
    const from = y * w * 4;
    out.data.set(small.data.subarray(from, from + w * 4), ((top + y) * width + left) * 4);
  }
  return out;
}
