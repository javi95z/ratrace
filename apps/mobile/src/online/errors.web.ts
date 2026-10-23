import { CONTENT_VERSION } from '@ratrace/content';
import { ENGINE_VERSION } from '@ratrace/engine';
import { browserOf, buildOf, errorWatch, watchPage } from '@ratrace/online/errors';
import type { Online } from './index.web';

/*
 * The web export's twin of `errors.ts` (Metro picks it for the web): the page's errors, watched and sent as the Next web's are (its `watchErrors`,
 * apps/web/src/online/index.ts; `docs/errors.md`). A browser has the page the package's `watchPage` hears: the window's `error` and
 * `unhandledrejection`, and what is written to the console as an error. The place is the page's path, the build the game's versions and the commit
 * the site was built from, the browser by its name, as on the Next web.
 */

/** The page's log, of which the watch hears what is written as an error. */
interface Log {
  error(...args: unknown[]): void;
}

/** What the watch hears the page through, and tells the time with. The browser's own in the app (`phoneErrors`); a test's in a test. */
export interface AppErrorParts {
  page: EventTarget;
  log: Log;
  schedule(run: () => void, ms: number): void;
  /** The path of the page, as the address says it. */
  place(): string;
}

/** The path of the page, for an error report: the address's own, as the Next web reads it. */
export const place = (): string => window.location.pathname;

/** Nothing to keep on the web: the page's path is read from its address when an error comes (`place`). Kept so that the game's context is the phone's. */
export function usePlace(): void {}

/**
 * Watches what goes wrong on the page and sends it, cleaned, as whoever is signed in: at once if someone is, and as soon as someone is if nobody is
 * yet. Returns how to stop.
 */
export function watchErrors(online: Pick<Online, 'account' | 'reportErrors'>, parts: AppErrorParts): () => void {
  const watch = errorWatch({
    send: online.reportErrors,
    place: parts.place,
    // Named in full, as the project's values: the build writes it into the page only where it sees it so. Vercel's own name for it, with Expo's prefix.
    build: buildOf(ENGINE_VERSION, CONTENT_VERSION, process.env.EXPO_PUBLIC_VERCEL_GIT_COMMIT_SHA || undefined),
    browser: browserOf(navigator.userAgent),
    schedule: parts.schedule,
  });
  const stopHearing = watchPage(watch, parts.page, parts.log);
  const stopFollowing = online.account.subscribe(() => void watch.flush());
  return () => {
    stopHearing();
    stopFollowing();
  };
}

/** The browser's own: the window, the console, the window's timers, and the address. */
export function phoneErrors(): AppErrorParts {
  return { page: window, log: console, schedule: (run, ms) => void window.setTimeout(run, ms), place };
}
