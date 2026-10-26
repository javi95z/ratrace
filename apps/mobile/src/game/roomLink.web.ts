import { SITE_URL } from './site';

/*
 * The web export's twin of `roomLink.ts` (Metro picks it for the web): the link is the page's own address with the code, as the Next web builds it
 * (`window.location.origin` in its `Room.tsx`), so a preview deployment invites to itself and the published game to the published game.
 */

/** The link to the room `code`, in `locale`'s words, on the page's own address (the published one where there is no page, as in a test of Node). */
export const roomLink = (locale: string, code: string): string => {
  const origin = typeof window === 'undefined' ? SITE_URL.origin : window.location.origin;
  return `${origin}/${locale}/room?code=${code}`;
};

/** The link that asks for friendship (`roomLink.ts`), on the page's own address. */
export const friendLink = (locale: string, code: string): string => {
  const origin = typeof window === 'undefined' ? SITE_URL.origin : window.location.origin;
  return `${origin}/${locale}/rankings?tab=friends&friend=${code}`;
};
