import { join } from 'node:path';

/** The sections of the kit page, in their order: the same list as apps/mobile/src/app/kit.tsx and the web's kit/page.tsx. */
export const SECTIONS = ['buttons', 'surfaces', 'stats', 'bars', 'choices', 'lists', 'sheet-gold', 'sheet-wine', 'tabs', 'art', 'text-es', 'text-ru', 'type', 'dots'] as const;
export type Section = (typeof SECTIONS)[number];

/** The screen of the comparison: an iPhone 16 Pro, in points, its density, and the safe areas left out (the status bar, the home indicator). */
export const SCREEN = { width: 402, height: 874, scale: 3, top: 62, bottom: 34 } as const;

/**
 * What counts as the same pixel. A *shade* is 24 levels of 255 on the channel that differs most (night-800 and night-700,
 * the two closest colours of the palette, are 26 apart on blue, so no two tokens are within a shade of each other).
 * A *pixel* is one device pixel (a third of a point): a pixel of one shot that matches, within a shade, a pixel of the
 * other at most this far away is the same edge drawn by another rasteriser, not a difference.
 */
export const SHADE = 24;
export const REACH = 1;
/**
 * A point (3 device pixels), the web's own pixel: Chrome puts the edges of boxes on whole CSS pixels, the phone on
 * device pixels, so the same box can stand up to this far apart. What is still unmatched a point away is a
 * difference of shape, colour or place.
 */
export const LOOSE = 3;

export interface Image {
  width: number;
  height: number;
  /** RGBA, 4 bytes a pixel. */
  data: Uint8Array;
}

const at = (img: Image, x: number, y: number) => (y * img.width + x) * 4;

function distance(a: Image, i: number, b: Image, j: number): number {
  return Math.max(Math.abs(a.data[i] - b.data[j]), Math.abs(a.data[i + 1] - b.data[j + 1]), Math.abs(a.data[i + 2] - b.data[j + 2]));
}

/** The ground: night-800 and night-700 and the blends of the two that the dots are drawn in. */
function ground(img: Image, i: number): boolean {
  const [r, g, b] = [img.data[i], img.data[i + 1], img.data[i + 2]];
  return r >= 0x10 && r <= 0x23 && g >= 0x17 && g <= 0x2e && b >= 0x2f && b <= 0x51;
}

/** Whether pixel (x, y) of `a` has a pixel within a shade in `b`, at most `reach` device pixels away. */
function near(a: Image, b: Image, x: number, y: number, reach: number): boolean {
  const i = at(a, x, y);
  for (let dy = -reach; dy <= reach; dy++) {
    const yy = y + dy;
    if (yy < 0 || yy >= b.height) continue;
    for (let dx = -reach; dx <= reach; dx++) {
      const xx = x + dx;
      if (xx < 0 || xx >= b.width) continue;
      const j = at(b, xx, yy);
      // The ground's dot and the ground between dots are one surface: a box an edge's width off uncovers a dot or
      // hides one, which is the box's place (measured), not a difference of the ground (the dots section is).
      if (distance(a, i, b, j) <= SHADE || (ground(a, i) && ground(b, j))) return true;
    }
  }
  return false;
}

export interface Difference {
  /** Pixels compared (the screen between the safe areas). */
  total: number;
  /** Pixels not exactly alike (more than 8 levels apart). */
  raw: number;
  /** Pixels with nothing within a shade in the other shot within a pixel's reach, either way. */
  beyond: number;
  /** Of those, the pixels with nothing within a shade even a point and a device pixel away. */
  loose: number;
  /** For each pixel: 0 alike, 1 raw only, 2 beyond, 3 beyond even loosely (4 once found to be a glyph's edge). */
  map: Uint8Array;
}

/** Compares two shots of the same size between rows `from` and `to` (device pixels). */
export function differences(a: Image, b: Image, from: number, to: number, reach = REACH): Difference {
  if (a.width !== b.width || a.height !== b.height) throw new Error(`sizes differ: ${a.width}×${a.height} and ${b.width}×${b.height}`);
  const map = new Uint8Array(a.width * a.height);
  let raw = 0;
  let beyond = 0;
  let loose = 0;
  for (let y = from; y < to; y++) {
    for (let x = 0; x < a.width; x++) {
      const i = at(a, x, y);
      const d = distance(a, i, b, i);
      if (d <= 8) continue;
      raw++;
      if (d > SHADE && (!near(a, b, x, y, reach) || !near(b, a, x, y, reach))) {
        beyond++;
        const far = !near(a, b, x, y, LOOSE) || !near(b, a, x, y, LOOSE);
        if (far) loose++;
        map[y * a.width + x] = far ? 3 : 2;
      } else map[y * a.width + x] = 1;
    }
  }
  return { total: (to - from) * a.width, raw, beyond, loose, map };
}

/** The rows that hold something other than the ground, in either shot, with a margin: what is cropped for the report. */
export function contentRows(a: Image, b: Image, from: number, to: number, margin: number): [number, number] {
  let first = -1;
  let last = -1;
  for (let y = from; y < to; y++) {
    for (let x = 0; x < a.width; x++) {
      const i = at(a, x, y);
      if (!ground(a, i) || !ground(b, i)) {
        if (first < 0) first = y;
        last = y;
        break;
      }
    }
  }
  if (first < 0) return [from, Math.min(to, from + 120)];
  return [Math.max(from, first - margin), Math.min(to, last + 1 + margin)];
}

/** Where the differences of shape are (unmatched a point away, not text), in points: boxes of 8 pt cells holding at least `min` such pixels, merged by row. */
export function places(d: Difference, width: number, scale: number, min = 6): Array<{ x: number; y: number; w: number; h: number; pixels: number }> {
  const cell = 8 * scale;
  const cols = Math.ceil(width / cell);
  const rows = Math.ceil(d.map.length / width / cell);
  const count = new Uint32Array(cols * rows);
  for (let i = 0; i < d.map.length; i++) if (d.map[i] === 3) count[Math.floor(i / width / cell) * cols + Math.floor((i % width) / cell)]++;
  const boxes: Array<{ x: number; y: number; w: number; h: number; pixels: number }> = [];
  for (let r = 0; r < rows; r++) {
    let c = 0;
    while (c < cols) {
      if (count[r * cols + c] < min) {
        c++;
        continue;
      }
      let end = c;
      let pixels = 0;
      while (end < cols && count[r * cols + end] >= min) pixels += count[r * cols + end++];
      boxes.push({ x: c * 8, y: r * 8, w: (end - c) * 8, h: 8, pixels });
      c = end;
    }
  }
  return boxes;
}

interface Sharp {
  (input: Uint8Array | Buffer, options?: { raw: { width: number; height: number; channels: 4 } }): SharpChain;
}
interface SharpChain {
  ensureAlpha(): SharpChain;
  raw(): SharpChain;
  png(options?: { compressionLevel?: number; palette?: boolean }): SharpChain;
  extract(region: { left: number; top: number; width: number; height: number }): SharpChain;
  toBuffer(options: { resolveWithObject: true }): Promise<{ data: Buffer; info: { width: number; height: number } }>;
  toFile(path: string): Promise<unknown>;
}

/** A line of text on the web page, in points (from the browser: each text node's client rects). */
export interface TextBox {
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
}

/** Where a line's ink stands in each shot, and how far apart, in points (the largest of the four edges). */
export interface TextCheck {
  text: string;
  web: [number, number, number, number] | null;
  app: [number, number, number, number] | null;
  apart: number;
}

/**
 * The ink of each line of text, in both shots: the pixels near the line that are far (more than two shades) from the
 * colour most of the line's box has (its background). Its bounding box in each shot says where the text stands and how
 * big it is, whatever the two rasterisers make of the edges of the glyphs.
 */
export function inkOf(a: Image, b: Image, boxes: readonly TextBox[], scale: number, from: number, to: number): { checks: TextCheck[]; mask: Uint8Array } {
  const mask = new Uint8Array(a.width * a.height);
  const checks: TextCheck[] = [];
  for (const box of boxes) {
    const x0 = Math.max(0, Math.floor((box.x - 1) * scale));
    const x1 = Math.min(a.width, Math.ceil((box.x + box.w + 1) * scale));
    const y0 = Math.max(from, Math.floor((box.y - 3) * scale));
    const y1 = Math.min(to, Math.ceil((box.y + box.h + 3) * scale));
    if (x1 <= x0 || y1 <= y0) continue;
    // The background: the commonest colour inside the line's own box, on the web.
    const counts = new Map<number, number>();
    for (let y = Math.max(y0, Math.floor(box.y * scale)); y < Math.min(y1, Math.ceil((box.y + box.h) * scale)); y++) {
      for (let x = x0; x < x1; x++) {
        const i = at(a, x, y);
        const key = (a.data[i] << 16) | (a.data[i + 1] << 8) | a.data[i + 2];
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
    let ground = 0;
    let most = -1;
    for (const [key, n] of counts) if (n > most) [ground, most] = [key, n];
    const g = [ground >> 16, (ground >> 8) & 255, ground & 255];
    const bbox = (img: Image): [number, number, number, number] | null => {
      let bx0 = Infinity;
      let by0 = Infinity;
      let bx1 = -1;
      let by1 = -1;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const i = at(img, x, y);
          if (Math.max(Math.abs(img.data[i] - g[0]), Math.abs(img.data[i + 1] - g[1]), Math.abs(img.data[i + 2] - g[2])) <= 2 * SHADE) continue;
          bx0 = Math.min(bx0, x);
          by0 = Math.min(by0, y);
          bx1 = Math.max(bx1, x + 1);
          by1 = Math.max(by1, y + 1);
        }
      }
      return bx1 < 0 ? null : [bx0, by0, bx1, by1];
    };
    const wi = bbox(a);
    const ap = bbox(b);
    const pt = (r: [number, number, number, number] | null) => (r ? (r.map((v) => +(v / scale).toFixed(2)) as [number, number, number, number]) : null);
    checks.push({ text: box.text, web: pt(wi), app: pt(ap), apart: wi && ap ? Math.max(...wi.map((v, k) => Math.abs(v - ap[k]))) / scale : wi || ap ? Infinity : 0 });
    // The glyphs and a point round them are text: their edges are the rasterisers' own.
    for (const r of [wi, ap]) {
      if (!r) continue;
      for (let y = Math.max(0, r[1] - scale); y < Math.min(a.height, r[3] + scale); y++) for (let x = Math.max(0, r[0] - scale); x < Math.min(a.width, r[2] + scale); x++) mask[y * a.width + x] = 1;
    }
  }
  return { checks, mask };
}

export interface Result {
  section: Section;
  rawPercent: number;
  beyondPercent: number;
  beyond: number;
  loosePercent: number;
  loose: number;
  /** Pixels unmatched a point away that are not text: differences of shape, colour or place. */
  shape: number;
  /** Each line of text: where its ink stands in each shot. */
  texts: TextCheck[];
  places: ReturnType<typeof places>;
  crop: [number, number];
}

/** Compares a section's two shots and writes its picture: the web, the app and the difference side by side, cropped to what they show. */
export async function compareShots(sharp: unknown, section: Section, webPng: Buffer, appPng: Buffer, boxes: readonly TextBox[], out: string): Promise<Result> {
  const s = sharp as Sharp;
  const decode = async (png: Buffer): Promise<Image> => {
    const { data, info } = await s(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    return { width: info.width, height: info.height, data: new Uint8Array(data) };
  };
  const a = await decode(webPng);
  const b = await decode(appPng);
  const from = SCREEN.top * SCREEN.scale;
  const to = (SCREEN.height - SCREEN.bottom) * SCREEN.scale;
  const d = differences(a, b, from, to);
  const { checks, mask } = inkOf(a, b, boxes, SCREEN.scale, from, to);
  let shape = 0;
  for (let i = 0; i < d.map.length; i++) {
    if (d.map[i] !== 3) continue;
    if (mask[i]) d.map[i] = 4;
    else shape++;
  }
  const [top, bottom] = contentRows(a, b, from, to, 8 * SCREEN.scale);
  const height = bottom - top;
  const w = a.width;
  const gap = 12;
  const side = new Uint8Array((w * 3 + gap * 2) * height * 4).fill(255);
  const sideWidth = w * 3 + gap * 2;
  // The difference: grey where alike, ochre where not exactly, red beyond a pixel and a shade, blue where that is the
  // edge of a glyph (text), magenta where nothing matches even a point away and it is not text.
  const COLOURS: Record<number, number[]> = { 1: [200, 160, 40, 255], 2: [255, 40, 60, 255], 3: [255, 40, 220, 255], 4: [80, 140, 255, 255] };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < w; x++) {
      const i = at(a, x, y + top);
      const put = (col: number, rgba: ArrayLike<number>) => side.set(rgba, (y * sideWidth + col * (w + gap) + x) * 4);
      put(0, a.data.subarray(i, i + 4));
      put(1, b.data.subarray(i, i + 4));
      const kind = d.map[(y + top) * w + x];
      const grey = Math.round((a.data[i] + a.data[i + 1] + a.data[i + 2]) / 9);
      put(2, COLOURS[kind] ?? [grey, grey, grey, 255]);
    }
  }
  await s(side, { raw: { width: sideWidth, height, channels: 4 } })
    .png({ compressionLevel: 9, palette: true })
    .toFile(join(out, `${section}.png`));
  return {
    section,
    rawPercent: (100 * d.raw) / d.total,
    beyondPercent: (100 * d.beyond) / d.total,
    beyond: d.beyond,
    loosePercent: (100 * d.loose) / d.total,
    loose: d.loose,
    shape,
    texts: checks,
    places: places(d, w, SCREEN.scale),
    crop: [top / SCREEN.scale, bottom / SCREEN.scale],
  };
}
