import { SITE_URL } from './site';

/*
 * Where an invitation to a game with others leads: the web's own address, `/<locale>/room?code=`, which opens the web's game wherever it is opened.
 * On the phone it is the address the web is published at (`SITE_URL`); the web export's twin (`roomLink.web.ts`) takes the page's own, as the Next web
 * does (its `Room.tsx`), so a preview invites to itself.
 */

/** The link to the room `code`, in `locale`'s words. The app's own room opens by `theratrace://room?code=`. */
export const roomLink = (locale: string, code: string): string => `${SITE_URL.origin}/${locale}/room?code=${code}`;

/**
 * The link that asks the player for friendship: the games with others' page, where the friends are, with the player's code ready to send (`?friend=`), on the web or, where Android
 * hands the site's pages to the app (app.json's `intentFilters`), in the app. What the friend code's QR holds, and what is shared beside the code.
 */
export const friendLink = (locale: string, code: string): string => `${SITE_URL.origin}/${locale}/room?friend=${code}`;
