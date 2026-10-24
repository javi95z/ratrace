import { SITE_URL } from './site';

/*
 * Where an invitation to a game with others leads: the web's own address, `/<locale>/room?code=`, which opens the web's game wherever it is opened.
 * On the phone it is the address the web is published at (`SITE_URL`); the web export's twin (`roomLink.web.ts`) takes the page's own, as the Next web
 * does (its `Room.tsx`), so a preview invites to itself.
 */

/** The link to the room `code`, in `locale`'s words. The app's own room opens by `theratrace://room?code=`. */
export const roomLink = (locale: string, code: string): string => `${SITE_URL.origin}/${locale}/room?code=${code}`;
