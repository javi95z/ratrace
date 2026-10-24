/*
 * The pages of the game by name, apart from `pages.ts` (which needs the router) so that what runs on the build's machine without the app (the site's
 * pieces after the export, `scripts/sitePieces.ts`) can name them too. `pages.ts` re-exports both.
 */

/** A page of the game: the front door (`''`) and every page after it, as the Next web's `app/[locale]/*`. */
export type Page = '' | 'new' | 'challenge' | 'room' | 'rankings' | 'collection' | 'records' | 'play' | 'player' | 'legal';

/** Every page, the front door first. */
export const PAGES: readonly Page[] = ['', 'new', 'challenge', 'room', 'rankings', 'collection', 'records', 'play', 'player', 'legal'];
