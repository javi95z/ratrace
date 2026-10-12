import type { Box } from './image';

export interface Blob extends Box {
  area: number;
  /** Centre of mass. */
  cx: number;
  cy: number;
}

/** Finds every connected shape in a mask. Pixels touching at a corner count as connected. */
export function findBlobs(mask: Uint8Array, width: number, height: number): Blob[] {
  return labelBlobs(mask, width, height).blobs;
}

/**
 * Like `findBlobs`, and also returns a label for every pixel:
 * 0 for background, otherwise 1 plus the index of its blob.
 */
export function labelBlobs(mask: Uint8Array, width: number, height: number): { blobs: Blob[]; labels: Int32Array } {
  const labels = new Int32Array(mask.length);
  const seen = new Uint8Array(mask.length);
  const stack = new Int32Array(mask.length);
  const blobs: Blob[] = [];

  for (let start = 0; start < mask.length; start++) {
    if (mask[start] === 0 || seen[start] === 1) continue;
    let top = 0;
    stack[top++] = start;
    seen[start] = 1;
    let area = 0;
    let sumX = 0;
    let sumY = 0;
    let x0 = width;
    let y0 = height;
    let x1 = 0;
    let y1 = 0;

    while (top > 0) {
      const i = stack[--top];
      labels[i] = blobs.length + 1;
      const x = i % width;
      const y = (i - x) / width;
      area += 1;
      sumX += x;
      sumY += y;
      if (x < x0) x0 = x;
      if (y < y0) y0 = y;
      if (x + 1 > x1) x1 = x + 1;
      if (y + 1 > y1) y1 = y + 1;
      for (let dy = -1; dy <= 1; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= height) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= width) continue;
          const n = ny * width + nx;
          if (mask[n] === 1 && seen[n] === 0) {
            seen[n] = 1;
            stack[top++] = n;
          }
        }
      }
    }
    blobs.push({ area, x0, y0, x1, y1, cx: sumX / area, cy: sumY / area });
  }
  return { blobs, labels };
}

function gap(a: Box, b: Box): number {
  const dx = Math.max(0, a.x0 - b.x1, b.x0 - a.x1);
  const dy = Math.max(0, a.y0 - b.y1, b.y0 - a.y1);
  return Math.max(dx, dy);
}

function union(a: Box, b: Box): Box {
  return { x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) };
}

export interface CellContent {
  box: Box;
  /** Labels (1 plus blob index) of the shapes that make up this cell's object. */
  members: Set<number>;
}

/**
 * Works out which shapes belong to each grid cell. A cell with nothing in it is null.
 *
 * A shape of at least `minArea` pixels belongs to the cell that holds its centre, so an object that
 * strays over a cell line is still cut whole. Smaller pieces (a sparkle, a coin above a piggy bank)
 * join the nearest object within `reach` pixels; anything farther is a speck and is dropped.
 */
export function assignCells(
  blobs: Blob[],
  width: number,
  height: number,
  cols: number,
  rows: number,
  options: { minArea: number; reach: number },
): Array<CellContent | null> {
  const cells: Array<CellContent | null> = new Array(cols * rows).fill(null);
  const small: Array<{ blob: Blob; label: number }> = [];

  blobs.forEach((blob, i) => {
    const label = i + 1;
    if (blob.area < options.minArea) {
      small.push({ blob, label });
      return;
    }
    const col = Math.min(cols - 1, Math.floor(blob.cx / (width / cols)));
    const row = Math.min(rows - 1, Math.floor(blob.cy / (height / rows)));
    const index = row * cols + col;
    const box: Box = { x0: blob.x0, y0: blob.y0, x1: blob.x1, y1: blob.y1 };
    const cell = cells[index];
    if (cell) {
      cell.box = union(cell.box, box);
      cell.members.add(label);
    } else {
      cells[index] = { box, members: new Set([label]) };
    }
  });

  const anchors = cells.map((cell) => (cell ? { ...cell.box } : null));
  for (const { blob, label } of small) {
    let best = -1;
    let bestGap = Infinity;
    anchors.forEach((anchor, index) => {
      if (!anchor) return;
      const distance = gap(anchor, blob);
      if (distance < bestGap) {
        bestGap = distance;
        best = index;
      }
    });
    const cell = best >= 0 ? cells[best] : null;
    if (cell && bestGap <= options.reach) {
      cell.box = union(cell.box, blob);
      cell.members.add(label);
    }
  }
  return cells;
}

/** The bounding box of the object in each grid cell, or null for an empty cell. See `assignCells`. */
export function cellBoxes(
  blobs: Blob[],
  width: number,
  height: number,
  cols: number,
  rows: number,
  options: { minArea: number; reach: number },
): Array<Box | null> {
  return assignCells(blobs, width, height, cols, rows, options).map((cell) => (cell ? cell.box : null));
}

/** The rectangle of one cell of an even grid, shrunk by `inset` pixels on every side. */
export function gridBox(width: number, height: number, cols: number, rows: number, index: number, inset: number): Box {
  const col = index % cols;
  const row = Math.floor(index / cols);
  return {
    x0: Math.round((col * width) / cols) + inset,
    y0: Math.round((row * height) / rows) + inset,
    x1: Math.round(((col + 1) * width) / cols) - inset,
    y1: Math.round(((row + 1) * height) / rows) - inset,
  };
}
