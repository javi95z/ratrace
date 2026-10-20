import { expect, test } from 'vitest';
import { differences, groundOf, inkOf, type Image } from './kitCompare';

const NIGHT = [0x14, 0x1b, 0x33];
const GOLD = [0xf2, 0xc1, 0x4e];

/** A w x h image of night with gold columns at `golds`. */
function image(w: number, h: number, golds: number[]): Image {
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data.set([...(golds.includes(x) ? GOLD : NIGHT), 255], (y * w + x) * 4);
  return { width: w, height: h, data };
}

test('an edge a device pixel off is not beyond; a point (3 device pixels) off it is beyond but not loose; further it is loose', () => {
  const web = image(20, 4, [5, 6, 7]);
  expect(differences(web, image(20, 4, [5, 6, 7]), 0, 4).raw).toBe(0);
  const one = differences(web, image(20, 4, [6, 7, 8]), 0, 4);
  expect(one.raw).toBeGreaterThan(0);
  expect(one.beyond).toBe(0);
  const three = differences(web, image(20, 4, [8, 9, 10]), 0, 4);
  expect(three.beyond).toBeGreaterThan(0);
  expect(three.loose).toBe(0);
  expect(differences(web, image(20, 4, [12, 13, 14]), 0, 4).loose).toBeGreaterThan(0);
});

test('a line on its own small fill (a Tag) is measured by its glyphs, not by the window round it', () => {
  // 30 × 30 device pixels of ground; a teal tag from (5, 10) to (25, 20); cream glyphs from (9, 12) to (21, 18).
  const TEAL = [0x1f, 0x6f, 0x66];
  const CREAM = [0xf4, 0xf1, 0xe4];
  const draw = (dx: number): Image => {
    const w = 30;
    const data = new Uint8Array(w * w * 4);
    for (let y = 0; y < w; y++) {
      for (let x = 0; x < w; x++) {
        const tag = x >= 5 && x < 25 && y >= 10 && y < 20;
        const glyph = x >= 9 + dx && x < 21 + dx && y >= 12 && y < 18 && (x + y) % 2 === 0;
        data.set([...(glyph ? CREAM : tag ? TEAL : NIGHT), 255], (y * w + x) * 4);
      }
    }
    return { width: w, height: w, data };
  };
  // The line's box (in points, at 1×) is the tag's inside; the window looked in reaches past the tag onto the ground.
  const box = { x: 7, y: 11, w: 16, h: 8, text: '+120 $', color: CREAM as [number, number, number], opacity: 1 };
  const same = inkOf(draw(0), draw(0), [box], 1, 0, 30);
  expect(same.checks[0].web).toEqual([9, 12, 21, 18]);
  expect(same.checks[0].unmeasured).toBeUndefined();
  // The mask is the glyphs and a pixel round them, never the tag's whole window.
  expect(same.mask[5 * 30 + 15]).toBe(0);
  expect(same.mask[15 * 30 + 6]).toBe(0);
  const moved = inkOf(draw(0), draw(2), [box], 1, 0, 30);
  expect(moved.checks[0].apart).toBe(2);
});

test('ink that fills its whole window is reported unmeasured, not as text in place', () => {
  const w = 10;
  const data = new Uint8Array(w * w * 4);
  for (let i = 0; i < w * w; i++) data.set([...GOLD, 255], i * 4);
  const img = { width: w, height: w, data };
  const { checks } = inkOf(img, img, [{ x: 3, y: 4, w: 4, h: 2, text: 'x', color: GOLD as [number, number, number], opacity: 1 }], 1, 0, 10);
  expect(checks[0].unmeasured).toBe(true);
});

test('a dot on the ground is ground; a night-700 fill, the dot\'s colour, is ground only where a dot would be', () => {
  const w = 36;
  const fill = new Uint8Array(w * w * 4);
  for (let i = 0; i < w * w; i++) fill.set([0x1f, 0x2a, 0x4d, 255], i * 4);
  const g = groundOf({ width: w, height: w, data: fill });
  // The middle of the first 18-pixel tile is a dot's place; its corner is not.
  expect(g[9 * w + 9]).toBe(1);
  expect(g[0]).toBe(0);
  // A disc of radius 4 device pixels in each 18 × 18 tile: about a sixth of a fill, never the whole of it.
  expect(g.reduce((n, v) => n + v, 0) / g.length).toBeLessThan(0.2);
  // Plain night-800 is ground everywhere.
  expect(groundOf(image(w, w, [])).every((v) => v === 1)).toBe(true);
});
