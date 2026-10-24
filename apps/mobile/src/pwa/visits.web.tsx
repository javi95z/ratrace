import { Analytics, track as send } from '@vercel/analytics/react';
import { isLocale } from '@ratrace/i18n/locales';
import { usePathname } from 'expo-router';
import type { Track } from '../game/events';

/*
 * The web export's twin of `visits.tsx` (Metro picks it for the web): how many come, to which page and from where, and the eight events of how the
 * game is played, counted by Vercel Web Analytics as the Next web counts them (`apps/web/src/pwa/Visits.tsx`, and `toVercel` in `events.ts`). The
 * framework-agnostic entry of the same library, at the Next web's version. A production build alone counts: the Analytics script is put in the page
 * by an effect, so never while the build draws it, and the development server counts nothing.
 */

/** True in a production build: Metro writes `process.env.NODE_ENV` in (read when asked, so a test may say). */
const isProduction = (): boolean => process.env.NODE_ENV === 'production';

/** An address without its query: an invitation's code is nobody's to count. */
const withoutQuery = <Event extends { url: string }>(event: Event): Event => ({ ...event, url: event.url.split('?')[0] });

/**
 * The page's route as Vercel groups visits by it, as the Next entry computes it: the language segment of the address named as the Next web's
 * `[locale]` (`/es/play` is `/[locale]/play`, the front door `/en` is `/[locale]`); an address outside the languages is its own route.
 */
function routeOf(path: string): string {
  const [, first = '', ...rest] = path.split('/');
  return isLocale(first) ? `/[locale]${rest.length > 0 ? `/${rest.join('/')}` : ''}` : path;
}

/**
 * The Next entry's way of counting, which this entry only does when it is given a `route` and a `path`: each move to another address, a replace
 * as well as a push (the game replaces a page with the next one a good many times), is a visit sent by hand, and the script's own detection of
 * moves is off. The path is the address's, with no query.
 */
function Counting() {
  const path = usePathname();
  return <Analytics path={path} route={routeOf(path)} beforeSend={withoutQuery} />;
}

/**
 * How many come, to which page and from where, counted by Vercel with no cookie and nothing that follows a person, a visit for each page the player
 * is on (`Counting`), the address sent without its query. Only in a production build.
 */
export function Visits() {
  return isProduction() ? <Counting /> : null;
}

/**
 * The sender it is given, which still counts as it did, and the event also through Vercel's `track` in a production build, as the Next web counts it.
 * Counting never gets in the way of the game: a failure to count is no failure of anything.
 */
export function alsoToVercel(track: Track): Track {
  if (!isProduction()) return track;
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
