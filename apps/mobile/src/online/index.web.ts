import type { PlayerStore } from '@ratrace/core/session/types';
import { connectSupabase } from '@ratrace/online/connect';
import type { Cloud } from '@ratrace/online/supabase';
// The store's web twin, as Metro picks it for the web (and the wall sees who wires the store: architecture.test.ts).
import { kvText } from '../kvStore';
import { phoneTurnstile } from './captcha.web';
import { phoneErrors, watchErrors } from './errors.web';
import { heldSaves, pacedLives } from './held';
import { givenUpIn, offline, onlineOver, refusedIn } from './over';
import type { Online } from './over';
import { phonePage } from './page.web';

export { givenUpIn, onlineOver, refusedIn } from './over';
export type { Online, OnlineParts } from './over';

/*
 * The web export's twin of `index.ts` (Metro picks it for the web): the cloud of the browser, made as the Next web makes it
 * (apps/web/src/online/index.ts, `browserOnline`), so that a player signed in there, a guest or with Google, is the same player here after the swap.
 * What the game gets of the cloud, what it is made of and how it is put together are the phone's (`over.ts`, shared by both); what is the browser's
 * is the Next web's: the client made with no storage of the app's (supabase-js keeps the session in the browser's own storage under
 * its own key, `sb-<ref>-auth-token`) and renewing it by itself, the page's whole address read for Google's answer and cleaned with the history, the
 * lists of lives kept under the Next web's keys (the store's `kvText`), and the window's errors watched in production.
 */

/**
 * The client the account connected last. The browser's client renews its session by itself, as the Next web's does (the page in front or not is its
 * own business), and signing out is the client's own, so there is nothing to add to it: it is only remembered, for what the game counts (`track.ts`).
 * `stop` forgets it.
 */
export function onThePhone(): { connected(cloud: Cloud): Cloud; cloud(): Cloud | null; stop(): void } {
  let current: Cloud | null = null;
  return {
    connected(cloud) {
      current = cloud;
      return cloud;
    },
    cloud: () => current,
    stop() {
      current = null;
    },
  };
}

/** The page's one record of its client, made with the first cloud. */
let thePhone: ReturnType<typeof onThePhone> | null = null;
/**
 * The client the account connected last, signed in or not, or null before one has (and in a build with no project): what the game counts of how it
 * is played is sent through it (`track.ts`).
 */
export const phonesCloud = (): Cloud | null => thePhone?.cloud() ?? null;

/** How to stop watching the page's errors: they are watched once, for the cloud made last. */
let stopWatching: (() => void) | null = null;

/**
 * For a test (and `testing/*`) only, which the wall holds (architecture.test.ts): forgets the client and stops the watch, and the next cloud made
 * starts them anew, as a new load of the page would.
 */
export function forgetThePhone(): void {
  thePhone?.stop();
  thePhone = null;
  stopWatching?.();
  stopWatching = null;
}

/**
 * The cloud of this browser, around the device's store, made once for each load of the page (the game's context holds it, `shared`). With no Supabase
 * project in the build's settings there is none: the store is the device's own, and the game is exactly what it is without a network. With
 * `livesAfter`, the account's lives in progress are handed to the mirror only once it resolves (the game's first screen drawn, `held.ts`), as on the
 * phone.
 */
export function phoneOnline(device: PlayerStore, livesAfter?: () => Promise<void>): Online {
  // Named in full, because the build writes these values into the page only where it sees them so (Expo's `EXPO_PUBLIC_*`).
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return offline(device);
  // Where the database is. Named, the functions that use it most are asked for there. Named in full, as the two above.
  const region = process.env.EXPO_PUBLIC_SUPABASE_REGION || undefined;
  // The site key of the guard at the door of guest sign-in. Named, a guest is made only with its word; left out, there is no guard.
  const siteKey = process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY || undefined;
  const captcha = siteKey ? phoneTurnstile(siteKey) : undefined;
  const page = (thePhone ??= onThePhone());
  const online = onlineOver(device, {
    // The Next web's client: no storage named (the session is supabase-js's own, in the browser's storage), renewed by itself, the code read from the address.
    connect: async () => {
      const cloud = await connectSupabase(url, key, { region, captcha });
      return page.connected(livesAfter ? heldSaves(cloud, livesAfter) : cloud);
    },
    // The page's whole address, as the Next web reads it: Google's answer may come after the hash as well as in the query.
    address: () => window.location.href,
    clean: (address) => window.history.replaceState(window.history.state, '', address),
    page: phonePage,
    remember: givenUpIn(() => kvText),
    keepRefused: refusedIn(() => kvText),
    newId: () => crypto.randomUUID(),
    // The account's lives in progress played back one at a time, the page free between them (held.ts).
    pace: pacedLives,
  });
  // Out of production, an error is the developer's to read in the console, not to send. A page that will not be watched plays on all the same.
  if (process.env.NODE_ENV === 'production') {
    try {
      stopWatching?.();
      stopWatching = null;
      stopWatching = watchErrors(online, phoneErrors());
    } catch {
      // Nothing is watched: the game is what it is without it.
    }
  }
  return online;
}
