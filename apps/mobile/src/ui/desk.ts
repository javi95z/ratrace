import { useWindowDimensions } from 'react-native';

/*
 * The widths the game lays out at on the phone's own screen, the web's (`desk.web.ts`) in points: a phone is one column; a tablet held sideways (or
 * one wide enough upright) has the game's three columns, and a list of two short things two to a row from the web's `sm`. Read from the window, so
 * a tablet turned, or an app given half of one, lays itself out again.
 */

/** The web's `desk` (64rem) in points: the game's three columns from here up. */
export const DESK_WIDTH = 1024;
/** The web's `sm` (40rem) in points. */
export const WIDE_WIDTH = 640;

/** Whether the window is wide enough for the game's three columns (a tablet held sideways). Never on a phone. */
export function useIsDesk(): boolean {
  return useWindowDimensions().width >= DESK_WIDTH;
}

/** Whether the window is at least the web's `sm` wide: where a list of two short things stands two to a row. Never on a phone. */
export function useIsWide(): boolean {
  return useWindowDimensions().width >= WIDE_WIDTH;
}

/** The column of a page of lists and reading (the rankings, the records, the collection, the legal page): the web's `max-w-2xl`; a phone's is narrower. */
export const WIDE_COLUMN = 672;
