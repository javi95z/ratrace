import { expect, test } from 'vitest';
import { differences, type Image } from './kitCompare';

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
