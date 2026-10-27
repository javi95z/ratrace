import { describe, expect, it } from 'vitest';
import { blank, paint, pixel } from './image';
import type { Rgb } from './image';
import { GIVEN_COLOURS } from './fixed-palette';
import { buildPalette, Histogram, nearest, snap, toOklab, withGiven } from './palette';

const NAVY: Rgb = [20, 27, 51];
const CREAM: Rgb = [244, 241, 228];
const GOLD: Rgb = [242, 193, 78];

describe('palette', () => {
  it('measures colour the way the eye does', () => {
    const [whiteL, whiteA, whiteB] = toOklab([255, 255, 255]);
    expect(whiteL).toBeCloseTo(1, 3);
    expect(whiteA).toBeCloseTo(0, 3);
    expect(whiteB).toBeCloseTo(0, 3);
    expect(toOklab([0, 0, 0])[0]).toBeCloseTo(0, 5);
    expect(toOklab([255, 0, 0])[1]).toBeGreaterThan(0.2);
  });

  it('finds the nearest palette colour', () => {
    const palette = [NAVY, CREAM, GOLD];
    expect(nearest([250, 250, 240], palette)).toBe(1);
    expect(nearest([10, 10, 40], palette)).toBe(0);
    expect(nearest([230, 180, 60], palette)).toBe(2);
  });

  it('snaps opaque pixels to the palette and leaves clear ones alone', () => {
    const image = blank(2, 1);
    paint(image, { x0: 0, y0: 0, x1: 1, y1: 1 }, [238, 190, 70, 255]);
    const snapped = snap(image, [NAVY, CREAM, GOLD]);
    expect(pixel(snapped, 0, 0)).toEqual([...GOLD, 255]);
    expect(pixel(snapped, 1, 0)).toEqual([0, 0, 0, 0]);
  });

  it('adds the colours the fixed palette serves worst, most used first', () => {
    const histogram = new Histogram();
    histogram.add(200, 30, 30, 500);
    histogram.add(20, 28, 52, 9_000);
    histogram.add(30, 150, 60, 300);
    histogram.add(245, 240, 228, 4_000);
    const palette = buildPalette([NAVY, CREAM], histogram, 2);
    expect(palette.slice(0, 2)).toEqual([NAVY, CREAM]);
    expect(palette).toHaveLength(4);
    expect(nearest([200, 30, 30], palette)).toBe(2);
    expect(nearest([30, 150, 60], palette)).toBe(3);
    expect(palette[2][0]).toBeGreaterThan(180);
    expect(palette[3][1]).toBeGreaterThan(130);
  });

  it('adds nothing when the fixed palette already covers every colour', () => {
    const histogram = new Histogram();
    histogram.add(20, 27, 51, 100);
    expect(buildPalette([NAVY, CREAM], histogram, 5)).toEqual([NAVY, CREAM]);
  });

  it('builds the same palette every time', () => {
    const fill = () => {
      const h = new Histogram();
      for (let i = 0; i < 300; i++) h.add((i * 37) % 256, (i * 91) % 256, (i * 53) % 256, 1 + (i % 7));
      return h;
    };
    expect(buildPalette([NAVY], fill(), 12)).toEqual(buildPalette([NAVY], fill(), 12));
  });
});

describe('colours a group is given beyond those taken from its art', () => {
  it('adds each one the group lacks, keeps those it has, and leaves the other groups as they are', () => {
    const orange: Rgb = [228, 100, 40];
    const palettes = { cards: [[0, 0, 0] as Rgb], items: [[0, 0, 0] as Rgb] };
    const given = withGiven(palettes, { cards: [orange, [0, 0, 0]] });
    expect(given.cards).toEqual([[0, 0, 0], orange]);
    expect(given.items).toEqual([[0, 0, 0]]);
  });

  it('gives the cards a prison jumpsuit orange their art alone does not bring', () => {
    const jumpsuit: Rgb = [228, 100, 40];
    const cards = GIVEN_COLOURS.cards ?? [];
    expect(cards[nearest(jumpsuit, cards)]).toEqual(jumpsuit);
  });
});
