import type { Image } from './image';
import { isKey } from './key';

export function opaqueCount(image: Image): number {
  let count = 0;
  for (let p = 3; p < image.data.length; p += 4) if (image.data[p] !== 0) count += 1;
  return count;
}

/** Clears every opaque pixel that has no opaque neighbour. Returns how many were cleared. */
export function removeStrays(image: Image): number {
  const { width, height, data } = image;
  const lonely: number[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (data[i * 4 + 3] === 0) continue;
      let neighbours = 0;
      for (let dy = -1; dy <= 1 && neighbours === 0; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          if (data[(ny * width + nx) * 4 + 3] !== 0) {
            neighbours += 1;
            break;
          }
        }
      }
      if (neighbours === 0) lonely.push(i);
    }
  }
  for (const i of lonely) data.fill(0, i * 4, i * 4 + 4);
  return lonely.length;
}

/** Opaque pixels that still look like the key colour: a sign that the cut-out left a fringe. */
export function countKeyRemnants(image: Image): number {
  let count = 0;
  for (let p = 0; p < image.data.length; p += 4) {
    if (image.data[p + 3] !== 0 && isKey(image.data[p], image.data[p + 1], image.data[p + 2])) count += 1;
  }
  return count;
}
