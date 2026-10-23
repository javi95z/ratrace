import { COLORS } from './theme';

/*
 * The pure side of the glows and the shines: what the phone's Skia files (`Glow.tsx`, `Shine.tsx`) and the web export's CSS twins
 * (`Glow.web.tsx`, `Shine.web.tsx`) both read, so that the two cannot part ways on a colour or an angle.
 */

/** A glow as the web writes it: a box-shadow of one layer with no offset and no spread, `0 0 <blur>px <colour>`. */
const GLOW = /^0 0 (\d+(?:\.\d+)?)px (rgba?\([^()]*\)|#[0-9a-fA-F]{3,8})$/;

/** The blur and colour of a glow (`EXTRA.glow`), or null for any other shadow and for none. */
export function glowOf(shadow: string): { blur: number; colour: string } | null {
  const match = GLOW.exec(shadow.trim());
  if (match === null || Number(match[1]) <= 0) return null;
  return { blur: Number(match[1]), colour: match[2] };
}

/**
 * The web's `linear-gradient(110deg, #d1495b, #f2c14e, #7fd1b9, #9ad1d4, #3b6ea5, #d1495b)`: the colours of the rainbow
 * of a legendary card, all of them the palette's (wine, gold, teal, sky, blue, wine).
 */
export const HOLO_COLORS = [COLORS['wine-500'], COLORS['gold-500'], COLORS['teal-300'], COLORS['sky-300'], COLORS['sky-500'], COLORS['wine-500']];

/**
 * Where CSS puts the line of a 110 degree gradient across a w x h box: through the middle, pointing right and a little
 * down, as long as the box is deep along it (|w sin a| + |h cos a|), so that the corners take its first and last colours.
 */
export function holoGradient(w: number, h: number): { start: { x: number; y: number }; end: { x: number; y: number } } {
  const angle = (110 * Math.PI) / 180;
  const along = { x: Math.sin(angle), y: -Math.cos(angle) };
  const half = (Math.abs(w * Math.sin(angle)) + Math.abs(h * Math.cos(angle))) / 2;
  return {
    start: { x: w / 2 - along.x * half, y: h / 2 - along.y * half },
    end: { x: w / 2 + along.x * half, y: h / 2 + along.y * half },
  };
}
