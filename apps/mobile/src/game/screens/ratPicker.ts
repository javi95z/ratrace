/*
 * The pure side of the rat's editor (`RatEditor.tsx`): how its screen is shared out between the rat, the row of parts and the choices, how large a
 * choice is, and which choice a swipe of the rat moves to. Nothing here draws.
 */

/** Room between two choices, and between a page of them and the next. */
export const GAP = 6;
/** The fewest choices to a row of a page on a phone: five, as the profile's grid had them. */
export const MIN_COLUMNS = 5;
/** The largest a choice is drawn, on a tablet or a desk: past this, more of them to a row. */
export const MAX_TILE = 96;
/** The share of the editor's height the choices take on a phone (two rows of them), the rat the most of the rest. */
export const CHOICES_SHARE = 0.35;

/** How a part's choices are laid out: so many to a row, so many rows to a page, each `tile` square. */
export interface PickerLayout {
  columns: number;
  rows: number;
  perPage: number;
  pages: number;
  tile: number;
}

/**
 * Two rows of choices a page, paged sideways (a phone): as large as `height` lets two rows be, at least `MIN_COLUMNS` to a row of `width`, and no
 * larger than `MAX_TILE`.
 */
export function pagedLayout(width: number, height: number, count: number): PickerLayout {
  if (width <= 0 || height <= 0) return { columns: MIN_COLUMNS, rows: 2, perPage: 2 * MIN_COLUMNS, pages: 1, tile: 0 };
  const tallest = Math.min(MAX_TILE, (height - GAP) / 2);
  const columns = Math.max(MIN_COLUMNS, Math.ceil((width + GAP) / (tallest + GAP)));
  const tile = (width - (columns - 1) * GAP) / columns;
  const perPage = 2 * columns;
  return { columns, rows: 2, perPage, pages: Math.max(1, Math.ceil(count / perPage)), tile };
}

/** Every choice at once (a desk): the number to a row that makes them largest in `width` by `height`, no larger than `MAX_TILE`. */
export function wholeLayout(width: number, height: number, count: number): PickerLayout {
  let best: PickerLayout = { columns: 1, rows: Math.max(1, count), perPage: count, pages: 1, tile: 0 };
  if (width <= 0 || height <= 0 || count === 0) return best;
  for (let columns = 1; columns <= count; columns += 1) {
    const rows = Math.ceil(count / columns);
    const tile = Math.min(MAX_TILE, (width - (columns - 1) * GAP) / columns, (height - (rows - 1) * GAP) / rows);
    // The fewest to a row at the largest size: a grid no wider than it needs.
    if (tile > best.tile + 1e-9) best = { columns, rows, perPage: count, pages: 1, tile };
  }
  return best;
}

/** Where choice `index` stands in its strip of pages, each page `pageWidth` wide: its left and top. */
export function placeOfChoice(index: number, layout: PickerLayout, pageWidth: number): { x: number; y: number; page: number } {
  const page = Math.floor(index / layout.perPage);
  const at = index % layout.perPage;
  return { x: page * pageWidth + (at % layout.columns) * (layout.tile + GAP), y: Math.floor(at / layout.columns) * (layout.tile + GAP), page };
}

/**
 * The choice `way` steps on from `from` (1 the next, -1 the one before), round the ends, passing over every one that is locked: `from` itself when
 * nothing else may be worn.
 */
export function stepChoice<T extends { locked: string | null }>(choices: readonly T[], from: number, way: 1 | -1): number {
  const count = choices.length;
  for (let step = 1; step < count; step += 1) {
    const at = (((from + way * step) % count) + count) % count;
    if (choices[at].locked === null) return at;
  }
  return from;
}

/**
 * The size the rat is drawn at in a box of `room` points: the largest whole number of the screen's pixels for each of its 128 (`ratio` pixels a point),
 * every pixel of it as sharp as the next; the room itself when even one is more than it has.
 */
export function crispSize(room: number, ratio: number): number {
  const art = 128;
  const times = Math.floor((room * ratio) / art);
  return times >= 1 ? (times * art) / ratio : Math.max(0, room);
}
