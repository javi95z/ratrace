import { describe, expect, it } from 'vitest';
import { blank, paint } from './image';
import { erode, isKey, keyMask } from './key';

describe('key colour', () => {
  it('recognises magenta and its compressed neighbours, and nothing else', () => {
    expect(isKey(255, 0, 255)).toBe(true);
    expect(isKey(236, 18, 228)).toBe(true);
    expect(isKey(240, 140, 150)).toBe(false);
    expect(isKey(209, 73, 91)).toBe(false);
    expect(isKey(20, 27, 51)).toBe(false);
    expect(isKey(255, 255, 255)).toBe(false);
    expect(isKey(0, 0, 0)).toBe(false);
  });

  it('marks object pixels 1 and key pixels 0', () => {
    const sheet = blank(4, 2, [255, 0, 255, 255]);
    paint(sheet, { x0: 1, y0: 0, x1: 3, y1: 1 }, [242, 193, 78, 255]);
    expect(Array.from(keyMask(sheet))).toEqual([0, 1, 1, 0, 0, 0, 0, 0]);
  });

  it('erodes one pixel from every edge of a shape', () => {
    const sheet = blank(5, 5, [255, 0, 255, 255]);
    paint(sheet, { x0: 1, y0: 1, x1: 4, y1: 4 }, [0, 0, 0, 255]);
    const eroded = erode(keyMask(sheet), 5, 5);
    expect(Array.from(eroded).reduce((a, b) => a + b, 0)).toBe(1);
    expect(eroded[2 * 5 + 2]).toBe(1);
  });
});
