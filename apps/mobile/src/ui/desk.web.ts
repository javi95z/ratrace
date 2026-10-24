import { useSyncExternalStore } from 'react';

/*
 * The web's twin of `desk.ts`: the widths of the Next web's stylesheet, read from the browser's media queries as its `useIsDesk` reads them
 * (apps/web/src/ui/useMedia.ts). Each is false while the page is first drawn, on the build's machine and in the browser alike, so the HTML of the
 * export and the browser's first drawing of it never disagree (the Next web's own rule); the browser then draws it again at its width. The pages
 * this changes (Play, the end of a life, a sheet) have nothing to show in the export's HTML but a word of loading: none of them jumps on its first paint.
 */

/** The web's `--breakpoint-desk` (globals.css): three columns from here up. Tailwind's `lg` is the same width. */
export const DESK = '(min-width: 64rem)';
/** Tailwind's `sm`. */
export const WIDE = '(min-width: 40rem)';

const queryOf = (query: string): MediaQueryList | null =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(query) : null;

/** Whether the browser matches `query`, heard again when it changes; false on the build's machine and in the drawing that takes its HTML over. */
function useMedia(query: string): boolean {
  return useSyncExternalStore(
    (notify) => {
      const list = queryOf(query);
      list?.addEventListener('change', notify);
      return () => list?.removeEventListener('change', notify);
    },
    () => queryOf(query)?.matches ?? false,
    () => false,
  );
}

/** Whether the screen is wide enough for the game's three columns (the web's `desk`, 64rem), as the Next web's `useIsDesk`. */
export function useIsDesk(): boolean {
  return useMedia(DESK);
}

/** Whether the screen is at least the web's `sm` wide (40rem): where a list of two short things stands two to a row. */
export function useIsWide(): boolean {
  return useMedia(WIDE);
}

/** The column of a page of lists and reading (the rankings, the records, the collection, the legal page): the web's `max-w-2xl`, at every width. */
export const WIDE_COLUMN = 672;
