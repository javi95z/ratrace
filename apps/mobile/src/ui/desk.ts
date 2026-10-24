import { SHELL_WIDTH } from './theme';

/*
 * The widths a browser lays the game out at, as the Next web's stylesheet does (its `desk` and `sm` breakpoints, its `max-w-2xl` pages). The phone has
 * none of them: it is one column at every width, as it has always been. The web's twin (`desk.web.ts`) answers the browser's own media queries.
 */

/** Whether the screen is wide enough for the game's three columns (the web's `desk`, 64rem). Never on the phone. */
export function useIsDesk(): boolean {
  return false;
}

/** Whether the screen is at least the web's `sm` wide (40rem): where a list of two short things stands two to a row. Never on the phone. */
export function useIsWide(): boolean {
  return false;
}

/** The column of a page of lists and reading (the rankings, the records, the collection, the legal page): the web's `max-w-2xl`. On the phone, its one column. */
export const WIDE_COLUMN = SHELL_WIDTH;
