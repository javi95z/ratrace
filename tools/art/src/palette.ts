import { blank } from './image';
import type { Image, Rgb } from './image';

type Lab = readonly [number, number, number];

const linear = (channel: number): number => {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
};

/** sRGB to OKLab, a colour space in which equal distances look like equal differences. */
export function toOklab([r, g, b]: Rgb): Lab {
  const lr = linear(r);
  const lg = linear(g);
  const lb = linear(b);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

/**
 * Hue and saturation count for more than lightness. Without this a dark green snaps to black
 * and a tanned skin tone snaps to gold, which changes what the picture shows.
 */
const CHROMA_WEIGHT = 3;

const distance2 = (a: Lab, b: Lab): number => {
  const dl = a[0] - b[0];
  const da = a[1] - b[1];
  const db = a[2] - b[2];
  return dl * dl + CHROMA_WEIGHT * (da * da + db * db);
};

function nearestLab(lab: Lab, palette: readonly Lab[]): { index: number; d2: number } {
  let index = 0;
  let d2 = Infinity;
  for (let i = 0; i < palette.length; i++) {
    const d = distance2(lab, palette[i]);
    if (d < d2) {
      d2 = d;
      index = i;
    }
  }
  return { index, d2 };
}

/** Index of the palette colour that looks closest to `colour`. */
export function nearest(colour: Rgb, palette: readonly Rgb[]): number {
  return nearestLab(toOklab(colour), palette.map(toOklab)).index;
}

/** Replaces every opaque pixel with the nearest palette colour. Clear pixels are left alone. */
export function snap(image: Image, palette: readonly Rgb[]): Image {
  const labs = palette.map(toOklab);
  const cache = new Map<number, number>();
  const out = blank(image.width, image.height);
  for (let i = 0; i < image.width * image.height; i++) {
    const p = i * 4;
    if (image.data[p + 3] === 0) continue;
    const key = (image.data[p] << 16) | (image.data[p + 1] << 8) | image.data[p + 2];
    let index = cache.get(key);
    if (index === undefined) {
      index = nearestLab(toOklab([image.data[p], image.data[p + 1], image.data[p + 2]]), labs).index;
      cache.set(key, index);
    }
    out.data[p] = palette[index][0];
    out.data[p + 1] = palette[index][1];
    out.data[p + 2] = palette[index][2];
    out.data[p + 3] = 255;
  }
  return out;
}

interface Bin {
  r: number;
  g: number;
  b: number;
  count: number;
}

/** Counts colours, grouping those that differ only in the low three bits of each channel. */
export class Histogram {
  private readonly bins = new Map<number, Bin>();

  add(r: number, g: number, b: number, count = 1): void {
    const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
    const bin = this.bins.get(key);
    if (bin) {
      bin.r += r * count;
      bin.g += g * count;
      bin.b += b * count;
      bin.count += count;
    } else {
      this.bins.set(key, { r: r * count, g: g * count, b: b * count, count });
    }
  }

  addImage(image: Image): void {
    for (let p = 0; p < image.data.length; p += 4) {
      if (image.data[p + 3] !== 0) this.add(image.data[p], image.data[p + 1], image.data[p + 2]);
    }
  }

  /** Mean colour and count of every group, in a stable order. */
  entries(): Array<{ colour: Rgb; count: number }> {
    return [...this.bins.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([, bin]) => ({
        colour: [Math.round(bin.r / bin.count), Math.round(bin.g / bin.count), Math.round(bin.b / bin.count)] as const,
        count: bin.count,
      }));
  }
}

/** A colour closer than this to the palette is treated as already covered. */
const COVERED = 0.02 * 0.02;

/**
 * Extends a fixed palette with up to `extra` colours taken from the art.
 * Each step adds the colour whose pixels the palette currently serves worst, weighted by how many there are.
 * The added colours are then moved to the mean of the pixels they serve. Fixed colours never move.
 */
export function buildPalette(fixed: readonly Rgb[], histogram: Histogram, extra: number): Rgb[] {
  const entries = histogram.entries().map((e) => ({ ...e, lab: toOklab(e.colour) }));
  const palette: Rgb[] = [...fixed];

  for (let step = 0; step < extra; step++) {
    const labs = palette.map(toOklab);
    let worst = -1;
    let worstMass = 0;
    entries.forEach((entry, i) => {
      const { d2 } = nearestLab(entry.lab, labs);
      if (d2 <= COVERED) return;
      const mass = d2 * entry.count;
      if (mass > worstMass) {
        worstMass = mass;
        worst = i;
      }
    });
    if (worst < 0) break;
    palette.push(entries[worst].colour);
  }

  for (let pass = 0; pass < 8; pass++) {
    const labs = palette.map(toOklab);
    const sums = palette.map(() => ({ r: 0, g: 0, b: 0, count: 0 }));
    for (const entry of entries) {
      const sum = sums[nearestLab(entry.lab, labs).index];
      sum.r += entry.colour[0] * entry.count;
      sum.g += entry.colour[1] * entry.count;
      sum.b += entry.colour[2] * entry.count;
      sum.count += entry.count;
    }
    for (let i = fixed.length; i < palette.length; i++) {
      const sum = sums[i];
      if (sum.count > 0) {
        palette[i] = [Math.round(sum.r / sum.count), Math.round(sum.g / sum.count), Math.round(sum.b / sum.count)];
      }
    }
  }
  return palette;
}

/** Each group's palette with the colours it is given added where it lacks them; groups given none are left as they are. */
export function withGiven(palettes: Readonly<Record<string, readonly Rgb[]>>, given: Readonly<Record<string, readonly Rgb[]>>): Record<string, Rgb[]> {
  const same = (a: Rgb, b: Rgb) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
  const out: Record<string, Rgb[]> = {};
  for (const [group, palette] of Object.entries(palettes)) {
    const colours = [...palette];
    for (const colour of given[group] ?? []) if (!colours.some((c) => same(c, colour))) colours.push(colour);
    out[group] = colours;
  }
  return out;
}
