import { describe, expect, it } from 'vitest';
import { crispSize, GAP, MAX_TILE, pagedLayout, placeOfChoice, stepChoice, wholeLayout } from './ratPicker';

describe('the rat editor\'s room', () => {
  it('pages two rows of choices, five to a row at the least, each as large as the room for the choices lets it be', () => {
    // A phone of 320 by 568: the column 296 wide less the strip's edges, a third of the editor's 400-odd high for the choices.
    const small = pagedLayout(284, 133, 17);
    expect(small).toMatchObject({ columns: 5, rows: 2, perPage: 10, pages: 2 });
    expect(small.tile).toBeCloseTo((284 - 4 * GAP) / 5);
    expect(2 * small.tile + GAP).toBeLessThanOrEqual(133);
    // Short of height for five to a row, more of them, smaller.
    const short = pagedLayout(357, 90, 17);
    expect(short.columns).toBeGreaterThan(5);
    expect(2 * short.tile + GAP).toBeLessThanOrEqual(90);
    // Never larger than a desk's largest.
    expect(pagedLayout(1000, 1000, 8).tile).toBeLessThanOrEqual(MAX_TILE);
    // One page when they all fit on it.
    expect(pagedLayout(357, 250, 8).pages).toBe(1);
  });

  it('lays every choice out at once at a desk, as large as the room lets them all be', () => {
    const desk = wholeLayout(456, 500, 17);
    expect(desk.pages).toBe(1);
    expect(desk.perPage).toBe(17);
    expect(desk.columns * desk.rows).toBeGreaterThanOrEqual(17);
    expect(desk.rows * desk.tile + (desk.rows - 1) * GAP).toBeLessThanOrEqual(500);
    expect(desk.columns * desk.tile + (desk.columns - 1) * GAP).toBeLessThanOrEqual(456 + 1e-9);
    expect(desk.tile).toBeLessThanOrEqual(MAX_TILE);
  });

  it('places each choice on its page, row by row', () => {
    const layout = pagedLayout(284, 133, 17);
    expect(placeOfChoice(0, layout, 300)).toEqual({ x: 0, y: 0, page: 0 });
    expect(placeOfChoice(6, layout, 300)).toEqual({ x: layout.tile + GAP, y: layout.tile + GAP, page: 0 });
    expect(placeOfChoice(11, layout, 300)).toEqual({ x: 300 + layout.tile + GAP, y: 0, page: 1 });
  });

  it('steps to the next choice or the one before, round the ends, passing over a prize not won', () => {
    const choices = [{ locked: null }, { locked: 'rank' }, { locked: null }, { locked: 'badge' }];
    expect(stepChoice(choices, 0, 1)).toBe(2);
    expect(stepChoice(choices, 2, 1)).toBe(0);
    expect(stepChoice(choices, 0, -1)).toBe(2);
    expect(stepChoice([{ locked: null }, { locked: 'x' }], 0, 1)).toBe(0);
  });

  it('draws the rat at a whole number of the screen\'s pixels for each of its own', () => {
    expect(crispSize(200, 2)).toBe(192);
    expect(crispSize(200, 3)).toBeCloseTo(512 / 3);
    expect(crispSize(50, 1)).toBe(50);
  });
});
