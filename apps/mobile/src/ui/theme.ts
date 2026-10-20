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
  /** The common badge's rim (RARITY_TONE.common). */
  bronze: '#c98a4b',
  /** The glow round a badge card, as a CSS box-shadow (rarityStyle.ts). */
  glow: {
    uncommon: '0 0 6px rgba(240,230,210,0.35)',
    rare: '0 0 12px rgba(233,177,60,0.6)',
    legendary: '0 0 20px rgba(94,224,200,0.7)',
  },
} as const;
