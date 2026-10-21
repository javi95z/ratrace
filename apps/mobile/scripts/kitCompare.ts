import { join } from 'node:path';

/** The sections of the kit page, in their order: the same list as apps/mobile/src/app/kit.tsx and the web's kit/page.tsx. */
export const SECTIONS = ['buttons', 'surfaces', 'stats', 'bars', 'choices', 'lists', 'sheet-gold', 'sheet-wine', 'tabs', 'art', 'text-es', 'text-ru', 'type', 'dots', 'motion-2'] as const;
export type Section = (typeof SECTIONS)[number];

/** The sections phase 2 added to the kit; the others are phase 1's. */
export const PHASE_2_SECTIONS: readonly Section[] = ['motion-2'];

/** The folder under `docs/superpowers/reports` that has a section's picture and its numbers: the report of the phase that added it. */
export const reportFolder = (section: Section): 'phase-1-parity' | 'phase-2-parity' => (PHASE_2_SECTIONS.includes(section) ? 'phase-2-parity' : 'phase-1-parity');

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

/**
 * The ground as a surface: night-800, and the dots on it, at the dots' own places (a disc of radius 1 pt at the middle
 * of each 6 pt tile, counted from the screen's corner, as the web's radial gradient and the app's dots.png draw it).
 * A night-700 fill (a panel, a stat), the dot's colour, is ground only where a dot would be: nine pixels in a hundred.
 */
export function groundOf(img: Image, scale = 3): Uint8Array {
  const { width: w, height: h } = img;
  const tile = 6 * scale;
  const middle = (tile - 1) / 2;
  const reach = (scale + 1) ** 2;
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = at(img, x, y);
      if (!ground(img, i)) continue;
      const night800 = Math.abs(img.data[i] - 0x14) <= 4 && Math.abs(img.data[i + 1] - 0x1b) <= 4 && Math.abs(img.data[i + 2] - 0x33) <= 4;
      const dx = (x % tile) - middle;
      const dy = (y % tile) - middle;
      if (night800 || dx * dx + dy * dy <= reach) out[y * w + x] = 1;
    }
  }
  return out;
}

/**
 * Whether pixel (x, y) of `a` has a pixel within a shade in `b`, at most `reach` device pixels away. Given the two
 * grounds, a dot and the ground between dots are one surface: a box an edge's width off uncovers a dot or hides one,
 * which is the box's place (measured), not a difference of the ground (the dots section is).
 */
function near(a: Image, b: Image, x: number, y: number, reach: number, grounds?: [Uint8Array, Uint8Array]): boolean {
  const i = at(a, x, y);
  const onGround = grounds ? grounds[0][y * a.width + x] === 1 : false;
  for (let dy = -reach; dy <= reach; dy++) {
    const yy = y + dy;
    if (yy < 0 || yy >= b.height) continue;
    for (let dx = -reach; dx <= reach; dx++) {
      const xx = x + dx;
      if (xx < 0 || xx >= b.width) continue;
      const j = at(b, xx, yy);
      if (distance(a, i, b, j) <= SHADE || (onGround && grounds![1][yy * b.width + xx] === 1)) return true;
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
  /** Of those, the pixels with nothing within a shade even a point away. */
  loose: number;
  /** The same two counts with no allowance for the ground's dots: what a box an edge's width off uncovers counts too. */
  beyondPlain: number;
  loosePlain: number;
  /** For each pixel: 0 alike, 1 raw only, 2 beyond, 3 beyond even loosely (4 once found to be a glyph's edge). */
  map: Uint8Array;
}

/** Compares two shots of the same size between rows `from` and `to` (device pixels). */
export function differences(a: Image, b: Image, from: number, to: number, reach = REACH): Difference {
  if (a.width !== b.width || a.height !== b.height) throw new Error(`sizes differ: ${a.width}×${a.height} and ${b.width}×${b.height}`);
  const ga = groundOf(a);
  const gb = groundOf(b);
  const ab: [Uint8Array, Uint8Array] = [ga, gb];
  const ba: [Uint8Array, Uint8Array] = [gb, ga];
  const map = new Uint8Array(a.width * a.height);
  let raw = 0;
  let beyond = 0;
  let loose = 0;
  let beyondPlain = 0;
  let loosePlain = 0;
  for (let y = from; y < to; y++) {
    for (let x = 0; x < a.width; x++) {
      const i = at(a, x, y);
      const d = distance(a, i, b, i);
      if (d <= 8) continue;
      raw++;
      if (d <= SHADE) {
        map[y * a.width + x] = 1;
        continue;
      }
      if (!near(a, b, x, y, reach) || !near(b, a, x, y, reach)) {
        beyondPlain++;
        if (!near(a, b, x, y, LOOSE) || !near(b, a, x, y, LOOSE)) loosePlain++;
      }
      if (!near(a, b, x, y, reach, ab) || !near(b, a, x, y, reach, ba)) {
        beyond++;
        const far = !near(a, b, x, y, LOOSE, ab) || !near(b, a, x, y, LOOSE, ba);
        if (far) loose++;
        map[y * a.width + x] = far ? 3 : 2;
      } else map[y * a.width + x] = 1;
    }
  }
  return { total: (to - from) * a.width, raw, beyond, loose, beyondPlain, loosePlain, map };
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

/** A line of text on the web page, in points (from the browser: each text node's client rects), with its glyphs' colour. */
export interface TextBox {
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
  /** The text's computed colour, and the opacity of it and every box round it. */
  color: [number, number, number];
  opacity: number;
  /** The fill of the nearest box behind it that has one (seen through the same opacity), when the opacity is under 1. */
  back?: [number, number, number];
  /** Something is drawn over it (a sheet's backdrop): its colour is not the one computed, and it is not measured. */
  covered?: boolean;
}

/** The dark grounds and fills text stands on (night-900 to night-600): a glyph's edge on them is a blend of its colour with one of these. */
const DARK_GROUNDS: ReadonlyArray<readonly [number, number, number]> = [
  [0x0b, 0x10, 0x22],
  [0x14, 0x1b, 0x33],
  [0x1f, 0x2a, 0x4d],
  [0x26, 0x35, 0x66],
];

/** How near a pixel must be to the glyphs' colour to be their ink: a glyph's inside is drawn in it exactly; ink-900 and night-900, the closest two text and frame colours, are 15 apart. */
export const INK = 10;

/** Where a line's ink stands in each shot, and how far apart, in points (the largest of the four edges). */
export interface TextCheck {
  text: string;
  web: [number, number, number, number] | null;
  app: [number, number, number, number] | null;
  apart: number;
  /** The ink filled the whole window it was looked for in: it was not told from what is round it. */
  unmeasured?: boolean;
}

/**
 * The ink of each line of text, in both shots: the pixels near the line (and in no other line's box) within `INK` of the colour its glyphs are
 * drawn in (the computed colour, seen through the opacity of the boxes round it over the line's background). Its
 * bounding box in each shot says where the text stands and how big it is, whatever the two rasterisers make of the
 * glyphs' edges; a Tag's fill or the ground round a tab is never ink. The mask returned is the glyphs' own pixels and
 * a point round them, in either shot: what is left to the rasterisers.
 */
export function inkOf(a: Image, b: Image, boxes: readonly TextBox[], scale: number, from: number, to: number): { checks: TextCheck[]; mask: Uint8Array } {
  const mask = new Uint8Array(a.width * a.height);
  const checks: TextCheck[] = [];
  // Each line's own box, in device pixels: a pixel in another line's box is that line's ink, not this one's, wherever this one's colour could be
  // that line's (its colour, or an edge of its glyphs: a blend of it with the dark grounds and fills the game's text stands on, or its own
  // background). Where it could not, a pixel is told by its colour: the descenders of a gold name that reach into the box of the cream line under
  // it (the two boxes overlap) are the name's, and would otherwise be nobody's ink, their edges counted as shape.
  const own = boxes.map((o) => [Math.floor(o.x * scale), Math.floor(o.y * scale), Math.ceil((o.x + o.w) * scale), Math.ceil((o.y + o.h) * scale)]);
  const shares = Array.from({ length: 21 }, (_, i) => i / 20);
  const couldBe = (k: number, n: number) =>
    [...DARK_GROUNDS, ...(boxes[n].back ? [boxes[n].back] : [])].some((ground) =>
      shares.some((share) => Math.max(...[0, 1, 2].map((c) => Math.abs(boxes[k].color[c] - (ground[c] + share * (boxes[n].color[c] - ground[c]))))) <= INK),
    );
  // A line something is drawn over (`covered`: the page under the fixed bar of the next step, or under a sheet's backdrop) is not drawn in its colour
  // where it is covered, so its box claims nothing: the bar's own figure over a button of the page under it is the figure's.
  // And the rects of one line (its words and the ellipsis that cuts them short: the same words, the same colour, on the same line) are one line's. (The
  // lines of a paragraph that wraps are rects of one text too, but each is a line of its own, kept from the ink of the next.)
  const sameLine = (k: number, n: number) => boxes[n].text === boxes[k].text && boxes[n].color.every((c, i) => c === boxes[k].color[i]) && Math.abs(boxes[n].y - boxes[k].y) < 1 && Math.abs(boxes[n].h - boxes[k].h) < 1;
  const ambiguous = boxes.map((_, k) => boxes.map((other, n) => n !== k && other.covered !== true && !sameLine(k, n) && couldBe(k, n)));
  const inOther = (k: number, x: number, y: number) => own.some((r, n) => ambiguous[k][n] && x >= r[0] && x < r[2] && y >= r[1] && y < r[3]);
  for (const [k, box] of boxes.entries()) {
    if (box.covered) {
      checks.push({ text: box.text, web: null, app: null, apart: 0, unmeasured: true });
      continue;
    }
    const x0 = Math.max(0, Math.floor((box.x - 1) * scale));
    const x1 = Math.min(a.width, Math.ceil((box.x + box.w + 1) * scale));
    const y0 = Math.max(from, Math.floor((box.y - 3) * scale));
    const y1 = Math.min(to, Math.ceil((box.y + box.h + 3) * scale));
    if (x1 <= x0 || y1 <= y0) continue;
    let ink = box.color;
    if (box.opacity < 1) {
      // Seen through a box at this opacity: over the line's background, the commonest colour in its own box on the web.
      const counts = new Map<number, number>();
      for (let y = Math.max(y0, Math.floor(box.y * scale)); y < Math.min(y1, Math.ceil((box.y + box.h) * scale)); y++) {
        for (let x = x0; x < x1; x++) {
          const i = at(a, x, y);
          const key = (a.data[i] << 16) | (a.data[i + 1] << 8) | a.data[i + 2];
          counts.set(key, (counts.get(key) ?? 0) + 1);
        }
      }
      let back = 0;
      let most = -1;
      for (const [key, n] of counts) if (n > most) [back, most] = [key, n];
      // That commonest colour is the box's own fill seen through the opacity: op·fill + (1 − op)·behind. The glyphs
      // are op·colour + (1 − op)·behind, that is, the commonest colour plus op·(colour − fill).
      const seen = [back >> 16, (back >> 8) & 255, back & 255];
      const fill = box.back ?? seen;
      ink = box.color.map((c, k) => Math.round(seen[k] + box.opacity * (c - fill[k]))) as [number, number, number];
    }
    const find = (img: Image) => {
      const pixels: number[] = [];
      let r: [number, number, number, number] | null = null;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const i = at(img, x, y);
          if (Math.max(Math.abs(img.data[i] - ink[0]), Math.abs(img.data[i + 1] - ink[1]), Math.abs(img.data[i + 2] - ink[2])) > INK) continue;
          if (inOther(k, x, y)) continue;
          pixels.push(y * img.width + x);
          r = r ? [Math.min(r[0], x), Math.min(r[1], y), Math.max(r[2], x + 1), Math.max(r[3], y + 1)] : [x, y, x + 1, y + 1];
        }
      }
      return { r, pixels };
    };
    const wi = find(a);
    const ap = find(b);
    const pt = (r: [number, number, number, number] | null) => (r ? (r.map((v) => +(v / scale).toFixed(2)) as [number, number, number, number]) : null);
    // Ink that touches three sides of the window is not glyphs but a fill of the text's colour round them.
    const filled = (r: [number, number, number, number] | null) => r !== null && [r[0] === x0, r[1] === y0, r[2] === x1, r[3] === y1].filter(Boolean).length >= 3;
    const check: TextCheck = {
      text: box.text,
      web: pt(wi.r),
      app: pt(ap.r),
      apart: wi.r && ap.r ? Math.max(...wi.r.map((v, k) => Math.abs(v - ap.r![k]))) / scale : wi.r || ap.r ? Infinity : 0,
    };
    if (filled(wi.r) || filled(ap.r) || !wi.r) check.unmeasured = true;
    checks.push(check);
    if (check.unmeasured) continue;
    // The glyphs' own pixels and a point round them: their edges are the rasterisers' own.
    for (const p of [...wi.pixels, ...ap.pixels]) {
      const px = p % a.width;
      const py = Math.floor(p / a.width);
      for (let y = Math.max(0, py - scale); y <= Math.min(a.height - 1, py + scale); y++) for (let x = Math.max(0, px - scale); x <= Math.min(a.width - 1, px + scale); x++) mask[y * a.width + x] = 1;
    }
  }
  return { checks, mask };
}

/**
 * Of the pixels the map calls different even a point away (3), how many are an antialiased edge: a pixel of one shot whose colour
 * is a blend, in some share, of two colours that stand within a point of it in the other shot. That is what Chrome draws at the
 * fractional edge of a transformed box, where a layer of the phone has its edge on a whole device pixel.
 */
export function blendedEdges(a: Image, b: Image, map: Uint8Array, reach = LOOSE): { of: number; explained: number } {
  let of = 0;
  let explained = 0;
  const colour = (img: Image, x: number, y: number) => {
    const i = at(img, x, y);
    return [img.data[i], img.data[i + 1], img.data[i + 2]];
  };
  const shares = Array.from({ length: 21 }, (_, k) => k / 20);
  for (let y = 0; y < a.height; y++) {
    for (let x = 0; x < a.width; x++) {
      if (map[y * a.width + x] !== 3) continue;
      of++;
      // Each shot's pixel that has no colour like it within reach in the other is the one in question (the other way
      // round it is matched, or the map would not call it different).
      let found = true;
      for (const [mine, other] of [[a, b], [b, a]] as const) {
        const p = colour(mine, x, y);
        const near = new Map<number, number[]>();
        for (let yy = Math.max(0, y - reach); yy <= Math.min(other.height - 1, y + reach); yy++) {
          for (let xx = Math.max(0, x - reach); xx <= Math.min(other.width - 1, x + reach); xx++) {
            const c = colour(other, xx, yy);
            near.set((c[0] << 16) | (c[1] << 8) | c[2], c);
          }
        }
        const list = [...near.values()];
        const within = (q: number[]) => Math.max(...[0, 1, 2].map((k) => Math.abs(p[k] - q[k]))) <= SHADE;
        if (list.some(within)) continue;
        found = found && list.some((c1) => list.some((c2) => shares.some((s) => within([0, 1, 2].map((k) => c1[k] * s + c2[k] * (1 - s))))));
      }
      if (found) explained++;
    }
  }
  return { of, explained };
}

export interface Result {
  /** The kit's section, or the name of the scene (`scene-shots.ts` compares those too). */
  section: string;
  rawPercent: number;
  beyondPercent: number;
  beyond: number;
  loosePercent: number;
  loose: number;
  /** Beyond and a point away with no allowance for the ground's dots. */
  beyondPlain: number;
  loosePlain: number;
  /** Pixels unmatched a point away that are not text: differences of shape, colour or place. */
  shape: number;
  /** Of those, how many are an antialiased edge (see `blendedEdges`); the rest, if any, are real differences. */
  shapeBlended?: number;
  /** Each line of text: where its ink stands in each shot. */
  texts: TextCheck[];
  places: ReturnType<typeof places>;
  crop: [number, number];
}

/**
 * More than this share of the screen unlike is not a difference to list: the app showed something else (a red box, a
 * reload, a screen not yet ported), and the numbers of such a comparison say nothing about the screen.
 */
export const WRONG_PAGE_PERCENT = 50;

/** The reason a comparison must not be read as numbers, or null. `kind` is what was shot (`kit`, `scene`); `appShot` is where to look. The kit's shots and the scenes' share it. */
export function wrongPage(result: Result, kind: string, appShot: string): string | null {
  return result.rawPercent > WRONG_PAGE_PERCENT ? `${result.section}: the app's shot is not the ${kind} (${result.rawPercent.toFixed(0)} % unlike); look at ${appShot}` : null;
}

/** What the text of a comparison comes to: the lines found, those not measured, those found in one shot only (text the app does not draw, or draws elsewhere altogether), and how far apart the rest stand (pt). */
export function textSummary(result: Result): { lines: number; unmeasured: number; oneSided: number; worstPt: number } {
  const measured = result.texts.filter((text) => !text.unmeasured);
  const both = measured.filter((text) => Number.isFinite(text.apart));
  return {
    lines: result.texts.length,
    unmeasured: result.texts.length - measured.length,
    oneSided: measured.length - both.length,
    worstPt: both.reduce((worst, text) => Math.max(worst, text.apart), 0),
  };
}

/** How far text may stand apart, in points: phase 1's tolerance (shapes have none). */
export const TEXT_WITHIN_PT = 1;

/** What a comparison says: `wrong page` (not to be read), `clean` (no shape differs, no text in one shot only, every line within a point) or `differs` (read the numbers). */
export function verdictOf(result: Result): 'wrong page' | 'clean' | 'differs' {
  if (result.rawPercent > WRONG_PAGE_PERCENT) return 'wrong page';
  const text = textSummary(result);
  return result.shape === 0 && text.oneSided === 0 && text.worstPt <= TEXT_WITHIN_PT ? 'clean' : 'differs';
}

/**
 * Compares a section's two shots and writes its picture: the web, the app and the difference side by side, cropped to what
 * they show. The picture is `<section>.png` in `out`, or `file` where the caller names it (a scene's is `<name>-diff.png`).
 */
export async function compareShots(sharp: unknown, section: string, webPng: Buffer, appPng: Buffer, boxes: readonly TextBox[], out: string, file = `${section}.png`): Promise<Result> {
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
  const blends = blendedEdges(a, b, d.map);
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
    .toFile(join(out, file));
  return {
    section,
    rawPercent: (100 * d.raw) / d.total,
    beyondPercent: (100 * d.beyond) / d.total,
    beyond: d.beyond,
    loosePercent: (100 * d.loose) / d.total,
    loose: d.loose,
    beyondPlain: d.beyondPlain,
    loosePlain: d.loosePlain,
    shape,
    shapeBlended: blends.explained,
    texts: checks,
    places: places(d, w, SCREEN.scale),
    crop: [top / SCREEN.scale, bottom / SCREEN.scale],
  };
}
