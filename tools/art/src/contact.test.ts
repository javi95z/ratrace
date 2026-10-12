import { describe, expect, it } from 'vitest';
import { composeContact } from './contact';
import { blank, paint, pixel } from './image';

describe('contact sheet', () => {
  it('lays sprites out in a grid, enlarged, once on each background', () => {
    const red = blank(2, 2);
    paint(red, { x0: 0, y0: 0, x1: 1, y1: 2 }, [200, 0, 0, 255]);
    const blue = blank(2, 2, [0, 0, 200, 255]);
    const sheet = composeContact([red, blue, red], { columns: 2, scale: 3, backgrounds: [[10, 10, 10], [240, 240, 240]] });
    expect([sheet.width, sheet.height]).toEqual([2 * 4 * 3, 2 * 4 * 3 * 2]);
    expect(pixel(sheet, 3, 3)).toEqual([200, 0, 0, 255]);
    expect(pixel(sheet, 6, 3)).toEqual([10, 10, 10, 255]);
    expect(pixel(sheet, 15, 3)).toEqual([0, 0, 200, 255]);
    expect(pixel(sheet, 3, 15)).toEqual([200, 0, 0, 255]);
    expect(pixel(sheet, 15, 15)).toEqual([10, 10, 10, 255]);
    expect(pixel(sheet, 6, 27)).toEqual([240, 240, 240, 255]);
    expect(pixel(sheet, 3, 27)).toEqual([200, 0, 0, 255]);
  });
});
