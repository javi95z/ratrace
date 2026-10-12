import { describe, expect, it } from 'vitest';
import { blank, paint } from './image';
import { cropToAspect, panelBoxes, runsOf } from './scenes';

describe('scene sheets', () => {
  it('finds runs of true values', () => {
    expect(runsOf([false, true, true, false, true])).toEqual([[1, 2], [4, 4]]);
    expect(runsOf([])).toEqual([]);
  });

  it('cuts panels at white dividing lines', () => {
    const sheet = blank(21, 11, [30, 40, 80, 255]);
    paint(sheet, { x0: 10, y0: 0, x1: 11, y1: 11 }, [255, 255, 255, 255]);
    paint(sheet, { x0: 0, y0: 5, x1: 21, y1: 6 }, [250, 250, 250, 255]);
    expect(panelBoxes(sheet, 2, 2)).toEqual([
      { x0: 0, y0: 0, x1: 10, y1: 5 },
      { x0: 11, y0: 0, x1: 21, y1: 5 },
      { x0: 0, y0: 6, x1: 10, y1: 11 },
      { x0: 11, y0: 6, x1: 21, y1: 11 },
    ]);
  });

  it('cuts panels at magenta gutters and ignores the outer border', () => {
    const sheet = blank(12, 14, [255, 0, 255, 255]);
    paint(sheet, { x0: 1, y0: 1, x1: 11, y1: 6 }, [20, 27, 51, 255]);
    paint(sheet, { x0: 1, y0: 8, x1: 11, y1: 13 }, [20, 27, 51, 255]);
    expect(panelBoxes(sheet, 1, 2)).toEqual([
      { x0: 1, y0: 1, x1: 11, y1: 6 },
      { x0: 1, y0: 8, x1: 11, y1: 13 },
    ]);
  });

  it('falls back to an even grid when it finds no dividers', () => {
    const sheet = blank(20, 10, [30, 40, 80, 255]);
    expect(panelBoxes(sheet, 2, 1)).toEqual([
      { x0: 0, y0: 0, x1: 10, y1: 10 },
      { x0: 10, y0: 0, x1: 20, y1: 10 },
    ]);
  });

  it('crops a panel to the wanted shape around its centre', () => {
    expect(cropToAspect({ x0: 0, y0: 0, x1: 100, y1: 50 }, 4, 1)).toEqual({ x0: 0, y0: 13, x1: 100, y1: 38 });
    expect(cropToAspect({ x0: 10, y0: 0, x1: 110, y1: 50 }, 1, 1)).toEqual({ x0: 35, y0: 0, x1: 85, y1: 50 });
  });
});
