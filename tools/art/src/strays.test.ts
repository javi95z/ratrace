import { describe, expect, it } from 'vitest';
import { blank, paint, pixel } from './image';
import { countKeyRemnants, opaqueCount, removeStrays } from './strays';

describe('stray pixels', () => {
  it('removes specks and keeps shapes and thin lines', () => {
    const image = blank(8, 6);
    paint(image, { x0: 0, y0: 0, x1: 1, y1: 1 }, [9, 9, 9, 255]);
    paint(image, { x0: 3, y0: 1, x1: 7, y1: 2 }, [9, 9, 9, 255]);
    paint(image, { x0: 2, y0: 3, x1: 5, y1: 6 }, [9, 9, 9, 255]);
    paint(image, { x0: 7, y0: 5, x1: 8, y1: 6 }, [9, 9, 9, 255]);
    expect(removeStrays(image)).toBe(2);
    expect(pixel(image, 0, 0)[3]).toBe(0);
    expect(pixel(image, 7, 5)[3]).toBe(0);
    expect(pixel(image, 3, 1)[3]).toBe(255);
    expect(pixel(image, 6, 1)[3]).toBe(255);
    expect(opaqueCount(image)).toBe(4 + 9);
  });

  it('counts pixels that still look like the key colour', () => {
    const image = blank(3, 1);
    paint(image, { x0: 0, y0: 0, x1: 1, y1: 1 }, [250, 10, 240, 255]);
    paint(image, { x0: 1, y0: 0, x1: 2, y1: 1 }, [250, 10, 240, 0]);
    paint(image, { x0: 2, y0: 0, x1: 3, y1: 1 }, [10, 200, 10, 255]);
    expect(countKeyRemnants(image)).toBe(1);
  });
});
