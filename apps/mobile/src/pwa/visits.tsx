import type { Track } from '../game/events';

/*
 * How many come to the site, and the eight events of how the game is played, counted by Vercel Web Analytics as the Next web counts them
 * (`apps/web/src/pwa/Visits.tsx`, `events.ts`). That is the web's (`visits.web.tsx`, which Metro picks for the web export). The phone is an app,
 * not a site: it counts no visits, and its events go only to the game's own project (`online/track.ts`).
 */

/** Counts no visits on the phone. */
export const Visits: () => null = () => null;

/** The sender it is given, as it is: the phone's events go only to the game's own project. */
export const alsoToVercel: (track: Track) => Track = (track) => track;
