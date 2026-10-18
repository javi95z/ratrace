import { gridBox, labelBlobs } from './blobs';
import { blank } from './image';
import type { Box, Image } from './image';
import { erode, isKey } from './key';
import { shrinkMasked } from './scale';

/**
 * True for the pale lavender silhouette layer sheets are drawn over, to show where the rat stands,
 * and for its blend with the key colour along its edge. White, pinks and real purples are not matched.
 */
export function isGuide(r: number, g: number, b: number): boolean {
  return b > 200 && r > 180 && g > 110 && b >= r - 6 && r > g + 15;
}

/** A cell of a sheet, as its own picture. */
export function cellOf(sheet: Image, box: Box): Image {
  const width = box.x1 - box.x0;
  const height = box.y1 - box.y0;
  const out = blank(width, height);
  for (let y = 0; y < height; y++) {
    const from = ((box.y0 + y) * sheet.width + box.x0) * 4;
    out.data.set(sheet.data.subarray(from, from + width * 4), y * width * 4);
  }
  return out;
}

/** Where a layer cell lies over the reference: a point p of the layer lands at s·(p − cL) + cR + (dx, dy). */
export interface Placement {
  s: number;
  dx: number;
  dy: number;
}

/** The shape a cell is matched by, and what it draws. A body is all shape; a layer is its guide, with things drawn over it. */
interface Shapes {
  width: number;
  height: number;
  /** Where the rat is seen: the body, or the guide. */
  shape: Uint8Array;
  /** Where the rat may be hidden: what is drawn over the guide. */
  drawn: Uint8Array;
}

function shapesOf(cell: Image, guided: boolean): Shapes {
  const { width, height, data } = cell;
  const shape = new Uint8Array(width * height);
  const drawn = new Uint8Array(width * height);
  for (let i = 0; i < shape.length; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    if (isKey(r, g, b)) continue;
    if (!guided || isGuide(r, g, b)) shape[i] = 1;
    else drawn[i] = 1;
  }
  return { width, height, shape, drawn };
}

/** Every `step`-th pixel of a mask, as a smaller one. */
function sample(mask: Uint8Array, width: number, height: number, step: number): { mask: Uint8Array; width: number; height: number } {
  const w = Math.floor(width / step);
  const h = Math.floor(height / step);
  const out = new Uint8Array(w * h);
  const half = Math.floor(step / 2);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out[y * w + x] = mask[(y * step + half) * width + x * step + half];
  return { mask: out, width: w, height: h };
}

/**
 * How badly a layer sits over the reference body: guide that falls outside the body, and body left
 * neither under the guide nor under something drawn over it.
 */
function misfit(layer: { shape: Uint8Array; seen: Uint8Array; width: number; height: number; points: Int32Array }, ref: { mask: Uint8Array; width: number; height: number; points: Int32Array }, at: Placement, band: Band): number {
  const weight = (ry: number) => (ry >= band.y0 && ry < band.y1 ? 1 : OUTSIDE_BAND);
  const cl = { x: layer.width / 2, y: layer.height / 2 };
  const cr = { x: ref.width / 2, y: ref.height / 2 };
  let cost = 0;
  for (let k = 0; k < layer.points.length; k++) {
    const i = layer.points[k];
    const x = i % layer.width;
    const y = (i - x) / layer.width;
    const rx = Math.round(at.s * (x - cl.x) + cr.x + at.dx);
    const ry = Math.round(at.s * (y - cl.y) + cr.y + at.dy);
    if (rx < 0 || ry < 0 || rx >= ref.width || ry >= ref.height || ref.mask[ry * ref.width + rx] === 0) cost += weight(ry);
  }
  for (let k = 0; k < ref.points.length; k++) {
    const i = ref.points[k];
    const x = i % ref.width;
    const y = (i - x) / ref.width;
    const lx = Math.round((x - cr.x - at.dx) / at.s + cl.x);
    const ly = Math.round((y - cr.y - at.dy) / at.s + cl.y);
    if (lx < 0 || ly < 0 || lx >= layer.width || ly >= layer.height || layer.seen[ly * layer.width + lx] === 0) cost += weight(y);
  }
  return cost;
}

/** Rows of the reference, from `y0` up to `y1`, where a piece must fit best. */
interface Band {
  y0: number;
  y1: number;
}

/** How much a misfit outside the band counts: enough to keep the piece the right size, not to pull it off where it is worn. */
const OUTSIDE_BAND = 0.2;

/**
 * Where on the rat a piece is worn: clothes on the shoulders, hats and eyewear on the head. Fitted
 * there first, a piece drawn on a rat of slightly other proportions sits right where it shows.
 */
export type Worn = 'head' | 'body' | 'all';

/** The rows of the reference a piece is fitted to, as fractions of the rat from the top of its ears to where it is cut off. */
const WORN: Record<Worn, [number, number]> = { head: [0, 0.62], body: [0.5, 1], all: [0, 1] };

function bandOf(reference: Uint8Array, width: number, height: number, worn: Worn): Band {
  let top = height;
  for (let i = 0; i < reference.length && top === height; i++) if (reference[i]) top = Math.floor(i / width);
  const foot = footOf(reference, width, height);
  const [from, to] = WORN[worn];
  return { y0: top + (foot - top) * from, y1: worn === 'body' || worn === 'all' ? height : top + (foot - top) * to };
}

const pointsOf = (mask: Uint8Array): Int32Array => {
  const points: number[] = [];
  for (let i = 0; i < mask.length; i++) if (mask[i]) points.push(i);
  return Int32Array.from(points);
};

/** The best placement of a layer over the reference at one resolution, searched around a guess. */
function search(layer: Shapes, reference: Uint8Array, refSize: { width: number; height: number }, step: number, around: Placement, scales: number[], reach: number, band: Band): Placement {
  const shape = sample(layer.shape, layer.width, layer.height, step);
  const seenFull = new Uint8Array(layer.shape.length);
  for (let i = 0; i < seenFull.length; i++) seenFull[i] = layer.shape[i] | layer.drawn[i];
  const seen = sample(seenFull, layer.width, layer.height, step);
  const ref = sample(reference, refSize.width, refSize.height, step);
  const l = { shape: shape.mask, seen: seen.mask, width: shape.width, height: shape.height, points: pointsOf(shape.mask) };
  const r = { mask: ref.mask, width: ref.width, height: ref.height, points: pointsOf(ref.mask) };
  let best = around;
  let bestCost = Infinity;
  const cx = around.dx / step;
  const cy = around.dy / step;
  for (const s of scales) {
    for (let dy = -reach; dy <= reach; dy++) {
      for (let dx = -reach; dx <= reach; dx++) {
        const at = { s, dx: Math.round(cx) + dx, dy: Math.round(cy) + dy };
        const cost = misfit(l, r, at, { y0: band.y0 / step, y1: band.y1 / step });
        if (cost < bestCost) {
          bestCost = cost;
          best = { s, dx: at.dx * step, dy: at.dy * step };
        }
      }
    }
  }
  return best;
}

const range = (from: number, to: number, by: number): number[] => {
  const out: number[] = [];
  for (let v = from; v <= to + 1e-9; v += by) out.push(Math.round(v * 1000) / 1000);
  return out;
};

/** Where a cell's rat lies over the reference rat: coarse first, then finer around the best found. */
export function placeOver(cell: Image, guided: boolean, reference: Uint8Array, refSize: { width: number; height: number }, worn: Worn = 'all'): Placement {
  const layer = shapesOf(cell, guided);
  const band = bandOf(reference, refSize.width, refSize.height, worn);
  let at = search(layer, reference, refSize, 8, { s: 1, dx: 0, dy: 0 }, range(0.75, 1.3, 0.025), 10, band);
  at = search(layer, reference, refSize, 4, at, range(at.s - 0.04, at.s + 0.04, 0.01), 4, band);
  return search(layer, reference, refSize, 2, at, range(at.s - 0.006, at.s + 0.006, 0.003), 2, band);
}

/** The reference rat's shape: everything on its cell but the key colour. */
export function referenceShape(cell: Image): Uint8Array {
  return shapesOf(cell, false).shape;
}

const isWhitish = (r: number, g: number, b: number) => Math.min(r, g, b) > 170 && Math.max(r, g, b) - Math.min(r, g, b) < 50;
const isNosePink = (r: number, g: number, b: number) => r > 200 && g > 110 && g < 200 && b > 110 && b < 200 && r - g > 35;

/**
 * What a layer cell draws, without the guide and without the small bits of rat the generator drew
 * on the guide to help itself: whiskers and the nose, which the body already has.
 */
function drawnOnly(cell: Image, guided: boolean, thinnest: number): Uint8Array {
  const { width, height, data } = cell;
  const { shape, drawn } = shapesOf(cell, guided);
  const mask = opened(erode(guided ? drawn : shape, width, height), width, height, thinnest);
  if (!guided) return mask;
  const { blobs, labels } = labelBlobs(mask, width, height);
  const drop = blobs.map((blob, n) => {
    // A bit at the edge of the cell is a neighbour's, or the generator's slip.
    if (blob.x0 <= 2 || blob.y0 <= 2 || blob.x1 >= width - 2 || blob.y1 >= height - 2) return blob.area < width * height * 0.01;
    if (blob.area > width * height * 0.01) return false;
    let pale = 0;
    for (let i = 0; i < labels.length; i++) {
      if (labels[i] !== n + 1) continue;
      const r = data[i * 4];
      const g = data[i * 4 + 1];
      const b = data[i * 4 + 2];
      if (isWhitish(r, g, b) || isNosePink(r, g, b)) pale += 1;
    }
    return pale > blob.area * 0.6;
  });
  for (let i = 0; i < mask.length; i++) if (labels[i] > 0 && drop[labels[i] - 1]) mask[i] = 0;
  return mask;
}

/** Room left above the reference rat, and half as much on each side, for tall hats and halos. */
export const HEADROOM = 48;

/**
 * A mask without any stroke narrower than `radius` × 2 + 1 pixels: shrunk by `radius`, then grown
 * back where something is left. Clothes are drawn with an outline of the neck running on up the
 * guide, which would show as a dark line over the fur.
 */
export function opened(mask: Uint8Array, width: number, height: number, radius: number): Uint8Array {
  if (radius <= 0) return mask;
  const pass = (from: Uint8Array, keep: (count: number) => boolean) => {
    const out = new Uint8Array(from.length);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let count = 0;
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && ny >= 0 && nx < width && ny < height && from[ny * width + nx]) count += 1;
          }
        }
        out[y * width + x] = keep(count) ? 1 : 0;
      }
    }
    return out;
  };
  const all = (2 * radius + 1) ** 2;
  const shrunk = pass(mask, (count) => count === all);
  const grown = pass(shrunk, (count) => count > 0);
  // Only what was there to begin with comes back.
  for (let i = 0; i < grown.length; i++) grown[i] &= mask[i];
  return grown;
}

/** The last row of the reference rat: where it is cut off below, a row more than a stray pixel wide. */
export function footOf(shape: Uint8Array, width: number, height: number): number {
  for (let y = height - 1; y >= 0; y--) {
    let count = 0;
    for (let x = 0; x < width; x++) count += shape[y * width + x];
    if (count >= 20) return y + 1;
  }
  return height;
}

/**
 * A layer cell drawn where the reference rat stands, shrunk to `width` × `height`. The rat stands on
 * the bottom edge, its cut-off shoulders against it, with room above it. `foot` is the row the
 * reference rat ends at.
 */
export function layerSprite(cell: Image, guided: boolean, at: Placement, refSize: { width: number; height: number }, width: number, height: number, foot = refSize.height, thinnest = 0): Image {
  const mask = drawnOnly(cell, guided, thinnest);
  const canvas = { width: refSize.width + HEADROOM, height: refSize.height + HEADROOM };
  const placed = blank(canvas.width, canvas.height);
  const kept = new Uint8Array(canvas.width * canvas.height);
  const cl = { x: cell.width / 2, y: cell.height / 2 };
  const cr = { x: refSize.width / 2 + HEADROOM / 2, y: canvas.height - foot + refSize.height / 2 };
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const lx = Math.round((x - cr.x - at.dx) / at.s + cl.x);
      const ly = Math.round((y - cr.y - at.dy) / at.s + cl.y);
      if (lx < 0 || ly < 0 || lx >= cell.width || ly >= cell.height) continue;
      const i = ly * cell.width + lx;
      if (!mask[i]) continue;
      const o = y * canvas.width + x;
      kept[o] = 1;
      placed.data.set(cell.data.subarray(i * 4, i * 4 + 3), o * 4);
      placed.data[o * 4 + 3] = 255;
    }
  }
  return shrinkMasked(placed, kept, { x0: 0, y0: 0, x1: canvas.width, y1: canvas.height }, width, height);
}

/** The cells of a layer sheet, on its even grid. */
export function layerCells(sheet: Image, cols: number, rows: number): Image[] {
  return Array.from({ length: cols * rows }, (_, i) => cellOf(sheet, gridBox(sheet.width, sheet.height, cols, rows, i, 0)));
}

/** How wide a row of clothes must be, against its widest, to count as the shoulders. */
const SHOULDERS = 0.6;

/**
 * What of the body may show under a piece of clothing: all of it but what lies behind the clothes'
 * back and, across the shoulders, past their front. A body drawn broader than the rat the clothes were drawn
 * on would show a strip of fur, and its outline, down its back.
 */
export function clipOf(outfit: Image): Image {
  const { width, height, data } = outfit;
  const spans: Array<[number, number] | null> = [];
  let widest = 0;
  for (let y = 0; y < height; y++) {
    let left = -1;
    let right = -1;
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] === 0) continue;
      if (left < 0) left = x;
      right = x;
    }
    spans.push(left < 0 ? null : [left, right]);
    if (left >= 0) widest = Math.max(widest, right - left + 1);
  }
  const clip = blank(width, height, [255, 255, 255, 255]);
  spans.forEach((span, y) => {
    if (span === null) return;
    // Behind (the rat faces right), wherever there are clothes: nothing of the body belongs past their back.
    for (let x = 0; x < span[0]; x++) clip.data[(y * width + x) * 4 + 3] = 0;
    // In front, only across the shoulders: above them, the chin and the neck are the rat's own.
    if (span[1] - span[0] + 1 < widest * SHOULDERS) return;
    for (let x = span[1] + 1; x < width; x++) clip.data[(y * width + x) * 4 + 3] = 0;
  });
  return clip;
}
