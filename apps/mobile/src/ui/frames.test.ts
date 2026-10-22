import { expect, test } from 'vitest';
import { CREAM, GOLD, WINE, anchorsOf, cutAnchors, resolveAnchor, stripsOf } from './frames';

const covers = (s: { x: number; y: number; w: number; h: number }, px: number, py: number) =>
  px >= s.x && px < s.x + s.w && py >= s.y && py < s.y + s.h;
/** The colour at a pixel: the last strip in the list is drawn on top. */
const at = (strips: ReturnType<typeof stripsOf>, px: number, py: number) =>
  [...strips].reverse().find((s) => covers(s, px, py))?.color;

test('frame is four 2 pt strips, each only as long as its side', () => {
  const s = stripsOf('frame', 100, 40, {});
  expect(s).toHaveLength(4);
  expect(s).toEqual(
    expect.arrayContaining([
      { x: 0, y: -2, w: 100, h: 2, color: 'night-900' },
      { x: 0, y: 40, w: 100, h: 2, color: 'night-900' },
      { x: -2, y: 0, w: 2, h: 40, color: 'night-900' },
      { x: 100, y: 0, w: 2, h: 40, color: 'night-900' },
    ]),
  );
  for (const [px, py] of [[-2, -2], [100, -2], [-2, 40], [100, 40]]) expect(at(s, px, py)).toBeUndefined();
});

test('raised has the drop strip and a 3 pt shaded edge', () => {
  const s = stripsOf('raised', 100, 40, {});
  expect(s).toContainEqual({ x: 2, y: 40, w: 96, h: 4, color: 'night-900' });
  expect(s).toContainEqual({ x: 0, y: 37, w: 100, h: 3, color: 'night-800' });
  expect(s).toContainEqual({ x: 0, y: 0, w: 100, h: 2, color: 'night-500' });
  const gold = stripsOf('raised', 100, 40, GOLD);
  expect(gold).toContainEqual({ x: 2, y: 40, w: 96, h: 4, color: 'gold-900' });
});

test('bevel takes the tone: lit top and left, shaded bottom and right, lit wins the corners', () => {
  const s = stripsOf('bevel', 100, 40, GOLD);
  expect(at(s, 50, 0)).toBe('gold-200');
  expect(at(s, 0, 20)).toBe('gold-200');
  expect(at(s, 50, 39)).toBe('gold-700');
  expect(at(s, 99, 20)).toBe('gold-700');
  expect(at(s, 99, 0)).toBe('gold-200');
  expect(at(s, 0, 39)).toBe('gold-200');
  expect(at(s, 50, -1)).toBe('gold-900');
  expect(at(stripsOf('bevel', 100, 40, {}), 50, 39)).toBe('night-900');
  expect(at(stripsOf('bevel', 100, 40, WINE), 50, 0)).toBe('wine-500');
  expect(at(stripsOf('bevel', 100, 40, CREAM), 50, 0)).toBe('white');
});

test('sunk is night-900 on top and left only', () => {
  const s = stripsOf('sunk', 100, 40, {});
  expect(s).toHaveLength(2);
  expect(at(s, 50, 1)).toBe('night-900');
  expect(at(s, 1, 20)).toBe('night-900');
  expect(at(s, 50, 39)).toBeUndefined();
});

test('lamp is lit on top and shaded underneath', () => {
  const s = stripsOf('lamp', 10, 10, { hi: 'teal-300', lo: 'teal-800' });
  expect(at(s, 5, 0)).toBe('teal-300');
  expect(at(s, 5, 9)).toBe('teal-800');
  expect(at(s, 5, -1)).toBeUndefined();
});

test('double is three rings, corners filled', () => {
  const s = stripsOf('double', 100, 40, {});
  expect(at(s, -6, -6)).toBe('night-900');
  expect(at(s, 105, 45)).toBe('night-900');
  expect(at(s, -3, 20)).toBe('gold-700');
  expect(at(s, -3, -3)).toBe('gold-700');
  expect(at(s, -1, -1)).toBe('night-900');
  expect(at(s, -7, 20)).toBeUndefined();
  expect(at(s, 50, 20)).toBeUndefined();
  expect(at(stripsOf('double', 100, 40, { ring: 'wine-500' }), 50, -3)).toBe('wine-500');
});

test('tab is a night frame with a gold lit top and shaded bottom', () => {
  const s = stripsOf('tab', 100, 40, GOLD);
  expect(at(s, 50, -1)).toBe('night-900');
  expect(at(s, 50, 0)).toBe('gold-200');
  expect(at(s, 50, 39)).toBe('gold-700');
  expect(at(s, -2, -2)).toBeUndefined();
});

test('anchored strips resolve to exactly the strips of stripsOf, for every kind and size', () => {
  const kinds = ['frame', 'bevel', 'sunk', 'raised', 'lamp', 'double', 'tab'] as const;
  for (const kind of kinds)
    for (const tone of [{}, GOLD, CREAM, WINE, { ring: 'wine-500' as const }])
      for (const [w, h] of [[100, 40], [4, 4], [300, 1], [0, 0], [3, 50]])
        expect(anchorsOf(kind, tone).map((a) => resolveAnchor(a, w, h))).toEqual(stripsOf(kind, w, h, tone));
});

test('stripsOf never gives a negative size', () => {
  for (const kind of ['frame', 'bevel', 'sunk', 'raised', 'lamp', 'double', 'tab'] as const)
    for (const s of stripsOf(kind, 3, 0, {})) {
      expect(s.w).toBeGreaterThanOrEqual(0);
      expect(s.h).toBeGreaterThanOrEqual(0);
    }
});

test('a frame cut across stacked boxes: the top box draws the top edge and the sides, a middle one the sides, the bottom one the sides and the bottom edge, and together they are the whole frame', () => {
  for (const kind of ['frame', 'bevel', 'raised', 'lamp', 'tab'] as const) {
    const whole = anchorsOf(kind, GOLD);
    const [top, middle, bottom] = (['top', 'middle', 'bottom'] as const).map((cut) => cutAnchors(whole, cut));
    // Every strip is drawn by the top box or the bottom one; the sides by all three, so stacked they run the whole height.
    expect(new Set([...top, ...bottom]), kind).toEqual(new Set(whole));
    expect(middle, kind).toEqual(top.filter((a) => bottom.includes(a)));
    for (const side of middle) expect(side.height, kind).toBeUndefined();
  }
  // A bevel: the top box has the outline's top and the lit top, never a bottom edge; the bottom box the reverse.
  const bevel = anchorsOf('bevel', {});
  expect(cutAnchors(bevel, 'top').filter((a) => a.bottom !== undefined && a.height !== undefined)).toEqual([]);
  expect(cutAnchors(bevel, 'bottom').filter((a) => a.top !== undefined && a.height !== undefined)).toEqual([]);
  expect(cutAnchors(bevel, 'middle')).toHaveLength(4);
});
