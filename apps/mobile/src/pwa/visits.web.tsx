import { Analytics, track as send } from '@vercel/analytics/react';
import type { Track } from '../game/events';

/*
 * The web export's twin of `visits.tsx` (Metro picks it for the web): how many come, to which page and from where, and the eight events of how the
 * game is played, counted by Vercel Web Analytics as the Next web counts them (`apps/web/src/pwa/Visits.tsx`, and `toVercel` in `events.ts`). The
 * framework-agnostic entry of the same library, at the Next web's version. A production build alone counts: the Analytics script is put in the page
 * by an effect, so never while the build draws it, and the development server counts nothing.
 */

/** True in a production build: Metro writes `process.env.NODE_ENV` in. */
const isProduction = (): boolean => process.env.NODE_ENV === 'production';

/**
 * How many come, to which page and from where, counted by Vercel with no cookie and nothing that follows a person. The address is sent without its
 * query: an invitation's code is nobody's to count.
 */
export function Visits({ production = isProduction() }: { production?: boolean }) {
  if (!production) return null;
  return <Analytics beforeSend={(event) => ({ ...event, url: event.url.split('?')[0] })} />;
}

/**
 * The sender it is given, which still counts as it did, and the event also through Vercel's `track` in a production build, as the Next web counts it.
 * Counting never gets in the way of the game: a failure to count is no failure of anything.
 */
export function alsoToVercel(track: Track, production = isProduction()): Track {
  if (!production) return track;
  return (event) => {
    track(event);
    try {
      const { name, ...data } = event;
      send(name, data);
    } catch {
      // Nothing: a count missed is a count missed.
    }
  };
}
