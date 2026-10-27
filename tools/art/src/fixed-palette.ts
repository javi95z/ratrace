import type { Rgb } from './image';

const hex = (value: string): Rgb => [
  parseInt(value.slice(1, 3), 16),
  parseInt(value.slice(3, 5), 16),
  parseInt(value.slice(5, 7), 16),
];

/** The 31 colours the interface is drawn in. Sprites always have these available. See the design spec, section 6. */
export const FIXED_PALETTE: Rgb[] = [
  '#0b1022', '#141b33', '#1f2a4d', '#263566', '#3b4f8a', '#3b6ea5', '#9ad1d4', '#bfe3f0', '#dff3ff',
  '#5c1a2a', '#8f2d3f', '#d1495b', '#e8788a', '#7a4f12', '#c8891e', '#f2c14e', '#ffe9a8',
  '#1f6f66', '#2a9d8f', '#7fd1b9', '#c98f6b', '#e8b796', '#2e1f1a', '#4a3228',
  '#1a1c2c', '#2b2f44', '#4b5269', '#8b93a7', '#c9cfdc', '#f4f1e4', '#ffffff',
].map(hex);

/** How many colours sprites may add to the fixed ones. */
export const EXTRA_COLOURS = 33;

/**
 * Colours a group is given beyond the fixed ones and those taken from its art: a colour few of its pictures use, which the art alone
 * would not bring in and would otherwise snap to its nearest (the prison jumpsuit's orange, and its shade and light, came out pink).
 */
export const GIVEN_COLOURS: Readonly<Record<string, readonly Rgb[]>> = {
  cards: ['#e46428', '#b04a20', '#f08c50'].map(hex),
};
