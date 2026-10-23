import type { Opener } from '@ratrace/online/types';

/*
 * The web export's twin of `browser.ts` (Metro picks it for the web). On the web Google is reached as the Next web reaches it: the page leaves for
 * Google and comes back to the very page the player was on (apps/web/src/game/context.tsx, `useAccount`), and the client reads the code from the
 * address it comes back to (`detectSessionInUrl`). No browser of the system is opened, so there is no opener: the account takes its web road.
 */

/** Where Google sends the player back to: the page they are on, without whatever a sign-in left after the hash. Read when they ask, never before. */
export const backFromGoogle = (): string => window.location.href.split('#')[0];

/** No browser is opened for Google on the web: the page itself goes (`keepWithGoogle(backFromGoogle(), undefined)`). */
export const openForGoogle: Opener | undefined = undefined;
