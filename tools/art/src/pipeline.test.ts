import { describe, expect, it } from 'vitest';
import { blank, paint, pixel } from './image';
import { cutSheet } from './pipeline';
import type { SheetSpec } from './sheets';

const MAGENTA = [255, 0, 255, 255] as const;
const spec = (over: Partial<SheetSpec>): SheetSpec => ({
  file: 'test/sheet', group: 'test', kind: 'objects', cols: 2, rows: 1, width: 10, height: 10, ids: ['a', 'b'], ...over,
});

describe('cutting a sheet', () => {
  it('cuts each object out, shrinks it and names it', () => {
    const sheet = blank(200, 100, MAGENTA);
    paint(sheet, { x0: 20, y0: 20, x1: 80, y1: 80 }, [200, 30, 30, 255]);
    paint(sheet, { x0: 110, y0: 30, x1: 190, y1: 70 }, [30, 30, 200, 255]);
    const sprites = cutSheet(sheet, spec({}));
    expect(sprites.map((s) => s.id)).toEqual(['a', 'b']);
    expect(sprites.map((s) => [s.image.width, s.image.height])).toEqual([[10, 10], [10, 10]]);
    expect(pixel(sprites[0].image, 5, 5)).toEqual([200, 30, 30, 255]);
    expect(pixel(sprites[0].image, 0, 0)[3]).toBe(0);
    expect(pixel(sprites[1].image, 5, 5)).toEqual([30, 30, 200, 255]);
    expect(pixel(sprites[1].image, 5, 1)[3]).toBe(0);
    expect(sprites.flatMap((s) => s.flags)).toEqual([]);
  });

  it('keeps an object whole when it crosses the cell line, without taking its neighbour', () => {
    const sheet = blank(200, 100, MAGENTA);
    paint(sheet, { x0: 10, y0: 40, x1: 112, y1: 60 }, [200, 30, 30, 255]);
    paint(sheet, { x0: 125, y0: 30, x1: 190, y1: 90 }, [30, 30, 200, 255]);
    const [a, b] = cutSheet(sheet, spec({ width: 40, height: 20 }));
    const colours = new Set<string>();
    for (let y = 0; y < 20; y++) for (let x = 0; x < 40; x++) if (pixel(a.image, x, y)[3]) colours.add(pixel(a.image, x, y).join());
    expect([...colours]).toEqual(['200,30,30,255']);
    expect(pixel(b.image, 20, 10)).toEqual([30, 30, 200, 255]);
  });

  it('flags an empty cell and an object cut off by the edge of the sheet', () => {
    const sheet = blank(200, 100, MAGENTA);
    paint(sheet, { x0: 0, y0: 20, x1: 60, y1: 80 }, [200, 30, 30, 255]);
    const [a, b] = cutSheet(sheet, spec({}));
    expect(a.flags).toEqual(['touches-edge']);
    expect(b.flags).toEqual(['empty']);
  });

  it('skips cells with no name', () => {
    const sheet = blank(200, 100, MAGENTA);
    paint(sheet, { x0: 20, y0: 20, x1: 80, y1: 80 }, [200, 30, 30, 255]);
    paint(sheet, { x0: 120, y0: 20, x1: 180, y1: 80 }, [30, 30, 200, 255]);
    expect(cutSheet(sheet, spec({ ids: ['', 'b'] })).map((s) => s.id)).toEqual(['b']);
  });

  it('ignores white dividing lines drawn between cells', () => {
    const sheet = blank(200, 100, MAGENTA);
    paint(sheet, { x0: 98, y0: 0, x1: 102, y1: 100 }, [255, 255, 255, 255]);
    paint(sheet, { x0: 20, y0: 20, x1: 80, y1: 80 }, [250, 250, 250, 255]);
    paint(sheet, { x0: 120, y0: 20, x1: 180, y1: 80 }, [30, 30, 200, 255]);
    const [a, b] = cutSheet(sheet, spec({}));
    expect(a.flags).toEqual([]);
    expect(pixel(a.image, 5, 5)).toEqual([250, 250, 250, 255]);
    expect(pixel(a.image, 9, 5)[3]).toBe(0);
    expect(b.flags).toEqual([]);
  });

  it('cuts portraits on the fixed grid and rests them on the bottom edge', () => {
    const sheet = blank(200, 100, MAGENTA);
    paint(sheet, { x0: 2, y0: 30, x1: 98, y1: 100 }, [232, 183, 150, 255]);
    paint(sheet, { x0: 102, y0: 30, x1: 198, y1: 100 }, [74, 50, 40, 255]);
    const [a, b] = cutSheet(sheet, spec({ kind: 'portraits', width: 20, height: 20 }));
    expect(pixel(a.image, 10, 19)).toEqual([232, 183, 150, 255]);
    expect(pixel(a.image, 10, 2)[3]).toBe(0);
    expect(pixel(b.image, 10, 19)).toEqual([74, 50, 40, 255]);
  });

  it('keeps the top of the portrait below out of a portrait, even when it pokes over the cell line', () => {
    const sheet = blank(100, 200, MAGENTA);
    paint(sheet, { x0: 10, y0: 30, x1: 90, y1: 92 }, [232, 183, 150, 255]);
    paint(sheet, { x0: 30, y0: 96, x1: 70, y1: 200 }, [74, 50, 40, 255]);
    const [top, bottom] = cutSheet(sheet, spec({ kind: 'portraits', cols: 1, rows: 2, width: 20, height: 20 }));
    const colours = new Set<string>();
    for (let y = 0; y < 20; y++) for (let x = 0; x < 20; x++) if (pixel(top.image, x, y)[3]) colours.add(pixel(top.image, x, y).join());
    expect([...colours]).toEqual(['232,183,150,255']);
    expect(pixel(top.image, 10, 19)).toEqual([232, 183, 150, 255]);
    expect(pixel(bottom.image, 10, 19)).toEqual([74, 50, 40, 255]);
  });

  it('cuts portraits apart when white rules are drawn between their cells', () => {
    const sheet = blank(100, 200, MAGENTA);
    // Each bust runs down to the rule under it, as a drawn sheet does.
    paint(sheet, { x0: 10, y0: 30, x1: 90, y1: 98 }, [232, 183, 150, 255]);
    paint(sheet, { x0: 0, y0: 98, x1: 100, y1: 102 }, [255, 255, 255, 255]);
    paint(sheet, { x0: 30, y0: 130, x1: 70, y1: 200 }, [74, 50, 40, 255]);
    const [top, bottom] = cutSheet(sheet, spec({ kind: 'portraits', cols: 1, rows: 2, width: 20, height: 20 }));
    const colours = (image: typeof top.image) => {
      const seen = new Set<string>();
      for (let y = 0; y < 20; y++) for (let x = 0; x < 20; x++) if (pixel(image, x, y)[3]) seen.add(pixel(image, x, y).join());
      return [...seen];
    };
    expect(colours(top.image)).toEqual(['232,183,150,255']);
    expect(colours(bottom.image)).toEqual(['74,50,40,255']);
    expect(top.flags).toEqual([]);
    expect(bottom.flags).toEqual([]);
  });

  it('cuts scenes at their dividers, crops them to shape and keeps them opaque', () => {
    const sheet = blank(205, 60, [20, 27, 51, 255]);
    paint(sheet, { x0: 100, y0: 0, x1: 105, y1: 60 }, [255, 255, 255, 255]);
    paint(sheet, { x0: 105, y0: 0, x1: 205, y1: 60 }, [242, 193, 78, 255]);
    const [a, b] = cutSheet(sheet, spec({ kind: 'scenes', width: 20, height: 10 }));
    expect([a.image.width, a.image.height]).toEqual([20, 10]);
    expect(pixel(a.image, 0, 0)).toEqual([20, 27, 51, 255]);
    expect(pixel(b.image, 19, 9)).toEqual([242, 193, 78, 255]);
    expect(a.flags).toEqual([]);
  });
});
