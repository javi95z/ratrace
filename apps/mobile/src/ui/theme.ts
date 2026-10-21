/*
 * The web's look, held to its stylesheet: the same 31 colours (apps/web/src/app/globals.css, the
 * @theme block) and the same measures. The test in theme.test.ts reads that file and fails if the two drift.
 */

export const COLORS = {
  'night-900': '#0b1022',
  'night-800': '#141b33',
  'night-700': '#1f2a4d',
  'night-600': '#263566',
  'night-500': '#3b4f8a',
  'sky-500': '#3b6ea5',
  'sky-300': '#9ad1d4',
  'sky-200': '#bfe3f0',
  'sky-100': '#dff3ff',
  'wine-900': '#5c1a2a',
  'wine-700': '#8f2d3f',
  'wine-500': '#d1495b',
  'wine-300': '#e8788a',
  'gold-900': '#7a4f12',
  'gold-700': '#c8891e',
  'gold-500': '#f2c14e',
  'gold-200': '#ffe9a8',
  'teal-800': '#1f6f66',
  'teal-600': '#2a9d8f',
  'teal-300': '#7fd1b9',
  'skin-500': '#c98f6b',
  'skin-300': '#e8b796',
  'wood-900': '#2e1f1a',
  'wood-700': '#4a3228',
  'ink-900': '#1a1c2c',
  'ink-700': '#2b2f44',
  'ink-500': '#4b5269',
  'ink-300': '#8b93a7',
  'ink-200': '#c9cfdc',
  cream: '#f4f1e4',
  white: '#ffffff',
} as const satisfies Record<string, string>;

export type ColorToken = keyof typeof COLORS;

/** The width of the frame's lit and shaded edge. */
export const EDGE = 2;

/** The phone shell is at most this wide (points), centred. */
export const SHELL_WIDTH = 448;

/** The web's `px-3`: the room between a page's column and the side of the screen, inside the column. */
export const GUTTER = 12;

/** The smallest a thing that can be pressed may be (points). */
export const TOUCH = 44;

/** Body text: 15 pt, line height 1.45, cream. */
export const BODY = { size: 15, lineHeight: 1.45, color: 'cream' } as const;

/** Colours the web uses outside the 31 tokens. */
export const EXTRA = {
  /** The dimmed page behind a Sheet (night-900 at 80%). */
  backdrop: 'rgba(11,16,34,0.8)',
  /** The strip a city's name is written on, over its banner (the web's `bg-night-900/85`). */
  label: 'rgba(11,16,34,0.85)',
  /** The newspaper's drop shadow on the table (the web's `4px 4px 0 rgb(0 0 0 / 0.45)`). */
  paperShadow: 'rgba(0,0,0,0.45)',
  /** The band of light that crosses a rare card (the web's `bg-white/40`). */
  glint: 'rgba(255,255,255,0.4)',
  /** The common badge's rim (RARITY_TONE.common). */
  bronze: '#c98a4b',
  /** The glow round a badge card, as a CSS box-shadow (rarityStyle.ts). */
  glow: {
    uncommon: '0 0 6px rgba(240,230,210,0.35)',
    rare: '0 0 12px rgba(233,177,60,0.6)',
    legendary: '0 0 20px rgba(94,224,200,0.7)',
  },
} as const;

/**
 * The web's `grayscale` filter at its full amount (Filter Effects 1, `grayscale()`), as the 4 × 5 colour matrix Skia takes: each of red, green and
 * blue becomes the luminance of the three, alpha is kept, nothing is added. The web draws a badge not yet earned through it, its frame, its words
 * and its pictures (the collection's `grayscale` card); the phone draws the same card's pictures through this matrix (`Sprite`'s `grey`) and its
 * colours as `grey` gives them. Applied to the colours as they are written (sRGB), as the browser applies its filter functions.
 */
export const GREYSCALE: readonly number[] = [0.2126, 0.7152, 0.0722, 0, 0, 0.2126, 0.7152, 0.0722, 0, 0, 0.2126, 0.7152, 0.0722, 0, 0, 0, 0, 0, 1, 0];

/**
 * A colour of the palette (`#rrggbb`) as the web's `grayscale` filter draws it: the grey of its luminance, to the nearest whole step. Anything else
 * (a colour with alpha, a name, a token's name) is refused: it has no grey to give.
 */
export function grey(hex: string): string {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) throw new Error(`grey: not a #rrggbb colour: ${hex}`);
  const [r, g, b] = [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16));
  const step = Math.round(GREYSCALE[0] * r + GREYSCALE[1] * g + GREYSCALE[2] * b);
  const two = Math.min(255, Math.max(0, step)).toString(16).padStart(2, '0');
  return `#${two}${two}${two}`;
}
