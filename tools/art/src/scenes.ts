import { gridBox } from './blobs';
import type { Box, Image } from './image';
import { isKey } from './key';

/** Inclusive [start, end] index pairs of every run of true values. */
export function runsOf(flags: boolean[]): Array<[number, number]> {
  const runs: Array<[number, number]> = [];
  let start = -1;
  flags.forEach((flag, i) => {
    if (flag && start < 0) start = i;
    if (!flag && start >= 0) {
      runs.push([start, i - 1]);
      start = -1;
    }
  });
  if (start >= 0) runs.push([start, flags.length - 1]);
  return runs;
}

const isWhite = (r: number, g: number, b: number): boolean => r > 200 && g > 200 && b > 200;

/**
 * For each column (or row), true when at least 85% of its pixels are a dividing colour.
 * On scene sheets a divider is white or the key colour. On object sheets, where the background
 * is the key colour everywhere, only white counts.
 */
export function dividerFlags(image: Image, axis: 'x' | 'y', colours: 'white' | 'white-or-key' = 'white-or-key'): boolean[] {
  const length = axis === 'x' ? image.width : image.height;
  const across = axis === 'x' ? image.height : image.width;
  const flags: boolean[] = [];
  for (let i = 0; i < length; i++) {
    let hits = 0;
    for (let j = 0; j < across; j++) {
      const p = (axis === 'x' ? j * image.width + i : i * image.width + j) * 4;
      const r = image.data[p];
      const g = image.data[p + 1];
      const b = image.data[p + 2];
      if (isWhite(r, g, b) || (colours === 'white-or-key' && isKey(r, g, b))) hits += 1;
    }
    flags.push(hits >= across * 0.85);
  }
  return flags;
}

/**
 * The rectangles of the panels on a scene sheet, left to right and top to bottom.
 * Panels are found between dividing lines, whether the generator drew them white or in the key colour.
 * If the lines found do not give exactly `cols` × `rows` panels, the sheet is cut on an even grid instead.
 */
export function panelBoxes(image: Image, cols: number, rows: number): Box[] {
  const columns = runsOf(dividerFlags(image, 'x').map((d) => !d));
  const lines = runsOf(dividerFlags(image, 'y').map((d) => !d));
  if (columns.length !== cols || lines.length !== rows) {
    return Array.from({ length: cols * rows }, (_, i) => gridBox(image.width, image.height, cols, rows, i, 0));
  }
  const boxes: Box[] = [];
  for (const [y0, y1] of lines) {
    for (const [x0, x1] of columns) boxes.push({ x0, y0, x1: x1 + 1, y1: y1 + 1 });
  }
  return boxes;
}

/** The largest rectangle of the given proportions that fits in `box`, around its centre. */
export function cropToAspect(box: Box, aspectWidth: number, aspectHeight: number): Box {
  const width = box.x1 - box.x0;
  const height = box.y1 - box.y0;
  if (width * aspectHeight > height * aspectWidth) {
    const w = Math.round((height * aspectWidth) / aspectHeight);
    const x0 = box.x0 + Math.round((width - w) / 2);
    return { x0, y0: box.y0, x1: x0 + w, y1: box.y1 };
  }
  const h = Math.round((width * aspectHeight) / aspectWidth);
  const y0 = box.y0 + Math.round((height - h) / 2);
  return { x0: box.x0, y0, x1: box.x1, y1: y0 + h };
}
