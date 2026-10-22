import manifest from '../sprites/manifest.json';
import type { ColorToken } from './theme';

type Manifest = Record<string, { src: string; w: number; h: number }>;
const sprites = manifest as Manifest;

export type SpriteScale = 1 | 2 | 3 | 'art';
export type Size = { w: number; h: number };

/** The size a sprite is drawn at by default when it does not exist (the web's). */
export const FALLBACK: Size = { w: 32, h: 32 };

/** A sprite's size in art pixels, or null when the manifest does not know it. */
export function spriteOf(id: string): { src: string; w: number; h: number } | null {
  return Object.hasOwn(sprites, id) ? sprites[id] : null;
}

/**
 * The box a sprite takes, in points: its art size (or the fallback when it does not exist) times the scale,
 * where `'art'` is the stage's own scale (the web's `--art`: one on a phone, two where there is room).
 */
export function spriteBox(id: string, scale: SpriteScale, art: number, fallback: Size = FALLBACK): Size {
  const size = spriteOf(id) ?? fallback;
  const times = scale === 'art' ? art : scale;
  return { w: size.w * times, h: size.h * times };
}

/** Sprite ids already reported, so each is logged once. */
const reported = new Set<string>();

export function reportMissing(id: string, why: 'missing' | 'did not load'): void {
  if (reported.has(id)) return;
  reported.add(id);
  console.warn(`sprite ${why}: ${id}`);
}

/**
 * The placeholder of a sprite that is not there: the web's two 45° gradients, 8 px apart, which draw a
 * checkerboard of 4 px cells, night-700 at the top left.
 */
export const CHECKER = { cell: 4, ground: 'night-700', cells: 'night-600' } as const satisfies {
  cell: number;
  ground: ColorToken;
  cells: ColorToken;
};

/** The night-600 cells of the checkerboard in a w x h box, cut to the box. */
export function checkerCells(w: number, h: number): Array<{ x: number; y: number; w: number; h: number }> {
  const c = CHECKER.cell;
  const cells: Array<{ x: number; y: number; w: number; h: number }> = [];
  for (let row = 0; row * c < h; row++) {
    for (let col = 0; col * c < w; col++) {
      if ((row + col) % 2 === 0) continue;
      cells.push({ x: col * c, y: row * c, w: Math.min(c, w - col * c), h: Math.min(c, h - row * c) });
    }
  }
  return cells;
}

/**
 * The box a picture of a thing is drawn into, where it must shrink to stand in `room` (the web's `max-h-full max-w-full object-contain`): none where it
 * fits at its own size. Chrome lays a shrunk image on whole CSS pixels: so are its sides here.
 */
export function shrunkTo(id: string, fallback: Size, room: Size): Size | undefined {
  const art = spriteBox(id, 1, 1, fallback);
  if (art.w <= room.w && art.h <= room.h) return undefined;
  const scale = Math.min(room.w / art.w, room.h / art.h);
  return { w: Math.round(art.w * scale), h: Math.round(art.h * scale) };
}

/**
 * The box the banner picture is drawn into at a width: the width, and the height its aspect gives, to a whole point. The web lays the
 * image out at the exact height (157.5 on a 402 phone) and Chrome paints it snapped to CSS pixels (158), so that is the size its
 * rows of art come to; the layout box keeps the exact one, and clips what is over.
 */
export function bannerSize(width: number, art: { w: number; h: number }): { w: number; h: number } {
  return { w: width, h: Math.round((width * art.h) / art.w) };
}
