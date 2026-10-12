import { describe, expect, it } from 'vitest';
import { blank, paint, pixel } from './image';
import { fitInto, resample } from './scale';

describe('scaling', () => {
  it('averages blocks when shrinking by a whole factor', () => {
    const src = blank(4, 2, [0, 0, 0, 255]);
    paint(src, { x0: 0, y0: 0, x1: 2, y1: 2 }, [200, 100, 0, 255]);
    paint(src, { x0: 2, y0: 0, x1: 3, y1: 2 }, [100, 0, 0, 255]);
    const out = resample(src, { x0: 0, y0: 0, x1: 4, y1: 2 }, 2, 1);
    expect(pixel(out, 0, 0)).toEqual([200, 100, 0, 255]);
    expect(pixel(out, 1, 0)).toEqual([50, 0, 0, 255]);
  });

  it('fits a shape inside the target, centred, keeping its proportions', () => {
    const src = blank(40, 40, [255, 0, 255, 255]);
    paint(src, { x0: 10, y0: 10, x1: 30, y1: 20 }, [10, 20, 30, 255]);
    const mask = new Uint8Array(40 * 40);
    for (let y = 10; y < 20; y++) for (let x = 10; x < 30; x++) mask[y * 40 + x] = 1;
    const out = fitInto(src, mask, { x0: 10, y0: 10, x1: 30, y1: 20 }, 12, 12, { padding: 1, anchor: 'center' });
    expect([out.width, out.height]).toEqual([12, 12]);
    expect(pixel(out, 6, 5)).toEqual([10, 20, 30, 255]);
    expect(pixel(out, 1, 3)).toEqual([10, 20, 30, 255]);
    expect(pixel(out, 10, 7)).toEqual([10, 20, 30, 255]);
    expect(pixel(out, 0, 5)[3]).toBe(0);
    expect(pixel(out, 6, 2)[3]).toBe(0);
    expect(pixel(out, 6, 8)[3]).toBe(0);
  });

  it('never lets the key colour bleed into the edge of a shape', () => {
    const src = blank(8, 8, [255, 0, 255, 255]);
    paint(src, { x0: 1, y0: 0, x1: 8, y1: 8 }, [0, 200, 0, 255]);
    const mask = new Uint8Array(64);
    for (let y = 0; y < 8; y++) for (let x = 1; x < 8; x++) mask[y * 8 + x] = 1;
    const out = fitInto(src, mask, { x0: 0, y0: 0, x1: 8, y1: 8 }, 4, 4, { padding: 0, anchor: 'center' });
    expect(pixel(out, 0, 0)).toEqual([0, 200, 0, 255]);
  });

  it('can rest a shape on the bottom edge', () => {
    const src = blank(20, 20, [5, 5, 5, 255]);
    const mask = new Uint8Array(400).fill(1);
    const out = fitInto(src, mask, { x0: 0, y0: 0, x1: 20, y1: 10 }, 10, 10, { padding: 0, anchor: 'bottom' });
    expect(pixel(out, 5, 9)[3]).toBe(255);
    expect(pixel(out, 5, 5)[3]).toBe(255);
    expect(pixel(out, 5, 4)[3]).toBe(0);
  });
});
