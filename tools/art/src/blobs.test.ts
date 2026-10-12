import { describe, expect, it } from 'vitest';
import { cellBoxes, findBlobs, gridBox } from './blobs';

const mask = (rows: string[]) => ({
  width: rows[0].length,
  height: rows.length,
  data: Uint8Array.from(rows.join('').split('').map((c) => (c === '#' ? 1 : 0))),
});

describe('blobs', () => {
  it('finds connected shapes, joining diagonals', () => {
    const m = mask(['##....', '##....', '..#...', '......', '....##']);
    const blobs = findBlobs(m.data, m.width, m.height);
    expect(blobs.map((b) => b.area).sort()).toEqual([2, 5]);
    const big = blobs.find((b) => b.area === 5);
    expect(big).toMatchObject({ x0: 0, y0: 0, x1: 3, y1: 3 });
  });

  it('gives each grid cell the box of the shape centred in it', () => {
    const m = mask(['........', '.###....', '.###....', '........', '.....##.', '.....##.', '........', '........']);
    const boxes = cellBoxes(findBlobs(m.data, m.width, m.height), m.width, m.height, 2, 2, { minArea: 2, reach: 1 });
    expect(boxes).toEqual([{ x0: 1, y0: 1, x1: 4, y1: 3 }, null, null, { x0: 5, y0: 4, x1: 7, y1: 6 }]);
  });

  it('keeps a shape whole when it strays over a cell line', () => {
    const m = mask(['........', '.#####..', '.#####..', '........']);
    const boxes = cellBoxes(findBlobs(m.data, m.width, m.height), m.width, m.height, 2, 1, { minArea: 2, reach: 1 });
    expect(boxes).toEqual([{ x0: 1, y0: 1, x1: 6, y1: 3 }, null]);
  });

  it('attaches a small detached part to the nearest shape and drops far specks', () => {
    const m = mask([
      '..........#.',
      '.####.#.....',
      '.####.......',
      '.####.......',
      '............',
    ]);
    const boxes = cellBoxes(findBlobs(m.data, m.width, m.height), m.width, m.height, 1, 1, { minArea: 4, reach: 2 });
    expect(boxes).toEqual([{ x0: 1, y0: 1, x1: 7, y1: 4 }]);
  });

  it('cuts an even grid cell with an inset', () => {
    expect(gridBox(100, 60, 2, 3, 3, 2)).toEqual({ x0: 52, y0: 22, x1: 98, y1: 38 });
  });
});
