import { describe, expect, it } from 'vitest';
import { blank, paint } from './image';
import type { Rgba } from './image';
import { isGuide, layerSprite, placeOver, referenceShape } from './layers';

const KEY: Rgba = [255, 0, 255, 255];
const GUIDE: Rgba = [217, 194, 240, 255];
const FUR: Rgba = [120, 110, 100, 255];
const RED: Rgba = [200, 30, 30, 255];

/** A rat as a block on the key colour, standing at `x`, `y`, on a cell the size the sheets have. */
function sheetWith(colour: Rgba, x: number, y: number) {
  const cell = blank(440, 440, KEY);
  paint(cell, { x0: x, y0: y, x1: x + 220, y1: y + 260 }, colour);
  return cell;
}

describe('the layers of a player\'s rat', () => {
  it('tell the pale guide from white, pink and purple', () => {
    expect(isGuide(217, 194, 240)).toBe(true);
    expect(isGuide(248, 248, 248)).toBe(false);
    expect(isGuide(240, 160, 160)).toBe(false);
    expect(isGuide(128, 64, 192)).toBe(false);
  });

  it('find where a guide drawn elsewhere on its cell stands over the reference rat', () => {
    const reference = sheetWith(FUR, 100, 140);
    const layer = sheetWith(GUIDE, 140, 100);
    const at = placeOver(layer, true, referenceShape(reference), { width: 440, height: 440 });
    expect(at.s).toBeCloseTo(1, 1);
    expect(Math.abs(at.dx + 40)).toBeLessThanOrEqual(4);
    expect(Math.abs(at.dy - 40)).toBeLessThanOrEqual(4);
  });

  it('keep only what is drawn over the guide, where the reference rat stands', () => {
    const layer = sheetWith(GUIDE, 100, 140);
    paint(layer, { x0: 100, y0: 120, x1: 320, y1: 180 }, RED);
    const sprite = layerSprite(layer, true, { s: 1, dx: 0, dy: 0 }, { width: 440, height: 440 }, 64, 64);
    const colours = new Set<string>();
    for (let p = 0; p < sprite.data.length; p += 4) if (sprite.data[p + 3]) colours.add(`${sprite.data[p]},${sprite.data[p + 1]},${sprite.data[p + 2]}`);
    expect([...colours]).toEqual(['200,30,30']);
  });
});
